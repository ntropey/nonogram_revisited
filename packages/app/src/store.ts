/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * localStorage helpers. Stored keys are a contract — do not rename without migration.
 */
import type { AppSettings, StoredGame, StoredSettings } from './types';

const SETTINGS_KEY = 'nonogram.settings';
const GAMES_KEY = 'nonogram.games';
const LIBRARY_KEY = 'nonogram.library';
const MODE_KEY = 'nonogram.mode';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS_EXPORT };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS_EXPORT, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS_EXPORT };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or private mode — settings are non-critical.
  }
}

export function loadGames(): StoredGame[] {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredGame[];
  } catch {
    return [];
  }
}

export function saveGames(games: StoredGame[]): void {
  try {
    localStorage.setItem(GAMES_KEY, JSON.stringify(games));
  } catch {
    // Quota exceeded or private mode.
  }
}

export function loadLibrary(): StoredGame[] {
  return loadGames();
}

export function saveLibrary(games: StoredGame[]): void {
  saveGames(games);
}

export function loadMode(): 'play' | 'train' | 'analyze' {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'play' || raw === 'train' || raw === 'analyze') return raw;
  } catch {
    // fall through
  }
  return 'play';
}

export function saveMode(mode: 'play' | 'train' | 'analyze'): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // non-critical
  }
}

const DEFAULT_SETTINGS_EXPORT: AppSettings = {
  showHighlights: true,
  autoCross: false,
  sound: true,
  preferredDifficulty: null,
  gameMode: 'play',
  theme: 'dark',
};

export type { StoredGame, StoredSettings };
export { SETTINGS_KEY, GAMES_KEY, LIBRARY_KEY, MODE_KEY };
