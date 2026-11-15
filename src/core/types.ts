import type { SessionPlan } from './session';

/** Kunci fakta unik, selalu a ≤ b. Contoh: "7x8". a×b dan b×a berbagi status. */
export type FactId = string;

export type Status = 'untested' | 'wrong' | 'slow' | 'fluent' | 'mastered';
/** Nilai satu jawaban tunggal (dipakai untuk peta tes awal/akhir). */
export type Grade = 'fluent' | 'slow' | 'wrong';
export type Source = 'harian' | 'bonus' | 'ujian';

export interface FactState {
  status: Status;
  /** Kotak Leitner 0..4 */
  box: number;
  /** Tanggal jatuh tempo review (YYYY-MM-DD) */
  due: string | null;
  /** Tanggal-tanggal berbeda ketika fakta dijawab lancar (maks 3 terakhir) */
  fluentDays: string[];
  seen: number;
  correct: number;
  wrong: number;
  /** Jumlah & banyaknya latensi jawaban benar, untuk rata-rata */
  sumMs: number;
  nMs: number;
  lastDate: string | null;
}

export interface AnswerLog {
  f: FactId;
  ok: boolean;
  /** latensi sampai tombol angka pertama; null = dilewati/kehabisan waktu */
  ms: number | null;
  d: string;
  src: Source;
}

export interface Pending {
  island: number;
  stage: 'remedial1' | 'reexam' | 'remedial2';
  failed: FactId[];
}

export interface ExamRecord {
  passed: boolean;
  attempts: number;
  best: number;
}

export interface Progress {
  /** Hari kurikulum berikutnya yang akan dimainkan (1..31; 31 = program selesai) */
  day: number;
  pending: Pending | null;
  lastSessionDate: string | null;
  sessionsDone: number;
  streak: number;
  bestStreak: number;
  jurusTaught: string[];
  exams: Record<string, ExamRecord>;
  baseline: Record<FactId, Grade>;
  final: Record<FactId, Grade>;
  startedAt: string | null;
  completedAt: string | null;
  /** Banyaknya sesi kurikulum yang dimainkan pada satu tanggal (untuk batas akselerasi) */
  todayCount?: { date: string; count: number };
}

export interface HistoryEntry {
  date: string;
  day: number;
  label: string;
  correct: number;
  total: number;
  /** Fakta baru/bandel hari itu (untuk mengulang jurusnya dari peta perjalanan) */
  facts?: FactId[];
}

export interface Profile {
  id: string;
  name: string;
  grade: number;
  color: string;
  shape: number;
  createdAt: string;
  facts: Record<FactId, FactState>;
  log: AnswerLog[];
  progress: Progress;
  bonus: { date: string | null; count: number; bestKilat: number };
  history: HistoryEntry[];
  /** Sesi harian terakhir, supaya bisa diulang (remedial) di hari yang sama */
  lastPlan?: { date: string; plan: SessionPlan };
  remedial?: { date: string; count: number };
}

export interface Account {
  v: 1;
  access: { code: string; at: string } | null;
  profiles: Profile[];
  settings: { sound: boolean };
  lastBackupAt: string | null;
  createdAt: string;
}

export const MAX_PROFILES = 3;
