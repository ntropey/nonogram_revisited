/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Root application: wires settings, stored games, and the solver client together.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SolverClient } from './solverClient';
import { DEFAULT_SETTINGS } from './types';
import type { AppSettings, StoredGame } from './types';
import type { CellState, PuzzleDefinition } from '@nonogram/core';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { ToolPad } from './components/ToolPad';
import { SidePanel } from './components/SidePanel';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [games, setGames] = useState<StoredGame[]>([]);
  const [active, setActive] = useState<StoredGame | null>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'solving' | 'generating'>('idle');
  const solverRef = useRef<SolverClient | null>(null);

  useEffect(() => {
    solverRef.current = new SolverClient();
    const stored = localStorage.getItem('nonogram.settings');
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
    const raw = localStorage.getItem('nonogram.games');
    if (raw) {
      try {
        setGames(JSON.parse(raw) as StoredGame[]);
      } catch {
        setGames([]);
      }
    }
    return () => solverRef.current!.terminate();
  }, []);

  const definition = useMemo<PuzzleDefinition | null>(() => {
    if (!active) return null;
    return {
      width: active.width,
      height: active.height,
      rowClues: active.rowClues,
      colClues: active.colClues,
      solution: active.solution,
      title: active.title,
    };
  }, [active]);

  const handleGenerate = useCallback(async (size: number) => {
    if (!solverRef.current) return;
    setStatus('generating');
    try {
      const def = await solverRef.current.generate({ size, seed: Date.now(), maxAttempts: 200 });
      const game: StoredGame = {
        id: String(Date.now()),
        title: def.title ?? `Puzzle ${size}x${size}`,
        width: def.width,
        height: def.height,
        rowClues: def.rowClues,
        colClues: def.colClues,
        cells: Array.from({ length: def.width * def.height }, () => 0 as CellState),
        solution: def.solution,
        createdAt: Date.now(),
        mode: 'play',
      };
      const next = [game, ...games].slice(0, 50);
      setGames(next);
      localStorage.setItem('nonogram.games', JSON.stringify(next));
      setActive(() => game);
    } finally {
      setStatus('idle');
    }
  }, [games]);

  const handleToggleCell = useCallback((cell: number) => {
    setActive((cur) => {
      if (!cur) return null;
      const cells = [...cur.cells];
      const current = cells[cell];
      cells[cell] = current === 0 ? 1 : current === 1 ? -1 : 0;
      return { ...cur, cells };
    });
  }, []);

  const handleSolve = useCallback(async () => {
    if (!definition || !solverRef.current) return;
    setStatus('solving');
    try {
      await solverRef.current.solve(definition);
    } finally {
      setStatus('idle');
    }
  }, [definition]);

  return (
    <div className="app">
      <TopBar settings={settings} onSetSettings={setSettings} status={status} />
      <div className="app-body">
        <Board game={active} definition={definition} onToggleCell={handleToggleCell} settings={settings} />
        <ToolPad onGenerate={handleGenerate} onSolve={handleSolve} />
        <SidePanel
          games={games}
          active={active}
          setActive={(g) => setActive(() => g)}
          setGames={(gs) => setGames(() => gs)}
        />
      </div>
    </div>
  );
}
