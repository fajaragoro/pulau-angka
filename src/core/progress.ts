import type { FactId, Profile, Progress } from './types';
import { applyAnswer, getFact, gradeAnswer, isFluentPlus } from './mastery';
import { TOTAL_DAYS, taughtMults } from './curriculum';
import { EXAM_PASS, type SessionAnswer, type SessionPlan } from './session';
import { CORE_FACTS, parseFact } from './facts';
import { addDays, uid } from './util';

export const AVATAR_COLORS = ['#0F8F8A', '#FF6B4A', '#FFC93C', '#7A5CE0', '#2FA463', '#3D8BFF'];

export function newProgress(): Progress {
  return { day: 1, pending: null, lastSessionDate: null, sessionsDone: 0, streak: 0, bestStreak: 0, jurusTaught: [], exams: {}, baseline: {}, final: {}, startedAt: null, completedAt: null };
}

export function newProfile(name: string, grade: number, color: string, shape: number, today: string): Profile {
  return { id: uid(), name: name.trim().slice(0, 16), grade, color, shape, createdAt: today, facts: {}, log: [], progress: newProgress(), bonus: { date: null, count: 0, bestKilat: 0 }, history: [] };
}

/** Kelas 1–2 belum boleh lanjut (kuatkan penjumlahan dulu). */
export const gradeAllowed = (grade: number): boolean => grade >= 3 && grade <= 6;

export const programDone = (p: Profile): boolean => p.progress.completedAt !== null;

/** Akselerasi: paling banyak 3 hari kurikulum per hari kalender. */
export const MAX_SESSIONS_PER_DAY = 3;

export function sessionsToday(p: Profile, today: string): number {
  const pr = p.progress;
  if (pr.todayCount?.date === today) return pr.todayCount.count;
  return pr.lastSessionDate === today ? 1 : 0;
}

/** Sesi wajib hari ini sudah selesai? */
export const dailyDone = (p: Profile, today: string): boolean => sessionsToday(p, today) > 0;

/** Sisa sesi kurikulum yang masih boleh dimainkan hari ini (sesi wajib + akselerasi). */
export function sessionsLeft(p: Profile, today: string): number {
  return programDone(p) ? 0 : Math.max(0, MAX_SESSIONS_PER_DAY - sessionsToday(p, today));
}

export function canPlayToday(p: Profile, today: string): boolean {
  return sessionsLeft(p, today) > 0;
}

export function currentStreak(p: Profile, today: string): number {
  const last = p.progress.lastSessionDate;
  if (last === today || last === addDays(today, -1)) return p.progress.streak;
  return 0;
}

export interface Summary {
  title: string;
  kind: SessionPlan['kind'];
  correct: number;
  fluent: number;
  total: number;
  newFacts: FactId[];
  exam: { island: number; passed: boolean; score: number } | null;
  programCompleted: boolean;
  streak: number;
  newRecord: boolean;
  replay: boolean;
}

