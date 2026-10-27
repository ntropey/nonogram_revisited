/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Modal dialog for importing puzzle strings, .non files, or ASCII bitmap grids.
 */
import { useEffect, useState } from 'react';
import { deserializePuzzle } from '@nonogram/core';
import type { NonogramBoard } from '@nonogram/core';

interface ImportModalProps {
  onImport: (board: NonogramBoard) => void;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleLoad = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please paste a puzzle definition.');
      return;
    }
    const board = deserializePuzzle(trimmed);
    if (!board) {
      setError('Unable to parse puzzle. Supported formats: compact (WxH:rows:cols), .non format, JSON, or ASCII grid.');
      return;
    }
    onImport(board);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="import-title" className="solved-title">Import Puzzle</h2>
          <button className="btn ghost modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        <p className="text-muted" style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>
          Paste a compact string (<code>WxH:rows:cols</code>), a <code>.non</code> file, JSON, or an ASCII bitmap.
        </p>
        <textarea
          className="import-textarea"
          rows={8}
          placeholder="Paste puzzle text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            fontFamily: 'monospace',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div className="notice" role="alert" style={{ marginTop: '8px' }}>
            {error}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleLoad} disabled={!text.trim()}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
