/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Human-style Nonogram step finder implementing all 9 techniques in ascending difficulty.
 */
import {
  NonogramBoard,
  cellName,
  cellNames,
  emptyMarks,
  lineName,
  lineShortName,
  normalizeClues,
} from './board';
import { solveLineDP, type LineDPResult } from './lineSolver';
import {
  TECHNIQUES_META,
  TECHNIQUE_BY_TYPE,
  type CellState,
  type LineAxis,
  type LineRef,
  type SolutionStep,
  type StepMark,
  type StepMarks,
  type TechniqueType,
} from './types';

export interface StepFinderOptions {
  /** Optional set of disabled technique types that should be skipped */
  disabledTechniques?: ReadonlySet<TechniqueType>;
}

function makeStep(
  type: TechniqueType,
  board: NonogramBoard,
  line: LineRef,
  changes: { cell: number; state: 1 | -1 }[],
  reason: string,
  marks: StepMarks,
  extra?: { secondaryLine?: LineRef; clueIndex?: number },
): SolutionStep {
  const meta = TECHNIQUE_BY_TYPE[type];
  const fills = changes.filter((c) => c.state === 1).map((c) => cellName(c.cell, board.width));
  const crosses = changes.filter((c) => c.state === -1).map((c) => cellName(c.cell, board.width));
  const parts: string[] = [];
  if (fills.length > 0) parts.push(`fill ${fills.join(', ')}`);
  if (crosses.length > 0) parts.push(`cross out ${crosses.join(', ')}`);
  const where = extra?.secondaryLine
    ? `${lineName(line)} & ${lineName(extra.secondaryLine)}`
    : lineName(line);
  const text = `${meta.name}: ${where} => ${parts.join('; ')}`;
  return {
    type,
    name: meta.name,
    slug: meta.slug,
    level: meta.level,
    score: meta.score,
    line,
    secondaryLine: extra?.secondaryLine,
    clueIndex: extra?.clueIndex,
    changes,
    text,
    reason,
    marks,
  };
}

/** Find contiguous runs of `1`s in `cells`. */
function findFilledRuns(cells: readonly CellState[]): { start: number; end: number; length: number }[] {
  const runs: { start: number; end: number; length: number }[] = [];
  let i = 0;
  while (i < cells.length) {
    if (cells[i] === 1) {
      const start = i;
      while (i < cells.length && cells[i] === 1) i++;
      runs.push({ start, end: i - 1, length: i - start });
    } else {
      i++;
    }
  }
  return runs;
}

/**
 * Analyze a single line (`axis`, `index`) on `board` and classify any available 1D human steps
 * among techniques 1..7 (`FULL_ZERO_LINE` through `MERCURY`).
 */
