# Pulau Angka

Aplikasi web "Hafal Perkalian 1–10 dalam 30 Hari": maksimal 3 menit sehari, untuk anak SD kelas 3–6.
Aplikasi statis (tanpa backend), semua data anak tersimpan di browser (IndexedDB), bisa dipasang sebagai PWA dan jalan offline.

## Menjalankan

```bash
npm install
npm run dev      # pengembangan
npm test         # unit test logika inti
npm run build    # hasil di folder dist/
```

## Konfigurasi (`.env`)

| Variabel | Fungsi |
| --- | --- |
| `VITE_ACCESS_CODE` | Kode akses yang berlaku (default `3016`). |
| `VITE_KEEP_OLD_USERS` | `true`: pengguna lama tetap masuk setelah kode diganti. `false`: semua diminta kode baru. |
| `VITE_PAYMENT_URL` | Link halaman pembayaran (Mayar/Lynk/Scalev). |
| `VITE_CF_ANALYTICS_TOKEN` | Token Cloudflare Web Analytics; kosong = analytics mati. |

Nilai di `.env` ikut ter-build ke frontend, jadi bukan rahasia. Di Cloudflare Pages nilainya bisa ditimpa lewat
Settings → Environment variables, lalu deploy ulang.

## Deploy ke Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pilih repo ini.
2. Production branch: `main`. Build command: `npm run build`. Build output directory: `dist`.
3. Setiap push ke `main` otomatis ter-deploy.

## Struktur

- `src/core/` — logika murni + unit test: fakta (`facts`), penilaian & Leitner (`mastery`), kurikulum 30 hari
  (`curriculum`), jurus (`jurus`), penyusun sesi & incremental rehearsal & ronde bonus (`session`),
  progres/ujian/streak/peta (`progress`), Rapor Guru (`report`), cadangan & kode akses (`backup`).
- `src/storage/` — IndexedDB.
- `src/ui/` — layar React: demo, kode akses, profil, sesi, bonus, rapor, sertifikat, area orang tua, privasi.
- `src/config.ts` — satu tempat untuk kode akses, link pembayaran, harga.

## Aturan utama yang diterapkan

- Lancar = benar dan tombol angka pertama ditekan ≤ 3 detik. Hafal = lancar di 3 hari berbeda.
- Review Leitner 1, 2, 4, 7 hari; jawaban salah muncul lagi 3 soal kemudian.
- Sesi harian hard cap 180 detik, satu sesi per profil per hari kalender. Soal bertipe tes (tes awal,
  ujian pulau, tes akhir) otomatis dilewati setelah 6 detik.
- Ujian pulau lulus di 80%. Gagal → ulangan khusus → ujian ulang → (gagal lagi) ulangan → lanjut; jadwal mundur.
- Bolos tidak melewatkan materi, hanya memutus streak.
- Ronde Bonus: 60 detik, maksimal 3 per hari, setelah sesi harian selesai.
