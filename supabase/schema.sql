-- ============================================================
-- SIKEUDES BUMDES - SUPABASE SCHEMA
-- Sistem Keuangan Digital BUMDes
-- Jalankan seluruh file ini di Supabase SQL Editor
-- ============================================================

-- 1. PROFIL PENGGUNA (terhubung ke auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz default now()
);

-- 2. PENGATURAN APLIKASI (logo, nama organisasi, dll)
create table if not exists public.settings (
  id int primary key default 1,
  nama_bumdes text default 'BUMDes Nekafmese',
  alamat text default 'Desa Oeltua, Kab. Kupang',
  logo_url text,
  tahun_buku int default extract(year from now()),
  constraint single_row check (id = 1)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 3. UNIT USAHA
create table if not exists public.unit_usaha (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  deskripsi text,
  created_at timestamptz default now()
);

-- 4. KAS & BANK (saldo pokok/akun)
create table if not exists public.kas_bank (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('kas','bank')),
  nama_akun text not null,
  saldo numeric not null default 0,
  updated_at timestamptz default now()
);

-- 5. TRANSAKSI
create table if not exists public.transaksi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null default current_date,
  keterangan text not null,
  jenis text not null check (jenis in ('masuk','keluar')),
  nominal numeric not null check (nominal >= 0),
  kategori text,
  unit_usaha_id uuid references public.unit_usaha(id),
  akun_id uuid references public.kas_bank(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 6. ASET BUMDES
create table if not exists public.aset (
  id uuid primary key default gen_random_uuid(),
  nama_aset text not null,
  kategori text,
  nilai_perolehan numeric default 0,
  kondisi text default 'Baik' check (kondisi in ('Baik','Rusak Ringan','Rusak Berat')),
  tanggal_perolehan date default current_date,
  created_at timestamptz default now()
);

-- 7. DOKUMEN
create table if not exists public.dokumen (
  id uuid primary key default gen_random_uuid(),
  nama_file text not null,
  kategori text,
  file_url text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TRIGGER: buat profil otomatis saat user baru mendaftar
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nama, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role','user')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.unit_usaha enable row level security;
alter table public.kas_bank enable row level security;
alter table public.transaksi enable row level security;
alter table public.aset enable row level security;
alter table public.dokumen enable row level security;

-- Semua user login boleh membaca data keuangan
create policy "read profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "read settings" on public.settings for select using (true);
create policy "read unit_usaha" on public.unit_usaha for select using (auth.role() = 'authenticated');
create policy "read kas_bank" on public.kas_bank for select using (auth.role() = 'authenticated');
create policy "read transaksi" on public.transaksi for select using (auth.role() = 'authenticated');
create policy "read aset" on public.aset for select using (auth.role() = 'authenticated');
create policy "read dokumen" on public.dokumen for select using (auth.role() = 'authenticated');

-- Insert/Update/Delete data operasional: semua user login (sesuaikan jika ingin lebih ketat)
create policy "write unit_usaha" on public.unit_usaha for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write kas_bank" on public.kas_bank for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write transaksi" on public.transaksi for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write aset" on public.aset for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write dokumen" on public.dokumen for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Hanya admin yang boleh mengubah pengaturan (logo, nama bumdes)
create policy "admin update settings" on public.settings for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Hanya admin boleh mengubah role & melihat semua profile secara penuh (update)
create policy "admin update profiles" on public.profiles for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "user update own profile" on public.profiles for update using (id = auth.uid());

-- ============================================================
-- STORAGE: bucket untuk logo & dokumen (jalankan lewat SQL atau Dashboard > Storage)
-- ============================================================
insert into storage.buckets (id, name, public) values ('logos','logos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('dokumen','dokumen', true) on conflict (id) do nothing;

create policy "public read logos" on storage.objects for select using (bucket_id = 'logos');
create policy "authenticated upload logos" on storage.objects for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');
create policy "public read dokumen" on storage.objects for select using (bucket_id = 'dokumen');
create policy "authenticated upload dokumen" on storage.objects for insert with check (bucket_id = 'dokumen' and auth.role() = 'authenticated');

-- ============================================================
-- DATA CONTOH (opsional - hapus jika tidak diperlukan)
-- ============================================================
insert into public.kas_bank (jenis, nama_akun, saldo) values
  ('kas','Kas Tunai', 15250000),
  ('bank','Total Saldo Bank', 48750000)
on conflict do nothing;

insert into public.unit_usaha (nama, deskripsi) values
  ('Unit Usaha Perdagangan','Toko / warung desa'),
  ('Unit Usaha Jasa','Jasa layanan desa'),
  ('Unit Usaha Simpan Pinjam','Koperasi simpan pinjam'),
  ('Unit Usaha Lainnya','Usaha lain-lain')
on conflict do nothing;
