import type { FactId } from './types';

export const fid = (a: number, b: number): FactId => (a <= b ? `${a}x${b}` : `${b}x${a}`);

export function parseFact(f: FactId): [number, number] {
  const [a, b] = f.split('x').map(Number);
  return [a, b];
}

export function answerOf(f: FactId): number {
  const [a, b] = parseFact(f);
  return a * b;
}

/** 55 fakta unik (a ≤ b, 1..10). */
export const ALL_FACTS: FactId[] = (() => {
  const out: FactId[] = [];
  for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) out.push(fid(a, b));
  return out;
})();

export const CORE_NUMS = [3, 4, 6, 7, 8];

/** 15 fakta inti = semua kombinasi {3,4,6,7,8}. */
export const CORE_FACTS: FactId[] = ALL_FACTS.filter((f) => {
  const [a, b] = parseFact(f);
  return CORE_NUMS.includes(a) && CORE_NUMS.includes(b);
});

const CORE_SET = new Set(CORE_FACTS);
export const isCore = (f: FactId): boolean => CORE_SET.has(f);

/** 40 fakta yang beres lewat jurus (×1, ×10, ×2, ×5, ×9). */
export const JURUS_FACTS: FactId[] = ALL_FACTS.filter((f) => !isCore(f));

/** Semua fakta yang memuat salah satu pengali. */
export function familyFacts(mults: number[]): FactId[] {
  return ALL_FACTS.filter((f) => {
    const [a, b] = parseFact(f);
    return mults.includes(a) || mults.includes(b);
  });
}

export function isValidFact(f: unknown): f is FactId {
  return typeof f === 'string' && ALL_FACTS.includes(f);
}

export const factLabel = (f: FactId): string => {
  const [a, b] = parseFact(f);
  return `${a} × ${b}`;
};
