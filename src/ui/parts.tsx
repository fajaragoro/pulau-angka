import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import type { FactId } from '../core/types';
import { CORE_FACTS, fid } from '../core/facts';
import type { CellColor } from '../core/progress';

/* ---------- Makhluk faceless: bentuk geometris bermotif, tanpa mata/mulut ---------- */

const INK = '#1D2A44';
const BODY = ['#FF6B4A', '#0F8F8A', '#7A5CE0', '#3D8BFF', '#E85D9E', '#2FA463'];

function shapeEl(shape: number, props: Record<string, unknown>) {
  switch (shape % 6) {
    case 0:
      return <circle cx="50" cy="56" r="33" {...props} />;
    case 1:
      return <rect x="18" y="24" width="64" height="64" rx="14" {...props} />;
    case 2:
      return <path d="M50 20 L88 86 H12 Z" strokeLinejoin="round" {...props} />;
    case 3:
      return <path d="M50 20 L82 38 V74 L50 92 L18 74 V38 Z" strokeLinejoin="round" {...props} />;
    case 4:
      return <path d="M50 18 L86 56 L50 94 L14 56 Z" strokeLinejoin="round" {...props} />;
    default:
      return <rect x="12" y="34" width="76" height="52" rx="26" {...props} />;
  }
}

function patternEl(kind: number, id: string, c: string) {
  switch (kind % 5) {
    case 0:
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="12" fill={c} />
        </pattern>
      );
    case 1:
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="3.2" fill={c} />
        </pattern>
      );
    case 2:
      return (
        <pattern id={id} width="16" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 9 L8 3 L16 9" stroke={c} strokeWidth="3" fill="none" />
        </pattern>
      );
    case 3:
      return (
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="6" stroke={c} strokeWidth="3" fill="none" />
        </pattern>
      );
    default:
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 1.5H14M1.5 0V14" stroke={c} strokeWidth="3" />
        </pattern>
      );
  }
}

function topEl(kind: number, fill: string) {
  const s = { stroke: INK, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind % 3 === 0)
    return (
      <g {...s}>
        <path d="M38 34 L30 12 M62 34 L70 12" fill="none" />
        <circle cx="30" cy="10" r="5" fill={fill} />
        <circle cx="70" cy="10" r="5" fill={fill} />
      </g>
    );
  if (kind % 3 === 1)
    return (
      <g {...s} fill={fill}>
        <path d="M30 36 L36 12 L46 32 Z M44 32 L50 6 L56 32 Z M54 32 L64 12 L70 36 Z" />
      </g>
    );
  return (
    <g {...s} fill={fill}>
      <rect x="28" y="84" width="14" height="12" rx="4" />
      <rect x="58" y="84" width="14" height="12" rx="4" />
    </g>
  );
}

function Sparkles() {
  return (
    <g fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M12 22 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" />
      <path d="M88 60 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
    </g>
  );
}

interface BodyProps {
  shape: number;
  pattern: number;
  top: number;
  color: string;
  gold?: boolean;
  locked?: boolean;
  size?: number;
  className?: string;
}

export function GeoCreature({ shape, pattern, top, color, gold, locked, size = 96, className }: BodyProps) {
  const id = useId().replace(/:/g, '');
  const fill = locked ? '#D9D2C2' : gold ? '#FFC93C' : color;
  const pc = locked ? 'rgba(29,42,68,.10)' : gold ? '#F2A20C' : 'rgba(255,255,255,.5)';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <defs>{patternEl(pattern, id, pc)}</defs>
      {topEl(top, fill)}
      {shapeEl(shape, { fill })}
      {shapeEl(shape, { fill: `url(#${id})` })}
      {shapeEl(shape, { fill: 'none', stroke: INK, strokeWidth: 5 })}
      {gold && <Sparkles />}
    </svg>
  );
}

/** Makhluk bandel untuk satu fakta inti (deterministik per fakta). */
export function Creature({ fact, gold, locked, size, className }: { fact: FactId; gold?: boolean; locked?: boolean; size?: number; className?: string }) {
  const i = Math.max(0, CORE_FACTS.indexOf(fact));
  return <GeoCreature shape={i % 6} pattern={(i * 2 + 1) % 5} top={i % 3} color={BODY[(i * 5 + 2) % 6]} gold={gold} locked={locked} size={size} className={className} />;
}

