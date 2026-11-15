import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, Profile } from '../core/types';
import { factLabel } from '../core/facts';
import { exportBackup, parseBackup } from '../core/backup';
import { counts, gradeColor, mapColor } from '../core/progress';
import { buildReport, reportShareText } from '../core/report';
import { formatTanggal, todayStr } from '../core/util';
import { downloadBlob, renderCertificatePng, renderReportPng, shareImage } from './canvas';
import { Header, Legend, MapGrid } from './parts';
import { useStore } from './store';

export function Compare({ p }: { p: Profile }) {
  return (
    <div className="two">
      <div>
        <h4>Hari 0 (tes awal)</h4>
        <MapGrid color={(f) => gradeColor(p.progress.baseline[f])} />
      </div>
      <div>
        <h4>Sekarang</h4>
        <MapGrid color={(f) => mapColor(p, f)} />
      </div>
    </div>
  );
}

export function ReportView({ p, onBack }: { p: Profile; onBack: () => void }) {
  const r = useMemo(() => buildReport(p, todayStr()), [p]);
  const [msg, setMsg] = useState('');
  const file = `rapor-pulau-angka-${p.name.toLowerCase().replace(/\s+/g, '-')}-${r.date}.png`;
  const download = async () => {
    setMsg('Menyiapkan gambar…');
    try {
      downloadBlob(await renderReportPng(p, r), file);
      setMsg('Gambar rapor tersimpan di folder unduhan.');
    } catch {
      setMsg('Gagal membuat gambar. Coba tombol Cetak.');
    }
  };
  const share = async () => {
    setMsg('Menyiapkan…');
    const text = reportShareText(r);
    try {
      if (await shareImage(await renderReportPng(p, r), file, text)) return setMsg('');
    } catch {
      /* lanjut ke cadangan */
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    setMsg('Perangkat ini tidak bisa membagikan gambar langsung, jadi ringkasan teks dibuka di WhatsApp. Unduh gambar untuk melampirkannya.');
  };
  return (
    <div className="stack">
      <Header title={r.isFinal ? 'Rapor Akhir' : 'Rapor Guru'} onBack={onBack} />
      <div className="rapor stack">
        <div>
          <h2>{r.isFinal ? 'Rapor Akhir' : 'Rapor Guru'} — Pulau Angka</h2>
          <p className="center small">Laporan Perkembangan Hafalan Perkalian 1–10</p>
        </div>
        <table className="idt">
          <tbody>
            <tr>
              <td>Nama</td>
              <td>
                : <b>{r.name}</b>
              </td>
              <td>Kelas</td>
              <td>
                : <b>{r.grade}</b>
              </td>
            </tr>
            <tr>
              <td>Tanggal</td>
              <td>: {formatTanggal(r.date)}</td>
              <td>Program</td>
              <td>
                : Hari ke-{r.day} dari {r.totalDays}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="small">
          <b>Capaian pembelajaran:</b> {r.capaian}
        </p>
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          <div className="tile">
            <b>{r.fluent}/55</b>
            <span>lancar</span>
          </div>
          <div className="tile">
            <b>{r.mastered}/55</b>
            <span>hafal</span>
          </div>
          <div className="tile">
            <b>{r.core}/15</b>
            <span>fakta inti</span>
          </div>
          <div className="tile">
            <b>{r.avgMs !== null ? (r.avgMs / 1000).toFixed(1) : '–'}</b>
            <span>detik/soal</span>
          </div>
        </div>
        <Compare p={p} />
        <Legend />
        {r.baselineFluent !== null && (
          <p className="small">
            Saat tes awal, {r.baselineFluent} fakta dijawab lancar. Sekarang {r.fluent} fakta lancar.
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>Materi</th>
              <th>Nilai</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {r.materi.map((m) => (
              <tr key={m.title}>
                <td>
                  {m.title}
                  <br />
                  <span className="muted">
                    {m.fluent}/{m.total} lancar
                  </span>
                </td>
                <td>
                  <b>{m.level}</b>
                </td>
                <td>{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <b>Fakta yang masih perlu latihan:</b>
          <p>{r.needPractice.length ? r.needPractice.map(factLabel).join(', ') : 'Tidak ada. Semua fakta yang sudah dites dijawab dengan lancar.'}</p>
        </div>
        <p className="small muted">"Lancar" = dijawab benar dalam 3 detik. "Hafal" = lancar pada 3 hari berbeda. Laporan dibuat otomatis dari data latihan anak di aplikasi Pulau Angka.</p>
      </div>
      <div className="stack noprint">
        {msg && <div className="banner">{msg}</div>}
        <button className="btn sea" onClick={share}>
          Bagikan (WhatsApp)
        </button>
        <button className="btn white" onClick={download}>
          Unduh sebagai gambar
        </button>
        <button className="btn white" onClick={() => window.print()}>
          Cetak / simpan PDF
        </button>
      </div>
    </div>
  );
}

export function Certificate({ p, onBack, onReport }: { p: Profile; onBack: () => void; onReport: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  useEffect(() => {
    let u = '';
    void renderCertificatePng(p).then((b) => {
      blob.current = b;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [p]);
  const name = `sertifikat-pulau-angka-${p.name.toLowerCase().replace(/\s+/g, '-')}.png`;
  return (
    <div className="stack">
      <Header title="Sertifikat" onBack={onBack} />
      {url ? <img className="cert-img" src={url} alt={`Sertifikat Penakluk Pulau Angka untuk ${p.name}`} /> : <p>Menyiapkan sertifikat…</p>}
      <button className="btn" disabled={!url} onClick={() => blob.current && downloadBlob(blob.current, name)}>
        Simpan sebagai gambar
      </button>
      <button className="btn sea" disabled={!url} onClick={async () => blob.current && !(await shareImage(blob.current, name, `${p.name} menyelesaikan 30 hari Pulau Angka!`)) && downloadBlob(blob.current, name)}>
        Bagikan
      </button>
      <button className="btn white" onClick={onReport}>
        Lihat Rapor Akhir
      </button>
    </div>
  );
}

export function ParentArea({ onBack, onReport, onPrivacy }: { onBack: () => void; onReport: (id: string) => void; onPrivacy: () => void }) {
  const { account, update } = useStore();
  const [sel, setSel] = useState(account.profiles[0]?.id ?? '');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, setPending] = useState<Account | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = account.profiles.find((x) => x.id === sel) ?? account.profiles[0];
  const today = todayStr();

  const doExport = () => {
    const blob = new Blob([exportBackup(account, new Date().toISOString())], { type: 'application/json' });
    downloadBlob(blob, `cadangan-pulau-angka-${today}.json`);
    update((a) => ({ ...a, lastBackupAt: today }));
    setMsg({ t: 'File cadangan diunduh. Simpan di tempat aman (mis. Google Drive atau kirim ke WhatsApp sendiri).' });
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
      setMsg(null);
    } catch (e) {
      setMsg({ t: (e as Error).message, bad: true });
    }
    if (fileRef.current) fileRef.current.value = '';
  };
  const doImport = () => {
    if (!pending) return;
    update((a) => ({ ...pending, access: a.access ?? pending.access, lastBackupAt: today }));
    setSel(pending.profiles[0]?.id ?? '');
    setPending(null);
    setMsg({ t: 'Data berhasil dipulihkan dari file cadangan.' });
  };

  return (
    <div className="stack">
      <Header title="Area Orang Tua" onBack={onBack} />
      {account.profiles.length > 1 && (
        <div className="row wrap">
          {account.profiles.map((x) => (
            <button key={x.id} className={'chip' + (x.id === p?.id ? ' on' : '')} style={{ padding: '0 14px', fontSize: '1rem' }} onClick={() => setSel(x.id)}>
              {x.name}
            </button>
          ))}
        </div>
      )}
      {p ? (
        <div className="card stack">
          <h3>
            {p.name} · kelas {p.grade}
          </h3>
          <p className="small">
            Hari ke-{Math.min(p.progress.day - 1, 30)} dari 30 selesai · {counts(p).fluent}/55 lancar · {counts(p).mastered}/55 hafal · fakta inti {counts(p).core}/15
          </p>
          <Compare p={p} />
          <Legend />
          {p.history.length > 0 && (
            <details>
              <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>
                Riwayat sesi ({p.history.length})
              </summary>
              <ul className="clean small">
                {p.history
                  .slice(-10)
                  .reverse()
                  .map((h, i) => (
                    <li key={i}>
                      {formatTanggal(h.date)} — {h.label}: {h.correct}/{h.total} benar
                    </li>
                  ))}
              </ul>
            </details>
          )}
          <button className="btn sea" onClick={() => onReport(p.id)}>
            Buka Rapor Guru
          </button>
        </div>
      ) : (
        <div className="card">Belum ada profil anak.</div>
      )}

      <div className="card stack">
        <h3>Cadangan data</h3>
        <p className="small">
          Semua data tersimpan hanya di browser ini. Data hilang jika data browser dibersihkan atau ganti HP, jadi cadangkan secara berkala. Cadangan terakhir: <b>{account.lastBackupAt ? formatTanggal(account.lastBackupAt) : 'belum pernah'}</b>.
        </p>
        {msg && <div className={'banner ' + (msg.bad ? 'bad' : 'good')}>{msg.t}</div>}
        <button className="btn" onClick={doExport}>
          Unduh file cadangan
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button className="btn white" onClick={() => fileRef.current?.click()}>
          Pulihkan dari file cadangan
        </button>
        {pending && (
          <div className="banner stack">
            <span>
              File berisi {pending.profiles.length} profil ({pending.profiles.map((x) => x.name).join(', ') || 'kosong'}). Memulihkan akan <b>mengganti semua data</b> di perangkat ini.
            </span>
            <button className="btn sm" style={{ width: '100%' }} onClick={doImport}>
              Ya, ganti dengan data cadangan
            </button>
            <button className="btn white sm" style={{ width: '100%' }} onClick={() => setPending(null)}>
              Batal
            </button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Pengaturan</h3>
        <div className="row between">
          <span>Suara & narasi jurus</span>
          <button className={'btn sm ' + (account.settings.sound ? 'sea' : 'white')} role="switch" aria-checked={account.settings.sound} onClick={() => update((a) => ({ ...a, settings: { ...a.settings, sound: !a.settings.sound } }))}>
            {account.settings.sound ? 'Menyala' : 'Mati'}
          </button>
        </div>
      </div>
      <button className="link" onClick={onPrivacy}>
        Privasi & data anak
      </button>
    </div>
  );
}

export function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <div className="stack">
      <Header title="Privasi & data anak" onBack={onBack} />
      <div className="card prose">
        <p>
          <b>Ringkasnya: data anak Anda tidak pernah meninggalkan perangkat ini.</b>
        </p>
        <h3>Data yang disimpan</h3>
        <p>Hanya nama panggilan, kelas, dan data latihan (jawaban benar/salah serta waktu menjawab). Tidak ada foto, lokasi, nomor telepon, email, atau kontak anak.</p>
        <h3>Di mana data disimpan</h3>
        <p>Seluruh data disimpan di browser perangkat ini. Aplikasi tidak memiliki server atau database, tidak ada akun, dan tidak ada login. Karena itu, data hilang jika data browser dihapus; gunakan fitur cadangan di Area Orang Tua.</p>
        <h3>Tanpa iklan dan tanpa profiling</h3>
        <p>Tidak ada iklan pihak ketiga, tidak ada pelacakan untuk iklan, dan tidak ada pembelian di dalam alur bermain anak. Statistik kunjungan halaman bersifat anonim dan tanpa cookie; data latihan anak tidak ikut dikirim.</p>
        <h3>Peran orang tua</h3>
        <p>Pembelian, pengaturan, penghapusan profil, serta ekspor/impor data dilindungi gerbang orang tua. Dengan membuat profil anak, orang tua/wali menyetujui penyimpanan data latihan di perangkat ini. Orang tua dapat menghapus profil dan seluruh datanya kapan saja.</p>
        <h3>Kepatuhan</h3>
        <p>Aplikasi dirancang mengikuti prinsip pelindungan anak dalam PP No. 17 Tahun 2025 (PP Tunas): persetujuan orang tua, data anak seminimal mungkin, dan tanpa pemrofilan untuk iklan.</p>
      </div>
    </div>
  );
}
