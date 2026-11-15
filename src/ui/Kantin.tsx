import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '../core/types';
import { learnedFacts } from '../core/curriculum';
import { KANTIN_MAX, type KantinIcon, buildKantin, rupiah } from '../core/kantin';
import { Header, Keypad } from './parts';
import { sfx, speak, stopSpeak } from './sound';

const INK = '#1D2A44';
const st = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Anak tanpa wajah: kepala polos, badan berwarna profil, tas punggung. */
function Kid({ x, color }: { x: number; color: string }) {
  return (
    <g transform={`translate(${x} 0)`} {...st}>
      <rect x="-8" y="96" width="16" height="30" rx="6" fill="#FF6B4A" />
      <path d="M8 150 L4 176 M26 150 L30 176" fill="none" strokeWidth="7" />
      <rect x="0" y="92" width="34" height="62" rx="12" fill={color} />
      <path d="M34 108 L52 120" fill="none" strokeWidth="7" />
      <circle cx="17" cy="70" r="20" fill="#F2C9A0" />
      <path d="M-2 64 C0 44 34 44 36 64 C28 56 8 56 -2 64 Z" fill={INK} />
    </g>
  );
}

function ItemIcon({ icon, size = 64 }: { icon: KantinIcon; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ flex: "none" }} aria-hidden="true" {...st}>
      {icon === 'donat' && (
        <>
          <circle cx="32" cy="32" r="24" fill="#E85D9E" />
          <circle cx="32" cy="32" r="8" fill="#fff" />
          <path d="M20 20 l4 3 M42 18 l-2 5 M46 34 l-5 1 M22 42 l4 -3 M36 48 l1 -5" stroke="#fff" fill="none" />
        </>
      )}
      {icon === 'minum' && (
        <>
          <path d="M18 18 H46 L42 58 H22 Z" fill="#FFC93C" />
          <path d="M20 30 H44" fill="none" />
          <path d="M34 18 L40 4" fill="none" />
        </>
      )}
      {icon === 'roti' && (
        <>
          <path d="M8 40 C8 22 56 22 56 40 V50 H8 Z" fill="#F2A20C" />
          <path d="M22 30 l-3 8 M32 28 v9 M42 30 l3 8" fill="none" />
        </>
      )}
      {icon === 'nasi' && (
        <>
          <path d="M14 34 C14 16 50 16 50 34 Z" fill="#FFF3DC" />
          <path d="M6 34 H58 C58 50 46 56 32 56 C18 56 6 50 6 34 Z" fill="#0F8F8A" />
        </>
      )}
    </svg>
  );
}

function Scene({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 360 200" width="100%" role="img" aria-label="Seorang anak berjalan menuju kantin sekolah" {...st}>
      <rect x="0" y="176" width="360" height="24" fill="#E8D9B5" stroke="none" />
      <path d="M0 176 H360" fill="none" />
      <rect x="170" y="70" width="170" height="106" fill="#fff" />
      <rect x="170" y="118" width="170" height="58" fill="#0F8F8A" />
      <path d="M160 70 H350 L340 36 H170 Z" fill="#FF6B4A" />
      <path d="M198 36 L192 70 M226 36 L224 70 M255 36 V70 M284 36 L286 70 M312 36 L318 70" fill="none" />
      <rect x="216" y="10" width="78" height="26" rx="8" fill="#FFC93C" />
      <text x="255" y="29" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="16" fill={INK} stroke="none">
        KANTIN
      </text>
      <circle cx="198" cy="106" r="11" fill="#E85D9E" />
      <circle cx="198" cy="106" r="3.5" fill="#fff" />
      <path d="M222 96 H240 L237 118 H225 Z" fill="#FFC93C" />
      <path d="M254 112 C254 98 286 98 286 112 V118 H254 Z" fill="#F2A20C" />
      <circle cx="312" cy="106" r="11" fill="#E85D9E" />
      <circle cx="312" cy="106" r="3.5" fill="#fff" />
      <Kid x={70} color={color} />
    </svg>
  );
}

