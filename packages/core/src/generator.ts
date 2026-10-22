/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Seeded generator (mulberry32) with date-seeded Daily Puzzles. Deterministic by seed;
 * a caller may add a wall-clock budget for hard-level searches.
 */
import { NonogramBoard } from './board';
import { analyzePuzzle, applyStep, propagateLineDeductions } from './solver';
import { NonogramStepFinder, findContradictionSteps, findEdgeLookaheadSteps } from './stepFinder';
import type { DifficultyLevel, SolutionStep, TechniqueType } from './types';

/** Techniques that are not part of ordinary line propagation. */
const HARD_TECHNIQUES = new Set<TechniqueType>(['EDGE_LOOKAHEAD', 'CONTRADICTION']);
const NO_CONTRADICTION = new Set<TechniqueType>(['CONTRADICTION']);

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Random bitmap with fill density `density`, lightly smoothed so it looks pixel-art-like. */
export function randomBitmap(size: number, rand: () => number, density: number): (0 | 1)[] {
  const bits: (0 | 1)[] = [];
  for (let i = 0; i < size * size; i++) bits.push(rand() < density ? 1 : 0);
  const out = [...bits];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let n = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) n += bits[rr * size + cc];
      }
      if (n >= 3) out[r * size + c] = 1;
      else if (n === 0) out[r * size + c] = 0;
    }
  }
  return out;
}

/**
 * Reject boards that are valid but dull: almost empty or full, or with many lines that are
 * entirely blank or entirely filled (those solve themselves and give no puzzle).
 */
export function isInteresting(bits: readonly (0 | 1)[], size: number): boolean {
  const filled = bits.reduce<number>((a, b) => a + b, 0);
  const density = filled / bits.length;
  if (density < 0.3 || density > 0.75) return false;
  let trivial = 0;
  for (let i = 0; i < size; i++) {
    let rowSum = 0;
    let colSum = 0;
    for (let j = 0; j < size; j++) {
      rowSum += bits[i * size + j];
      colSum += bits[j * size + i];
    }
    if (rowSum === 0 || rowSum === size) trivial++;
    if (colSum === 0 || colSum === size) trivial++;
  }
  return trivial <= Math.floor(size * 0.4);
}

export interface GenerateOptions {
  size: number;
  level?: DifficultyLevel;
  seed: number;
  maxAttempts?: number;
  /** Optional wall-clock budget for hard-level search. No limit by default. */
  maxTimeMs?: number;
}

/**
 * Dense, orderly boards are usually easy. Sparse, irregular boards are more likely to
 * need edge logic or contradiction, so aim the sampler at the requested band.
 */
function densityFor(level: DifficultyLevel | undefined, rand: () => number): number {
  if (level === undefined) return 0.45 + rand() * 0.2;
  if (level >= 4) return 0.35 + rand() * 0.07;
  if (level === 3) return 0.4 + rand() * 0.08;
  return 0.5 + rand() * 0.15;
}

/**
 * Exact level filtering is rare for the easiest levels on large boards. Stop after a
 * small exact search and return the nearest rated board instead of scanning for minutes.
 */
function attemptLimit(target: DifficultyLevel | undefined, requested: number): number {
  if (target === 1) return Math.min(requested, 24);
  if (target === 2) return Math.min(requested, 48);
  if (target === 3) return Math.min(requested, 96);
  if (target === 4) return Math.min(requested, 400);
  if (target === 5) return Math.min(requested, 1200);
  return requested;
}

/**
 * Rate an already line-solvable board, stopping as soon as a step exceeds `maxLevel`.
 * This is the cheap path for targets 1-3 and avoids a full uniqueness/contradiction scan.
 */
function rateLineOnly(start: NonogramBoard, maxLevel: DifficultyLevel): { level: DifficultyLevel; score: number } | null {
  const board = start.clone();
  const finder = new NonogramStepFinder();
  let hardest: DifficultyLevel = 1;
  let score = 0;
  for (let guard = 0; guard < board.width * board.height * 4; guard++) {
    if (board.unknownCount() === 0) return board.isSolved() ? { level: hardest, score } : null;
    const step = finder.findNextStep(board, { disabledTechniques: HARD_TECHNIQUES });
    if (!step || step.level > maxLevel) return null;
    applyStep(board, step.changes);
    score += step.score;
    hardest = Math.max(hardest, step.level) as DifficultyLevel;
  }
  return null;
}

