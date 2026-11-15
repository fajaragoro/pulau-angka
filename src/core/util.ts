/** Tanggal lokal dalam format YYYY-MM-DD. */
export function todayStr(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function toUtc(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = new Date(toUtc(s) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/** b − a dalam hari. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function formatTanggal(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** Ubah teks bersimbol menjadi kalimat yang enak dibacakan (narasi suara). */
export function toSpeech(t: string): string {
  return t
    .replace(/Rp\s?(\d[\d.]*)/g, (_, n: string) => `${n.replace(/\./g, '')} rupiah`)
    .replace(/(\d)-(?=\d)/g, '$1, ')
    .replace(/×/g, ' kali ')
    .replace(/=/g, ' sama dengan ')
    .replace(/\+/g, ' tambah ')
    .replace(/→/g, ' jadi ')
    .replace(/[_…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
