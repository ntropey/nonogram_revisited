/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Board model, coordinate formatting, clue extraction, and text/URL serialization.
 */
import type { CellState, LineAxis, LineRef, PuzzleDefinition, StepMarks } from './types';

export function emptyMarks(): StepMarks {
  return { key: [], place: [], elim: [], fins: [], tint: [], chains: [], clues: [] };
}

export function cellCoordName(r: number, c: number): string {
  return `r${r + 1}c${c + 1}`;
}

export function cellName(cell: number, width: number): string {
  const r = Math.floor(cell / width);
  const c = cell % width;
  return `r${r + 1}c${c + 1}`;
}

export function cellNames(cells: readonly number[], width: number): string {
  return [...new Set(cells)].map((c) => cellName(c, width)).join(', ');
}

export function parseCellName(
  text: string,
  width: number,
  height: number,
): { r: number; c: number; cell: number } | null {
  const m = /^\s*r(\d+)c(\d+)\s*$/i.exec(text);
  if (!m) return null;
  const r = Number(m[1]) - 1;
  const c = Number(m[2]) - 1;
  if (r < 0 || r >= height || c < 0 || c >= width) return null;
  return { r, c, cell: r * width + c };
}

export function lineName(line: LineRef): string {
  return line.axis === 'row' ? `Row ${line.index + 1}` : `Column ${line.index + 1}`;
}

export function lineShortName(line: LineRef): string {
  return line.axis === 'row' ? `R${line.index + 1}` : `C${line.index + 1}`;
}

/** Normalize a clue array so an empty line is always represented as `[0]`. */
export function normalizeClues(clues: readonly number[]): number[] {
  const filtered = clues.filter((n) => n > 0);
  return filtered.length > 0 ? filtered : [0];
}

/** Compute the Nonogram clue numbers for a 1D line of cells (where `1` is filled and anything else is empty). */
export function computeCluesFromLine(cells: readonly number[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 1) {
      run++;
    } else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues.length > 0 ? clues : [0];
}

/** Return true if two normalized clue arrays are identical. */
export function cluesEqual(a: readonly number[], b: readonly number[]): boolean {
  const na = normalizeClues(a);
  const nb = normalizeClues(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    if (na[i] !== nb[i]) return false;
  }
  return true;
}

export class NonogramBoard {
  readonly width: number;
  readonly height: number;
  readonly rowClues: number[][];
  readonly colClues: number[][];
  readonly cells: CellState[];
  readonly solution?: (0 | 1)[];
  readonly title?: string;

  constructor(def: {
    width: number;
    height: number;
    rowClues: readonly (readonly number[])[];
    colClues: readonly (readonly number[])[];
    cells?: readonly CellState[];
    solution?: readonly (0 | 1)[];
    title?: string;
  }) {
    if (def.width < 1 || def.height < 1) {
      throw new Error(`Invalid board dimensions: ${def.width}x${def.height}`);
    }
    if (def.rowClues.length !== def.height || def.colClues.length !== def.width) {
      throw new Error(
        `Clue count mismatch: expected ${def.height} rows and ${def.width} cols, got ${def.rowClues.length} and ${def.colClues.length}`,
      );
    }
    this.width = def.width;
    this.height = def.height;
    this.rowClues = def.rowClues.map(normalizeClues);
    this.colClues = def.colClues.map(normalizeClues);
    this.cells = def.cells
      ? [...def.cells]
      : new Array<CellState>(def.width * def.height).fill(0);
    if (def.solution && def.solution.length === def.width * def.height) {
      this.solution = [...def.solution];
    }
    this.title = def.title;
  }

  static fromBitmap(
    width: number,
    height: number,
    bitmap: readonly (0 | 1)[],
    title?: string,
  ): NonogramBoard {
    if (bitmap.length !== width * height) {
      throw new Error(`Bitmap length ${bitmap.length} does not match ${width}x${height}`);
    }
    const rowClues: number[][] = [];
    for (let r = 0; r < height; r++) {
      const row: number[] = [];
      for (let c = 0; c < width; c++) row.push(bitmap[r * width + c]);
      rowClues.push(computeCluesFromLine(row));
    }
    const colClues: number[][] = [];
    for (let c = 0; c < width; c++) {
      const col: number[] = [];
      for (let r = 0; r < height; r++) col.push(bitmap[r * width + c]);
      colClues.push(computeCluesFromLine(col));
    }
    return new NonogramBoard({
      width,
      height,
      rowClues,
      colClues,
      solution: bitmap,
      title,
    });
  }

  clone(): NonogramBoard {
    return new NonogramBoard({
      width: this.width,
      height: this.height,
      rowClues: this.rowClues,
      colClues: this.colClues,
      cells: this.cells,
      solution: this.solution,
      title: this.title,
    });
  }

