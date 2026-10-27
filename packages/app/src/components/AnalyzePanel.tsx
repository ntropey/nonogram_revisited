/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Analyze panel: shows puzzle rating and step-by-step human solver deduction trail.
 */
import { LEVEL_NAMES, TECHNIQUES_META } from '@nonogram/core';
import type { SolveAnalysis, SolutionStep } from '@nonogram/core';

interface AnalyzePanelProps {
  analysis: SolveAnalysis | null;
  loading: boolean;
  selectedStep: number | null;
  onSelectStep: (stepIndex: number | null) => void;
}

export function AnalyzePanel({
  analysis,
  loading,
  selectedStep,
  onSelectStep,
}: AnalyzePanelProps) {
  if (loading) {
    return (
      <div className="analyze-panel" role="status" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
        <div className="hint-head"><strong>Analyzing puzzle…</strong></div>
        <p className="text-muted" style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>
          Finding complete step-by-step solution path.
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="analyze-panel" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
        <div className="hint-head"><strong>Solver Analysis</strong></div>
        <p className="text-muted" style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>
          Select or load a puzzle to inspect the full step-by-step human solve sequence.
        </p>
      </div>
    );
  }

  const levelName = analysis.level ? LEVEL_NAMES[analysis.level] : 'Unrated';
  const steps = analysis.steps ?? [];

  return (
    <div className="analyze-panel" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
      <div className="hint-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Solve Analysis</strong>
        <span className={`pill level-${analysis.level ?? 'unrated'}`} style={{ fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          {levelName} ({analysis.score ?? 0} pts)
        </span>
      </div>
      <p style={{ margin: '6px 0 10px 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
        {analysis.solved
          ? `Solved in ${steps.length} logical step${steps.length === 1 ? '' : 's'}.`
          : 'Could not be completely deduced by logical techniques alone.'}
      </p>

      {steps.length > 0 && (
        <div className="steps-list" style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {steps.map((step: SolutionStep, idx: number) => {
            const isSelected = selectedStep === idx;
            const changesCount = step.changes.length;
            return (
              <button
                key={idx}
                type="button"
                className={`step-item ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectStep(isSelected ? null : idx)}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <strong>#{idx + 1}</strong> {TECHNIQUES_META.find(t => t.type === step.type)?.name ?? step.type}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                  {changesCount} {changesCount === 1 ? 'cell' : 'cells'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
