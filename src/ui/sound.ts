import { toSpeech } from '../core/util';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean): void {
  enabled = on;
  if (!on) stopSpeak();
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

let speakTimer = 0;
let voice: SpeechSynthesisVoice | null = null;

function loadVoice(): void {
  try {
    const all = speechSynthesis.getVoices();
    voice = all.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('id')) ?? null;
  } catch {
    /* abaikan */
  }
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoice();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoice);
}

/**
 * Narasi suara berbahasa Indonesia (suara bawaan perangkat, jalan offline).
 * Ucapan baru dijadwalkan sedikit setelah cancel(): di Chrome/Android, speak() yang dipanggil
 * tepat setelah cancel() sering gagal atau terpotong.
 */
export function speak(text: string): void {
  if (typeof speechSynthesis === 'undefined') return;
  window.clearTimeout(speakTimer);
  if (!enabled) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    speakTimer = window.setTimeout(() => {
      try {
        if (!voice) loadVoice();
        const u = new SpeechSynthesisUtterance(toSpeech(text));
        u.lang = 'id-ID';
        u.rate = 0.92;
        if (voice) u.voice = voice;
        speechSynthesis.resume();
        speechSynthesis.speak(u);
      } catch {
        /* narasi tidak tersedia */
      }
    }, 120);
  } catch {
    /* narasi tidak tersedia */
  }
}

export function stopSpeak(): void {
  try {
    window.clearTimeout(speakTimer);
    if (typeof speechSynthesis !== 'undefined' && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  } catch {
    /* abaikan */
  }
}
