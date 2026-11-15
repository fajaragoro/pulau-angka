import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { FactId } from '../core/types';
import { answerOf, isCore, parseFact } from '../core/facts';
import { type Jurus, type Vis, hintForFact, jurusForFact } from '../core/jurus';
import { PracticeQueue, type SessionAnswer, type SessionPlan, TEST_TIMEOUT_MS } from '../core/session';
import { Creature, Keypad, ShrinkGrid, useTick } from './parts';
import { sfx, speak, stopSpeak } from './sound';

/* ---------- Satu soal: jawab dengan mengetik, auto-submit ---------- */

interface QuizProps {
  fact: FactId;
  flip: boolean;
  /** Soal tes: batas waktu per soal & jawaban benar tidak dibocorkan */
  test: boolean;
  top?: ReactNode;
  /** Jeda waktu sesi selama kartu ingat tampil */
  onPause?: (paused: boolean) => void;
  onPeek?: () => void;
  onDone: (r: { ok: boolean; ms: number | null }) => void;
}

type Stage = 'ask' | 'fb' | 'card' | 'retype' | 'end';

/**
 * Saat salah (di luar tes): waktu berhenti → "kartu ingat" menampilkan jawaban + satu kalimat jurus
 * → kartu ditutup → anak mengetik sendiri dari ingatan → baru lanjut. Inilah inti menghafalnya.
 */
