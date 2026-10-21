/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Pure helpers for the Coach (staged hints), the Prover, and the board marks they draw.
 */
import { cellName, lineName } from '@nonogram/core';
import type { ContradictionTrace, LineRef, SolutionStep, TechniqueType } from '@nonogram/core';

export type CoachStage = 1 | 2 | 3 | 4;
export const COACH_STAGES: readonly CoachStage[] = [1, 2, 3, 4];

/** Per-cell CSS classes the board draws, keyed by flat cell index. */
export type CellMarks = Record<number, string>;

const QUESTIONS: Record<TechniqueType, string> = {
  FULL_ZERO_LINE: 'Add up the clue numbers and the single gaps they need between them. How does that total compare with the length of the line?',
  SIMPLE_BOXES: 'Slide each block as far one way, then as far the other, as it can go. Which cells does a block cover both times?',
  SIMPLE_SPACES: 'Which cells can no block ever reach, or sit in a gap too small for any block?',
  FORCING: 'Look at the filled cell near the edge or a cross. Which way must its block grow?',
  GLUE_PUNCTURING: 'Is any block already complete, or held together by filled cells? What must sit on either side of it?',
  JOINING_SPLITTING: 'Could these filled groups belong to the same block? If so, what must lie between them, and if not, what separates them?',
  MERCURY: 'If this block started right against the wall, what would it touch just past its end?',
  EDGE_LOOKAHEAD: 'Imagine the highlighted cell is filled. What does that do to the line crossing it?',
  CONTRADICTION: 'Suppose the highlighted cell is filled. Follow the cells that become forced. Does any line stop working?',
};

export function coachQuestion(type: TechniqueType): string {
  return QUESTIONS[type];
}

export function lineCells(line: LineRef, width: number, height: number): number[] {
  const out: number[] = [];
  if (line.axis === 'row') for (let c = 0; c < width; c++) out.push(line.index * width + c);
  else for (let r = 0; r < height; r++) out.push(r * width + line.index);
  return out;
}

export interface CoachText {
  title: string;
  body: string;
}

export function coachText(step: SolutionStep, stage: CoachStage, width: number): CoachText {
  switch (stage) {
    case 1:
      return { title: 'Where to look', body: `Look closely at ${lineName(step.line)}. Is there anything it already tells you?` };
    case 2:
      return { title: 'Think it through', body: coachQuestion(step.type) };
    case 3:
      return { title: step.name, body: step.reason };
    case 4: {
      const cells = step.changes.map((c) => `${cellName(c.cell, width)} ${c.state === 1 ? 'filled' : 'crossed out'}`);
      return { title: 'The move', body: cells.join(', ') };
    }
  }
}

/** What to draw for `step` at a given coach stage; each stage reveals more. */
export function coachMarks(step: SolutionStep, stage: CoachStage, width: number, height: number): CellMarks {
  const out: CellMarks = {};
  if (stage === 1) {
    for (const c of lineCells(step.line, width, height)) out[c] = 'tint-a';
    return out;
  }
  for (const t of step.marks.tint) for (const c of t.cells) out[c] = `tint-${t.tone}`;
  if (stage === 2) return out;
  for (const m of step.marks.fins) out[m.cell] = 'hint-fin';
  for (const m of step.marks.key) out[m.cell] = 'hint-key';
  if (stage === 3) return out;
  for (const m of step.marks.elim) out[m.cell] = 'hint-elim';
  for (const m of step.marks.place) out[m.cell] = 'hint-place';
  for (const ch of step.changes) out[ch.cell] = ch.state === 1 ? 'hint-place' : 'hint-elim';
  return out;
}

export function mistakeMarks(cells: readonly number[]): CellMarks {
  return Object.fromEntries(cells.map((c) => [c, 'mistake']));
}

/** Highlight a contradiction chain: the assumed cell, each forced cell, and the line that breaks. */
export function proofMarks(
  trace: ContradictionTrace,
  width: number,
  height: number,
  maxMoves = 40,
): CellMarks {
  const out: CellMarks = {};
  for (const c of lineCells(trace.conflictLine, width, height)) out[c] = 'tint-b';
  for (const m of trace.forcedMoves.slice(0, maxMoves)) out[m.cell] = 'hint-fin';
  out[trace.cell] = 'hint-key';
  return out;
}

/** The side a Prover result settles on, or null when line logic alone can't decide. */
export function provenState(fill: ContradictionTrace | null, cross: ContradictionTrace | null): 1 | -1 | null {
  if (fill && !cross) return -1;
  if (cross && !fill) return 1;
  return null;
}
