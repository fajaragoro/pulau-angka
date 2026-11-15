import { describe, expect, it } from 'vitest';
import { ALL_FACTS, CORE_FACTS, JURUS_FACTS, answerOf, familyFacts, fid } from './facts';
import { FLUENT_MS, applyAnswer, gradeAnswer, newFactState } from './mastery';
import { DAYS, baselinePart, coreIntroduced, finalPart, learnedFacts, taughtMults } from './curriculum';
import { BONUS_MS, PracticeQueue, SESSION_CAP_MS, TEST_TIMEOUT_MS, bonusLeft, bonusOpen, buildBonusPlan, buildDailyPlan, buildDemoPlan, dueFacts, examItems, type SessionAnswer, type SessionPlan } from './session';
import { MAX_SESSIONS_PER_DAY, dailyDone, sessionsLeft, applySession, canPlayToday, counts, currentStreak, gradeAllowed, mapColor, newProfile } from './progress';
import { buildReport } from './report';
import { accessValid, backupDue, checkCode, exportBackup, newAccount, parseBackup } from './backup';
import { hintForFact, jurusForFact } from './jurus';
import { addDays, diffDays, mulberry32, toSpeech } from './util';
import { KANTIN_MAX, buildKantin } from './kantin';
import { REMEDIAL_PER_DAY, buildReplayPlan, dayJurus, kantinOpen, remedialLeft } from './session';
import type { Profile } from './types';

const D0 = '2026-01-01';
const rng = () => mulberry32(42);

/** Mainkan satu sesi: semua soal quiz dijawab, latihan dijawab 8 soal. */
function play(p: Profile, plan: SessionPlan, today: string, ok: (f: string) => boolean = () => true, ms = 1500) {
  const answers: SessionAnswer[] = [];
  for (const ph of plan.phases) {
    if (ph.type === 'quiz') for (const f of ph.items) answers.push({ f, ok: ok(f), ms, tag: ph.tag });
    if (ph.type === 'practice') {
      const q = new PracticeQueue(ph.newFacts, ph.known, rng());
      for (let i = 0; i < 8; i++) {
        const f = q.next();
        answers.push({ f, ok: ok(f), ms, tag: ph.tag });
        q.report(f, ok(f));
      }
    }
  }
  return applySession(p, plan, answers, today);
}

function playDays(n: number, ok: (f: string) => boolean = () => true) {
  let p = newProfile('Budi', 4, '#0F8F8A', 0, D0);
  let date = D0;
  const kinds: string[] = [];
  for (let i = 0; i < n; i++) {
    const plan = buildDailyPlan(p, date, rng());
    kinds.push(plan.kind);
    p = play(p, plan, date, ok).profile;
    date = addDays(date, 1);
  }
  return { p, date, kinds };
}

describe('fakta', () => {
  it('55 fakta unik, 15 inti, 40 jurus', () => {
    expect(ALL_FACTS).toHaveLength(55);
    expect(new Set(ALL_FACTS).size).toBe(55);
    expect(CORE_FACTS).toHaveLength(15);
    expect(JURUS_FACTS).toHaveLength(40);
    expect(CORE_FACTS).toEqual(['3x3', '3x4', '3x6', '3x7', '3x8', '4x4', '4x6', '4x7', '4x8', '6x6', '6x7', '6x8', '7x7', '7x8', '8x8']);
  });
  it('a×b dan b×a berbagi kunci', () => {
    expect(fid(8, 7)).toBe('7x8');
    expect(fid(7, 8)).toBe('7x8');
    expect(answerOf('7x8')).toBe(56);
  });
  it('rahasia 100 → 15: sisa kotak tiap langkah', () => {
    const left = (gone: number[]) => {
      let n = 0;
      for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) if (!gone.includes(a) && !gone.includes(b)) n++;
      return n;
    };
    expect([left([1, 10]), left([1, 10, 2]), left([1, 10, 2, 5]), left([1, 10, 2, 5, 9])]).toEqual([64, 49, 36, 25]);
    expect(familyFacts([1, 10])).toHaveLength(19);
  });
});

