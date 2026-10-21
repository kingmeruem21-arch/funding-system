/* =======================================================
   app-funding.js - Logika Sistem Pendanaan (Funding)
   Versi: Final dengan Validasi Kontrak Ganda & Status Menunggak
   ======================================================= */

var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwQqGUxAN0sFl8a6lif622narQxp86MtIPxJIyR06VqtwvQoLb6lXj4nsHUVBqkXf9n/exec";
// ==========================================
// PENGATURAN KATA SANDI APLIKASI (ROBUST)
// ==========================================
var KATA_SANDI_INTERNAL = "admin123";

function verifikasiSandi(e) {
    if (e && e.preventDefault) e.preventDefault();
    var inputEl = document.getElementById('inputSandiAplikasi');
    if (!inputEl) return false;

    var inputPass = inputEl.value.trim();
    var elPesan = document.getElementById('pesanSandiSalah');
    var overlay = document.getElementById('loginOverlay');

    if (inputPass === KATA_SANDI_INTERNAL) {
        // LOGIN BERHASIL
        sessionStorage.setItem("isLoggedInFunding", "true");
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.classList.remove('d-flex');
                overlay.classList.add('d-none-animated');
            }, 500);
        }
        inputEl.value = '';
        if (elPesan) elPesan.classList.add('d-none');
        
        // --- TAMBAHAN BARU ---
        resetIdleTimer(); // Mulai menghitung 30 menit dari sekarang
        // ---------------------
    } else {
        if (elPesan) elPesan.classList.remove('d-none');
        inputEl.value = '';
    }
    return false;
}

function kunciAplikasi() {
    sessionStorage.removeItem("isLoggedInFunding");
    var overlay = document.getElementById('loginOverlay');
    
    // --- TAMBAHAN BARU ---
    clearTimeout(idleTimeout); // Hentikan timer jika sengaja dilogout
    // ---------------------

    if (overlay) {
        overlay.classList.remove('d-none-animated');
        overlay.classList.add('d-flex');
        setTimeout(() => {
            overlay.classList.remove('fade-out');
        }, 10);
    }
}

function cekStatusLogin() {
    var statusLogin = sessionStorage.getItem("isLoggedInFunding");
    var overlay = document.getElementById('loginOverlay');
    
    if (overlay) {
        if (statusLogin === "true") {
            // Sembunyikan langsung tanpa animasi jika halaman di-refresh dan user sudah login
            overlay.classList.add('fade-out');
            overlay.classList.remove('d-flex');
            overlay.classList.add('d-none-animated');
        } else {
            // Tampilkan langsung tanpa animasi
            overlay.classList.remove('fade-out');
            overlay.classList.remove('d-none-animated');
            overlay.classList.add('d-flex');
        }
    }
}
// ==========================================
// FITUR AUTO-LOGOUT JIKA IDLE (TIDAK AKTIF) 30 MENIT
// ==========================================
var idleTimeout;
var waktuIdleLimit = 30 * 60 * 1000; // 30 menit dikali 60 detik dikali 1000 milidetik

function resetIdleTimer() {
    // Bersihkan timer sebelumnya (jika ada) setiap kali ada aktivitas
    clearTimeout(idleTimeout);
    
    // Hanya pasang timer baru jika pengguna sedang dalam status login
    if (sessionStorage.getItem("isLoggedInFunding") === "true") {
        idleTimeout = setTimeout(() => {
            // Jika waktu 30 menit habis tanpa aktivitas, kunci aplikasi
            Swal.fire({
                title: 'Sesi Berakhir',
                text: 'Aplikasi otomatis dikunci karena tidak ada aktivitas selama 30 menit.',
                icon: 'warning',
                confirmButtonText: 'Login Kembali',
                allowOutsideClick: false
            }).then(() => {
                kunciAplikasi();
            });
        }, waktuIdleLimit);
    }
}

// Daftarkan event-event yang dianggap sebagai "aktivitas" oleh pengguna
// Setiap kali event ini terjadi, waktu idle 30 menit akan diulang dari awal
document.addEventListener("mousemove", resetIdleTimer);
document.addEventListener("keydown", resetIdleTimer);
document.addEventListener("click", resetIdleTimer);
document.addEventListener("scroll", resetIdleTimer);
var dbMasterFasilitas = [];
var dbPenarikan = [];
var dbJadwalAngsuran = [];
var dbPelunasan = [];

function formatRp(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0); }

function formatInputRupiah(el) {
    let angka = el.value.replace(/[^,\d]/g, '').toString();
    let split = angka.split(','); let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa); let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) { let separator = sisa ? '.' : ''; rupiah += separator + ribuan.join('.'); }
    el.value = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
}

function gantiHalaman(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar-wrapper .nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.getElementById('nav-' + pageId).classList.add('active');

    if (pageId === 'penarikan' || pageId === 'pelunasan' || pageId === 'jadwal') renderData();
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'laporan') renderLaporanPeriode();
}

function triggerFilterUpdate() {
    renderDashboard();
    renderLaporanPeriode();
    renderData();
}

function resetFilterPeriode() {
    document.getElementById('filterTglMulai').value = '';
    document.getElementById('filterTglSelesai').value = '';
    triggerFilterUpdate();
}

