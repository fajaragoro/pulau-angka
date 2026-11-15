import type { FactId } from './types';
import { ALL_FACTS, CORE_FACTS, familyFacts } from './facts';

export const TOTAL_DAYS = 30;

export type DayKind = 'lesson' | 'review' | 'exam' | 'bandel' | 'final';

export interface DayDef {
  day: number;
  island: number;
  kind: DayKind;
  title: string;
  /** Bagian tes awal (0..2) atau tes akhir (0..1) */
  part?: number;
  /** Jurus keluarga (pengali yang "beres" lewat jurus ini) */
  family?: number[];
  jurus?: 'x10x1' | 'x2' | 'x5' | 'swap' | 'x9';
  /** Fakta inti baru hari ini */
  newFacts?: FactId[];
}

const L = (day: number, island: number, title: string, extra: Partial<DayDef> = {}): DayDef => ({ day, island, kind: 'lesson', title, ...extra });

export const DAYS: DayDef[] = [
  L(1, 1, 'Tes awal 1 + Jurus ×10 & ×1', { part: 0, family: [1, 10], jurus: 'x10x1' }),
  L(2, 1, 'Tes awal 2 + Jurus Kembar ×2', { part: 1, family: [2], jurus: 'x2' }),
  L(3, 1, 'Tes awal 3 + Jurus Setengah ×5', { part: 2, family: [5], jurus: 'x5' }),
  L(4, 1, 'Jurus Bolak-balik', { jurus: 'swap' }),
  L(5, 1, 'Jurus Jari ×9', { family: [9], jurus: 'x9' }),
  { day: 6, island: 1, kind: 'review', title: 'Review campur' },
  { day: 7, island: 1, kind: 'exam', title: 'Ujian Pulau 1' },
  L(8, 2, '×3 = dobel + satu lagi', { newFacts: ['3x3', '3x4'] }),
  L(9, 2, 'Makhluk 3×6 dan 3×7', { newFacts: ['3x6', '3x7'] }),
  L(10, 2, 'Makhluk 3×8', { newFacts: ['3x8'] }),
  L(11, 2, '×4 = dobel-dobel', { newFacts: ['4x4', '4x6'] }),
  L(12, 2, 'Makhluk 4×7 dan 4×8', { newFacts: ['4x7', '4x8'] }),
  { day: 13, island: 2, kind: 'review', title: 'Review Pulau 2' },
  { day: 14, island: 2, kind: 'exam', title: 'Ujian Pulau 2' },
  L(15, 3, '×6 = ×5 + satu lagi', { newFacts: ['6x6'] }),
  L(16, 3, 'Makhluk 6×7', { newFacts: ['6x7'] }),
  L(17, 3, 'Makhluk 6×8', { newFacts: ['6x8'] }),
  L(18, 3, '×8 = dobel tiga kali', { newFacts: ['8x8'] }),
  L(19, 3, 'Si paling bandel: 7×8', { newFacts: ['7x8'] }),
  { day: 20, island: 3, kind: 'review', title: 'Review Pulau 3' },
  { day: 21, island: 3, kind: 'exam', title: 'Ujian Pulau 3' },
  L(22, 4, 'Fakta inti terakhir: 7×7', { newFacts: ['7x7'] }),
  ...[23, 24, 25, 26, 27].map((day): DayDef => ({ day, island: 4, kind: 'bandel', title: 'Fakta bandel pribadi' })),
  { day: 28, island: 4, kind: 'exam', title: 'Ujian Pulau 4' },
  { day: 29, island: 5, kind: 'final', title: 'Tes akhir bagian 1', part: 0 },
  { day: 30, island: 5, kind: 'final', title: 'Tes akhir bagian 2', part: 1 },
];

export const ISLAND_NAMES = ['', 'Pulau Jurus', 'Pulau Tiga-Empat', 'Pulau Enam-Delapan', 'Pulau Bandel', 'Puncak Angka'];

export const dayDef = (day: number): DayDef => DAYS[Math.min(Math.max(day, 1), TOTAL_DAYS) - 1];

/** Fakta inti yang diperkenalkan sampai (dan termasuk) hari kurikulum tertentu. */
export function coreIntroduced(daysCompleted: number): FactId[] {
  return DAYS.filter((d) => d.day <= daysCompleted).flatMap((d) => d.newFacts ?? []);
}

/** Pengali yang jurusnya sudah diajarkan setelah sekian hari selesai. */
export function taughtMults(daysCompleted: number): number[] {
  return DAYS.filter((d) => d.day <= daysCompleted).flatMap((d) => d.family ?? []);
}

/** Semua fakta yang sudah dipelajari (jurus keluarga + fakta inti) setelah sekian hari selesai. */
export function learnedFacts(daysCompleted: number): FactId[] {
  const set = new Set<FactId>([...familyFacts(taughtMults(daysCompleted)), ...coreIntroduced(daysCompleted)]);
  return ALL_FACTS.filter((f) => set.has(f));
}

/** Fakta yang diuji per ujian pulau. */
export const EXAM_CORE: Record<number, FactId[]> = {
  2: ['3x3', '3x4', '3x6', '3x7', '3x8', '4x4', '4x6', '4x7', '4x8'],
  3: ['6x6', '6x7', '6x8', '7x8', '8x8'],
  4: CORE_FACTS,
};

/** Tes awal: 55 fakta dibagi 3 bagian (19/18/18), tiap bagian campuran mudah–sulit. */
export function baselinePart(part: number): FactId[] {
  return ALL_FACTS.filter((_, i) => i % 3 === part);
}

/** Tes akhir: format identik dengan tes awal, dibagi 2 hari (28/27). */
export function finalPart(part: number): FactId[] {
  return ALL_FACTS.filter((_, i) => i % 2 === part);
}