/** Terapkan hasil satu sesi (harian, ujian, atau bonus) ke profil. Fungsi murni. */
export function applySession(p: Profile, plan: SessionPlan, answers: SessionAnswer[], today: string): { profile: Profile; summary: Summary } {
  const facts = { ...p.facts };
  const log = p.log.slice();
  const pr: Progress = { ...p.progress, exams: { ...p.progress.exams }, baseline: { ...p.progress.baseline }, final: { ...p.progress.final }, jurusTaught: p.progress.jurusTaught.slice() };
  let bonus = { ...p.bonus };

  for (const a of answers) {
    facts[a.f] = applyAnswer(facts[a.f] ?? getFact(p, a.f), a.ok, a.ms, today);
    log.push({ f: a.f, ok: a.ok, ms: a.ms, d: today, src: a.tag === 'baseline' || a.tag === 'final' || a.tag === 'exam' ? 'ujian' : plan.source });
    // Remedial tidak mengubah peta tes awal/akhir: yang dipakai tetap percobaan pertama.
    if (plan.replay) continue;
    if (a.tag === 'baseline') pr.baseline[a.f] = gradeAnswer(a.ok, a.ms);
    if (a.tag === 'final') pr.final[a.f] = gradeAnswer(a.ok, a.ms);
  }

  const correct = answers.filter((a) => a.ok).length;
  const fluent = answers.filter((a) => gradeAnswer(a.ok, a.ms) === 'fluent').length;
  const summary: Summary = { title: plan.title, kind: plan.kind, correct, fluent, total: answers.length, newFacts: plan.newFacts, exam: null, programCompleted: false, streak: pr.streak, newRecord: false, replay: !!plan.replay };

  if (plan.replay) {
    const remedial = p.remedial?.date === today ? { date: today, count: p.remedial.count + 1 } : { date: today, count: 1 };
    if (plan.kind === 'exam' || plan.kind === 'reexam') {
      const score = answers.length ? correct / answers.length : 0;
      const passed = score >= EXAM_PASS;
      const prev = pr.exams[plan.island];
      pr.exams[plan.island] = { passed: passed || !!prev?.passed, attempts: (prev?.attempts ?? 0) + 1, best: Math.max(prev?.best ?? 0, score) };
      summary.exam = { island: plan.island, passed, score };
      // Lulus saat remedial → ulangan khusus dibatalkan.
      if (passed && pr.pending?.island === plan.island) pr.pending = null;
    }
    return { profile: { ...p, facts, log, progress: pr, remedial }, summary };
  }

  if (plan.kind === 'bonus') {
    bonus = bonus.date === today ? { ...bonus, count: bonus.count + 1 } : { ...bonus, date: today, count: 1 };
    if (plan.bonusMode === 'kilat' && correct > bonus.bestKilat) {
      bonus.bestKilat = correct;
      summary.newRecord = true;
    }
    return { profile: { ...p, facts, log, bonus }, summary };
  }

  for (const ph of plan.phases) if (ph.type === 'jurus') for (const j of ph.jurus) if (!pr.jurusTaught.includes(j.id)) pr.jurusTaught.push(j.id);

  if (plan.kind === 'exam' || plan.kind === 'reexam') {
    const examAns = answers.filter((a) => a.tag === 'exam');
    const score = examAns.length ? examAns.filter((a) => a.ok).length / examAns.length : 0;
    const passed = score >= EXAM_PASS;
    const failed = [...new Set(examAns.filter((a) => !a.ok).map((a) => a.f))].slice(0, 6);
    const prev = pr.exams[plan.island];
    pr.exams[plan.island] = { passed: passed || !!prev?.passed, attempts: (prev?.attempts ?? 0) + 1, best: Math.max(prev?.best ?? 0, score) };
    summary.exam = { island: plan.island, passed, score };
    if (plan.kind === 'exam') {
      pr.day++;
      pr.pending = passed ? null : { island: plan.island, stage: 'remedial1', failed };
    } else {
      pr.pending = passed ? null : { island: plan.island, stage: 'remedial2', failed };
    }
  } else if (plan.kind === 'remedial') {
    pr.pending = pr.pending && pr.pending.stage === 'remedial1' ? { ...pr.pending, stage: 'reexam' } : null;
  } else {
    pr.day++;
  }

  if (pr.day > TOTAL_DAYS && !pr.pending && !pr.completedAt) {
    pr.completedAt = today;
    summary.programCompleted = true;
  }

  pr.streak = pr.lastSessionDate === addDays(today, -1) ? pr.streak + 1 : pr.lastSessionDate === today ? pr.streak : 1;
  pr.bestStreak = Math.max(pr.bestStreak, pr.streak);
  pr.todayCount = { date: today, count: sessionsToday(p, today) + 1 };
  pr.lastSessionDate = today;
  pr.startedAt = pr.startedAt ?? today;
  pr.sessionsDone++;
  summary.streak = pr.streak;

  const history = [...p.history, { date: today, day: plan.day, label: plan.title, correct, total: answers.length }];
  return { profile: { ...p, facts, log, progress: pr, bonus, history, lastPlan: { date: today, plan } }, summary };
}

/* ---------- Peta 10×10 ---------- */

export type CellColor = 'gray' | 'red' | 'yellow' | 'green' | 'blue';

/** Warna kotak peta saat ini: hijau lancar/hafal, kuning lambat, merah salah, biru beres lewat jurus (belum dites), abu belum dites. */
export function mapColor(p: Profile, f: FactId): CellColor {
  const s = getFact(p, f);
  if (isFluentPlus(s)) return 'green';
  if (s.status === 'slow') return 'yellow';
  if (s.status === 'wrong') return 'red';
  const mults = taughtMults(p.progress.day - 1);
  const [a, b] = parseFact(f);
  return mults.includes(a) || mults.includes(b) ? 'blue' : 'gray';
}

export function gradeColor(g: string | undefined): CellColor {
  return g === 'fluent' ? 'green' : g === 'slow' ? 'yellow' : g === 'wrong' ? 'red' : 'gray';
}

export function counts(p: Profile) {
  const all = Object.values(p.facts);
  return {
    mastered: all.filter((s) => s.status === 'mastered').length,
    fluent: all.filter(isFluentPlus).length,
    core: CORE_FACTS.filter((f) => isFluentPlus(getFact(p, f))).length,
    coreMastered: CORE_FACTS.filter((f) => getFact(p, f).status === 'mastered').length,
  };
}

/** Tahap tumbuh makhluk avatar: telur → menetas → tumbuh besar → bintang emas. */
export function growthStage(p: Profile): 0 | 1 | 2 | 3 {
  if (programDone(p)) return 3;
  const d = p.progress.day;
  return d <= 7 ? 0 : d <= 14 ? 1 : 2;
}
export const STAGE_NAMES = ['Telur', 'Baru menetas', 'Tumbuh besar', 'Bintang emas'];
