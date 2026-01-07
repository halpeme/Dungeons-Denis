/**
 * GM Message Handlers Registry
 * Centralized handlers for GM-originated WebSocket messages
 */

import { sessionManager } from '../../session/manager.js';
import type { WSMessage } from '../events.js';

interface GmContext {
  sessionId: string;
}

type GmHandler = (ctx: GmContext, payload: any) => void;

// Handler for map:state
function handleMapState(ctx: GmContext, payload: { mapImage: string; fogMask: string }) {
  const { mapImage, fogMask } = payload;

  sessionManager.updateSession(ctx.sessionId, {
    mapImage,
    fogMask,
    displayMode: 'map',
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'map:state',
    payload: { mapImage, fogMask },
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'map' },
  });
}

// Handler for map:fogUpdate
function handleMapFogUpdate(ctx: GmContext, payload: { fogMask: string }) {
  const { fogMask } = payload;

  sessionManager.updateSession(ctx.sessionId, { fogMask });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'map:fogUpdate',
    payload: { fogMask },
  });
}

// Handler for map:fogPartial
function handleMapFogPartial(ctx: GmContext, payload: { x: number; y: number; w: number; h: number; chunk: string }) {
  // Just broadcast partial update to table, do NOT update session persistence
  // (Client will send full update debounced)
  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'map:fogPartial',
    payload,
  });
}

// Handler for map:clear
function handleMapClear(ctx: GmContext) {
  sessionManager.updateSession(ctx.sessionId, {
    mapImage: null,
    fogMask: null,
    displayMode: 'blank',
  });

  sessionManager.broadcastToTable(ctx.sessionId, { type: 'map:clear' });
  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'blank' },
  });
}

// Handler for figures:update
function handleFiguresUpdate(ctx: GmContext, payload: { figures: any[] }) {
  const { figures } = payload;

  sessionManager.updateSession(ctx.sessionId, { figures });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'figures:update',
    payload: { figures },
  });
}

// Handler for figures:clear
function handleFiguresClear(ctx: GmContext) {
  sessionManager.updateSession(ctx.sessionId, { figures: [] });

  sessionManager.broadcastToTable(ctx.sessionId, { type: 'figures:clear' });
}

// Handler for handout:push
function handleHandoutPush(ctx: GmContext, payload: { imageUrl: string }) {
  const { imageUrl } = payload;

  sessionManager.updateSession(ctx.sessionId, {
    displayMode: 'handout',
    currentHandout: imageUrl,
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'handout:display',
    payload: { imageUrl },
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'handout' },
  });
}

// Handler for handout:clear
function handleHandoutClear(ctx: GmContext) {
  sessionManager.updateSession(ctx.sessionId, {
    displayMode: 'map',
    currentHandout: null,
  });

  sessionManager.broadcastToTable(ctx.sessionId, { type: 'handout:clear' });
  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'map' },
  });
}

// Handler for decision:push
function handleDecisionPush(ctx: GmContext, payload: { id: string; title: string; options: { id: string; text: string }[] }) {
  sessionManager.updateSession(ctx.sessionId, {
    displayMode: 'decision',
    currentDecision: payload,
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'decision:display',
    payload,
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'decision' },
  });
}

// Handler for decision:clear
function handleDecisionClear(ctx: GmContext) {
  sessionManager.updateSession(ctx.sessionId, {
    displayMode: 'map',
    currentDecision: null,
  });

  sessionManager.broadcastToTable(ctx.sessionId, { type: 'decision:clear' });
  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'map' },
  });
}

// Handler for puzzle:push
function handlePuzzlePush(ctx: GmContext, payload: { id: string; type: string; data: unknown }) {
  sessionManager.updateSession(ctx.sessionId, {
    displayMode: 'puzzle',
    currentPuzzle: payload as any,
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'puzzle:display',
    payload,
  });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode: 'puzzle' },
  });
}

// Handler for display:mode
function handleDisplayMode(ctx: GmContext, payload: { mode: 'blank' | 'map' | 'handout' | 'decision' | 'puzzle' }) {
  const { mode } = payload;

  sessionManager.updateSession(ctx.sessionId, { displayMode: mode });

  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode },
  });
}

/**
 * GM Handler Registry
 * Maps message types to their handlers
 */
export const gmHandlers: Record<string, GmHandler> = {
  'map:state': handleMapState,
  'map:fogUpdate': handleMapFogUpdate,
  'map:fogPartial': handleMapFogPartial,
  'map:clear': handleMapClear,
  'figures:update': handleFiguresUpdate,
  'figures:clear': handleFiguresClear,
  'handout:push': handleHandoutPush,
  'handout:clear': handleHandoutClear,
  'decision:push': handleDecisionPush,
  'decision:clear': handleDecisionClear,
  'puzzle:push': handlePuzzlePush,
  'display:mode': handleDisplayMode,
};

/**
 * Process a GM message using the handler registry
 * Returns true if the message was handled, false otherwise
 */
export function processGmMessage(sessionId: string, message: WSMessage): boolean {
  const handler = gmHandlers[message.type];
  if (!handler) {
    return false;
  }

  handler({ sessionId }, message.payload);
  return true;
}
