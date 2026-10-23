/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Victory modal shown upon puzzle completion. Displays time, level, hints used, and shareable summary.
 */
import { useEffect, useState } from 'react';
import { LEVEL_NAMES } from '@nonogram/core';
import type { StoredGame } from '../types';

interface SolvedModalProps {
  game: StoredGame;
  onNew: () => void;
  onClose: () => void;
}

export function SolvedModal({ game, onNew, onClose }: SolvedModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const durationSec = game.solvedAt ? Math.max(1, Math.round((game.solvedAt - game.createdAt) / 1000)) : 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const levelName = game.level ? LEVEL_NAMES[game.level] : 'Casual';

  const handleShare = () => {
    // Generate mini-grid text card for sharing
    const w = game.width;
    const h = game.height;
    const filledCount = game.cells.filter((c) => c === 1).length;
    const text = [
      `Nonogram Revisited · Solved!`,
      `${game.title} (${w}×${h} · ${levelName})`,
      `⏱ ${timeFormatted} · ⬛ ${filledCount} blocks`,
      window.location.origin + '/play/',
    ].join('\n');

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="solved-title">
      <div className="modal-card">
        <div className="modal-header">
          <div className="solved-badge">🎉 Puzzle Solved!</div>
          <button className="btn ghost modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <h2 id="solved-title" className="solved-title">{game.title}</h2>
        <div className="solved-stats">
          <div className="stat-box">
            <span className="stat-label">Size</span>
            <span className="stat-value">{game.width}×{game.height}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Difficulty</span>
            <span className="stat-value">{levelName}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Time</span>
            <span className="stat-value">{timeFormatted}</span>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={handleShare}>
            {copied ? 'Copied to clipboard!' : 'Share result'}
          </button>
          <button className="btn primary" onClick={onNew} autoFocus>
            Next puzzle
          </button>
        </div>
      </div>
    </div>
  );
}
