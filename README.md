# Family Finance v3 — Budget Budggt + Sinkron Gmail

Aplikasi keuangan keluarga suami–istri, menggunakan React + Vite, Supabase (Auth + PostgreSQL + Realtime) dan Netlify. Model **B: rekening bersama + rekening pribadi**.

## Yang baru pada v2

- Desain baru yang mobile-first: sidebar desktop, **navigasi bawah** yang nyaman untuk iPhone, tombol besar **+** untuk transaksi cepat.
- Dashboard beranda: saldo rekening yang bisa diakses, pemasukan, pengeluaran, arus kas bersih, grafik 6 bulan, donut kategori, dan transaksi terbaru.
- Filter **Semua / Bersama / Pribadi**, periode bulanan, pencarian transaksi serta filter masuk/keluar.
- Form pencatatan cepat berupa **bottom sheet** pada HP dengan validasi nominal, kategori, rekening, tanggal dan catatan.
- Rekening bersama dan pribadi dilabeli jelas, juga tersedia opsi menyembunyikan nominal di layar (sementara selama sesi aktif).
- Tanda status jaringan / koneksi realtime, empty state yang memberikan langkah berikutnya, konfirmasi penghapusan, feedback sukses/gagal.
- **PWA:** ikon aplikasi, manifest, Apple touch icon, layanan cache khusus berkas statis. Bisa ditambahkan ke Home Screen iPhone lewat Safari sesudah dipublikasikan melalui HTTPS.
- **Mode demo:** kunjungi `/?demo=1` untuk mencoba antarmuka dengan data contoh tanpa Supabase. Penambahan/edit/hapus di demo bersifat sementara dan *tidak* menyentuh cloud.

> PENTING: v2 **tidak mengubah struktur database v1**. Jika sebelumnya sudah menjalankan `supabase/migrations/202611190001_init.sql` dengan sukses, **jangan jalankan SQL lagi**. Untuk instalasi baru, jalankan migration tersebut satu kali pada project Supabase baru.

## Yang baru pada v3

- **Kategori Budggt**: Kebutuhan / Keinginan / Tabungan + Sub Kategori (Makan, Transport, Home, JAJAN, GIFT, Reksadana, …). Kategori lama otomatis dipetakan.
- **Transfer** antarrekening (termasuk bayar kartu kredit) — tidak dihitung sebagai pengeluaran.
- Beranda memisahkan **Pengeluaran** (Kebutuhan + Keinginan) dan **Ditabung** (Tabungan). Jual aset & transfer dari pasangan tidak dihitung sebagai pemasukan.
- Halaman **Budget**: budget bulanan per kategori, progres bulan ini, dan kumulatif Januari–bulan berjalan.
- **Bagikan total ke budget** (menu Keluarga): pasangan hanya melihat total per kategori, bukan detail transaksi pribadi.
- **Sinkron Gmail** (`gmail/GmailSync.gs`): notifikasi Jago, Mandiri, BCA, Bibit, GORO, Stockbit, Gotrade dibaca otomatis tiap 15 menit. Yang yakin → langsung tercatat; yang ragu, refund, dan transfer → tab **Perlu review**.

### Urutan setup v3

1. Supabase → SQL Editor → jalankan `supabase/migrations/202611190001_init.sql` (sudah diperbaiki) **lalu** `202611200001_v3_budget_gmail.sql`.
2. Buka aplikasi, daftar, buat ruang keluarga, buat rekening dengan nama persis seperti di Budggt: `MANDIRI`, `JAGO BAYAR`, `JAGO NABUNG`, `BCA`, `RDN BCA`, `SKYZ` (dan rekening suami).
3. SQL Editor → jalankan `supabase/seed_budget_2027.sql` untuk mengisi Budget 2027.
4. Menu **Keluarga** → aktifkan "Bagikan total pribadi saya ke budget" (keduanya).
5. Menu **Keluarga** → **Buat token**, salin token + URL + key.
6. https://script.google.com → New project → tempel isi `gmail/GmailSync.gs` → Project Settings → Script Properties: `SUPABASE_URL`, `SUPABASE_KEY`, `INGEST_TOKEN` → jalankan `testParse` → cek log → jalankan `installTrigger`.
7. Suami mengulang langkah 5–6 dari akun & Gmail miliknya.

