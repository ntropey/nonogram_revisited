/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Nonogram board: grid of fillable/crossable cells with row and column clues.
 */
import type { CellState } from '@nonogram/core';
import type { PuzzleDefinition } from '@nonogram/core';

interface BoardProps {
  game: { width: number; height: number; rowClues: number[][]; colClues: number[][]; cells: CellState[]; title: string } | null;
  definition: PuzzleDefinition | null;
  onToggleCell: (cell: number) => void;
  settings: { showHighlights: boolean };
}

export function Board({ game, definition, onToggleCell, settings }: BoardProps) {
  if (!game) return <div className="board-placeholder">No puzzle loaded. Generate one.</div>;

  const cell = (r: number, c: number) => game.cells[r * game.width + c];

  return (
    <section className="board-wrap">
      <div className="board-title">{game.title || 'Untitled'}</div>
      <div className="clues-cols">
        {game.colClues.map((clues, c) => (
          <div key={c} className="clue-col">
            {clues.map((n, i) => (
              <div key={i} className="clue-cell">
                {n === 0 ? '0' : n}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="board-grid" style={gridStyle(game.width)}>
        {game.rowClues.map((rowClues, r) => (
          <div key={r} className="row-wrap">
            <div className="clue-row">
              {rowClues.map((n, i) => (
                <div key={i} className="clue-cell">{n === 0 ? '0' : n}</div>
              ))}
            </div>
            <div className="cell-row">
              {Array.from({ length: game.width }, (_, c) => (
                <button
                  key={c}
                  className={cellClass(cell(r, c), settings.showHighlights)}
                  onClick={() => onToggleCell(r * game.width + c)}
                  title={`r${r + 1}c${c + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function gridStyle(width: number) {
  return { gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` };
}

function cellClass(state: CellState, highlights: boolean) {
  const base = 'cell';
  if (state === 1) return `${base} filled${highlights ? ' highlight' : ''}`;
  if (state === -1) return `${base} crossed${highlights ? ' highlight' : ''}`;
  return base;
}