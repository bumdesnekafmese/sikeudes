// ============================================================
// APLIKASI UTAMA - SIKEUDES BUMDES
// ============================================================
let CURRENT_USER = null;   // auth user
let CURRENT_PROFILE = null; // row dari table profiles (nama, role)
let charsCache = {};
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = "index.html"; return; }
  CURRENT_USER = session.user;

  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", CURRENT_USER.id).single();
  CURRENT_PROFILE = profile || { nama: CURRENT_USER.email, role: "user" };

  document.getElementById("userName").textContent = CURRENT_PROFILE.nama;
  document.getElementById("userRole").textContent = CURRENT_PROFILE.role === "admin" ? "Admin" : "Pengurus";
  document.getElementById("userInitial").textContent = (CURRENT_PROFILE.nama || "U").charAt(0).toUpperCase();
  if (CURRENT_PROFILE.role !== "admin") {
    document.querySelectorAll(".admin-only").forEach(el => el.remove());
  }

  await loadSettingsIntoShell();
  bindNav();
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  goTo("dashboard");
}

async function loadSettingsIntoShell() {
  const { data } = await supabaseClient.from("settings").select("*").eq("id", 1).single();
  if (data) {
    if (data.logo_url) {
      const logoEl = document.getElementById("brandLogo");
      logoEl.src = data.logo_url;
      logoEl.style.opacity = "1"; // reset in case an earlier empty src hid it
    }
    document.getElementById("brandName").textContent = data.nama_bumdes || "BUMDes";
    document.getElementById("brandName2").textContent = data.nama_bumdes || "BUMDes";
    document.getElementById("villageAddr").textContent = data.alamat || "";
    document.getElementById("welcomeOrg").textContent = data.nama_bumdes || "BUMDes";
  }
}

function bindNav() {
  document.querySelectorAll(".nav .item").forEach(item => {
    item.addEventListener("click", () => goTo(item.dataset.section));
  });
}

