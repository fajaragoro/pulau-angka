import type { Profile } from '../core/types';
import { factLabel, fid } from '../core/facts';
import { type CellColor, counts, gradeColor, mapColor } from '../core/progress';
import type { Report } from '../core/report';
import { formatTanggal } from '../core/util';

const C = { sand: '#FFF3DC', ink: '#1D2A44', sea: '#0F8F8A', coral: '#FF6B4A', sun: '#FFC93C', green: '#2FA463', yellow: '#FFC93C', red: '#E0464B', blue: '#3D8BFF', gray: '#D9D2C2' };
const DISPLAY = '"Lilita One", sans-serif';
const BODY = 'Lexend, sans-serif';

async function fonts(): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`40px ${DISPLAY}`), document.fonts.load(`400 20px ${BODY}`), document.fonts.load(`600 20px ${BODY}`)]);
  } catch {
    /* pakai font cadangan */
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = t;
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lh;
  }
  return y;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
}

function drawMap(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: (f: string) => CellColor): void {
  rr(ctx, x, y, size, size, 16, C.ink, false);
  const pad = 10;
  const gap = 4;
  const cell = (size - pad * 2 - gap * 9) / 10;
  for (let a = 1; a <= 10; a++)
    for (let b = 1; b <= 10; b++) {
      ctx.fillStyle = C[color(fid(a, b))];
      ctx.beginPath();
      ctx.roundRect(x + pad + (b - 1) * (cell + gap), y + pad + (a - 1) * (cell + gap), cell, cell, 5);
      ctx.fill();
    }
}

const toBlob = (c: HTMLCanvasElement): Promise<Blob> => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar'))), 'image/png'));

