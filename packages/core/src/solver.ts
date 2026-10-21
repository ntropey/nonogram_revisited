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

/** Count solutions up to `limit` by line-propagation plus backtracking (used for uniqueness of generated puzzles). */
export function countSolutions(start: NonogramBoard, limit = 2): number {
  let found = 0;
  const search = (b: NonogramBoard): void => {
    if (found >= limit) return;
    // propagate to a fixed point
    for (let round = 0; round < 200; round++) {
      let changed = false;
      for (let axis = 0; axis < 2; axis++) {
        const a = axis === 0 ? 'row' : 'col';
        const n = axis === 0 ? b.height : b.width;
        for (let i = 0; i < n; i++) {
          const dp = solveLineDP(b.getClues(a, i), b.getLineCells(a, i));
          if (!dp.valid) return;
          for (const ch of dp.newChanges) {
            b.setLineCell(a, i, ch.pos, ch.state);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
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
