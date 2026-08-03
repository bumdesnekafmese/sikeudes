# SIKEUDES BUMDes — Sistem Keuangan Digital

Aplikasi web keuangan BUMDes dengan tampilan dashboard, transaksi, kas & bank,
laporan keuangan (unduh Excel/PDF), aset, unit usaha, dokumen, manajemen
pengguna (admin/pengurus), dan pengaturan logo di halaman login.

- **Frontend**: HTML + CSS + JavaScript murni (tanpa build tool) — bisa langsung dihosting di **GitHub Pages**.
- **Backend**: **Supabase** (Auth, Database Postgres, Storage).
- **Grafik**: Chart.js. **Ekspor laporan**: SheetJS (Excel) & jsPDF (PDF).

## Struktur Folder

```
bumdes-app/
├── index.html              # Halaman login
├── app.html                # Dashboard & seluruh menu (SPA)
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── supabase-client.js   # Konfigurasi URL & anon key Supabase
│       ├── auth.js              # Logika login
│       └── app.js               # Logika dashboard, CRUD, chart, export
├── supabase/
│   ├── schema.sql               # Struktur tabel, RLS, storage bucket
│   └── edge-function-create-user.md  # (opsional) cara admin tambah user lebih aman
└── README.md
```

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** → jalankan seluruh isi file `supabase/schema.sql`.
   Ini akan membuat semua tabel (`profiles`, `settings`, `transaksi`,
   `kas_bank`, `aset`, `unit_usaha`, `dokumen`), trigger otomatis pembuat
   profil, kebijakan **Row Level Security**, serta bucket storage `logos`
   dan `dokumen`.
3. Di **Authentication → Providers**, pastikan **Email** aktif.
   - Untuk kemudahan saat development, Anda bisa menonaktifkan
     "Confirm email" di **Authentication → Settings** agar akun baru
     langsung bisa login tanpa verifikasi email.
4. Buat akun admin pertama:
   - Masuk ke **Authentication → Users → Add user**, isi email & password.
   - Setelah user dibuat, buka tabel `profiles` di **Table Editor**, cari
     baris dengan email tersebut, lalu ubah kolom `role` menjadi `admin`.
5. Ambil kredensial API: **Project Settings → API**
   - `Project URL`
   - `anon public` key

## 2. Hubungkan Frontend ke Supabase

Edit file `assets/js/supabase-client.js`:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

## 3. Coba secara lokal

Karena hanya HTML/CSS/JS statis, cukup buka `index.html` dengan sebuah
local server (jangan `file://` langsung, agar module & fetch berjalan
normal), misalnya:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## 4. Deploy ke GitHub Pages

1. Buat repository baru di GitHub, lalu push seluruh folder ini:
   ```bash
   git init
   git add .
   git commit -m "Inisialisasi SIKEUDES BUMDes"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
2. Di GitHub: **Settings → Pages** → Source: pilih branch `main`, folder `/ (root)`.
3. Tunggu beberapa menit, aplikasi akan aktif di
   `https://USERNAME.github.io/NAMA-REPO/`.
4. Di Supabase, tambahkan URL GitHub Pages tersebut ke
   **Authentication → URL Configuration → Site URL / Redirect URLs**
   agar login berjalan lancar.

## 5. Mengganti Logo di Halaman Login

Login sebagai **admin** → menu **Pengaturan** → unggah logo baru & simpan.
Logo disimpan di Supabase Storage (bucket `logos`) dan otomatis muncul di
halaman login serta sidebar dashboard untuk semua pengguna.

## 6. Menambah Pengguna (Admin/User)

Menu **Pengguna** (khusus admin) → **Tambah Pengguna** → isi nama, email,
kata sandi sementara, dan peran (Admin/Pengurus).

> **Catatan keamanan**: cara di atas memakai `supabase.auth.signUp()` dari
> sisi client (anon key), yang paling sederhana untuk memulai. Untuk
> penggunaan produksi yang lebih aman (agar sesi admin tidak berpindah ke
> user baru), gunakan **Supabase Edge Function** dengan service role key —
> lihat panduan di `supabase/edge-function-create-user.md`.

## 7. Kustomisasi Tampilan

Seluruh warna, radius, dan jarak diatur lewat variabel CSS di bagian atas
`assets/css/style.css` (`:root { --navy: ...; --blue: ...; }`) sehingga
mudah disesuaikan dengan identitas BUMDes Anda.

## Ringkasan Fitur

- ✅ Login dengan Supabase Auth (email & password)
- ✅ Logo & nama BUMDes dapat diganti admin, tampil di login page
- ✅ Dashboard: saldo kas, saldo bank, total pendapatan/pengeluaran, laba bersih
- ✅ Grafik arus kas bulanan & distribusi pendapatan per unit usaha
- ✅ Transaksi: tambah & hapus pemasukan/pengeluaran
- ✅ Kas & Bank: kelola saldo per akun
- ✅ Laporan Keuangan: unduh Excel (.xlsx) dan PDF
- ✅ Aset, Unit Usaha, Dokumen (unggah file ke Storage)
- ✅ Manajemen Pengguna: admin menambah pengguna & mengatur peran
- ✅ Row Level Security aktif di seluruh tabel Supabase