export function findLineSteps(board: NonogramBoard, axis: LineAxis, index: number): SolutionStep[] {
  const line: LineRef = { axis, index };
  const clues = normalizeClues(board.getClues(axis, index));
  const cells = board.getLineCells(axis, index);
  const L = cells.length;
  const lineCellIndices = board.getLineIndices(axis, index);

  const dp = solveLineDP(clues, cells);
  if (!dp.valid || dp.newChanges.length === 0) return [];

  const blocks = dp.blocks;
  const m = blocks.length;
  const sumBlocks = blocks.reduce((a, b) => a + b, 0);
  const filledCount = cells.filter((c) => c === 1).length;
  const nonCrossCount = cells.filter((c) => c !== -1).length;

  // --- 1. FULL_ZERO_LINE ---
  const isZeroLine = m === 0;
  const isFullFromClues = m > 0 && sumBlocks + (m - 1) === L && cells.every((c) => c === 0);
  const isAllFilledPlaced = m > 0 && filledCount === sumBlocks;
  const isRemainingExactFill = m > 0 && nonCrossCount === sumBlocks;

  if (isZeroLine || isFullFromClues || isAllFilledPlaced || isRemainingExactFill) {
    const changes = dp.newChanges.map((ch) => ({
      cell: board.linePosToCell(axis, index, ch.pos),
      state: ch.state,
    }));
    const marks = emptyMarks();
    marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
    for (let p = 0; p < L; p++) {
      if (cells[p] !== 0) {
        marks.key.push({ cell: board.linePosToCell(axis, index, p), state: cells[p] });
      }
    }
    for (const ch of changes) {
      if (ch.state === 1) marks.place.push({ cell: ch.cell, state: 1 });
      else marks.elim.push({ cell: ch.cell, state: -1 });
    }
    marks.clues = clues.map((_, ci) => ({ axis, lineIndex: index, clueIndex: ci }));

    let reason: string;
    if (isZeroLine) {
      reason = `${lineName(line)} has clue 0, so no cell in this ${axis === 'row' ? 'row' : 'column'} can be filled; cross out ${cellNames(
        changes.map((c) => c.cell),
        board.width,
      )}.`;
    } else if (isFullFromClues) {
      reason = `${lineName(line)} has clue(s) [${clues.join(', ')}], which require ${sumBlocks} filled cells plus ${
        m - 1
      } mandatory separator cross${m - 1 === 1 ? '' : 'es'} = ${L} cells, filling the entire ${
        axis === 'row' ? 'row' : 'column'
      } immediately.`;
    } else if (isAllFilledPlaced) {
      reason = `All ${sumBlocks} filled cell${sumBlocks === 1 ? '' : 's'} required by [${clues.join(
        ', ',
      )}] in ${lineName(line)} are already placed, so every remaining unknown cell must be crossed out.`;
    } else {
      reason = `${lineName(line)} needs ${sumBlocks} filled cells for [${clues.join(
        ', ',
      )}] and has exactly ${nonCrossCount} uncrossed cell${nonCrossCount === 1 ? '' : 's'} left, so every remaining cell must be filled.`;
    }
    return [makeStep('FULL_ZERO_LINE', board, line, changes, reason, marks)];
  }

  // Compute what is forced by board edges and existing `-1` crosses alone (ignoring existing `1`s)
  const cellsOnlyCrosses: CellState[] = cells.map((c) => (c === 1 ? 0 : c));
  const dpWalls = solveLineDP(clues, cellsOnlyCrosses);

  const steps: SolutionStep[] = [];
  const claimedPos = new Set<number>();

  // --- 2. SIMPLE_BOXES (Clue Overlap without needing existing `1` cells) ---
  if (dpWalls.valid) {
    const simpleBoxPositions = dp.newChanges.filter(
      (ch) => ch.state === 1 && dpWalls.forced[ch.pos] === 1,
    );
    if (simpleBoxPositions.length > 0) {
      for (const ch of simpleBoxPositions) claimedPos.add(ch.pos);
      const changes = simpleBoxPositions.map((ch) => ({
        cell: board.linePosToCell(axis, index, ch.pos),
        state: 1 as const,
      }));
      const marks = emptyMarks();
      marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
      for (let p = 0; p < L; p++) {
        if (cells[p] === -1) marks.key.push({ cell: board.linePosToCell(axis, index, p), state: -1 });
      }
      for (const ch of changes) marks.place.push({ cell: ch.cell, state: 1 });
      const involvedBlocks = [
        ...new Set(simpleBoxPositions.flatMap((ch) => dpWalls.coveringBlocks[ch.pos])),
      ];
      marks.clues = involvedBlocks.map((ci) => ({ axis, lineIndex: index, clueIndex: ci }));
      const bDesc =
        involvedBlocks.length > 0
          ? involvedBlocks
              .map(
                (b) =>
                  `block ${blocks[b]} (earliest ${cellName(
                    board.linePosToCell(axis, index, dpWalls.minStart[b]),
                    board.width,
                  )}..${cellName(
                    board.linePosToCell(axis, index, dpWalls.minStart[b] + blocks[b] - 1),
                    board.width,
                  )}, latest ${cellName(
                    board.linePosToCell(axis, index, dpWalls.maxStart[b]),
                    board.width,
                  )}..${cellName(
                    board.linePosToCell(axis, index, dpWalls.maxStart[b] + blocks[b] - 1),
                    board.width,
                  )})`,
              )
              .join(' and ')
          : `clues [${clues.join(', ')}]`;
      const reason = `In ${lineName(line)}, packing ${bDesc} at its earliest and latest valid positions overlaps on ${cellNames(
        changes.map((c) => c.cell),
        board.width,
      )}, so ${changes.length === 1 ? 'that cell' : 'those cells'} must be filled.`;
      steps.push(
        makeStep('SIMPLE_BOXES', board, line, changes, reason, marks, {
          clueIndex: involvedBlocks[0],
        }),
      );
    }

    // --- 3. SIMPLE_SPACES (Unreachable spaces or too-narrow gaps from crosses alone) ---
    const simpleSpacePositions = dp.newChanges.filter(
      (ch) => !claimedPos.has(ch.pos) && ch.state === -1 && dpWalls.forced[ch.pos] === -1,
    );
    if (simpleSpacePositions.length > 0) {
      for (const ch of simpleSpacePositions) claimedPos.add(ch.pos);
      const changes = simpleSpacePositions.map((ch) => ({
        cell: board.linePosToCell(axis, index, ch.pos),
        state: -1 as const,
      }));
      const marks = emptyMarks();
      marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
      for (let p = 0; p < L; p++) {
        if (cells[p] === -1) marks.key.push({ cell: board.linePosToCell(axis, index, p), state: -1 });
      }
      for (const ch of changes) marks.elim.push({ cell: ch.cell, state: -1 });
      marks.clues = clues.map((_, ci) => ({ axis, lineIndex: index, clueIndex: ci }));
      const minBlock = Math.min(...blocks);
      const reason = `In ${lineName(line)} ([${clues.join(', ')}]), ${cellNames(
        changes.map((c) => c.cell),
        board.width,
      )} ${
        changes.length === 1 ? 'lies' : 'lie'
      } in a space of available cells shorter than the smallest block that can reach there (minimum length ${minBlock}), so no block can cover ${
        changes.length === 1 ? 'it' : 'them'
      }.`;
      steps.push(makeStep('SIMPLE_SPACES', board, line, changes, reason, marks));
    }
  }

  const remaining = dp.newChanges.filter((ch) => !claimedPos.has(ch.pos));
  if (remaining.length === 0) return steps;

  const runs = findFilledRuns(cells);

  // --- 4. FORCING (Edge / Wall Extension from an existing filled cell near a boundary or `-1` wall) ---
  const forcingPositions: { pos: number; state: 1; anchorPos: number; blockIdx?: number }[] = [];
  for (const ch of remaining) {
    if (ch.state !== 1) continue;
    const bList = dp.coveringBlocks[ch.pos];
    const b = bList.length === 1 ? bList[0] : undefined;
    const k = b !== undefined ? blocks[b] : Math.min(...blocks);

    // Check if there is an existing `1` cell between a wall/edge and `ch.pos` within distance `< k`
    for (const run of runs) {
      // Left wall/edge forcing rightward (run is near start or right after a `-1`, and `ch.pos > run.end`)
      const leftWall = run.start === 0 ? -1 : cells.lastIndexOf(-1, run.start - 1);
      const distFromLeftWall = run.start - (leftWall + 1);
      // Verify no `1` between `leftWall` and `run.start`
      if (distFromLeftWall >= 0 && ch.pos > run.end && ch.pos - (leftWall + 1) < k) {
        forcingPositions.push({ pos: ch.pos, state: 1, anchorPos: run.start, blockIdx: b });
        break;
      }
      // Right wall/edge forcing leftward (run is near end or right before a `-1`, and `ch.pos < run.start`)
      let rightWall = L;
      for (let q = run.end + 1; q < L; q++) {
        if (cells[q] === -1) {
          rightWall = q;
          break;
        }
      }
      const distFromRightWall = rightWall - 1 - run.end;
      if (distFromRightWall >= 0 && ch.pos < run.start && rightWall - 1 - ch.pos < k) {
        forcingPositions.push({ pos: ch.pos, state: 1, anchorPos: run.end, blockIdx: b });
        break;
      }
    }
  }

  // Only classify as FORCING if it isn't actually bridging two separate `1` runs (which is JOINING_SPLITTING)
  const pureForcing = forcingPositions.filter((fp) => {
    const hasLeftOne = runs.some((r) => r.end < fp.pos);
    const hasRightOne = runs.some((r) => r.start > fp.pos);
    return !(hasLeftOne && hasRightOne && fp.blockIdx !== undefined && runs.some((r) => r.end < fp.pos && dp.coveringBlocks[r.end].includes(fp.blockIdx!)) && runs.some((r) => r.start > fp.pos && dp.coveringBlocks[r.start].includes(fp.blockIdx!)));
  });

  if (pureForcing.length > 0) {
    for (const fp of pureForcing) claimedPos.add(fp.pos);
    const changes = pureForcing.map((fp) => ({
      cell: board.linePosToCell(axis, index, fp.pos),
      state: 1 as const,
    }));
    const marks = emptyMarks();
    marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
    const anchorSet = new Set(pureForcing.map((fp) => fp.anchorPos));
    for (const aPos of anchorSet) {
      marks.key.push({ cell: board.linePosToCell(axis, index, aPos), state: 1 });
    }
    for (let p = 0; p < L; p++) {
      if (cells[p] === -1) marks.fins.push({ cell: board.linePosToCell(axis, index, p), state: -1 });
    }
    for (const ch of changes) marks.place.push({ cell: ch.cell, state: 1 });
    const bIdx = pureForcing[0].blockIdx;
    if (bIdx !== undefined) {
      marks.clues = [{ axis, lineIndex: index, clueIndex: bIdx }];
    }
    const anchorNames = cellNames(
      [...anchorSet].map((p) => board.linePosToCell(axis, index, p)),
      board.width,
    );
    const clueLabel = bIdx !== undefined ? `clue ${blocks[bIdx]}` : `clues [${clues.join(', ')}]`;
    const reason = `In ${lineName(line)}, the filled cell at ${anchorNames} sits near an edge or cross wall, forcing ${clueLabel} to extend inward and fill ${cellNames(
      changes.map((c) => c.cell),
      board.width,
    )}.`;
    steps.push(makeStep('FORCING', board, line, changes, reason, marks, { clueIndex: bIdx }));
  }

  // --- 6. Check JOINING & SPLITTING before general GLUE_PUNCTURING so joining/splitting between two runs is specifically recognized ---
  const joiningSplitting: { pos: number; state: 1 | -1; kind: 'join' | 'split' }[] = [];
  for (const ch of dp.newChanges) {
    if (claimedPos.has(ch.pos)) continue;
    const leftRun = [...runs].reverse().find((r) => r.end < ch.pos);
    const rightRun = runs.find((r) => r.start > ch.pos);
    if (!leftRun || !rightRun) continue;

    if (ch.state === 1) {
      // Joining: `ch.pos` lies between `leftRun` and `rightRun`, and both can be covered by the same block
      const sharedBlock = dp.coveringBlocks[ch.pos].find(
        (b) => dp.coveringBlocks[leftRun.end].includes(b) && dp.coveringBlocks[rightRun.start].includes(b),
      );
      if (sharedBlock !== undefined) {
        joiningSplitting.push({ pos: ch.pos, state: 1, kind: 'join' });
      }
    } else if (ch.state === -1) {
      // Splitting: `ch.pos` is an unknown cell between `leftRun` and `rightRun` (e.g. a 1-cell or 2-cell gap)
      // where filling `ch.pos` would create or force a block longer than allowed
      const gapLen = rightRun.start - leftRun.end - 1;
      const mergedLen = rightRun.end - leftRun.start + 1;
      const maxBlock = Math.max(...blocks);
      if (gapLen <= 2 && mergedLen > maxBlock) {
        joiningSplitting.push({ pos: ch.pos, state: -1, kind: 'split' });
      } else if (ch.pos === leftRun.end + 1 && ch.pos === rightRun.start - 1) {
        joiningSplitting.push({ pos: ch.pos, state: -1, kind: 'split' });
      }
    }
  }

  // --- 5. GLUE_PUNCTURING ---
  const jsPosSet = new Set(joiningSplitting.map((j) => j.pos));
  const gluePuncturing: { pos: number; state: 1 | -1; kind: 'glue' | 'puncture' }[] = [];
  for (const ch of dp.newChanges) {
    if (claimedPos.has(ch.pos) || jsPosSet.has(ch.pos)) continue;
    if (ch.state === -1) {
      // Puncturing: immediately adjacent to a filled run, or outside the pinned range of blocks due to existing `1`s
      const adjFilled =
        (ch.pos > 0 && cells[ch.pos - 1] === 1) || (ch.pos + 1 < L && cells[ch.pos + 1] === 1);
      // Check if it's a Mercury bounce (adjacent to a wall/edge on one side, with a `1` cell at distance `k` on the other side)
      const isMercuryBounce = (() => {
        const atLeftWall = ch.pos === 0 || cells[ch.pos - 1] === -1;
        const atRightWall = ch.pos === L - 1 || cells[ch.pos + 1] === -1;
        if (atLeftWall) {
          for (const k of blocks) {
            if (ch.pos + k < L && cells[ch.pos + k] === 1) return true;
          }
        }
        if (atRightWall) {
          for (const k of blocks) {
            if (ch.pos - k >= 0 && cells[ch.pos - k] === 1) return true;
          }
        }
        return false;
      })();
      if (!isMercuryBounce && (adjFilled || runs.length > 0)) {
        gluePuncturing.push({ pos: ch.pos, state: -1, kind: adjFilled ? 'puncture' : 'glue' });
      }
    } else if (ch.state === 1) {
      // Glue: existing `1` cells constrain a block's range so `ch.pos` is covered in every valid placement
      gluePuncturing.push({ pos: ch.pos, state: 1, kind: 'glue' });
    }
  }

  if (gluePuncturing.length > 0) {
    for (const gp of gluePuncturing) claimedPos.add(gp.pos);
    const changes = gluePuncturing.map((gp) => ({
      cell: board.linePosToCell(axis, index, gp.pos),
      state: gp.state,
    }));
    const marks = emptyMarks();
    marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
    for (const r of runs) {
      for (let p = r.start; p <= r.end; p++) {
        marks.key.push({ cell: board.linePosToCell(axis, index, p), state: 1 });
      }
    }
    for (const ch of changes) {
      if (ch.state === 1) marks.place.push({ cell: ch.cell, state: 1 });
      else marks.elim.push({ cell: ch.cell, state: -1 });
    }
    marks.clues = clues.map((_, ci) => ({ axis, lineIndex: index, clueIndex: ci }));
    const hasPuncture = gluePuncturing.some((g) => g.kind === 'puncture');
    const hasGlueFill = gluePuncturing.some((g) => g.state === 1);
    const reason =
      hasPuncture && !hasGlueFill
        ? `In ${lineName(line)} ([${clues.join(', ')}]), the filled cells at ${cellNames(
            marks.key.map((k) => k.cell),
            board.width,
          )} complete or bound their clue block, puncturing the adjacent cell${
            changes.length === 1 ? '' : 's'
          } ${cellNames(
            changes.map((c) => c.cell),
            board.width,
          )} with a cross.`
        : `In ${lineName(line)} ([${clues.join(', ')}]), the existing filled cell${
            marks.key.length === 1 ? '' : 's'
          } at ${cellNames(
            marks.key.map((k) => k.cell),
            board.width,
          )} act as glue that pins the valid range of the clue block(s), forcing ${cellNames(
            changes.map((c) => c.cell),
            board.width,
          )}.`;
    steps.push(makeStep('GLUE_PUNCTURING', board, line, changes, reason, marks));
  }

  if (joiningSplitting.length > 0) {
    for (const js of joiningSplitting) claimedPos.add(js.pos);
    const changes = joiningSplitting.map((js) => ({
      cell: board.linePosToCell(axis, index, js.pos),
      state: js.state,
    }));
    const marks = emptyMarks();
    marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
    for (const r of runs) {
      for (let p = r.start; p <= r.end; p++) {
        marks.key.push({ cell: board.linePosToCell(axis, index, p), state: 1 });
      }
    }
    for (const ch of changes) {
      if (ch.state === 1) marks.place.push({ cell: ch.cell, state: 1 });
      else marks.elim.push({ cell: ch.cell, state: -1 });
    }
    marks.clues = clues.map((_, ci) => ({ axis, lineIndex: index, clueIndex: ci }));
    const hasJoin = joiningSplitting.some((j) => j.kind === 'join');
    const hasSplit = joiningSplitting.some((j) => j.kind === 'split');
    const reason =
      hasJoin && !hasSplit
        ? `In ${lineName(line)} ([${clues.join(', ')}]), the separated filled groups in ${cellNames(
            marks.key.map((k) => k.cell),
            board.width,
          )} must belong to the same clue block, joining them across ${cellNames(
            changes.map((c) => c.cell),
            board.width,
          )}.`
        : `In ${lineName(line)} ([${clues.join(', ')}]), filling ${cellNames(
            changes.map((c) => c.cell),
            board.width,
          )} between ${cellNames(
            marks.key.map((k) => k.cell),
            board.width,
          )} would create a contiguous run longer than the clue allows, so ${
            changes.length === 1 ? 'it' : 'they'
          } must be crossed out to split the blocks.`;
    steps.push(makeStep('JOINING_SPLITTING', board, line, changes, reason, marks));
  }

  // --- 7. MERCURY (Bouncing & remaining multi-constraint line deductions) ---
  const mercuryChanges = dp.newChanges.filter((ch) => !claimedPos.has(ch.pos));
  if (mercuryChanges.length > 0) {
    const changes = mercuryChanges.map((ch) => ({
      cell: board.linePosToCell(axis, index, ch.pos),
      state: ch.state,
    }));
    const marks = emptyMarks();
    marks.tint = [{ cells: lineCellIndices, tone: 'a' }];
    for (let p = 0; p < L; p++) {
      if (cells[p] === 1) marks.key.push({ cell: board.linePosToCell(axis, index, p), state: 1 });
      else if (cells[p] === -1) marks.fins.push({ cell: board.linePosToCell(axis, index, p), state: -1 });
    }
    for (const ch of changes) {
      if (ch.state === 1) marks.place.push({ cell: ch.cell, state: 1 });
      else marks.elim.push({ cell: ch.cell, state: -1 });
    }
    marks.clues = clues.map((_, ci) => ({ axis, lineIndex: index, clueIndex: ci }));
    const reason = `In ${lineName(line)} ([${clues.join(
      ', ',
    )}]), placing a block at ${cellNames(
      changes.map((c) => c.cell),
      board.width,
    )} near the wall would collide with the filled cell at ${cellNames(
      marks.key.map((k) => k.cell),
      board.width,
    )} and exceed the clue length (Mercury bounce), forcing ${cellNames(
      changes.map((c) => c.cell),
      board.width,
    )} to be crossed out.`;
    steps.push(makeStep('MERCURY', board, line, changes, reason, marks));
  }

  return steps;
}