/** Apply a set of sound deductions, rejecting conflicting assignments. */
function applySteps(board: NonogramBoard, steps: readonly SolutionStep[]): boolean {
  for (const step of steps) {
    for (const ch of step.changes) {
      const current = board.cells[ch.cell];
      if (current !== 0 && current !== ch.state) return false;
      if (current === 0) board.cells[ch.cell] = ch.state;
    }
  }
  return true;
}

/**
 * Rate a hard puzzle after edge-only analysis. The short path is cheap enough for small
 * boards; larger boards use a step-limited path so one pathological candidate cannot run
 * for minutes.
 */
function rateHard(start: NonogramBoard, deadline: number): { level: DifficultyLevel; score: number } | null {
  if (start.width <= 15) return rateHardByAnalysis(start, deadline);
  return rateHardBounded(start, deadline);
}

function rateHardByAnalysis(start: NonogramBoard, deadline: number): { level: DifficultyLevel; score: number } | null {
  const edgeOnly = analyzePuzzle(start, { disabledTechniques: NO_CONTRADICTION });
  if (edgeOnly.solved) return { level: edgeOnly.level, score: edgeOnly.score };

  let board = new NonogramBoard({ ...start.toDefinition(), cells: edgeOnly.finalCells });
  let score = edgeOnly.score;
  let usedContradiction = false;

  for (let guard = 0; guard < 200; guard++) {
    if (Date.now() >= deadline) return null;
    const propagated = propagateLineDeductions(board);
    if (!propagated.valid) return null;
    board = propagated.board;
    if (board.unknownCount() === 0) {
      return board.isSolved() ? { level: usedContradiction ? 5 : 4, score } : null;
    }

    const edge = findEdgeLookaheadSteps(board, 24);
    if (edge.length > 0) {
      if (!applySteps(board, edge)) return null;
      score += edge.reduce((sum, step) => sum + step.score, 0);
      continue;
    }

    const contradiction = findContradictionSteps(board, 24);
    if (contradiction.length === 0) return null;
    if (!applySteps(board, contradiction)) return null;
    usedContradiction = true;
    score += contradiction.reduce((sum, step) => sum + step.score, 0);
  }
  return null;
}

function rateHardBounded(start: NonogramBoard, deadline: number): { level: DifficultyLevel; score: number } | null {
  let board = start.clone();
  const edgeLimit = 60;
  let edgeSteps = 0;
  let contradictionBatches = 0;
  let score = 0;
  let usedContradiction = false;

  for (let guard = 0; guard < 120; guard++) {
    if (Date.now() >= deadline) return null;
    const propagated = propagateLineDeductions(board);
    if (!propagated.valid) return null;
    board = propagated.board;
    if (board.unknownCount() === 0) {
      return board.isSolved() ? { level: usedContradiction ? 5 : 4, score } : null;
    }

    const edge = findEdgeLookaheadSteps(board, 1);
    if (edge.length > 0) {
      if (edgeSteps++ >= edgeLimit) return null;
      applyStep(board, edge[0].changes);
      score += edge[0].score;
      continue;
    }

    if (contradictionBatches++ >= 8) return null;
    const contradiction = findContradictionSteps(board, 8);
    if (contradiction.length === 0) return null;
    if (!applySteps(board, contradiction)) return null;
    usedContradiction = true;
    score += contradiction.reduce((sum, step) => sum + step.score, 0);
  }
  return null;
}

function withRating(board: NonogramBoard, level: DifficultyLevel, score: number): NonogramBoard {
  return new NonogramBoard({
    width: board.width,
    height: board.height,
    rowClues: board.rowClues,
    colClues: board.colClues,
    solution: board.solution,
    title: board.title,
    level,
    score,
  });
}

/**
 * Last-resort fallback: a dense board is very likely line-solvable, so this cannot throw
 * even when a hard-level search spends its whole budget.
 */
function generateEasyFallback(size: number, rand: () => number): NonogramBoard | null {
  for (let i = 0; i < 20; i++) {
    const bits = randomBitmap(size, rand, 0.5 + rand() * 0.15);
    if (!isInteresting(bits, size)) continue;
    const board = NonogramBoard.fromBitmap(size, size, bits);
    const line = propagateLineDeductions(board);
    if (!line.valid || line.board.unknownCount() !== 0 || !line.board.isSolved()) continue;
    const rated = rateLineOnly(board, 5);
    if (rated) return withRating(board, rated.level, rated.score);
  }
  return null;
}

