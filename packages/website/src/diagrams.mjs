/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Inline SVG diagrams for the guides: a line before/after, and a small grid.
 */
const C = {
  empty: '#1e293b',
  line: '#334155',
  filled: '#38bdf8',
  cross: '#94a3b8',
  focus: '#facc15',
  text: '#e2e8f0',
  muted: '#94a3b8',
};
const CELL = 30;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One cell: state 1 filled, -1 crossed, 0 unknown. `focus` outlines it as newly deduced. */
function cell(x, y, state, focus = false) {
  let out = `<rect x="${x + 0.5}" y="${y + 0.5}" width="${CELL - 1}" height="${CELL - 1}" rx="3" fill="${state === 1 ? C.filled : C.empty}" stroke="${C.line}"/>`;
  if (state === -1) {
    const a = x + 9;
    const b = x + CELL - 9;
    out += `<path d="M${a} ${y + 9}L${b} ${y + CELL - 9}M${b} ${y + 9}L${a} ${y + CELL - 9}" stroke="${C.cross}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (focus) {
    out += `<rect x="${x + 2}" y="${y + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="3" fill="none" stroke="${C.focus}" stroke-width="2.5"/>`;
  }
  return out;
}

function svg(width, height, label, inner) {
  return `<svg class="diagram" role="img" aria-label="${esc(label)}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function text(x, y, s, { size = 13, fill = C.text, anchor = 'start', weight = 600 } = {}) {
  return `<text x="${x}" y="${y}" font-family="system-ui,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}

/**
 * A single line shown twice: what you know, then what the technique deduces.
 * `before` is the known cells; `after` lists deduced cells as `{ pos, state }`.
 */
export function lineDiagram({ clues, before, after, label }) {
  const n = before.length;
  const left = 74;
  const next = before.map((s) => s);
  for (const d of after) next[d.pos] = d.state;
  const focus = new Set(after.map((d) => d.pos));
  const width = left + n * CELL + 4;
  const height = 2 * CELL + 46;
  let inner = text(0, 14, `Clue: ${clues.join(' ')}`, { size: 13, fill: C.muted });
  inner += text(0, 22 + CELL / 2 + 4, 'Known', { size: 12, fill: C.muted });
  inner += text(0, 22 + CELL + 14 + CELL / 2 + 4, 'Deduced', { size: 12, fill: C.muted });
  for (let i = 0; i < n; i++) {
    inner += cell(left + i * CELL, 22, before[i]);
    inner += cell(left + i * CELL, 22 + CELL + 14, next[i], focus.has(i));
  }
  return svg(width, height, label, inner);
}

/** A small grid with clues; `focus` cells (flat indices) are outlined. */
export function gridDiagram({ rows, cols, cells, focus = [], label }) {
  const h = rows.length;
  const w = cols.length;
  const rowGutter = Math.max(...rows.map((r) => r.length)) * 16 + 8;
  const colGutter = Math.max(...cols.map((c) => c.length)) * 16 + 6;
  const focusSet = new Set(focus);
  let inner = '';
  cols.forEach((clues, c) => {
    clues.forEach((n, i) => {
      inner += text(rowGutter + c * CELL + CELL / 2, colGutter - (clues.length - 1 - i) * 16 - 4, n, { size: 13, anchor: 'middle' });
    });
  });
  rows.forEach((clues, r) => {
    clues.forEach((n, i) => {
      inner += text(rowGutter - (clues.length - 1 - i) * 16 - 8, colGutter + r * CELL + CELL / 2 + 5, n, { size: 13, anchor: 'end' });
    });
  });
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      inner += cell(rowGutter + c * CELL, colGutter + r * CELL, cells[r * w + c], focusSet.has(r * w + c));
    }
  }
  return svg(rowGutter + w * CELL + 4, colGutter + h * CELL + 4, label, inner);
}
