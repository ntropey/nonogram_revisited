/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Unit tests for features: daily puzzle generation, URL serializing/deserializing, and modes/store.
 */
import { describe, expect, it } from 'vitest';
import { SolverClient, type WorkerLike } from './solverClient';
import { handleRequest } from './solverApi';
import type { WorkerRequest } from './protocol';
import { deserializePuzzle, serializePuzzle, NonogramBoard } from '@nonogram/core';
import { loadDailyStats, loadMode, saveDailyStats, saveMode } from './store';

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

describe('Daily puzzle via Worker bridge', () => {
  it('generates a deterministic daily puzzle for a given UTC date', async () => {
    const client = new SolverClient(loopbackWorker());
    const puzzleA = await client.daily('2026-10-27', 10);
    const puzzleB = await client.daily('2026-10-27', 10);

    expect(puzzleA.width).toBe(10);
    expect(puzzleA.height).toBe(10);
    expect(puzzleA.rowClues).toEqual(puzzleB.rowClues);
    expect(puzzleA.colClues).toEqual(puzzleB.colClues);
  });
});

describe('Puzzle serialization and URL parameters', () => {
  it('serializes a board to compact string and round-trips via deserializePuzzle', () => {
    const board = new NonogramBoard({
      width: 3,
      height: 3,
      rowClues: [[1], [3], [1]],
      colClues: [[1], [3], [1]],
      title: 'Diamond',
    });

    const serialized = serializePuzzle(board);
    expect(serialized).toBeTruthy();

    const deserialized = deserializePuzzle(serialized);
    expect(deserialized).not.toBeNull();
    expect(deserialized!.width).toBe(3);
    expect(deserialized!.height).toBe(3);
    expect(deserialized!.rowClues).toEqual([[1], [3], [1]]);
    expect(deserialized!.colClues).toEqual([[1], [3], [1]]);
  });

  it('handles simulated ?p= parameter parsing', () => {
    const board = new NonogramBoard({
      width: 5,
      height: 5,
      rowClues: [[5], [1, 1], [1, 1], [1, 1], [5]],
      colClues: [[5], [1, 1], [1, 1], [1, 1], [5]],
      title: 'Square Box',
    });

    const serialized = serializePuzzle(board);
    const fakeSearch = `?p=${encodeURIComponent(serialized)}`;
    const params = new URLSearchParams(fakeSearch);
    const paramP = params.get('p');
    expect(paramP).toBeTruthy();

    const parsedBoard = deserializePuzzle(paramP!);
    expect(parsedBoard).not.toBeNull();
    expect(parsedBoard!.width).toBe(5);
    expect(parsedBoard!.height).toBe(5);
    expect(parsedBoard!.rowClues[0]).toEqual([5]);
  });
});

describe('Game modes and daily stats storage', () => {
  it('saves and loads game mode', () => {
    saveMode('train');
    expect(loadMode()).toBe('train');
    saveMode('analyze');
    expect(loadMode()).toBe('analyze');
    saveMode('play');
    expect(loadMode()).toBe('play');
  });

  it('saves and loads daily completion stats and streak', () => {
    const stats = {
      lastCompletedDate: '2026-10-27',
      streak: 5,
      history: {
        '2026-10-27': { seconds: 120, hintsUsed: 0 },
      },
    };
    saveDailyStats(stats);
    const loaded = loadDailyStats();
    expect(loaded.lastCompletedDate).toBe('2026-10-27');
    expect(loaded.streak).toBe(5);
    expect(loaded.history['2026-10-27'].seconds).toBe(120);
  });
});