## Struktur proyek

```text
family-finance-mvp/
├── src/
│   ├── App.jsx               # Auth, onboarding, dashboard, budget, review Gmail, demo
│   ├── categories.js         # Taxonomy Budggt
│   ├── style.css             # Style responsif desktop + iPhone
│   ├── main.jsx              # Bootstrap React & registrasi service worker
│   └── supabase.js           # Supabase public client
├── public/
│   ├── manifest.webmanifest  # Konfigurasi instalasi PWA
│   ├── sw.js                 # Cache berkas statis saja
│   └── icons/                # Ikon iOS + PWA
├── supabase/migrations/
│   ├── 202611190001_init.sql
│   └── 202611200001_v3_budget_gmail.sql
├── supabase/seed_budget_2027.sql
├── gmail/GmailSync.gs        # Google Apps Script sinkron Gmail
├── index.html
├── netlify.toml
├── .env.example
├── package.json
└── README.md
```

## 1. Setup database Supabase

1. Masuk ke https://supabase.com/dashboard dan buat project Supabase baru (kalau belum ada).
2. Buka **SQL Editor**, jalankan seluruh isi `supabase/migrations/202611190001_init.sql` **sekali** hanya pada project baru. SQL membuat tabel, RPC, RLS, dan publication realtime.
3. Di **Authentication → Providers → Email**, aktifkan login Email. Direkomendasikan tetap mengaktifkan **Confirm email**.
4. Di **Authentication → URL Configuration**, set **Site URL** sesuai domain Netlify, lalu tambahkan redirect URL domain aplikasi dan `http://localhost:5173` untuk pengembangan lokal jika diperlukan.
5. Ambil **Project URL** dan **Publishable key** `sb_publishable_...` melalui dashboard project. Jangan memasang service_role/secret key di frontend.

Jika project Supabase lama sudah digunakan pada v1, gunakan project yang sama sehingga data tetap tersedia.

## 2. Jalankan di komputer

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://PROJECT-ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Kemudian:

```bash
npm run dev
```

Buka `http://localhost:5173`. Untuk melihat desain tanpa login / Supabase, buka `http://localhost:5173/?demo=1`.

`npm run build` menghasilkan folder `dist` untuk deployment.

## 3. Deploy ke Netlify

1. Masukkan folder aplikasi ke repository GitHub. **Jangan masukkan `.env` ke Git.**
2. Netlify → **Add new project → Import existing project**, pilih repository.
3. Build command: `npm run build`; Publish directory: `dist`. File `netlify.toml` sudah mengatur keduanya dan redirect SPA.
4. Di **Site configuration → Environment variables**, buat dua variabel: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Deploy lalu kunjungi `https://alamat-anda.netlify.app`.
6. Perbarui **Site URL / Redirect URLs** pada Supabase Auth agar sesuai domain produksi.
7. Tes akses lewat **Safari di iPhone** dan browser suami/istri masing-masing. Pastikan transaksi bersama muncul di perangkat pasangan saat online.

## 4. Instal sebagai aplikasi iPhone

1. Buka URL Netlify melalui **Safari** di iPhone.
2. Tekan **Share** → **Add to Home Screen**.
3. Aktifkan **Open as Web App** bila pilihan tersebut tampil, kemudian tekan **Add**.
4. Jalankan melalui ikon **Family Finance** di layar utama.

PWA memungkinkan tampilan layaknya aplikasi mandiri, tetapi **bukan aplikasi native iOS di App Store**. Perangkat tetap memerlukan koneksi internet untuk login, mengubah transaksi, dan sinkronisasi. Cache service worker hanya menyimpan shell/aset statis, **tidak menyimpan data transaksi Supabase** dan tidak menyediakan sinkronisasi offline.

