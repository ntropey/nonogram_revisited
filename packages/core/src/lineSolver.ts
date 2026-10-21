/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Exact O(m * L) dynamic-programming line solver, block range analyzer, and completed-clue detector.
 */
import { cluesEqual, computeCluesFromLine, normalizeClues } from './board';
import type { CellState } from './types';

export interface LineDPResult {
  /** True if at least one valid placement of `clues` exists for `cells` */
  valid: boolean;
  /** Non-zero block lengths (`[]` if the line clue is `[0]`) */
  blocks: number[];
  /** For each position `0..L-1`, whether it is filled in at least one valid configuration */
  canBeFilled: boolean[];
  /** For each position `0..L-1`, whether it is empty in at least one valid configuration */
  canBeCrossed: boolean[];
  /** For each position `0..L-1`, `1` if forced filled, `-1` if forced crossed, `0` if ambiguous */
  forced: CellState[];
  /** Unknown positions (`cells[pos] === 0`) that are newly determined (`1` or `-1`) */
  newChanges: { pos: number; state: 1 | -1 }[];
  /** Earliest valid start index for each block `0..m-1` */
  minStart: number[];
  /** Latest valid start index for each block `0..m-1` */
  maxStart: number[];
  /** For each position `0..L-1`, list of block indices `0..m-1` that can cover `pos` */
  coveringBlocks: number[][];
}

/**
 * Solve a single Nonogram line of length `L` with `clues` and current `cells` in O(m * L) time.
 * Finds every cell that is forced to be filled (`1`) or crossed out (`-1`) across all valid placements,
 * plus exact `[minStart[b], maxStart[b]]` ranges for each block `b`.
 */
export function solveLineDP(clues: readonly number[], cells: readonly CellState[]): LineDPResult {
  const L = cells.length;
  const norm = normalizeClues(clues);
  const blocks = norm[0] === 0 ? [] : norm;
  const m = blocks.length;

  const canBeFilled = new Array<boolean>(L).fill(false);
  const canBeCrossed = new Array<boolean>(L).fill(false);
  const forced = new Array<CellState>(L).fill(0);
  const coveringBlocks: number[][] = Array.from({ length: L }, () => []);

  // Special case: Zero Line (`[0]`)
  if (m === 0) {
    const valid = cells.every((c) => c !== 1);
    const newChanges: { pos: number; state: 1 | -1 }[] = [];
    if (valid) {
      for (let i = 0; i < L; i++) {
        canBeCrossed[i] = true;
        forced[i] = -1;
        if (cells[i] === 0) newChanges.push({ pos: i, state: -1 });
      }
    }
    return {
      valid,
      blocks: [],
      canBeFilled,
      canBeCrossed,
      forced,
      newChanges,
      minStart: [],
      maxStart: [],
      coveringBlocks,
    };
  }

  // Prefix count of crosses (`-1`) so we can test in O(1) whether a span `[s, s + k - 1]` has no `-1`
  const crossPref = new Int32Array(L + 1);
  for (let i = 0; i < L; i++) {
    crossPref[i + 1] = crossPref[i] + (cells[i] === -1 ? 1 : 0);
  }
  const canFitRun = (s: number, k: number): boolean => s >= 0 && s + k <= L && crossPref[s + k] === crossPref[s];

  // dpPref[b][i]: can the first `b` blocks (0..b-1) be validly placed within cells `0..i-1`?
  const dpPref: boolean[][] = Array.from({ length: m + 1 }, () => new Array<boolean>(L + 1).fill(false));
  dpPref[0][0] = true;
  for (let i = 1; i <= L; i++) {
    dpPref[0][i] = dpPref[0][i - 1] && cells[i - 1] !== 1;
  }

  for (let b = 1; b <= m; b++) {
    const k = blocks[b - 1];
    for (let i = k; i <= L; i++) {
      // Option 1: cell `i - 1` is empty
      if (cells[i - 1] !== 1 && dpPref[b][i - 1]) {
        dpPref[b][i] = true;
        continue;
      }
      // Option 2: block `b - 1` ends at `i - 1` (starts at `s = i - k`)
      const s = i - k;
      if (canFitRun(s, k)) {
        if (b === 1) {
          if (dpPref[0][s]) dpPref[b][i] = true;
        } else if (s >= 1 && cells[s - 1] !== 1 && dpPref[b - 1][s - 1]) {
          dpPref[b][i] = true;
        }
      }
    }
  }

  if (!dpPref[m][L]) {
    return {
      valid: false,
      blocks,
      canBeFilled,
      canBeCrossed,
      forced,
      newChanges: [],
      minStart: new Array<number>(m).fill(L),
      maxStart: new Array<number>(m).fill(-1),
      coveringBlocks,
    };
  }

  // dpSuff[b][i]: can blocks `b..m-1` be validly placed within cells `i..L-1`?
  const dpSuff: boolean[][] = Array.from({ length: m + 1 }, () => new Array<boolean>(L + 1).fill(false));
  dpSuff[m][L] = true;
  for (let i = L - 1; i >= 0; i--) {
    dpSuff[m][i] = dpSuff[m][i + 1] && cells[i] !== 1;
  }

  for (let b = m - 1; b >= 0; b--) {
    const k = blocks[b];
    for (let i = L - k; i >= 0; i--) {
      // Option 1: cell `i` is empty
      if (cells[i] !== 1 && dpSuff[b][i + 1]) {
        dpSuff[b][i] = true;
      }
      // Option 2: block `b` starts at `i` (ends at `i + k - 1`)
      if (!dpSuff[b][i] && canFitRun(i, k)) {
        if (b === m - 1) {
          if (dpSuff[m][i + k]) dpSuff[b][i] = true;
        } else if (i + k < L && cells[i + k] !== 1 && dpSuff[b + 1][i + k + 1]) {
          dpSuff[b][i] = true;
        }
      }
    }
  }

  const minStart = new Array<number>(m).fill(L);
  const maxStart = new Array<number>(m).fill(-1);

  for (let b = 0; b < m; b++) {
    const k = blocks[b];
    for (let s = 0; s <= L - k; s++) {
      if (!canFitRun(s, k)) continue;
      const leftOk = b === 0 ? dpPref[0][s] : s >= 1 && cells[s - 1] !== 1 && dpPref[b][s - 1];
      if (!leftOk) continue;
      const rightOk = b === m - 1 ? dpSuff[m][s + k] : s + k < L && cells[s + k] !== 1 && dpSuff[b + 1][s + k + 1];
      if (!rightOk) continue;

      if (s < minStart[b]) minStart[b] = s;
      if (s > maxStart[b]) maxStart[b] = s;
      for (let p = s; p < s + k; p++) {
        canBeFilled[p] = true;
        const list = coveringBlocks[p];
        if (list[list.length - 1] !== b) list.push(b);
      }
    }
  }

  for (let i = 0; i < L; i++) {
    if (cells[i] === 1) continue;
    for (let b = 0; b <= m; b++) {
      if (dpPref[b][i] && dpSuff[b][i + 1]) {
        canBeCrossed[i] = true;
        break;
      }
    }
  }

  const newChanges: { pos: number; state: 1 | -1 }[] = [];
  for (let i = 0; i < L; i++) {
    if (canBeFilled[i] && !canBeCrossed[i]) {
      forced[i] = 1;
      if (cells[i] === 0) newChanges.push({ pos: i, state: 1 });
    } else if (canBeCrossed[i] && !canBeFilled[i]) {
      forced[i] = -1;
      if (cells[i] === 0) newChanges.push({ pos: i, state: -1 });
    }
  }

  return {
    valid: true,
    blocks,
    canBeFilled,
    canBeCrossed,
    forced,
    newChanges,
    minStart,
    maxStart,
    coveringBlocks,
  };
}