// ==========================================
// RENDER DASHBOARD
// ==========================================
function renderDashboard() {
    var tglMulai = document.getElementById('filterTglMulai').value;
    var tglSelesai = document.getElementById('filterTglSelesai').value;
    var cutOffDateStr = tglSelesai ? tglSelesai : '9999-12-31';

    var totalOSPendanaan = 0, totalKelonggaran = 0, totalGlobalLimit = 0, totalPenarikanRentang = 0, totalPembayaranRentang = 0;
    var tbody = document.getElementById('tBodyRekapFasilitas'); tbody.innerHTML = "";
    var groupedData = {};

    dbMasterFasilitas.forEach(m => {
        if (!groupedData[m.kreditur]) groupedData[m.kreditur] = [];
        groupedData[m.kreditur].push(m);
    });

    for (let bank in groupedData) {
        var bankData = groupedData[bank];
        var subTotalLimit = 0, subTotalOS = 0, subTotalKelonggaran = 0;

        for (let i = 0; i < bankData.length; i++) {
            let fas = bankData[i];

            let akumulasiPenarikanSemua = dbPenarikan.filter(p => p.id_fasilitas === fas.id_fasilitas && p.tgl_realisasi <= cutOffDateStr).reduce((sum, p) => sum + p.nilai_penarikan, 0);
            let akumulasiPelunasanSemua = dbPelunasan.filter(pel => pel.id_fasilitas === fas.id_fasilitas && pel.tgl_bayar <= cutOffDateStr).reduce((sum, pel) => sum + pel.pokok_dibayar, 0);

            let osFasilitas = (fas.baki_debet_awal || 0) + akumulasiPenarikanSemua - akumulasiPelunasanSemua;
            if (osFasilitas < 0) osFasilitas = 0;
            let kelonggaran = fas.limit_schedule - osFasilitas;
            if (kelonggaran < 0) kelonggaran = 0;

            let penarikanDiRentang = dbPenarikan.filter(p => {
                let match = p.id_fasilitas === fas.id_fasilitas; if (!match) return false;
                if (tglMulai && tglSelesai) return p.tgl_realisasi >= tglMulai && p.tgl_realisasi <= tglSelesai;
                if (tglMulai && !tglSelesai) return p.tgl_realisasi >= tglMulai;
                if (!tglMulai && tglSelesai) return p.tgl_realisasi <= tglSelesai;
                return true;
            }).reduce((sum, p) => sum + p.nilai_penarikan, 0);

            let pelunasanDiRentang = dbPelunasan.filter(pel => {
                let match = pel.id_fasilitas === fas.id_fasilitas; if (!match) return false;
                if (tglMulai && tglSelesai) return pel.tgl_bayar >= tglMulai && pel.tgl_bayar <= tglSelesai;
                if (tglMulai && !tglSelesai) return pel.tgl_bayar >= tglMulai;
                if (!tglMulai && tglSelesai) return pel.tgl_bayar <= tglSelesai;
                return true;
            }).reduce((sum, pel) => sum + pel.pokok_dibayar, 0);

            totalPenarikanRentang += penarikanDiRentang; totalPembayaranRentang += pelunasanDiRentang;
            subTotalLimit += fas.limit_schedule; subTotalOS += osFasilitas; subTotalKelonggaran += kelonggaran;

            let rowHTML = `<tr>`;
            if (i === 0) rowHTML += `<td rowspan="${bankData.length}" class="fw-bold align-middle">${bank}</td>`;
            rowHTML += `<td>${fas.jenis_fasilitas || '-'}</td><td>${fas.nama_fasilitas || '-'}</td><td>${fas.tujuan_fasilitas || '-'}</td><td>${fas.sifat_fasilitas}</td>
                <td class="text-center">${fas.interest_rate}</td><td class="text-end">${formatRp(fas.limit_schedule)}</td>
                <td class="text-end text-primary fw-bold">${formatRp(osFasilitas)}</td><td class="text-end text-success">${kelonggaran === 0 ? '-' : formatRp(kelonggaran)}</td></tr>`;
            tbody.innerHTML += rowHTML;
        }

        tbody.innerHTML += `<tr class="table-secondary fw-bold"><td colspan="6" class="text-end">Total ${bank}</td><td class="text-end">${formatRp(subTotalLimit)}</td>
            <td class="text-end text-primary">${formatRp(subTotalOS)}</td><td class="text-end text-success">${formatRp(subTotalKelonggaran)}</td></tr>`;

        totalGlobalLimit += subTotalLimit; totalOSPendanaan += subTotalOS; totalKelonggaran += subTotalKelonggaran;
    }

    document.getElementById('tFootRekapFasilitas').innerHTML = `<tr class="table-dark text-white"><td colspan="6" class="text-end">TOTAL KESELURUHAN</td>
        <td class="text-end">${formatRp(totalGlobalLimit)}</td><td class="text-end">${formatRp(totalOSPendanaan)}</td><td class="text-end">${formatRp(totalKelonggaran)}</td></tr>`;

    document.getElementById('dashTotalOS').innerText = formatRp(totalOSPendanaan);
    document.getElementById('dashTotalPenarikan').innerText = formatRp(totalPenarikanRentang);
    document.getElementById('dashTotalPembayaran').innerText = formatRp(totalPembayaranRentang);
    document.getElementById('dashSisaPlafon').innerText = formatRp(totalKelonggaran);
}

// ==========================================
// RENDER LAPORAN PERIODE
// ==========================================
function renderLaporanPeriode() {
    var tglMulai = document.getElementById('filterTglMulai').value;
    var tglSelesai = document.getElementById('filterTglSelesai').value;
    var tbodyLapPenarikan = document.getElementById('tBodyLapPenarikan');
    var tbodyLapPelunasan = document.getElementById('tBodyLapPelunasan');
    if (!tbodyLapPenarikan) return;

    tbodyLapPenarikan.innerHTML = ""; tbodyLapPelunasan.innerHTML = "";
    var totalPokok = 0, totalBunga = 0, totalPenarikan = 0;

    var filteredPenarikan = dbPenarikan.filter(p => {
        if (!tglMulai && !tglSelesai) return true;
        if (tglMulai && !tglSelesai) return p.tgl_realisasi >= tglMulai;
        if (!tglMulai && tglSelesai) return p.tgl_realisasi <= tglSelesai;
        return p.tgl_realisasi >= tglMulai && p.tgl_realisasi <= tglSelesai;
    });

    filteredPenarikan.forEach(p => {
        totalPenarikan += p.nilai_penarikan;
        tbodyLapPenarikan.innerHTML += `<tr><td><b>${p.id_kontrak}</b></td><td>${p.id_fasilitas}</td><td>${p.nama_customer}</td><td>${p.tgl_realisasi}</td><td class="text-end fw-bold text-primary">${formatRp(p.nilai_penarikan)}</td></tr>`;
    });

    var filteredPelunasan = dbPelunasan.filter(pel => {
        if (!tglMulai && !tglSelesai) return true;
        if (tglMulai && !tglSelesai) return pel.tgl_bayar >= tglMulai;
        if (!tglMulai && tglSelesai) return pel.tgl_bayar <= tglSelesai;
        return pel.tgl_bayar >= tglMulai && pel.tgl_bayar <= tglSelesai;
    });

    filteredPelunasan.forEach(pel => {
        totalPokok += pel.pokok_dibayar; totalBunga += pel.bunga_dibayar;
        tbodyLapPelunasan.innerHTML += `<tr><td>${pel.id_pelunasan}</td><td>${pel.id_fasilitas}</td><td>${pel.tgl_bayar}</td><td><span class="badge bg-secondary">${pel.jenis_pelunasan}</span></td><td class="text-end text-success fw-bold">${formatRp(pel.pokok_dibayar)}</td><td class="text-end text-info fw-bold">${formatRp(pel.bunga_dibayar)}</td></tr>`;
    });

    document.getElementById('lapTotalPenarikan').innerText = formatRp(totalPenarikan);
    document.getElementById('lapTotalPokokBayar').innerText = formatRp(totalPokok);
    document.getElementById('lapTotalBungaBayar').innerText = formatRp(totalBunga);
}

