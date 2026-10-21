/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Root application: wires settings, stored games, and the solver client together.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SolverClient } from './solverClient';
import { loadGames, loadSettings, saveGames, saveSettings } from './store';
import { autoCrossCompleted, isSolved } from './game';
import type { Tool } from './game';
import { playSolved } from './sound';
import type { AppSettings, SolverStatus, StoredGame } from './types';
import type { CellState } from '@nonogram/core';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { ToolPad } from './components/ToolPad';
import { SidePanel } from './components/SidePanel';
import { paintCells } from './game';

const MAX_GAMES = 50;

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [games, setGames] = useState<StoredGame[]>(loadGames);
  const [activeId, setActiveId] = useState<string | null>(() => loadGames()[0]?.id ?? null);
  const [status, setStatus] = useState<SolverStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('fill');
  const [history, setHistory] = useState<Record<string, CellState[][]>>({});
  const solverRef = useRef<SolverClient | null>(null);
  const strokeStart = useRef<CellState[] | null>(null);

  const active = useMemo(() => games.find((g) => g.id === activeId) ?? null, [games, activeId]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const solver = useCallback(() => (solverRef.current ??= new SolverClient()), []);
  useEffect(() => () => {
    solverRef.current?.terminate();
    solverRef.current = null;
  }, []);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveGames(games), [games]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0b1220' : '#f4f6fb');
  }, [settings.theme]);

  const updateActive = useCallback((fn: (g: StoredGame) => StoredGame) => {
    setGames((all) => all.map((g) => (g.id === activeRef.current?.id ? fn(g) : g)));
  }, []);

  const pushHistory = useCallback((id: string, cells: CellState[]) => {
    setHistory((h) => ({ ...h, [id]: [...(h[id] ?? []).slice(-99), cells] }));
  }, []);

  const handleGenerate = useCallback(async (size: number) => {
    setStatus('generating');
    setError(null);
    try {
      const client = solver();
      const level = settingsRef.current.preferredDifficulty ?? undefined;
      const def = await client.generate({ size, seed: Date.now(), maxAttempts: 200, level });
      const analysis = await client.solve(def);
      const game: StoredGame = {
        id: String(Date.now()),
        title: def.title ?? `Puzzle ${size}×${size}`,
        width: def.width,
        height: def.height,
        rowClues: def.rowClues,
        colClues: def.colClues,
        cells: new Array<CellState>(def.width * def.height).fill(0),
        solution: def.solution,
        createdAt: Date.now(),
        mode: settingsRef.current.gameMode,
        level: analysis.solved ? analysis.level : undefined,
        score: analysis.solved ? analysis.score : undefined,
        solvedAt: null,
      };
      setGames((all) => [game, ...all].slice(0, MAX_GAMES));
      setActiveId(game.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a puzzle.');
    } finally {
      setStatus('idle');
    }
  }, [solver]);

  const handleStrokeStart = useCallback(() => {
    strokeStart.current = activeRef.current?.cells ?? null;
  }, []);

  const handlePaint = useCallback((cells: readonly number[], target: CellState) => {
    updateActive((g) => {
      const next = paintCells(g, cells, target);
      return next === g ? g : { ...g, cells: next.cells };
    });
  }, [updateActive]);

  const handleStrokeEnd = useCallback(() => {
    const g = activeRef.current;
    const before = strokeStart.current;
    strokeStart.current = null;
    if (!g || !before) return;
    let next = g;
    if (settingsRef.current.autoCross) {
      const crossed = autoCrossCompleted(g);
      if (crossed !== g) next = { ...g, cells: crossed.cells };
    }
    const solved = !g.solvedAt && isSolved(next);
    if (solved) {
      next = { ...next, solvedAt: Date.now() };
      if (settingsRef.current.sound) playSolved();
    }
    if (next !== g) updateActive(() => next);
    if (before.some((c, i) => c !== g.cells[i])) pushHistory(g.id, before);
  }, [pushHistory, updateActive]);

  const handleUndo = useCallback(() => {
    const g = activeRef.current;
    if (!g) return;
    const stack = history[g.id] ?? [];
    const prev = stack[stack.length - 1];
    if (!prev) return;
    setHistory((h) => ({ ...h, [g.id]: stack.slice(0, -1) }));
    updateActive((cur) => ({ ...cur, cells: prev, solvedAt: null }));
  }, [history, updateActive]);

  const handleReset = useCallback(() => {
    const g = activeRef.current;
    if (!g || g.cells.every((c) => c === 0)) return;
    pushHistory(g.id, g.cells);
    updateActive((cur) => ({ ...cur, cells: cur.cells.map(() => 0 as CellState), solvedAt: null }));
  }, [pushHistory, updateActive]);

  const handleSolve = useCallback(async () => {
    const g = activeRef.current;
    if (!g) return;
    setStatus('solving');
    setError(null);
    try {
      const analysis = await solver().solve({
        width: g.width,
        height: g.height,
        rowClues: g.rowClues,
        colClues: g.colClues,
        solution: g.solution,
        title: g.title,
      });
      pushHistory(g.id, g.cells);
      updateActive((cur) => ({ ...cur, cells: analysis.finalCells }));
      if (!analysis.solved) setError('The solver could not finish this puzzle with human techniques; showing its progress.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Solver failed.');
    } finally {
      setStatus('idle');
    }
  }, [pushHistory, solver, updateActive]);

  const handleDelete = useCallback((id: string) => {
    setGames((all) => all.filter((g) => g.id !== id));
    setHistory((h) => {
      const { [id]: _drop, ...rest } = h;
      return rest;
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'f') setTool('fill');
        else if (e.key === 'x') setTool('cross');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  const busy = status !== 'idle';
  const canUndo = (active && (history[active.id]?.length ?? 0) > 0) || false;

  return (
    <div className="app">
      <TopBar settings={settings} onSetSettings={setSettings} status={status} />
      <div className="app-body">
        <main className="stage">
          <ToolPad
            settings={settings}
            onSetSettings={setSettings}
            tool={tool}
            onSetTool={setTool}
            hasGame={active !== null}
            canUndo={canUndo}
            busy={busy}
            onGenerate={handleGenerate}
            onSolve={handleSolve}
            onUndo={handleUndo}
            onReset={handleReset}
          />
          {error && (
            <div className="notice" role="alert">
              {error}
              <button className="btn ghost" onClick={() => setError(null)} aria-label="Dismiss">×</button>
            </div>
          )}
          <Board
            game={active}
            tool={tool}
            locked={Boolean(active?.solvedAt) || busy}
            showHighlights={settings.showHighlights}
            sound={settings.sound}
            onStrokeStart={handleStrokeStart}
            onPaint={handlePaint}
            onStrokeEnd={handleStrokeEnd}
            onNew={() => handleGenerate(active?.width ?? 10)}
          />
        </main>
        <SidePanel games={games} activeId={activeId} onSelect={setActiveId} onDelete={handleDelete} />
      </div>
    </div>
  );
}