/**
 * Technique 8: `EDGE_LOOKAHEAD` (Edge Logic & 2-Line Lookahead).
 * Tests unknown cells `(r, c)` by tentatively placing `1` (or `-1`), running 1D line DP on row `r` and col `c`,
 * and checking whether any crossing orthogonal line immediately becomes invalid (`!valid`).
 */
export function findEdgeLookaheadSteps(board: NonogramBoard, maxResults = 5): SolutionStep[] {
  const results: SolutionStep[] = [];
  const W = board.width;
  const H = board.height;

  // Order cells so board edges and partially constrained lines are checked first
  const candidates: number[] = [];
  for (let cell = 0; cell < W * H; cell++) {
    if (board.cells[cell] === 0) candidates.push(cell);
  }
  candidates.sort((a, b) => {
    const ra = Math.floor(a / W);
    const ca = a % W;
    const rb = Math.floor(b / W);
    const cb = b % W;
    const edgeA = ra === 0 || ra === H - 1 || ca === 0 || ca === W - 1 ? 0 : 1;
    const edgeB = rb === 0 || rb === H - 1 || cb === 0 || cb === W - 1 ? 0 : 1;
    return edgeA - edgeB || a - b;
  });

  for (const cell of candidates) {
    const r = Math.floor(cell / W);
    const c = cell % W;

    for (const assumed of [1, -1] as const) {
      const work = board.clone();
      work.cells[cell] = assumed;

      // Propagate 1D line DP on row `r` and col `c`
      const rowDP = solveLineDP(work.rowClues[r], work.getLineCells('row', r));
      const colDP = solveLineDP(work.colClues[c], work.getLineCells('col', c));
      if (!rowDP.valid || !colDP.valid) continue;

      const forcedFromRow = rowDP.newChanges.map((ch) => ({
        cell: work.linePosToCell('row', r, ch.pos),
        pos: ch.pos,
        state: ch.state,
      }));
      const forcedFromCol = colDP.newChanges.map((ch) => ({
        cell: work.linePosToCell('col', c, ch.pos),
        pos: ch.pos,
        state: ch.state,
      }));

      for (const f of forcedFromRow) work.cells[f.cell] = f.state;
      for (const f of forcedFromCol) work.cells[f.cell] = f.state;

      // Check if any column touched by `forcedFromRow` or any row touched by `forcedFromCol` is now invalid,
      // OR if a second-step parallel neighbor row (`r-1`, `r+1`) or column (`c-1`, `c+1`) breaks after 1 cross-propagation!
      let conflictLine: LineRef | null = null;
      let primaryLine: LineRef = { axis: 'row', index: r };
      let causalMarks: StepMark[] = [];

      // 1a. Check columns affected by `forcedFromRow`
      for (const f of forcedFromRow) {
        const colIdx = f.pos;
        const cDP = solveLineDP(work.colClues[colIdx], work.getLineCells('col', colIdx));
        if (!cDP.valid) {
          conflictLine = { axis: 'col', index: colIdx };
          primaryLine = { axis: 'row', index: r };
          causalMarks = forcedFromRow.map((x) => ({ cell: x.cell, state: x.state, strong: true }));
          break;
        }
        // Apply column forced moves to see if an adjacent parallel row (e.g. `r-1` or `r+1`) breaks (classic Edge Logic!)
        for (const cf of cDP.newChanges) {
          work.setLineCell('col', colIdx, cf.pos, cf.state);
        }
      }

      if (!conflictLine) {
        for (let nr = Math.max(0, r - 1); nr <= Math.min(H - 1, r + 1); nr++) {
          if (nr === r) continue;
          const nrDP = solveLineDP(work.rowClues[nr], work.getLineCells('row', nr));
          if (!nrDP.valid) {
            conflictLine = { axis: 'row', index: nr };
            primaryLine = { axis: 'row', index: r };
            causalMarks = forcedFromRow.map((x) => ({ cell: x.cell, state: x.state, strong: true }));
            break;
          }
        }
      }

      if (!conflictLine) {
        for (const f of forcedFromCol) {
          const rowIdx = f.pos;
          const rDP = solveLineDP(work.rowClues[rowIdx], work.getLineCells('row', rowIdx));
          if (!rDP.valid) {
            conflictLine = { axis: 'row', index: rowIdx };
            primaryLine = { axis: 'col', index: c };
            causalMarks = forcedFromCol.map((x) => ({ cell: x.cell, state: x.state, strong: true }));
            break;
          }
          for (const rf of rDP.newChanges) {
            work.setLineCell('row', rowIdx, rf.pos, rf.state);
          }
        }
      }

      if (!conflictLine) {
        for (let nc = Math.max(0, c - 1); nc <= Math.min(W - 1, c + 1); nc++) {
          if (nc === c) continue;
          const ncDP = solveLineDP(work.colClues[nc], work.getLineCells('col', nc));
          if (!ncDP.valid) {
            conflictLine = { axis: 'col', index: nc };
            primaryLine = { axis: 'col', index: c };
            causalMarks = forcedFromCol.map((x) => ({ cell: x.cell, state: x.state, strong: true }));
            break;
          }
        }
      }

      if (conflictLine) {
        const deduced: 1 | -1 = assumed === 1 ? -1 : 1;
        const marks = emptyMarks();
        marks.tint = [
          { cells: board.getLineIndices(primaryLine.axis, primaryLine.index), tone: 'a' },
          { cells: board.getLineIndices(conflictLine.axis, conflictLine.index), tone: 'b' },
        ];
        marks.key = [{ cell, state: assumed, strong: false }];
        marks.fins = causalMarks.slice(0, 6);
        if (deduced === 1) marks.place = [{ cell, state: 1 }];
        else marks.elim = [{ cell, state: -1 }];
        if (causalMarks.length > 0) {
          marks.chains = causalMarks.slice(0, 4).map((cm) => [{ cell, state: assumed, strong: false }, cm]);
        }

        const assumedStr = assumed === 1 ? 'filled (#)' : 'crossed out (x)';
        const deducedStr = deduced === 1 ? 'filled (#)' : 'crossed out (x)';
        const cname = cellName(cell, W);
        const reason = `Edge / 2-Line Lookahead on ${cname}: if ${cname} were ${assumedStr} in ${lineName(
          primaryLine,
        )}, it would immediately force ${
          causalMarks.length > 0 ? cellNames(causalMarks.map((m) => m.cell), W) : 'adjacent cells'
        }, leaving ${lineName(conflictLine)} ([${board
          .getClues(conflictLine.axis, conflictLine.index)
          .join(', ')}]) with no valid block placement. Therefore ${cname} must be ${deducedStr}.`;

        results.push(
          makeStep('EDGE_LOOKAHEAD', board, primaryLine, [{ cell, state: deduced }], reason, marks, {
            secondaryLine: conflictLine,
          }),
        );
        if (results.length >= maxResults) return results;
        break;
      }
    }
  }

  return results;
}