describe('penilaian & scheduler', () => {
  it('lancar = benar dan ≤ 3000 ms', () => {
    expect(gradeAnswer(true, FLUENT_MS)).toBe('fluent');
    expect(gradeAnswer(true, FLUENT_MS + 1)).toBe('slow');
    expect(gradeAnswer(false, 500)).toBe('wrong');
    expect(gradeAnswer(false, null)).toBe('wrong');
  });
  it('hafal = lancar di 3 hari berbeda, bukan 3 kali sehari', () => {
    let s = newFactState();
    s = applyAnswer(s, true, 1000, D0);
    s = applyAnswer(s, true, 1000, D0);
    s = applyAnswer(s, true, 1000, D0);
    expect(s.status).toBe('fluent');
    s = applyAnswer(s, true, 1000, addDays(D0, 1));
    expect(s.status).toBe('fluent');
    s = applyAnswer(s, true, 1000, addDays(D0, 3));
    expect(s.status).toBe('mastered');
  });
  it('interval Leitner 1, 2, 4, 7 hari', () => {
    let s = newFactState();
    let d = D0;
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = applyAnswer(s, true, 1000, d);
      gaps.push(diffDays(d, s.due!));
      d = s.due!;
    }
    expect(gaps).toEqual([1, 2, 4, 7, 7]);
  });
  it('salah setelah hafal → turun dan dijadwalkan besok', () => {
    let s = newFactState();
    for (let i = 0; i < 3; i++) s = applyAnswer(s, true, 1000, addDays(D0, i));
    expect(s.status).toBe('mastered');
    s = applyAnswer(s, false, 1000, addDays(D0, 5));
    expect(s.status).toBe('wrong');
    expect(s.box).toBe(0);
    expect(s.fluentDays).toEqual([]);
    expect(s.due).toBe(addDays(D0, 6));
  });
  it('benar tapi lambat → status lambat, review besok', () => {
    const s = applyAnswer(newFactState(), true, 5000, D0);
    expect(s.status).toBe('slow');
    expect(s.due).toBe(addDays(D0, 1));
  });
});

