let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean): void {
  enabled = on;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur);
}

export function sfx(kind: 'ok' | 'no' | 'tap' | 'win'): void {
  if (!enabled) return;
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    if (kind === 'ok') {
      tone(660, 0, 0.1);
      tone(990, 0.08, 0.16);
    } else if (kind === 'no') {
      tone(220, 0, 0.22, 'sine', 0.1);
    } else if (kind === 'tap') {
      tone(520, 0, 0.05, 'sine', 0.05);
    } else {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2));
    }
  } catch {
    /* audio tidak tersedia */
  }
}