export function Kantin({ p, onBack }: { p: Profile; onBack: () => void }) {
  const qs = useMemo(() => buildKantin(p.name, learnedFacts(p.progress.day - 1)), [p.name, p.progress.day]);
  const [i, setI] = useState(-1);
  const [input, setInput] = useState('');
  const [fb, setFb] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const q = i >= 0 && i < qs.length ? qs[i] : null;

  // Soal cerita dibacakan supaya anak yang belum lancar membaca tetap bisa ikut.
  useEffect(() => {
    if (q) speak(q.text);
    return stopSpeak;
  }, [q]);

  if (i === -1) {
    return (
      <div className="stack">
        <Header title="Pergi ke Kantin" onBack={onBack} />
        <div className="card stack">
          <Scene color={p.color} />
          <p>
            Bel istirahat berbunyi! {p.name} pergi ke kantin membawa uang jajan. Ada {KANTIN_MAX} soal cerita: hitung harga jajanan dan kembaliannya, pakai perkalian yang sudah kamu hafal.
          </p>
          <p className="small muted">Tidak diburu waktu. Baca pelan-pelan, hitung, lalu tekan Jawab.</p>
        </div>
        <button className="btn" onClick={() => setI(0)}>
          Mulai belanja
        </button>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="stack">
        <h1 className="center">Selesai belanja!</h1>
        <div className="card stack center">
          <Scene color={p.color} />
          <div className="bigstat">
            {score}/{qs.length}
          </div>
          <p>soal cerita dijawab benar</p>
          <p className="small">{score === qs.length ? 'Sempurna! Uang jajanmu aman di tanganmu.' : 'Hafalan perkalianmu sudah terpakai di kantin. Besok coba lagi ya!'}</p>
        </div>
        <button className="btn" onClick={onBack}>
          Kembali ke beranda
        </button>
      </div>
    );
  }

  const submit = () => {
    if (fb !== null || input === '') return;
    const ok = Number(input) === q.answer;
    setFb(ok);
    if (ok) setScore(score + 1);
    sfx(ok ? 'ok' : 'no');
  };
  const next = () => {
    setFb(null);
    setInput('');
    setI(i + 1);
  };
  const shown = input === '' ? ' ' : q.unit === 'rp' ? rupiah(Number(input)) : input;

  return (
    <div className="stack">
      <Header title="Pergi ke Kantin" onBack={onBack} right={<span className="badge sun">Soal {i + 1}/{qs.length}</span>} />
      <div className={'card stack ' + (fb === null ? '' : fb ? 'kantin-ok' : 'kantin-no')}>
        <div className="row">
          <ItemIcon icon={q.icon} />
          <p style={{ fontSize: '1.05rem', fontWeight: 500 }}>{q.text}</p>
        </div>
        <div className="row between">
          <button className="btn white sm" onClick={() => speak(q.text)}>
            Dengar soal
          </button>
          <span className="ansbox" style={{ fontFamily: 'var(--display)', fontSize: '1.7rem', height: 56, minWidth: 150 }} aria-live="polite">
            {shown}
          </span>
        </div>
        {fb !== null && (
          <div className={'banner ' + (fb ? 'good' : 'bad')}>
            <b>{fb ? 'Benar!' : `Belum tepat. Jawabannya ${q.unit === 'rp' ? rupiah(q.answer) : q.answer}.`}</b>
            <br />
            {q.explain}
          </div>
        )}
      </div>
      {fb === null ? (
        <Keypad onDigit={(d) => setInput((cur) => (cur + d).replace(/^0+(?=\d)/, '').slice(0, 6))} onDelete={() => setInput((cur) => cur.slice(0, -1))} onSkip={submit} skipLabel="Jawab" />
      ) : (
        <button className="btn sea" onClick={next}>
          {i + 1 < qs.length ? 'Soal berikutnya' : 'Lihat hasil'}
        </button>
      )}
    </div>
  );
}