describe('kurikulum 30 hari', () => {
  it('30 hari berurutan dengan ujian di H7/14/21/28 dan tes akhir H29–30', () => {
    expect(DAYS).toHaveLength(30);
    expect(DAYS.map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(DAYS.filter((d) => d.kind === 'exam').map((d) => d.day)).toEqual([7, 14, 21, 28]);
    expect(DAYS.filter((d) => d.kind === 'final').map((d) => d.day)).toEqual([29, 30]);
    expect(DAYS.filter((d) => d.kind === 'bandel').map((d) => d.day)).toEqual([23, 24, 25, 26, 27]);
  });
  it('15 fakta inti diperkenalkan tepat sekali, lengkap di H22, maks 2 per hari', () => {
    const all = DAYS.flatMap((d) => d.newFacts ?? []);
    expect(all.slice().sort()).toEqual(CORE_FACTS.slice().sort());
    expect(coreIntroduced(21)).toHaveLength(14);
    expect(coreIntroduced(22)).toHaveLength(15);
    expect(coreIntroduced(14)).toHaveLength(9);
    expect(Math.max(...DAYS.map((d) => d.newFacts?.length ?? 0))).toBe(2);
  });
  it('setelah Pulau 1 semua 40 fakta jurus dipelajari (peta 75 kotak)', () => {
    expect(taughtMults(5).sort()).toEqual([1, 10, 2, 5, 9].sort());
    expect(learnedFacts(7).slice().sort()).toEqual(JURUS_FACTS.slice().sort());
    expect(learnedFacts(22)).toHaveLength(55);
  });
  it('tes awal 19/18/18 dan tes akhir 28/27 mencakup 55 fakta', () => {
    const b = [0, 1, 2].map(baselinePart);
    expect(b.map((x) => x.length)).toEqual([19, 18, 18]);
    expect(new Set(b.flat()).size).toBe(55);
    const f = [0, 1].map(finalPart);
    expect(f.map((x) => x.length)).toEqual([28, 27]);
    expect(new Set(f.flat()).size).toBe(55);
  });
  it('setiap fakta punya jurus', () => {
    for (const f of ALL_FACTS) expect(jurusForFact(f).steps.length).toBeGreaterThan(0);
    expect(jurusForFact('7x8').id).toBe('seq5678');
    expect(jurusForFact('3x7').id).toBe('x3');
    expect(jurusForFact('6x8').id).toBe('x6');
  });
});

describe('penyusun sesi', () => {
  it('H1: jurus ×10&×1 dulu → tes awal 19 fakta → latihan', () => {
    const p = newProfile('Budi', 4, '#000', 0, D0);
    const plan = buildDailyPlan(p, D0, rng());
    expect(plan.capMs).toBe(SESSION_CAP_MS);
    expect(plan.phases.map((x) => x.type)).toEqual(['jurus', 'quiz', 'practice']);
    const q = plan.phases[1];
    expect(q.type === 'quiz' && q.items.length).toBe(19);
    expect(q.type === 'quiz' && q.tag).toBe('baseline');
    const j = plan.phases[0];
    expect(j.type === 'jurus' && j.jurus[0].id).toBe('x10x1');
    const pr = plan.phases[2];
    expect(pr.type === 'practice' && pr.newFacts.length).toBeGreaterThanOrEqual(2);
    expect(pr.type === 'practice' && pr.newFacts.length).toBeLessThanOrEqual(4);
  });
  it('tes terpanjang tetap muat dalam 180 detik', () => {
    expect(28 * (TEST_TIMEOUT_MS + 400)).toBeLessThanOrEqual(SESSION_CAP_MS);
    for (const i of [1, 2, 3, 4]) expect(examItems(i, rng()).length * (TEST_TIMEOUT_MS + 400)).toBeLessThanOrEqual(SESSION_CAP_MS);
  });
  it('incremental rehearsal: pola B K B K K B K K K B', () => {
    const q = new PracticeQueue(['7x8'], ['1x2', '1x3', '1x4'], rng());
    const seq = Array.from({ length: 10 }, () => {
      const f = q.next();
      q.report(f, true);
      return f === '7x8' ? 'B' : 'K';
    });
    expect(seq.join('')).toBe('BKBKKBKKKB');
  });
  it('jawaban salah muncul lagi 3 soal kemudian', () => {
    const q = new PracticeQueue([], ['1x1', '1x2', '1x3', '1x4', '1x5', '1x6', '1x7', '1x8'], rng());
    const first = q.next();
    q.report(first, false);
    const after = [q.next(), q.next(), q.next(), q.next()];
    expect(after.slice(0, 3)).not.toContain(first);
    expect(after[3]).toBe(first);
  });
  it('tidak pernah menampilkan fakta yang sama dua kali berturut-turut', () => {
    const q = new PracticeQueue(['3x3', '3x4'], ['1x2', '1x3', '2x2'], rng());
    let last = '';
    for (let i = 0; i < 200; i++) {
      const f = q.next();
      expect(f).not.toBe(last);
      q.report(f, i % 3 !== 0);
      last = f;
    }
  });
  it('pemanasan hanya berisi fakta jatuh tempo yang sudah dipelajari', () => {
    const { p, date } = playDays(3);
    const due = dueFacts(p, date);
    const learned = learnedFacts(3);
    expect(due.length).toBeGreaterThan(0);
    for (const f of due) expect(learned.includes(f) || p.facts[f].status === 'fluent' || p.facts[f].status === 'mastered').toBe(true);
    for (const f of due) expect(p.facts[f].due! <= date).toBe(true);
  });
  it('demo: tes kilat 20 soal (15 inti + 5 sampel), jurus, lalu makhluk 7×8', () => {
    const plan = buildDemoPlan(rng());
    const q = plan.phases[0];
    if (q.type !== 'quiz') throw new Error();
    expect(q.items).toHaveLength(20);
    expect(q.budgetMs).toBe(60_000);
    expect(CORE_FACTS.every((f) => q.items.includes(f))).toBe(true);
    const pr = plan.phases[2];
    expect(pr.type === 'practice' && pr.newFacts).toEqual(['7x8']);
  });
});

describe('progres 30 hari', () => {
  it('anak yang selalu benar tamat tepat 30 sesi dengan 55 fakta lancar', () => {
    const { p, kinds } = playDays(30);
    expect(p.progress.day).toBe(31);
    expect(p.progress.completedAt).not.toBeNull();
    expect(p.progress.sessionsDone).toBe(30);
    expect(p.progress.streak).toBe(30);
    expect(kinds.filter((k) => k === 'exam')).toHaveLength(4);
    expect(Object.keys(p.progress.baseline)).toHaveLength(55);
    expect(Object.keys(p.progress.final)).toHaveLength(55);
    expect(counts(p).fluent).toBe(55);
    expect(counts(p).core).toBe(15);
  });
  it('sesi wajib harian tercatat selesai', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    expect(canPlayToday(p, D0)).toBe(true);
    p = play(p, buildDailyPlan(p, D0, rng()), D0).profile;
    expect(dailyDone(p, D0)).toBe(true);
    expect(dailyDone(p, addDays(D0, 1))).toBe(false);
    expect(p.progress.day).toBe(2);
  });
  it('bolos memutus streak tapi tidak melewatkan materi', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    p = play(p, buildDailyPlan(p, D0, rng()), D0).profile;
    const later = addDays(D0, 5);
    expect(currentStreak(p, later)).toBe(0);
    const plan = buildDailyPlan(p, later, rng());
    expect(plan.day).toBe(2);
    p = play(p, plan, later).profile;
    expect(p.progress.streak).toBe(1);
    expect(p.progress.day).toBe(3);
  });
  it('gagal ujian → ulangan → ujian ulang → (gagal lagi) ulangan → lanjut; jadwal mundur', () => {
    const { p, kinds } = playDays(11, (f) => !JURUS_FACTS.includes(f) || f.startsWith('1x'));
    expect(kinds.slice(6)).toEqual(['exam', 'remedial', 'reexam', 'remedial', 'lesson']);
    expect(p.progress.exams[1].passed).toBe(false);
    expect(p.progress.exams[1].attempts).toBe(2);
    expect(p.progress.pending).toBeNull();
    expect(p.progress.day).toBe(9);
  });
  it('lulus ujian ulang langsung lanjut', () => {
    let { p, date } = playDays(6);
    p = play(p, buildDailyPlan(p, date, rng()), date, () => false).profile;
    expect(p.progress.pending?.stage).toBe('remedial1');
    expect(p.progress.pending!.failed.length).toBeGreaterThan(0);
    for (const kind of ['remedial', 'reexam']) {
      date = addDays(date, 1);
      const plan = buildDailyPlan(p, date, rng());
      expect(plan.kind).toBe(kind);
      p = play(p, plan, date).profile;
    }
    expect(p.progress.pending).toBeNull();
    expect(p.progress.exams[1].passed).toBe(true);
    expect(buildDailyPlan(p, addDays(date, 1), rng()).day).toBe(8);
  });
  it('H8 memperkenalkan 3×3 dan 3×4 dengan jurus ×3', () => {
    const { p, date } = playDays(7);
    const plan = buildDailyPlan(p, date, rng());
    expect(plan.newFacts).toEqual(['3x3', '3x4']);
    const j = plan.phases.find((x) => x.type === 'jurus');
    expect(j?.type === 'jurus' && j.jurus.map((x) => x.id)).toEqual(['x3', 'x3']);
  });
  it('hari fakta bandel memilih fakta yang paling sering salah', () => {
    let { p, date } = playDays(22, (f) => f !== '6x7' && f !== '4x9');
    const plan = buildDailyPlan(p, date, rng());
    expect(plan.kind).toBe('bandel');
    expect(plan.newFacts.slice().sort()).toEqual(['4x9', '6x7']);
    p = play(p, plan, date).profile;
  });
  it('peta: biru untuk fakta jurus yang belum dites, hijau/kuning/merah sesuai status', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    expect(mapColor(p, '1x7')).toBe('gray');
    p = { ...p, progress: { ...p.progress, day: 2 } };
    expect(mapColor(p, '1x7')).toBe('blue');
    expect(mapColor(p, '7x8')).toBe('gray');
    p = { ...p, facts: { '7x8': applyAnswer(newFactState(), true, 5000, D0), '6x6': applyAnswer(newFactState(), false, 100, D0), '1x7': applyAnswer(newFactState(), true, 100, D0) } };
    expect([mapColor(p, '7x8'), mapColor(p, '6x6'), mapColor(p, '1x7')]).toEqual(['yellow', 'red', 'green']);
  });
  it('kelas 1–2 tidak boleh lanjut', () => {
    expect([1, 2, 3, 4, 5, 6].map(gradeAllowed)).toEqual([false, false, true, true, true, true]);
  });
});