/** Avatar profil yang tumbuh: telur → baru menetas → tumbuh besar → bintang emas. */
export function Avatar({ shape, color, stage = 2, size = 72 }: { shape: number; color: string; stage?: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  if (stage === 0)
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>{patternEl(shape, id, 'rgba(255,255,255,.55)')}</defs>
        <ellipse cx="50" cy="54" rx="30" ry="38" fill={color} />
        <ellipse cx="50" cy="54" rx="30" ry="38" fill={`url(#${id})`} />
        <ellipse cx="50" cy="54" rx="30" ry="38" fill="none" stroke={INK} strokeWidth="5" />
      </svg>
    );
  if (stage === 1)
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <g transform="translate(22 4) scale(0.56)">
          {shapeEl(shape, { fill: color })}
          {shapeEl(shape, { fill: 'none', stroke: INK, strokeWidth: 8 })}
        </g>
        <path d="M18 56 L30 66 L40 54 L50 66 L60 54 L70 66 L82 56 C82 84 66 94 50 94 C34 94 18 84 18 56 Z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      </svg>
    );
  return <GeoCreature shape={shape} pattern={shape + 1} top={shape} color={color} gold={stage === 3} size={size} />;
}

/* ---------- Peta 10×10 ---------- */

export function MapGrid({ color, numbers, big }: { color: (f: FactId) => CellColor; numbers?: boolean; big?: boolean }) {
  const cells = [];
  for (let a = 1; a <= 10; a++)
    for (let b = 1; b <= 10; b++) {
      const c = color(fid(a, b));
      cells.push(
        <i key={`${a}-${b}`} className={c === 'gray' ? '' : c}>
          {numbers ? a * b : ''}
        </i>,
      );
    }
  return (
    <div className={'map' + (big ? ' big' : '')} role="img" aria-label="Peta perkalian 10 kali 10">
      {cells}
    </div>
  );
}

export function Legend({ blue = true }: { blue?: boolean }) {
  const items: [string, string][] = [
    ['var(--good)', 'Lancar'],
    ['var(--sun)', 'Lambat'],
    ['var(--bad)', 'Salah'],
    ...(blue ? ([['var(--blue)', 'Beres lewat jurus']] as [string, string][]) : []),
    ['var(--gray)', 'Belum dites'],
  ];
  return (
    <div className="legend">
      {items.map(([c, t]) => (
        <span key={t}>
          <b style={{ background: c }} />
          {t}
        </span>
      ))}
    </div>
  );
}

/** Tabel 100 → 15 yang menyusut (stage 0..5). */
export function ShrinkGrid({ stage }: { stage: number }) {
  const gone = [
    [1, 10],
    [2],
    [5],
    [9],
  ]
    .slice(0, Math.min(stage, 4))
    .flat();
  const cells = [];
  for (let a = 1; a <= 10; a++)
    for (let b = 1; b <= 10; b++) {
      const g = gone.includes(a) || gone.includes(b) || (stage >= 5 && a > b);
      cells.push(
        <i key={`${a}-${b}`} className={g ? 'gone' : stage >= 5 ? 'keep' : ''}>
          {a * b}
        </i>,
      );
    }
  return <div className="map big">{cells}</div>;
}

/* ---------- Keypad ---------- */

export function Keypad({ onDigit, onDelete, onSkip, skipLabel = 'Lewati' }: { onDigit: (d: string) => void; onDelete: () => void; onSkip?: () => void; skipLabel?: string }) {
  return (
    <div className="keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} className="key" onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <button className="key alt" onClick={onDelete}>
        Hapus
      </button>
      <button className="key" onClick={() => onDigit('0')}>
        0
      </button>
      {onSkip ? (
        <button className="key alt" onClick={onSkip}>
          {skipLabel}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

/* ---------- Parent gate ---------- */

export function ParentGate({ onPass, onCancel, reason }: { onPass: () => void; onCancel: () => void; reason: string }) {
  const q = useMemo(() => ({ a: 12 + Math.floor(Math.random() * 8), b: 6 + Math.floor(Math.random() * 4) }), []);
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);
  const submit = () => {
    if (Number(val) === q.a * q.b) onPass();
    else {
      setErr(true);
      setVal('');
    }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="card stack">
        <h2>Khusus orang tua</h2>
        <p>{reason} Jawab dulu soal ini:</p>
        <div className="eq">
          {q.a} × {q.b} = ?
        </div>
        <input className="input" inputMode="numeric" autoFocus value={val} aria-label="Jawaban" onChange={(e) => setVal(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <div className="banner bad">Jawaban belum tepat. Minta bantuan Ayah/Bunda ya.</div>}
        <button className="btn sea" onClick={submit}>
          Lanjut
        </button>
        <button className="link" onClick={onCancel}>
          Batal
        </button>
      </div>
    </div>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="row between noprint" style={{ marginBottom: 14 }}>
      <div className="row grow">
        {onBack && (
          <button className="xbtn" onClick={onBack} aria-label="Kembali">
            ←
          </button>
        )}
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}

/** Jam yang memicu render ulang tiap interval. */
export function useTick(ms: number, active = true) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms, active]);
}