// ==========================================
// RENDER DATA (DROPDOWNS & TABEL)
// ==========================================
function renderData() {
    var selectFasilitasPel = document.getElementById('pelIdFasilitas');
    if (selectFasilitasPel) {
        selectFasilitasPel.innerHTML = '<option value="">-- Pilih Fasilitas Tujuan --</option>';
        dbMasterFasilitas.forEach(m => selectFasilitasPel.innerHTML += `<option value="${m.id_fasilitas}">${m.kreditur} - ${m.nama_fasilitas}</option>`);
    }

    var selectFasUpload = document.getElementById('pilihFasilitasUpload');
    if (selectFasUpload) {
        selectFasUpload.innerHTML = '<option value="">-- Pilih Fasilitas Bank --</option>';
        dbMasterFasilitas.forEach(m => selectFasUpload.innerHTML += `<option value="${m.id_fasilitas}">${m.kreditur} - ${m.nama_fasilitas}</option>`);
    }

    // TABEL JADWAL ANGSURAN & FILTER PERIODE DENGAN INDIKATOR MENUNGGAK
    var tbodyJadwal = document.getElementById('tBodyJadwal');
    if (tbodyJadwal) {
        tbodyJadwal.innerHTML = "";
        let today = new Date().toISOString().split('T')[0];

        var tglMulai = document.getElementById('filterTglMulai').value;
        var tglSelesai = document.getElementById('filterTglSelesai').value;

        let sumPokokJadwal = 0;
        let sumBungaJadwal = 0;

        let filteredJadwal = dbJadwalAngsuran.filter(j => {
            if (j.tgl_jatuh_tempo === "-") return false;
            
            // Tambahkan baris ini agar yang sudah Lunas tidak ikut terhitung di ringkasan atas
            if (j.status_bayar === "Lunas") return false; 

            var tglMulai = document.getElementById('filterTglMulai').value;
            var tglSelesai = document.getElementById('filterTglSelesai').value;
            
            if (!tglMulai && !tglSelesai) return true;
            if (tglMulai && !tglSelesai) return j.tgl_jatuh_tempo >= tglMulai;
            if (!tglMulai && tglSelesai) return j.tgl_jatuh_tempo <= tglSelesai;
            return j.tgl_jatuh_tempo >= tglMulai && j.tgl_jatuh_tempo <= tglSelesai;
        });

        filteredJadwal.forEach(j => {
            let currentStatus = j.status_bayar;
            // Deteksi otomatis status menunggak jika belum lunas dan lewat tanggal hari ini
            if (currentStatus === "Belum" && j.tgl_jatuh_tempo < today) {
                currentStatus = "Menunggak (Lewat Tempo)";
            }

            let badgeColor = "bg-warning text-dark";
            if (currentStatus === "Lunas") badgeColor = "bg-success";
            else if (currentStatus.includes("Menunggak")) badgeColor = "bg-danger text-white";
            else if (currentStatus.includes("Void")) badgeColor = "bg-secondary";

            sumPokokJadwal += (j.angsuran_pokok || 0);
            sumBungaJadwal += (j.angsuran_bunga || 0);

            tbodyJadwal.innerHTML += `<tr>
                <td><b>${j.id_kontrak}</b></td>
                <td class="text-center">${j.angsuran_ke}</td>
                <td>${j.tgl_jatuh_tempo}</td>
                <td class="text-end">${formatRp(j.saldo_pokok_awal)}</td>
                <td class="text-end">${formatRp(j.angsuran_pokok)}</td>
                <td class="text-end">${formatRp(j.angsuran_bunga)}</td>
                <td class="text-center"><span class="badge ${badgeColor}">${currentStatus}</span></td>
            </tr>`;
        });

        var elPokok = document.getElementById('infoTotalPokokJadwal');
        var elBunga = document.getElementById('infoTotalBungaJadwal');
        var elTotal = document.getElementById('infoTotalTagihanJadwal');

        if (elPokok) elPokok.innerText = formatRp(sumPokokJadwal);
        if (elBunga) elBunga.innerText = formatRp(sumBungaJadwal);
        if (elTotal) elTotal.innerText = formatRp(sumPokokJadwal + sumBungaJadwal);
    }

    // TABEL PENARIKAN DENGAN PENCARIAN OTOMATIS
    var tbodyPenarikan = document.getElementById('tBodyPenarikan');
    if (tbodyPenarikan) {
        tbodyPenarikan.innerHTML = "";
        var keywordCari = document.getElementById('inputCariPenarikan') ? document.getElementById('inputCariPenarikan').value.toLowerCase() : "";

        var filteredPenarikan = dbPenarikan.filter(p => {
            if (!keywordCari) return true;
            let matchKontrak = p.id_kontrak.toLowerCase().includes(keywordCari);
            let matchCustomer = p.nama_customer.toLowerCase().includes(keywordCari);
            let matchFasilitas = p.id_fasilitas.toLowerCase().includes(keywordCari);
            return matchKontrak || matchCustomer || matchFasilitas;
        });

        if (filteredPenarikan.length === 0) {
            // Ubah colspan menjadi 9 karena ada tambahan 1 kolom baru
            tbodyPenarikan.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Tidak ada data penarikan yang cocok dengan pencarian.</td></tr>`;
        } else {
            filteredPenarikan.forEach(p => {
                
                // === KALKULASI SISA OS PER KONTRAK ===
                // Ambil semua total pokok yang sudah dibayar khusus untuk ID Kontrak ini
                let totalPokokLunas = dbPelunasan
                    .filter(pel => pel.id_kontrak === p.id_kontrak)
                    .reduce((sum, pel) => sum + pel.pokok_dibayar, 0);
                
                let sisaOS = p.nilai_penarikan - totalPokokLunas;
                if (sisaOS < 0) sisaOS = 0; // Proteksi agar tidak minus jika ada lebih bayar desimal
                
                // Beri warna merah jika masih ada hutang, hijau jika sudah lunas (0)
                let textWarnaOS = sisaOS === 0 ? 'text-success' : 'text-danger';
                // =====================================

                tbodyPenarikan.innerHTML += `<tr>
                    <td><b>${p.id_kontrak}</b></td>
                    <td>${p.id_fasilitas}</td>
                    <td>${p.nama_customer}</td>
                    <td>${p.tgl_realisasi}</td>
                    <td class="text-end fw-bold">${formatRp(p.nilai_penarikan)}</td>
                    <td class="text-end fw-bold ${textWarnaOS}">${formatRp(sisaOS)}</td>
                    <td class="text-center">${p.tenor} Bln</td>
                    <td class="text-center"><span class="badge ${p.status.includes('Lunas') ? 'bg-success' : 'bg-primary'}">${p.status}</span></td>
                    <td class="text-center"><button class="btn btn-danger btn-sm py-0 px-2" onclick="hapusPenarikan('${p.id_kontrak}')">🗑️ Hapus</button></td>
                </tr>`;
            });
        }
    }

    // TABEL RIWAYAT PELUNASAN
    var tbodyPelunasanPage = document.getElementById('tBodyPelunasanPage');
    if (tbodyPelunasanPage) {
        tbodyPelunasanPage.innerHTML = "";
        if (dbPelunasan.length === 0) {
            tbodyPelunasanPage.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Belum ada data pelunasan yang diinput.</td></tr>`;
        } else {
            dbPelunasan.forEach(pel => {
                tbodyPelunasanPage.innerHTML += `<tr>
                    <td><b>${pel.id_pelunasan}</b></td>
                    <td>${pel.id_fasilitas}</td>
                    <td>${pel.id_kontrak || '-'}</td>
                    <td>${pel.tgl_bayar}</td>
                    <td><span class="badge bg-secondary">${pel.jenis_pelunasan}</span></td>
                    <td class="text-end text-success fw-bold">${formatRp(pel.pokok_dibayar)}</td>
                    <td class="text-end text-info fw-bold">${formatRp(pel.bunga_dibayar)}</td>
                    <td class="text-center"><button class="btn btn-danger btn-sm py-0 px-2" onclick="hapusPelunasan('${pel.id_pelunasan}')">🗑️ Hapus</button></td>
                </tr>`;
            });
        }
    }
}

