import { useMemo, useState } from 'react';
import type { FactId } from '../core/types';
import { CORE_FACTS, factLabel, parseFact } from '../core/facts';
import { gradeAnswer } from '../core/mastery';
import { type CellColor, gradeAllowed, gradeColor } from '../core/progress';
import { type SessionAnswer, buildDemoPlan } from '../core/session';
import { PAYMENT_URL, PRICE_LABEL } from '../config';
import { Creature, Legend, MapGrid, ParentGate, ShrinkGrid } from './parts';
import { SessionRunner } from './Session';
import { sfx } from './sound';

export interface DemoKid {
  name: string;
  grade: number;
}

export function Home({ initial, onStart, onCode, onPrivacy }: { initial: DemoKid | null; onStart: (k: DemoKid) => void; onCode: () => void; onPrivacy: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [grade, setGrade] = useState<number | null>(initial?.grade ?? null);
  const blocked = grade !== null && !gradeAllowed(grade);
  const ready = name.trim().length > 0 && grade !== null && !blocked;
  return (
    <div className="stack">
      <div className="row between">
        <span className="badge sun">Pulau Angka</span>
        <button className="link" onClick={onCode}>
          Sudah punya kode akses?
        </button>
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
        <Creature fact="3x4" size={70} />
        <Creature fact="7x8" size={92} className="wiggle" />
        <Creature fact="6x7" size={70} />
      </div>
      <h1 className="center">
        Perkalian 1–10 itu bukan 100 hafalan. <span className="hl">Cuma 15.</span>
      </h1>
      <p className="center">Program 30 hari, maksimal 3 menit sehari, untuk anak SD kelas 3–6. Coba Hari 1 sekarang, gratis.</p>
      <div className="card stack">
        <div>
          <label className="lbl" htmlFor="nama">
            Nama panggilan anak
          </label>
          <input id="nama" className="input" maxLength={16} value={name} placeholder="mis. Rara" onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <span className="lbl">Kelas berapa?</span>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6].map((g) => (
              <button key={g} className={'chip' + (grade === g ? ' on' : '')} aria-pressed={grade === g} onClick={() => setGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
        {blocked && (
          <div className="banner">
            Untuk kelas 1–2, lebih baik kuatkan <b>penjumlahan</b> dulu ya. Perkalian akan jauh lebih mudah setelah itu. Program penjumlahan segera menyusul!
          </div>
        )}
        <button className="btn" disabled={!ready} onClick={() => onStart({ name: name.trim(), grade: grade! })}>
          Mulai demo gratis
        </button>
        <p className="small muted center">Tanpa daftar, tanpa login. Data anak tidak dikirim ke mana pun.</p>
      </div>
      <button className="link" onClick={onPrivacy}>
        Privasi & data anak
      </button>
    </div>
  );
}

const SECRET = [
  { n: 100, text: 'Tabel perkalian 1–10 punya 100 kotak. Kelihatannya banyak sekali…' },
  { n: 64, text: '×1 angkanya tetap, ×10 tinggal tempel nol. 36 kotak langsung beres!' },
  { n: 49, text: '×2 itu cuma dobel. Beres juga.' },
  { n: 36, text: '×5 itu setengahnya ×10. Beres.' },
  { n: 25, text: '×9 pakai jurus jari. Tinggal 25 kotak.' },
  { n: 15, text: '7×8 sama dengan 8×7. Bolak-balik dihitung satu. Tinggal 15 saja!' },
];

export function Secret({ name, onDone }: { name: string; onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const s = SECRET[stage];
  return (
    <div className="stack">
      <h2 className="center">Rahasia 100 → 15</h2>
      <div className="card sun center tight">
        <div className="bigstat" key={stage} style={{ animation: 'pop .35s' }}>
          {s.n}
        </div>
        <div className="small">{stage < 5 ? 'kotak tersisa' : 'fakta inti. Itu saja yang perlu dihafal!'}</div>
      </div>
      <ShrinkGrid stage={stage} />
      <p className="center" style={{ minHeight: 48, fontWeight: 500 }}>
        {s.text}
      </p>
      <button
        className={'btn' + (stage < 5 ? ' sea' : '')}
        onClick={() => {
          sfx('tap');
          if (stage < 5) setStage(stage + 1);
          else onDone();
        }}
      >
        {stage < 5 ? `Lanjut (${stage + 1}/6)` : `Ayo ${name}, coba Hari 1!`}
      </button>
    </div>
  );
}

export function DemoSession({ kid, onFinish, onQuit }: { kid: DemoKid; onFinish: (a: SessionAnswer[]) => void; onQuit: () => void }) {
  const plan = useMemo(() => buildDemoPlan(), []);
  return (
    <SessionRunner
      plan={plan}
      onFinish={onFinish}
      onQuit={onQuit}
      intro={
        <div className="card stack">
          <h2>Hari 1 untuk {kid.name}</h2>
          <p>Cuma 3 menit. Ada tiga bagian:</p>
          <div className="path">
            <div>
              <span className="num">1</span>
              <span>
                <b>Tes kilat 60 detik.</b> Ketik jawabannya. Tidak tahu? Tekan Lewati, tidak apa-apa.
              </span>
            </div>
            <div>
              <span className="num">2</span>
              <span>
                <b>Jurus baru:</b> ×10 dan ×1.
              </span>
            </div>
            <div>
              <span className="num">3</span>
              <span>
                <b>Jinakkan makhluk bandel</b> 7 × 8.
              </span>
            </div>
          </div>
        </div>
      }
    />
  );
}

const BONUS_CARDS = (
  <div className="stack" style={{ gap: 8 }}>
    <div className="card flat tight">
      <b>Bonus 1 — Rapor Guru</b>
      <p className="small">Laporan perkembangan berformat rapor sekolah: peta sebelum vs sesudah, fakta yang sudah hafal, catatan per materi. Bisa dicetak atau dikirim ke guru lewat WhatsApp.</p>
    </div>
    <div className="card flat tight">
      <b>Bonus 2 — Ronde Bonus</b>
      <p className="small">Latihan tambahan 60 detik setelah sesi harian (maks 3 ronde/hari): Tantangan Kilat, Revans Bandel, dan Pulau Acak.</p>
    </div>
  </div>
);

export function DemoResult({ kid, answers, onCode, onReplay }: { kid: DemoKid; answers: SessionAnswer[]; onCode: () => void; onReplay: () => void }) {
  const [gate, setGate] = useState(false);
  const { grades, coreFluent, coreTested, next } = useMemo(() => {
    const g: Record<FactId, string> = {};
    for (const a of answers) g[a.f] = gradeAnswer(a.ok, a.ms);
    const weak = CORE_FACTS.filter((f) => f !== '7x8' && g[f] !== 'fluent').sort((x, y) => (g[x] === 'wrong' ? 0 : g[x] === 'slow' ? 1 : 2) - (g[y] === 'wrong' ? 0 : g[y] === 'slow' ? 1 : 2));
    return { grades: g, coreFluent: CORE_FACTS.filter((f) => g[f] === 'fluent').length, coreTested: CORE_FACTS.filter((f) => g[f]).length, next: weak.slice(0, 3) };
  }, [answers]);
  const color = (f: FactId): CellColor => {
    if (grades[f]) return gradeColor(grades[f]);
    const [a, b] = parseFact(f);
    return [1, 10].includes(a) || [1, 10].includes(b) ? 'blue' : 'gray';
  };
  const tamed = answers.filter((a) => a.f === '7x8' && a.tag === 'practice' && a.ok).length >= 4;
  const pay = () => {
    setGate(false);
    window.open(PAYMENT_URL, '_blank', 'noopener');
  };
  return (
    <div className="stack">
      <h1 className="center">Hari 1 selesai, {kid.name}!</h1>
      <div className="card stack">
        <div className="row">
          <Creature fact="7x8" gold={tamed} size={76} />
          <div>
            <h3>{tamed ? 'Makhluk 7 × 8 jinak hari ini!' : 'Makhluk 7 × 8 mulai melemah'}</h3>
            <p className="small">Jurus 5-6-7-8: 56 = 7 × 8. Ulangi 3 hari, ia jadi emas selamanya.</p>
          </div>
        </div>
        <div className="tiles">
          <div className="tile">
            <b>
              {coreFluent}/15
            </b>
            <span>fakta inti lancar</span>
          </div>
          <div className="tile">
            <b>19</b>
            <span>fakta beres lewat jurus ×1 & ×10</span>
          </div>
          <div className="tile">
            <b>{coreTested}</b>
            <span>fakta inti sudah dites</span>
          </div>
        </div>
      </div>
      <div className="card stack">
        <h3>Peta Pulau {kid.name} hari ini</h3>
        <MapGrid color={color} />
        <Legend />
        <p className="small">
          Materi sekolah: <b>perkalian bilangan cacah sampai 100</b> (Fase B, kelas 3–4). Di program lengkap, peta ini dibandingkan lagi di hari ke-30 sebagai bukti kemajuan.
        </p>
      </div>
      {next.length > 0 && (
        <div className="card stack">
          <h3>Calon makhluk bandel berikutnya</h3>
          <div className="row" style={{ justifyContent: 'space-around' }}>
            {next.map((f) => (
              <div key={f} className="center" style={{ fontWeight: 600 }}>
                <Creature fact={f} size={72} />
                <div>{factLabel(f)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card stack">
        <h3>Jalur 30 hari</h3>
        <div className="path small">
          {[
            ['1', 'Hari 1–7: Pulau Jurus', '×1, ×10, ×2, ×5, ×9, bolak-balik → 75 kotak menyala'],
            ['2', 'Hari 8–14: Pulau Tiga-Empat', '9 fakta inti pertama'],
            ['3', 'Hari 15–21: Pulau Enam-Delapan', '5 fakta inti berikutnya, termasuk 7×8'],
            ['4', 'Hari 22–28: Pulau Bandel', 'fakta inti terakhir + fakta bandel pribadi'],
            ['★', 'Hari 29–30: Tes akhir', 'peta sesudah + sertifikat'],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="num">{n}</span>
              <span>
                <b>{t}</b>
                <br />
                {d}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="card sun stack">
        <span className="badge" style={{ alignSelf: 'flex-start' }}>Harga prelaunch</span>
        <h2>Lanjutkan sampai Hari 30</h2>
        <div className="price">{PRICE_LABEL}</div>
        <ul className="clean small">
          <li>Sekali bayar, akses selamanya, gratis update</li>
          <li>Sampai 3 profil anak dalam satu perangkat</li>
          <li>Maksimal 3 menit sehari, tanpa iklan</li>
        </ul>
        {BONUS_CARDS}
        <button className="btn" onClick={() => setGate(true)}>
          Beli akses — {PRICE_LABEL}
        </button>
        <p className="small center">Setelah membayar, Anda menerima link aplikasi dan kode akses.</p>
        <button className="btn white" onClick={onCode}>
          Sudah punya kode akses?
        </button>
      </div>
      <button className="link" onClick={onReplay}>
        Ulangi demo
      </button>
      {gate && <ParentGate reason="Pembelian dilakukan oleh orang tua." onPass={pay} onCancel={() => setGate(false)} />}
    </div>
  );
}