/** Gambar Rapor Guru sebagai PNG. */
export async function renderReportPng(p: Profile, r: Report): Promise<Blob> {
  await fonts();
  const W = 1080;
  const M = 60;
  const big = document.createElement('canvas');
  big.width = W;
  big.height = 3200;
  const ctx = big.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, big.height);

  ctx.fillStyle = C.sea;
  ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `54px ${DISPLAY}`;
  ctx.fillText(r.isFinal ? 'RAPOR AKHIR — PULAU ANGKA' : 'RAPOR GURU — PULAU ANGKA', M, 90);
  ctx.font = `400 26px ${BODY}`;
  ctx.fillText('Laporan Perkembangan Hafalan Perkalian 1–10', M, 136);
  ctx.fillText(r.capaian, M, 170);

  let y = 250;
  ctx.fillStyle = C.ink;
  const idRows: [string, string][] = [
    ['Nama', r.name],
    ['Kelas', String(r.grade)],
    ['Tanggal', formatTanggal(r.date)],
    ['Program', `Hari ke-${r.day} dari ${r.totalDays}${r.isFinal ? ' (selesai)' : ''}`],
  ];
  for (const [k, v] of idRows) {
    ctx.font = `400 28px ${BODY}`;
    ctx.fillText(k, M, y);
    ctx.font = `600 28px ${BODY}`;
    ctx.fillText(': ' + v, M + 170, y);
    y += 42;
  }

  y += 14;
  const tiles: [string, string][] = [
    [`${r.fluent}/55`, 'fakta lancar'],
    [`${r.mastered}/55`, 'fakta hafal'],
    [`${r.core}/15`, 'fakta inti lancar'],
    [r.avgMs !== null ? `${(r.avgMs / 1000).toFixed(1)} dtk` : '–', 'rata-rata menjawab'],
  ];
  const tw = (W - M * 2 - 3 * 20) / 4;
  tiles.forEach(([v, l], i) => {
    const x = M + i * (tw + 20);
    rr(ctx, x, y, tw, 130, 18, C.sand);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.font = `50px ${DISPLAY}`;
    ctx.fillText(v, x + tw / 2, y + 68);
    ctx.font = `400 21px ${BODY}`;
    ctx.fillText(l, x + tw / 2, y + 106);
    ctx.textAlign = 'left';
  });
  y += 180;

  const ms = (W - M * 2 - 40) / 2;
  ctx.fillStyle = C.ink;
  ctx.font = `34px ${DISPLAY}`;
  ctx.fillText('Hari 0 (tes awal)', M, y);
  ctx.fillText('Sekarang', M + ms + 40, y);
  y += 18;
  drawMap(ctx, M, y, ms, (f) => gradeColor(p.progress.baseline[f]));
  drawMap(ctx, M + ms + 40, y, ms, (f) => mapColor(p, f));
  y += ms + 40;
  const legend: [string, string][] = [
    [C.green, 'Lancar'],
    [C.yellow, 'Lambat'],
    [C.red, 'Salah'],
    [C.blue, 'Beres lewat jurus'],
    [C.gray, 'Belum dites'],
  ];
  let lx = M;
  ctx.font = `400 22px ${BODY}`;
  for (const [c, t] of legend) {
    ctx.fillStyle = c;
    ctx.fillRect(lx, y - 20, 24, 24);
    ctx.fillStyle = C.ink;
    ctx.fillText(t, lx + 32, y);
    lx += 32 + ctx.measureText(t).width + 30;
  }
  y += 70;

  ctx.font = `34px ${DISPLAY}`;
  ctx.fillText('Catatan per materi', M, y);
  y += 44;
  for (const m of r.materi) {
    ctx.font = `600 25px ${BODY}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(`${m.title} — ${m.level} (${m.fluent}/${m.total} lancar)`, M, y);
    y += 34;
    ctx.font = `400 23px ${BODY}`;
    y = wrap(ctx, m.note, M, y, W - M * 2, 32) + 18;
  }

  y += 10;
  ctx.font = `34px ${DISPLAY}`;
  ctx.fillText('Fakta yang masih perlu latihan', M, y);
  y += 42;
  ctx.font = `400 25px ${BODY}`;
  y = wrap(ctx, r.needPractice.length ? r.needPractice.map(factLabel).join(',  ') : 'Tidak ada. Semua fakta yang sudah dites dijawab dengan lancar.', M, y, W - M * 2, 36);

  y += 30;
  ctx.fillStyle = 'rgba(29,42,68,.7)';
  ctx.font = `400 20px ${BODY}`;
  y = wrap(ctx, '"Lancar" = dijawab benar dalam 3 detik. "Hafal" = lancar pada 3 hari berbeda. Laporan dibuat otomatis dari data latihan anak di aplikasi Pulau Angka.', M, y, W - M * 2, 28);
  y += 30;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = y;
  out.getContext('2d')!.drawImage(big, 0, 0);
  return toBlob(out);
}

/** Gambar sertifikat hari ke-30 sebagai PNG. */
export async function renderCertificatePng(p: Profile): Promise<Blob> {
  await fonts();
  const W = 1400;
  const H = 990;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, 0, W, H);
  rr(ctx, 40, 40, W - 80, H - 80, 36, '#fff');
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  ctx.roundRect(40, 40, W - 80, H - 80, 36);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.sea;
  ctx.beginPath();
  ctx.roundRect(66, 66, W - 132, H - 132, 24);
  ctx.stroke();

  // Hiasan geometris tanpa wajah
  const deco: [number, number, string][] = [
    [150, 160, C.coral],
    [W - 150, 160, C.sea],
    [150, H - 160, C.sun],
    [W - 150, H - 160, C.coral],
  ];
  deco.forEach(([x, y, c], i) => {
    ctx.fillStyle = c;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (i % 2 === 0) ctx.arc(x, y, 44, 0, Math.PI * 2);
    else ctx.roundRect(x - 42, y - 42, 84, 84, 16);
    ctx.fill();
    ctx.stroke();
  });

  const c = counts(p);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.sea;
  ctx.font = `76px ${DISPLAY}`;
  ctx.fillText('SERTIFIKAT', W / 2, 210);
  ctx.fillStyle = C.ink;
  ctx.font = `400 32px ${BODY}`;
  ctx.fillText('Penakluk Pulau Angka — diberikan kepada', W / 2, 280);
  ctx.fillStyle = C.coral;
  ctx.font = `120px ${DISPLAY}`;
  ctx.fillText(p.name, W / 2, 420);
  ctx.fillStyle = C.ink;
  ctx.font = `400 32px ${BODY}`;
  ctx.fillText(`Kelas ${p.grade}`, W / 2, 476);
  ctx.fillText('telah menyelesaikan program 30 hari hafal perkalian 1–10', W / 2, 546);

  const tiles: [string, string][] = [
    [`${c.fluent}/55`, 'fakta lancar'],
    [`${c.core}/15`, 'fakta inti lancar'],
    [`${p.progress.bestStreak} hari`, 'streak terbaik'],
  ];
  tiles.forEach(([v, l], i) => {
    const x = W / 2 - 480 + i * 330;
    rr(ctx, x, 600, 300, 150, 22, i === 1 ? C.sun : C.sand);
    ctx.fillStyle = C.ink;
    ctx.font = `60px ${DISPLAY}`;
    ctx.fillText(v, x + 150, 676);
    ctx.font = `400 24px ${BODY}`;
    ctx.fillText(l, x + 150, 720);
  });
  ctx.font = `400 28px ${BODY}`;
  ctx.fillText(formatTanggal(p.progress.completedAt ?? p.progress.lastSessionDate ?? p.createdAt), W / 2, 830);
  ctx.font = `34px ${DISPLAY}`;
  ctx.fillStyle = C.sea;
  ctx.fillText('Pulau Angka', W / 2, 880);
  return toBlob(cv);
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Bagikan gambar lewat Web Share API; false jika tidak didukung. */
export async function shareImage(blob: Blob, name: string, text: string): Promise<boolean> {
  try {
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, title: 'Pulau Angka' });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return true;
  }
  return false;
}
