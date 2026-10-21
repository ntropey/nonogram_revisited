/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Side panel: library of saved / generated puzzles.
 */
import type { StoredGame } from '../types';

export function SidePanel({
  games,
  active,
  setActive,
  setGames,
}: {
  games: StoredGame[];
  active: StoredGame | null;
  setActive: (g: StoredGame | null) => void;
  setGames: (gs: StoredGame[]) => void;
}) {
  return (
    <aside className="sidepanel">
      <h2>Library</h2>
      <ul>
        {games.map((g) => (
          <li key={g.id}>
            <button
              className={active?.id === g.id ? 'active' : ''}
              onClick={() => setActive(g)}
              title={`${g.title} (${g.width}x${g.height})`}
            >
              {g.title}
            </button>
          </li>
        ))}
      </ul>
      {games.length === 0 && <p className="empty">No puzzles yet. Generate one.</p>}
    </aside>
  );
}
