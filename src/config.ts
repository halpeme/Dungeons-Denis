export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH || './db/dungeon-bridge.db',
  sessionCodeLength: 6,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  tokenLength: 32,
};
