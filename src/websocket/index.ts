import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { sessionManager } from '../session/manager.js';
import type { WSMessage } from './events.js';

interface ConnectionState {
  sessionId: string | null;
  role: 'gm' | 'table' | null;
  gmToken: string | null;
  isAlive: boolean;
}

export async function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (socket: WebSocket, req) => {
    console.log(`[WS] New connection established from ${req.ip}`);
    console.log(`[WS] Headers: ${JSON.stringify(req.headers)}`);

    const state: ConnectionState = {
      sessionId: null,
      role: null,
      gmToken: null,
      isAlive: true,
    };

    socket.on('pong', () => {
      state.isAlive = true;
    });

    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        console.log('[WS] Received message:', message.type);
        handleMessage(socket, state, message);
      } catch (err) {
        sendError(socket, 'INVALID_MESSAGE', 'Invalid JSON message');
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      console.log(`[WS] Connection closed: code=${code}, reason=${reason.toString()}, role=${state.role}`);
      if (state.sessionId) {
        sessionManager.removeConnection(state.sessionId, socket);

        // Notify GM if table disconnected - BUT only if no other table connections exist
        if (state.role === 'table') {
          const tableConns = sessionManager.getTableConnections(state.sessionId);
          if (tableConns.length === 0) {
            sessionManager.sendToGm(state.sessionId, { type: 'table:disconnected' });
          } else {
            console.log(`[WS] Table disconnected, but ${tableConns.length} active connection(s) remain. Not notifying GM.`);
          }
        }
      }
    });

    socket.on('error', (err: Error) => {
      console.error('[WS] WebSocket error:', err);
    });
  });

  // Setup heartbeat interval with proper stale connection detection
  // Use a WeakMap to track connection state without memory leaks
  const connectionState = new WeakMap<WebSocket, { isAlive: boolean }>();

  const interval = setInterval(() => {
    fastify.websocketServer.clients.forEach((client: any) => {
      if (client.readyState === 1) { // OPEN
        const state = connectionState.get(client);

        // If we haven't heard back from the last ping, terminate the connection
        if (state && state.isAlive === false) {
          console.log('[WS] Terminating stale connection (no pong received)');
          return client.terminate();
        }

        // Mark as not alive and send ping
        // Will be set back to true when pong is received
        connectionState.set(client, { isAlive: false });
        client.ping();
      }
    });
  }, 30000);

  // Track pong responses
  fastify.websocketServer.on('connection', (client: any) => {
    connectionState.set(client, { isAlive: true });

    client.on('pong', () => {
      const state = connectionState.get(client);
      if (state) {
        state.isAlive = true;
      }
    });
  });

  fastify.addHook('onClose', (instance, done) => {
    clearInterval(interval);
    done();
  });
}

function handleMessage(socket: WebSocket, state: ConnectionState, message: WSMessage) {
  switch (message.type) {
    // Session events
    case 'session:create':
      handleSessionCreate(socket, state);
      break;

    case 'session:join':
      handleSessionJoin(socket, state, message.payload as { code: string });
      break;

    case 'session:auto-join':
      handleSessionAutoJoin(socket, state);
      break;

    case 'session:reconnect':
      handleSessionReconnect(socket, state, message.payload as { sessionId: string; gmToken: string });
      break;

    // GM-only events (require valid gmToken)
    case 'map:state':
    case 'map:fogUpdate':
    case 'map:clear':
    case 'figures:update':
    case 'figures:clear':
    case 'handout:push':
    case 'handout:clear':
    case 'decision:push':
    case 'decision:clear':
    case 'puzzle:push':
    case 'display:mode':
      if (!validateGm(socket, state)) return;
      handleGmMessage(socket, state, message);
      break;

    // Table events
    case 'puzzle:submit':
      if (state.role !== 'table') {
        sendError(socket, 'UNAUTHORIZED', 'Only table can submit puzzle answers');
        return;
      }
      handlePuzzleSubmit(socket, state, message.payload as { puzzleId: string; answer: unknown });
      break;

    case 'map:ping':
      if (state.role !== 'table') {
        return; // Only table can ping
      }
      // Relay to GM
      if (state.sessionId) {
        console.log(`[WS] Relaying ping from table to GM in session ${state.sessionId}`, message.payload);
        sessionManager.sendToGm(state.sessionId, message);
      } else {
        console.warn('[WS] Ping received but no session ID attached to socket state');
      }
      break;

    // Client heartbeat ping (Safari keep-alive) - just ignore, no response needed
    case 'ping':
      break;

    default:
      sendError(socket, 'UNKNOWN_EVENT', `Unknown event type: ${message.type}`);
  }
}