/**
 * Compute which clues in a line are already completed by the player's current markings (`cells`),
 * used to automatically dim completed clues in the board headers.
 */
export function getCompletedClues(clues: readonly number[], cells: readonly CellState[]): boolean[] {
  const norm = normalizeClues(clues);
  if (norm[0] === 0) {
    // A [0] clue is completed when no cell is filled and at least all cells are crossed (or the line is empty with crosses)
    return [cells.every((c) => c === -1)];
  }
  const m = norm.length;
  const done = new Array<boolean>(m).fill(false);

  // If the currently placed `1` runs already match the line's clues and the line is valid, all clues are complete
  const dp = solveLineDP(norm, cells);
  if (!dp.valid) return done;

  if (cluesEqual(computeCluesFromLine(cells), norm)) {
    return done.fill(true);
  }

  // 1. Any block `b` whose valid start is uniquely pinned by `solveLineDP` and whose cells are all `1` is complete
  for (let b = 0; b < m; b++) {
    if (dp.minStart[b] === dp.maxStart[b] && dp.minStart[b] >= 0) {
      const s = dp.minStart[b];
      const k = norm[b];
      let allFilled = true;
      for (let p = s; p < s + k; p++) {
        if (cells[p] !== 1) {
          allFilled = false;
          break;
        }
      }
      if (allFilled) done[b] = true;
    }
  }

  // 2. Scan from the start of the line while cells are explicitly marked (`1` or `-1`, no `0`s)
  let bLeft = 0;
  let i = 0;
  while (i < cells.length && bLeft < m) {
    while (i < cells.length && cells[i] === -1) i++;
    if (i >= cells.length || cells[i] !== 1) break;
    const start = i;
    while (i < cells.length && cells[i] === 1) i++;
    const len = i - start;
    const boundedRight = i === cells.length || cells[i] === -1;
    if (len === norm[bLeft] && boundedRight) {
      done[bLeft] = true;
      bLeft++;
    } else {
      break;
    }
  }

  // 3. Scan from the end of the line while cells are explicitly marked (`1` or `-1`, no `0`s)
  let bRight = m - 1;
  let j = cells.length - 1;
  while (j >= 0 && bRight >= 0) {
    while (j >= 0 && cells[j] === -1) j--;
    if (j < 0 || cells[j] !== 1) break;
    const end = j;
    while (j >= 0 && cells[j] === 1) j--;
    const len = end - j;
    const boundedLeft = j < 0 || cells[j] === -1;
    if (len === norm[bRight] && boundedLeft) {
      done[bRight] = true;
      bRight--;
    } else {
      break;
    }
  }

  return done;
}
