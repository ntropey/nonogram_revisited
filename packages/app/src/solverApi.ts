/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Pure solver wrapper: exposes the core engine to the worker without any DOM/Node APIs.
 */
import {
  NonogramBoard,
  NonogramStepFinder,
  analyzePuzzle,
  countSolutions,
  dailyPuzzle,
  generatePuzzle,
  traceHypothesis,
} from '@nonogram/core';
import type { CellState, PuzzleDefinition, SolveAnalysis } from '@nonogram/core';
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
      const board = deserializeBoard(message.payload.definition, message.payload.cells);
      if (!board) {
        return { type: 'ERROR', payload: { message: 'Unable to deserialize puzzle definition.' } };
      }
      const disabled = message.payload.disabledTechniques
        ? new Set(message.payload.disabledTechniques)
        : undefined;
      return {
        type: 'STEP_RESULT',
        payload: new NonogramStepFinder().findNextStep(board, { disabledTechniques: disabled }),
      };
    }
    case 'DAILY': {
      const board = dailyPuzzle(message.payload.date, message.payload.size);
      return { type: 'GENERATE_RESULT', payload: board.toDefinition() };
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
      const board = deserializeBoard(message.payload.definition, message.payload.cells);
      if (!board) {
        return { type: 'ERROR', payload: { message: 'Unable to deserialize puzzle definition.' } };
      }
      return {
        type: 'TRACE_RESULT',
        payload: traceHypothesis(board, message.payload.cell, message.payload.assumed),
      };
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

function deserializeBoard(def: PuzzleDefinition, cells?: readonly CellState[]): NonogramBoard | null {
  return new NonogramBoard({
    cells,
    width: def.width,
    height: def.height,
    rowClues: def.rowClues,
    colClues: def.colClues,
    solution: def.solution,
    title: def.title,
  });
}

export type { SolveAnalysis };
