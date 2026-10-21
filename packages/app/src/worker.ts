/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Web Worker entry: runs the pure solver/generator off the main thread.
 * `import.meta.url`-based worker is wired by Vite.
 */
import { handleMessage } from './solverApi';
import type { WorkerMessage, WorkerReply } from './protocol';

self.onmessage = (event: MessageEvent) => {
  const { id, message } = event.data as { id: string; message: WorkerMessage };
  let reply: WorkerReply;
  try {
    reply = handleMessage(message);
  } catch (error) {
    reply = {
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : String(error) },
    };
  }
  self.postMessage({ id, reply } as { id: string; reply: WorkerReply });
};