  cellIndex(r: number, c: number): number {
    return r * this.width + c;
  }

  rowOf(cell: number): number {
    return Math.floor(cell / this.width);
  }

  colOf(cell: number): number {
    return cell % this.width;
  }

  getCell(r: number, c: number): CellState {
    return this.cells[r * this.width + c];
  }

  setCell(r: number, c: number, state: CellState): void {
    this.cells[r * this.width + c] = state;
  }

  getClues(axis: LineAxis, index: number): readonly number[] {
    return axis === 'row' ? this.rowClues[index] : this.colClues[index];
  }

  getLineLength(axis: LineAxis): number {
    return axis === 'row' ? this.width : this.height;
  }

  getLineIndices(axis: LineAxis, index: number): number[] {
    const out: number[] = [];
    if (axis === 'row') {
      const base = index * this.width;
      for (let c = 0; c < this.width; c++) out.push(base + c);
    } else {
      for (let r = 0; r < this.height; r++) out.push(r * this.width + index);
    }
    return out;
  }

  getLineCells(axis: LineAxis, index: number): CellState[] {
    if (axis === 'row') {
      const base = index * this.width;
      return this.cells.slice(base, base + this.width);
    }
    const out: CellState[] = [];
    for (let r = 0; r < this.height; r++) {
      out.push(this.cells[r * this.width + index]);
    }
    return out;
  }

  setLineCell(axis: LineAxis, lineIndex: number, posInLine: number, state: CellState): void {
    const idx = axis === 'row' ? lineIndex * this.width + posInLine : posInLine * this.width + lineIndex;
    this.cells[idx] = state;
  }

  linePosToCell(axis: LineAxis, lineIndex: number, posInLine: number): number {
    return axis === 'row' ? lineIndex * this.width + posInLine : posInLine * this.width + lineIndex;
  }

  /**
   * Returns true if every row and column's placed `FILLED` (`1`) cells match its clues.
   * Note: a player does not need to cross out every empty cell (`-1`) to win if all filled blocks match.
   */
  isSolved(): boolean {
    for (let r = 0; r < this.height; r++) {
      const actual = computeCluesFromLine(this.getLineCells('row', r));
      if (!cluesEqual(actual, this.rowClues[r])) return false;
    }
    for (let c = 0; c < this.width; c++) {
      const actual = computeCluesFromLine(this.getLineCells('col', c));
      if (!cluesEqual(actual, this.colClues[c])) return false;
    }
    return true;
  }

  /** Returns the count of cells still in state `0` (`UNKNOWN`). */
  unknownCount(): number {
    let count = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === 0) count++;
    }
    return count;
  }

  toDefinition(): PuzzleDefinition {
    return {
      width: this.width,
      height: this.height,
      rowClues: this.rowClues.map((r) => [...r]),
      colClues: this.colClues.map((c) => [...c]),
      solution: this.solution ? [...this.solution] : undefined,
      title: this.title,
    };
  }
}

/**
 * Serialize a NonogramBoard (clues and optional current cell states) into a URL-safe compact string.
 * Format: `<W>x<H>:<rowClues joined by '/' with ',' inside>:<colClues joined by '/' with ',' inside>[:<stateChars>]`
 * where stateChars uses `.` for 0, `#` (or `1`) for 1, and `x` (or `-`) for -1.
 */
export function serializePuzzle(board: NonogramBoard, includeState = false): string {
  const rows = board.rowClues.map((r) => r.join(',')).join('/');
  const cols = board.colClues.map((c) => c.join(',')).join('/');
  const base = `${board.width}x${board.height}:${rows}:${cols}`;
  if (!includeState || board.cells.every((c) => c === 0)) {
    return base;
  }
  const stateStr = board.cells.map((c) => (c === 1 ? '1' : c === -1 ? 'x' : '.')).join('');
  return `${base}:${stateStr}`;
}

/**
 * Deserialize a compact puzzle string or ASCII/bitmap representation into a `NonogramBoard`.
 */
