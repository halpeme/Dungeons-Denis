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

  sessionManager.broadcast(ctx.sessionId, {
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
  sessionManager.broadcast(ctx.sessionId, {
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

// Handler for display:mode
function handleDisplayMode(ctx: GmContext, payload: { mode: 'blank' | 'map' }) {
  const { mode } = payload;

  sessionManager.updateSession(ctx.sessionId, { displayMode: mode });

  sessionManager.broadcast(ctx.sessionId, {
    type: 'display:mode',
    payload: { mode },
  });
}

// Handler for map:gridConfig
function handleGridConfig(ctx: GmContext, payload: any) {
  // Store grid config in session
  sessionManager.updateSession(ctx.sessionId, { gridConfig: payload });

  // Broadcast to table display
  sessionManager.broadcastToTable(ctx.sessionId, {
    type: 'map:gridConfig',
    payload,
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
  'map:gridConfig': handleGridConfig,
  'figures:update': handleFiguresUpdate,
  'figures:clear': handleFiguresClear,
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
