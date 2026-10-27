/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Victory modal shown upon puzzle completion. Displays time, level, hints used, and shareable summary.
 */
import { useEffect, useState } from 'react';
import { LEVEL_NAMES, serializePuzzle, NonogramBoard } from '@nonogram/core';
import type { DailyStats, StoredGame } from '../types';

interface SolvedModalProps {
  game: StoredGame;
  dailyStats?: DailyStats | null;
  onNew: () => void;
  onClose: () => void;
}

export function SolvedModal({ game, dailyStats, onNew, onClose }: SolvedModalProps) {
  const [copiedResult, setCopiedResult] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
  const isDaily = game.id.startsWith('daily-');

  const handleShareResult = () => {
    const w = game.width;
    const h = game.height;
    const filledCount = game.cells.filter((c) => c === 1).length;
    const streakInfo = isDaily && dailyStats ? ` · 🔥 Streak: ${dailyStats.streak}` : '';
    const text = [
      `Nonogram Revisited · Solved!`,
      `${game.title} (${w}×${h} · ${levelName})${streakInfo}`,
      `⏱ ${timeFormatted} · ⬛ ${filledCount} blocks`,
      window.location.origin + '/play/' + (isDaily ? '?daily=1' : ''),
    ].join('\n');

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(() => {
        setCopiedResult(true);
        setTimeout(() => setCopiedResult(false), 2000);
      });
    }
  };

  const handleShareLink = () => {
    const board = new NonogramBoard({
      width: game.width,
      height: game.height,
      rowClues: game.rowClues,
      colClues: game.colClues,
      title: game.title,
    });
    const serialized = serializePuzzle(board);
    const url = `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(serialized)}`;

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
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
          {isDaily && dailyStats && (
            <div className="stat-box">
              <span className="stat-label">Streak</span>
              <span className="stat-value">🔥 {dailyStats.streak}</span>
            </div>
          )}
        </div>
        <div className="modal-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <button className="btn" onClick={handleShareResult}>
            {copiedResult ? 'Copied result!' : 'Copy Share Result'}
          </button>
          <button className="btn" onClick={handleShareLink}>
            {copiedLink ? 'Copied link!' : 'Share Puzzle Link'}
          </button>
          <button className="btn primary" onClick={onNew} autoFocus>
            Next puzzle
          </button>
        </div>
      </div>
    </div>
  );
}
