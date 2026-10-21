/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Shared domain types for @nonogram/core.
 */

/**
 * State of a single grid cell:
 * - `0`: unknown / empty (`.`)
 * - `1`: filled block cell (`■` / `#`)
 * - `-1`: crossed-out empty cell (`×` / `x`)
 */
export type CellState = -1 | 0 | 1;

export type LineAxis = 'row' | 'col';

export interface LineRef {
  axis: LineAxis;
  /** 0-based index of the row or column */
  index: number;
}

/**
 * The 9 human-style Nonogram solving techniques in order of difficulty.
 */
export type TechniqueType =
  | 'FULL_ZERO_LINE'
  | 'SIMPLE_BOXES'
  | 'SIMPLE_SPACES'
  | 'FORCING'
  | 'GLUE_PUNCTURING'
  | 'JOINING_SPLITTING'
  | 'MERCURY'
  | 'EDGE_LOOKAHEAD'
  | 'CONTRADICTION';

/**
 * Difficulty level 1..5 matching the Revisited suite:
 * 1 = Easy, 2 = Medium, 3 = Hard, 4 = Unfair, 5 = Extreme.
 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export const LEVEL_NAMES: readonly string[] = ['Incomplete', 'Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];

export interface TechniqueMeta {
  type: TechniqueType;
  name: string;
  slug: string;
  level: DifficultyLevel;
  score: number;
  summary: string;
}

export const TECHNIQUES_META: readonly TechniqueMeta[] = [
  {
    type: 'FULL_ZERO_LINE',
    name: 'Full Line & Zero Line',
    slug: 'full-zero-line',
    level: 1,
    score: 10,
    summary:
      'A line with clue 0 is entirely crossed out, and a line whose clues plus mandatory 1-cell gaps match the available span is completely determined.',
  },
  {
    type: 'SIMPLE_BOXES',
    name: 'Simple Boxes (Clue Overlap)',
    slug: 'simple-boxes',
    level: 1,
    score: 20,
    summary:
      'Pack a line’s clues as far left/top and as far right/bottom as they can go; any cell covered by the same clue block in both extremes must be filled.',
  },
  {
    type: 'SIMPLE_SPACES',
    name: 'Simple Spaces (Block Length Limit)',
    slug: 'simple-spaces',
    level: 1,
    score: 30,
    summary:
      'Cross out any cell that lies outside the earliest-to-latest reach of every clue block, or inside an isolated gap shorter than any block that could fit there.',
  },
  {
    type: 'FORCING',
    name: 'Forcing (Edge & Wall Extension)',
    slug: 'forcing',
    level: 2,
    score: 50,
    summary:
      'A filled cell near a board edge or next to a crossed-out wall cell forces its clue block to extend away from the boundary.',
  },
  {
    type: 'GLUE_PUNCTURING',
    name: 'Glue & Puncturing',
    slug: 'glue-puncturing',
    level: 2,
    score: 80,
    summary:
      'Filled cells act as glue that pulls a clue block over nearby cells, while a completed block is punctured by placing crosses immediately before and after it.',
  },
  {
    type: 'JOINING_SPLITTING',
    name: 'Joining & Splitting Blocks',
    slug: 'joining-splitting',
    level: 3,
    score: 120,
    summary:
      'Join two separated filled groups when they must belong to the same clue block, or split them with a cross when joining would exceed the allowed block length.',
  },
  {
    type: 'MERCURY',
    name: 'Mercury (Bouncing)',
    slug: 'mercury',
    level: 3,
    score: 160,
    summary:
      'When starting a block next to a wall would touch a filled cell right after the block and make it too long, the block bounces away from the wall.',
  },
  {
    type: 'EDGE_LOOKAHEAD',
    name: 'Edge Logic & 2-Line Lookahead',
    slug: 'edge-lookahead',
    level: 4,
    score: 280,
    summary:
      'Test a cell along an edge or critical line and trace its immediate effect on the crossing lines; if an adjacent line breaks in one step, the cell is resolved.',
  },
  {
    type: 'CONTRADICTION',
    name: 'Line Contradiction (Bifurcation)',
    slug: 'contradiction',
    level: 5,
    score: 500,
    summary:
      'Assume a cell is filled (or crossed out) and propagate forced line steps across the grid until a line has no valid block placement, proving the opposite.',
  },
];

export const TECHNIQUE_BY_TYPE: Readonly<Record<TechniqueType, TechniqueMeta>> = Object.fromEntries(
  TECHNIQUES_META.map((m) => [m.type, m]),
) as Record<TechniqueType, TechniqueMeta>;

export interface StepMark {
  /** Flat cell index `r * width + c` */
  cell: number;
  /** Value associated with the mark: `1` for filled (`■`), `-1` for crossed (`×`), or `0` for neutral highlight */
  state: CellState;
  /** Optional strong/weak indicator for chain visualization */
  strong?: boolean;
}

export interface ClueMark {
  axis: LineAxis;
  lineIndex: number;
  clueIndex: number;
}

export interface StepMarks {
  /** Existing filled or crossed cells that anchor the deduction */
  key: StepMark[];
  /** Newly filled cells (`■`, state = 1) */
  place: StepMark[];
  /** Newly crossed-out cells (`×`, state = -1) */
  elim: StepMark[];
  /** Secondary highlight cells (e.g. wall cells, gap boundaries, or conflict cells) */
  fins: StepMark[];
  /** Tinted rows or columns (`tone: 'a'` for primary line, `'b'` for secondary/conflict line) */
  tint: { cells: number[]; tone: 'a' | 'b' }[];
  /** Causal chain segments for 2-line lookahead and contradiction proofs */
  chains: StepMark[][];
  /** Highlighted clue numbers on the primary/secondary lines */
  clues?: ClueMark[];
}

export interface SolutionStep {
  type: TechniqueType;
  name: string;
  slug: string;
  level: DifficultyLevel;
  score: number;
  /** Primary row or column where the deduction occurs */
  line: LineRef;
  /** Secondary row or column (e.g. for Edge Logic or Contradiction) */
  secondaryLine?: LineRef;
  /** Which clue index (0-based) in `line` is primarily responsible, if applicable */
  clueIndex?: number;
  /** Cells newly filled (`1`) or crossed (`-1`) by this step */
  changes: { cell: number; state: 1 | -1 }[];
  /** Short human-readable headline, e.g. `Simple Boxes (Clue Overlap): Row 3 => r3c4=■, r3c5=■` */
  text: string;
  /** Detailed explanation of why the deduction holds */
  reason: string;
  /** Visual board highlights for the step */
  marks: StepMarks;
}

export interface SolveAnalysis {
  solved: boolean;
  unique: boolean;
  level: DifficultyLevel;
  score: number;
  steps: SolutionStep[];
  counts: Record<TechniqueType, number>;
  finalCells: CellState[];
}

export interface PuzzleDefinition {
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  /** Optional 0/1 solution array of length `width * height` */
  solution?: (0 | 1)[];
  /** Optional title for pixel-art puzzles (revealed when solved or in library) */
  title?: string;
  /** Optional difficulty level */
  level?: DifficultyLevel;
  /** Optional numerical difficulty score */
  score?: number;
}
