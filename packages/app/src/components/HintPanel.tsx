/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Side-panel card for the Coach (four staged hints), the Prover, mistakes, and "stuck".
 */
import { cellName } from '@nonogram/core';
import type { ContradictionTrace } from '@nonogram/core';
import { COACH_STAGES, coachText, provenState } from '../coach';
import type { Hint } from '../types';

const LEVEL_CLASS = ['', 'easy', 'medium', 'hard', 'unfair', 'extreme'];
const MAX_LISTED_MOVES = 8;

interface HintPanelProps {
  hint: Hint;
  width: number;
  onNext: () => void;
  onApply: () => void;
  onDismiss: () => void;
}

export function HintPanel({ hint, width, onNext, onApply, onDismiss }: HintPanelProps) {
  return (
    <div className="hint-panel" role="status">
      {hint.kind === 'step' && <CoachCard hint={hint} width={width} onNext={onNext} onApply={onApply} />}
      {hint.kind === 'proof' && <ProofCard hint={hint} width={width} onApply={onApply} />}
      {hint.kind === 'mistakes' && (
        <>
          <div className="hint-head">
            <strong>
              {hint.cells.length} {hint.cells.length === 1 ? 'cell doesn’t' : 'cells don’t'} match the solution
            </strong>
          </div>
          <p>They are marked in red on the board. Clear them, then ask again.</p>
          <div className="hint-actions">
            <button className="btn primary" onClick={onApply}>Clear them</button>
          </div>
        </>
      )}
      {hint.kind === 'stuck' && (
        <>
          <div className="hint-head"><strong>No further deduction found</strong></div>
          <p>The board is complete, or needs a technique this solver doesn’t have. Try Solve to see its progress.</p>
        </>
      )}
      <button className="btn ghost hint-close" onClick={onDismiss} aria-label="Dismiss hint" title="Dismiss">×</button>
    </div>
  );
}

function CoachCard({ hint, width, onNext, onApply }: Pick<HintPanelProps, 'width' | 'onNext' | 'onApply'> & { hint: Extract<Hint, { kind: 'step' }> }) {
  const { step, stage } = hint;
  const text = coachText(step, stage, width);
  return (
    <>
      <div className="hint-head">
        <span className="coach-label">Coach</span>
        <span className="stage-dots" aria-label={`Hint ${stage} of ${COACH_STAGES.length}`}>
          {COACH_STAGES.map((n) => (
            <i key={n} className={n <= stage ? 'on' : ''} />
          ))}
        </span>
        {stage >= 3 && <span className={`badge ${LEVEL_CLASS[step.level]}`}>Level {step.level}</span>}
      </div>
      <strong>{text.title}</strong>
      <p>{text.body}</p>
      <div className="hint-actions">
        {stage < 4 ? (
          <button className="btn primary" onClick={onNext}>{stage === 3 ? 'Show the move' : 'Another hint'}</button>
        ) : (
          <button className="btn primary" onClick={onApply}>Apply</button>
        )}
      </div>
    </>
  );
}

function ProofCard({ hint, width, onApply }: Pick<HintPanelProps, 'width' | 'onApply'> & { hint: Extract<Hint, { kind: 'proof' }> }) {
  const name = cellName(hint.cell, width);
  const proven = provenState(hint.fill, hint.cross);
  return (
    <>
      <div className="hint-head"><span className="coach-label">Prover</span><strong>{name}</strong></div>
      <TraceSection label={`Why not fill ${name}?`} trace={hint.fill} width={width} />
      <TraceSection label={`Why not cross out ${name}?`} trace={hint.cross} width={width} />
      {proven === null && (
        <p>
          {hint.fill && hint.cross
            ? 'Both choices break a line, so some mark on the board must be wrong.'
            : 'Neither choice breaks a line by simple line logic, so this cell can’t be settled this way yet.'}
        </p>
      )}
      {proven !== null && (
        <div className="hint-actions">
          <button className="btn primary" onClick={onApply}>
            {proven === 1 ? 'Fill it' : 'Cross it out'}
          </button>
        </div>
      )}
    </>
  );
}

function TraceSection({ label, trace, width }: { label: string; trace: ContradictionTrace | null; width: number }) {
  if (!trace) {
    return (
      <div className="trace">
        <div className="trace-q">{label}</div>
        <p className="trace-none">No contradiction found.</p>
      </div>
    );
  }
  const listed = trace.forcedMoves.slice(0, MAX_LISTED_MOVES);
  return (
    <div className="trace">
      <div className="trace-q">{label}</div>
      {listed.length > 0 && (
        <ol>
          {listed.map((m, i) => (
            <li key={i}>
              {m.reason.replace(/ = [#x]$/, ` = ${m.state === 1 ? '■' : '×'}`)}
            </li>
          ))}
        </ol>
      )}
      {trace.forcedMoves.length > listed.length && (
        <p className="trace-none">…and {trace.forcedMoves.length - listed.length} more.</p>
      )}
      <p>
        {trace.conflictLine.axis === 'row' ? 'Row' : 'Column'} {trace.conflictLine.index + 1} then has no valid placement, so{' '}
        {cellName(trace.cell, width)} must be {trace.deduced === 1 ? 'filled' : 'crossed out'}.
      </p>
    </div>
  );
}
