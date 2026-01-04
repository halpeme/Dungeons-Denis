// WebSocket message types

export interface WSMessage {
  type: string;
  payload?: unknown;
}

// Session events
export interface SessionCreateMessage extends WSMessage {
  type: 'session:create';
}

export interface SessionCreatedMessage extends WSMessage {
  type: 'session:created';
  payload: {
    sessionId: string;
    joinCode: string;
    gmToken: string;
  };
}

export interface SessionJoinMessage extends WSMessage {
  type: 'session:join';
  payload: {
    code: string;
  };
}

export interface SessionJoinedMessage extends WSMessage {
  type: 'session:joined';
  payload: {
    sessionId: string;
  };
}

export interface SessionReconnectMessage extends WSMessage {
  type: 'session:reconnect';
  payload: {
    sessionId: string;
    gmToken: string;
  };
}

// Map events
export interface MapLoadMessage extends WSMessage {
  type: 'map:load';
  payload: {
    dungeonId: string;
  };
}

export interface MapStateMessage extends WSMessage {
  type: 'map:state';
  payload: {
    dungeon: unknown;
    fogState: number[][];
    partyPosition: { x: number; y: number };
  };
}

export interface MapRevealMessage extends WSMessage {
  type: 'map:reveal';
  payload: {
    cells: number[][]; // [[x, y], [x, y], ...]
  };
}

export interface MapUpdateMessage extends WSMessage {
  type: 'map:update';
  payload: {
    fogState: number[][];
    revealedCells?: number[][];
  };
}

export interface MapMovePartyMessage extends WSMessage {
  type: 'map:moveParty';
  payload: {
    x: number;
    y: number;
  };
}

// Handout events
export interface HandoutPushMessage extends WSMessage {
  type: 'handout:push';
  payload: {
    imageUrl: string;
  };
}

export interface HandoutDisplayMessage extends WSMessage {
  type: 'handout:display';
  payload: {
    imageUrl: string;
  };
}

export interface HandoutClearMessage extends WSMessage {
  type: 'handout:clear';
}

// Decision events
export interface DecisionPushMessage extends WSMessage {
  type: 'decision:push';
  payload: {
    id: string;
    title: string;
    options: { id: string; text: string }[];
  };
}

export interface DecisionDisplayMessage extends WSMessage {
  type: 'decision:display';
  payload: {
    id: string;
    title: string;
    options: { id: string; text: string }[];
  };
}

export interface DecisionClearMessage extends WSMessage {
  type: 'decision:clear';
}

// Puzzle events
export interface PuzzlePushMessage extends WSMessage {
  type: 'puzzle:push';
  payload: {
    id: string;
    type: 'choice' | 'riddle' | 'hotspot' | 'sequence';
    data: unknown;
  };
}

export interface PuzzleDisplayMessage extends WSMessage {
  type: 'puzzle:display';
  payload: {
    id: string;
    type: 'choice' | 'riddle' | 'hotspot' | 'sequence';
    data: unknown;
  };
}

export interface PuzzleSubmitMessage extends WSMessage {
  type: 'puzzle:submit';
  payload: {
    puzzleId: string;
    answer: unknown;
  };
}

export interface PuzzleResultMessage extends WSMessage {
  type: 'puzzle:result';
  payload: {
    puzzleId: string;
    correct: boolean;
    message?: string;
  };
}

// Display mode
export interface DisplayModeMessage extends WSMessage {
  type: 'display:mode';
  payload: {
    mode: 'blank' | 'map' | 'handout' | 'decision' | 'puzzle';
  };
}

// Error
export interface ErrorMessage extends WSMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
  };
}

// Table connected notification (to GM)
export interface TableConnectedMessage extends WSMessage {
  type: 'table:connected';
}

export interface TableDisconnectedMessage extends WSMessage {
  type: 'table:disconnected';
}
