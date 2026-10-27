/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Top bar: brand, mode switcher, solver status, and the settings popover.
 */
import { useEffect, useRef, useState } from 'react';
import type { AppSettings, GameMode, SolverStatus } from '../types';

export function TopBar({
  settings,
  onSetSettings,
  status,
  onSelectMode,
  onOpenDaily,
  onOpenImport,
  onSharePuzzle,
  copiedShare,
}: {
  settings: AppSettings;
  onSetSettings: (s: AppSettings) => void;
  status: SolverStatus;
  onSelectMode: (mode: GameMode) => void;
  onOpenDaily: () => void;
  onOpenImport: () => void;
  onSharePuzzle: () => void;
  copiedShare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
      } else if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const toggle = (key: 'showHighlights' | 'autoCross' | 'sound', label: string) => (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={settings[key]} onChange={(e) => onSetSettings({ ...settings, [key]: e.target.checked })} />
    </label>
  );

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="logo" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        Nonogram <span>Revisited</span>
      </div>

      <div className="segmented mode-switcher" role="group" aria-label="Game mode">
        <button
          className={settings.gameMode === 'play' ? 'on' : ''}
          onClick={() => onSelectMode('play')}
          title="Play mode: standard solving"
          aria-pressed={settings.gameMode === 'play'}
        >
          Play
        </button>
        <button
          className={settings.gameMode === 'train' ? 'on' : ''}
          onClick={() => onSelectMode('train')}
          title="Train mode: practice techniques with the Coach"
          aria-pressed={settings.gameMode === 'train'}
        >
          Train
        </button>
        <button
          className={settings.gameMode === 'analyze' ? 'on' : ''}
          onClick={() => onSelectMode('analyze')}
          title="Analyze mode: step-by-step solver trail"
          aria-pressed={settings.gameMode === 'analyze'}
        >
          Analyze
        </button>
      </div>

      <div className="topbar-actions" ref={ref}>
        <button className="btn" onClick={onOpenDaily} title="Play today’s Daily Puzzle">
          📅 Daily
        </button>
        <button className="btn" onClick={onOpenImport} title="Import puzzle string or file">
          Import
        </button>
        <button className="btn" onClick={onSharePuzzle} title="Share puzzle URL to clipboard">
          {copiedShare ? 'Copied!' : 'Share'}
        </button>
        <span className="status-pill" data-state={status} role="status">
          {status === 'solving' ? 'Solving…' : status === 'generating' ? 'Generating…' : 'Ready'}
        </span>
        <button className="btn icon" onClick={() => setOpen(!open)} title="Settings" aria-expanded={open} aria-label="Settings">
          ⚙
        </button>
        {open && (
          <div className="settings-panel">
            <h3>Settings</h3>
            {toggle('showHighlights', 'Highlight row & column')}
            {toggle('autoCross', 'Auto-cross finished lines')}
            {toggle('sound', 'Sound')}
            <label className="switch-row">
              <span>Light theme</span>
              <input
                type="checkbox"
                checked={settings.theme === 'light'}
                onChange={(e) => onSetSettings({ ...settings, theme: e.target.checked ? 'light' : 'dark' })}
              />
            </label>
          </div>
        )}
      </div>
    </header>
  );
}
