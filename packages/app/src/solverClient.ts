/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * App-side message channel to the solver Web Worker. Keeps the UI thread free.
 */
import type { WorkerMessage, WorkerReply, WorkerRequest, WorkerResponse } from './protocol';
import type { CellState, GenerateOptions, PuzzleDefinition, SolveAnalysis, SolutionStep, TechniqueType } from '@nonogram/core';

/** The slice of `Worker` the client needs; lets tests inject a fake. */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: WorkerRequest): void;
  terminate(): void;
}

type Payload<T extends WorkerReply['type']> = (WorkerReply & { type: T })['payload'];

interface Pending {
  resolve: (reply: WorkerReply) => void;
  reject: (error: Error) => void;
}

export class SolverClient {
  private worker: WorkerLike;
  private pending = new Map<string, Pending>();
  private nextId = 0;

  constructor(worker?: WorkerLike) {
    this.worker =
      worker ??
      (new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike);
    this.worker.onmessage = (event) => {
      const { id, reply } = event.data;
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      if (reply.type === 'ERROR') entry.reject(new Error(reply.payload.message));
      else entry.resolve(reply);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Solver worker crashed');
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
    };
  }

  /** Send a message and resolve with the reply payload of the expected type. */
  private request<T extends WorkerReply['type']>(message: WorkerMessage, expected: T): Promise<Payload<T>> {
    const id = String(this.nextId++);
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (reply) => {
          if (reply.type === expected) resolve(reply.payload);
          else reject(new Error(`Unexpected solver reply ${reply.type}`));
        },
        reject,
      });
      this.worker.postMessage({ id, message });
    }) as Promise<Payload<T>>;
  }

  solve(definition: PuzzleDefinition): Promise<SolveAnalysis> {
    return this.request({ type: 'SOLVE', payload: { definition } }, 'SOLVE_RESULT');
  }

  nextStep(
    definition: PuzzleDefinition,
    cells?: readonly CellState[],
    disabledTechniques?: readonly TechniqueType[],
  ): Promise<SolutionStep | null> {
    return this.request({ type: 'STEP', payload: { definition, cells, disabledTechniques } }, 'STEP_RESULT');
  }

  generate(options: GenerateOptions): Promise<PuzzleDefinition> {
    return this.request({ type: 'GENERATE', payload: { options } }, 'GENERATE_RESULT');
  }

  countSolutions(definition: PuzzleDefinition, limit = 2): Promise<number> {
    return this.request({ type: 'COUNT_SOLUTIONS', payload: { definition, limit } }, 'COUNT_RESULT');
  }

  trace(definition: PuzzleDefinition, cell: number, assumed: 1 | -1) {
    return this.request({ type: 'TRACE', payload: { definition, cell, assumed } }, 'TRACE_RESULT');
  }

  terminate(): void {
    const error = new Error('Solver terminated');
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
    this.worker.terminate();
  }
}
