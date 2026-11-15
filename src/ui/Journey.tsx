import { useEffect, useId, useRef, useState } from 'react';
import type { Profile } from '../core/types';
import { factLabel } from '../core/facts';
import { DAYS, TOTAL_DAYS, dayDef } from '../core/curriculum';
import { getFact } from '../core/mastery';
import { dayJurus, islandName } from '../core/session';
import { formatTanggal } from '../core/util';
import { Creature, Header } from './parts';
import { JurusPlayer } from './Session';

const INK = '#1D2A44';
const W = 360;
const SP = 48; // jarak antar hari
const GAP = 86; // laut di antara pulau
const BOTTOM = 96;
const ISLANDS: { id: number; from: number; to: number }[] = [
  { id: 1, from: 1, to: 7 },
  { id: 2, from: 8, to: 14 },
  { id: 3, from: 15, to: 21 },
  { id: 4, from: 22, to: 28 },
  { id: 5, from: 29, to: 30 },
];
const H = BOTTOM + (TOTAL_DAYS - 1) * SP + (ISLANDS.length - 1) * GAP + 150;

/** Posisi titik hari ke-n: jalur berkelok dari bawah (Hari 1) ke atas (Hari 30). */
function pos(day: number): { x: number; y: number } {
  const isl = ISLANDS.findIndex((i) => day >= i.from && day <= i.to);
  return { x: W / 2 + 92 * Math.sin((day - 1) * 0.82 + 0.4), y: H - BOTTOM - (day - 1) * SP - isl * GAP };
}

/** Kurva halus melewati semua titik (Catmull-Rom → Bézier). */
function smoothPath(pts: { x: number; y: number }[]): string {
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
}

const ink = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Boat({ x, y, big, flip }: { x: number; y: number; big?: boolean; flip?: boolean }) {
  const k = big ? 1.25 : 0.85;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -k : k} ${k})`}>
      <g className={big ? 'boat' : undefined} {...ink}>
        <path d="M0 -34 V-6" fill="none" />
        <path d="M3 -34 L22 -10 H3 Z" fill={big ? '#fff' : '#FFC93C'} />
        <path d="M-3 -30 L-16 -10 H-3 Z" fill={big ? '#FFC93C' : '#FF6B4A'} />
        <path d="M-22 -6 H22 L14 8 H-14 Z" fill={big ? '#FF6B4A' : '#8B5A3C'} />
        <path d="M-26 12 q6 -5 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#fff" />
      </g>
    </g>
  );
}

function Palm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...ink}>
      <path d="M0 0 C-2 -14 3 -26 8 -36" fill="none" stroke="#8B5A3C" strokeWidth="7" />
      <path d="M0 0 C-2 -14 3 -26 8 -36" fill="none" strokeWidth="1.5" opacity="0.4" />
      {[-70, -25, 20, 65, 110].map((r) => (
        <path key={r} d="M0 0 C10 -10 24 -8 30 2 C20 -1 10 0 0 0 Z" transform={`translate(8 -36) rotate(${r - 20})`} fill="#2FA463" />
      ))}
    </g>
  );
}

function Volcano({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} {...ink}>
      <circle cx="10" cy="-78" r="13" fill="#fff" />
      <circle cx="-4" cy="-66" r="10" fill="#fff" />
      <circle cx="22" cy="-62" r="9" fill="#fff" />
      <path d="M-44 0 L-12 -50 H12 L44 0 Z" fill="#C8643C" />
      <path d="M-12 -50 H12 L16 -38 L8 -44 L2 -30 L-4 -42 L-12 -34 Z" fill="#FF6B4A" />
      <path d="M-50 0 H50" fill="none" />
    </g>
  );
}

function Peak({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} {...ink}>
      <path d="M-46 0 L-6 -64 L10 -40 L22 -54 L52 0 Z" fill="#7A8FB8" />
      <path d="M-6 -64 L-18 -44 L-8 -48 L0 -40 L6 -48 L10 -40 Z" fill="#fff" />
      <path d="M-6 -64 V-86 M-6 -86 L14 -80 L-6 -74" fill="#FFC93C" />
    </g>
  );
}

function Tree({ x, y, c = '#2FA463' }: { x: number; y: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} {...ink}>
      <rect x="-4" y="-14" width="8" height="16" rx="2" fill="#8B5A3C" />
      <circle cx="0" cy="-26" r="15" fill={c} />
      <circle cx="-11" cy="-16" r="9" fill={c} />
      <circle cx="11" cy="-16" r="9" fill={c} />
    </g>
  );
}

function Rock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} {...ink}>
      <path d="M-18 0 C-20 -14 -6 -20 2 -14 C8 -22 22 -14 18 0 Z" fill="#B9B4A6" />
    </g>
  );
}

function Star({ x, y, c = '#7A5CE0', r = 0 }: { x: number; y: number; c?: string; r?: number }) {
  return <path transform={`translate(${x} ${y}) rotate(${r})`} d="M0 -13 L3.6 -4.5 L12.4 -4 L5.6 1.8 L7.8 10.6 L0 5.8 L-7.8 10.6 L-5.6 1.8 L-12.4 -4 L-3.6 -4.5 Z" fill={c} {...ink} strokeWidth={2.5} />;
}

function Shell({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} {...ink} strokeWidth={2.5}>
      <path d="M-12 4 C-14 -12 14 -12 12 4 Z" fill="#FFF3DC" />
      <path d="M0 4 V-8 M-6 4 L-7 -5 M6 4 L7 -5" fill="none" />
    </g>
  );
}

/** Ikan tanpa wajah: oval bergaris dengan ekor, tanpa mata/mulut. */
function Fish({ x, y, c = '#FFC93C', flip }: { x: number; y: number; c?: string; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} {...ink} strokeWidth={2.5}>
      <path d="M14 0 L26 -9 V9 Z" fill={c} />
      <ellipse cx="0" cy="0" rx="17" ry="11" fill={c} />
      <path d="M-5 -10 V10 M3 -11 V11" stroke="#E85D9E" strokeWidth="4" fill="none" />
    </g>
  );
}

function Cloud({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#fff" opacity="0.85">
      <circle cx="0" cy="0" r="12" />
      <circle cx="14" cy="-4" r="15" />
      <circle cx="30" cy="2" r="11" />
      <rect x="-4" y="2" width="38" height="10" rx="5" />
    </g>
  );
}

/** Makhluk tanpa wajah kecil sebagai penghuni Pulau Bandel. */
function Critter({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`} {...ink}>
      <path d="M-10 -22 L-6 -34 L0 -24 L6 -36 L10 -22 Z" fill={c} />
      <rect x="-15" y="-24" width="30" height="26" rx="8" fill={c} />
      <path d="M-9 -14 H9 M-9 -6 H9" stroke="rgba(255,255,255,.6)" fill="none" />
    </g>
  );
}

