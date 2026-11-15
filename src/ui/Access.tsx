import { useState } from 'react';
import type { Profile } from '../core/types';
import { MAX_PROFILES } from '../core/types';
import { checkCode } from '../core/backup';
import { AVATAR_COLORS, gradeAllowed, growthStage, newProfile, programDone } from '../core/progress';
import { todayStr } from '../core/util';
import { ACCESS } from '../config';
import { requestPersist } from '../storage/db';
import { Avatar, Header, Keypad, ParentGate } from './parts';
import { useStore } from './store';
import { sfx } from './sound';
import type { DemoKid } from './Demo';

export function CodeEntry({ onOk, onBack }: { onOk: () => void; onBack: () => void }) {
  const { update } = useStore();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const digit = (d: string) => {
    if (code.length >= 4) return;
    const next = code + d;
    setErr(false);
    setCode(next);
    if (next.length === 4) {
      if (checkCode(next, ACCESS)) {
        sfx('win');
        update((a) => ({ ...a, access: { code: next, at: todayStr() } }));
        requestPersist();
        onOk();
      } else {
        sfx('no');
        setErr(true);
        setTimeout(() => setCode(''), 500);
      }
    }
  };
  return (
    <div className="stack">
      <Header title="Masukkan kode akses" onBack={onBack} />
      <p>Ketik 4 angka kode akses yang Anda terima setelah pembelian. Cukup sekali; setelah itu tersimpan di perangkat ini.</p>
      <div className={'codeboxes' + (err ? ' err' : '')} aria-label="Kode akses">
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>{code[i] ?? ''}</span>
        ))}
      </div>
      <div style={{ minHeight: 48 }}>{err && <div className="banner bad">Kode belum tepat. Cek lagi pesan yang Anda terima setelah membayar.</div>}</div>
      <Keypad onDigit={digit} onDelete={() => setCode(code.slice(0, -1))} />
    </div>
  );
}

function ProfileForm({ profile, hint, onSave, onCancel, onDelete }: { profile: Profile | null; hint: DemoKid | null; onSave: (v: { name: string; grade: number; color: string; shape: number }) => void; onCancel: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(profile?.name ?? hint?.name ?? '');
  const [grade, setGrade] = useState<number | null>(profile?.grade ?? hint?.grade ?? null);
  const [color, setColor] = useState(profile?.color ?? AVATAR_COLORS[0]);
  const [shape, setShape] = useState(profile?.shape ?? 0);
  const [confirm, setConfirm] = useState<'no' | 'gate' | 'ask'>('no');
  const blocked = grade !== null && !gradeAllowed(grade);
  const ready = name.trim().length > 0 && grade !== null && !blocked;
  return (
    <div className="stack">
      <Header title={profile ? 'Ubah profil' : 'Profil baru'} onBack={onCancel} />
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'center' }}>
          <Avatar shape={shape} color={color} size={96} />
        </div>
        <div>
          <label className="lbl" htmlFor="pnama">
            Nama panggilan
          </label>
          <input id="pnama" className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <span className="lbl">Kelas</span>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6].map((g) => (
              <button key={g} className={'chip' + (grade === g ? ' on' : '')} aria-pressed={grade === g} onClick={() => setGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
        {blocked && <div className="banner">Untuk kelas 1–2, kuatkan penjumlahan dulu ya. Program penjumlahan segera menyusul.</div>}
        <div>
          <span className="lbl">Warna</span>
          <div className="chips">
            {AVATAR_COLORS.map((c) => (
              <button key={c} className={'chip' + (color === c ? ' on' : '')} aria-label={`Warna ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}>
                <span style={{ width: 26, height: 26, borderRadius: 13, background: c, border: '2.5px solid var(--ink)' }} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="lbl">Makhluk</span>
          <div className="chips">
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <button key={s} className={'chip' + (shape === s ? ' on' : '')} aria-label={`Makhluk ${s + 1}`} aria-pressed={shape === s} onClick={() => setShape(s)}>
                <Avatar shape={s} color={color} size={38} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn" disabled={!ready} onClick={() => onSave({ name: name.trim(), grade: grade!, color, shape })}>
          Simpan
        </button>
      </div>
      {onDelete && confirm === 'no' && (
        <button className="link" onClick={() => setConfirm('gate')}>
          Hapus profil ini
        </button>
      )}
      {confirm === 'gate' && <ParentGate reason="Menghapus profil hanya boleh dilakukan orang tua." onPass={() => setConfirm('ask')} onCancel={() => setConfirm('no')} />}
      {confirm === 'ask' && (
        <div className="card stack">
          <h3>Hapus profil {profile?.name}?</h3>
          <p className="small">Semua histori latihan dan peta profil ini akan hilang dan tidak bisa dikembalikan.</p>
          <button className="btn" style={{ background: 'var(--bad)' }} onClick={onDelete}>
            Ya, hapus selamanya
          </button>
          <button className="btn white" onClick={() => setConfirm('no')}>
            Batal
          </button>
        </div>
      )}
    </div>
  );
}

export function Profiles({ hint, onPick, onParent }: { hint: DemoKid | null; onPick: (id: string) => void; onParent: () => void }) {
  const { account, update } = useStore();
  const [edit, setEdit] = useState<null | 'new' | string>(null);
  const profiles = account.profiles;

  if (edit !== null) {
    const p = edit === 'new' ? null : (profiles.find((x) => x.id === edit) ?? null);
    return (
      <ProfileForm
        profile={p}
        hint={profiles.length === 0 ? hint : null}
        onCancel={() => setEdit(null)}
        onSave={(v) => {
          update((a) =>
            p
              ? { ...a, profiles: a.profiles.map((x) => (x.id === p.id ? { ...x, ...v } : x)) }
              : a.profiles.length >= MAX_PROFILES
                ? a
                : { ...a, profiles: [...a.profiles, newProfile(v.name, v.grade, v.color, v.shape, todayStr())] },
          );
          setEdit(null);
        }}
        onDelete={
          p
            ? () => {
                update((a) => ({ ...a, profiles: a.profiles.filter((x) => x.id !== p.id) }));
                setEdit(null);
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="stack">
      <h1 className="center">Siapa yang main?</h1>
      {profiles.length === 0 && <p className="center">Kode akses diterima. Buat profil anak pertama (maksimal {MAX_PROFILES} profil).</p>}
      {profiles.map((p) => (
        <div key={p.id} className="card tight row">
          <button className="profile-card" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => onPick(p.id)}>
            <Avatar shape={p.shape} color={p.color} stage={growthStage(p)} size={64} />
            <span>
              <span style={{ fontFamily: 'var(--display)', fontSize: '1.4rem', display: 'block' }}>{p.name}</span>
              <span className="small">
                Kelas {p.grade} · {programDone(p) ? 'Program selesai' : `Hari ke-${Math.min(p.progress.day, 30)} dari 30`}
              </span>
            </span>
          </button>
          <button className="btn white sm" onClick={() => setEdit(p.id)} aria-label={`Ubah profil ${p.name}`}>
            Ubah
          </button>
        </div>
      ))}
      {profiles.length < MAX_PROFILES && (
        <button className="btn sea" onClick={() => setEdit('new')}>
          + Tambah profil anak
        </button>
      )}
      <button className="link" onClick={onParent}>
        Area orang tua
      </button>
    </div>
  );
}
