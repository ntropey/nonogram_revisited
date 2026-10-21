/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Web Worker entry: runs the pure solver/generator off the main thread.
 * `import.meta.url`-based worker is wired by Vite.
 */
import { handleRequest } from './solverApi';
import type { WorkerRequest } from './protocol';

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  self.postMessage(handleRequest(event.data));
};