function IslandDecor({ id, side, top, bot }: { id: number; side: (day: number) => number; top: number; bot: number }) {
  const y = (t: number) => bot + (top - bot) * t;
  const far = (day: number, t: number, off = 0) => ({ x: side(day) + off, y: y(t) });
  switch (id) {
    case 1:
      return (
        <>
          <Palm {...far(2, 0.16)} s={1.15} />
          <Palm {...far(4, 0.5)} />
          <Shell {...far(3, 0.36, 8)} />
          <Star {...far(5, 0.68, -6)} r={15} />
          <Palm {...far(6, 0.88)} s={0.9} />
        </>
      );
    case 2:
      return (
        <>
          <Volcano {...far(10, 0.36)} />
          <Rock {...far(8, 0.04, 10)} />
          <Tree {...far(13, 0.8)} />
          <Tree {...far(13, 0.9, -26)} c="#58B56B" />
        </>
      );
    case 3:
      return (
        <>
          <Tree {...far(16, 0.18)} c="#58B56B" />
          <Tree {...far(16, 0.24, 22)} />
          <Rock {...far(18, 0.5)} />
          <Star {...far(19, 0.64, 6)} c="#FF6B4A" r={-12} />
          <Palm {...far(20, 0.9)} />
        </>
      );
    case 4:
      return (
        <>
          <Critter {...far(23, 0.2)} c="#7A5CE0" />
          <Critter {...far(25, 0.52)} c="#E85D9E" />
          <Rock {...far(26, 0.68, 8)} />
          <Critter {...far(27, 0.88)} c="#3D8BFF" />
        </>
      );
    default:
      return <Peak x={W / 2} y={y(1) - 30} />;
  }
}