/**
 * Quick Unfair fallback for Extreme requests. Edge-only analysis is much cheaper than a
 * contradiction solve; one level-4 board is a better fallback than dropping to Medium.
 */
function findLevelFour(size: number, rand: () => number, deadline: number): NonogramBoard | null {
  for (let i = 0; i < 40; i++) {
    if (Date.now() >= deadline) break;
    const bits = randomBitmap(size, rand, 0.35 + rand() * 0.07);
    if (!isInteresting(bits, size)) continue;
    const board = NonogramBoard.fromBitmap(size, size, bits);
    const line = propagateLineDeductions(board);
    if (!line.valid || (line.board.unknownCount() === 0 && line.board.isSolved())) continue;
    const edgeOnly = analyzePuzzle(board, { disabledTechniques: NO_CONTRADICTION });
    if (edgeOnly.solved) return withRating(board, edgeOnly.level, edgeOnly.score);
  }
  return null;
}

/**
 * Generate a uniquely solvable puzzle; if `level` is given, prefer one rated at that level.
 *
 * A fast DP propagation settles most random boards. Fully settled boards are unique, so
 * easy and medium targets never pay for a full uniqueness search. Only boards that survive
 * line propagation need the expensive edge/contradiction analysis. Requested levels are a
 * preference: if the exact level is rare, the closest rated board found within the attempt
 * budget is returned.
 */
export function generatePuzzle(opts: GenerateOptions): NonogramBoard {
  const rand = mulberry32(opts.seed);
  const target = opts.level;
  const attempts = attemptLimit(target, opts.maxAttempts ?? 200);
  const deadline = opts.maxTimeMs === undefined ? Infinity : Date.now() + opts.maxTimeMs;
  let best: { board: NonogramBoard; level: DifficultyLevel; distance: number } | null = null;
  let easyFallback: NonogramBoard | null = null;

  if (target !== undefined && target >= 4 && opts.size >= 15 && opts.maxTimeMs !== undefined) {
    const quick = findLevelFour(opts.size, rand, Math.min(deadline, Date.now() + 2000));
    if (quick) best = { board: quick, level: 4, distance: Math.abs(4 - target) };
  }

  for (let i = 0; i < attempts; i++) {
    if (Date.now() >= deadline) break;
    const bits = randomBitmap(opts.size, rand, densityFor(target, rand));
    if (!isInteresting(bits, opts.size)) continue;
    const board = NonogramBoard.fromBitmap(opts.size, opts.size, bits);

    const line = propagateLineDeductions(board);
    if (!line.valid) continue;
    const lineSolved = line.board.unknownCount() === 0 && line.board.isSolved();

    let level: DifficultyLevel;
    let score: number;

    if (lineSolved) {
      if (target !== undefined && target >= 4) {
        // Too easy for a hard target, but keep one as a reliable fallback.
        easyFallback ??= board;
        continue;
      }
      const rated = rateLineOnly(board, (target ?? 5) as DifficultyLevel);
      if (!rated) {
        easyFallback ??= board;
        continue;
      }
      level = rated.level;
      score = rated.score;
    } else {
      if (target !== undefined && target <= 3) continue;
      const hard = rateHard(board, deadline);
      if (!hard) continue;
      level = hard.level;
      score = hard.score;
    }

    const rated = withRating(board, level, score);
    if (target === undefined || level === target) return rated;
    const distance = Math.abs(level - target);
    const tieBetter = best ? (target >= 3 ? level > best.level : level < best.level) : false;
    if (!best || distance < best.distance || (distance === best.distance && tieBetter)) {
      best = { board: rated, level, distance };
    }
  }

  if (best) return best.board;
  if (easyFallback) {
    const rated = rateLineOnly(easyFallback, 5);
    if (rated) return withRating(easyFallback, rated.level, rated.score);
  }
  const fallback = generateEasyFallback(opts.size, rand);
  if (fallback) return fallback;
  throw new Error('Could not generate a puzzle with a unique solution; try again or pick another size.');
}

/** Everyone gets the same puzzle for a given UTC date string `YYYY-MM-DD`. */
export function dailyPuzzle(date: string, size = 10): NonogramBoard {
  return generatePuzzle({ size, seed: hashString(`nonogram-daily-${date}-${size}`) });
}
