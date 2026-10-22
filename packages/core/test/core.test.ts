import { describe, expect, it } from 'vitest';
import {
  NonogramBoard,
  analyzePuzzle,
  checkUniqueness,
  countSolutions,
  dailyPuzzle,
  deserializePuzzle,
  generatePuzzle,
  getCompletedClues,
  isInteresting,
  propagateLineDeductions,
  serializePuzzle,
  solveLineDP,
} from '../src/index';

describe('solveLineDP', () => {
  it('fills overlap', () => {
    const r = solveLineDP([4], [0, 0, 0, 0, 0, 0]);
    expect(r.forced).toEqual([0, 0, 1, 1, 0, 0]);
  });
  it('crosses a zero line', () => {
    expect(solveLineDP([0], [0, 0, 0]).forced).toEqual([-1, -1, -1]);
  });
  it('detects invalid lines', () => {
    expect(solveLineDP([3], [1, -1, 1, 0, 0]).valid).toBe(false);
  });
  it('fills a full line', () => {
    expect(solveLineDP([2, 1], [0, 0, 0, 0]).forced).toEqual([1, 1, -1, 1]);
  });
});

describe('board', () => {
  const bits = [1, 0, 1, 0, 1, 0, 1, 1, 1] as (0 | 1)[];
  it('derives clues and round-trips', () => {
    const b = NonogramBoard.fromBitmap(3, 3, bits);
    expect(b.rowClues).toEqual([[1, 1], [1], [3]]);
    const back = deserializePuzzle(serializePuzzle(b));
    expect(back?.colClues).toEqual(b.colClues);
  });
  it('dims completed clues', () => {
    expect(getCompletedClues([1, 1], [1, -1, 1])).toEqual([true, true]);
  });
});

describe('solver and generator', () => {
  it('solves a simple puzzle with human steps', () => {
    const b = NonogramBoard.fromBitmap(5, 5, [
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 1, 0, 1,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
    ]);
    const a = analyzePuzzle(b);
    expect(a.solved).toBe(true);
    expect(countSolutions(b, 2)).toBe(1);
  });
  it('is deterministic and unique', () => {
    const a = generatePuzzle({ size: 5, seed: 42 });
    const b = generatePuzzle({ size: 5, seed: 42 });
    expect(serializePuzzle(a)).toBe(serializePuzzle(b));
    expect(countSolutions(a, 2)).toBe(1);
    expect(serializePuzzle(dailyPuzzle('2026-01-01', 5))).toBe(serializePuzzle(dailyPuzzle('2026-01-01', 5)));
  });
  it('propagates forced line cells and detects a unique solution', () => {
    const b = NonogramBoard.fromBitmap(5, 5, [
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 1, 0, 1,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
    ]);
    const propagated = propagateLineDeductions(b);
    expect(propagated.valid).toBe(true);
    expect(checkUniqueness(b, 1000)).toBe('unique');
  });
  it('reports multiple solutions for an ambiguous board', () => {
    const b = NonogramBoard.fromBitmap(2, 2, [1, 0, 0, 1]);
    expect(countSolutions(b, 2)).toBe(2);
    expect(checkUniqueness(b, 1000)).toBe('multiple');
    expect(checkUniqueness(b, 0)).toBe('unknown');
  });
});

describe('generator quality', () => {
  it('is deterministic for a seed', () => {
    const a = generatePuzzle({ size: 7, seed: 42 });
    const b = generatePuzzle({ size: 7, seed: 42 });
    expect(a.toDefinition().solution).toEqual(b.toDefinition().solution);
  });

  it('never returns a dull board and always a unique one', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const size = 5 + (seed % 4);
      const board = generatePuzzle({ size, seed });
      const solution = board.toDefinition().solution!;
      expect(isInteresting(solution, size)).toBe(true);
      expect(countSolutions(board.clone(), 2)).toBe(1);
    }
  });

  it('flags trivial bitmaps', () => {
    expect(isInteresting(new Array(25).fill(1), 5)).toBe(false);
    expect(isInteresting(new Array(25).fill(0), 5)).toBe(false);
    expect(isInteresting([1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1], 5)).toBe(true);
  });

  it('returns and carries a rated Extreme puzzle', () => {
    const board = generatePuzzle({ size: 10, level: 5, seed: 1, maxAttempts: 200 });
    expect(board.level).toBe(5);
    expect(board.score).toBeGreaterThan(0);
    expect(board.toDefinition().level).toBe(5);
    expect(board.toDefinition().score).toBe(board.score);
    expect(countSolutions(board.clone(), 2)).toBe(1);
    expect(analyzePuzzle(board).solved).toBe(true);
  });
});