// ==========================================
// LOGIKA DROPDOWN KONTRAK SAAT INPUT PELUNASAN
// ==========================================
function loadKontrakTerkait() {
    var idFasilitasTerpilih = document.getElementById('pelIdFasilitas').value;
    var dropdownKontrak = document.getElementById('pelKontrak');

    dropdownKontrak.innerHTML = '<option value="">-- Pilih Kontrak / Customer (Wajib) --</option>';

    if (!idFasilitasTerpilih) return;

    var kontrakTerkait = dbPenarikan.filter(p => p.id_fasilitas === idFasilitasTerpilih && p.status !== "Lunas Dipercepat");

    if (kontrakTerkait.length === 0) {
        dropdownKontrak.innerHTML = '<option value="">-- Tidak Ada Kontrak Aktif di Fasilitas Ini --</option>';
    } else {
        kontrakTerkait.forEach(k => {
            dropdownKontrak.innerHTML += `<option value="${k.id_kontrak}">${k.id_kontrak} - ${k.nama_customer}</option>`;
        });
    }

    muatOspiAngsuranOtomatis();
}

// ==========================================
// MODAL PELUNASAN & SIMPAN
// ==========================================
var modalPelunasan;
function bukaModalPelunasan() {
    if (!modalPelunasan) modalPelunasan = new bootstrap.Modal(document.getElementById('modalInputPelunasan'));
    document.getElementById('pelPokok').value = '';
    document.getElementById('pelBunga').value = '';

    document.getElementById('pelKontrak').innerHTML = '<option value="">-- Pilih Fasilitas Terlebih Dahulu --</option>';

    var selectAngsuran = document.getElementById('pilihAngsuranKe');
    if (selectAngsuran) {
        selectAngsuran.innerHTML = '<option value="">-- Pilih Kontrak Terlebih Dahulu --</option>';
        document.getElementById('divPilihAngsuran').style.display = 'block';
        document.getElementById('pelJenis').value = "Angsuran Bulanan";
    }

    modalPelunasan.show();
}

function toggleAngsuranKe() {
    var jenis = document.getElementById('pelJenis').value;
    var divAngsuran = document.getElementById('divPilihAngsuran');
    if (jenis === "Angsuran Bulanan") {
        divAngsuran.style.display = "block";
    } else {
        divAngsuran.style.display = "none";
        document.getElementById('pilihAngsuranKe').value = "";
    }
}

function muatOspiAngsuranOtomatis() {
    var elemenKontrak = document.getElementById('pelKontrak');
    var selectAngsuran = document.getElementById('pilihAngsuranKe');

    if (!elemenKontrak || !selectAngsuran) return;

    selectAngsuran.innerHTML = '<option value="">-- Pilih Jadwal Angsuran --</option>';

    var idKontrak = elemenKontrak.value;
    if (!idKontrak) return;

    var jadwalTerkait = dbJadwalAngsuran.filter(j => j.id_kontrak === idKontrak && j.status_bayar === "Belum");
    jadwalTerkait.sort((a, b) => a.angsuran_ke - b.angsuran_ke);

    if (jadwalTerkait.length === 0) {
        selectAngsuran.innerHTML = '<option value="">-- Semua Angsuran Telah Lunas --</option>';
        return;
    }

    jadwalTerkait.forEach(j => {
        var opt = document.createElement('option');
        opt.value = j.id_jadwal;
        opt.text = `Angsuran Ke-${j.angsuran_ke} (${j.tgl_jatuh_tempo}) - Pokok: ${j.angsuran_pokok.toLocaleString('id-ID')}`;
        selectAngsuran.appendChild(opt);
    });
}

function isiNominalOtomatis() {
    var idJadwal = document.getElementById('pilihAngsuranKe').value;
    if (!idJadwal) {
        document.getElementById('pelPokok').value = 0;
        document.getElementById('pelBunga').value = 0;
        return;
    }

    var jadwalData = dbJadwalAngsuran.find(j => j.id_jadwal === idJadwal);
    if (jadwalData) {
        document.getElementById('pelPokok').value = Math.round(jadwalData.angsuran_pokok).toLocaleString('id-ID');
        document.getElementById('pelBunga').value = Math.round(jadwalData.angsuran_bunga).toLocaleString('id-ID');
    }
}

