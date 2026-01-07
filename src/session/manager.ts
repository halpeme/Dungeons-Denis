import { nanoid, customAlphabet } from 'nanoid';
import { db } from '../db/connection.js';
import { config } from '../config.js';
import type { Session, SessionConnection, SessionRow, Decision, Puzzle } from './types.js';
import type { WebSocket } from '@fastify/websocket';

// Generate readable join codes (no ambiguous chars)
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', config.sessionCodeLength);
const generateToken = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', config.tokenLength);

// In-memory connections (sockets can't be stored in DB)
const connections = new Map<string, SessionConnection[]>();

// In-memory map data (base64 images are too large for DB)
const mapData = new Map<string, { mapImage: string | null; fogMask: string | null }>();

export class SessionManager {
  // Create a new session
  createSession(): { session: Session; gmToken: string } {
    const id = nanoid();
    const joinCode = generateCode();
    const gmToken = generateToken();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO sessions (id, join_code, gm_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, joinCode, gmToken, now, now);

    const session: Session = {
      id,
      joinCode,
      gmToken,
      mapImage: null,
      fogMask: null,
      dungeonId: null,
      fogState: [],
      partyPosition: { x: 0, y: 0 },
      figures: [],
      displayMode: 'blank',
      currentHandout: null,
      currentDecision: null,
      currentPuzzle: null,
      createdAt: now,
      updatedAt: now,
    };

    connections.set(id, []);
    mapData.set(id, { mapImage: null, fogMask: null });
    return { session, gmToken };
  }