describe('ronde bonus', () => {
  it('terbuka setelah sesi harian, maksimal 3 per hari, tidak membuka hari baru', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    expect(bonusOpen(p, D0)).toBe(false);
    p = play(p, buildDailyPlan(p, D0, rng()), D0).profile;
    expect(bonusOpen(p, D0)).toBe(true);
    const logBefore = p.log.length;
    for (let i = 0; i < 3; i++) {
      const plan = buildBonusPlan(p, 'kilat')!;
      expect(plan.capMs).toBe(BONUS_MS);
      p = play(p, plan, D0).profile;
    }
    expect(bonusLeft(p, D0)).toBe(0);
    expect(bonusOpen(p, D0)).toBe(false);
    expect(p.progress.day).toBe(2);
    expect(p.progress.sessionsDone).toBe(1);
    expect(p.log.length).toBe(logBefore + 24);
    expect(p.log.at(-1)!.src).toBe('bonus');
    expect(p.bonus.bestKilat).toBe(8);
    expect(bonusLeft(p, addDays(D0, 1))).toBe(3);
  });
  it('Revans Bandel belum ada sebelum fakta inti diperkenalkan', () => {
    const p = newProfile('Budi', 4, '#000', 0, D0);
    expect(buildBonusPlan(p, 'revans')).toBeNull();
    const { p: p8 } = playDays(8);
    const plan = buildBonusPlan(p8, 'revans')!;
    const ph = plan.phases[0];
    expect(ph.type === 'practice' && ph.known).toEqual(['3x3', '3x4']);
  });
});