/**
 * Peta perjalanan 30 hari: lima pulau di tengah laut, jalur berkelok dari bawah ke atas,
 * satu titik per hari, perahu di titik hari ini. Titik yang sudah dilewati bisa diketuk
 * untuk mengulang pelajarannya.
 */
export function JourneyMap({ p, onDay, onToday }: { p: Profile; onDay: (day: number) => void; onToday: () => void }) {
  const cur = Math.min(p.progress.day, TOTAL_DAYS + 1);
  const pid = useId().replace(/:/g, '');
  const box = useRef<HTMLDivElement>(null);
  const pts = DAYS.map((d) => pos(d.day));
  const route = smoothPath(pts);
  const here = pos(Math.min(cur, TOTAL_DAYS));

  // Buka peta tepat di posisi perahu.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = here.y * (el.clientWidth / W) - el.clientHeight * 0.55;
  }, [here.y]);

  return (
    <div ref={box} className="journey" role="group" aria-label="Peta perjalanan 30 hari">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <pattern id={pid} width="64" height="40" patternUnits="userSpaceOnUse">
            <path d="M4 12 q8 -7 16 0 t16 0 M36 32 q7 -6 14 0 t14 0" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#3EC6BF" />
        <rect width={W} height={H} fill={`url(#${pid})`} />

        {ISLANDS.map((isl) => {
          const top = pos(isl.to).y;
          const bot = pos(isl.from).y;
          const cy = (top + bot) / 2;
          const ry = (bot - top) / 2 + 52;
          const lobes = [
            { cx: W / 2, cy, rx: 152, ry },
            { cx: 120, cy: cy - ry * 0.42, rx: 104, ry: ry * 0.52 },
            { cx: 244, cy: cy + ry * 0.42, rx: 104, ry: ry * 0.52 },
          ];
          return (
            <g key={isl.id}>
              {lobes.map((l, i) => (
                <ellipse key={'w' + i} {...l} rx={l.rx + 12} ry={l.ry + 12} fill="#8FE3DC" />
              ))}
              {lobes.map((l, i) => (
                <ellipse key={'s' + i} {...l} fill="#FFE3A3" stroke={INK} strokeWidth="6" />
              ))}
              {lobes.map((l, i) => (
                <ellipse key={'f' + i} {...l} fill="#FFE3A3" />
              ))}
              {isl.id !== 1 && isl.id !== 5 && <ellipse cx={W / 2} cy={cy} rx="96" ry={ry * 0.62} fill={isl.id === 4 ? '#E9D6F7' : '#BFE8A6'} opacity="0.7" />}
              <IslandDecor id={isl.id} side={(day) => (pos(day).x < W / 2 ? 292 : 68)} top={top} bot={bot} />
            </g>
          );
        })}

        <Boat x={46} y={pos(7).y - SP - 20} />
        <Fish x={300} y={pos(14).y - SP - 26} flip />
        <Boat x={312} y={pos(21).y - SP - 22} flip />
        <Fish x={56} y={pos(28).y - SP - 24} c="#FF6B4A" />
        <Fish x={318} y={pos(7).y - SP - 30} c="#fff" flip />

        <path d={route} fill="none" stroke={INK} strokeWidth="24" strokeLinecap="round" />
        <path d={route} fill="none" stroke="#FFF8E7" strokeWidth="18" strokeLinecap="round" />
        <path d={route} fill="none" stroke="#E6D3A3" strokeWidth="18" strokeDasharray="2 10" />

        {ISLANDS.map((isl) => {
          const bot = pos(isl.from).y;
          const label = `${isl.id < 5 ? `Pulau ${isl.id}: ` : ''}${islandName(isl.id)}`;
          const w = label.length * 7.4 + 22;
          return (
            <g key={isl.id} transform={`translate(${W / 2} ${bot + 40})`}>
              <rect x={-w / 2} y="-13" width={w} height="26" rx="13" fill="#FFC93C" stroke={INK} strokeWidth="3" />
              <text y="5" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="14" fill={INK}>
                {label}
              </text>
            </g>
          );
        })}

        {DAYS.map((d) => {
          const { x, y } = pos(d.day);
          const done = d.day < cur;
          const now = d.day === cur;
          const special = d.kind === 'exam' || d.kind === 'final';
          const fill = done ? (special ? '#FFC93C' : '#2FA463') : now ? '#fff' : '#D9D2C2';
          const act = done ? () => onDay(d.day) : now ? onToday : undefined;
          return (
            <g
              key={d.day}
              transform={`translate(${x} ${y})`}
              role={act ? 'button' : undefined}
              tabIndex={act ? 0 : undefined}
              aria-label={`Hari ${d.day}: ${d.title}${done ? ' (selesai, ketuk untuk mengulang)' : now ? ' (hari ini)' : ' (belum terbuka)'}`}
              onClick={act}
              onKeyDown={(e) => act && (e.key === 'Enter' || e.key === ' ') && act()}
              style={{ cursor: act ? 'pointer' : 'default' }}
            >
              {now && <circle r="25" fill="none" stroke="#FF6B4A" strokeWidth="5" className="pulse" />}
              <circle r={special ? 20 : 17} cy="3" fill={INK} />
              <circle r={special ? 20 : 17} fill={fill} stroke={INK} strokeWidth="3" />
              {special && <Star x={0} y={-24} c={done ? '#FFC93C' : '#fff'} />}
              <text y="5.5" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="16" fill={done && !special ? '#fff' : INK} opacity={done || now ? 1 : 0.6}>
                {d.day}
              </text>
            </g>
          );
        })}

        <Cloud x={20} y={pos(10).y} />
        <Cloud x={292} y={pos(17).y - 10} />
        <Cloud x={30} y={pos(24).y + 6} />
        {cur <= TOTAL_DAYS && <Boat x={here.x + (here.x < W / 2 ? 44 : -44)} y={here.y + 6} big flip={here.x >= W / 2} />}
      </svg>
    </div>
  );
}

