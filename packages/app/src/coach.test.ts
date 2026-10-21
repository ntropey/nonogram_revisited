import { describe, expect, it } from 'vitest';
import { NonogramBoard, NonogramStepFinder, traceHypothesis } from '@nonogram/core';
import { coachMarks, coachText, lineCells, provenState, proofMarks } from './coach';

function firstStep() {
  const board = new NonogramBoard({ width: 3, height: 1, rowClues: [[3]], colClues: [[1], [1], [1]] });
  return new NonogramStepFinder().findNextStep(board)!;
}

describe('coach', () => {
  it('lists the cells of a row or column', () => {
    expect(lineCells({ axis: 'row', index: 1 }, 3, 2)).toEqual([3, 4, 5]);
    expect(lineCells({ axis: 'col', index: 2 }, 3, 2)).toEqual([2, 5]);
  });

  it('reveals more of the step at each stage', () => {
    const step = firstStep();
    const s1 = coachMarks(step, 1, 3, 1);
    const s4 = coachMarks(step, 4, 3, 1);
    expect(Object.values(s1).every((v) => v === 'tint-a')).toBe(true);
    expect(Object.values(s4)).toContain('hint-place');
    expect(Object.values(coachMarks(step, 2, 3, 1))).not.toContain('hint-place');
  });

  it('words each stage without leaking the answer early', () => {
    const step = firstStep();
    expect(coachText(step, 1, 3).body).toContain('Row 1');
    expect(coachText(step, 2, 3).body).not.toMatch(/r1c\d/);
    expect(coachText(step, 3, 3).title).toBe(step.name);
    expect(coachText(step, 4, 3).body).toMatch(/r1c1 filled/);
  });
});

describe('prover helpers', () => {
  const board = new NonogramBoard({ width: 3, height: 1, rowClues: [[3]], colClues: [[1], [1], [1]] });

  it('proves a cell must be filled when crossing it breaks the row', () => {
    const fill = traceHypothesis(board, 0, 1);
    const cross = traceHypothesis(board, 0, -1);
    expect(fill).toBeNull();
    expect(cross).not.toBeNull();
    expect(provenState(fill, cross)).toBe(1);
    const marks = proofMarks(cross!, 3, 1);
    expect(marks[0]).toBe('hint-key');
  });

  it('reports nothing provable when neither side contradicts', () => {
    expect(provenState(null, null)).toBeNull();
  });
});
