import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

// Ensure db directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: DatabaseType = new Database(config.dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

export function closeDb() {
  db.close();
}
