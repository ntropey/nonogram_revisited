/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Nonogram board: one CSS grid holding the clue gutters and the cells, with drag painting,
 * crosshair header highlights, roving tabindex keyboard navigation, and zoom controls for large boards.
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { CellState } from '@nonogram/core';
import { LEVEL_NAMES } from '@nonogram/core';
import { completedLines, lineBetween, strokeTarget } from '../game';
import type { CellMarks } from '../coach';
import type { Tool } from '../game';
import { playTick } from '../sound';
import type { StoredGame } from '../types';

interface BoardProps {
  game: StoredGame | null;
  marks: CellMarks | null;
  /** When true, pressing a cell asks the Prover about it instead of painting. */
  probe: boolean;
  onProbe: (cell: number) => void;
  tool: Tool;
  locked: boolean;
  showHighlights: boolean;
  sound: boolean;
  onStrokeStart: () => void;
  onPaint: (cells: readonly number[], target: CellState) => void;
  onStrokeEnd: () => void;
  onNew: () => void;
}

const GUIDE_EVERY = 5;

export function Board({
  game,
  marks,
  probe,
  onProbe,
  tool,
  locked,
  showHighlights,
  sound,
  onStrokeStart,
  onPaint,
  onStrokeEnd,
  onNew,
}: BoardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const stroke = useRef<{ target: CellState; last: number } | null>(null);
  const done = useMemo(() => (game ? completedLines(game) : null), [game]);

  const paintSingle = useCallback(
    (cell: number, effectiveTool: Tool) => {
      if (!game || locked) return;
      if (probe) {
        onProbe(cell);
        return;
      }
      const target = strokeTarget(game.cells[cell], effectiveTool);
      onStrokeStart();
      onPaint([cell], target);
      onStrokeEnd();
      if (sound) playTick();
    },
    [game, locked, probe, onProbe, onStrokeStart, onPaint, onStrokeEnd, sound],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!game) return;
    const { width, height } = game;
    const r = Math.floor(selectedCell / width);
    const c = selectedCell % width;

    let nextCell = selectedCell;
    if (e.key === 'ArrowUp') {
      nextCell = r > 0 ? (r - 1) * width + c : selectedCell;
    } else if (e.key === 'ArrowDown') {
      nextCell = r < height - 1 ? (r + 1) * width + c : selectedCell;
    } else if (e.key === 'ArrowLeft') {
      nextCell = c > 0 ? r * width + (c - 1) : selectedCell;
    } else if (e.key === 'ArrowRight') {
      nextCell = c < width - 1 ? r * width + (c + 1) : selectedCell;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      paintSingle(selectedCell, tool);
      return;
    } else {
      return;
    }

    if (nextCell !== selectedCell) {
      e.preventDefault();
      setSelectedCell(nextCell);
      // Focus target cell element
      const el = document.querySelector(`[data-cell="${nextCell}"]`) as HTMLElement | null;
      el?.focus();
    }
  };

  if (!game || !done) {
    return (
      <section className="board-wrap">
        <div className="empty-state">
          <div className="empty-art" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} className={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].includes(i) ? 'on' : ''} />
            ))}
          </div>
          <h2>Ready when you are</h2>
          <p>Generate a puzzle to start. Drag to paint, right-click to cross out, or use arrow keys and Space.</p>
          <button className="btn primary" onClick={onNew}>Generate a puzzle</button>
        </div>
      </section>
    );
  }

  const { width, height } = game;
  const maxRowClues = Math.max(...game.rowClues.map((c) => c.length));
  const maxColClues = Math.max(...game.colClues.map((c) => c.length));
  const unitsW = (width + maxRowClues * 0.9) / zoomLevel;
  const unitsH = (height + maxColClues * 0.9) / zoomLevel;

  // Active crosshair highlight: prioritize hover, fall back to selected cell
  const activeFocus = hover !== null ? hover : selectedCell;
  const activeRow = activeFocus !== null ? Math.floor(activeFocus / width) : -1;
  const activeCol = activeFocus !== null ? activeFocus % width : -1;

  const cellAt = (e: React.PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const raw = el?.dataset.cell;
    return raw === undefined ? null : Number(raw);
  };

  const endStroke = () => {
    if (!stroke.current) return;
    stroke.current = null;
    onStrokeEnd();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (locked || e.button === 1) return;
    const cell = cellAt(e);
    if (cell === null) return;
    e.preventDefault();
    setSelectedCell(cell);
    if (probe) {
      onProbe(cell);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const effective: Tool = e.button === 2 ? 'cross' : tool;
    const target = strokeTarget(game.cells[cell], effective);
    stroke.current = { target, last: cell };
    onStrokeStart();
    onPaint([cell], target);
    if (sound) playTick();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cell = cellAt(e);
    if (cell !== hover && (cell !== null || e.pointerType === 'mouse')) setHover(cell);
    const s = stroke.current;
    if (!s || cell === null || cell === s.last) return;
    onPaint(lineBetween(s.last, cell, width), s.target);
    s.last = cell;
  };

  const guide = (i: number, n: number) => (i % GUIDE_EVERY === GUIDE_EVERY - 1 && i < n - 1 ? 1 : 0);

  return (
    <section className="board-wrap">
      <div className="board-head">
        <h2 className="board-title">{game.title}</h2>
        <div className="board-meta">
          {width}×{height}
          {game.level ? ` · ${LEVEL_NAMES[game.level]}` : ''}
          {width >= 15 && (
            <span className="zoom-controls">
              <button
                type="button"
                className={`zoom-btn${zoomLevel === 1 ? ' on' : ''}`}
                onClick={() => setZoomLevel(1)}
                title="Fit board"
                aria-label="Fit board"
              >
                1×
              </button>
              <button
                type="button"
                className={`zoom-btn${zoomLevel === 1.4 ? ' on' : ''}`}
                onClick={() => setZoomLevel(1.4)}
                title="Zoom in 1.4x"
                aria-label="Zoom in 1.4x"
              >
                1.4×
              </button>
            </span>
          )}
        </div>
      </div>
      <div
        className={`board${locked ? ' locked' : ''}${probe ? ' probing' : ''}${game.solvedAt ? ' solved' : ''}`}
        style={{ '--units-w': unitsW, '--units-h': unitsH } as React.CSSProperties}
      >
        <div
          className="board-grid"
          style={{ gridTemplateColumns: `auto repeat(${width}, var(--cell))` }}
          role="grid"
          tabIndex={0}
          aria-label={`${game.title}, ${width} by ${height} nonogram grid. Use arrow keys to navigate, Space or Enter to paint.`}
          onKeyDown={handleKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="corner" style={{ minHeight: `calc(var(--clue) * ${maxColClues})` }} />
          {game.colClues.map((clues, c) => (
            <div
              key={c}
              className={`clue col${done.cols[c] ? ' done' : ''}${showHighlights && activeCol === c ? ' hl' : ''}${guide(c, width) ? ' guide-r' : ''}`}
            >
              {clues.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          ))}
          {game.rowClues.map((clues, r) => (
            <RowCells
              key={r}
              r={r}
              width={width}
              clues={clues}
              rowDone={done.rows[r]}
              guideBottom={guide(r, height) === 1}
              cells={game.cells}
              marks={marks}
              hoverRow={showHighlights ? activeRow : -1}
              hoverCol={showHighlights ? activeCol : -1}
              selectedCell={selectedCell}
            />
          ))}
        </div>
      </div>
      {game.solvedAt && (
        <div className="solved-banner" role="status">
          <strong>Solved!</strong>
          <button className="btn primary" onClick={onNew}>Next puzzle</button>
        </div>
      )}
    </section>
  );
}

interface RowProps {
  r: number;
  width: number;
  clues: number[];
  rowDone: boolean;
  guideBottom: boolean;
  cells: CellState[];
  marks: CellMarks | null;
  hoverRow: number;
  hoverCol: number;
  selectedCell: number;
}

/** One row (clue + cells). Re-renders only when its own cells or highlight change. */
const RowCells = memo(function RowCells({
  r,
  width,
  clues,
  rowDone,
  guideBottom,
  cells,
  marks,
  hoverRow,
  hoverCol,
  selectedCell,
}: RowProps) {
  const rowHl = hoverRow === r;
  return (
    <>
      <div className={`clue row${rowDone ? ' done' : ''}${rowHl ? ' hl' : ''}${guideBottom ? ' guide-b' : ''}`}>
        {clues.map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      {Array.from({ length: width }, (_, c) => {
        const idx = r * width + c;
        const state = cells[idx];
        const isSelected = selectedCell === idx;
        const cls = [
          'cell',
          state === 1 ? 'filled' : state === -1 ? 'crossed' : '',
          rowHl || hoverCol === c ? 'hl' : '',
          c % GUIDE_EVERY === GUIDE_EVERY - 1 && c < width - 1 ? 'guide-r' : '',
          guideBottom ? 'guide-b' : '',
          isSelected ? 'focused' : '',
          marks?.[idx] ?? '',
        ];
        return (
          <div
            key={c}
            role="gridcell"
            tabIndex={isSelected ? 0 : -1}
            data-cell={idx}
            className={cls.filter(Boolean).join(' ')}
            aria-label={`row ${r + 1} column ${c + 1}: ${state === 1 ? 'filled' : state === -1 ? 'crossed out' : 'empty'}`}
          />
        );
      })}
    </>
  );
}, rowPropsEqual);

function rowPropsEqual(a: RowProps, b: RowProps): boolean {
  if (a.r !== b.r || a.width !== b.width || a.rowDone !== b.rowDone || a.guideBottom !== b.guideBottom) return false;
  if (a.clues !== b.clues || a.marks !== b.marks) return false;
  const rowHlChanged = (a.hoverRow === a.r) !== (b.hoverRow === b.r);
  if (rowHlChanged || a.hoverCol !== b.hoverCol) return false;
  const selChanged = (Math.floor(a.selectedCell / a.width) === a.r) !== (Math.floor(b.selectedCell / b.width) === b.r) ||
                     (a.selectedCell === a.r * a.width + (a.selectedCell % a.width)) !== (b.selectedCell === b.r * b.width + (b.selectedCell % b.width));
  if (selChanged && (Math.floor(a.selectedCell / a.width) === a.r || Math.floor(b.selectedCell / b.width) === b.r)) return false;
  const start = a.r * a.width;
  for (let i = start; i < start + a.width; i++) if (a.cells[i] !== b.cells[i]) return false;
  return true;
}
