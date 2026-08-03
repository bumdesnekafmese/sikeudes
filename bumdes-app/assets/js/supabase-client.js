// ============================================================
// KONFIGURASI SUPABASE
// Ganti dua nilai di bawah ini dengan milik project Supabase Anda
// Ambil dari: Supabase Dashboard > Project Settings > API
// ============================================================
const SUPABASE_URL = "https://hgvgkzynpiaarizeyrjx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndmdrenlucGlhYXJpemV5cmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDMzMzQsImV4cCI6MjEwMTI3OTMzNH0.SPh3DLhbT449c1OCshO2czgkhuaCnBEuYDRfPHbivjI";

// Inisialisasi client (memakai supabase-js versi 2 dari CDN)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
