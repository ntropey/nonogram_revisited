/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Pure game state: moves, win-checking, and clue derivation. No DOM, no storage.
 */
import type { CellState } from '@nonogram/core';

export interface GameState {
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  cells: CellState[];
  solution?: (0 | 1)[];
  title: string;
}

export function createGame(
  width: number,
  height: number,
  rowClues: number[][],
  colClues: number[][],
  title = '',
): GameState {
  return {
    width,
    height,
    rowClues,
    colClues,
    cells: new Array<CellState>(width * height).fill(0),
    title,
  };
}

export function cloneGame(game: GameState): GameState {
  return {
    ...game,
    cells: [...game.cells],
    solution: game.solution ? [...game.solution] : undefined,
  };
}

export function setCell(game: GameState, cell: number, state: CellState): GameState {
  const next = cloneGame(game);
  next.cells[cell] = state;
  return next;
}

export function toggleCell(game: GameState, cell: number): GameState {
  const next = cloneGame(game);
  const current = next.cells[cell];
  next.cells[cell] = current === 0 ? 1 : current === 1 ? -1 : 0;
  return next;
}

export function unknownCount(game: GameState): number {
  let count = 0;
  for (const c of game.cells) {
    if (c === 0) count++;
  }
  return count;
}

/** True when every row/column's placed filled blocks match the clues. */
export function isSolved(game: GameState): boolean {
  for (let r = 0; r < game.height; r++) {
    if (!cluesEqual(computeCluesFromLine(getLineCells(game, 'row', r)), game.rowClues[r])) {
      return false;
    }
  }
  for (let c = 0; c < game.width; c++) {
    if (!cluesEqual(computeCluesFromLine(getLineCells(game, 'col', c)), game.colClues[c])) {
      return false;
    }
  }
  return true;
}

export function computeCluesFromLine(cells: readonly number[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 1) {
      run++;
    } else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues.length > 0 ? clues : [0];
}

export function cluesEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function getLineCells(game: GameState, axis: 'row' | 'col', index: number): CellState[] {
  if (axis === 'row') {
    return game.cells.slice(index * game.width, index * game.width + game.width);
  }
  const out: CellState[] = [];
  for (let r = 0; r < game.height; r++) out.push(game.cells[r * game.width + index]);
  return out;
}
