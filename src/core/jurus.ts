import type { FactId } from './types';
import { parseFact } from './facts';

/** Visual satu langkah jurus; digambar oleh komponen JurusPlayer. */
export type Vis =
  | { t: 'eq'; lines: string[] }
  | { t: 'dots'; rows: number; cols: number; splitRows?: number; caption?: string }
  | { t: 'fingers'; fold: number }
  | { t: 'shrink'; stage: number }
  | { t: 'seq'; reveal: boolean };

export interface JurusStep {
  say: string;
  vis: Vis;
}

export interface Jurus {
  id: string;
  title: string;
  steps: JurusStep[];
}

export const jurusX10X1 = (): Jurus => ({
  id: 'x10x1',
  title: 'Jurus Tempel Nol & Angka Tetap',
  steps: [
    { say: 'Kali 10 itu gampang: tempel nol di belakang angkanya.', vis: { t: 'eq', lines: ['7 × 10 = 7_'] } },
    { say: 'Tempel nol… jadi 70! Berlaku untuk semua angka.', vis: { t: 'eq', lines: ['7 × 10 = 70', '4 × 10 = 40', '9 × 10 = 90'] } },
    { say: 'Kali 1? Angkanya tetap, tidak berubah sama sekali.', vis: { t: 'eq', lines: ['8 × 1 = 8', '1 × 6 = 6'] } },
  ],
});

export const jurusX2 = (n = 7): Jurus => ({
  id: 'x2',
  title: 'Jurus Kembar',
  steps: [
    { say: `Kali 2 artinya kembar: ada dua kelompok yang sama.`, vis: { t: 'dots', rows: 2, cols: n, splitRows: 1 } },
    { say: `Jadi tinggal tambahkan angkanya dengan dirinya sendiri.`, vis: { t: 'eq', lines: [`${n} × 2 = ${n} + ${n}`, `= ${n * 2}`] } },
    { say: 'Coba yang lain: semua kali 2 itu dobel.', vis: { t: 'eq', lines: ['6 × 2 = 6 + 6 = 12', '8 × 2 = 8 + 8 = 16'] } },
  ],
});

export const jurusX5 = (n = 6): Jurus => {
  const m = n;
  return {
    id: 'x5',
    title: 'Jurus Setengah',
    steps: [
      { say: 'Kali 5 itu setengahnya kali 10.', vis: { t: 'eq', lines: [`${m} × 10 = ${m * 10}`] } },
      { say: `Setengah dari ${m * 10} adalah ${m * 5}.`, vis: { t: 'eq', lines: [`${m} × 10 = ${m * 10}`, `${m} × 5 = ${m * 5}`] } },
      { say: 'Hasil kali 5 selalu berakhir 0 atau 5.', vis: { t: 'eq', lines: ['5, 10, 15, 20, 25,', '30, 35, 40, 45, 50'] } },
    ],
  };
};

export const jurusSwap = (): Jurus => ({
  id: 'swap',
  title: 'Jurus Bolak-balik',
  steps: [
    { say: '3 baris isi 7. Hitung semuanya: 21.', vis: { t: 'dots', rows: 3, cols: 7, caption: '3 × 7 = 21' } },
    { say: 'Putar! Sekarang 7 baris isi 3. Jumlahnya tetap 21.', vis: { t: 'dots', rows: 7, cols: 3, caption: '7 × 3 = 21' } },
    { say: 'Dibolak-balik hasilnya sama. Hafal satu, dapat dua!', vis: { t: 'eq', lines: ['7 × 8 = 8 × 7', '4 × 6 = 6 × 4'] } },
    { say: 'Karena itu, setengah tabel perkalian langsung beres.', vis: { t: 'shrink', stage: 5 } },
  ],
});

export const jurusX9 = (n = 4): Jurus => ({
  id: 'x9',
  title: 'Jurus Jari Sembilan',
  steps: [
    { say: 'Buka 10 jarimu. Kita hitung 9 × ' + n + '.', vis: { t: 'fingers', fold: 0 } },
    { say: `Tekuk jari ke-${n} dari kiri.`, vis: { t: 'fingers', fold: n } },
    { say: `Di kiri ada ${n - 1} jari (puluhan), di kanan ada ${10 - n} jari (satuan).`, vis: { t: 'eq', lines: [`9 × ${n} = ${9 * n}`] } },
  ],
});

