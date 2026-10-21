/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Tiny WebAudio cues. Silent when audio is unavailable or blocked.
 */
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, length: number, gain = 0.05): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, ctx.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + length);
}

function ensure(): boolean {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export function playTick(): void {
  if (ensure()) tone(520, 0, 0.06, 0.03);
}

export function playSolved(): void {
  if (!ensure()) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.35));
}