function handleSessionCreate(socket: WebSocket, state: ConnectionState) {
  console.log('[WS] handleSessionCreate called');

  // Single-session mode: get existing or create new
  const { session, gmToken, isNew } = sessionManager.getOrCreateSession();
  console.log(`[WS] Got session: id=${session.id}, isNew=${isNew}`);

  state.sessionId = session.id;
  state.role = 'gm';
  state.gmToken = gmToken;

  sessionManager.addConnection(session.id, 'gm', socket);

  socket.send(JSON.stringify({
    type: 'session:created',
    payload: {
      sessionId: session.id,
      joinCode: session.joinCode,
      gmToken: gmToken,
    },
  }));

  // If reconnecting to existing session, send current state
  if (!isNew) {
    sendCurrentStateToGm(socket, session.id);
  }
}

function handleSessionAutoJoin(socket: WebSocket, state: ConnectionState) {
  console.log('[WS] handleSessionAutoJoin called');

  // Table auto-join: connect to the active session
  const session = sessionManager.getActiveSession();
  console.log(`[WS] Active session: ${session ? session.id : 'NONE'}`);

  if (!session) {
    sendError(socket, 'NO_SESSION', 'No active session. Please wait for GM to start.');
    return;
  }

  state.sessionId = session.id;
  state.role = 'table';

  sessionManager.addConnection(session.id, 'table', socket);

  // Notify table of successful join
  socket.send(JSON.stringify({
    type: 'session:joined',
    payload: { sessionId: session.id },
  }));

  // Notify GM that table connected
  sessionManager.sendToGm(session.id, { type: 'table:connected' });

  // Send current display state to table
  sendCurrentState(socket, session.id);
}

function handleSessionJoin(socket: WebSocket, state: ConnectionState, payload: { code: string }) {
  const session = sessionManager.getSessionByCode(payload.code);

  if (!session) {
    sendError(socket, 'INVALID_CODE', 'Invalid session code');
    return;
  }

  state.sessionId = session.id;
  state.role = 'table';

  sessionManager.addConnection(session.id, 'table', socket);

  // Notify table of successful join
  socket.send(JSON.stringify({
    type: 'session:joined',
    payload: { sessionId: session.id },
  }));

  // Notify GM that table connected
  sessionManager.sendToGm(session.id, { type: 'table:connected' });

  // Send current display state to table
  sendCurrentState(socket, session.id);
}

function handleSessionReconnect(socket: WebSocket, state: ConnectionState, payload: { sessionId: string; gmToken: string }) {
  const session = sessionManager.getSession(payload.sessionId);

  if (!session) {
    sendError(socket, 'INVALID_SESSION', 'Session not found');
    return;
  }

  if (!sessionManager.validateGmToken(payload.sessionId, payload.gmToken)) {
    sendError(socket, 'INVALID_TOKEN', 'Invalid GM token');
    return;
  }

  state.sessionId = session.id;
  state.role = 'gm';
  state.gmToken = payload.gmToken;

  sessionManager.addConnection(session.id, 'gm', socket);

  socket.send(JSON.stringify({
    type: 'session:reconnected',
    payload: {
      sessionId: session.id,
      joinCode: session.joinCode,
    },
  }));

  // Send current state
  sendCurrentStateToGm(socket, session.id);
}

