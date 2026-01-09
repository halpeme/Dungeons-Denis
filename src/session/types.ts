import type { WebSocket } from '@fastify/websocket';

export interface Figure {
  id: string;
  type: 'enemy' | 'player' | 'poi';
  number?: number;  // 1-5 for enemies/players
  position: {
    x: number;
    y: number;
  };
  createdAt: number;
}

export interface GridConfig {
  enabled: boolean;
  size: number;
  offsetX: number;
  offsetY: number;
  color: string;
  opacity: number;
  snapToGrid: boolean;
  unit: string;
  unitScale: number;
}

export interface Session {
  id: string;
  joinCode: string;
  gmToken: string;
  // Image-based map (stored in memory only, not persisted)
  mapImage: string | null;   // Base64 map image
  fogMask: string | null;    // Base64 fog mask
  gridConfig: GridConfig | null;  // Grid configuration
  // Legacy dungeon fields (deprecated)
  dungeonId: string | null;
  fogState: number[][];
  partyPosition: { x: number; y: number };
  figures: Figure[];
  displayMode: 'blank' | 'map' | 'handout' | 'decision' | 'puzzle';
  currentHandout: string | null;
  currentDecision: Decision | null;
  currentPuzzle: Puzzle | null;
  createdAt: number;
  updatedAt: number;
}

export interface Decision {
  id: string;
  title: string;
  options: { id: string; text: string }[];
}

export interface Puzzle {
  id: string;
  type: 'choice' | 'riddle' | 'hotspot' | 'sequence';
  data: Record<string, unknown>;
}

export interface SessionConnection {
  sessionId: string;
  role: 'gm' | 'table';
  socket: WebSocket;
}

export interface SessionRow {
  id: string;
  join_code: string;
  gm_token: string;
  dungeon_id: string | null;
  fog_state: string;
  party_position: string;
  figures: string;
  grid_config: string | null;
  display_mode: string;
  current_handout: string | null;
  current_decision: string | null;
  current_puzzle: string | null;
  created_at: number;
  updated_at: number;
}
