/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Nonogram board: one CSS grid holding the clue gutters and the cells, with drag painting.
 */
import { memo, useMemo, useRef, useState } from 'react';
import type { CellState, SolutionStep } from '@nonogram/core';
import { LEVEL_NAMES } from '@nonogram/core';
import { completedLines, lineBetween, strokeTarget } from '../game';
import type { Tool } from '../game';
import { playTick } from '../sound';
import type { StoredGame } from '../types';

interface BoardProps {
  game: StoredGame | null;
  hint: SolutionStep | null;
  mistakes: number[] | null;
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

export function Board({ game, hint, mistakes, tool, locked, showHighlights, sound, onStrokeStart, onPaint, onStrokeEnd, onNew }: BoardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const stroke = useRef<{ target: CellState; last: number } | null>(null);
  const done = useMemo(() => (game ? completedLines(game) : null), [game]);

  const marks = useMemo(() => buildMarks(hint, mistakes), [hint, mistakes]);

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
          <p>Generate a puzzle to start. Drag to paint, right-click to cross out.</p>
          <button className="btn primary" onClick={onNew}>Generate a puzzle</button>
        </div>
      </section>
    );
  }

  const { width, height } = game;
  const maxRowClues = Math.max(...game.rowClues.map((c) => c.length));
  const maxColClues = Math.max(...game.colClues.map((c) => c.length));
  const unitsW = width + maxRowClues * 0.9;
  const unitsH = height + maxColClues * 0.9;
  const hoverRow = hover === null ? -1 : Math.floor(hover / width);
  const hoverCol = hover === null ? -1 : hover % width;

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
        </div>
      </div>
      <div
        className={`board${locked ? ' locked' : ''}${game.solvedAt ? ' solved' : ''}`}
        style={{ '--units-w': unitsW, '--units-h': unitsH } as React.CSSProperties}
      >
        <div
          className="board-grid"
          style={{ gridTemplateColumns: `auto repeat(${width}, var(--cell))` }}
          role="grid"
          aria-label={`${game.title}, ${width} by ${height} nonogram`}
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
              className={`clue col${done.cols[c] ? ' done' : ''}${showHighlights && hoverCol === c ? ' hl' : ''}${guide(c, width) ? ' guide-r' : ''}`}
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
              hoverRow={showHighlights ? hoverRow : -1}
              hoverCol={showHighlights ? hoverCol : -1}
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
  marks: Record<number, string> | null;
  hoverRow: number;
  hoverCol: number;
}

/** One row (clue + cells). Re-renders only when its own cells or highlight change. */
const RowCells = memo(function RowCells({ r, width, clues, rowDone, guideBottom, cells, marks, hoverRow, hoverCol }: RowProps) {
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
        const cls = [
          'cell',
          state === 1 ? 'filled' : state === -1 ? 'crossed' : '',
          rowHl || hoverCol === c ? 'hl' : '',
          c % GUIDE_EVERY === GUIDE_EVERY - 1 && c < width - 1 ? 'guide-r' : '',
          guideBottom ? 'guide-b' : '',
          marks?.[idx] ?? '',
        ];
        return (
          <div
            key={c}
            role="gridcell"
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
  const start = a.r * a.width;
  for (let i = start; i < start + a.width; i++) if (a.cells[i] !== b.cells[i]) return false;
  return true;
}

/** Per-cell CSS classes for a hint step (tints, anchors, results) or flagged mistakes. */
function buildMarks(hint: SolutionStep | null, mistakes: number[] | null): Record<number, string> | null {
  if (!hint && !mistakes) return null;
  const out: Record<number, string> = {};
  if (mistakes) for (const c of mistakes) out[c] = 'mistake';
  if (hint) {
    for (const t of hint.marks.tint) for (const c of t.cells) out[c] = `tint-${t.tone}`;
    for (const m of hint.marks.fins) out[m.cell] = 'hint-fin';
    for (const m of hint.marks.key) out[m.cell] = 'hint-key';
    for (const m of hint.marks.elim) out[m.cell] = 'hint-elim';
    for (const m of hint.marks.place) out[m.cell] = 'hint-place';
    for (const ch of hint.changes) out[ch.cell] = ch.state === 1 ? 'hint-place' : 'hint-elim';
  }
  return out;
}