function goTo(section) {
  document.querySelectorAll(".nav .item").forEach(i => i.classList.toggle("active", i.dataset.section === section));
  const titles = {
    dashboard: ["Dashboard", "Ringkasan keuangan BUMDes"],
    transaksi: ["Transaksi", "Catatan pemasukan & pengeluaran"],
    kasbank: ["Kas & Bank", "Saldo kas tunai dan rekening bank"],
    laporan: ["Laporan Keuangan", "Unduh laporan dalam format Excel / PDF"],
    aset: ["Aset", "Daftar aset milik BUMDes"],
    unitusaha: ["Unit Usaha", "Kelola unit usaha BUMDes"],
    dokumen: ["Dokumen", "Arsip dokumen BUMDes"],
    pengguna: ["Pengguna", "Kelola akun admin dan pengurus"],
    pengaturan: ["Pengaturan", "Logo, identitas, dan tahun buku"],
  };
  document.getElementById("pageTitle").textContent = titles[section][0];
  document.getElementById("pageSub").textContent = titles[section][1];
  const renderers = {
    dashboard: renderDashboard, transaksi: renderTransaksi, kasbank: renderKasBank,
    laporan: renderLaporan, aset: renderAset, unitusaha: renderUnitUsaha,
    dokumen: renderDokumen, pengguna: renderPengguna, pengaturan: renderPengaturan,
  };
  const el = document.getElementById("content");
  el.innerHTML = `<div class="empty">Memuat...</div>`;
  renderers[section]();
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ---------------- DASHBOARD ----------------
async function renderDashboard() {
  const year = new Date().getFullYear();
  const [{ data: kasBank }, { data: trx }, { data: unitUsaha }] = await Promise.all([
    supabaseClient.from("kas_bank").select("*"),
    supabaseClient.from("transaksi").select("*, unit_usaha(nama)").order("tanggal", { ascending: false }),
    supabaseClient.from("unit_usaha").select("*"),
  ]);

  const kas = (kasBank || []).filter(k => k.jenis === "kas").reduce((s, k) => s + Number(k.saldo), 0);
  const bank = (kasBank || []).filter(k => k.jenis === "bank").reduce((s, k) => s + Number(k.saldo), 0);
  const trxTahunIni = (trx || []).filter(t => new Date(t.tanggal).getFullYear() === year);
  const pendapatan = trxTahunIni.filter(t => t.jenis === "masuk").reduce((s, t) => s + Number(t.nominal), 0);
  const pengeluaran = trxTahunIni.filter(t => t.jenis === "keluar").reduce((s, t) => s + Number(t.nominal), 0);
  const laba = pendapatan - pengeluaran;

  // Per bulan untuk grafik arus kas
  const perBulan = Array.from({ length: 12 }, (_, i) => {
    const bulanTrx = trxTahunIni.filter(t => new Date(t.tanggal).getMonth() === i);
    const p = bulanTrx.filter(t => t.jenis === "masuk").reduce((s, t) => s + Number(t.nominal), 0);
    const k = bulanTrx.filter(t => t.jenis === "keluar").reduce((s, t) => s + Number(t.nominal), 0);
    return { p, k, laba: p - k };
  });

  // Distribusi per unit usaha (pendapatan)
  const distribusi = (unitUsaha || []).map(u => {
    const total = trxTahunIni.filter(t => t.jenis === "masuk" && t.unit_usaha_id === u.id).reduce((s, t) => s + Number(t.nominal), 0);
    return { nama: u.nama, total };
  }).filter(d => d.total > 0);

  const colors = ["#2f6fed", "#22a35c", "#f0a83c", "#8b5cf6", "#e5484d"];

  document.getElementById("content").innerHTML = `
    <div class="stat-grid">
      ${statCard("Saldo Kas", rupiah(kas), "Kas Tunai", "#2f6fed", iconWallet())}
      ${statCard("Saldo Bank", rupiah(bank), "Total Saldo Bank", "#22a35c", iconBank())}
      ${statCard("Total Pendapatan", rupiah(pendapatan), "Tahun " + year, "#f0a83c", iconUp())}
      ${statCard("Total Pengeluaran", rupiah(pengeluaran), "Tahun " + year, "#e5484d", iconDown())}
      ${statCard("Laba Bersih", rupiah(laba), "Tahun " + year, "#8b5cf6", iconChart())}
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Grafik Arus Kas</h3><span class="chip-select">Tahun ${year}</span></div>
        <div class="legend">
          <span><i class="dot" style="background:#22a35c"></i>Pendapatan</span>
          <span><i class="dot" style="background:#e5484d"></i>Pengeluaran</span>
          <span><i class="dot" style="background:#2f6fed"></i>Laba Bersih</span>
        </div>
        <canvas id="cashChart" height="230"></canvas>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Distribusi Pendapatan per Unit Usaha</h3></div>
        ${distribusi.length ? `<canvas id="pieChart" height="230"></canvas>` : `<div class="empty">Belum ada data pendapatan tahun ini</div>`}
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Transaksi Terbaru</h3></div>
        <table>
          <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Jenis</th><th>Nominal</th></tr></thead>
          <tbody>
            ${(trx || []).slice(0, 5).map(t => `
              <tr><td>${fmtDate(t.tanggal)}</td><td>${t.keterangan}</td>
              <td><span class="badge ${t.jenis}">${t.jenis === "masuk" ? "Masuk" : "Keluar"}</span></td>
              <td>${rupiah(t.nominal)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">Belum ada transaksi</td></tr>`}
          </tbody>
        </table>
        <a class="link-more" onclick="goTo('transaksi')">Lihat Semua →</a>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Unit Usaha</h3></div>
        <table>
          <thead><tr><th>Nama</th><th>Pendapatan ${year}</th></tr></thead>
          <tbody>
            ${distribusi.length ? distribusi.map(d => `<tr><td>${d.nama}</td><td>${rupiah(d.total)}</td></tr>`).join("") : `<tr><td colspan="2" class="empty">Belum ada data</td></tr>`}
          </tbody>
        </table>
        <a class="link-more" onclick="goTo('unitusaha')">Lihat Semua →</a>
      </div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("cashChart");
    if (ctx) new Chart(ctx, {
      type: "line",
      data: {
        labels: MONTHS,
        datasets: [
          { label: "Pendapatan", data: perBulan.map(b => b.p), borderColor: "#22a35c", backgroundColor: "rgba(34,163,92,.08)", tension: .35, fill: true },
          { label: "Pengeluaran", data: perBulan.map(b => b.k), borderColor: "#e5484d", backgroundColor: "rgba(229,72,77,.06)", tension: .35, fill: true },
          { label: "Laba Bersih", data: perBulan.map(b => b.laba), borderColor: "#2f6fed", backgroundColor: "rgba(47,111,237,.06)", tension: .35, fill: true },
        ]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v / 1000000 + "jt" } } } }
    });
    const pieEl = document.getElementById("pieChart");
    if (pieEl) new Chart(pieEl, {
      type: "doughnut",
      data: { labels: distribusi.map(d => d.nama), datasets: [{ data: distribusi.map(d => d.total), backgroundColor: colors, borderWidth: 0 }] },
      options: { plugins: { legend: { position: "right", labels: { boxWidth: 10, font: { size: 11 } } } }, cutout: "62%" }
    });
  }
}

