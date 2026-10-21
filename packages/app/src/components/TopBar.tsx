/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Top bar: title, settings, solver status.
 */
import { useState } from 'react';
import type { AppSettings } from '../types';

export function TopBar({
  settings,
  onSetSettings,
  status,
}: {
  settings: AppSettings;
  onSetSettings: (s: AppSettings) => void;
  status: 'idle' | 'ready' | 'solving' | 'generating';
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="topbar-brand">Nonogram Revisited</div>
      <div className="topbar-actions">
        <button className="btn ghost" onClick={() => setOpen(!open)} title="Settings">
          ⚙
        </button>
        <span className="status-pill" data-state={status}>
          {status === 'solving' ? 'Solving…' : status === 'generating' ? 'Generating…' : 'Idle'}
        </span>
      </div>
      {open && (
        <div className="settings-panel">
          <h3>Settings</h3>
          <label>
            <input
              type="checkbox"
              checked={settings.showHighlights}
              onChange={(e) =>
                onSetSettings({ ...settings, showHighlights: e.target.checked })
              }
            />
            Show highlights
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.autoCross}
              onChange={(e) => onSetSettings({ ...settings, autoCross: e.target.checked })}
            />
            Auto-cross completed blocks
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(e) => onSetSettings({ ...settings, sound: e.target.checked })}
            />
            Sound
          </label>
          <button className="btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </header>
  );
}
