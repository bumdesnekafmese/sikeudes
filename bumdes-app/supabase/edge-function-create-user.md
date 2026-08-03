# (Opsional) Membuat Pengguna Baru Secara Aman via Edge Function

Cara di aplikasi (memakai `auth.signUp` dari browser) sudah berfungsi,
tetapi memakai *anon key* dari sisi client. Untuk produksi, cara yang
lebih aman adalah membuat pengguna lewat **Supabase Edge Function** yang
memakai *service role key* di server (bukan di browser), sehingga:

- Sesi login admin tidak ikut berpindah ke akun user baru.
- Admin bisa langsung set email sebagai "confirmed" tanpa perlu verifikasi.

## Langkah

1. Install Supabase CLI: `npm install -g supabase`
2. Login & hubungkan project:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```
3. Buat function baru:
   ```bash
   supabase functions new create-user
   ```
4. Isi `supabase/functions/create-user/index.ts`:

   ```ts
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

   Deno.serve(async (req) => {
     const { email, password, nama, role } = await req.json();

     const supabaseAdmin = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );

     // Pastikan yang memanggil adalah admin
     const authHeader = req.headers.get("Authorization")!;
     const jwt = authHeader.replace("Bearer ", "");
     const { data: caller } = await supabaseAdmin.auth.getUser(jwt);
     const { data: callerProfile } = await supabaseAdmin
       .from("profiles").select("role").eq("id", caller.user?.id).single();

     if (callerProfile?.role !== "admin") {
       return new Response(JSON.stringify({ error: "Hanya admin yang boleh menambah pengguna" }), { status: 403 });
     }

     const { data, error } = await supabaseAdmin.auth.admin.createUser({
       email, password, email_confirm: true,
       user_metadata: { nama, role },
     });

     if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
     return new Response(JSON.stringify({ user: data.user }), { status: 200 });
   });
   ```

5. Deploy:
   ```bash
   supabase functions deploy create-user
   ```
6. Di frontend, ganti pemanggilan `supabaseClient.auth.signUp(...)` pada
   `saveUser()` di `assets/js/app.js` dengan pemanggilan ke function ini:

   ```js
   const { data: { session } } = await supabaseClient.auth.getSession();
   const res = await fetch("https://YOUR_PROJECT_REF.functions.supabase.co/create-user", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": `Bearer ${session.access_token}`,
     },
     body: JSON.stringify({ email, password, nama, role }),
   });
   const result = await res.json();
   ```

Dengan begini, kunci `service_role` tetap tersimpan aman di server
Supabase dan tidak pernah dikirim ke browser.
