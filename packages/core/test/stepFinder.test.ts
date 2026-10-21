import { describe, expect, it } from 'vitest';
import {
  NonogramBoard,
  analyzePuzzle,
  countSolutions,
  findLineSteps,
  NonogramStepFinder,
} from '../src/index';

function board(width: number, height: number, rowClues: number[][], colClues: number[][]): NonogramBoard {
  return new NonogramBoard({ width, height, rowClues, colClues });
}

describe('findLineSteps - FULL_ZERO_LINE', () => {
  it('crosses out a zero line', () => {
    const b = board(5, 1, [[0]], [[0], [0], [0], [0], [0]]);
    const steps = findLineSteps(b, 'row', 0);
    expect(steps.length).toBe(1);
    expect(steps[0].type).toBe('FULL_ZERO_LINE');
    expect(steps[0].changes.map((c) => c.state).every((s) => s === -1)).toBe(true);
    expect(steps[0].changes.length).toBe(5);
  });

  it('fills a line whose clues exactly span it', () => {
    const b = board(4, 1, [[2, 1]], [[0], [0], [0], [0]]);
    const steps = findLineSteps(b, 'row', 0);
    expect(steps.length).toBe(1);
    expect(steps[0].type).toBe('FULL_ZERO_LINE');
    expect(steps[0].changes.map((c) => c.state)).toEqual([1, 1, -1, 1]);
  });
});

describe('findLineSteps - SIMPLE_BOXES', () => {
  it('fills the overlap of a clue packed at both extremes', () => {
    const b = board(6, 1, [[4]], [[0], [0], [0], [0], [0], [0]]);
    const steps = findLineSteps(b, 'row', 0);
    expect(steps.length).toBe(1);
    expect(steps[0].type).toBe('SIMPLE_BOXES');
    expect(steps[0].changes.map((c) => c.state).every((s) => s === 1)).toBe(true);
    expect(steps[0].changes.map((c) => c.cell).sort()).toEqual([2, 3]);
  });
});

describe('NonogramStepFinder.findNextStep', () => {
  it('returns the lowest-difficulty enabled step (column FULL_ZERO_LINE beats row SIMPLE_BOXES)', () => {
    // Single-cell columns with clue [1] are full-span lines -> FULL_ZERO_LINE (score 10)
    // which is easier than the row's SIMPLE_BOXES (score 20), so easiest wins.
    const b = board(6, 1, [[4]], [[1], [1], [1], [1], [1], [1]]);
    const finder = new NonogramStepFinder();
    const step = finder.findNextStep(b);
    expect(step).not.toBeNull();
    expect(step!.type).toBe('FULL_ZERO_LINE');
    expect(step!.score).toBe(10);
  });

  it('returns null on a fully solved board', () => {
    const b = new NonogramBoard({
      width: 2,
      height: 2,
      rowClues: [[2], [2]],
      colClues: [[2], [2]],
      cells: [1, 1, 1, 1],
    });
    expect(b.unknownCount()).toBe(0);
    const finder = new NonogramStepFinder();
    expect(finder.findNextStep(b)).toBeNull();
  });

  it('respects disabledTechniques', () => {
    // Every line here is a zero line -> all line steps are FULL_ZERO_LINE; disable it plus the
    // fallback techniques (Edge Lookahead / Contradiction) so nothing remains.
    const b = board(5, 1, [[0]], [[0], [0], [0], [0], [0]]);
    const finder = new NonogramStepFinder();
    const step = finder.findNextStep(b, {
      disabledTechniques: new Set(['FULL_ZERO_LINE', 'EDGE_LOOKAHEAD', 'CONTRADICTION']),
    });
    expect(step).toBeNull();
  });
});

describe('analyzePuzzle integration', () => {
  it('solves a 5x5 puzzle with human steps only', () => {
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

  it('solves a 3x3 puzzle with human steps only', () => {
    const b = NonogramBoard.fromBitmap(3, 3, [1, 0, 1, 0, 1, 0, 1, 0, 1] as (0 | 1)[]);
    const a = analyzePuzzle(b);
    expect(a.solved).toBe(true);
    expect(countSolutions(b, 2)).toBe(1);
  });
});
