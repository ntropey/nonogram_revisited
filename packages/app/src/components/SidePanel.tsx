/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Side panel: library of saved / generated puzzles.
 */
import { LEVEL_NAMES } from '@nonogram/core';
import type { StoredGame } from '../types';

export function SidePanel({
  games,
  activeId,
  onSelect,
  onDelete,
}: {
  games: StoredGame[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="sidepanel">
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
