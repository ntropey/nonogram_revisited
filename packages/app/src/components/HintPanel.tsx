/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Hint panel: explains the solver's next deduction, or flags cells that contradict the solution.
 */
import { cellNames } from '@nonogram/core';
import type { Hint } from '../types';

const LEVEL_CLASS = ['', 'easy', 'medium', 'hard', 'unfair', 'extreme'];

export function HintPanel({
  hint,
  width,
  onApply,
  onDismiss,
}: {
  hint: Hint;
  width: number;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="hint-panel" role="status">
      {hint.kind === 'step' && (
        <>
          <div className="hint-head">
            <strong>{hint.step.name}</strong>
            <span className={`badge ${LEVEL_CLASS[hint.step.level]}`}>Level {hint.step.level}</span>
          </div>
          <p>{hint.step.reason}</p>
          <p className="hint-changes">
            {hint.step.changes.length} {hint.step.changes.length === 1 ? 'cell' : 'cells'}:{' '}
            {cellNames(hint.step.changes.map((c) => c.cell), width)}
          </p>
        </>
      )}
      {hint.kind === 'mistakes' && (
        <>
          <div className="hint-head">
            <strong>
              {hint.cells.length} {hint.cells.length === 1 ? 'cell doesn’t' : 'cells don’t'} match the solution
            </strong>
          </div>
          <p>They are outlined in red on the board. Clear them, then ask for a hint again.</p>
        </>
      )}
      {hint.kind === 'stuck' && (
        <>
          <div className="hint-head"><strong>No further deduction found</strong></div>
          <p>The board is complete, or needs a technique this solver doesn’t have. Try Solve to see its progress.</p>
        </>
      )}
      <div className="hint-actions">
        {hint.kind === 'step' && <button className="btn primary" onClick={onApply}>Apply</button>}
        {hint.kind === 'mistakes' && <button className="btn primary" onClick={onApply}>Clear them</button>}
        <button className="btn" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}
