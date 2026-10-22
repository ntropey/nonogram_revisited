/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Root application: wires settings, stored games, and the solver client together.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SolverClient } from './solverClient';
import { loadGames, loadSettings, saveGames, saveSettings } from './store';
import { autoCrossCompleted, findMistakes, isSolved } from './game';
import type { PaintMode } from './game';
import { coachMarks, mistakeMarks, proofMarks, provenState } from './coach';
import type { CellMarks } from './coach';
import { playSolved } from './sound';
import type { AppSettings, Hint, SolverStatus, StoredGame } from './types';
import type { CellState } from '@nonogram/core';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { ToolPad } from './components/ToolPad';
import { SidePanel } from './components/SidePanel';
import { HintPanel } from './components/HintPanel';
import { SolvedModal } from './components/SolvedModal';
import { paintCells } from './game';

const MAX_GAMES = 50;

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [games, setGames] = useState<StoredGame[]>(loadGames);
  const [activeId, setActiveId] = useState<string | null>(() => loadGames()[0]?.id ?? null);
  const [status, setStatus] = useState<SolverStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<PaintMode>('fill');
  const [hint, setHint] = useState<Hint | null>(null);
  const [history, setHistory] = useState<Record<string, CellState[][]>>({});
  const [showModal, setShowModal] = useState<boolean>(false);
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
    setShowModal(false);
    try {
      const client = solver();
      const level = settingsRef.current.preferredDifficulty ?? undefined;
      const def = await client.generate({ size, seed: Date.now(), maxAttempts: 600, maxTimeMs: 5000, level });
      // The generator rates every board it accepts, so skip a duplicate full solve.
      const analysis =
        def.level !== undefined
          ? { solved: true, level: def.level, score: def.score ?? 0 }
          : await client.solve(def);
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
      setHint(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a puzzle.');
    } finally {
      setStatus('idle');
    }
  }, [solver]);

  const handleStrokeStart = useCallback(() => {
    strokeStart.current = activeRef.current?.cells ?? null;
    setHint(null);
  }, []);

  const handlePaint = useCallback((cells: readonly number[], target: CellState) => {
    updateActive((g) => {
      const next = paintCells(g, cells, target);
      return next === g ? g : { ...g, cells: next.cells };
    });
  }, [updateActive]);

  /** Apply auto-cross and win detection to `g`, store it, and record `before` for undo. */
  const settle = useCallback((g: StoredGame, before: CellState[]) => {
    let next = g;
    if (settingsRef.current.autoCross) {
      const crossed = autoCrossCompleted(g);
      if (crossed !== g) next = { ...g, cells: crossed.cells };
    }
    if (!g.solvedAt && isSolved(next)) {
      next = { ...next, solvedAt: Date.now() };
      setShowModal(true);
      if (settingsRef.current.sound) playSolved();
    }
    if (next !== activeRef.current) updateActive(() => next);
    if (before.some((c, i) => c !== g.cells[i])) pushHistory(g.id, before);
  }, [pushHistory, updateActive]);

  const handleStrokeEnd = useCallback(() => {
    const g = activeRef.current;
    const before = strokeStart.current;
    strokeStart.current = null;
    if (g && before) settle(g, before);
  }, [settle]);

  const handleUndo = useCallback(() => {
    const g = activeRef.current;
    if (!g) return;
    const stack = history[g.id] ?? [];
    const prev = stack[stack.length - 1];
    if (!prev) return;
    setHistory((h) => ({ ...h, [g.id]: stack.slice(0, -1) }));
    updateActive((cur) => ({ ...cur, cells: prev, solvedAt: null }));
    setShowModal(false);
    setHint(null);
  }, [history, updateActive]);

  const handleReset = useCallback(() => {
    const g = activeRef.current;
    if (!g || g.cells.every((c) => c === 0)) return;
    pushHistory(g.id, g.cells);
    updateActive((cur) => ({ ...cur, cells: cur.cells.map(() => 0 as CellState), solvedAt: null }));
    setShowModal(false);
    setHint(null);
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
        title: g.title,
      });
      if (analysis.solved && analysis.finalCells) {
        pushHistory(g.id, g.cells);
        updateActive((cur) => ({ ...cur, cells: analysis.finalCells, solvedAt: null }));
        setHint(null);
      } else {
        setError('The solver could not completely deduce this puzzle.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Solve failed.');
    } finally {
      setStatus('idle');
    }
  }, [solver, pushHistory, updateActive]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setHint(null);
    setShowModal(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setGames((all) => {
      const next = all.filter((g) => g.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    setHistory((h) => {
      const copy = { ...h };
      delete copy[id];
      return copy;
    });
  }, [activeId]);

  const handleHint = useCallback(async () => {
    const g = activeRef.current;
    if (!g) return;
    const wrong = findMistakes(g);
    if (wrong.length > 0) {
      setHint({ kind: 'mistakes', cells: wrong });
      return;
    }
    setStatus('solving');
    setError(null);
    try {
      const step = await solver().nextStep(
        { width: g.width, height: g.height, rowClues: g.rowClues, colClues: g.colClues, title: g.title },
        g.cells,
      );
      setHint(step ? { kind: 'step', step, stage: 1 } : { kind: 'stuck' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find a hint.');
    } finally {
      setStatus('idle');
    }
  }, [solver]);

  const handleNextStage = useCallback(() => {
    setHint((h) => (h?.kind === 'step' && h.stage < 4 ? { ...h, stage: (h.stage + 1) as 1 | 2 | 3 | 4 } : h));
  }, []);

  const handleProbe = useCallback(async (cell: number) => {
    const g = activeRef.current;
    if (!g) return;
    if (g.cells[cell] !== 0) {
      setError('Pick an empty cell to ask about.');
      return;
    }
    const wrong = findMistakes(g);
    if (wrong.length > 0) {
      setHint({ kind: 'mistakes', cells: wrong });
      return;
    }
    setStatus('solving');
    setError(null);
    try {
      const def = { width: g.width, height: g.height, rowClues: g.rowClues, colClues: g.colClues, title: g.title };
      const client = solver();
      const [fill, cross] = await Promise.all([client.trace(def, g.cells, cell, 1), client.trace(def, g.cells, cell, -1)]);
      setHint({ kind: 'proof', cell, fill, cross });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run the prover.');
    } finally {
      setStatus('idle');
    }
  }, [solver]);

  const handleApplyHint = useCallback(() => {
    const g = activeRef.current;
    if (!g || !hint) return;
    const cells = [...g.cells];
    if (hint.kind === 'step') for (const ch of hint.step.changes) cells[ch.cell] = ch.state;
    else if (hint.kind === 'mistakes') for (const i of hint.cells) cells[i] = 0;
    else if (hint.kind === 'proof') {
      const state = provenState(hint.fill, hint.cross);
      if (state === null) return;
      cells[hint.cell] = state;
    } else return;
    setHint(null);
    settle({ ...g, cells }, g.cells);
  }, [hint, settle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'h') void handleHint();
        else if (e.key === 'f') setTool('fill');
        else if (e.key === 'x') setTool('cross');
        else if (e.key === 'p') setTool('prove');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleHint]);

  const gridMarks = useMemo<CellMarks | null>(() => {
    if (!active || !hint) return null;
    if (hint.kind === 'step') return coachMarks(hint.step, hint.stage, active.width, active.height);
    if (hint.kind === 'mistakes') return mistakeMarks(hint.cells);
    if (hint.kind === 'proof') {
      const trace = hint.fill ?? hint.cross;
      return trace ? { ...proofMarks(trace, active.width, active.height) } : { [hint.cell]: 'hint-key' };
    }
    return null;
  }, [active, hint]);

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
            onHint={handleHint}
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
            marks={gridMarks}
            probe={tool === 'prove'}
            onProbe={handleProbe}
            tool={tool === 'prove' ? 'fill' : tool}
            locked={Boolean(active?.solvedAt) || busy}
            showHighlights={settings.showHighlights}
            sound={settings.sound}
            onStrokeStart={handleStrokeStart}
            onPaint={handlePaint}
            onStrokeEnd={handleStrokeEnd}
            onNew={() => handleGenerate(active?.width ?? 10)}
          />
        </main>
        <SidePanel games={games} activeId={activeId} onSelect={handleSelect} onDelete={handleDelete}>
          {hint && <HintPanel hint={hint} width={active?.width ?? 1} onNext={handleNextStage} onApply={handleApplyHint} onDismiss={() => setHint(null)} />}
        </SidePanel>
      </div>
      {showModal && active?.solvedAt && (
        <SolvedModal
          game={active}
          onNew={() => handleGenerate(active.width)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
