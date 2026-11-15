import { useState } from 'react';
import type { Profile } from '../core/types';
import { factLabel } from '../core/facts';
import { DAYS, TOTAL_DAYS, dayDef } from '../core/curriculum';
import { getFact } from '../core/mastery';
import { dayJurus, islandName } from '../core/session';
import { formatTanggal } from '../core/util';
import { Creature, Header } from './parts';
import { JurusPlayer } from './Session';

const INK = '#1D2A44';
const COLS = 5;
const ROW_H = 74;

/** Posisi pulau hari ke-n: jalur berkelok seperti ular, 5 pulau per baris. */
function pos(day: number): { x: number; y: number } {
  const i = day - 1;
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const c = row % 2 === 0 ? col : COLS - 1 - col;
  return { x: 40 + c * 70, y: 48 + row * ROW_H + (col % 2 ? 8 : 0) };
}

function Boat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="boat" stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M0 -30 V-6" fill="none" />
      <path d="M2 -30 L18 -10 H2 Z" fill="#fff" />
      <path d="M-2 -26 L-14 -10 H-2 Z" fill="#FFC93C" />
      <path d="M-18 -6 H18 L12 6 H-12 Z" fill="#FF6B4A" />
    </g>
  );
}

/**
 * Peta perjalanan 30 hari: tiap hari = satu pulau, perahu berada di pulau hari ini.
 * Pulau yang sudah dilewati bisa diketuk untuk mengulang pelajarannya.
 */
export function JourneyMap({ p, onDay, onToday }: { p: Profile; onDay: (day: number) => void; onToday: () => void }) {
  const cur = Math.min(p.progress.day, TOTAL_DAYS + 1);
  const rows = Math.ceil(TOTAL_DAYS / COLS);
  const H = rows * ROW_H + 40;
  const pts = DAYS.map((d) => pos(d.day));
  return (
    <svg viewBox={`0 0 360 ${H}`} width="100%" role="group" aria-label="Peta perjalanan 30 hari" style={{ display: 'block', borderRadius: 14, border: `3px solid ${INK}` }}>
      <rect width="360" height={H} fill="#BFE9EA" />
      {Array.from({ length: rows * 2 }, (_, i) => (
        <path key={i} d={`M${(i * 97) % 300 + 10} ${i * 37 + 22} q8 -7 16 0 t16 0`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      ))}
      <polyline points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" opacity="0.55" />
      {DAYS.map((d) => {
        const { x, y } = pos(d.day);
        const done = d.day < cur;
        const here = d.day === cur;
        const special = d.kind === 'exam' || d.kind === 'final';
        const fill = done ? (special ? '#FFC93C' : '#2FA463') : here ? '#FFF3DC' : '#D9D2C2';
        const act = done ? () => onDay(d.day) : here ? onToday : undefined;
        return (
          <g
            key={d.day}
            transform={`translate(${x} ${y})`}
            role={act ? 'button' : undefined}
            tabIndex={act ? 0 : undefined}
            aria-label={`Hari ${d.day}: ${d.title}${done ? ' (selesai, ketuk untuk mengulang)' : here ? ' (hari ini)' : ' (belum terbuka)'}`}
            onClick={act}
            onKeyDown={(e) => act && (e.key === 'Enter' || e.key === ' ') && act()}
            style={{ cursor: act ? 'pointer' : 'default' }}
            opacity={done || here ? 1 : 0.75}
          >
            <ellipse cx="0" cy="8" rx="27" ry="15" fill="#F6E3B4" stroke={INK} strokeWidth="3" />
            <path d={special ? 'M-18 6 L0 -22 L18 6 Z' : 'M-20 6 C-20 -14 20 -14 20 6 Z'} fill={fill} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            {special && <path d="M0 -22 V-34 M0 -34 L11 -30 L0 -26" fill="#FF6B4A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}
            <text x="0" y="4" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="14" fill={done && !special ? '#fff' : INK}>
              {d.day}
            </text>
          </g>
        );
      })}
      {cur <= TOTAL_DAYS && <Boat x={pos(cur).x + 24} y={pos(cur).y + 12} />}
    </svg>
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
