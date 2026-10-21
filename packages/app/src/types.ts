/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Shared UI types and settings for the PWA.
 */
import type {
  CellState,
  ContradictionTrace,
  DifficultyLevel,
  LineAxis,
  LineRef,
  SolutionStep,
  TechniqueType,
} from '@nonogram/core';

export type GameMode = 'play' | 'train' | 'analyze';

export interface AppSettings {
  /** Whether filled/cross marks are shown as highlights while solving */
  showHighlights: boolean;
  /** Auto-cross remaining cells once a block is completed */
  autoCross: boolean;
  /** Sound effects enabled */
  sound: boolean;
  /** Difficulty filter for generated puzzles */
  preferredDifficulty: DifficultyLevel | null;
  /** Game mode */
  gameMode: GameMode;
  /** Board color scheme */
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: AppSettings = {
  showHighlights: true,
  autoCross: false,
  sound: true,
  preferredDifficulty: null,
  gameMode: 'play',
  theme: 'dark',
};

export interface StoredGame {
  id: string;
  title: string;
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  cells: CellState[];
  solution?: (0 | 1)[];
  createdAt: number;
  mode: GameMode;
  /** Rated difficulty, when the generator/solver has rated this puzzle. */
  level?: DifficultyLevel;
  score?: number;
  /** Set when the player completes the puzzle by hand (not when it is revealed). */
  solvedAt?: number | null;
}

/** What the hint panel is showing. */
export type Hint =
  /** Coach: `stage` runs 1 (where to look) to 4 (the move). */
  | { kind: 'step'; step: SolutionStep; stage: 1 | 2 | 3 | 4 }
  /** Prover: what happens if `cell` were filled (`fill`) or crossed out (`cross`). */
  | { kind: 'proof'; cell: number; fill: ContradictionTrace | null; cross: ContradictionTrace | null }
  | { kind: 'mistakes'; cells: number[] }
  | { kind: 'stuck' };

export type SolverStatus = 'idle' | 'solving' | 'generating';

export interface StoredSettings extends AppSettings {}

export interface LibraryEntry {
  id: string;
  title: string;
  width: number;
  height: number;
  difficulty: DifficultyLevel;
  score: number;
  solvedAt: number | null;
  createdAt: number;
}

export interface CellHighlight {
  cell: number;
  state: CellState;
  strong?: boolean;
}

export interface LineHighlight {
  axis: LineAxis;
  index: number;
  tone: 'a' | 'b';
}

export interface StepRender {
  step: SolutionStep;
  highlights: {
    key: CellHighlight[];
    place: CellHighlight[];
    elim: CellHighlight[];
    fins: CellHighlight[];
    tint: LineHighlight[];
    chains: CellHighlight[][];
  };
}
