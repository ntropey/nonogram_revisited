/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * App-side message channel to the solver Web Worker. Keeps the UI thread free.
 */
import type { SolverPort, WorkerMessage, WorkerReply } from './protocol';
import type { GenerateOptions, PuzzleDefinition, SolveAnalysis, SolutionStep, TechniqueType } from '@nonogram/core';

export class SolverClient implements SolverPort {
  private worker: Worker;
  private handlers = new Map<string, (reply: unknown) => void>();
  private nextId = 0;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent) => {
      const { id, reply } = event.data as { id: string; reply: unknown };
      const handler = this.handlers.get(id);
      if (handler) {
        handler(reply);
        this.handlers.delete(id);
      }
    };
    this.worker.onerror = (error) => {
      console.error('Solver worker error:', error);
    };
  }

  /** Send a message and await the typed reply. */
  request<T>(message: Omit<WorkerMessage, 'id'> & { id?: never }): Promise<T> {
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      this.handlers.set(id, (reply) => {
        if ((reply as { type?: string })?.type === 'ERROR') {
          reject(new Error((reply as { payload?: { message?: string } }).payload?.message ?? 'Solver error'));
        } else {
          resolve(reply as T);
        }
      });
      this.worker.postMessage({ id, ...message } as unknown as WorkerMessage & { id: string });
    });
  }

  solve(definition: PuzzleDefinition): Promise<SolveAnalysis> {
    return this.request<SolveAnalysis>({ type: 'SOLVE', payload: { definition } });
  }

  nextStep(
    definition: PuzzleDefinition,
    disabledTechniques?: readonly TechniqueType[],
  ): Promise<SolutionStep | null> {
    return this.request<SolutionStep | null>({
      type: 'STEP',
      payload: { definition, disabledTechniques },
    });
  }

  generate(options: GenerateOptions): Promise<PuzzleDefinition> {
    return this.request<PuzzleDefinition>({ type: 'GENERATE', payload: { options } });
  }

  countSolutions(definition: PuzzleDefinition, limit = 2): Promise<number> {
    return this.request<number>({ type: 'COUNT_SOLUTIONS', payload: { definition, limit } });
  }

  /** Forward a raw message to the worker (SolverPort interface). */
  postMessage(message: WorkerMessage): void {
    this.worker.postMessage(message);
  }

  terminate(): void {
    this.worker.terminate();
  }

  onMessage(handler: (reply: WorkerReply) => void): void {
    // Not used by the promise-based client; kept for the SolverPort interface.
    void handler;
  }
}