function simpanPelunasan() {
    var idFasilitas = document.getElementById('pelIdFasilitas').value;
    var idKontrak = document.getElementById('pelKontrak').value;
    var tglBayar = document.getElementById('pelTglBayar').value;
    var jenis = document.getElementById('pelJenis').value;

    var pokok = parseFloat(document.getElementById('pelPokok').value.replace(/\./g, '')) || 0;
    var bunga = parseFloat(document.getElementById('pelBunga').value.replace(/\./g, '')) || 0;

    if (!idFasilitas || !idKontrak || !tglBayar) {
        Swal.fire('Peringatan', 'Lengkapi pilihan Fasilitas, Kontrak, dan Tanggal Pelunasan!', 'warning'); return;
    }
    if (pokok <= 0 && bunga <= 0) {
        Swal.fire('Peringatan', 'Nominal Pokok atau Bunga yang dibayar harus lebih dari nol!', 'warning'); return;
    }

    let fas = dbMasterFasilitas.find(m => m.id_fasilitas === idFasilitas);
    let totalPenarikan = dbPenarikan.filter(p => p.id_fasilitas === idFasilitas).reduce((sum, p) => sum + p.nilai_penarikan, 0);
    let totalPokokLunas = dbPelunasan.filter(pel => pel.id_fasilitas === idFasilitas).reduce((sum, pel) => sum + pel.pokok_dibayar, 0);
    let osAktif = (fas.baki_debet_awal || 0) + totalPenarikan - totalPokokLunas;

    if (pokok > (osAktif + 1000)) {
        Swal.fire('Error Validasi', `Pembayaran Pokok (${formatRp(pokok)}) melebihi Baki Debet Fasilitas yang tersisa (${formatRp(osAktif)}).`, 'error');
        return;
    }

    var idJadwalYangDilunasi = "";
    if (jenis === "Angsuran Bulanan") {
        var selectAngsuran = document.getElementById('pilihAngsuranKe');
        var idJadwalTerpilih = selectAngsuran ? selectAngsuran.value : null;

        var jadwalDitemukan = null;
        if (idJadwalTerpilih) {
            jadwalDitemukan = dbJadwalAngsuran.find(j => j.id_jadwal === idJadwalTerpilih);
        } else {
            jadwalDitemukan = dbJadwalAngsuran.find(j => j.id_kontrak === idKontrak && (j.status_bayar === "Belum" || j.status_bayar.includes("Menunggak")));
        }

        if (jadwalDitemukan) {
            // PROTEKSI PEMBULATAN ANGSURAN TERAKHIR MENJADI Rp 0 JIKA SISANYA KECIL (< Rp 1.000)
            let sisaPokokBerjalan = jadwalDitemukan.saldo_pokok_awal - pokok;
            if (sisaPokokBerjalan > 0 && sisaPokokBerjalan < 1000) {
                // Otomatis genapkan pokok yang dibayar agar sisa pokok bersih menjadi 0
                pokok += sisaPokokBerjalan;
            }

            jadwalDitemukan.status_bayar = "Lunas";
            idJadwalYangDilunasi = jadwalDitemukan.id_jadwal;
        }
    } else if (jenis === "Dipercepat") {
        dbPenarikan.forEach(p => { if (p.id_kontrak === idKontrak) p.status = "Lunas Dipercepat"; });
        dbJadwalAngsuran.forEach(j => {
            if (j.id_kontrak === idKontrak && j.status_bayar !== "Lunas") j.status_bayar = "Void/Cut-Off";
        });
    }

    let digitKontrak = idKontrak.length >= 4 ? idKontrak.slice(-4) : idKontrak;
    let namaCustClean = "CUST";
    let dataKontrak = dbPenarikan.find(p => p.id_kontrak === idKontrak);
    if (dataKontrak && dataKontrak.nama_customer) {
        namaCustClean = dataKontrak.nama_customer.split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5);
    }

    let singkatanBank = "BANK";
    let dataFasilitas = dbMasterFasilitas.find(m => m.id_fasilitas === idFasilitas);
    if (dataFasilitas && dataFasilitas.kreditur) {
        singkatanBank = dataFasilitas.kreditur.split(" ")[0].toUpperCase().slice(0, 5);
    }

    var idPelunasanGen = `PLNSN-${digitKontrak}-${namaCustClean}-${singkatanBank}`;

    var objPelunasan = {
        id_pelunasan: idPelunasanGen,
        id_fasilitas: idFasilitas,
        id_kontrak: idKontrak,
        tgl_bayar: tglBayar,
        jenis_pelunasan: jenis,
        pokok_dibayar: pokok,
        bunga_dibayar: bunga,
        id_jadwal_terkait: idJadwalYangDilunasi
    };

    // Tampilkan Loading
    Swal.fire({
        title: 'Menyimpan Pelunasan...',
        text: 'Mengupdate database Google Sheets',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // 1. Siapkan payload full sheet untuk tabel Pelunasan
    var pelunasanFullPayload = [["id_pelunasan", "id_fasilitas", "id_kontrak", "tgl_bayar", "jenis_pelunasan", "pokok_dibayar", "bunga_dibayar", "id_jadwal_terkait"]];
    // Masukkan data lama + data baru pelunasan
    let temporaryPelunasanList = [...dbPelunasan, objPelunasan];
    temporaryPelunasanList.forEach(pel => {
        pelunasanFullPayload.push([pel.id_pelunasan, pel.id_fasilitas, pel.id_kontrak, pel.tgl_bayar, pel.jenis_pelunasan, pel.pokok_dibayar, pel.bunga_dibayar, pel.id_jadwal_terkait]);
    });

    // 2. Siapkan payload full sheet untuk tabel Jadwal Angsuran (status lunas / void terupdate)
    var jadwalFullPayload = [["id_jadwal", "id_kontrak", "angsuran_ke", "tgl_jatuh_tempo", "saldo_pokok_awal", "angsuran_pokok", "angsuran_bunga", "status_bayar"]];
    dbJadwalAngsuran.forEach(j => {
        jadwalFullPayload.push([j.id_jadwal, j.id_kontrak, j.angsuran_ke, j.tgl_jatuh_tempo, j.saldo_pokok_awal, j.angsuran_pokok, j.angsuran_bunga, j.status_bayar]);
    });

    // 3. Siapkan payload full sheet untuk tabel Penarikan (jika ada status yang berubah jadi Lunas Dipercepat)
    var penarikanFullPayload = [["id_kontrak", "id_fasilitas", "nama_customer", "nilai_penarikan", "tgl_realisasi", "tenor", "status"]];
    dbPenarikan.forEach(p => {
        penarikanFullPayload.push([p.id_kontrak, p.id_fasilitas, p.nama_customer, p.nilai_penarikan, p.tgl_realisasi, p.tenor, p.status]);
    });

    // Kirim pembaruan berurutan: Update Pelunasan -> Update Jadwal -> Update Penarikan
    fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "update_full_sheet", sheetName: "Pelunasan", dataFull: pelunasanFullPayload })
    })
    .then(() => {
        return fetch(WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "update_full_sheet", sheetName: "jadwal_angsuran", dataFull: jadwalFullPayload })
        });
    })
    .then(() => {
        return fetch(WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "update_full_sheet", sheetName: "Penarikan", dataFull: penarikanFullPayload })
        });
    })
    .then(response => response.json())
    .then(res => {
        if (res.status === "success") {
            dbPelunasan.push(objPelunasan);
            if (modalPelunasan) modalPelunasan.hide();

            Swal.fire('Berhasil', 'Pelunasan berhasil diproses & Cloud Google Sheets diperbarui!', 'success');
            renderData();
            triggerFilterUpdate();
        } else {
            Swal.fire('Error', 'Gagal menyimpan ke Google Sheets: ' + res.message, 'error');
        }
    })
    .catch(err => {
        console.error("Error Pelunasan:", err);
        Swal.fire('Koneksi Gagal', 'Tidak dapat terhubung ke Google Script.', 'error');
    });
}

