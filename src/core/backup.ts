import type { Account, Profile } from './types';
import { MAX_PROFILES } from './types';
import { isValidFact } from './facts';
import { newProgress } from './progress';
import { diffDays } from './util';

export const BACKUP_APP = 'pulau-angka';
export const BACKUP_REMIND_DAYS = 7;

export function newAccount(today: string): Account {
  return { v: 1, access: null, profiles: [], settings: { sound: true }, lastBackupAt: null, createdAt: today };
}

export function exportBackup(acc: Account, nowIso: string): string {
  return JSON.stringify({ app: BACKUP_APP, v: 1, exportedAt: nowIso, account: acc });
}

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isDate = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

function cleanProfile(raw: unknown): Profile {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !isObj(raw.facts) || !Array.isArray(raw.log) || !isObj(raw.progress)) {
    throw new Error('Data profil di file cadangan tidak lengkap.');
  }
  const facts: Profile['facts'] = {};
  for (const [k, v] of Object.entries(raw.facts)) if (isValidFact(k) && isObj(v) && typeof v.status === 'string') facts[k] = v as any;
  const log = raw.log.filter((l: any) => isObj(l) && isValidFact(l.f) && typeof l.ok === 'boolean' && isDate(l.d));
  const day = Number(raw.progress.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Data progres di file cadangan tidak valid.');
  return {
    id: raw.id,
    name: raw.name.slice(0, 16),
    grade: Number(raw.grade) || 3,
    color: typeof raw.color === 'string' ? raw.color : '#0F8F8A',
    shape: Number(raw.shape) || 0,
    createdAt: isDate(raw.createdAt) ? raw.createdAt : '2025-01-01',
    facts,
    log,
    progress: { ...newProgress(), ...raw.progress },
    bonus: isObj(raw.bonus) ? { date: raw.bonus.date ?? null, count: Number(raw.bonus.count) || 0, bestKilat: Number(raw.bonus.bestKilat) || 0 } : { date: null, count: 0, bestKilat: 0 },
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

/** Baca & validasi file cadangan. Melempar Error berbahasa Indonesia jika tidak valid. */
export function parseBackup(text: string): Account {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File tidak bisa dibaca. Pastikan ini file cadangan Pulau Angka (.json).');
  }
  if (!isObj(data) || data.app !== BACKUP_APP || !isObj(data.account)) throw new Error('Ini bukan file cadangan Pulau Angka.');
  if (data.v !== 1) throw new Error('Versi file cadangan tidak dikenali. Perbarui aplikasi lalu coba lagi.');
  const a = data.account;
  if (!Array.isArray(a.profiles)) throw new Error('File cadangan rusak: daftar profil tidak ditemukan.');
  if (a.profiles.length > MAX_PROFILES) throw new Error(`File cadangan berisi lebih dari ${MAX_PROFILES} profil.`);
  return {
    v: 1,
    access: isObj(a.access) && typeof a.access.code === 'string' ? { code: a.access.code, at: String(a.access.at ?? '') } : null,
    profiles: a.profiles.map(cleanProfile),
    settings: { sound: a.settings?.sound !== false },
    lastBackupAt: isDate(a.lastBackupAt) ? a.lastBackupAt : null,
    createdAt: isDate(a.createdAt) ? a.createdAt : '2025-01-01',
  };
}

/** Perlu pengingat cadangan? (tiap 7 hari, jika sudah ada data latihan) */
export function backupDue(acc: Account, today: string): boolean {
  if (!acc.profiles.some((p) => p.progress.sessionsDone > 0)) return false;
  return diffDays(acc.lastBackupAt ?? acc.createdAt, today) >= BACKUP_REMIND_DAYS;
}

/* ---------- Kode akses ---------- */

export interface AccessConfig {
  code: string;
  /** true: pengguna yang pernah memasukkan kode lama tetap bisa masuk setelah kode diganti */
  keepOldUsers: boolean;
}

export const checkCode = (input: string, cfg: AccessConfig): boolean => input.trim() === cfg.code;

export function accessValid(access: Account['access'], cfg: AccessConfig): boolean {
  if (!access) return false;
  return access.code === cfg.code || cfg.keepOldUsers;
}
