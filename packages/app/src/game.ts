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

export type Tool = 'fill' | 'cross';

/**
 * State a drag stroke paints, decided by the first cell it touches: pressing a cell that already holds
 * the tool's mark erases it, otherwise the stroke paints that mark.
 */
export function strokeTarget(current: CellState, tool: Tool): CellState {
  const mark: CellState = tool === 'fill' ? 1 : -1;
  return current === mark ? 0 : mark;
}

/** Apply a stroke's target to `cells`. Returns the same game when nothing changed. */
export function paintCells(game: GameState, cells: readonly number[], target: CellState): GameState {
  const touched = cells.filter((c) => game.cells[c] !== target);
  if (touched.length === 0) return game;
  const next = cloneGame(game);
  for (const c of touched) next.cells[c] = target;
  return next;
}

/** Per-line flags: true when the filled blocks already match that line's clues. */
export function completedLines(game: GameState): { rows: boolean[]; cols: boolean[] } {
  const rows = game.rowClues.map((clues, r) =>
    cluesEqual(computeCluesFromLine(getLineCells(game, 'row', r)), clues),
  );
  const cols = game.colClues.map((clues, c) =>
    cluesEqual(computeCluesFromLine(getLineCells(game, 'col', c)), clues),
  );
  return { rows, cols };
}

/** Cross out the unknown cells of every completed row/column. */
export function autoCrossCompleted(game: GameState): GameState {
  const { rows, cols } = completedLines(game);
  const next = cloneGame(game);
  let changed = false;
  const cross = (cell: number) => {
    if (next.cells[cell] === 0) {
      next.cells[cell] = -1;
      changed = true;
    }
  };
  rows.forEach((done, r) => {
    if (done) for (let c = 0; c < game.width; c++) cross(r * game.width + c);
  });
  cols.forEach((done, c) => {
    if (done) for (let r = 0; r < game.height; r++) cross(r * game.width + c);
  });
  return changed ? next : game;
}

/** Cells (flat indices) between two cells, inclusive, along the dominant axis (straight drag line). */
export function lineBetween(from: number, to: number, width: number): number[] {
  const r0 = Math.floor(from / width);
  const c0 = from % width;
  const r1 = Math.floor(to / width);
  const c1 = to % width;
  const out: number[] = [];
  if (Math.abs(r1 - r0) > Math.abs(c1 - c0)) {
    const step = r1 >= r0 ? 1 : -1;
    for (let r = r0; r !== r1 + step; r += step) out.push(r * width + c0);
  } else {
    const step = c1 >= c0 ? 1 : -1;
    for (let c = c0; c !== c1 + step; c += step) out.push(r0 * width + c);
  }
  return out;
}
