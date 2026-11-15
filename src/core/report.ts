import type { FactId, Profile } from './types';
import { ALL_FACTS, CORE_FACTS, familyFacts } from './facts';
import { getFact, isFluentPlus, struggleScore } from './mastery';
import { counts, programDone } from './progress';
import { TOTAL_DAYS } from './curriculum';
import { addDays } from './util';

export type Level = 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan' | 'Belum Dinilai';

export interface MateriRow {
  title: string;
  fluent: number;
  total: number;
  level: Level;
  note: string;
}

export interface Report {
  name: string;
  grade: number;
  date: string;
  /** Hari kurikulum yang sudah diselesaikan (0..30) */
  day: number;
  totalDays: number;
  isFinal: boolean;
  mastered: number;
  fluent: number;
  tested: number;
  core: number;
  needPractice: FactId[];
  avgMs: number | null;
  baselineFluent: number | null;
  streak: number;
  materi: MateriRow[];
  capaian: string;
}

export const CAPAIAN = 'Perkalian bilangan cacah sampai 100 — Fase B (Elemen Bilangan)';

function level(fluent: number, total: number, tested: number): Level {
  if (tested === 0) return 'Belum Dinilai';
  const r = fluent / total;
  return r >= 0.9 ? 'Sangat Baik' : r >= 0.7 ? 'Baik' : r >= 0.4 ? 'Cukup' : 'Perlu Bimbingan';
}

function note(name: string, lv: Level, materi: string): string {
  switch (lv) {
    case 'Sangat Baik':
      return `Ananda ${name} sudah menjawab ${materi} dengan cepat dan tepat tanpa menghitung ulang.`;
    case 'Baik':
      return `Ananda ${name} sudah menguasai sebagian besar ${materi}; beberapa fakta masih perlu dipercepat.`;
    case 'Cukup':
      return `Ananda ${name} mulai menguasai ${materi}, namun masih sering menghitung satu per satu.`;
    case 'Perlu Bimbingan':
      return `Ananda ${name} masih memerlukan bimbingan dan latihan rutin pada ${materi}.`;
    default:
      return `Materi ${materi} belum dinilai.`;
  }
}

/** Susun data Rapor Guru dari profil. Fungsi murni. */
export function buildReport(p: Profile, today: string): Report {
  const c = counts(p);
  const groups: [string, FactId[]][] = [
    ['perkalian dengan 1 dan 10', familyFacts([1, 10])],
    ['perkalian dengan 2 dan 5', familyFacts([2, 5]).filter((f) => !familyFacts([1, 10]).includes(f))],
    ['perkalian dengan 9', familyFacts([9]).filter((f) => !familyFacts([1, 10, 2, 5]).includes(f))],
    ['perkalian 3, 4, 6, 7, dan 8 (fakta inti)', CORE_FACTS],
  ];
  const materi = groups.map(([title, facts]): MateriRow => {
    const fl = facts.filter((f) => isFluentPlus(getFact(p, f))).length;
    const tested = facts.filter((f) => getFact(p, f).seen > 0).length;
    const lv = level(fl, facts.length, tested);
    return { title: title[0].toUpperCase() + title.slice(1), fluent: fl, total: facts.length, level: lv, note: note(p.name, lv, title) };
  });

  const needPractice = ALL_FACTS.filter((f) => {
    const s = getFact(p, f).status;
    return s === 'wrong' || s === 'slow';
  }).sort((a, b) => struggleScore(getFact(p, b)) - struggleScore(getFact(p, a)));

  const since = addDays(today, -7);
  let recent = p.log.filter((l) => l.ok && l.ms !== null && l.d >= since);
  if (recent.length === 0) recent = p.log.filter((l) => l.ok && l.ms !== null);
  const avgMs = recent.length ? Math.round(recent.reduce((s, l) => s + l.ms!, 0) / recent.length) : null;

  const base = Object.values(p.progress.baseline);
  return {
    name: p.name,
    grade: p.grade,
    date: today,
    day: Math.min(p.progress.day - 1, TOTAL_DAYS),
    totalDays: TOTAL_DAYS,
    isFinal: programDone(p),
    mastered: c.mastered,
    fluent: c.fluent,
    tested: Object.values(p.facts).filter((s) => s.seen > 0).length,
    core: c.core,
    needPractice,
    avgMs,
    baselineFluent: base.length ? base.filter((g) => g === 'fluent').length : null,
    streak: p.progress.bestStreak,
    materi,
    capaian: CAPAIAN,
  };
}

export function reportShareText(r: Report): string {
  return (
    `${r.isFinal ? 'Rapor Akhir' : 'Rapor Guru'} Pulau Angka — ${r.name} (kelas ${r.grade})\n` +
    `Hari ke-${r.day} dari ${r.totalDays}\n` +
    `Lancar: ${r.fluent}/55 fakta perkalian, hafal: ${r.mastered}/55\n` +
    `Fakta inti: ${r.core}/15` +
    (r.avgMs !== null ? `\nRata-rata waktu menjawab: ${(r.avgMs / 1000).toFixed(1)} detik` : '')
  );
}