describe('rapor guru', () => {
  it('menghitung hafal, fakta inti, dan fakta yang perlu latihan', () => {
    const { p, date } = playDays(10, (f) => f !== '3x7');
    const r = buildReport(p, date);
    expect(r.day).toBe(10);
    expect(r.name).toBe('Budi');
    expect(r.needPractice).toContain('3x7');
    expect(r.avgMs).toBe(1500);
    expect(r.materi).toHaveLength(4);
    expect(r.materi.map((m) => m.total).reduce((a, b) => a + b)).toBe(55);
    expect(r.materi[0].level).toBe('Sangat Baik');
    expect(r.isFinal).toBe(false);
    expect(r.baselineFluent).toBe(54);
  });
  it('rapor akhir setelah hari ke-30', () => {
    const { p, date } = playDays(30);
    const r = buildReport(p, date);
    expect(r.isFinal).toBe(true);
    expect(r.day).toBe(30);
    expect(r.mastered).toBe(55);
  });
});

describe('cadangan & kode akses', () => {
  it('ekspor → impor mengembalikan data yang sama', () => {
    const acc = newAccount(D0);
    acc.profiles.push(playDays(5).p);
    acc.access = { code: '3016', at: D0 };
    const back = parseBackup(exportBackup(acc, '2026-01-06T00:00:00Z'));
    expect(back).toEqual(acc);
  });
  it('menolak file yang bukan cadangan', () => {
    expect(() => parseBackup('halo')).toThrow(/tidak bisa dibaca/);
    expect(() => parseBackup('{"app":"lain"}')).toThrow(/bukan file cadangan/);
    const four = { app: 'pulau-angka', v: 1, account: { profiles: [1, 2, 3, 4] } };
    expect(() => parseBackup(JSON.stringify(four))).toThrow(/lebih dari 3/);
  });
  it('pengingat cadangan tiap 7 hari setelah ada data', () => {
    const acc = newAccount(D0);
    expect(backupDue(acc, addDays(D0, 30))).toBe(false);
    acc.profiles.push(playDays(1).p);
    expect(backupDue(acc, addDays(D0, 6))).toBe(false);
    expect(backupDue(acc, addDays(D0, 7))).toBe(true);
    acc.lastBackupAt = addDays(D0, 7);
    expect(backupDue(acc, addDays(D0, 8))).toBe(false);
  });
  it('kode akses: ganti kode bisa mempertahankan atau menolak pengguna lama', () => {
    expect(checkCode('3016', { code: '3016', keepOldUsers: true })).toBe(true);
    expect(checkCode('3015', { code: '3016', keepOldUsers: true })).toBe(false);
    const old = { code: '3016', at: D0 };
    expect(accessValid(old, { code: '8822', keepOldUsers: true })).toBe(true);
    expect(accessValid(old, { code: '8822', keepOldUsers: false })).toBe(false);
    expect(accessValid(null, { code: '3016', keepOldUsers: true })).toBe(false);
  });
});