function statCard(label, value, sub, color, icon) {
  return `<div class="stat-card">
    <div class="stat-top"><div class="stat-icon" style="background:${color}">${icon}</div><div class="stat-label">${label}</div></div>
    <div class="stat-value">${value}</div><div class="stat-sub">${sub}</div>
    <a class="stat-link" onclick="goTo('laporan')">Lihat Detail →</a>
  </div>`;
}
const iconWallet = () => `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 12h.01M2 10h20"/></svg>`;
const iconBank = () => `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 21h18M4 10h16M6 10V6l6-3 6 3v4M6 21v-7M12 21v-7M18 21v-7"/></svg>`;
const iconUp = () => `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></svg>`;
const iconDown = () => `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/></svg>`;
const iconChart = () => `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg>`;
function fmtDate(d) { const dt = new Date(d); return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); }

// ---------------- TRANSAKSI ----------------
async function renderTransaksi() {
  const [{ data: trx }, { data: unitUsaha }, { data: akun }] = await Promise.all([
    supabaseClient.from("transaksi").select("*, unit_usaha(nama), kas_bank(nama_akun)").order("tanggal", { ascending: false }),
    supabaseClient.from("unit_usaha").select("*"),
    supabaseClient.from("kas_bank").select("*"),
  ]);

  document.getElementById("content").innerHTML = `
    <div class="toolbar">
      <div></div>
      <button class="btn primary" onclick="openTrxModal()">${plusIcon()} Tambah Transaksi</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Unit Usaha</th><th>Akun</th><th>Jenis</th><th>Nominal</th><th>Aksi</th></tr></thead>
        <tbody>
          ${(trx || []).map(t => `
            <tr>
              <td>${fmtDate(t.tanggal)}</td><td>${t.keterangan}</td>
              <td>${t.unit_usaha?.nama || "-"}</td><td>${t.kas_bank?.nama_akun || "-"}</td>
              <td><span class="badge ${t.jenis}">${t.jenis === "masuk" ? "Masuk" : "Keluar"}</span></td>
              <td>${rupiah(t.nominal)}</td>
              <td><button class="icon-btn" onclick="deleteRow('transaksi','${t.id}','transaksi')">${trashIcon()}</button></td>
            </tr>`).join("") || `<tr><td colspan="7" class="empty">Belum ada transaksi</td></tr>`}
        </tbody>
      </table>
    </div>
    ${modalShell("trxModal", "Tambah Transaksi", `
      <div class="field"><label>Tanggal</label><input type="date" id="f_tanggal" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>Keterangan</label><input type="text" id="f_keterangan" placeholder="Contoh: Penjualan Sembako"></div>
      <div class="field"><label>Jenis</label><select id="f_jenis"><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select></div>
      <div class="field"><label>Nominal (Rp)</label><input type="number" id="f_nominal" placeholder="0"></div>
      <div class="field"><label>Unit Usaha</label><select id="f_unit"><option value="">-</option>${(unitUsaha||[]).map(u=>`<option value="${u.id}">${u.nama}</option>`).join("")}</select></div>
      <div class="field"><label>Akun (Kas/Bank)</label><select id="f_akun"><option value="">-</option>${(akun||[]).map(a=>`<option value="${a.id}">${a.nama_akun}</option>`).join("")}</select></div>
    `, saveTrx)}
  `;
}

