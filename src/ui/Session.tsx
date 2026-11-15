import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { FactId } from '../core/types';
import { answerOf, isCore, parseFact } from '../core/facts';
import type { Jurus, Vis } from '../core/jurus';
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
  onDone: (r: { ok: boolean; ms: number | null }) => void;
}

export function Quiz({ fact, flip, test, top, onDone }: QuizProps) {
  const [a0, b0] = parseFact(fact);
  const [a, b] = flip ? [b0, a0] : [a0, b0];
  const ans = String(answerOf(fact));
  const [input, setInput] = useState('');
  const [fb, setFb] = useState<null | 'ok' | 'no' | 'skip'>(null);
  const t0 = useRef(performance.now());
  const first = useRef<number | null>(null);
  const done = useRef(false);
  const timers = useRef<number[]>([]);

  const finish = useCallback(
    (ok: boolean, skipped: boolean) => {
      if (done.current) return;
      done.current = true;
      setFb(ok ? 'ok' : skipped ? 'skip' : 'no');
      if (ok) sfx('ok');
      else if (!test) sfx('no');
      const ms = skipped ? null : first.current;
      timers.current.push(window.setTimeout(() => onDone({ ok, ms }), ok ? 450 : test ? 350 : 1600));
    },
    [onDone, test],
  );

  const digit = useCallback(
    (d: string) => {
      if (done.current) return;
      if (first.current === null) first.current = Math.round(performance.now() - t0.current);
      setInput((cur) => {
        const next = (cur + d).slice(0, ans.length);
        // Auto-submit saat jumlah digit sama dengan jawaban.
        if (next.length === ans.length) queueMicrotask(() => finish(next === ans, false));
        return next;
      });
    },
    [ans, finish],
  );
  const del = useCallback(() => {
    if (!done.current) setInput((cur) => cur.slice(0, -1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) digit(e.key);
      else if (e.key === 'Backspace') del();
    };
    window.addEventListener('keydown', onKey);
    if (test) timers.current.push(window.setTimeout(() => finish(false, true), TEST_TIMEOUT_MS));
    const ts = timers.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      ts.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = fb && fb !== 'ok' && !test ? ans : input;
  return (
    <div>
      {top}
      <div className={'card question ' + (fb ?? '')}>
        <div className="expr" aria-live="polite">
          <span>
            {a} × {b} =
          </span>
          <span className="ansbox">{shown || ' '}</span>
        </div>
        <div className="fbline">
          {fb === 'ok' && <span style={{ color: 'var(--good)' }}>Benar!</span>}
          {fb && fb !== 'ok' && !test && (
            <span>
              Ingat ya: {a} × {b} = {ans}
            </span>
          )}
          {fb && fb !== 'ok' && test && <span className="muted">Lanjut…</span>}
        </div>
        {test && !fb && <div className="qtimer" style={{ animationDuration: `${TEST_TIMEOUT_MS}ms` }} />}
      </div>
      <Keypad onDigit={digit} onDelete={del} onSkip={() => finish(false, true)} />
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
  const r = useRef({ start: 0, phaseStart: 0, idx: 0, key: 0, answers: [] as SessionAnswer[], queue: null as PracticeQueue | null, hp: {} as Record<FactId, number>, finished: false, jurusStart: 0 });
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
  const nowMs = view.t === 'jurus' ? Math.min(performance.now(), r.current.jurusStart + JURUS_BUDGET_MS) : performance.now();
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
      {view.t === 'quiz' && (
        <Quiz
          key={view.key}
          fact={view.fact}
          flip={view.flip}
          test={view.test}
          onDone={onAnswer}
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