function handleGmMessage(socket: WebSocket, state: ConnectionState, message: WSMessage) {
  const sessionId = state.sessionId!;

  switch (message.type) {
    // Image-based map with fog of war
    case 'map:state': {
      const { mapImage, fogMask } = message.payload as { mapImage: string; fogMask: string };

      sessionManager.updateSession(sessionId, {
        mapImage,
        fogMask,
        displayMode: 'map',
      });

      // Broadcast to table
      sessionManager.broadcastToTable(sessionId, {
        type: 'map:state',
        payload: { mapImage, fogMask },
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'map' },
      });
      break;
    }

    case 'map:fogUpdate': {
      const { fogMask } = message.payload as { fogMask: string };

      sessionManager.updateSession(sessionId, { fogMask });

      // Broadcast to table
      sessionManager.broadcastToTable(sessionId, {
        type: 'map:fogUpdate',
        payload: { fogMask },
      });
      break;
    }

    case 'map:fogPartial': {
      // Just broadcast partial update to table, do NOT update session persistence yet
      // (Client will send full update debounced)
      sessionManager.broadcastToTable(sessionId, message);
      break;
    }

    case 'map:clear': {
      sessionManager.updateSession(sessionId, {
        mapImage: null,
        fogMask: null,
        displayMode: 'blank',
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'map:clear',
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'blank' },
      });
      break;
    }

    case 'figures:update': {
      const { figures } = message.payload as { figures: any[] };

      sessionManager.updateSession(sessionId, { figures });

      // Broadcast to table
      sessionManager.broadcastToTable(sessionId, {
        type: 'figures:update',
        payload: { figures },
      });
      break;
    }

    case 'figures:clear': {
      sessionManager.updateSession(sessionId, { figures: [] });

      // Broadcast to table
      sessionManager.broadcastToTable(sessionId, {
        type: 'figures:clear',
      });
      break;
    }

    case 'handout:push': {
      const { imageUrl } = message.payload as { imageUrl: string };

      sessionManager.updateSession(sessionId, {
        displayMode: 'handout',
        currentHandout: imageUrl,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'handout:display',
        payload: { imageUrl },
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'handout' },
      });
      break;
    }

    case 'handout:clear': {
      sessionManager.updateSession(sessionId, {
        displayMode: 'map',
        currentHandout: null,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'handout:clear',
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'map' },
      });
      break;
    }

    case 'decision:push': {
      const decision = message.payload as { id: string; title: string; options: { id: string; text: string }[] };

      sessionManager.updateSession(sessionId, {
        displayMode: 'decision',
        currentDecision: decision,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'decision:display',
        payload: decision,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'decision' },
      });
      break;
    }

    case 'decision:clear': {
      sessionManager.updateSession(sessionId, {
        displayMode: 'map',
        currentDecision: null,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'decision:clear',
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'map' },
      });
      break;
    }

    case 'puzzle:push': {
      const puzzle = message.payload as { id: string; type: string; data: unknown };

      sessionManager.updateSession(sessionId, {
        displayMode: 'puzzle',
        currentPuzzle: puzzle as any,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'puzzle:display',
        payload: puzzle,
      });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode: 'puzzle' },
      });
      break;
    }

    case 'display:mode': {
      const { mode } = message.payload as { mode: 'blank' | 'map' | 'handout' | 'decision' | 'puzzle' };

      sessionManager.updateSession(sessionId, { displayMode: mode });

      sessionManager.broadcastToTable(sessionId, {
        type: 'display:mode',
        payload: { mode },
      });
      break;
    }
  }
}

function handlePuzzleSubmit(socket: WebSocket, state: ConnectionState, payload: { puzzleId: string; answer: unknown }) {
  const session = sessionManager.getSession(state.sessionId!)!;

  if (!session.currentPuzzle || session.currentPuzzle.id !== payload.puzzleId) {
    sendError(socket, 'INVALID_PUZZLE', 'No active puzzle with that ID');
    return;
  }

  // TODO: Validate puzzle answer based on puzzle type
  // For now, forward to GM for manual validation
  sessionManager.sendToGm(state.sessionId!, {
    type: 'puzzle:submitted',
    payload: {
      puzzleId: payload.puzzleId,
      answer: payload.answer,
    },
  });
}

function validateGm(socket: WebSocket, state: ConnectionState): boolean {
  if (state.role !== 'gm' || !state.sessionId) {
    sendError(socket, 'UNAUTHORIZED', 'GM authentication required');
    return false;
  }
  return true;
}

function sendCurrentState(socket: WebSocket, sessionId: string) {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;

  // Send display mode
  socket.send(JSON.stringify({
    type: 'display:mode',
    payload: { mode: session.displayMode },
  }));

  // Send figures if any
  if (session.figures && session.figures.length > 0) {
    socket.send(JSON.stringify({
      type: 'figures:update',
      payload: { figures: session.figures },
    }));
  }

  // Send content based on mode
  if (session.displayMode === 'map') {
    // Check for image-based map first
    const mapData = sessionManager.getMapData(sessionId);
    if (mapData.mapImage) {
      socket.send(JSON.stringify({
        type: 'map:state',
        payload: {
          mapImage: mapData.mapImage,
          fogMask: mapData.fogMask,
        },
      }));
    }
  } else if (session.displayMode === 'handout' && session.currentHandout) {
    socket.send(JSON.stringify({
      type: 'handout:display',
      payload: { imageUrl: session.currentHandout },
    }));
  } else if (session.displayMode === 'decision' && session.currentDecision) {
    socket.send(JSON.stringify({
      type: 'decision:display',
      payload: session.currentDecision,
    }));
  } else if (session.displayMode === 'puzzle' && session.currentPuzzle) {
    socket.send(JSON.stringify({
      type: 'puzzle:display',
      payload: session.currentPuzzle,
    }));
  }
}

function sendCurrentStateToGm(socket: WebSocket, sessionId: string) {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;

  // Send full session state to GM
  const mapData = sessionManager.getMapData(sessionId);
  socket.send(JSON.stringify({
    type: 'session:state',
    payload: {
      dungeonId: session.dungeonId,
      fogState: session.fogState,
      partyPosition: session.partyPosition,
      figures: session.figures,
      displayMode: session.displayMode,
      tableConnected: sessionManager.getTableConnections(sessionId).length > 0,
      mapImage: mapData.mapImage,
      fogMask: mapData.fogMask,
    },
  }));
}

function sendError(socket: WebSocket, code: string, message: string) {
  socket.send(JSON.stringify({
    type: 'error',
    payload: { code, message },
  }));
}