## 5. Alur penggunaan dua akun

1. Pengguna pertama daftar/login dengan alamat email sendiri.
2. Buat keluarga, misalnya `Keluarga Kita`.
3. Di menu Keluarga, salin kode undangan rahasia.
4. Pengguna kedua daftar/login dengan email yang berbeda, lalu pilih **Gabung keluarga** dan masukkan kode.
5. Buat rekening **Bersama** (dua pengguna bisa melihat) dan **Pribadi** (hanya pemilik yang melihat).
6. Catat pemasukan/pengeluaran dengan memilih sumber rekening, tanggal, kategori, dan nominal.

**Catatan privasi:** Saldo pada dashboard Semua = total saldo **rekening yang boleh dilihat oleh akun yang login**, bukan agregasi rekening pribadi kedua pasangan. Menggabungkan rekening pribadi pasangan ke dalam total bersama tanpa persetujuan akan melanggar model privasi B.

## 6. Checklist keamanan dan pengujian sebelum data nyata

- [ ] Dua akun terpisah berhasil login, gabung keluarga, membuat rekening bersama.
- [ ] Pengguna kedua bisa membaca transaksi bersama, tetapi tidak bisa mengedit/menghapus transaksi yang dicatat akun pertama.
- [ ] Pengguna kedua **tidak bisa** melihat rekening pribadi atau transaksi pribadi akun pertama (uji query secara langsung; jangan hanya mengandalkan UI).
- [ ] Akun ketiga yang tidak tergabung tidak dapat membaca data keluarga.
- [ ] Uji perubahan visibilitas rekening, percobaan menghapus rekening yang memiliki histori, dan validasi batas anggota keluarga.
- [ ] Uji koneksi realtime dua perangkat sekaligus serta mode offline/online.
- [ ] Tetapkan prosedur **backup/export database**, pemulihan akun, dan kebijakan password sebelum data finansial menjadi catatan utama.

## 7. Batasan versi ini

- Belum tersedia financial goals, harga pasar investasi, backup/export otomatis, bukti struk, MFA, dan pengingat transaksi.
- Histori hanya mengambil 3.000 transaksi terbaru; butuh pagination untuk jangka panjang.
- Supabase Free dapat mem-pause project tidak aktif. PWA tidak menghilangkan batasan layanan cloud.
- Service worker membutuhkan HTTPS (Netlify menyediakan) atau localhost untuk pengembangan.
- **Source code telah lulus pemeriksaan sintaks JSX/TSX dan integritas arsip, tetapi instalasi dependensi serta build final dan pengujian end-to-end pada Supabase live belum dapat dijalankan di lingkungan pembuatan ini.** Wajib jalankan `npm install` dan `npm run build` di komputer/CI lalu uji fitur sebelum dipakai untuk catatan keuangan utama.

## 8. Troubleshooting

- **Konfigurasi belum tersedia:** isi `.env` atau environment variables Netlify, kemudian build/deploy ulang. Mode demo tetap tersedia tanpa konfigurasi.
- **Belum bisa login:** periksa email konfirmasi dan Auth URL Configuration di Supabase.
- **Transaksi pasangan tidak muncul:** pastikan rekening berjenis Bersama dan realtime publication `accounts`/`transactions` telah aktif, lalu gunakan tombol refresh.
- **Rekening pribadi tidak terlihat pada akun pasangan:** perilaku ini disengaja sesuai model privasi B.
- **Tidak bisa hapus rekening:** rekening dengan histori dilindungi SQL trigger.
- **PWA tidak muncul:** buka HTTPS menggunakan Safari lalu Add to Home Screen; cek `manifest.webmanifest`, icon, service worker.
- **Perubahan UI tidak terlihat setelah update:** refresh halaman; bila perlu hapus shortcut PWA dan pasang lagi.
