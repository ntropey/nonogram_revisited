/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Root application: wires settings, stored games, daily puzzles, sharing, modes, and the solver client.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SolverClient } from './solverClient';
import { loadDailyStats, loadGames, loadMode, loadSettings, saveDailyStats, saveGames, saveMode, saveSettings } from './store';
import { autoCrossCompleted, findMistakes, isSolved, paintCells } from './game';
import type { PaintMode } from './game';
import { coachMarks, mistakeMarks, proofMarks, provenState } from './coach';
import type { CellMarks } from './coach';
import { playSolved } from './sound';
import type { AppSettings, DailyStats, GameMode, Hint, SolverStatus, StoredGame } from './types';
import { deserializePuzzle, serializePuzzle, NonogramBoard } from '@nonogram/core';
import type { CellState, SolveAnalysis } from '@nonogram/core';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { ToolPad } from './components/ToolPad';
import { SidePanel } from './components/SidePanel';
import { HintPanel } from './components/HintPanel';
import { SolvedModal } from './components/SolvedModal';
import { ImportModal } from './components/ImportModal';
import { AnalyzePanel } from './components/AnalyzePanel';

const MAX_GAMES = 50;

function todayDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = loadSettings();
    const m = loadMode();
    return { ...s, gameMode: m };
  });
  const [dailyStats, setDailyStats] = useState<DailyStats>(loadDailyStats);
  const [games, setGames] = useState<StoredGame[]>(loadGames);
  const [activeId, setActiveId] = useState<string | null>(() => loadGames()[0]?.id ?? null);
  const [status, setStatus] = useState<SolverStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<PaintMode>('fill');
  const [hint, setHint] = useState<Hint | null>(null);
  const [history, setHistory] = useState<Record<string, CellState[][]>>({});
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showImport, setShowImport] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // Analyze mode state
  const [analysis, setAnalysis] = useState<SolveAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [selectedAnalysisStep, setSelectedAnalysisStep] = useState<number | null>(null);

  const solverRef = useRef<SolverClient | null>(null);
  const strokeStart = useRef<CellState[] | null>(null);

  const active = useMemo(() => games.find((g) => g.id === activeId) ?? null, [games, activeId]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const dailyStatsRef = useRef(dailyStats);
  dailyStatsRef.current = dailyStats;

  const solver = useCallback(() => (solverRef.current ??= new SolverClient()), []);
  useEffect(() => () => {
    solverRef.current?.terminate();
    solverRef.current = null;
  }, []);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveGames(games), [games]);
  useEffect(() => saveDailyStats(dailyStats), [dailyStats]);
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

  const handleSelectMode = useCallback((mode: GameMode) => {
    saveMode(mode);
    setSettings((s) => ({ ...s, gameMode: mode }));
    setHint(null);
    setSelectedAnalysisStep(null);
  }, []);

  const handleLoadDaily = useCallback(async (dateStr = todayDateUtc()) => {
    const dailyId = `daily-${dateStr}`;
    const existing = games.find((g) => g.id === dailyId);
    if (existing) {
      setActiveId(dailyId);
      setHint(null);
      return;
    }

    setStatus('generating');
    setError(null);
    setShowModal(false);
    try {
      const client = solver();
      const def = await client.daily(dateStr, 10);
      const solveRes = await client.solve(def);
      const game: StoredGame = {
        id: dailyId,
        title: `Daily ${dateStr}`,
        width: def.width,
        height: def.height,
        rowClues: def.rowClues,
        colClues: def.colClues,
        cells: new Array<CellState>(def.width * def.height).fill(0),
        solution: def.solution,
        createdAt: Date.now(),
        mode: settingsRef.current.gameMode,
        level: solveRes.solved ? solveRes.level : undefined,
        score: solveRes.solved ? solveRes.score : undefined,
        solvedAt: null,
      };
      setGames((all) => [game, ...all.filter((g) => g.id !== dailyId)].slice(0, MAX_GAMES));
      setActiveId(dailyId);
      setHint(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate Daily puzzle.');
    } finally {
      setStatus('idle');
    }
  }, [games, solver]);

  const handleImportBoard = useCallback(async (board: NonogramBoard) => {
    setStatus('solving');
    setError(null);
    try {
      const client = solver();
      const def = board.toDefinition();
      const solveRes = await client.solve(def);
      const newId = `imported-${Date.now()}`;
      const game: StoredGame = {
        id: newId,
        title: board.title || `Imported ${board.width}×${board.height}`,
        width: board.width,
        height: board.height,
        rowClues: board.rowClues,
        colClues: board.colClues,
        cells: board.cells ? [...board.cells] : new Array<CellState>(board.width * board.height).fill(0),
        solution: def.solution,
        createdAt: Date.now(),
        mode: settingsRef.current.gameMode,
        level: solveRes.solved ? solveRes.level : undefined,
        score: solveRes.solved ? solveRes.score : undefined,
        solvedAt: null,
      };
      setGames((all) => [game, ...all].slice(0, MAX_GAMES));
      setActiveId(newId);
      setHint(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze imported puzzle.');
    } finally {
      setStatus('idle');
    }
  }, [solver]);

  // Deep-link handling on mount (?daily=1 and ?p=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('daily') === '1') {
      void handleLoadDaily();
    } else {
      const p = params.get('p');
      if (p) {
        const board = deserializePuzzle(p);
        if (board) {
          void handleImportBoard(board);
        }
      }
    }
  }, [handleLoadDaily, handleImportBoard]);

  const handleGenerate = useCallback(async (size: number) => {
    setStatus('generating');
    setError(null);
    setShowModal(false);
    try {
      const client = solver();
      const level = settingsRef.current.preferredDifficulty ?? undefined;
      const def = await client.generate({ size, seed: Date.now(), maxAttempts: 600, maxTimeMs: 5000, level });
      const analysisRes =
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
        level: analysisRes.solved ? analysisRes.level : undefined,
        score: analysisRes.solved ? analysisRes.score : undefined,
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

  // Analyze mode: fetch full SolveAnalysis when active puzzle changes or in analyze mode
  useEffect(() => {
    if (settings.gameMode !== 'analyze' || !active) {
      setAnalysis(null);
      setSelectedAnalysisStep(null);
      return;
    }

    let canceled = false;
    setAnalyzing(true);
    const client = solver();
    client
      .solve({
        width: active.width,
        height: active.height,
        rowClues: active.rowClues,
        colClues: active.colClues,
        title: active.title,
      })
      .then((res) => {
        if (!canceled) {
          setAnalysis(res);
          setAnalyzing(false);
        }
      })
      .catch(() => {
        if (!canceled) setAnalyzing(false);
      });

    return () => {
      canceled = true;
    };
  }, [settings.gameMode, active, solver]);

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
      const now = Date.now();
      next = { ...next, solvedAt: now };
      setShowModal(true);
      if (settingsRef.current.sound) playSolved();

      // Check daily streak tracking
      if (g.id.startsWith('daily-')) {
        const today = todayDateUtc();
        const currentStats = dailyStatsRef.current;
        const lastDate = currentStats.lastCompletedDate;
        let newStreak = currentStats.streak;

        if (lastDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          newStreak = lastDate === yesterday ? currentStats.streak + 1 : 1;
          const durationSec = Math.max(1, Math.round((now - g.createdAt) / 1000));
          const updated: DailyStats = {
            lastCompletedDate: today,
            streak: newStreak,
            history: {
              ...currentStats.history,
              [today]: { seconds: durationSec, hintsUsed: 0 },
            },
          };
          setDailyStats(updated);
        }
      }
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
      const res = await solver().solve({
        width: g.width,
        height: g.height,
        rowClues: g.rowClues,
        colClues: g.colClues,
        title: g.title,
      });
      if (res.solved && res.finalCells) {
        pushHistory(g.id, g.cells);
        updateActive((cur) => ({ ...cur, cells: res.finalCells, solvedAt: null }));
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
    setSelectedAnalysisStep(null);
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
      const disabled = settingsRef.current.gameMode === 'train' ? settingsRef.current.disabledTechniques : undefined;
      const step = await solver().nextStep(
        { width: g.width, height: g.height, rowClues: g.rowClues, colClues: g.colClues, title: g.title },
        g.cells,
        disabled,
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

  const handleSharePuzzle = useCallback(() => {
    const g = activeRef.current;
    if (!g) return;
    const board = new NonogramBoard({
      width: g.width,
      height: g.height,
      rowClues: g.rowClues,
      colClues: g.colClues,
      title: g.title,
    });
    const serialized = serializePuzzle(board);
    const url = `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(serialized)}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      });
    }
  }, []);

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
    if (!active) return null;

    // In analyze mode, if a step is selected, highlight that step's deduction
    if (settings.gameMode === 'analyze' && analysis?.steps && selectedAnalysisStep !== null) {
      const step = analysis.steps[selectedAnalysisStep];
      if (step) {
        return coachMarks(step, 4, active.width, active.height);
      }
    }

    if (!hint) return null;
    if (hint.kind === 'step') return coachMarks(hint.step, hint.stage, active.width, active.height);
    if (hint.kind === 'mistakes') return mistakeMarks(hint.cells);
    if (hint.kind === 'proof') {
      const trace = hint.fill ?? hint.cross;
      return trace ? { ...proofMarks(trace, active.width, active.height) } : { [hint.cell]: 'hint-key' };
    }
    return null;
  }, [active, hint, settings.gameMode, analysis, selectedAnalysisStep]);

  const busy = status !== 'idle';
  const canUndo = (active && (history[active.id]?.length ?? 0) > 0) || false;

  return (
    <div className="app">
      <TopBar
        settings={settings}
        onSetSettings={setSettings}
        status={status}
        onSelectMode={handleSelectMode}
        onOpenDaily={() => void handleLoadDaily()}
        onOpenImport={() => setShowImport(true)}
        onSharePuzzle={handleSharePuzzle}
        copiedShare={copiedShare}
      />
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
        <SidePanel
          games={games}
          activeId={activeId}
          settings={settings}
          onSetSettings={setSettings}
          onSelect={handleSelect}
          onDelete={handleDelete}
        >
          {settings.gameMode === 'analyze' && (
            <AnalyzePanel
              analysis={analysis}
              loading={analyzing}
              selectedStep={selectedAnalysisStep}
              onSelectStep={setSelectedAnalysisStep}
            />
          )}
          {hint && <HintPanel hint={hint} width={active?.width ?? 1} onNext={handleNextStage} onApply={handleApplyHint} onDismiss={() => setHint(null)} />}
        </SidePanel>
      </div>
      {showModal && active?.solvedAt && (
        <SolvedModal
          game={active}
          dailyStats={dailyStats}
          onNew={() => handleGenerate(active.width)}
          onClose={() => setShowModal(false)}
        />
      )}
      {showImport && (
        <ImportModal
          onImport={(b) => void handleImportBoard(b)}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
