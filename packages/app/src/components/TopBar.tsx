/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Top bar: brand, solver status, and the settings popover.
 */
import { useEffect, useRef, useState } from 'react';
import type { AppSettings, SolverStatus } from '../types';

export function TopBar({
  settings,
  onSetSettings,
  status,
}: {
  settings: AppSettings;
  onSetSettings: (s: AppSettings) => void;
  status: SolverStatus;
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
      <div className="topbar-actions" ref={ref}>
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
