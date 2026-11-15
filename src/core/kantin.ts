import type { FactId } from './types';
import { answerOf, parseFact } from './facts';
import { type Rng, shuffle } from './util';

/** Maksimal soal cerita per kunjungan ke kantin. */
export const KANTIN_MAX = 10;

export type KantinIcon = 'donat' | 'minum' | 'roti' | 'nasi';
export type KantinKind =
  | 'kembalian' // pengurangan
  | 'total' // perkalian
  | 'hargaSatuan' // pembagian
  | 'bisaBeli' // pembagian
  | 'duaJenis' // perkalian + penjumlahan
  | 'totalKembalian' // perkalian + pengurangan
  | 'patungan' // pembagian
  | 'duaKali' // dua perkalian + penjumlahan
  | 'tigaLangkah'; // dua perkalian + penjumlahan + pengurangan

export interface KantinQuestion {
  kind: KantinKind;
  /** 1 = mudah (satu langkah), 2 = sedang, 3 = sulit (banyak langkah) */
  level: 1 | 2 | 3;
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
export const LEVEL_NAMES = ['', 'Mudah', 'Sedang', 'Sulit'];

const pick = <T>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];
const rb = (n: number) => n * 1000;

/** Uang pecahan terkecil yang cukup untuk membayar. */
function payWith(total: number, rng: Rng): number {
  const notes = [5000, 10000, 20000, 50000, 100000].filter((n) => n > total);
  if (notes.length === 0) return Math.ceil((total + 1) / 50000) * 50000;
  return notes.length > 1 && rng() < 0.3 ? notes[1] : notes[0];
}

/** Soal 1–10 makin sulit: satu langkah → pembagian → dua langkah → tiga langkah. */
const ORDER: [KantinKind, 1 | 2 | 3][] = [
  ['kembalian', 1],
  ['total', 1],
  ['total', 1],
  ['hargaSatuan', 2],
  ['bisaBeli', 2],
  ['duaJenis', 2],
  ['totalKembalian', 2],
  ['patungan', 3],
  ['duaKali', 3],
  ['tigaLangkah', 3],
];

