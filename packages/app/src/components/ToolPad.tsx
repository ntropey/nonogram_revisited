/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Tool pad: generate and solve actions.
 */
import { useState } from 'react';

export function ToolPad({
  onGenerate,
  onSolve,
}: {
  onGenerate: (size: number) => void;
  onSolve: () => void;
}) {
  const [size, setSize] = useState(10);
  return (
    <div className="toolpad">
      <div className="toolpad-group">
        <label>Size</label>
        <input
          type="number"
          min="5"
          max="30"
          value={size}
          onChange={(e) => setSize(Math.max(5, Math.min(30, Number(e.target.value) || 5)))}
        />
        <button className="btn primary" onClick={() => onGenerate(size)}>
          Generate Puzzle
        </button>
      </div>
      <div className="toolpad-group">
        <button className="btn" onClick={onSolve}>Solve (Worker)</button>
      </div>
    </div>
  );
}