describe('remedial: ulangi soal hari ini', () => {
  it('mengulang sesi yang sama, maksimal 2 kali, tanpa membuka hari baru atau mengubah peta tes awal', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    expect(buildReplayPlan(p, D0)).toBeNull();
    const plan = buildDailyPlan(p, D0, rng());
    p = play(p, plan, D0, () => false).profile;
    expect(Object.values(p.progress.baseline).every((g) => g === 'wrong')).toBe(true);
    expect(remedialLeft(p, D0)).toBe(REMEDIAL_PER_DAY);
    const replay = buildReplayPlan(p, D0)!;
    expect(replay.replay).toBe(true);
    expect(replay.phases).toEqual(plan.phases);
    const res = play(p, replay, D0);
    p = res.profile;
    expect(res.summary.replay).toBe(true);
    expect(p.progress.day).toBe(2);
    expect(p.progress.sessionsDone).toBe(1);
    expect(Object.values(p.progress.baseline).every((g) => g === 'wrong')).toBe(true);
    expect(counts(p).fluent).toBeGreaterThan(0);
    p = play(p, buildReplayPlan(p, D0)!, D0).profile;
    expect(remedialLeft(p, D0)).toBe(0);
    expect(buildReplayPlan(p, D0)).toBeNull();
    expect(buildReplayPlan(p, addDays(D0, 1))).toBeNull();
  });
  it('lulus ujian saat remedial membatalkan ulangan khusus', () => {
    let { p, date } = playDays(6);
    p = play(p, buildDailyPlan(p, date, rng()), date, () => false).profile;
    expect(p.progress.pending?.stage).toBe('remedial1');
    p = play(p, buildReplayPlan(p, date)!, date).profile;
    expect(p.progress.pending).toBeNull();
    expect(p.progress.exams[1].passed).toBe(true);
    expect(buildDailyPlan(p, addDays(date, 1), rng()).day).toBe(8);
  });
});

