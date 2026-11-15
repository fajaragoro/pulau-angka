import type { FactId } from './types';
import { parseFact } from './facts';
import { type Rng, shuffle } from './util';

/** Maksimal soal cerita per kunjungan ke kantin. */
export const KANTIN_MAX = 10;

export type KantinIcon = 'donat' | 'minum' | 'roti' | 'nasi';
export type KantinKind = 'total' | 'kembalian' | 'totalKembalian' | 'duaJenis' | 'bisaBeli';

export interface KantinQuestion {
  kind: KantinKind;
  icon: KantinIcon;
  text: string;
  answer: number;
  /** 'rp' = jawaban dalam rupiah, 'buah' = jawaban berupa banyaknya barang */
  unit: 'rp' | 'buah';
  /** Cara menghitung, ditampilkan setelah menjawab */
  explain: string;
}

const ITEMS: { name: string; icon: KantinIcon }[] = [
  { name: 'donat', icon: 'donat' },
  { name: 'es teh', icon: 'minum' },
  { name: 'susu kotak', icon: 'minum' },
  { name: 'roti cokelat', icon: 'roti' },
  { name: 'pisang goreng', icon: 'roti' },
  { name: 'bakwan', icon: 'roti' },
  { name: 'nasi kuning', icon: 'nasi' },
  { name: 'mi goreng', icon: 'nasi' },
];

export const rupiah = (n: number): string => 'Rp' + n.toLocaleString('id-ID');

const pick = <T>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];
const rb = (n: number) => n * 1000;

/** Uang pecahan terkecil yang cukup untuk membayar. */
function payWith(total: number, rng: Rng): number {
  const notes = [5000, 10000, 20000, 50000, 100000].filter((n) => n > total);
  if (notes.length === 0) return Math.ceil((total + 1) / 50000) * 50000;
  return notes.length > 1 && rng() < 0.3 ? notes[1] : notes[0];
}

function make(kind: KantinKind, name: string, fact: FactId, rng: Rng): KantinQuestion {
  const item = pick(ITEMS, rng);
  const [x, y] = parseFact(fact);
  // harga = a ribu, banyaknya = b (diacak urutannya; banyaknya minimal 2)
  let [a, b] = rng() < 0.5 ? [x, y] : [y, x];
  if (b < 2) [a, b] = [b, a];
  if (b < 2) b = 2;
  const price = rb(a);
  const total = price * b;
  switch (kind) {
    case 'total':
      return { kind, icon: item.icon, unit: 'rp', answer: total, text: `Harga satu ${item.name} ${rupiah(price)}. ${name} membeli ${b} ${item.name}. Berapa rupiah yang harus dibayar ${name}?`, explain: `${b} × ${rupiah(price)} = ${rupiah(total)}` };
    case 'kembalian': {
      const p = rb(1 + Math.floor(rng() * 9));
      const pay = payWith(p, rng);
      return { kind, icon: item.icon, unit: 'rp', answer: pay - p, text: `${name} membeli satu ${item.name} seharga ${rupiah(p)}. ${name} membayar dengan uang ${rupiah(pay)}. Berapa rupiah kembalian yang harus diterima ${name}?`, explain: `${rupiah(pay)} − ${rupiah(p)} = ${rupiah(pay - p)}` };
    }
    case 'totalKembalian': {
      const pay = payWith(total, rng);
      return {
        kind,
        icon: item.icon,
        unit: 'rp',
        answer: pay - total,
        text: `${name} membeli ${b} ${item.name}. Harga satu ${item.name} ${rupiah(price)}. ${name} membayar dengan uang ${rupiah(pay)}. Berapa rupiah kembaliannya?`,
        explain: `${b} × ${rupiah(price)} = ${rupiah(total)}, lalu ${rupiah(pay)} − ${rupiah(total)} = ${rupiah(pay - total)}`,
      };
    }
    case 'duaJenis': {
      const other = pick(
        ITEMS.filter((i) => i.name !== item.name),
        rng,
      );
      const p2 = rb(1 + Math.floor(rng() * 5));
      return {
        kind,
        icon: item.icon,
        unit: 'rp',
        answer: total + p2,
        text: `${name} membeli ${b} ${item.name} seharga ${rupiah(price)} per buah, dan satu ${other.name} seharga ${rupiah(p2)}. Berapa rupiah semuanya?`,
        explain: `${b} × ${rupiah(price)} = ${rupiah(total)}, lalu ${rupiah(total)} + ${rupiah(p2)} = ${rupiah(total + p2)}`,
      };
    }
    case 'bisaBeli':
      return { kind, icon: item.icon, unit: 'buah', answer: b, text: `${name} punya uang ${rupiah(total)}. Harga satu ${item.name} ${rupiah(price)}. Berapa ${item.name} yang bisa dibeli ${name} sampai uangnya habis?`, explain: `${b} × ${rupiah(price)} = ${rupiah(total)}, jadi bisa membeli ${b}` };
  }
}

const ORDER: KantinKind[] = ['kembalian', 'total', 'total', 'kembalian', 'duaJenis', 'total', 'bisaBeli', 'totalKembalian', 'bisaBeli', 'totalKembalian'];

/**
 * Susun soal cerita kantin (maks 10). Perkaliannya diambil dari fakta yang sudah
 * dipelajari anak, supaya hafalan dipakai di situasi nyata.
 */
export function buildKantin(name: string, learned: FactId[], rng: Rng = Math.random): KantinQuestion[] {
  const usable = learned.filter((f) => {
    const [a, b] = parseFact(f);
    // Tanpa ×1 murni, dan total belanja tetap di bawah Rp100.000.
    return b > 1 && a * b <= 81;
  });
  const pool = usable.length ? usable : ['2x2', '2x3', '2x5', '3x10'];
  let facts = shuffle(pool, rng);
  while (facts.length < KANTIN_MAX) facts = [...facts, ...shuffle(pool, rng)];
  return ORDER.slice(0, KANTIN_MAX).map((kind, i) => make(kind, name, facts[i], rng));
}
