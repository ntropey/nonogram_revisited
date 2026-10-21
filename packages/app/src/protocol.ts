/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Message shapes shared between solverClient.ts, worker.ts, and solverApi.ts.
 */
import type {
  CellState,
  GenerateOptions,
  PuzzleDefinition,
  SolveAnalysis,
  SolutionStep,
  TechniqueType,
} from '@nonogram/core';

export type WorkerMessage =
  | { type: 'SOLVE'; payload: { definition: PuzzleDefinition } }
  | { type: 'STEP'; payload: { definition: PuzzleDefinition; disabledTechniques?: readonly TechniqueType[] } }
  | { type: 'GENERATE'; payload: { options: GenerateOptions } }
  | { type: 'COUNT_SOLUTIONS'; payload: { definition: PuzzleDefinition; limit?: number } }
  | { type: 'TRACE'; payload: { definition: PuzzleDefinition; cell: number; assumed: 1 | -1 } };

export type WorkerReply =
  | { type: 'SOLVE_RESULT'; payload: SolveAnalysis }
  | { type: 'STEP_RESULT'; payload: SolutionStep | null }
  | { type: 'GENERATE_RESULT'; payload: PuzzleDefinition }
  | { type: 'COUNT_RESULT'; payload: number }
  | { type: 'TRACE_RESULT'; payload: { conflict: boolean; deduced: 1 | -1 } | null }
  | { type: 'ERROR'; payload: { message: string } };

export interface SolverPort {
  postMessage(message: WorkerMessage): void;
  onMessage(handler: (reply: WorkerReply) => void): void;
  terminate(): void;
}