export function Quiz({ fact, flip, test, top, onPause, onPeek, onDone }: QuizProps) {
  const [a0, b0] = parseFact(fact);
  const [a, b] = flip ? [b0, a0] : [a0, b0];
  const ans = String(answerOf(fact));
  const [input, setInputState] = useState('');
  const [stage, setStageState] = useState<Stage>('ask');
  const [fb, setFb] = useState<null | 'ok' | 'no' | 'skip'>(null);
  const r = useRef({ t0: performance.now(), first: null as number | null, stage: 'ask' as Stage, input: '', result: { ok: false, ms: null as number | null }, timers: [] as number[] });
  const cb = useRef({ onDone, onPause });
  cb.current = { onDone, onPause };

  const setStage = (st: Stage) => {
    r.current.stage = st;
    setStageState(st);
  };
  const setInput = (v: string) => {
    r.current.input = v;
    setInputState(v);
  };
  const later = (fn: () => void, ms: number) => r.current.timers.push(window.setTimeout(fn, ms));

  const showCard = () => {
    setInput('');
    setFb(null);
    setStage('card');
    speak(`${a} × ${b} = ${ans}. ${hintForFact(fact)}`);
  };

  const finish = (ok: boolean, skipped: boolean) => {
    if (r.current.stage !== 'ask') return;
    r.current.result = { ok, ms: skipped ? null : r.current.first };
    if (ok || test) {
      setStage('fb');
      setFb(ok ? 'ok' : skipped ? 'skip' : 'no');
      if (ok) sfx('ok');
      later(() => cb.current.onDone(r.current.result), ok ? 450 : 350);
      return;
    }
    sfx('no');
    cb.current.onPause?.(true);
    setFb(skipped ? 'skip' : 'no');
    setStage('fb');
    later(showCard, skipped ? 150 : 600);
  };

  const digit = (d: string) => {
    const st = r.current.stage;
    if (st !== 'ask' && st !== 'retype') return;
    if (st === 'ask' && r.current.first === null) r.current.first = Math.round(performance.now() - r.current.t0);
    const next = (r.current.input + d).slice(0, ans.length);
    setInput(next);
    // Auto-submit saat jumlah digit sama dengan jawaban.
    if (next.length !== ans.length) return;
    if (st === 'ask') return finish(next === ans, false);
    if (next === ans) {
      sfx('ok');
      setFb('ok');
      setStage('end');
      later(() => {
        cb.current.onPause?.(false);
        cb.current.onDone(r.current.result);
      }, 600);
    } else {
      sfx('no');
      setFb('no');
      setStage('fb');
      later(showCard, 600);
    }
  };
  const del = () => {
    if (r.current.stage === 'ask' || r.current.stage === 'retype') setInput(r.current.input.slice(0, -1));
  };
  const skip = () => {
    if (r.current.stage === 'ask') finish(false, true);
    else if (r.current.stage === 'retype') showCard();
  };
  const closeCard = () => {
    stopSpeak();
    sfx('tap');
    setInput('');
    setStage('retype');
  };

  const keys = useRef({ digit, del });
  keys.current = { digit, del };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) keys.current.digit(e.key);
      else if (e.key === 'Backspace') keys.current.del();
    };
    window.addEventListener('keydown', onKey);
    const cur = r.current;
    if (test) cur.timers.push(window.setTimeout(() => finishRef.current(false, true), TEST_TIMEOUT_MS));
    return () => {
      window.removeEventListener('keydown', onKey);
      cur.timers.forEach(clearTimeout);
      stopSpeak();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  if (stage === 'card') {
    return (
      <div className="stack">
        <div className="card sun stack center memcard">
          <span className="badge">Kartu Ingat · waktu berhenti</span>
          <div className="eq" style={{ fontSize: '3rem' }}>
            {a} × {b} = {ans}
          </div>
          <p style={{ fontWeight: 500 }}>{hintForFact(fact)}</p>
          <p className="small">Ucapkan pelan-pelan, lalu simpan di kepala.</p>
        </div>
        <button className="btn sea" onClick={closeCard}>
          Sudah ingat, tutup kartu
        </button>
        <button className="btn white" onClick={showCard}>
          Dengar lagi
        </button>
      </div>
    );
  }

  const retype = stage === 'retype' || stage === 'end';
  return (
    <div>
      {top}
      <div className={'card question ' + (fb ?? '')}>
        {retype && <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Sekarang ketik dari ingatanmu</div>}
        <div className="expr" aria-live="polite">
          <span>
            {a} × {b} =
          </span>
          <span className="ansbox">{input || '\u00A0'}</span>
        </div>
        <div className="fbline">
          {fb === 'ok' && <span style={{ color: 'var(--good)' }}>{retype ? 'Nah, sudah ingat!' : 'Benar!'}</span>}
          {fb && fb !== 'ok' && test && <span className="muted">Lanjut…</span>}
          {fb && fb !== 'ok' && !test && <span>Belum tepat. Lihat kartu ingat…</span>}
        </div>
        {test && stage === 'ask' && <div className="qtimer" style={{ animationDuration: `${TEST_TIMEOUT_MS}ms` }} />}
      </div>
      <Keypad onDigit={digit} onDelete={del} onSkip={skip} skipLabel={stage === 'retype' ? 'Lihat kartu' : 'Lewati'} />
      {onPeek && stage === 'ask' && (
        <div className="center" style={{ marginTop: 10 }}>
          <button className="link" onClick={onPeek}>
            Lupa jurusnya? Lihat jurus (waktu berhenti)
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Jurus interaktif (di-tap) ---------- */

function VisView({ vis }: { vis: Vis }) {
  switch (vis.t) {
    case 'eq':
      return (
        <div className="eq">
          {vis.lines.map((l, i) => (
            <div key={i} className="fadein" style={{ animationDelay: `${i * 0.15}s`, animationFillMode: 'backwards' }}>
              {l.split('_').map((part, j, arr) => (
                <span key={j}>
                  {part}
                  {j < arr.length - 1 && <span className="blank" />}
                </span>
              ))}
            </div>
          ))}
        </div>
      );
    case 'dots':
      return (
        <div className="stack center">
          <div className="dots" style={{ gridTemplateColumns: `repeat(${vis.cols}, 20px)` }}>
            {Array.from({ length: vis.rows * vis.cols }, (_, i) => (
              <b key={i} className={vis.splitRows !== undefined && Math.floor(i / vis.cols) >= vis.splitRows ? 'alt' : ''} />
            ))}
          </div>
          {vis.caption && <div className="eq">{vis.caption}</div>}
        </div>
      );
    case 'fingers':
      return (
        <div className="fingers" aria-label="Sepuluh jari">
          {Array.from({ length: 10 }, (_, i) => (
            <b key={i} className={i + 1 === vis.fold ? 'fold' : vis.fold > 0 && i + 1 > vis.fold ? 'r' : ''} style={{ marginRight: i === 4 ? 12 : 0 }} />
          ))}
        </div>
      );
    case 'shrink':
      return <ShrinkGrid stage={vis.stage} />;
    case 'seq':
      return (
        <div className="stack center">
          <div className="seq">
            <span className={vis.reveal ? 'a' : ''}>5</span>
            <span className={vis.reveal ? 'a' : ''}>6</span>
            <em>{vis.reveal ? '=' : ''}</em>
            <span className={vis.reveal ? 'b' : ''}>7</span>
            <em>{vis.reveal ? '×' : ''}</em>
            <span className={vis.reveal ? 'b' : ''}>8</span>
          </div>
          {!vis.reveal && <Creature fact="7x8" size={110} className="wiggle" />}
        </div>
      );
  }
}

export function JurusPlayer({ list, onDone }: { list: Jurus[]; onDone: () => void }) {
  const [ji, setJi] = useState(0);
  const [si, setSi] = useState(0);
  const [round, setRound] = useState(0);
  const j = list[ji];
  const step = j.steps[si];
  const lastStep = si === j.steps.length - 1;
  const lastJurus = ji === list.length - 1;

  // Narasi: tiap langkah dibacakan, seperti ada guru yang menjelaskan.
  useEffect(() => {
    speak(step.say);
    return stopSpeak;
  }, [step, round]);

  const next = () => {
    sfx('tap');
    if (!lastStep) setSi(si + 1);
    else if (!lastJurus) {
      setJi(ji + 1);
      setSi(0);
    } else onDone();
  };
  const repeat = () => {
    sfx('tap');
    setSi(0);
    setRound(round + 1);
  };
  return (
    <div className="stack">
      <div className="card sun tight center">
        <div className="small">
          Jurus baru{list.length > 1 ? ` (${ji + 1}/${list.length})` : ''}
        </div>
        <h2>{j.title}</h2>
      </div>
      <div className="card stack center" key={`${ji}-${si}-${round}`} style={{ minHeight: 250, justifyContent: 'center' }}>
        <VisView vis={step.vis} />
        <p className="fadein" style={{ fontSize: '1.08rem', fontWeight: 500 }}>
          {step.say}
        </p>
        <button className="btn white sm" onClick={() => speak(step.say)}>
          Dengar lagi
        </button>
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
        {j.steps.map((_, i) => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: 5, border: '2px solid var(--ink)', background: i <= si ? 'var(--ink)' : '#fff' }} />
        ))}
      </div>
      {lastStep ? (
        <>
          <p className="center" style={{ fontWeight: 600 }}>
            Sudah paham jurusnya?
          </p>
          <button className="btn sea" onClick={next}>
            Paham!
          </button>
          <button className="btn white" onClick={repeat}>
            Belum paham, ulangi
          </button>
        </>
      ) : (
        <button className="btn sea" onClick={next}>
          Lanjut
        </button>
      )}
    </div>
  );
}

/* ---------- Pelari sesi: pemanasan → jurus → latihan, dengan hard cap waktu ---------- */

const HP_START = 4;
/** Waktu jurus yang dihitung ke sesi paling banyak 60 detik; mengulang jurus tidak memotong waktu latihan. */
const JURUS_BUDGET_MS = 60_000;

type View = { t: 'intro' } | { t: 'quiz'; fact: FactId; flip: boolean; test: boolean; key: number; pi: number } | { t: 'jurus'; pi: number };

interface RunnerProps {
  plan: SessionPlan;
  intro: ReactNode;
  onFinish: (answers: SessionAnswer[]) => void;
  onQuit: () => void;
}

export function SessionRunner({ plan, intro, onFinish, onQuit }: RunnerProps) {
  const [view, setView] = useState<View>({ t: 'intro' });
  const [quit, setQuit] = useState(false);
  const [hpTick, setHpTick] = useState(0);
  const [peek, setPeek] = useState(false);
  const r = useRef({ start: 0, phaseStart: 0, idx: 0, key: 0, answers: [] as SessionAnswer[], queue: null as PracticeQueue | null, hp: {} as Record<FactId, number>, finished: false, jurusStart: 0, pauseAt: 0 });
  useTick(500, view.t !== 'intro');

  const finish = () => {
    if (r.current.finished) return;
    r.current.finished = true;
    onFinish(r.current.answers);
  };

  const serve = (pi: number): void => {
    const s = r.current;
    const ph = plan.phases[pi];
    if (!ph) return finish();
    const now = performance.now();
    if (ph.type === 'jurus') {
      s.jurusStart = now;
      return setView({ t: 'jurus', pi });
    }
    const fixedTest = ph.type === 'quiz' && ph.test && ph.budgetMs === null;
    // Hard cap: jika waktu habis, soal yang sedang berjalan sudah selesai → tutup sesi.
    if (!fixedTest && now - s.start >= plan.capMs) return finish();
    let fact: FactId;
    if (ph.type === 'quiz') {
      if (s.idx >= ph.items.length || (ph.budgetMs !== null && now - s.phaseStart >= ph.budgetMs)) return startPhase(pi + 1);
      fact = ph.items[s.idx++];
    } else {
      s.queue = s.queue ?? new PracticeQueue(ph.newFacts, ph.known);
      fact = s.queue.next();
    }
    const [a, b] = parseFact(fact);
    setView({ t: 'quiz', fact, flip: a !== b && Math.random() < 0.5, test: ph.type === 'quiz' && ph.test, key: ++s.key, pi });
  };

  const startPhase = (pi: number): void => {
    const s = r.current;
    s.phaseStart = performance.now();
    s.idx = 0;
    s.queue = null;
    serve(pi);
  };

  /** Jeda/lanjutkan jam sesi (kartu ingat & lihat jurus tidak memakan waktu latihan). */
  const pause = (on: boolean) => {
    const s = r.current;
    const now = performance.now();
    if (on && !s.pauseAt) s.pauseAt = now;
    else if (!on && s.pauseAt) {
      s.start += now - s.pauseAt;
      s.phaseStart += now - s.pauseAt;
      s.pauseAt = 0;
    }
  };
  const endPeek = () => {
    pause(false);
    setPeek(false);
    // Soal dimulai ulang supaya waktu menjawab dihitung dari awal.
    if (view.t === 'quiz') setView({ ...view, key: ++r.current.key });
  };

  const begin = () => {
    sfx('tap');
    r.current.start = performance.now();
    startPhase(0);
  };

  const onAnswer = (res: { ok: boolean; ms: number | null }) => {
    if (view.t !== 'quiz') return;
    const s = r.current;
    const ph = plan.phases[view.pi];
    if (ph.type === 'jurus') return;
    s.answers.push({ f: view.fact, ok: res.ok, ms: res.ms, tag: ph.tag });
    if (ph.type === 'practice') {
      s.queue?.report(view.fact, res.ok);
      if (res.ok && isCore(view.fact)) {
        const hp = (s.hp[view.fact] ?? HP_START) - 1;
        s.hp[view.fact] = hp;
        setHpTick(hpTick + 1);
        if (hp === 0) sfx('win');
        if (hp <= 0 && ph.endWhenTamed) return finish();
      }
    }
    serve(view.pi);
  };

  if (view.t === 'intro') {
    return (
      <div className="stack">
        {intro}
        <button className="btn" onClick={begin}>
          Mulai!
        </button>
        <button className="link" onClick={onQuit}>
          Kembali
        </button>
      </div>
    );
  }

  const jurusEnd = () => {
    const s = r.current;
    s.start += Math.max(0, performance.now() - s.jurusStart - JURUS_BUDGET_MS);
    if (view.t === 'jurus') startPhase(view.pi + 1);
  };
  const nowMs = r.current.pauseAt ? r.current.pauseAt : view.t === 'jurus' ? Math.min(performance.now(), r.current.jurusStart + JURUS_BUDGET_MS) : performance.now();
  const elapsed = nowMs - r.current.start;
  const pct = Math.max(0, 100 - (elapsed / plan.capMs) * 100);
  const ph = plan.phases[view.pi];
  const hp = view.t === 'quiz' ? (r.current.hp[view.fact] ?? HP_START) : HP_START;
  const showCreature = view.t === 'quiz' && ph.type === 'practice' && isCore(view.fact);

  return (
    <div>
      <div className="topbar">
        <button className="xbtn" onClick={() => setQuit(true)} aria-label="Keluar">
          ✕
        </button>
        <div className="timebar" role="progressbar" aria-label="Sisa waktu" aria-valuenow={Math.round(pct)}>
          <div style={{ width: `${pct}%`, background: pct < 15 ? 'var(--coral)' : undefined }} />
        </div>
        <span className="badge">{ph.label}</span>
      </div>
      {view.t === 'jurus' && ph.type === 'jurus' && <JurusPlayer list={ph.jurus} onDone={jurusEnd} />}
      {view.t === 'quiz' && peek && <JurusPlayer list={[jurusForFact(view.fact)]} onDone={endPeek} />}
      {view.t === 'quiz' && !peek && (
        <Quiz
          key={view.key}
          fact={view.fact}
          flip={view.flip}
          test={view.test}
          onDone={onAnswer}
          onPause={pause}
          onPeek={
            view.test
              ? undefined
              : () => {
                  pause(true);
                  setPeek(true);
                }
          }
          top={
            showCreature ? (
              <div className="creature-row">
                <Creature fact={view.fact} gold={hp <= 0} size={84} className={hp > 0 ? 'wiggle' : ''} />
                <div>
                  <div className="small" style={{ fontWeight: 600 }}>
                    {hp > 0 ? 'Kekuatan makhluk bandel' : 'Jinak hari ini!'}
                  </div>
                  <div className="hp">
                    <div style={{ width: `${(Math.max(hp, 0) / HP_START) * 100}%` }} />
                  </div>
                </div>
              </div>
            ) : undefined
          }
        />
      )}
      {quit && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="card stack">
            <h2>Keluar dari sesi?</h2>
            <p>Jawaban di sesi ini belum tersimpan dan harus diulang.</p>
            <button className="btn sea" onClick={() => setQuit(false)}>
              Lanjut main
            </button>
            <button className="btn white" onClick={onQuit}>
              Ya, keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