export interface ContradictionTrace {
  cell: number;
  assumed: 1 | -1;
  deduced: 1 | -1;
  conflictLine: LineRef;
  forcedMoves: { cell: number; state: 1 | -1; line: LineRef; reason: string }[];
}

/**
 * Test assuming `assumed` (`1` or `-1`) in `cell` on `board` and propagate 1D line DP until quiescence or conflict.
 * If a line becomes invalid, returns the `ContradictionTrace` describing the conflict and causal steps.
 */
export function traceHypothesis(
  board: NonogramBoard,
  cell: number,
  assumed: 1 | -1,
): ContradictionTrace | null {
  const work = board.clone();
  work.cells[cell] = assumed;
  const forcedMoves: { cell: number; state: 1 | -1; line: LineRef; reason: string }[] = [];

  for (let round = 0; round < 60; round++) {
    let changed = false;

    for (let r = 0; r < work.height; r++) {
      const dp = solveLineDP(work.rowClues[r], work.getLineCells('row', r));
      if (!dp.valid) {
        return {
          cell,
          assumed,
          deduced: assumed === 1 ? -1 : 1,
          conflictLine: { axis: 'row', index: r },
          forcedMoves,
        };
      }
      if (dp.newChanges.length > 0) {
        const line: LineRef = { axis: 'row', index: r };
        for (const ch of dp.newChanges) {
          const cIdx = work.linePosToCell('row', r, ch.pos);
          work.cells[cIdx] = ch.state;
          forcedMoves.push({
            cell: cIdx,
            state: ch.state,
            line,
            reason: `${lineShortName(line)} ([${work.rowClues[r].join(', ')}]) forces ${cellName(cIdx, work.width)} = ${
              ch.state === 1 ? '#' : 'x'
            }`,
          });
        }
        changed = true;
      }
    }

    for (let c = 0; c < work.width; c++) {
      const dp = solveLineDP(work.colClues[c], work.getLineCells('col', c));
      if (!dp.valid) {
        return {
          cell,
          assumed,
          deduced: assumed === 1 ? -1 : 1,
          conflictLine: { axis: 'col', index: c },
          forcedMoves,
        };
      }
      if (dp.newChanges.length > 0) {
        const line: LineRef = { axis: 'col', index: c };
        for (const ch of dp.newChanges) {
          const cIdx = work.linePosToCell('col', c, ch.pos);
          work.cells[cIdx] = ch.state;
          forcedMoves.push({
            cell: cIdx,
            state: ch.state,
            line,
            reason: `${lineShortName(line)} ([${work.colClues[c].join(', ')}]) forces ${cellName(cIdx, work.width)} = ${
              ch.state === 1 ? '#' : 'x'
            }`,
          });
        }
        changed = true;
      }
    }

    if (!changed) break;
  }

  return null;
}