function make(kind: KantinKind, level: 1 | 2 | 3, name: string, fact: FactId, rng: Rng): KantinQuestion {
  const item = pick(ITEMS, rng);
  const other = pick(
    ITEMS.filter((i) => i.name !== item.name),
    rng,
  );
  const [x, y] = parseFact(fact);
  // harga = a ribu, banyaknya = b (diacak urutannya; banyaknya minimal 2)
  let [a, b] = rng() < 0.5 ? [x, y] : [y, x];
  if (b < 2) [a, b] = [b, a];
  if (b < 2) b = 2;
  const price = rb(a);
  const total = price * b;
  const q = (text: string, answer: number, explain: string, unit: 'rp' | 'buah' = 'rp'): KantinQuestion => ({ kind, level, icon: item.icon, text, answer, unit, explain });
  switch (kind) {
    case 'kembalian': {
      const p = rb(1 + Math.floor(rng() * 9));
      const pay = payWith(p, rng);
      return q(`${name} membeli satu ${item.name} seharga ${rupiah(p)}. ${name} membayar dengan uang ${rupiah(pay)}. Berapa rupiah kembalian yang harus diterima ${name}?`, pay - p, `${rupiah(pay)} − ${rupiah(p)} = ${rupiah(pay - p)}`);
    }
    case 'total':
      return q(`Harga satu ${item.name} ${rupiah(price)}. ${name} membeli ${b} ${item.name}. Berapa rupiah yang harus dibayar ${name}?`, total, `${b} × ${rupiah(price)} = ${rupiah(total)}`);
    case 'hargaSatuan':
      return q(`${name} membayar ${rupiah(total)} untuk ${b} ${item.name}. Harga tiap ${item.name} sama. Berapa rupiah harga satu ${item.name}?`, price, `${rupiah(total)} : ${b} = ${rupiah(price)}, karena ${b} × ${rupiah(price)} = ${rupiah(total)}`);
    case 'bisaBeli':
      return q(`${name} punya uang ${rupiah(total)}. Harga satu ${item.name} ${rupiah(price)}. Berapa ${item.name} yang bisa dibeli ${name} sampai uangnya habis?`, b, `${rupiah(total)} : ${rupiah(price)} = ${b}, karena ${b} × ${rupiah(price)} = ${rupiah(total)}`, 'buah');
    case 'duaJenis': {
      const p2 = rb(1 + Math.floor(rng() * 5));
      return q(`${name} membeli ${b} ${item.name} seharga ${rupiah(price)} per buah, dan satu ${other.name} seharga ${rupiah(p2)}. Berapa rupiah semuanya?`, total + p2, `${b} × ${rupiah(price)} = ${rupiah(total)}, lalu ${rupiah(total)} + ${rupiah(p2)} = ${rupiah(total + p2)}`);
    }
    case 'totalKembalian': {
      const pay = payWith(total, rng);
      return q(`${name} membeli ${b} ${item.name}. Harga satu ${item.name} ${rupiah(price)}. ${name} membayar dengan uang ${rupiah(pay)}. Berapa rupiah kembaliannya?`, pay - total, `${b} × ${rupiah(price)} = ${rupiah(total)}, lalu ${rupiah(pay)} − ${rupiah(total)} = ${rupiah(pay - total)}`);
    }
    case 'patungan':
      return q(`${name} dan teman-temannya, semuanya ${b} anak, patungan membeli ${item.name} untuk dimakan bersama. Harga semuanya ${rupiah(total)} dan dibagi rata. Berapa rupiah yang dibayar tiap anak?`, price, `${rupiah(total)} : ${b} = ${rupiah(price)}, karena ${b} × ${rupiah(price)} = ${rupiah(total)}`);
    case 'duaKali':
    case 'tigaLangkah': {
      const c = 2 + Math.floor(rng() * 2);
      const p2 = rb(1 + Math.floor(rng() * 4));
      const sum = total + c * p2;
      const steps = `${b} × ${rupiah(price)} = ${rupiah(total)}, ${c} × ${rupiah(p2)} = ${rupiah(c * p2)}, lalu ${rupiah(total)} + ${rupiah(c * p2)} = ${rupiah(sum)}`;
      const buy = `${name} membeli ${b} ${item.name} seharga ${rupiah(price)} per buah dan ${c} ${other.name} seharga ${rupiah(p2)} per buah.`;
      if (kind === 'duaKali') return q(`${buy} Berapa rupiah semuanya?`, sum, steps);
      const pay = payWith(sum, rng);
      return q(`${buy} ${name} membayar dengan uang ${rupiah(pay)}. Berapa rupiah kembaliannya?`, pay - sum, `${steps}. Kembalian: ${rupiah(pay)} − ${rupiah(sum)} = ${rupiah(pay - sum)}`);
    }
  }
}

/**
 * Susun soal cerita kantin (maks 10), makin ke belakang makin sulit. Perkalian dan pembagiannya
 * diambil dari fakta yang sudah dipelajari anak, supaya hafalan dipakai di situasi nyata.
 */
export function buildKantin(name: string, learned: FactId[], rng: Rng = Math.random): KantinQuestion[] {
  const usable = learned.filter((f) => {
    const [a, b] = parseFact(f);
    // Tanpa ×1 murni, dan total belanja tetap di bawah Rp100.000.
    return a > 1 && b > 1 && a * b <= 81;
  });
  const pool = usable.length >= 4 ? usable : [...usable, '2x2', '2x3', '2x5', '3x10'];
  let facts = shuffle(pool, rng);
  while (facts.length < KANTIN_MAX) facts = [...facts, ...shuffle(pool, rng)];
  // Fakta dengan hasil kecil dipakai di soal awal, hasil besar di soal akhir.
  const sorted = facts.slice(0, KANTIN_MAX).sort((p, q) => answerOf(p) - answerOf(q));
  return ORDER.map(([kind, level], i) => make(kind, level, name, sorted[i], rng));
}
