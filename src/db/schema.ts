import { db } from './connection.js';

export function initializeSchema() {
  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      join_code TEXT UNIQUE NOT NULL,
      gm_token TEXT NOT NULL,
      dungeon_id TEXT,
      fog_state TEXT DEFAULT '[]',
      party_position TEXT DEFAULT '{"x": 0, "y": 0}',
      display_mode TEXT DEFAULT 'blank',
      current_handout TEXT,
      current_decision TEXT,
      current_puzzle TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Dungeons table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dungeons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grid_width INTEGER NOT NULL DEFAULT 20,
      grid_height INTEGER NOT NULL DEFAULT 20,
      cells TEXT NOT NULL DEFAULT '[]',
      markers TEXT DEFAULT '[]',
      background_image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Add figures column (migration for existing databases)
  try {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN figures TEXT DEFAULT '[]';
    `);
  } catch (err) {
    // Column already exists, ignore
  }

  // Add grid_config column (migration for existing databases)
  try {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN grid_config TEXT DEFAULT NULL;
    `);
  } catch (err) {
    // Column already exists, ignore
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_join_code ON sessions(join_code);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
  `);

  console.log('Database schema initialized');
}