/**
 * Technique 9: `CONTRADICTION` (Line Contradiction / Bifurcation).
 * Finds unknown cells where one hypothesis (`1` or `-1`) propagates via 1D line deductions to a line contradiction.
 */
export function findContradictionSteps(board: NonogramBoard, maxResults = 3): SolutionStep[] {
  const results: SolutionStep[] = [];
  const W = board.width;
  const H = board.height;

  // Prefer shortest contradiction chains
  let bestTraces: ContradictionTrace[] = [];

  for (let cell = 0; cell < W * H; cell++) {
    if (board.cells[cell] !== 0) continue;
    for (const assumed of [1, -1] as const) {
      const trace = traceHypothesis(board, cell, assumed);
      if (trace) {
        bestTraces.push(trace);
      }
    }
  }

  bestTraces.sort((a, b) => a.forcedMoves.length - b.forcedMoves.length || a.cell - b.cell);
  // Deduplicate by cell
  const seenCells = new Set<number>();
  bestTraces = bestTraces.filter((t) => {
    if (seenCells.has(t.cell)) return false;
    seenCells.add(t.cell);
    return true;
  });

  for (const trace of bestTraces.slice(0, maxResults)) {
    const r = Math.floor(trace.cell / W);
    const primaryLine: LineRef = { axis: 'row', index: r };
    const marks = emptyMarks();
    marks.tint = [
      { cells: [trace.cell], tone: 'a' },
      {
        cells: board.getLineIndices(trace.conflictLine.axis, trace.conflictLine.index),
        tone: 'b',
      },
    ];
    marks.key = [{ cell: trace.cell, state: trace.assumed, strong: false }];
    const previewMoves = trace.forcedMoves.slice(0, 6);
    marks.fins = previewMoves.map((m) => ({ cell: m.cell, state: m.state, strong: true }));
    if (trace.deduced === 1) marks.place = [{ cell: trace.cell, state: 1 }];
    else marks.elim = [{ cell: trace.cell, state: -1 }];

    if (previewMoves.length > 0) {
      const chain: StepMark[] = [
        { cell: trace.cell, state: trace.assumed, strong: false },
        ...previewMoves.map((m) => ({ cell: m.cell, state: m.state, strong: true })),
      ];
      marks.chains = [chain];
    }

    const cname = cellName(trace.cell, W);
    const assumedStr = trace.assumed === 1 ? 'filled (#)' : 'crossed out (x)';
    const deducedStr = trace.deduced === 1 ? 'filled (#)' : 'crossed out (x)';
    const moveSummary =
      previewMoves.length > 0
        ? ` (${previewMoves.map((m) => `${cellName(m.cell, W)}=${m.state === 1 ? '#' : 'x'}`).join(' -> ')})`
        : '';
    const reason = `Assuming ${cname} is ${assumedStr} forces a chain of line deductions${moveSummary} that leaves ${lineName(
      trace.conflictLine,
    )} ([${board
      .getClues(trace.conflictLine.axis, trace.conflictLine.index)
      .join(', ')}]) with no valid block placement. Therefore ${cname} must be ${deducedStr}.`;

    results.push(
      makeStep(
        'CONTRADICTION',
        board,
        primaryLine,
        [{ cell: trace.cell, state: trace.deduced }],
        reason,
        marks,
        { secondaryLine: trace.conflictLine },
      ),
    );
  }

  return results;
}

