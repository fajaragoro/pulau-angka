import { useMemo } from 'react';
import type { Profile } from '../core/types';
import { CORE_FACTS, factLabel } from '../core/facts';
import { getFact } from '../core/mastery';
import { TOTAL_DAYS, coreIntroduced } from '../core/curriculum';
import { MAX_SESSIONS_PER_DAY, STAGE_NAMES, type Summary, canPlayToday, counts, currentStreak, dailyDone, sessionsLeft, growthStage, mapColor, programDone } from '../core/progress';
import { BONUS_PER_DAY, BONUS_TITLES, type BonusMode, type SessionAnswer, type SessionPlan, bonusLeft, bonusOpen, bonusPool, buildDailyPlan, islandName, kantinOpen, remedialLeft } from '../core/session';
import { backupDue } from '../core/backup';
import { todayStr } from '../core/util';
import { Avatar, Creature, Header, Legend, MapGrid } from './parts';
import { SessionRunner } from './Session';
import { useStore } from './store';

export function CreatureShelf({ p }: { p: Profile }) {
  const intro = new Set(coreIntroduced(p.progress.day - 1));
  return (
    <div className="creatures">
      {CORE_FACTS.map((f) => {
        const s = getFact(p, f);
        const gold = s.status === 'mastered';
        return (
          <div key={f}>
            <Creature fact={f} gold={gold} locked={!intro.has(f) && !gold} size={52} />
            <div>{factLabel(f)}</div>
            <div className="pips" aria-label={`Lancar ${s.fluentDays.length} dari 3 hari`}>
              {[0, 1, 2].map((i) => (
                <i key={i} className={i < s.fluentDays.length ? 'on' : ''} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HomeProps {
  p: Profile;
  onPlay: () => void;
  onBonus: () => void;
  onReport: () => void;
  onCert: () => void;
  onReplay: () => void;
  onKantin: () => void;
  onSwitch: () => void;
  onParent: () => void;
}

export function ProfileHome({ p, onPlay, onBonus, onReport, onCert, onReplay, onKantin, onSwitch, onParent }: HomeProps) {
  const { account } = useStore();
  const today = todayStr();
  const pr = p.progress;
  const done = programDone(p);
  const can = canPlayToday(p, today);
  const plan = useMemo(() => (done ? null : buildDailyPlan(p, today)), [p, today, done]);
  const c = counts(p);
  const streak = currentStreak(p, today);
  const stage = growthStage(p);
  const left = bonusLeft(p, today);
  return (
    <div className="stack">
      <div className="row between">
        <div className="row">
          <Avatar shape={p.shape} color={p.color} stage={stage} size={68} />
          <div>
            <h2>Halo, {p.name}!</h2>
            <span className="small">Makhlukmu: {STAGE_NAMES[stage]}</span>
          </div>
        </div>
        <span className="badge sun" aria-label={`Streak ${streak} hari`}>
          ★ {streak} hari
        </span>
      </div>

      {backupDue(account, today) && (
        <button className="banner" style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={onParent}>
          <b>Untuk Ayah/Bunda:</b> sudah waktunya mencadangkan data latihan. Ketuk untuk membuka Area Orang Tua.
        </button>
      )}

      <div className="card seabg stack">
        {done ? (
          <>
            <h2>Program 30 hari selesai!</h2>
            <p>Semua pulau sudah ditaklukkan. Ronde Bonus tetap bisa dimainkan untuk menjaga hafalan.</p>
            <button className="btn sun" onClick={onCert}>
              Lihat sertifikat
            </button>
          </>
        ) : (
          <>
            <div className="row between">
              <span className="badge">{pr.pending ? `Ulangan Pulau ${pr.pending.island}` : `Hari ke-${pr.day} dari ${TOTAL_DAYS}`}</span>
              <span className="small">{islandName(plan!.island)}</span>
            </div>
            <h2>{plan!.title}</h2>
            {!dailyDone(p, today) ? (
              <button className="btn sun" onClick={onPlay}>
                Main hari ini (3 menit)
              </button>
            ) : can ? (
              <>
                <div className="banner good" style={{ color: 'var(--ink)' }}>
                  Sesi hari ini sudah selesai. Masih semangat? Boleh lanjut ke hari berikutnya.
                </div>
                <button className="btn sun" onClick={onPlay}>
                  Akselerasi: lanjut sekarang ({sessionsLeft(p, today)})
                </button>
              </>
            ) : (
              <div className="banner good" style={{ color: 'var(--ink)' }}>
                Sudah {MAX_SESSIONS_PER_DAY} sesi hari ini. Otak perlu istirahat supaya hafalannya menempel. Lanjut besok!
              </div>
            )}
          </>
        )}
      </div>

      <ExtraButtons p={p} onReplay={onReplay} onKantin={onKantin} />

      <div className="row">
        <button className="btn sea" disabled={!bonusOpen(p, today)} onClick={onBonus}>
          Ronde Bonus{pr.lastSessionDate === today || done ? ` (${left})` : ''}
        </button>
        <button className="btn white" onClick={onReport}>
          Rapor Guru
        </button>
      </div>
      {!bonusOpen(p, today) && !done && pr.lastSessionDate !== today && <p className="small muted center">Ronde Bonus terbuka setelah sesi hari ini selesai.</p>}
      {left === 0 && <p className="small muted center">Ronde Bonus hari ini sudah habis ({BONUS_PER_DAY}/{BONUS_PER_DAY}). Sampai besok!</p>}

      <div className="card stack">
        <div className="row between">
          <h3>Peta Pulau</h3>
          <span className="small">
            <b>{c.fluent}</b>/55 lancar · <b>{c.mastered}</b> hafal
          </span>
        </div>
        <MapGrid color={(f) => mapColor(p, f)} />
        <Legend />
      </div>

      <div className="card stack">
        <div className="row between">
          <h3>15 makhluk bandel</h3>
          <span className="small">
            <b>{c.coreMastered}</b>/15 emas
          </span>
        </div>
        <CreatureShelf p={p} />
        <p className="small muted">Tiga titik hijau = lancar di 3 hari berbeda → makhluk jadi emas.</p>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="link" onClick={onSwitch}>
          Ganti profil
        </button>
        <button className="link" onClick={onParent}>
          Area orang tua
        </button>
      </div>
    </div>
  );
}

/** Remedial (ulangi soal hari ini) dan, di bawahnya, Pergi ke Kantin. Muncul setelah sesi harian selesai. */
export function ExtraButtons({ p, onReplay, onKantin }: { p: Profile; onReplay: () => void; onKantin: () => void }) {
  const today = todayStr();
  const left = remedialLeft(p, today);
  if (!kantinOpen(p, today)) return null;
  return (
    <>
      {p.lastPlan?.date === today && (
        <button className="btn white" disabled={left === 0} onClick={onReplay}>
          Remedial: ulangi soal hari ini ({left})
        </button>
      )}
      <button className="btn sun" onClick={onKantin}>
        Pergi ke Kantin
      </button>
    </>
  );
}

const KIND_INTRO: Record<string, string> = {
  lesson: 'Pemanasan, jurus baru, lalu latihan.',
  review: 'Hari ini mengulang yang sudah dipelajari. Tidak ada jurus baru.',
  bandel: 'Hari ini melawan fakta yang paling bandel untukmu.',
  exam: 'Ujian pulau: jawab semua soal sebisamu. Lulus jika 8 dari 10 benar.',
  reexam: 'Ujian ulang. Kamu sudah berlatih, sekarang pasti lebih siap!',
  remedial: 'Latihan khusus untuk fakta yang kemarin belum berhasil.',
  final: 'Tes akhir: sama seperti tes awal. Tunjukkan semua yang sudah kamu hafal!',
};

export function DailySession({ p, replay, onFinish, onQuit }: { p: Profile; replay?: SessionPlan; onFinish: (plan: SessionPlan, a: SessionAnswer[]) => void; onQuit: () => void }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => replay ?? buildDailyPlan(p, todayStr()), []);
  const test = plan.phases[0]?.type === 'quiz' && plan.phases[0].test;
  return (
    <SessionRunner
      plan={plan}
      onFinish={(a) => onFinish(plan, a)}
      onQuit={onQuit}
      intro={
        <div className="card stack">
          <span className="badge sun" style={{ alignSelf: 'flex-start' }}>
            {replay ? 'Remedial · ' : ''}
            {plan.kind === 'remedial' || plan.kind === 'reexam' ? `Pulau ${plan.island}` : `Hari ke-${plan.day}`} · {islandName(plan.island)}
          </span>
          <h2>{plan.title}</h2>
          <p>{replay ? 'Soal yang sama dengan sesi hari ini. Kesempatan memperbaiki hasilmu!' : KIND_INTRO[plan.kind]}</p>
          {test && <p className="small">Di bagian tes, tiap soal punya waktu 6 detik. Tidak tahu? Tekan Lewati. Tidak apa-apa salah.</p>}
          {plan.newFacts.length > 0 && (
            <div className="row" style={{ justifyContent: 'center' }}>
              {plan.newFacts.map((f) => (
                <div key={f} className="center" style={{ fontWeight: 600 }}>
                  <Creature fact={f} size={70} className="wiggle" />
                  <div>{factLabel(f)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

export function SummaryView({ p, s, onHome, onBonus, onCert, onReplay, onKantin, onNext }: { p: Profile; s: Summary; onHome: () => void; onNext: () => void; onBonus: () => void; onCert: () => void; onReplay: () => void; onKantin: () => void }) {
  const today = todayStr();
  const bonus = s.kind === 'bonus';
  const head = s.exam ? (s.exam.passed ? `Lulus ${s.title}!` : 'Belum lulus, tidak apa-apa') : bonus ? `${s.title} selesai!` : s.replay ? 'Remedial selesai!' : `Hebat, ${p.name}!`;
  return (
    <div className="stack">
      <h1 className="center">{head}</h1>
      <div className="card stack">
        <div className="tiles">
          <div className="tile">
            <b>
              {s.correct}/{s.total}
            </b>
            <span>benar</span>
          </div>
          <div className="tile">
            <b>{s.fluent}</b>
            <span>lancar (≤ 3 detik)</span>
          </div>
          <div className="tile">
            {bonus ? (
              <>
                <b>{bonusLeft(p, today)}</b>
                <span>ronde bonus tersisa</span>
              </>
            ) : (
              <>
                <b>★ {s.streak}</b>
                <span>hari berturut-turut</span>
              </>
            )}
          </div>
        </div>
        {s.newRecord && <div className="banner good">Rekor baru Tantangan Kilat: {s.correct} benar dalam 60 detik!</div>}
        {s.exam &&
          (s.exam.passed ? (
            <div className="banner good">Nilai {Math.round(s.exam.score * 100)}%. Pulau berikutnya terbuka!</div>
          ) : (
            <div className="banner">
              Nilai {Math.round(s.exam.score * 100)}% (lulus di 80%). Boleh coba Remedial sekarang. {p.progress.pending?.stage === 'remedial1' ? 'Besok ada latihan khusus, lalu ujian ulang.' : 'Besok ada latihan khusus, lalu lanjut ke pulau berikutnya.'}
            </div>
          ))}
        {s.newFacts.length > 0 && (
          <div>
            <p className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
              Makhluk hari ini
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              {s.newFacts.map((f) => (
                <div key={f} className="center small" style={{ fontWeight: 600 }}>
                  <Creature fact={f} gold={getFact(p, f).status === 'mastered'} size={64} />
                  <div>
                    {factLabel(f)} · {getFact(p, f).fluentDays.length}/3 hari
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="card stack">
        <h3>Peta Pulau sekarang</h3>
        <MapGrid color={(f) => mapColor(p, f)} />
        <Legend />
      </div>
      {s.programCompleted && (
        <button className="btn sun" onClick={onCert}>
          Ambil sertifikat
        </button>
      )}
      {!bonus && <ExtraButtons p={p} onReplay={onReplay} onKantin={onKantin} />}
      {!bonus && canPlayToday(p, today) && (
        <button className="btn white" onClick={onNext}>
          Akselerasi: lanjut ke hari berikutnya ({sessionsLeft(p, today)})
        </button>
      )}
      {bonusOpen(p, today) && (
        <button className="btn sea" onClick={onBonus}>
          {bonus ? 'Ronde Bonus lagi' : 'Mau tambah? Ronde Bonus 60 detik'}
        </button>
      )}
      <button className="btn" onClick={onHome}>
        {bonus || s.programCompleted ? 'Kembali ke beranda' : 'Selesai untuk hari ini'}
      </button>
    </div>
  );
}

const BONUS_DESC: Record<BonusMode, string> = {
  kilat: 'Jawab sebanyak mungkin dalam 60 detik dari fakta yang sudah dipelajari.',
  revans: 'Lawan lagi makhluk bandel yang sudah kamu temui.',
  acak: 'Campuran fakta yang petanya masih kuning atau merah.',
};
const BONUS_EMPTY: Record<BonusMode, string> = {
  kilat: 'Belum ada fakta yang dipelajari.',
  revans: 'Makhluk bandel pertama muncul di Hari 8.',
  acak: 'Tidak ada kotak kuning atau merah. Keren!',
};

export function BonusMenu({ p, onPick, onBack }: { p: Profile; onPick: (m: BonusMode) => void; onBack: () => void }) {
  const left = bonusLeft(p, todayStr());
  return (
    <div className="stack">
      <Header title="Ronde Bonus" onBack={onBack} right={<span className="badge sun">{left} tersisa</span>} />
      <p>Latihan tambahan 60 detik. Maksimal {BONUS_PER_DAY} ronde sehari supaya waktu layar tetap terjaga.</p>
      {(['kilat', 'revans', 'acak'] as BonusMode[]).map((m) => {
        const empty = bonusPool(p, m).length === 0;
        return (
          <div key={m} className="card stack">
            <div className="row between">
              <h3>{BONUS_TITLES[m]}</h3>
              {m === 'kilat' && p.bonus.bestKilat > 0 && <span className="badge good">Rekor {p.bonus.bestKilat}</span>}
            </div>
            <p className="small">{empty ? BONUS_EMPTY[m] : BONUS_DESC[m]}</p>
            <button className="btn sea" disabled={empty || left === 0} onClick={() => onPick(m)}>
              Main 60 detik
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function BonusSession({ plan, onFinish, onQuit }: { plan: SessionPlan; onFinish: (a: SessionAnswer[]) => void; onQuit: () => void }) {
  return (
    <SessionRunner
      plan={plan}
      onFinish={onFinish}
      onQuit={onQuit}
      intro={
        <div className="card stack">
          <span className="badge sun" style={{ alignSelf: 'flex-start' }}>
            Ronde Bonus · 60 detik
          </span>
          <h2>{plan.title}</h2>
          <p>{BONUS_DESC[plan.bonusMode!]}</p>
        </div>
      }
    />
  );
}
