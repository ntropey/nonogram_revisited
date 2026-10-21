import { describe, expect, it } from 'vitest';
import { SolverClient, type WorkerLike } from './solverClient';
import { handleRequest } from './solverApi';
import type { WorkerRequest } from './protocol';

/** A fake worker that runs the real handler synchronously-ish, like worker.ts does. */
function loopbackWorker(): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(request: WorkerRequest) {
      queueMicrotask(() => worker.onmessage?.({ data: handleRequest(request) } as MessageEvent));
    },
    terminate() {},
  };
  return worker;
}

describe('SolverClient round trip', () => {
  it('generates a puzzle and returns its definition', async () => {
    const client = new SolverClient(loopbackWorker());
    const def = await client.generate({ size: 5, seed: 1, maxAttempts: 200 });
    expect(def.width).toBe(5);
    expect(def.height).toBe(5);
    expect(def.rowClues).toHaveLength(5);
    expect(def.colClues).toHaveLength(5);
  });

  it('solves a generated puzzle and counts one solution', async () => {
    const client = new SolverClient(loopbackWorker());
    const def = await client.generate({ size: 5, seed: 2, maxAttempts: 200 });
    const analysis = await client.solve(def);
    expect(analysis.solved).toBe(true);
    expect(await client.countSolutions(def)).toBe(1);
  });

  it('rejects when the worker replies with an error', async () => {
    const client = new SolverClient(loopbackWorker());
    await expect(client.generate({ size: 0, seed: 1, maxAttempts: 1 })).rejects.toThrow();
  });

  it('rejects pending requests on terminate', async () => {
    const worker = loopbackWorker();
    worker.postMessage = () => {};
    const client = new SolverClient(worker);
    const pending = client.generate({ size: 5, seed: 1 });
    client.terminate();
    await expect(pending).rejects.toThrow('terminated');
  });
});

describe('SolverClient hints', () => {
  const def = { width: 2, height: 2, rowClues: [[2], [0]], colClues: [[1], [1]] };

  it('finds the next step from a blank board', async () => {
    const step = await new SolverClient(loopbackWorker()).nextStep(def);
    expect(step).not.toBeNull();
    expect(step!.changes.length).toBeGreaterThan(0);
  });

  it('returns null when the board is already complete', async () => {
    const step = await new SolverClient(loopbackWorker()).nextStep(def, [1, 1, -1, -1]);
    expect(step).toBeNull();
  });
});

describe('SolverClient prover', () => {
  const def = { width: 3, height: 1, rowClues: [[3]], colClues: [[1], [1], [1]] };

  it('returns the contradiction when crossing out a forced cell', async () => {
    const client = new SolverClient(loopbackWorker());
    const trace = await client.trace(def, [0, 0, 0], 0, -1);
    expect(trace).not.toBeNull();
    expect(trace!.deduced).toBe(1);
    expect(trace!.conflictLine).toEqual({ axis: 'row', index: 0 });
  });

  it('returns null when the assumption is consistent', async () => {
    expect(await new SolverClient(loopbackWorker()).trace(def, [0, 0, 0], 0, 1)).toBeNull();
  });
});