export class NonogramStepFinder {
  /**
   * Find the next lowest-difficulty human solving step on `board`, respecting `options.disabledTechniques`.
   */
  findNextStep(board: NonogramBoard, options?: StepFinderOptions): SolutionStep | null {
    const disabled = options?.disabledTechniques;
    const isEnabled = (t: TechniqueType) => !disabled || !disabled.has(t);

    // Collect all 1D line steps across all rows and columns
    const lineSteps: SolutionStep[] = [];
    for (let r = 0; r < board.height; r++) {
      for (const s of findLineSteps(board, 'row', r)) {
        if (isEnabled(s.type)) lineSteps.push(s);
      }
    }
    for (let c = 0; c < board.width; c++) {
      for (const s of findLineSteps(board, 'col', c)) {
        if (isEnabled(s.type)) lineSteps.push(s);
      }
    }

    if (lineSteps.length > 0) {
      // Pick the lowest score (easiest technique), breaking ties by larger number of changes
      lineSteps.sort((a, b) => a.score - b.score || b.changes.length - a.changes.length);
      return lineSteps[0];
    }

    if (isEnabled('EDGE_LOOKAHEAD')) {
      const lookahead = findEdgeLookaheadSteps(board, 1);
      if (lookahead.length > 0) return lookahead[0];
    }

    if (isEnabled('CONTRADICTION')) {
      const contra = findContradictionSteps(board, 1);
      if (contra.length > 0) return contra[0];
    }

    return null;
  }

  /**
   * Find all currently available logical steps on `board`, ordered by technique difficulty.
   */
  findAllSteps(board: NonogramBoard, options?: StepFinderOptions): SolutionStep[] {
    const disabled = options?.disabledTechniques;
    const isEnabled = (t: TechniqueType) => !disabled || !disabled.has(t);
    const out: SolutionStep[] = [];

    for (let r = 0; r < board.height; r++) {
      for (const s of findLineSteps(board, 'row', r)) {
        if (isEnabled(s.type)) out.push(s);
      }
    }
    for (let c = 0; c < board.width; c++) {
      for (const s of findLineSteps(board, 'col', c)) {
        if (isEnabled(s.type)) out.push(s);
      }
    }

    if (out.length === 0) {
      if (isEnabled('EDGE_LOOKAHEAD')) {
        out.push(...findEdgeLookaheadSteps(board, 5));
      }
      if (isEnabled('CONTRADICTION')) {
        out.push(...findContradictionSteps(board, 5));
      }
    }

    const orderIndex = (t: TechniqueType) => TECHNIQUES_META.findIndex((m) => m.type === t);
    out.sort((a, b) => orderIndex(a.type) - orderIndex(b.type) || b.changes.length - a.changes.length);
    return out;
  }
}
