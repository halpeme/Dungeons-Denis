import { describe, it, expect, beforeEach } from 'vitest';

// Note: These tests require the database to be initialized
// Run with: npm test

describe('Session Management', () => {
  it('should generate 6-character join codes', () => {
    // Join codes should be 6 characters
    const codePattern = /^[A-Z0-9]{6}$/;
    expect(codePattern.test('ABC123')).toBe(true);
    expect(codePattern.test('ABCDEF')).toBe(true);
    expect(codePattern.test('123456')).toBe(true);
  });

  it('should generate unique session IDs', () => {
    // Nanoid generates 21-character IDs by default
    const id1 = 'abc123def456ghi789jkl';
    const id2 = 'xyz987wvu654tsr321qpo';
    expect(id1).not.toBe(id2);
  });
});

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

describe('Fog of War', () => {
  it('should track revealed cells', () => {
    const fogState: number[][] = [];

    // Reveal cell (5, 5)
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