export const jurusX3 = (b: number): Jurus => ({
  id: 'x3',
  title: 'Jurus Kali 3: Dobel + Satu Lagi',
  steps: [
    { say: `3 × ${b} artinya ada 3 kelompok isi ${b}.`, vis: { t: 'dots', rows: 3, cols: b } },
    { say: `Dua kelompok dulu pakai Jurus Kembar: 2 × ${b} = ${2 * b}.`, vis: { t: 'dots', rows: 3, cols: b, splitRows: 2 } },
    { say: `Lalu tambah satu kelompok lagi.`, vis: { t: 'eq', lines: [`${2 * b} + ${b} = ${3 * b}`, `3 × ${b} = ${3 * b}`] } },
  ],
});

export const jurusX4 = (b: number): Jurus => ({
  id: 'x4',
  title: 'Jurus Kali 4: Dobel-dobel',
  steps: [
    { say: `4 × ${b}: dobelkan ${b}, lalu dobelkan lagi.`, vis: { t: 'dots', rows: 4, cols: b, splitRows: 2 } },
    { say: `Dobel pertama: ${b} + ${b} = ${2 * b}.`, vis: { t: 'eq', lines: [`${b} → ${2 * b}`] } },
    { say: `Dobel kedua: ${2 * b} + ${2 * b} = ${4 * b}.`, vis: { t: 'eq', lines: [`${b} → ${2 * b} → ${4 * b}`, `4 × ${b} = ${4 * b}`] } },
  ],
});

export const jurusX6 = (b: number): Jurus => ({
  id: 'x6',
  title: 'Jurus Kali 6: Kali 5 + Satu Lagi',
  steps: [
    { say: `6 × ${b} artinya ada 6 kelompok isi ${b}.`, vis: { t: 'dots', rows: 6, cols: b } },
    { say: `Lima kelompok dulu pakai Jurus Setengah: 5 × ${b} = ${5 * b}.`, vis: { t: 'dots', rows: 6, cols: b, splitRows: 5 } },
    { say: 'Lalu tambah satu kelompok lagi.', vis: { t: 'eq', lines: [`${5 * b} + ${b} = ${6 * b}`, `6 × ${b} = ${6 * b}`] } },
  ],
});

export const jurusX8 = (): Jurus => ({
  id: 'x8',
  title: 'Jurus Kali 8: Dobel Tiga Kali',
  steps: [
    { say: 'Kali 8 = dobel, dobel, dobel lagi.', vis: { t: 'eq', lines: ['8 → 16'] } },
    { say: 'Dobel kedua: 16 + 16 = 32.', vis: { t: 'eq', lines: ['8 → 16 → 32'] } },
    { say: 'Dobel ketiga: 32 + 32 = 64.', vis: { t: 'eq', lines: ['8 → 16 → 32 → 64', '8 × 8 = 64'] } },
  ],
});

export const jurus5678 = (): Jurus => ({
  id: 'seq5678',
  title: 'Jurus Urutan 5-6-7-8',
  steps: [
    { say: 'Ini makhluk paling bandel: 7 × 8. Tapi ada rahasianya…', vis: { t: 'seq', reveal: false } },
    { say: 'Baca urut: lima, enam, tujuh, delapan!', vis: { t: 'seq', reveal: true } },
    { say: '56 = 7 × 8. Bolak-balik juga sama: 8 × 7 = 56.', vis: { t: 'eq', lines: ['56 = 7 × 8', '8 × 7 = 56'] } },
  ],
});

export const jurus7x7 = (): Jurus => ({
  id: 'x7',
  title: 'Jurus 7 × 7: Pecah Jadi 5 dan 2',
  steps: [
    { say: '7 × 7 adalah fakta inti terakhir. Kita pecah jadi dua bagian.', vis: { t: 'dots', rows: 7, cols: 7, splitRows: 5 } },
    { say: 'Lima baris: 5 × 7 = 35. Dua baris: 2 × 7 = 14.', vis: { t: 'eq', lines: ['5 × 7 = 35', '2 × 7 = 14'] } },
    { say: 'Gabungkan: 35 + 14 = 49.', vis: { t: 'eq', lines: ['35 + 14 = 49', '7 × 7 = 49'] } },
  ],
});

/** Pilih jurus yang paling cocok untuk satu fakta (dipakai lesson fakta inti, fakta bandel, ulangan). */
export function jurusForFact(f: FactId): Jurus {
  const [a, b] = parseFact(f);
  const has = (n: number) => a === n || b === n;
  const other = (n: number) => (a === n ? b : a);
  if (has(1) || has(10)) return jurusX10X1();
  if (has(2)) return jurusX2(other(2));
  if (has(5)) return jurusX5(other(5));
  if (has(9)) return jurusX9(other(9));
  if (has(3)) return jurusX3(other(3));
  if (has(4)) return jurusX4(other(4));
  if (f === '7x8') return jurus5678();
  if (has(6)) return jurusX6(other(6));
  if (f === '8x8') return jurusX8();
  return jurus7x7();
}