// ==========================================
// HAPUS PELUNASAN DENGAN DETAIL KONFIRMASI
// ==========================================
// ==========================================
// HAPUS PELUNASAN TERHUBUNG GOOGLE SHEETS
// ==========================================
function hapusPelunasan(idPelunasan) {
    var dataPelunasan = dbPelunasan.find(p => p.id_pelunasan === idPelunasan);
    if (!dataPelunasan) return;

    Swal.fire({
        title: 'Konfirmasi Hapus Pelunasan',
        html: `Apakah Anda yakin ingin menghapus data pelunasan ini?<br><br>
               <b>ID Pelunasan:</b> ${dataPelunasan.id_pelunasan}<br>
               <b>ID Kontrak:</b> ${dataPelunasan.id_kontrak || '-'}<br>
               <b>Tanggal Bayar:</b> ${dataPelunasan.tgl_bayar}<br>
               <b>Pokok:</b> ${formatRp(dataPelunasan.pokok_dibayar)}<br><br>
               <span class="text-danger small">Perhatian: Status jadwal angsuran terkait akan otomatis dikembalikan menjadi 'Belum' lunas dan data dihapus dari Cloud.</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus Data!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            if (dataPelunasan.id_jadwal_terkait) {
                var jadwalTerkait = dbJadwalAngsuran.find(j => j.id_jadwal === dataPelunasan.id_jadwal_terkait);
                if (jadwalTerkait) jadwalTerkait.status_bayar = "Belum";
            }

            dbPelunasan = dbPelunasan.filter(p => p.id_pelunasan !== idPelunasan);

            // Tampilkan Loading
            Swal.fire({
                title: 'Menghapus Pelunasan...',
                text: 'Memperbarui Google Sheets',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // Siapkan payload data terbaru untuk tab Pelunasan dan Jadwal
            var pelunasanFullPayload = [["id_pelunasan", "id_fasilitas", "id_kontrak", "tgl_bayar", "jenis_pelunasan", "pokok_dibayar", "bunga_dibayar", "id_jadwal_terkait"]];
            dbPelunasan.forEach(pel => {
                pelunasanFullPayload.push([pel.id_pelunasan, pel.id_fasilitas, pel.id_kontrak, pel.tgl_bayar, pel.jenis_pelunasan, pel.pokok_dibayar, pel.bunga_dibayar, pel.id_jadwal_terkait]);
            });

            var jadwalFullPayload = [["id_jadwal", "id_kontrak", "angsuran_ke", "tgl_jatuh_tempo", "saldo_pokok_awal", "angsuran_pokok", "angsuran_bunga", "status_bayar"]];
            dbJadwalAngsuran.forEach(j => {
                jadwalFullPayload.push([j.id_jadwal, j.id_kontrak, j.angsuran_ke, j.tgl_jatuh_tempo, j.saldo_pokok_awal, j.angsuran_pokok, j.angsuran_bunga, j.status_bayar]);
            });

            // Kirim pembaruan full sheet ke Google Apps Script
            fetch(WEB_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "update_full_sheet", sheetName: "Pelunasan", dataFull: pelunasanFullPayload })
            })
            .then(() => {
                return fetch(WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "update_full_sheet", sheetName: "jadwal_angsuran", dataFull: jadwalFullPayload })
                });
            })
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    renderData();
                    triggerFilterUpdate();
                    Swal.fire('Terhapus!', 'Data pelunasan berhasil dihapus dari Cloud.', 'success');
                } else {
                    Swal.fire('Error', 'Gagal memperbarui Google Sheets: ' + res.message, 'error');
                }
            })
            .catch(err => {
                console.error("Error Hapus Pelunasan:", err);
                Swal.fire('Koneksi Gagal', 'Tidak dapat terhubung ke Google Script.', 'error');
            });
        }
    });
}

// ==========================================
// EXPORT DATA KE EXCEL
// ==========================================
function exportExcelDashboard() { var elt = document.getElementById('tabelDashboardExport'); XLSX.writeFile(XLSX.utils.table_to_book(elt, { sheet: "Dashboard" }), "Rekap_Dashboard_Funding.xlsx"); }
function exportExcelLaporan() { var elt = document.getElementById('tabelLaporanPelunasanExport'); XLSX.writeFile(XLSX.utils.table_to_book(elt, { sheet: "Laporan_Pelunasan" }), "Laporan_Pelunasan_Periode.xlsx"); }
function exportExcelJadwal() { var elt = document.getElementById('tabelJadwalExport'); XLSX.writeFile(XLSX.utils.table_to_book(elt, { sheet: "Jadwal_Angsuran" }), "Jadwal_Angsuran_Lengkap.xlsx"); }

// ==========================================
// KELOLA MASTER FASILITAS
// ==========================================
var modalMaster;
function bukaModalMasterFasilitas() { if (!modalMaster) modalMaster = new bootstrap.Modal(document.getElementById('modalMasterFasilitas')); resetFormMaster(); renderTabelMasterFasilitas(); modalMaster.show(); }
function resetFormMaster() { document.getElementById('formMasterFasilitas').reset(); document.getElementById('mfId').removeAttribute('readonly'); document.getElementById('mfIsEdit').value = "false"; document.getElementById('modalFormTitle').innerText = "➕ Tambah Master Fasilitas Baru"; }

function simpanMasterFasilitas(e) {
    e.preventDefault();
    var isEdit = document.getElementById('mfIsEdit').value === "true";
    var limitSchedule = parseFloat(document.getElementById('mfLimit').value.replace(/\./g, '')) || 0;
    var bakiDebetAwal = parseFloat(document.getElementById('mfBakiDebetAwal').value.replace(/\./g, '')) || 0;

    var objMaster = {
        id_fasilitas: document.getElementById('mfId').value, kreditur: document.getElementById('mfKreditur').value,
        nama_fasilitas: document.getElementById('mfNama').value, jenis_fasilitas: document.getElementById('mfJenis').value,
        tujuan_fasilitas: document.getElementById('mfTujuan').value, sifat_fasilitas: document.getElementById('mfSifat').value,
        limit_schedule: limitSchedule, baki_debet_awal: bakiDebetAwal, interest_rate: document.getElementById('mfRate').value
    };

    var idx = dbMasterFasilitas.findIndex(m => m.id_fasilitas === objMaster.id_fasilitas);
    if (isEdit) { if (idx > -1) dbMasterFasilitas[idx] = objMaster; Swal.fire('Berhasil', 'Master Fasilitas berhasil diperbarui.', 'success'); }
    else { if (idx > -1) { Swal.fire('Peringatan', 'ID Fasilitas sudah terdaftar!', 'warning'); return; } dbMasterFasilitas.push(objMaster); Swal.fire('Berhasil', 'Master Fasilitas baru disimpan.', 'success'); }

    simpanKeLocalStorage(); resetFormMaster(); renderTabelMasterFasilitas(); renderData(); triggerFilterUpdate();
}

function editMasterFasilitas(idFasilitas) {
    var fas = dbMasterFasilitas.find(m => m.id_fasilitas === idFasilitas); if (!fas) return;
    document.getElementById('mfId').value = fas.id_fasilitas; document.getElementById('mfId').setAttribute('readonly', true);
    document.getElementById('mfKreditur').value = fas.kreditur; document.getElementById('mfNama').value = fas.nama_fasilitas;
    document.getElementById('mfJenis').value = fas.jenis_fasilitas; document.getElementById('mfTujuan').value = fas.tujuan_fasilitas || '';
    document.getElementById('mfSifat').value = fas.sifat_fasilitas; document.getElementById('mfLimit').value = new Intl.NumberFormat('id-ID').format(fas.limit_schedule);
    document.getElementById('mfBakiDebetAwal').value = new Intl.NumberFormat('id-ID').format(fas.baki_debet_awal || 0);
    document.getElementById('mfRate').value = fas.interest_rate; document.getElementById('mfIsEdit').value = "true";
    document.getElementById('modalFormTitle').innerText = "✏️ Edit Master Fasilitas: " + idFasilitas;
}

function hapusMasterFasilitas(idFasilitas) {
    Swal.fire({ title: 'Hapus Master Fasilitas?', text: "Fasilitas akan dihapus!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!' }).then((result) => {
        if (result.isConfirmed) { dbMasterFasilitas = dbMasterFasilitas.filter(m => m.id_fasilitas !== idFasilitas); simpanKeLocalStorage(); renderTabelMasterFasilitas(); renderData(); triggerFilterUpdate(); Swal.fire('Terhapus!', 'Fasilitas dihapus.', 'success'); }
    });
}

function renderTabelMasterFasilitas() {
    var tbody = document.getElementById('tBodyMasterFasilitas'); if (!tbody) return; tbody.innerHTML = "";
    dbMasterFasilitas.forEach(m => {
        tbody.innerHTML += `<tr><td><b>${m.id_fasilitas}</b></td><td>${m.kreditur}</td><td>${m.jenis_fasilitas || '-'} <br><small class="text-muted">${m.nama_fasilitas || '-'}</small></td><td>${m.tujuan_fasilitas || '-'}</td><td>${m.sifat_fasilitas}</td><td>${m.interest_rate || '-'}</td><td class="text-end">${formatRp(m.limit_schedule)}</td><td class="text-end text-primary fw-bold">${formatRp(m.baki_debet_awal)}</td><td class="text-center"><button class="btn btn-warning btn-sm py-0 px-2 me-1" onclick="editMasterFasilitas('${m.id_fasilitas}')">✏️</button><button class="btn btn-danger btn-sm py-0 px-2" onclick="hapusMasterFasilitas('${m.id_fasilitas}')">🗑️</button></td></tr>`;
    });
}

// ==========================================
// UPLOAD KARTU PIUTANG DENGAN VALIDASI KONTRAK GANDA (POIN 2)
// ==========================================
// ==========================================
// HAPUS PENARIKAN / KONTRAK TERHUBUNG GOOGLE SHEETS
// ==========================================
function hapusPenarikan(idKontrak) {
    var dataPenarikan = dbPenarikan.find(p => p.id_kontrak === idKontrak);
    if (!dataPenarikan) return;

    Swal.fire({
        title: 'Konfirmasi Hapus Kontrak / Penarikan',
        html: `Apakah Anda yakin ingin menghapus kontrak ini?<br><br>
               <b>ID Kontrak:</b> ${dataPenarikan.id_kontrak}<br>
               <b>Customer:</b> ${dataPenarikan.nama_customer}<br>
               <b>Nilai Penarikan:</b> ${formatRp(dataPenarikan.nilai_penarikan)}<br><br>
               <span class="text-danger small">Peringatan: Seluruh Jadwal Angsuran dan data penarikan kontrak ini akan terhapus permanen dari Cloud!</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus Kontrak!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            dbPenarikan = dbPenarikan.filter(p => p.id_kontrak !== idKontrak);
            dbJadwalAngsuran = dbJadwalAngsuran.filter(j => j.id_kontrak !== idKontrak);

            Swal.fire({
                title: 'Menghapus Kontrak...',
                text: 'Memperbarui Google Sheets',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            var penarikanFullPayload = [["id_kontrak", "id_fasilitas", "nama_customer", "nilai_penarikan", "tgl_realisasi", "tenor", "status"]];
            dbPenarikan.forEach(p => {
                penarikanFullPayload.push([p.id_kontrak, p.id_fasilitas, p.nama_customer, p.nilai_penarikan, p.tgl_realisasi, p.tenor, p.status]);
            });

            var jadwalFullPayload = [["id_jadwal", "id_kontrak", "angsuran_ke", "tgl_jatuh_tempo", "saldo_pokok_awal", "angsuran_pokok", "angsuran_bunga", "status_bayar"]];
            dbJadwalAngsuran.forEach(j => {
                jadwalFullPayload.push([j.id_jadwal, j.id_kontrak, j.angsuran_ke, j.tgl_jatuh_tempo, j.saldo_pokok_awal, j.angsuran_pokok, j.angsuran_bunga, j.status_bayar]);
            });

            fetch(WEB_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "update_full_sheet", sheetName: "Penarikan", dataFull: penarikanFullPayload })
            })
            .then(() => {
                return fetch(WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "update_full_sheet", sheetName: "jadwal_angsuran", dataFull: jadwalFullPayload })
                });
            })
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    renderData();
                    triggerFilterUpdate();
                    Swal.fire('Terhapus!', 'Data kontrak dan jadwal berhasil dihapus dari Cloud.', 'success');
                } else {
                    Swal.fire('Error', 'Gagal memperbarui Google Sheets: ' + res.message, 'error');
                }
            })
            .catch(err => {
                console.error("Error Hapus Penarikan:", err);
                Swal.fire('Koneksi Gagal', 'Tidak dapat terhubung ke Google Script.', 'error');
            });
        }
    });
}