export function deserializePuzzle(raw: string): NonogramBoard | null {
  const text = raw.trim();
  if (!text) return null;

  // 1. Compact URL format: WxH:rows:cols[:state]
  const compactMatch = /^(\d+)x(\d+):([0-9,/]+):([0-9,/]+)(?::([.1#xX0-]+))?$/.exec(text);
  if (compactMatch) {
    const width = Number(compactMatch[1]);
    const height = Number(compactMatch[2]);
    if (width < 1 || width > 30 || height < 1 || height > 30) return null;
    const rowClues = compactMatch[3].split('/').map((s) => s.split(',').map(Number));
    const colClues = compactMatch[4].split('/').map((s) => s.split(',').map(Number));
    if (rowClues.length !== height || colClues.length !== width) return null;
    if (rowClues.some((r) => r.some((n) => !Number.isFinite(n) || n < 0 || n > width))) return null;
    if (colClues.some((c) => c.some((n) => !Number.isFinite(n) || n < 0 || n > height))) return null;

    let cells: CellState[] | undefined;
    if (compactMatch[5] && compactMatch[5].length === width * height) {
      cells = [...compactMatch[5]].map((ch) => (ch === '1' || ch === '#' ? 1 : ch === 'x' || ch === 'X' || ch === '-' ? -1 : 0));
    }
    return new NonogramBoard({ width, height, rowClues, colClues, cells });
  }

  // 2. Square bitmap shorthand (25, 100, 225, or 400 chars of '#', '.', '0', '1')
  if (/^[#.01]{25}$|^[#.01]{100}$|^[#.01]{225}$|^[#.01]{400}$/.test(text)) {
    const size = Math.round(Math.sqrt(text.length));
    const bitmap = [...text].map((ch) => (ch === '#' || ch === '1' ? 1 : 0)) as (0 | 1)[];
    return NonogramBoard.fromBitmap(size, size, bitmap);
  }

  return parseNonogramText(text);
}

/**
 * Parse `.non` format (width, height, rows, columns), JSON puzzle definition, or multi-line ASCII bitmap (`#` and `.`).
 */
export function parseNonogramText(raw: string): NonogramBoard | null {
  const text = raw.trim();
  if (!text) return null;

  // Try JSON format
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text) as Partial<PuzzleDefinition>;
      if (
        typeof obj.width === 'number' &&
        typeof obj.height === 'number' &&
        Array.isArray(obj.rowClues) &&
        Array.isArray(obj.colClues)
      ) {
        return new NonogramBoard({
          width: obj.width,
          height: obj.height,
          rowClues: obj.rowClues,
          colClues: obj.colClues,
          solution: obj.solution,
          title: obj.title,
        });
      }
    } catch {
      // Not valid JSON; continue
    }
  }

  // Try standard `.non` format (`width W`, `height H`, `rows`, ..., `columns`, ...)
  if (/\brows\b/i.test(text) && /\bcolumns\b/i.test(text)) {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    let width = 0;
    let height = 0;
    let title: string | undefined;
    let section: 'none' | 'rows' | 'cols' = 'none';
    const rowClues: number[][] = [];
    const colClues: number[][] = [];

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const wm = /^width\s+(\d+)$/i.exec(line);
      if (wm) {
        width = Number(wm[1]);
        continue;
      }
      const hm = /^height\s+(\d+)$/i.exec(line);
      if (hm) {
        height = Number(hm[1]);
        continue;
      }
      const tm = /^title\s+"?([^"]+)"?$/i.exec(line);
      if (tm) {
        title = tm[1].trim();
        continue;
      }
      if (/^rows$/i.test(line)) {
        section = 'rows';
        continue;
      }
      if (/^columns$/i.test(line)) {
        section = 'cols';
        continue;
      }
      if (/^(goal|catalogue|by|copyright|license)/i.test(line)) {
        section = 'none';
        continue;
      }
      if (section === 'rows' || section === 'cols') {
        const nums = line
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number);
        if (nums.length > 0 && nums.every((n) => Number.isFinite(n) && n >= 0)) {
          if (section === 'rows') rowClues.push(nums);
          else colClues.push(nums);
        }
      }
    }
    if (!width) width = colClues.length;
    if (!height) height = rowClues.length;
    if (width > 0 && height > 0 && rowClues.length === height && colClues.length === width) {
      return new NonogramBoard({ width, height, rowClues, colClues, title });
    }
  }

  // Try multi-line ASCII art grid (`#`/`■`/`1` for filled, `.`/`-`/`0`/`x` for empty)
  const gridLines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ''))
    .filter((l) => l.length > 0 && /^[#■1.\-0xX×]+$/.test(l));
  if (gridLines.length >= 3 && gridLines.every((l) => l.length === gridLines[0].length)) {
    const height = gridLines.length;
    const width = gridLines[0].length;
    if (width <= 30 && height <= 30) {
      const bitmap: (0 | 1)[] = [];
      for (const l of gridLines) {
        for (const ch of l) {
          bitmap.push(ch === '#' || ch === '■' || ch === '1' ? 1 : 0);
        }
      }
      return NonogramBoard.fromBitmap(width, height, bitmap);
    }
  }

  return null;
}

/** Export a NonogramBoard to standard `.non` text format. */
export function exportNonogramText(board: NonogramBoard): string {
  const out: string[] = [];
  if (board.title) out.push(`title "${board.title}"`);
  out.push(`width ${board.width}`);
  out.push(`height ${board.height}`);
  out.push('');
  out.push('rows');
  for (const r of board.rowClues) out.push(r.join(','));
  out.push('');
  out.push('columns');
  for (const c of board.colClues) out.push(c.join(','));
  return out.join('\n') + '\n';
}