const KIND_NOTE: Record<string, string> = {
  review: 'Hari ini adalah hari review: mengulang semua yang sudah dipelajari, tanpa jurus baru.',
  exam: 'Hari ini adalah ujian pulau, tanpa jurus baru.',
  final: 'Hari ini adalah tes akhir.',
  bandel: 'Hari ini melatih fakta bandel pribadimu.',
};

/** Mengulang pelajaran hari yang sudah dilewati: lihat lagi jurusnya dan fakta hari itu. */
export function DayReview({ p, day, onBack }: { p: Profile; day: number; onBack: () => void }) {
  const d = dayDef(day);
  const hist = p.history.find((h) => h.day === day && h.label === d.title);
  const facts = d.newFacts ?? hist?.facts ?? [];
  const jurus = dayJurus(day, facts);
  const [playing, setPlaying] = useState(false);

  if (playing && jurus.length) {
    return (
      <div className="stack">
        <Header title={`Jurus Hari ke-${day}`} onBack={() => setPlaying(false)} />
        <JurusPlayer list={jurus} onDone={() => setPlaying(false)} label="Mengulang jurus" />
      </div>
    );
  }
  return (
    <div className="stack">
      <Header title={`Hari ke-${day}`} onBack={onBack} />
      <div className="card stack">
        <span className="badge sun" style={{ alignSelf: 'flex-start' }}>
          {islandName(d.island)}
        </span>
        <h2>{d.title}</h2>
        {hist && (
          <p className="small">
            Kamu singgah di pulau ini pada {formatTanggal(hist.date)}: {hist.correct} dari {hist.total} jawaban benar.
          </p>
        )}
        {jurus.length > 0 ? (
          <>
            <p>
              Jurus di pulau ini: <b>{[...new Set(jurus.map((j) => j.title))].join(', ')}</b>
            </p>
            <button className="btn sea" onClick={() => setPlaying(true)}>
              Pelajari jurusnya lagi
            </button>
          </>
        ) : (
          <p>{KIND_NOTE[d.kind]}</p>
        )}
      </div>
      {facts.length > 0 && (
        <div className="card stack">
          <h3>Makhluk di pulau ini</h3>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            {facts.map((f) => {
              const s = getFact(p, f);
              return (
                <div key={f} className="center small" style={{ fontWeight: 600 }}>
                  <Creature fact={f} gold={s.status === 'mastered'} size={64} />
                  <div>{factLabel(f)}</div>
                  <div className="muted">{s.fluentDays.length}/3 hari lancar</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button className="btn white" onClick={onBack}>
        Kembali ke peta
      </button>
    </div>
  );
}
