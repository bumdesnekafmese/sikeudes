// ============================================================
// LOGIKA HALAMAN LOGIN
// ============================================================

async function loadLoginLogoAndName() {
  try {
    const { data, error } = await supabaseClient
      .from("settings")
      .select("logo_url,nama_bumdes")
      .eq("id", 1)
      .single();
    if (error) throw error;
    if (data?.logo_url) {
      const loginLogoEl = document.getElementById("loginLogo");
      loginLogoEl.src = data.logo_url;
      loginLogoEl.style.display = "block"; // reset in case an earlier empty src hid it
    }
    if (data?.nama_bumdes) {
      document.getElementById("loginOrgName").textContent = data.nama_bumdes;
    }
  } catch (e) {
    // Jika tabel settings belum dikonfigurasi, gunakan default diam-diam
    console.warn("Tidak bisa memuat pengaturan/logo:", e.message);
  }
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = msg;
  el.style.display = "block";
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  const errBox = document.getElementById("loginError");
  errBox.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Memproses...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "Masuk";

  if (error) {
    showLoginError(error.message === "Invalid login credentials"
      ? "Email atau kata sandi salah."
      : error.message);
    return;
  }

  window.location.href = "app.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  // Jika sudah login, langsung arahkan ke dashboard
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = "app.html";
    return;
  }
  loadLoginLogoAndName();
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
});
