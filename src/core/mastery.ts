import type { FactId, FactState, Grade, Profile } from './types';
import { addDays } from './util';

/** "Lancar" = benar DAN latensi ≤ 3000 ms. */
export const FLUENT_MS = 3000;
/** "Hafal" = lancar di 3 hari berbeda. */
export const MASTER_DAYS = 3;
/** Interval review Leitner (hari). */
export const INTERVALS = [1, 2, 4, 7];

export function newFactState(): FactState {
  return { status: 'untested', box: 0, due: null, fluentDays: [], seen: 0, correct: 0, wrong: 0, sumMs: 0, nMs: 0, lastDate: null };
}

export function gradeAnswer(ok: boolean, ms: number | null): Grade {
  if (!ok) return 'wrong';
  return ms !== null && ms <= FLUENT_MS ? 'fluent' : 'slow';
}

/** Terapkan satu jawaban ke status fakta. Fungsi murni. */
export function applyAnswer(s: FactState, ok: boolean, ms: number | null, date: string): FactState {
  const n: FactState = { ...s, fluentDays: s.fluentDays.slice(), seen: s.seen + 1, lastDate: date };
  const g = gradeAnswer(ok, ms);
  if (g === 'wrong') {
    n.wrong++;
    // Salah setelah hafal → turun ke "belajar" dan dijadwalkan ulang lebih cepat.
    if (s.status === 'mastered') n.fluentDays = [];
    n.status = 'wrong';
    n.box = 0;
    n.due = addDays(date, 1);
    return n;
  }
  n.correct++;
  if (ms !== null) {
    n.sumMs += ms;
    n.nMs++;
  }
  if (g === 'fluent') {
    if (!n.fluentDays.includes(date)) {
      n.fluentDays = [...n.fluentDays, date].slice(-MASTER_DAYS);
      n.box = Math.min(n.box + 1, INTERVALS.length);
    }
    n.status = n.fluentDays.length >= MASTER_DAYS ? 'mastered' : 'fluent';
    n.due = addDays(date, INTERVALS[Math.max(n.box, 1) - 1]);
  } else {
    n.status = s.status === 'mastered' ? 'mastered' : 'slow';
    n.due = addDays(date, 1);
  }
  return n;
}

export const getFact = (p: Profile, f: FactId): FactState => p.facts[f] ?? newFactState();

export const isFluentPlus = (s: FactState): boolean => s.status === 'fluent' || s.status === 'mastered';

/** Skor "bandel": makin besar makin perlu dilatih. */
export function struggleScore(s: FactState): number {
  if (s.seen === 0) return 0;
  const avg = s.nMs ? s.sumMs / s.nMs : 6000;
  const statusW = s.status === 'wrong' ? 6 : s.status === 'slow' ? 4 : s.status === 'fluent' ? 1 : 0;
  return statusW + (s.wrong / s.seen) * 4 + Math.min(avg, 6000) / 2000;
}
