import { describe, expect, it } from 'vitest';
import {
  cloneGame,
  computeCluesFromLine,
  autoCrossCompleted,
  completedLines,
  createGame,
  isSolved,
  lineBetween,
  paintCells,
  setCell,
  strokeTarget,
  toggleCell,
  unknownCount,
} from './game';

describe('game', () => {
  it('creates a blank grid', () => {
    const g = createGame(3, 3, [[1], [1], [1]], [[1], [1], [1]]);
    expect(g.width).toBe(3);
    expect(g.height).toBe(3);
    expect(unknownCount(g)).toBe(9);
  });

  it('toggle cycles 0 -> 1 -> -1 -> 0', () => {
    const g = createGame(1, 1, [[0]], [[0]]);
    expect(g.cells[0]).toBe(0);
    const t1 = toggleCell(g, 0);
    expect(t1.cells[0]).toBe(1);
    const t2 = toggleCell(t1, 0);
    expect(t2.cells[0]).toBe(-1);
    const t3 = toggleCell(t2, 0);
    expect(t3.cells[0]).toBe(0);
    // original untouched (pure)
    expect(g.cells[0]).toBe(0);
  });

  it('setCell replaces without mutating', () => {
    const g = createGame(2, 2, [[0], [0]], [[0], [0]]);
    const next = setCell(g, 2, 1);
    expect(next.cells[2]).toBe(1);
    expect(g.cells[2]).toBe(0);
    expect(cloneGame(next).cells[2]).toBe(1);
  });

  it('computes line clues', () => {
    expect(computeCluesFromLine([1, 1, 0, 1, 1, 1])).toEqual([2, 3]);
    expect(computeCluesFromLine([0, 0, 0])).toEqual([0]);
    expect(computeCluesFromLine([1, 1, 1])).toEqual([3]);
  });

  it('isSolved matches clues', () => {
    const g = createGame(2, 2, [[2], [2]], [[2], [2]]);
    expect(isSolved(g)).toBe(false);
    const filled = setCell(setCell(setCell(setCell(g, 0, 1), 1, 1), 2, 1), 3, 1);
    expect(isSolved(filled)).toBe(true);
  });
});

describe('painting', () => {
  it('stroke target erases a matching mark, otherwise paints it', () => {
    expect(strokeTarget(0, 'fill')).toBe(1);
    expect(strokeTarget(1, 'fill')).toBe(0);
    expect(strokeTarget(-1, 'fill')).toBe(1);
    expect(strokeTarget(0, 'cross')).toBe(-1);
    expect(strokeTarget(-1, 'cross')).toBe(0);
    expect(strokeTarget(1, 'cross')).toBe(-1);
  });

  it('paintCells returns the same object when nothing changes', () => {
    const g = createGame(2, 2, [[0], [0]], [[0], [0]]);
    expect(paintCells(g, [0, 1], 0)).toBe(g);
    const next = paintCells(g, [0, 1], 1);
    expect(next.cells).toEqual([1, 1, 0, 0]);
    expect(g.cells).toEqual([0, 0, 0, 0]);
  });

  it('flags completed lines and auto-crosses them', () => {
    let g = createGame(3, 3, [[1], [1], [1]], [[1], [1], [1]]);
    g = paintCells(g, [0], 1);
    const done = completedLines(g);
    expect(done.rows[0]).toBe(true);
    expect(done.cols[0]).toBe(true);
    const crossed = autoCrossCompleted(g);
    expect(crossed.cells[1]).toBe(-1);
    expect(crossed.cells[3]).toBe(-1);
    expect(crossed.cells[4]).toBe(0);
    expect(autoCrossCompleted(crossed)).toBe(crossed);
  });

  it('lineBetween follows the dominant axis', () => {
    expect(lineBetween(0, 3, 5)).toEqual([0, 1, 2, 3]);
    expect(lineBetween(3, 0, 5)).toEqual([3, 2, 1, 0]);
    expect(lineBetween(0, 10, 5)).toEqual([0, 5, 10]);
    expect(lineBetween(7, 7, 5)).toEqual([7]);
  });
});