function openTrxModal() { document.getElementById("trxModal").classList.add("show"); }

async function saveTrx() {
  const payload = {
    tanggal: document.getElementById("f_tanggal").value,
    keterangan: document.getElementById("f_keterangan").value.trim(),
    jenis: document.getElementById("f_jenis").value,
    nominal: Number(document.getElementById("f_nominal").value || 0),
    unit_usaha_id: document.getElementById("f_unit").value || null,
    akun_id: document.getElementById("f_akun").value || null,
    created_by: CURRENT_USER.id,
  };
  if (!payload.keterangan || !payload.nominal) { toast("Lengkapi keterangan dan nominal"); return; }
  const { error } = await supabaseClient.from("transaksi").insert(payload);
  if (error) { toast("Gagal: " + error.message); return; }
  closeModal("trxModal");
  toast("Transaksi berhasil ditambahkan");
  renderTransaksi();
}

// ---------------- KAS & BANK ----------------
async function renderKasBank() {
  const { data: akun } = await supabaseClient.from("kas_bank").select("*").order("jenis");
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><div></div><button class="btn primary" onclick="openAkunModal()">${plusIcon()} Tambah Akun</button></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      ${(akun || []).map(a => `
        <div class="stat-card">
          <div class="stat-top"><div class="stat-icon" style="background:${a.jenis==='kas'?'#2f6fed':'#22a35c'}">${a.jenis==='kas'?iconWallet():iconBank()}</div>
          <div class="stat-label">${a.nama_akun}</div></div>
          <div class="stat-value">${rupiah(a.saldo)}</div>
          <div class="stat-sub">${a.jenis === "kas" ? "Kas Tunai" : "Rekening Bank"}</div>
          <a class="stat-link" onclick="editAkun('${a.id}','${a.nama_akun}',${a.saldo})">Edit Saldo →</a>
        </div>`).join("") || `<div class="empty">Belum ada akun kas/bank</div>`}
    </div>
    ${modalShell("akunModal", "Tambah Akun Kas/Bank", `
      <div class="field"><label>Jenis</label><select id="a_jenis"><option value="kas">Kas Tunai</option><option value="bank">Bank</option></select></div>
      <div class="field"><label>Nama Akun</label><input type="text" id="a_nama" placeholder="Contoh: Bank BRI"></div>
      <div class="field"><label>Saldo Awal (Rp)</label><input type="number" id="a_saldo" placeholder="0"></div>
    `, saveAkun)}
  `;
}
function openAkunModal() {
  document.getElementById("akunModal").querySelector("h3").textContent = "Tambah Akun Kas/Bank";
  document.getElementById("akunModal").dataset.editId = "";
  document.getElementById("a_nama").value = ""; document.getElementById("a_saldo").value = "";
  document.getElementById("akunModal").classList.add("show");
}
function editAkun(id, nama, saldo) {
  document.getElementById("akunModal").querySelector("h3").textContent = "Edit Saldo Akun";
  document.getElementById("akunModal").dataset.editId = id;
  document.getElementById("a_nama").value = nama; document.getElementById("a_saldo").value = saldo;
  document.getElementById("akunModal").classList.add("show");
}
async function saveAkun() {
  const editId = document.getElementById("akunModal").dataset.editId;
  const payload = {
    jenis: document.getElementById("a_jenis").value,
    nama_akun: document.getElementById("a_nama").value.trim(),
    saldo: Number(document.getElementById("a_saldo").value || 0),
  };
  const q = editId ? supabaseClient.from("kas_bank").update(payload).eq("id", editId) : supabaseClient.from("kas_bank").insert(payload);
  const { error } = await q;
  if (error) { toast("Gagal: " + error.message); return; }
  closeModal("akunModal"); toast("Tersimpan"); renderKasBank();
}

// ---------------- LAPORAN KEUANGAN ----------------
async function renderLaporan() {
  const year = new Date().getFullYear();
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Unduh Laporan Keuangan ${year}</h3></div>
      <p style="color:var(--muted);font-size:13.5px">Laporan mencakup seluruh transaksi pemasukan dan pengeluaran tahun berjalan.</p>
      <div style="display:flex;gap:12px;margin-top:10px">
        <button class="btn green" onclick="exportExcel()">${downloadIcon()} Unduh Excel (.xlsx)</button>
        <button class="btn primary" onclick="exportPDF()">${downloadIcon()} Unduh PDF</button>
      </div>
    </div>
  `;
}