  // Get session by join code
  getSessionByCode(code: string): Session | null {
    const stmt = db.prepare('SELECT * FROM sessions WHERE join_code = ?');
    const row = stmt.get(code.toUpperCase()) as SessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  // Get session by ID
  getSession(id: string): Session | null {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as SessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  // Validate GM token
  validateGmToken(sessionId: string, token: string): boolean {
    const stmt = db.prepare('SELECT gm_token FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId) as { gm_token: string } | undefined;
    return row?.gm_token === token;
  }

  // Update session
  updateSession(id: string, updates: Partial<Session>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    // Handle in-memory map data (not persisted to DB)
    if (updates.mapImage !== undefined || updates.fogMask !== undefined) {
      const currentMapData = mapData.get(id) || { mapImage: null, fogMask: null };
      if (updates.mapImage !== undefined) {
        currentMapData.mapImage = updates.mapImage;
      }
      if (updates.fogMask !== undefined) {
        currentMapData.fogMask = updates.fogMask;
      }
      mapData.set(id, currentMapData);
    }

    if (updates.dungeonId !== undefined) {
      fields.push('dungeon_id = ?');
      values.push(updates.dungeonId);
    }
    if (updates.fogState !== undefined) {
      fields.push('fog_state = ?');
      values.push(JSON.stringify(updates.fogState));
    }
    if (updates.partyPosition !== undefined) {
      fields.push('party_position = ?');
      values.push(JSON.stringify(updates.partyPosition));
    }
    if (updates.figures !== undefined) {
      fields.push('figures = ?');
      values.push(JSON.stringify(updates.figures));
    }
    if (updates.displayMode !== undefined) {
      fields.push('display_mode = ?');
      values.push(updates.displayMode);
    }
    if (updates.currentHandout !== undefined) {
      fields.push('current_handout = ?');
      values.push(updates.currentHandout);
    }
    if (updates.currentDecision !== undefined) {
      fields.push('current_decision = ?');
      values.push(updates.currentDecision ? JSON.stringify(updates.currentDecision) : null);
    }
    if (updates.currentPuzzle !== undefined) {
      fields.push('current_puzzle = ?');
      values.push(updates.currentPuzzle ? JSON.stringify(updates.currentPuzzle) : null);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  // Add connection to session
  addConnection(sessionId: string, role: 'gm' | 'table', socket: WebSocket): void {
    let sessionConnections = connections.get(sessionId) || [];
    console.log(`[SessionManager] addConnection: role=${role}, existing connections=${sessionConnections.length}`);

    sessionConnections.push({ sessionId, role, socket });
    connections.set(sessionId, sessionConnections);
    console.log(`[SessionManager] addConnection: Added ${role} to session ${sessionId}. Total connections: ${sessionConnections.length}`);
  }

  // Remove connection from session
  removeConnection(sessionId: string, socket: WebSocket): void {
    const sessionConnections = connections.get(sessionId);
    if (sessionConnections) {
      const filtered = sessionConnections.filter(c => c.socket !== socket);
      connections.set(sessionId, filtered);
    }
  }

  // Get connections for a session
  getConnections(sessionId: string): SessionConnection[] {
    return connections.get(sessionId) || [];
  }

  // Get GM connection
  getGmConnection(sessionId: string): SessionConnection | undefined {
    return this.getConnections(sessionId).find(c => c.role === 'gm');
  }

  // Get table connections
  getTableConnections(sessionId: string): SessionConnection[] {
    return this.getConnections(sessionId).filter(c => c.role === 'table');
  }

  // Broadcast to all table connections in a session
  broadcastToTable(sessionId: string, message: unknown): void {
    const tableConns = this.getTableConnections(sessionId);
    const data = JSON.stringify(message);
    for (const conn of tableConns) {
      if (conn.socket.readyState === 1) { // OPEN
        conn.socket.send(data);
      }
    }
  }

  // Send to all connected GMs
  sendToGm(sessionId: string, message: unknown): void {
    const connections = this.getConnections(sessionId).filter(c => c.role === 'gm');
    const data = JSON.stringify(message);

    let sentCount = 0;
    for (const conn of connections) {
      if (conn.socket.readyState === 1) {
        conn.socket.send(data);
        sentCount++;
      }
    }

    if (sentCount === 0) {
      console.log(`[SessionManager] Warning: message not sent to GM (no active GM connections for session ${sessionId})`);
    }
  }

  // Broadcast to all connections in a session
  broadcast(sessionId: string, message: unknown): void {
    const conns = this.getConnections(sessionId);
    const data = JSON.stringify(message);
    for (const conn of conns) {
      if (conn.socket.readyState === 1) {
        conn.socket.send(data);
      }
    }
  }

  // Get or create the single active session (for single-session mode)
  getOrCreateSession(): { session: Session; gmToken: string; isNew: boolean } {
    // Try to get existing session first
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 1');
    const row = stmt.get() as SessionRow | undefined;

    if (row) {
      const session = this.rowToSession(row);
      // Ensure connections map exists
      if (!connections.has(session.id)) {
        connections.set(session.id, []);
      }
      if (!mapData.has(session.id)) {
        mapData.set(session.id, { mapImage: null, fogMask: null });
      }
      return { session, gmToken: row.gm_token, isNew: false };
    }

    // No session exists, create one
    const { session, gmToken } = this.createSession();
    return { session, gmToken, isNew: true };
  }

  // Get the active session (for table auto-join)
  getActiveSession(): Session | null {
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 1');
    const row = stmt.get() as SessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  // Clean up old sessions
  cleanupOldSessions(): number {
    const cutoff = Date.now() - config.sessionTimeout;
    const stmt = db.prepare('DELETE FROM sessions WHERE updated_at < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }

  // Get map data for a session
  getMapData(sessionId: string): { mapImage: string | null; fogMask: string | null } {
    return mapData.get(sessionId) || { mapImage: null, fogMask: null };
  }

  // Convert DB row to Session object
  private rowToSession(row: SessionRow): Session {
    const sessionMapData = mapData.get(row.id) || { mapImage: null, fogMask: null };
    return {
      id: row.id,
      joinCode: row.join_code,
      gmToken: row.gm_token,
      mapImage: sessionMapData.mapImage,
      fogMask: sessionMapData.fogMask,
      dungeonId: row.dungeon_id,
      fogState: JSON.parse(row.fog_state),
      partyPosition: JSON.parse(row.party_position),
      figures: row.figures ? JSON.parse(row.figures) : [],
      displayMode: row.display_mode as Session['displayMode'],
      currentHandout: row.current_handout,
      currentDecision: row.current_decision ? JSON.parse(row.current_decision) : null,
      currentPuzzle: row.current_puzzle ? JSON.parse(row.current_puzzle) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const sessionManager = new SessionManager();
