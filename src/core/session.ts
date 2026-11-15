import type { FactId, Profile, Source } from './types';
import { CORE_FACTS, JURUS_FACTS, familyFacts, parseFact } from './facts';
import { getFact, isFluentPlus, struggleScore } from './mastery';
import { EXAM_CORE, ISLAND_NAMES, baselinePart, coreIntroduced, dayDef, finalPart, learnedFacts } from './curriculum';
import { type Jurus, jurus5678, jurusForFact, jurusSwap, jurusX10X1, jurusX2, jurusX5, jurusX9 } from './jurus';
import { type Rng, shuffle } from './util';

/** Sesi harian: hard cap 180 detik. */
export const SESSION_CAP_MS = 180_000;
export const WARMUP_MS = 30_000;
export const BONUS_MS = 60_000;
export const BONUS_PER_DAY = 3;
/** Soal bertipe tes otomatis dilewati setelah 6 detik. */
export const TEST_TIMEOUT_MS = 6_000;
export const EXAM_PASS = 0.8;

export type Tag = 'baseline' | 'final' | 'exam' | 'warmup' | 'practice' | 'demo';
export type BonusMode = 'kilat' | 'revans' | 'acak';

export type Phase =
  | { type: 'quiz'; tag: Tag; label: string; items: FactId[]; budgetMs: number | null; test: boolean }
  | { type: 'jurus'; label: string; jurus: Jurus[] }
  | { type: 'practice'; tag: Tag; label: string; newFacts: FactId[]; known: FactId[]; endWhenTamed?: boolean };

export type PlanKind = 'lesson' | 'review' | 'exam' | 'bandel' | 'final' | 'remedial' | 'reexam' | 'bonus' | 'demo';

export interface SessionPlan {
  kind: PlanKind;
  title: string;
  day: number;
  island: number;
  capMs: number;
  source: Source;
  phases: Phase[];
  newFacts: FactId[];
  bonusMode?: BonusMode;
  /** true = remedial: mengulang sesi hari ini, tidak membuka hari baru */
  replay?: boolean;
}

export interface SessionAnswer {
  f: FactId;
  ok: boolean;
  ms: number | null;
  tag: Tag;
}

/* ---------- Incremental rehearsal ---------- */

/**
 * Antrean latihan inti: 1 fakta baru diselipkan di antara fakta yang sudah dikuasai
 * (B K B K K B K K K B), dan jawaban salah muncul lagi ±3 soal kemudian.
 */
export class PracticeQueue {
  private plan: FactId[] = [];
  private retry: { f: FactId; wait: number }[] = [];
  private last: FactId | null = null;
  private knownOrder: FactId[] = [];
  private cycles = 0;

  constructor(
    private news: FactId[],
    private known: FactId[],
    private rng: Rng = Math.random,
  ) {
    if (news.length === 0 && known.length === 0) throw new Error('PracticeQueue butuh minimal satu fakta');
  }

  private k(): FactId {
    const pool = this.known.length ? this.known : this.news;
    if (this.knownOrder.length === 0) this.knownOrder = shuffle(pool, this.rng);
    return this.knownOrder.shift()!;
  }

  private refill(): void {
    if (this.news.length === 0) {
      this.plan.push(...shuffle(this.known, this.rng));
    } else if (this.cycles === 0) {
      for (const n of this.news) this.plan.push(n, this.k(), n, this.k(), this.k(), n, this.k(), this.k(), this.k(), n);
    } else {
      for (const n of shuffle(this.news, this.rng)) this.plan.push(n, this.k(), this.k());
    }
    this.cycles++;
  }

  next(): FactId {
    for (const r of this.retry) r.wait--;
    const ri = this.retry.findIndex((r) => r.wait <= 0 && r.f !== this.last);
    if (ri >= 0) {
      const [r] = this.retry.splice(ri, 1);
      this.last = r.f;
      return r.f;
    }
    for (let guard = 0; guard < 50; guard++) {
      if (this.plan.length === 0) this.refill();
      const f = this.plan.shift()!;
      if (f !== this.last || guard > 20) {
        this.last = f;
        return f;
      }
    }
    return this.last!;
  }

  report(f: FactId, ok: boolean): void {
    if (!ok && !this.retry.some((r) => r.f === f)) this.retry.push({ f, wait: 4 });
  }
}

