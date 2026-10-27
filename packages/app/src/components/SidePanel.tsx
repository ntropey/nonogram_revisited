/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Side panel: library of saved / generated puzzles, plus training filters or solve analysis.
 */
import type { ReactNode } from 'react';
import { LEVEL_NAMES, TECHNIQUES_META } from '@nonogram/core';
import type { TechniqueType } from '@nonogram/core';
import type { AppSettings, StoredGame } from '../types';

export function SidePanel({
  games,
  activeId,
  settings,
  onSetSettings,
  onSelect,
  onDelete,
  children,
}: {
  games: StoredGame[];
  activeId: string | null;
  settings?: AppSettings;
  onSetSettings?: (s: AppSettings) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  children?: ReactNode;
}) {
  const isTrain = settings?.gameMode === 'train';

  const toggleTechnique = (type: TechniqueType) => {
    if (!settings || !onSetSettings) return;
    const current = new Set(settings.disabledTechniques ?? []);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    onSetSettings({
      ...settings,
      disabledTechniques: Array.from(current),
    });
  };

  return (
    <aside className="sidepanel">
      {children}

      {isTrain && settings && onSetSettings && (
        <div className="train-panel" style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
          <div className="hint-head" style={{ marginBottom: '8px' }}>
            <strong>Practice Techniques</strong>
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
            Uncheck techniques you want the Coach to skip so you can focus on others.
          </p>
          <div className="techniques-filter" style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
            {TECHNIQUES_META.map((t) => {
              const disabled = settings.disabledTechniques?.includes(t.type) ?? false;
              return (
                <label key={t.type} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!disabled}
                    onChange={() => toggleTechnique(t.type)}
                  />
                  <span>{t.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <h2>Library <span className="count">{games.length}</span></h2>
      {games.length === 0 && <p className="empty">Puzzles you generate are saved here.</p>}
      <ul>
        {games.map((g) => {
          const filled = g.cells.filter((c) => c === 1).length;
          const total = g.solution ? g.solution.reduce<number>((a, b) => a + b, 0) : 0;
          return (
            <li key={g.id} className={g.id === activeId ? 'active' : ''}>
              <button className="lib-item" onClick={() => onSelect(g.id)} title={g.title}>
                <span className="lib-top">
                  <span className="lib-title">{g.title}</span>
                  {g.solvedAt && <span className="lib-check" title="Solved">✓</span>}
                </span>
                <span className="lib-meta">
                  {g.width}×{g.height}
                  {g.level ? ` · ${LEVEL_NAMES[g.level]}` : ''}
                  {!g.solvedAt && total > 0 && filled > 0 ? ` · ${Math.min(100, Math.round((filled / total) * 100))}%` : ''}
                </span>
              </button>
              <button className="lib-del" onClick={() => onDelete(g.id)} title="Delete puzzle" aria-label={`Delete ${g.title}`}>×</button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