function prosesUploadKartu() {
    var fileInput = document.getElementById('fileKartuPiutang');
    var selectedFasilitas = document.getElementById('pilihFasilitasUpload').value;

    var elemIdManual = document.getElementById('idKontrakManual');
    var idKontrakManual = elemIdManual ? elemIdManual.value.trim() : "";

    if (!selectedFasilitas) { Swal.fire('Peringatan', 'Pilih Fasilitas tujuan!', 'warning'); return; }
    if (!fileInput.files.length) { Swal.fire('Error', 'Pilih file Excel Kartu Piutang!', 'error'); return; }

    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            var worksheet = workbook.Sheets[workbook.SheetNames[0]];
            var excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            var namaCustomer = "Tidak Diketahui";
            var idKontrakGen = idKontrakManual ? idKontrakManual : "KONTRAK-" + Math.floor(1000 + Math.random() * 9000);
            var nilaiPenarikan = 0, tenor = 0, bungaEffResult = "7.00%", tglRealisasi = new Date().toISOString().split('T')[0];

            for (var i = 0; i < Math.min(25, excelData.length); i++) {
                var row = excelData[i]; if (!row) continue;
                for (var c = 0; c < row.length; c++) {
                    let cellStr = row[c] ? row[c].toString().trim() : "";
                    if (cellStr.length > 3) {
                        if (cellStr.includes("'")) {
                            let parts = cellStr.split("'");
                            namaCustomer = parts[0].replace(/nama\s*:/i, "").trim();
                            if (!idKontrakManual && parts.length > 1) idKontrakGen = parts[1].trim();
                        }
                        else if (cellStr.toLowerCase().includes("nama :")) {
                            namaCustomer = cellStr.replace(/nama\s*:/i, "").trim() || (row[c + 1] ? row[c + 1].toString().trim() : "");
                        }
                        else if (namaCustomer === "Tidak Diketahui" && !cellStr.includes("Pokok") && !cellStr.includes("Jatuh") && !cellStr.includes("Angsuran") && !cellStr.includes("Tenor")) {
                            namaCustomer = cellStr;
                        }
                    }
                }

                let rowText = row.filter(cell => cell != null && cell.toString().trim() !== "").join(" ");
                if ((rowText.includes("Pokok") || rowText.includes("Plafond")) && !rowText.includes("Angs")) {
                    for (var c = 0; c < row.length; c++) if (row[c] && !isNaN(parseFloat(row[c])) && parseFloat(row[c]) > 1000) { nilaiPenarikan = parseFloat(row[c]); break; }
                }
                if (rowText.includes("Jk. Waktu") || rowText.includes("Tenor")) {
                    for (var c = 0; c < row.length; c++) if (row[c] && !isNaN(parseInt(row[c])) && parseInt(row[c]) > 0 && parseInt(row[c]) < 1000) { tenor = parseInt(row[c]); break; }
                }
                if (rowText.includes("Realisasi")) {
                    for (var c = 0; c < row.length; c++) {
                        if (row[c]) {
                            if (typeof row[c] === 'number') { tglRealisasi = new Date(Math.round((row[c] - 25569) * 86400 * 1000)).toISOString().split('T')[0]; break; }
                            else if (row[c].toString().includes("-") || row[c].toString().includes("/")) { try { tglRealisasi = new Date(row[c]).toISOString().split('T')[0]; break; } catch (e) { } }
                        }
                    }
                }
            }

            // CEK VALIDASI KONTRAK GANDA (POIN 2)
            var isKontrakSudahAda = dbPenarikan.some(p => p.id_kontrak === idKontrakGen);
            if (isKontrakSudahAda) {
                Swal.fire('Gagal Upload', `ID Kontrak "${idKontrakGen}" sudah terdaftar di sistem! Harap gunakan ID manual lain atau periksa kembali file Excel.`, 'error');
                return;
            }

            var objJadwalArray = [], totalPokokJadwal = 0;
            for (var k = 8; k < excelData.length; k++) {
                var rowAngsuran = excelData[k];
                if (!rowAngsuran || rowAngsuran.length < 4) continue;
                var colAngsuran = -1;
                if (!isNaN(parseInt(rowAngsuran[0])) && parseInt(rowAngsuran[0]) > 0) colAngsuran = 0;
                else if (!isNaN(parseInt(rowAngsuran[1])) && parseInt(rowAngsuran[1]) > 0) colAngsuran = 1;
                if (colAngsuran === -1) continue;

                var cellDate = rowAngsuran[colAngsuran + 1];
                if (typeof cellDate === 'number') cellDate = new Date(Math.round((cellDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                else if (cellDate) { try { cellDate = new Date(cellDate).toISOString().split('T')[0]; } catch (e) { } }

                var pokokBulanIni = parseFloat(rowAngsuran[colAngsuran + 3]) || 0;

                var statusExcel = rowAngsuran[colAngsuran + 6] ? rowAngsuran[colAngsuran + 6].toString().trim() : "Belum";
                if (statusExcel.toLowerCase().includes("lunas") || statusExcel.toLowerCase().includes("sudah")) {
                    statusExcel = "Lunas";
                } else {
                    statusExcel = "Belum";
                }

                objJadwalArray.push({
                    id_jadwal: idKontrakGen + "-A" + parseInt(rowAngsuran[colAngsuran]),
                    id_kontrak: idKontrakGen,
                    angsuran_ke: parseInt(rowAngsuran[colAngsuran]),
                    tgl_jatuh_tempo: cellDate || "-",
                    saldo_pokok_awal: parseFloat(rowAngsuran[colAngsuran + 2]) || 0,
                    angsuran_pokok: pokokBulanIni,
                    angsuran_bunga: parseFloat(rowAngsuran[colAngsuran + 4]) || 0,
                    status_bayar: statusExcel
                });
                totalPokokJadwal += pokokBulanIni;
            }

            if (nilaiPenarikan === 0 && totalPokokJadwal > 0) nilaiPenarikan = Math.round(totalPokokJadwal);

            dbPenarikan.push({ id_kontrak: idKontrakGen, id_fasilitas: selectedFasilitas, nama_customer: namaCustomer, nilai_penarikan: nilaiPenarikan, tgl_realisasi: tglRealisasi, tenor: tenor, bunga_efektif: bungaEffResult, status: "Aktif", link_bukti: fileInput.files[0].name });
            dbJadwalAngsuran = dbJadwalAngsuran.concat(objJadwalArray);

            // ================= KODE CLOUD UPLOAD BARU =================
            // 1. Siapkan 1 baris data Penarikan sesuai urutan kolom Google Sheets
            var rowPenarikanData = [idKontrakGen, selectedFasilitas, namaCustomer, nilaiPenarikan, tglRealisasi, tenor, "Aktif"];
            
            // 2. Siapkan puluhan baris Jadwal Angsuran menjadi format matriks (Bulk Insert)
            var multiRowJadwalData = objJadwalArray.map(j => [
                j.id_jadwal, j.id_kontrak, j.angsuran_ke, j.tgl_jatuh_tempo, j.saldo_pokok_awal, j.angsuran_pokok, j.angsuran_bunga, j.status_bayar
            ]);

            // 3. Tampilkan efek Loading
            Swal.fire({
                title: 'Mengunggah Data...',
                text: 'Sedang menyimpan ratusan baris ke Google Sheets. Mohon tunggu.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // 4. Proses tembak data ke Google Apps Script
            fetch(WEB_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "upload_excel",
                    dataPenarikan: rowPenarikanData,
                    dataJadwal: multiRowJadwalData
                })
            })
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    // Masukkan ke memori web agar tabel langsung muncul tanpa perlu refresh
                    dbPenarikan.push({ id_kontrak: idKontrakGen, id_fasilitas: selectedFasilitas, nama_customer: namaCustomer, nilai_penarikan: nilaiPenarikan, tgl_realisasi: tglRealisasi, tenor: tenor, status: "Aktif" });
                    dbJadwalAngsuran = dbJadwalAngsuran.concat(objJadwalArray);

                    Swal.fire('Berhasil!', 'Data Penarikan (' + idKontrakGen + ') sukses di-upload ke Database!', 'success');
                    
                    fileInput.value = "";
                    if (elemIdManual) elemIdManual.value = "";
                    renderData(); triggerFilterUpdate();
                } else {
                    Swal.fire('Error Database', 'Gagal menyimpan ke Sheet: ' + res.message, 'error');
                }
            })
            .catch(error => {
                console.error("Error Upload:", error);
                Swal.fire('Error Koneksi', 'Gagal terhubung ke Google Script.', 'error');
            });
            // ================= END KODE CLOUD UPLOAD =================
        } catch (err) { Swal.fire('Error', 'Gagal membaca Excel: ' + err.message, 'error'); }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

