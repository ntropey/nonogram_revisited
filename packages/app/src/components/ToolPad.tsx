/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Tool pad: paint tool, undo/reset, solve, and the puzzle generator controls.
 */
import { useState } from 'react';
import { LEVEL_NAMES } from '@nonogram/core';
import type { DifficultyLevel } from '@nonogram/core';
import type { Tool } from '../game';
import type { AppSettings } from '../types';

interface ToolPadProps {
  settings: AppSettings;
  onSetSettings: (s: AppSettings) => void;
  tool: Tool;
  onSetTool: (t: Tool) => void;
  hasGame: boolean;
  canUndo: boolean;
  busy: boolean;
  onGenerate: (size: number) => void;
  onSolve: () => void;
  onHint: () => void;
  onUndo: () => void;
  onReset: () => void;
}

export function ToolPad({
  settings,
  onSetSettings,
  tool,
  onSetTool,
  hasGame,
  canUndo,
  busy,
  onGenerate,
  onSolve,
  onHint,
  onUndo,
  onReset,
}: ToolPadProps) {
  const [size, setSize] = useState(10);
  return (
    <div className="toolpad">
      <div className="toolpad-group" role="group" aria-label="Paint tool">
        <div className="segmented">
          <button className={tool === 'fill' ? 'on' : ''} onClick={() => onSetTool('fill')} title="Fill (F)" aria-pressed={tool === 'fill'}>
            <span className="swatch fill" /> Fill
          </button>
          <button className={tool === 'cross' ? 'on' : ''} onClick={() => onSetTool('cross')} title="Cross out (X)" aria-pressed={tool === 'cross'}>
            <span className="swatch cross">×</span> Cross
          </button>
        </div>
        <button className="btn" onClick={onUndo} disabled={!canUndo || busy} title="Undo (Ctrl+Z)">Undo</button>
        <button className="btn" onClick={onReset} disabled={!hasGame || busy}>Reset</button>
        <button className="btn" onClick={onHint} disabled={!hasGame || busy} title="Show the next deduction (H)">Hint</button>
        <button className="btn" onClick={onSolve} disabled={!hasGame || busy} title="Fill the board using the solver">Solve</button>
      </div>
      <div className="toolpad-group generator">
        <label>
          Size
          <input
            type="number"
            min={5}
            max={30}
            value={size}
            onChange={(e) => setSize(Math.max(5, Math.min(30, Number(e.target.value) || 5)))}
          />
        </label>
        <label>
          Level
          <select
            value={settings.preferredDifficulty ?? ''}
            onChange={(e) =>
              onSetSettings({
                ...settings,
                preferredDifficulty: e.target.value === '' ? null : (Number(e.target.value) as DifficultyLevel),
              })
            }
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>{LEVEL_NAMES[l]}</option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={() => onGenerate(size)} disabled={busy}>
          {busy ? 'Working…' : 'New puzzle'}
        </button>
      </div>
    </div>
  );
}
