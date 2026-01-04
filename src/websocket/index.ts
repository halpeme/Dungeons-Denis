import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { sessionManager } from '../session/manager.js';
import type { WSMessage } from './events.js';

interface ConnectionState {
  sessionId: string | null;
  role: 'gm' | 'table' | null;
  gmToken: string | null;
}

export async function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const state: ConnectionState = {
      sessionId: null,
      role: null,
      gmToken: null,
    };

    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        handleMessage(socket, state, message);
      } catch (err) {
        sendError(socket, 'INVALID_MESSAGE', 'Invalid JSON message');
      }
    });

    socket.on('close', () => {
      if (state.sessionId) {
        sessionManager.removeConnection(state.sessionId, socket);

        // Notify GM if table disconnected
        if (state.role === 'table') {
          sessionManager.sendToGm(state.sessionId, { type: 'table:disconnected' });
        }
      }
    });

    socket.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
    });
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

    default:
      sendError(socket, 'UNKNOWN_EVENT', `Unknown event type: ${message.type}`);
  }
}

function handleSessionCreate(socket: WebSocket, state: ConnectionState) {
  const { session, gmToken } = sessionManager.createSession();

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
  socket.send(JSON.stringify({
    type: 'session:state',
    payload: {
      dungeonId: session.dungeonId,
      fogState: session.fogState,
      partyPosition: session.partyPosition,
      figures: session.figures,
      displayMode: session.displayMode,
      tableConnected: sessionManager.getTableConnections(sessionId).length > 0,
    },
  }));
}

function sendError(socket: WebSocket, code: string, message: string) {
  socket.send(JSON.stringify({
    type: 'error',
    payload: { code, message },
  }));
}