/* ---------- Pemilihan fakta ---------- */

const STATUS_RANK: Record<string, number> = { wrong: 0, slow: 1, untested: 2, fluent: 3, mastered: 4 };

/** Fakta jatuh tempo review untuk pemanasan (hanya dari fakta yang sudah dipelajari / sudah lancar). */
export function dueFacts(p: Profile, today: string, max = 12): FactId[] {
  const done = p.progress.day - 1;
  const learned = new Set(learnedFacts(done));
  const cands = Object.keys(p.facts).filter((f) => {
    const s = p.facts[f];
    return s.seen > 0 && (learned.has(f) || isFluentPlus(s));
  });
  const due = cands
    .filter((f) => p.facts[f].due !== null && p.facts[f].due! <= today)
    .sort((a, b) => {
      const sa = p.facts[a];
      const sb = p.facts[b];
      return STATUS_RANK[sa.status] - STATUS_RANK[sb.status] || (sa.due! < sb.due! ? -1 : sa.due! > sb.due! ? 1 : 0);
    });
  if (due.length) return due.slice(0, max);
  return cands.sort((a, b) => ((p.facts[a].lastDate ?? '') < (p.facts[b].lastDate ?? '') ? -1 : 1)).slice(0, 6);
}

/** Pilih sampai n fakta yang paling perlu dilatih dari kandidat. */
export function pickWeak(p: Profile, cands: FactId[], n: number, rng: Rng): FactId[] {
  const weak = shuffle(cands, rng)
    .filter((f) => !isFluentPlus(getFact(p, f)))
    .sort((a, b) => STATUS_RANK[getFact(p, a).status] - STATUS_RANK[getFact(p, b).status])
    .slice(0, n);
  if (weak.length >= Math.min(2, cands.length)) return weak;
  const rest = shuffle(cands, rng).filter((f) => !weak.includes(f));
  return [...weak, ...rest].slice(0, Math.min(2, cands.length));
}

/** Kumpulan fakta yang sudah dikuasai sebagai "selingan" incremental rehearsal. */
export function knownPool(p: Profile, exclude: FactId[], rng: Rng): FactId[] {
  const ex = new Set(exclude);
  const fluent = Object.keys(p.facts).filter((f) => !ex.has(f) && isFluentPlus(p.facts[f]));
  let pool = shuffle(fluent, rng);
  if (pool.length < 6) {
    const extra = shuffle([...learnedFacts(p.progress.day - 1), ...familyFacts([1])], rng).filter((f) => !ex.has(f) && !pool.includes(f));
    pool = [...pool, ...extra].slice(0, 6);
  }
  return pool.slice(0, 12);
}

/** Fakta bandel personal: paling lambat / paling sering salah menurut data anak. */
export function bandelFacts(p: Profile, n: number, rng: Rng): FactId[] {
  const cands = Object.keys(p.facts)
    .filter((f) => p.facts[f].seen > 0 && p.facts[f].status !== 'mastered')
    .sort((a, b) => struggleScore(p.facts[b]) - struggleScore(p.facts[a]));
  if (cands.length >= n) return cands.slice(0, n);
  return [...cands, ...shuffle(CORE_FACTS, rng).filter((f) => !cands.includes(f))].slice(0, n);
}

function noAdjacentDup(items: FactId[], rng: Rng): FactId[] {
  let best = items;
  for (let i = 0; i < 30; i++) {
    best = shuffle(items, rng);
    if (best.every((f, j) => j === 0 || f !== best[j - 1])) break;
  }
  return best;
}

export function examItems(island: number, rng: Rng): FactId[] {
  if (island === 1) return shuffle(JURUS_FACTS, rng).slice(0, 24);
  if (island === 2) return noAdjacentDup([...EXAM_CORE[2], ...EXAM_CORE[2]], rng);
  if (island === 3) return noAdjacentDup([...EXAM_CORE[3], ...EXAM_CORE[3], ...EXAM_CORE[2]], rng);
  return shuffle([...CORE_FACTS, ...shuffle(JURUS_FACTS, rng).slice(0, 10)], rng);
}

/* ---------- Penyusun sesi ---------- */

const FAMILY_JURUS: Record<string, () => Jurus> = { x10x1: jurusX10X1, x2: () => jurusX2(), x5: () => jurusX5(), swap: jurusSwap, x9: () => jurusX9() };