async function getReportData() {
  const year = new Date().getFullYear();
  const { data } = await supabaseClient.from("transaksi").select("*, unit_usaha(nama)").order("tanggal");
  return (data || []).filter(t => new Date(t.tanggal).getFullYear() === year);
}

async function exportExcel() {
  const rows = await getReportData();
  if (!rows.length) { toast("Tidak ada data untuk diekspor"); return; }
  const sheetData = rows.map(t => ({
    Tanggal: fmtDate(t.tanggal), Keterangan: t.keterangan, "Unit Usaha": t.unit_usaha?.nama || "-",
    Jenis: t.jenis === "masuk" ? "Pemasukan" : "Pengeluaran", Nominal: Number(t.nominal),
  }));
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan");
  XLSX.writeFile(wb, `Laporan_Keuangan_${new Date().getFullYear()}.xlsx`);
  toast("Laporan Excel berhasil diunduh");
}

async function exportPDF() {
  const rows = await getReportData();
  if (!rows.length) { toast("Tidak ada data untuk diekspor"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const year = new Date().getFullYear();
  doc.setFontSize(14); doc.text(`Laporan Keuangan Tahun ${year}`, 14, 16);
  doc.setFontSize(10); doc.setTextColor(120);
  doc.text(document.getElementById("brandName").textContent, 14, 22);
  doc.autoTable({
    startY: 28,
    head: [["Tanggal", "Keterangan", "Unit Usaha", "Jenis", "Nominal"]],
    body: rows.map(t => [fmtDate(t.tanggal), t.keterangan, t.unit_usaha?.nama || "-", t.jenis === "masuk" ? "Pemasukan" : "Pengeluaran", rupiah(t.nominal)]),
    styles: { fontSize: 9 }, headStyles: { fillColor: [16, 27, 52] },
  });
  const pendapatan = rows.filter(t => t.jenis === "masuk").reduce((s, t) => s + Number(t.nominal), 0);
  const pengeluaran = rows.filter(t => t.jenis === "keluar").reduce((s, t) => s + Number(t.nominal), 0);
  const y = doc.lastAutoTable.finalY + 10;
  doc.setTextColor(0);
  doc.text(`Total Pendapatan: ${rupiah(pendapatan)}`, 14, y);
  doc.text(`Total Pengeluaran: ${rupiah(pengeluaran)}`, 14, y + 6);
  doc.text(`Laba Bersih: ${rupiah(pendapatan - pengeluaran)}`, 14, y + 12);
  doc.save(`Laporan_Keuangan_${year}.pdf`);
  toast("Laporan PDF berhasil diunduh");
}

// ---------------- ASET ----------------
async function renderAset() {
  const { data: aset } = await supabaseClient.from("aset").select("*").order("created_at", { ascending: false });
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><div></div><button class="btn primary" onclick="openAsetModal()">${plusIcon()} Tambah Aset</button></div>
    <div class="panel">
      <table>
        <thead><tr><th>Nama Aset</th><th>Kategori</th><th>Nilai Perolehan</th><th>Kondisi</th><th>Aksi</th></tr></thead>
        <tbody>
          ${(aset || []).map(a => `
            <tr><td>${a.nama_aset}</td><td>${a.kategori || "-"}</td><td>${rupiah(a.nilai_perolehan)}</td>
            <td><span class="badge baik">${a.kondisi}</span></td>
            <td><button class="icon-btn" onclick="deleteRow('aset','${a.id}','aset')">${trashIcon()}</button></td></tr>
          `).join("") || `<tr><td colspan="5" class="empty">Belum ada aset</td></tr>`}
        </tbody>
      </table>
    </div>
    ${modalShell("asetModal", "Tambah Aset", `
      <div class="field"><label>Nama Aset</label><input type="text" id="as_nama" placeholder="Contoh: Komputer"></div>
      <div class="field"><label>Kategori</label><input type="text" id="as_kategori" placeholder="Contoh: Peralatan"></div>
      <div class="field"><label>Nilai Perolehan (Rp)</label><input type="number" id="as_nilai" placeholder="0"></div>
      <div class="field"><label>Kondisi</label><select id="as_kondisi"><option>Baik</option><option>Rusak Ringan</option><option>Rusak Berat</option></select></div>
    `, saveAset)}
  `;
}
function openAsetModal() { document.getElementById("asetModal").classList.add("show"); }
async function saveAset() {
  const payload = {
    nama_aset: document.getElementById("as_nama").value.trim(),
    kategori: document.getElementById("as_kategori").value.trim(),
    nilai_perolehan: Number(document.getElementById("as_nilai").value || 0),
    kondisi: document.getElementById("as_kondisi").value,
  };
  if (!payload.nama_aset) { toast("Nama aset wajib diisi"); return; }
  const { error } = await supabaseClient.from("aset").insert(payload);
  if (error) { toast("Gagal: " + error.message); return; }
  closeModal("asetModal"); toast("Aset ditambahkan"); renderAset();
}

// ---------------- UNIT USAHA ----------------
async function renderUnitUsaha() {
  const { data: unit } = await supabaseClient.from("unit_usaha").select("*").order("created_at");
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><div></div><button class="btn primary" onclick="openUnitModal()">${plusIcon()} Tambah Unit Usaha</button></div>
    <div class="panel">
      <table>
        <thead><tr><th>Nama Unit Usaha</th><th>Deskripsi</th><th>Aksi</th></tr></thead>
        <tbody>
          ${(unit || []).map(u => `
            <tr><td>${u.nama}</td><td>${u.deskripsi || "-"}</td>
            <td><button class="icon-btn" onclick="deleteRow('unit_usaha','${u.id}','unitusaha')">${trashIcon()}</button></td></tr>
          `).join("") || `<tr><td colspan="3" class="empty">Belum ada unit usaha</td></tr>`}
        </tbody>
      </table>
    </div>
    ${modalShell("unitModal", "Tambah Unit Usaha", `
      <div class="field"><label>Nama Unit Usaha</label><input type="text" id="u_nama"></div>
      <div class="field"><label>Deskripsi</label><input type="text" id="u_deskripsi"></div>
    `, saveUnit)}
  `;
}
function openUnitModal() { document.getElementById("unitModal").classList.add("show"); }
async function saveUnit() {
  const payload = { nama: document.getElementById("u_nama").value.trim(), deskripsi: document.getElementById("u_deskripsi").value.trim() };
  if (!payload.nama) { toast("Nama unit usaha wajib diisi"); return; }
  const { error } = await supabaseClient.from("unit_usaha").insert(payload);
  if (error) { toast("Gagal: " + error.message); return; }
  closeModal("unitModal"); toast("Unit usaha ditambahkan"); renderUnitUsaha();
}

// ---------------- DOKUMEN ----------------
async function renderDokumen() {
  const { data: dok } = await supabaseClient.from("dokumen").select("*").order("created_at", { ascending: false });
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><div></div><button class="btn primary" onclick="openDokModal()">${plusIcon()} Unggah Dokumen</button></div>
    <div class="panel">
      <table>
        <thead><tr><th>Nama File</th><th>Kategori</th><th>Tanggal</th><th>Aksi</th></tr></thead>
        <tbody>
          ${(dok || []).map(d => `
            <tr><td><a href="${d.file_url}" target="_blank">${d.nama_file}</a></td><td>${d.kategori || "-"}</td>
            <td>${fmtDate(d.created_at)}</td>
            <td><button class="icon-btn" onclick="deleteRow('dokumen','${d.id}','dokumen')">${trashIcon()}</button></td></tr>
          `).join("") || `<tr><td colspan="4" class="empty">Belum ada dokumen</td></tr>`}
        </tbody>
      </table>
    </div>
    ${modalShell("dokModal", "Unggah Dokumen", `
      <div class="field"><label>Kategori</label><input type="text" id="d_kategori" placeholder="Contoh: Legalitas"></div>
      <div class="field"><label>File</label><input type="file" id="d_file"></div>
    `, saveDokumen)}
  `;
}
function openDokModal() { document.getElementById("dokModal").classList.add("show"); }
async function saveDokumen() {
  const fileInput = document.getElementById("d_file");
  const file = fileInput.files[0];
  if (!file) { toast("Pilih file terlebih dahulu"); return; }
  const path = `${Date.now()}_${file.name}`;
  const { error: upErr } = await supabaseClient.storage.from("dokumen").upload(path, file);
  if (upErr) { toast("Gagal unggah: " + upErr.message); return; }
  const { data: pub } = supabaseClient.storage.from("dokumen").getPublicUrl(path);
  const { error } = await supabaseClient.from("dokumen").insert({
    nama_file: file.name, kategori: document.getElementById("d_kategori").value.trim(),
    file_url: pub.publicUrl, uploaded_by: CURRENT_USER.id,
  });
  if (error) { toast("Gagal: " + error.message); return; }
  closeModal("dokModal"); toast("Dokumen diunggah"); renderDokumen();
}

// ---------------- PENGGUNA (admin) ----------------
async function renderPengguna() {
  const { data: users } = await supabaseClient.from("profiles").select("*").order("created_at");
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><div></div>
      ${CURRENT_PROFILE.role === "admin" ? `<button class="btn primary" onclick="openUserModal()">${plusIcon()} Tambah Pengguna</button>` : ""}
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Nama</th><th>Email</th><th>Role</th>${CURRENT_PROFILE.role==="admin"?"<th>Aksi</th>":""}</tr></thead>
        <tbody>
          ${(users || []).map(u => `
            <tr><td>${u.nama}</td><td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${u.role === "admin" ? "Admin" : "Pengurus"}</span></td>
            ${CURRENT_PROFILE.role==="admin" ? `<td>
              ${u.id !== CURRENT_USER.id ? `<button class="icon-btn" onclick="toggleRole('${u.id}','${u.role}')">${swapIcon()}</button>` : ""}
            </td>` : ""}
            </tr>
          `).join("") || `<tr><td colspan="4" class="empty">Belum ada pengguna</td></tr>`}
        </tbody>
      </table>
    </div>
    ${modalShell("userModal", "Tambah Pengguna Baru", `
      <div class="field"><label>Nama</label><input type="text" id="us_nama"></div>
      <div class="field"><label>Email</label><input type="email" id="us_email"></div>
      <div class="field"><label>Kata Sandi Sementara</label><input type="text" id="us_pass" placeholder="Minimal 6 karakter"></div>
      <div class="field"><label>Role</label><select id="us_role"><option value="user">Pengurus</option><option value="admin">Admin</option></select></div>
      <p style="font-size:12px;color:var(--muted)">Catatan: akun akan langsung aktif. Untuk keamanan produksi, gunakan Supabase Edge Function (lihat README) agar admin tidak perlu login ulang saat menambah pengguna.</p>
    `, saveUser)}
  `;
}
function openUserModal() { document.getElementById("userModal").classList.add("show"); }
async function saveUser() {
  const nama = document.getElementById("us_nama").value.trim();
  const email = document.getElementById("us_email").value.trim();
  const password = document.getElementById("us_pass").value;
  const role = document.getElementById("us_role").value;
  if (!nama || !email || password.length < 6) { toast("Lengkapi data dengan benar (sandi min 6 karakter)"); return; }
  const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { nama, role } } });
  if (error) { toast("Gagal: " + error.message); return; }
  closeModal("userModal");
  toast("Pengguna ditambahkan. Jika verifikasi email aktif, minta pengguna mengecek inbox.");
  renderPengguna();
}
async function toggleRole(id, currentRole) {
  const newRole = currentRole === "admin" ? "user" : "admin";
  const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("id", id);
  if (error) { toast("Gagal ubah role: " + error.message); return; }
  toast("Role diperbarui"); renderPengguna();
}

