/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Message shapes shared between solverClient.ts, worker.ts, and solverApi.ts.
 */
import type {
  CellState,
  ContradictionTrace,
  GenerateOptions,
  PuzzleDefinition,
  SolveAnalysis,
  SolutionStep,
  TechniqueType,
} from '@nonogram/core';

export type WorkerMessage =
  | { type: 'SOLVE'; payload: { definition: PuzzleDefinition } }
  | {
      type: 'STEP';
      payload: { definition: PuzzleDefinition; cells?: readonly CellState[]; disabledTechniques?: readonly TechniqueType[] };
    }
  | { type: 'GENERATE'; payload: { options: GenerateOptions } }
  | { type: 'DAILY'; payload: { date: string; size?: number } }
  | { type: 'COUNT_SOLUTIONS'; payload: { definition: PuzzleDefinition; limit?: number } }
  | {
      type: 'TRACE';
      payload: { definition: PuzzleDefinition; cells?: readonly CellState[]; cell: number; assumed: 1 | -1 };
    };

export type WorkerReply =
  | { type: 'SOLVE_RESULT'; payload: SolveAnalysis }
  | { type: 'STEP_RESULT'; payload: SolutionStep | null }
  | { type: 'GENERATE_RESULT'; payload: PuzzleDefinition }
  | { type: 'COUNT_RESULT'; payload: number }
  | { type: 'TRACE_RESULT'; payload: ContradictionTrace | null }
  | { type: 'ERROR'; payload: { message: string } };

/** What the client posts to the worker. */
export interface WorkerRequest {
  id: string;
  message: WorkerMessage;
}

/** What the worker posts back. */
export interface WorkerResponse {
  id: string;
  reply: WorkerReply;
}