function warmup(p: Profile, today: string): Phase[] {
  const items = dueFacts(p, today);
  return items.length ? [{ type: 'quiz', tag: 'warmup', label: 'Pemanasan', items, budgetMs: WARMUP_MS, test: false }] : [];
}

function practice(p: Profile, news: FactId[], rng: Rng): Phase {
  return { type: 'practice', tag: 'practice', label: 'Latihan inti', newFacts: news, known: knownPool(p, news, rng) };
}

function examPlan(island: number, day: number, reexam: boolean, rng: Rng): SessionPlan {
  return {
    kind: reexam ? 'reexam' : 'exam',
    title: `${reexam ? 'Ujian Ulang' : 'Ujian'} Pulau ${island}`,
    day,
    island,
    capMs: SESSION_CAP_MS,
    source: 'ujian',
    newFacts: [],
    phases: [{ type: 'quiz', tag: 'exam', label: `Ujian Pulau ${island}`, items: examItems(island, rng), budgetMs: null, test: true }],
  };
}

/** Susun sesi harian berikutnya untuk sebuah profil. Fungsi murni (rng disuntikkan). */
export function buildDailyPlan(p: Profile, today: string, rng: Rng = Math.random): SessionPlan {
  const pr = p.progress;
  const done = pr.day - 1;
  const base = { capMs: SESSION_CAP_MS, source: 'harian' as Source };

  if (pr.pending) {
    const { island, stage, failed } = pr.pending;
    if (stage === 'reexam') return examPlan(island, pr.day, true, rng);
    const news = failed.length ? failed.slice(0, 4) : pickWeak(p, island === 1 ? JURUS_FACTS : EXAM_CORE[island], 3, rng);
    return {
      ...base,
      kind: 'remedial',
      title: `Ulangan Khusus Pulau ${island}`,
      day: pr.day,
      island,
      newFacts: news,
      phases: [{ type: 'jurus', label: 'Ingat jurusnya', jurus: news.slice(0, 2).map(jurusForFact) }, ...warmup(p, today), practice(p, news, rng)],
    };
  }

  const d = dayDef(pr.day);
  const head = { ...base, title: d.title, day: d.day, island: d.island };

  if (d.kind === 'exam') return { ...examPlan(d.island, d.day, false, rng), title: d.title };

  if (d.kind === 'final') {
    return {
      ...head,
      kind: 'final',
      source: 'ujian',
      newFacts: [],
      phases: [{ type: 'quiz', tag: 'final', label: d.title, items: shuffle(finalPart(d.part!), rng), budgetMs: null, test: true }],
    };
  }

  if (d.kind === 'review') {
    const news = pickWeak(p, learnedFacts(done), 4, rng);
    return { ...head, kind: 'review', newFacts: [], phases: [...warmup(p, today), practice(p, news, rng)] };
  }

  if (d.kind === 'bandel') {
    const news = bandelFacts(p, 2, rng);
    return {
      ...head,
      kind: 'bandel',
      newFacts: news,
      phases: [{ type: 'jurus', label: 'Jurus untuk si bandel', jurus: news.map(jurusForFact) }, ...warmup(p, today), practice(p, news, rng)],
    };
  }

  // lesson: jurus dipelajari dulu, baru soal (tes awal/pemanasan), lalu latihan inti.
  let news: FactId[];
  let jurus: Jurus[];
  if (d.newFacts) {
    news = d.newFacts;
    jurus = news.map(jurusForFact);
  } else {
    jurus = [FAMILY_JURUS[d.jurus!]()];
    const cands = d.family
      ? familyFacts(d.family)
      : learnedFacts(done).filter((f) => {
          const [a, b] = parseFact(f);
          return a !== b;
        });
    news = pickWeak(p, cands, 4, rng);
  }
  const phases: Phase[] = [{ type: 'jurus', label: 'Jurus baru', jurus }];
  if (d.part !== undefined && d.day <= 3) {
    phases.push({ type: 'quiz', tag: 'baseline', label: `Tes awal bagian ${d.part + 1}`, items: shuffle(baselinePart(d.part), rng), budgetMs: null, test: true });
  } else {
    phases.push(...warmup(p, today));
  }
  phases.push(practice(p, news, rng));
  return { ...head, kind: 'lesson', newFacts: d.newFacts ?? [], phases };
}