// ---------------- PENGATURAN (admin) ----------------
async function renderPengaturan() {
  const { data: s } = await supabaseClient.from("settings").select("*").eq("id", 1).single();
  const isAdmin = CURRENT_PROFILE.role === "admin";
  document.getElementById("content").innerHTML = `
    <div class="panel" style="max-width:520px">
      <div class="panel-head"><h3>Identitas & Logo</h3></div>
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px">
        <img id="logoPreview" class="logo-preview" src="${s?.logo_url || ''}" onerror="this.style.opacity=0">
        <div>
          <input type="file" id="p_logo_file" accept="image/*" ${isAdmin ? "" : "disabled"}>
          <p style="font-size:11.5px;color:var(--muted);margin:6px 0 0">Gambar akan ditampilkan di halaman login &amp; sidebar.</p>
        </div>
      </div>
      <div class="field"><label>Nama BUMDes</label><input type="text" id="p_nama" value="${s?.nama_bumdes || ''}" ${isAdmin?"":"disabled"}></div>
      <div class="field"><label>Alamat</label><input type="text" id="p_alamat" value="${s?.alamat || ''}" ${isAdmin?"":"disabled"}></div>
      <div class="field"><label>Tahun Buku</label><input type="number" id="p_tahun" value="${s?.tahun_buku || new Date().getFullYear()}" ${isAdmin?"":"disabled"}></div>
      ${isAdmin ? `<button class="btn primary" onclick="saveSettings()">Simpan Pengaturan</button>` : `<p style="font-size:12.5px;color:var(--muted)">Hanya admin yang dapat mengubah pengaturan.</p>`}
    </div>
  `;
}
async function saveSettings() {
  const fileInput = document.getElementById("p_logo_file");
  let logo_url;
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    const path = `logo_${Date.now()}_${file.name}`;
    const { error: upErr } = await supabaseClient.storage.from("logos").upload(path, file, { upsert: true });
    if (upErr) { toast("Gagal unggah logo: " + upErr.message); return; }
    const { data: pub } = supabaseClient.storage.from("logos").getPublicUrl(path);
    logo_url = pub.publicUrl;
  }
  const payload = {
    nama_bumdes: document.getElementById("p_nama").value.trim(),
    alamat: document.getElementById("p_alamat").value.trim(),
    tahun_buku: Number(document.getElementById("p_tahun").value),
  };
  if (logo_url) payload.logo_url = logo_url;
  const { error } = await supabaseClient.from("settings").update(payload).eq("id", 1);
  if (error) { toast("Gagal: " + error.message); return; }
  toast("Pengaturan disimpan");
  loadSettingsIntoShell();
  renderPengaturan();
}

// ---------------- HELPERS: modal, delete ----------------
function modalShell(id, title, fieldsHtml, onSave) {
  window["__save_" + id] = onSave;
  return `
    <div class="modal-bg" id="${id}">
      <div class="modal">
        <h3>${title}</h3>
        ${fieldsHtml}
        <div class="modal-actions">
          <button class="btn outline" onclick="closeModal('${id}')">Batal</button>
          <button class="btn primary" onclick="window.__save_${id}()">Simpan</button>
        </div>
      </div>
    </div>`;
}
function closeModal(id) { document.getElementById(id).classList.remove("show"); }

async function deleteRow(table, id, sectionAfter) {
  if (!confirm("Hapus data ini?")) return;
  const { error } = await supabaseClient.from(table).delete().eq("id", id);
  if (error) { toast("Gagal hapus: " + error.message); return; }
  toast("Data dihapus");
  goTo(sectionAfter);
}

const plusIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`;
const trashIcon = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
const downloadIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/></svg>`;
const swapIcon = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4M7 4 3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>`;