document.addEventListener("DOMContentLoaded", function () {
    cekStatusLogin(); // Periksa apakah pengguna sudah login
    
    // ... (kode loading SweetAlert dan fetch data Google Sheets di bawahnya tetap sama)
    // Munculkan loading agar pengguna tahu web sedang mengambil data
    Swal.fire({
        title: 'Sinkronisasi Database...',
        text: 'Mengambil data dari Google Sheets',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // Proses sedot data dari Google Sheets
    fetch(WEB_APP_URL)
        .then(response => response.json())
        .then(data => {
            // Fungsi penerjemah: Mengubah teks dari Google Sheets kembali jadi Angka murni
            // Fungsi penerjemah yang sudah diperbaiki untuk membaca desimal
            function parseAngka(val) {
                if (!val) return 0;
                if (typeof val === 'number') return val;
                // Tambahkan tanda titik (.) di sebelah \d agar desimal tidak dihapus
                let numStr = val.toString().replace(/[^\d.]/g, ''); 
                return parseFloat(numStr) || 0;
            }

            // Memasukkan data ke variabel aplikasi & Menerjemahkan angka-angkanya
            dbMasterFasilitas = (data.dbMasterFasilitas || []).map(m => {
                m.limit_schedule = parseAngka(m.limit_schedule);
                m.baki_debet_awal = parseAngka(m.baki_debet_awal);
                return m;
            });
            
            dbPenarikan = (data.dbPenarikan || []).map(p => {
                p.nilai_penarikan = parseAngka(p.nilai_penarikan);
                p.tenor = parseAngka(p.tenor);
                return p;
            });
            
            dbJadwalAngsuran = (data.dbJadwalAngsuran || []).map(j => {
                j.angsuran_pokok = parseAngka(j.angsuran_pokok);
                j.angsuran_bunga = parseAngka(j.angsuran_bunga);
                j.saldo_pokok_awal = parseAngka(j.saldo_pokok_awal);
                j.angsuran_ke = parseAngka(j.angsuran_ke);
                return j;
            });
            
            dbPelunasan = (data.dbPelunasan || []).map(p => {
                p.pokok_dibayar = parseAngka(p.pokok_dibayar);
                p.bunga_dibayar = parseAngka(p.bunga_dibayar);
                return p;
            });

            Swal.close(); // Tutup loading
            renderData(); // Tampilkan ke tabel
            triggerFilterUpdate(); // Update kalkulasi dashboard
        })
        .catch(error => {
            console.error("Error Fetch:", error);
            Swal.fire('Koneksi Gagal', 'Gagal memuat data dari Google Sheets.', 'error');
        });
});
// FUNGSI DEBOUNCE AGAR PENCARIAN TIDAK BERAT / LEMOT
let timerCari;
function debounceCariPenarikan() {
    clearTimeout(timerCari);
    timerCari = setTimeout(() => {
        renderData();
    }, 300); // Jeda 300 milidetik setelah ketikan terakhir berhenti
}