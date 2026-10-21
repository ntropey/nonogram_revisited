/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Pure solver wrapper: exposes the core engine to the worker without any DOM/Node APIs.
 */
import {
  NonogramBoard,
  analyzePuzzle,
  countSolutions,
  generatePuzzle,
  solveLineDP,
  type StepFinderOptions,
} from '@nonogram/core';
import type { PuzzleDefinition, SolveAnalysis } from '@nonogram/core';
import type { WorkerMessage, WorkerReply, WorkerRequest, WorkerResponse } from './protocol';

/** Handle a single worker message, returning the typed reply (or an error reply). */
export function handleMessage(message: WorkerMessage): WorkerReply {
  switch (message.type) {
    case 'SOLVE': {
      const board = deserializeBoard(message.payload.definition);
      if (!board) {
        return { type: 'ERROR', payload: { message: 'Unable to deserialize puzzle definition.' } };
      }
      return { type: 'SOLVE_RESULT', payload: analyzePuzzle(board) };
    }
    case 'STEP': {
      const board = deserializeBoard(message.payload.definition);
      if (!board) {
        return { type: 'ERROR', payload: { message: 'Unable to deserialize puzzle definition.' } };
      }
      const disabled = message.payload.disabledTechniques
        ? new Set(message.payload.disabledTechniques)
        : undefined;
      return {
        type: 'STEP_RESULT',
        payload: analyzePuzzle(board, { disabledTechniques: disabled } as StepFinderOptions).steps[0] ?? null,
      };
    }
    case 'GENERATE': {
      const board = generatePuzzle(message.payload.options);
      return { type: 'GENERATE_RESULT', payload: board.toDefinition() };
    }
    case 'COUNT_SOLUTIONS': {
      const board = deserializeBoard(message.payload.definition);
      if (!board) {
        return { type: 'ERROR', payload: { message: 'Unable to deserialize puzzle definition.' } };
      }
      return {
        type: 'COUNT_RESULT',
        payload: countSolutions(board, message.payload.limit ?? 2),
      };
    }
    case 'TRACE': {
      const board = deserializeBoard(message.payload.definition);
      if (!board) {
        return { type: 'ERROR', payload: { message: 'Unable to deserialize puzzle definition.' } };
      }
      return { type: 'TRACE_RESULT', payload: traceHypothesis(board, message.payload.cell, message.payload.assumed) };
    }
  }
}

/** Handle a request envelope; solver exceptions become ERROR replies. */
export function handleRequest(request: WorkerRequest): WorkerResponse {
  try {
    return { id: request.id, reply: handleMessage(request.message) };
  } catch (error) {
    return {
      id: request.id,
      reply: { type: 'ERROR', payload: { message: error instanceof Error ? error.message : String(error) } },
    };
  }
}

function deserializeBoard(def: PuzzleDefinition): NonogramBoard | null {
  return new NonogramBoard({
    width: def.width,
    height: def.height,
    rowClues: def.rowClues,
    colClues: def.colClues,
    solution: def.solution,
    title: def.title,
  });
}

/** Test assuming `assumed` (`1` or `-1`) in `cell` and propagate 1D line DP until quiescence or conflict. */
function traceHypothesis(
  board: NonogramBoard,
  cell: number,
  assumed: 1 | -1,
): { conflict: boolean; deduced: 1 | -1 } | null {
  const work = board.clone();
  work.cells[cell] = assumed;

  for (let round = 0; round < 60; round++) {
    let changed = false;
    for (let r = 0; r < work.height; r++) {
      const dp = solveLineDP(work.rowClues[r], work.getLineCells('row', r));
      if (!dp.valid) {
        return { conflict: true, deduced: assumed === 1 ? -1 : 1 };
      }
      if (dp.newChanges.length > 0) {
        for (const ch of dp.newChanges) {
          work.cells[work.linePosToCell('row', r, ch.pos)] = ch.state;
        }
        changed = true;
      }
    }
    for (let c = 0; c < work.width; c++) {
      const dp = solveLineDP(work.colClues[c], work.getLineCells('col', c));
      if (!dp.valid) {
        return { conflict: true, deduced: assumed === 1 ? -1 : 1 };
      }
      if (dp.newChanges.length > 0) {
        for (const ch of dp.newChanges) {
          work.cells[work.linePosToCell('col', c, ch.pos)] = ch.state;
        }
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { conflict: false, deduced: assumed === 1 ? -1 : 1 };
}

export type { SolveAnalysis };
