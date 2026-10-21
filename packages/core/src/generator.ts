/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Seeded generator (mulberry32) with date-seeded Daily Puzzles. Fully deterministic.
 */
import { NonogramBoard } from './board';
import { analyzePuzzle, countSolutions } from './solver';
import type { DifficultyLevel } from './types';

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

export interface GenerateOptions {
  size: number;
  level?: DifficultyLevel;
  seed: number;
  maxAttempts?: number;
}

/** Generate a uniquely solvable puzzle; if `level` is given, prefer one rated at that level. */
export function generatePuzzle(opts: GenerateOptions): NonogramBoard {
  const rand = mulberry32(opts.seed);
  const attempts = opts.maxAttempts ?? 200;
  let fallback: NonogramBoard | null = null;
  for (let i = 0; i < attempts; i++) {
    const bits = randomBitmap(opts.size, rand, 0.45 + rand() * 0.2);
    const board = NonogramBoard.fromBitmap(opts.size, opts.size, bits);
    if (countSolutions(board.clone(), 2) !== 1) continue;
    const a = analyzePuzzle(board);
    const rated = a.solved ? a.level : 5;
    if (!fallback) fallback = board;
    if (opts.level === undefined || rated === opts.level) return board;
  }
  if (fallback) return fallback;
  throw new Error('Could not generate a unique puzzle');
}

/** Everyone gets the same puzzle for a given UTC date string `YYYY-MM-DD`. */
export function dailyPuzzle(date: string, size = 10): NonogramBoard {
  return generatePuzzle({ size, seed: hashString(`nonogram-daily-${date}-${size}`) });
}
