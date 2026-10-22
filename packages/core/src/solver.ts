/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Full human-step solve, uniqueness verification, and difficulty rating.
 */
import { NonogramBoard } from './board';
import { solveLineDP } from './lineSolver';
import { NonogramStepFinder, type StepFinderOptions } from './stepFinder';
import { TECHNIQUES_META, type CellState, type DifficultyLevel, type SolveAnalysis, type TechniqueType } from './types';

export function applyStep(board: NonogramBoard, changes: readonly { cell: number; state: 1 | -1 }[]): void {
  for (const ch of changes) board.cells[ch.cell] = ch.state;
}

/** Repeatedly apply the easiest human step until stuck or solved. */
export function analyzePuzzle(start: NonogramBoard, options?: StepFinderOptions): SolveAnalysis {
  const board = start.clone();
  const finder = new NonogramStepFinder();
  const steps = [];
  const counts = Object.fromEntries(TECHNIQUES_META.map((m) => [m.type, 0])) as Record<TechniqueType, number>;
  let score = 0;
  let hardest = 1;
  for (let guard = 0; guard < board.width * board.height * 4; guard++) {
    if (board.unknownCount() === 0) break;
    const step = finder.findNextStep(board, options);
    if (!step) break;
    applyStep(board, step.changes);
    steps.push(step);
    counts[step.type]++;
    score += step.score;
    hardest = Math.max(hardest, step.level);
  }
  const solved = board.unknownCount() === 0 && board.isSolved();
  return {
    solved,
    unique: solved,
    level: hardest as DifficultyLevel,
    score,
    steps,
    counts,
    finalCells: board.cells as CellState[],
  };
}

/** Propagate all forced line cells to a fixed point. Returns false if any line is contradictory. */
function propagateLines(board: NonogramBoard): boolean {
  for (let round = 0; round < 200; round++) {
    let changed = false;
    for (let axis = 0; axis < 2; axis++) {
      const a = axis === 0 ? 'row' : 'col';
      const n = axis === 0 ? board.height : board.width;
      for (let i = 0; i < n; i++) {
        const dp = solveLineDP(board.getClues(a, i), board.getLineCells(a, i));
        if (!dp.valid) return false;
        for (const ch of dp.newChanges) {
          board.setLineCell(a, i, ch.pos, ch.state);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return true;
}

/** Fast line-only propagation, used to screen generator candidates before human-style analysis. */
export function propagateLineDeductions(start: NonogramBoard): { board: NonogramBoard; valid: boolean } {
  const board = start.clone();
  const valid = propagateLines(board);
  return { board, valid };
}

/** Count solutions up to `limit` by line-propagation plus backtracking (used by tests and verification callers). */
export function countSolutions(start: NonogramBoard, limit = 2): number {
  let found = 0;
  const search = (b: NonogramBoard): void => {
    if (found >= limit) return;
    if (!propagateLines(b)) return;
    const idx = b.cells.indexOf(0);
    if (idx < 0) {
      if (b.isSolved()) found++;
      return;
    }
    for (const v of [1, -1] as const) {
      const next = b.clone();
      next.cells[idx] = v;
      search(next);
      if (found >= limit) return;
    }
  };
  search(start.clone());
  return found;
}

export type UniquenessResult = 'unique' | 'multiple' | 'none' | 'unknown';

/**
 * Bounded uniqueness check. Returns `unknown` when the node budget runs out before
 * the search proves or disproves a unique solution. Callers that need a hard guarantee
 * should treat `unknown` as a rejection.
 */
export function checkUniqueness(start: NonogramBoard, maxNodes = 5000): UniquenessResult {
  let found = 0;
  let nodes = 0;
  let exhausted = false;
  const search = (b: NonogramBoard): void => {
    if (found >= 2) return;
    if (nodes >= maxNodes) {
      exhausted = true;
      return;
    }
    nodes++;
    if (!propagateLines(b)) return;
    const idx = b.cells.indexOf(0);
    if (idx < 0) {
      if (b.isSolved()) found++;
      return;
    }
    for (const v of [1, -1] as const) {
      const next = b.clone();
      next.cells[idx] = v;
      search(next);
      if (found >= 2) return;
    }
  };
  search(start.clone());
  if (found >= 2) return 'multiple';
  if (found === 1) return exhausted ? 'unknown' : 'unique';
  return exhausted ? 'unknown' : 'none';
}