/** Jurus yang diajarkan pada satu hari kurikulum (untuk mengulang pelajaran dari peta perjalanan). */
export function dayJurus(day: number, facts: FactId[] = []): Jurus[] {
  const d = dayDef(day);
  if (d.jurus) return [FAMILY_JURUS[d.jurus]()];
  return (d.newFacts ?? facts).map(jurusForFact);
}

/* ---------- Remedial: ulangi soal hari ini ---------- */

export const REMEDIAL_PER_DAY = 2;

export function remedialLeft(p: Profile, today: string): number {
  if (p.lastPlan?.date !== today) return 0;
  return p.remedial?.date === today ? Math.max(0, REMEDIAL_PER_DAY - p.remedial.count) : REMEDIAL_PER_DAY;
}

/** Sesi yang sama dengan sesi harian hari ini, untuk anak yang belum puas dengan hasilnya. */
export function buildReplayPlan(p: Profile, today: string): SessionPlan | null {
  if (remedialLeft(p, today) === 0 || !p.lastPlan) return null;
  return { ...p.lastPlan.plan, replay: true };
}

/** Kantin terbuka setelah sesi harian hari ini selesai (atau setelah program tamat). */
export const kantinOpen = (p: Profile, today: string): boolean => p.progress.lastSessionDate === today || p.progress.completedAt !== null;

/* ---------- Ronde Bonus ---------- */

export function bonusPool(p: Profile, mode: BonusMode): FactId[] {
  const done = p.progress.day - 1;
  if (mode === 'kilat') return learnedFacts(done);
  if (mode === 'revans') return coreIntroduced(done);
  return Object.keys(p.facts).filter((f) => p.facts[f].status === 'wrong' || p.facts[f].status === 'slow');
}

export function bonusLeft(p: Profile, today: string): number {
  return p.bonus.date === today ? Math.max(0, BONUS_PER_DAY - p.bonus.count) : BONUS_PER_DAY;
}

/** Ronde Bonus terbuka setelah sesi harian hari ini selesai (atau setelah program tamat). */
export function bonusOpen(p: Profile, today: string): boolean {
  return (p.progress.lastSessionDate === today || p.progress.completedAt !== null) && bonusLeft(p, today) > 0;
}

export const BONUS_TITLES: Record<BonusMode, string> = { kilat: 'Tantangan Kilat', revans: 'Revans Bandel', acak: 'Pulau Acak' };

export function buildBonusPlan(p: Profile, mode: BonusMode): SessionPlan | null {
  const pool = bonusPool(p, mode);
  if (pool.length === 0) return null;
  return {
    kind: 'bonus',
    title: BONUS_TITLES[mode],
    day: p.progress.day,
    island: dayDef(p.progress.day).island,
    capMs: BONUS_MS,
    source: 'bonus',
    newFacts: [],
    bonusMode: mode,
    phases: [{ type: 'practice', tag: 'practice', label: BONUS_TITLES[mode], newFacts: [], known: pool }],
  };
}

/* ---------- Demo Hari 1 ---------- */

export const DEMO_SAMPLES: FactId[] = ['2x7', '5x6', '4x9', '5x8', '7x9'];

export function buildDemoPlan(rng: Rng = Math.random): SessionPlan {
  const core = shuffle(CORE_FACTS, rng);
  const samples = shuffle(DEMO_SAMPLES, rng);
  const items: FactId[] = [];
  // Selang-seling: 1 sampel mudah lalu 3 fakta inti.
  for (let i = 0; i < 5; i++) items.push(samples[i], ...core.slice(i * 3, i * 3 + 3));
  return {
    kind: 'demo',
    title: 'Demo Hari 1',
    day: 1,
    island: 1,
    capMs: SESSION_CAP_MS,
    source: 'harian',
    newFacts: ['7x8'],
    phases: [
      { type: 'quiz', tag: 'demo', label: 'Tes kilat', items, budgetMs: 60_000, test: true },
      { type: 'jurus', label: 'Jurus baru', jurus: [jurusX10X1(), jurus5678()] },
      { type: 'practice', tag: 'practice', label: 'Jinakkan makhluk bandel', newFacts: ['7x8'], known: ['3x10', '1x6', '7x10', '1x9', '4x10', '1x8'], endWhenTamed: true },
    ],
  };
}

export const islandName = (i: number): string => ISLAND_NAMES[i] ?? '';