describe('pergi ke kantin', () => {
  it('maksimal 10 soal cerita dengan jawaban yang benar dan masuk akal', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const qs = buildKantin('Rara', learnedFacts(seed % 23), mulberry32(seed));
      expect(qs).toHaveLength(KANTIN_MAX);
      for (const q of qs) {
        expect(Number.isInteger(q.answer) && q.answer > 0).toBe(true);
        expect(q.text).toContain('Rara');
        if (q.unit === 'rp') expect(q.answer % 1000).toBe(0);
        else expect(q.answer).toBeLessThanOrEqual(10);
        expect(q.answer).toBeLessThan(100000);
      }
      expect(qs.some((q) => q.kind === 'kembalian')).toBe(true);
      // makin sulit: level tidak pernah turun, dari 1 sampai 3
      expect(qs.map((q) => q.level)).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
      // ada perkalian dan pembagian
      expect(qs.filter((q) => q.kind === 'total').length).toBeGreaterThanOrEqual(2);
      expect(qs.filter((q) => ['hargaSatuan', 'bisaBeli', 'patungan'].includes(q.kind))).toHaveLength(3);
      expect(qs.filter((q) => q.explain.includes(':')).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('terbuka setelah sesi harian selesai', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    expect(kantinOpen(p, D0)).toBe(false);
    p = play(p, buildDailyPlan(p, D0, rng()), D0).profile;
    expect(kantinOpen(p, D0)).toBe(true);
    expect(kantinOpen(p, addDays(D0, 1))).toBe(false);
  });
});

describe('narasi jurus', () => {
  it('simbol dibacakan sebagai kata', () => {
    expect(toSpeech('56 = 7 × 8')).toBe('56 sama dengan 7 kali 8');
    expect(toSpeech('14 + 7 → 21')).toBe('14 tambah 7 jadi 21');
    expect(toSpeech('Harga Rp2.000')).toBe('Harga 2000 rupiah');
  });
});

describe('akselerasi', () => {
  it('maksimal 3 hari kurikulum per hari kalender; hafal tetap butuh 3 hari berbeda', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    expect(sessionsLeft(p, D0)).toBe(MAX_SESSIONS_PER_DAY);
    for (let i = 0; i < 3; i++) {
      expect(canPlayToday(p, D0)).toBe(true);
      const plan = buildDailyPlan(p, D0, rng());
      expect(plan.day).toBe(i + 1);
      p = play(p, plan, D0).profile;
    }
    expect(p.progress.day).toBe(4);
    expect(canPlayToday(p, D0)).toBe(false);
    expect(sessionsLeft(p, D0)).toBe(0);
    expect(p.progress.streak).toBe(1);
    expect(counts(p).mastered).toBe(0);
    expect(canPlayToday(p, addDays(D0, 1))).toBe(true);
    expect(sessionsLeft(p, addDays(D0, 1))).toBe(3);
  });
  it('program bisa tamat dalam 10 hari kalender', () => {
    let p = newProfile('Budi', 4, '#000', 0, D0);
    let date = D0;
    let days = 0;
    while (!p.progress.completedAt) {
      days++;
      while (canPlayToday(p, date)) p = play(p, buildDailyPlan(p, date, rng()), date).profile;
      date = addDays(date, 1);
    }
    expect(days).toBe(10);
    expect(p.progress.sessionsDone).toBe(30);
  });
});

describe('kartu ingat', () => {
  it('setiap fakta punya kalimat pengingat', () => {
    for (const f of ALL_FACTS) expect(hintForFact(f).length).toBeGreaterThan(5);
    expect(hintForFact('7x8')).toContain('56');
    expect(hintForFact('3x7')).toBe('Dobel dulu jadi 14, lalu tambah 7.');
    expect(hintForFact('4x9')).toBe('Jurus jari: 3 puluhan dan 6 satuan.');
  });
});

describe('peta perjalanan', () => {
  it('jurus tiap hari bisa diulang; hari review/ujian tanpa jurus', () => {
    expect(dayJurus(1).map((j) => j.id)).toEqual(['x10x1']);
    expect(dayJurus(4).map((j) => j.id)).toEqual(['swap']);
    expect(dayJurus(9).map((j) => j.id)).toEqual(['x3', 'x3']);
    expect(dayJurus(19).map((j) => j.id)).toEqual(['seq5678']);
    expect(dayJurus(6)).toEqual([]);
    expect(dayJurus(7)).toEqual([]);
    expect(dayJurus(23, ['6x7']).map((j) => j.id)).toEqual(['x6']);
  });
  it('riwayat menyimpan fakta hari itu', () => {
    const { p } = playDays(8);
    expect(p.history[7].facts).toEqual(['3x3', '3x4']);
    expect(p.history).toHaveLength(8);
  });
});
