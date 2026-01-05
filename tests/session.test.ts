import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';

// === DATABASE MOCKING ===
// Create an in-memory database for testing
const testDb = new Database(':memory:');

// Mock the database connection module
vi.mock('../src/db/connection', () => ({
  db: testDb,
  closeDb: () => { }
}));

// Import modules AFTER mocking
import { sessionManager } from '../src/session/manager';
import { initializeSchema } from '../src/db/schema';

// Initialize schema once for the test suite
initializeSchema();

// === INTEGRATION TESTS ===
describe('Session Manager Integration', () => {
  beforeEach(() => {
    // Clear sessions table before each test
    testDb.exec('DELETE FROM sessions');
    // Ideally sessionManager would have a 'reset' for testing, but unique IDs per test should suffice.
  });

  afterAll(() => {
    testDb.close();
  });

  it('should create a new session with valid defaults', () => {
    const { session, gmToken } = sessionManager.createSession();

    expect(session.id).toBeDefined();
    expect(session.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(gmToken).toBeDefined();
    expect(session.gmToken).toBe(gmToken);
    expect(session.fogState).toEqual([]);
    expect(session.partyPosition).toEqual({ x: 0, y: 0 });

    // Verify persistence
    const saved = sessionManager.getSession(session.id);
    expect(saved).toBeDefined();
    expect(saved?.id).toBe(session.id);
  });

  it('should retrieve a session by join code', () => {
    const { session } = sessionManager.createSession();
    const retrieved = sessionManager.getSessionByCode(session.joinCode);
    expect(retrieved?.id).toBe(session.id);
  });

  it('should validate GM tokens', () => {
    const { session, gmToken } = sessionManager.createSession();
    expect(sessionManager.validateGmToken(session.id, gmToken)).toBe(true);
    expect(sessionManager.validateGmToken(session.id, 'wrong-token')).toBe(false);
  });

  it('should update session fields', () => {
    const { session } = sessionManager.createSession();
    const updates = {
      displayMode: 'map' as const,
      currentHandout: 'http://example.com/handout.jpg'
    };

    sessionManager.updateSession(session.id, updates);

    const updated = sessionManager.getSession(session.id);
    expect(updated?.displayMode).toBe('map');
    expect(updated?.currentHandout).toBe('http://example.com/handout.jpg');
  });

  it('should handle in-memory map data updates', () => {
    const { session } = sessionManager.createSession();

    // Map data is NOT stored in DB, but in-memory
    sessionManager.updateSession(session.id, {
      mapImage: 'base64-data',
      fogMask: 'fog-data'
    });

    const mapData = sessionManager.getMapData(session.id);
    expect(mapData.mapImage).toBe('base64-data');
    expect(mapData.fogMask).toBe('fog-data');
  });
});

// === ORIGINAL UNIT TESTS ===
describe('Puzzle Validation', () => {
  describe('Riddle answers', () => {
    it('should match case-insensitive', () => {
      const answer = 'map';
      const userAnswer = 'MAP';
      expect(answer.toLowerCase()).toBe(userAnswer.toLowerCase());
    });

    it('should trim whitespace', () => {
      const answer = 'map';
      const userAnswer = '  map  ';
      expect(answer).toBe(userAnswer.trim());
    });

    it('should accept multiple valid answers', () => {
      const validAnswers = ['map', 'a map', 'the map'];
      const userAnswer = 'a map';
      expect(validAnswers.includes(userAnswer)).toBe(true);
    });
  });

  describe('Sequence validation', () => {
    it('should validate correct order', () => {
      const correctOrder = [0, 1, 2, 3];
      const userOrder = [0, 1, 2, 3];
      expect(JSON.stringify(correctOrder)).toBe(JSON.stringify(userOrder));
    });

    it('should reject incorrect order', () => {
      const correctOrder = [0, 1, 2, 3];
      const userOrder = [3, 2, 1, 0];
      expect(JSON.stringify(correctOrder)).not.toBe(JSON.stringify(userOrder));
    });
  });

  describe('Multiple choice', () => {
    it('should validate correct answer index', () => {
      const correctAnswer = 1;
      const userAnswer = 1;
      expect(correctAnswer).toBe(userAnswer);
    });
  });
});

describe('Fog of War Logic', () => {
  it('should track revealed cells', () => {
    const fogState: number[][] = [];
    fogState.push([5, 5]);
    const revealedSet = new Set(fogState.map(c => `${c[0]},${c[1]}`));
    expect(revealedSet.has('5,5')).toBe(true);
    expect(revealedSet.has('0,0')).toBe(false);
  });

  it('should not duplicate revealed cells', () => {
    const fogState: number[][] = [[5, 5]];
    const existingSet = new Set(fogState.map(c => `${c[0]},${c[1]}`));
    const newCell = [5, 5];
    const isNew = !existingSet.has(`${newCell[0]},${newCell[1]}`);
    expect(isNew).toBe(false);
  });
});
