/* =======================================================
   app-funding.js - Logika Sistem Pendanaan (Funding)
   Versi: Dengan Otomatisasi Status Lunas Jadwal Angsuran
   ======================================================= */

var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxlYe6zzOIho-5b6ri-AFmwz3F15LhE8d6PUyECwj5Qmb44L9cNIhhS3V4ut2Svueif/exec";

var dbMasterFasilitas = JSON.parse(localStorage.getItem('db_master_fasilitas')) || [];
var dbPenarikan = JSON.parse(localStorage.getItem('db_penarikan')) || [];
var dbJadwalAngsuran = JSON.parse(localStorage.getItem('db_jadwal_angsuran')) || [];
var dbPelunasan = JSON.parse(localStorage.getItem('db_pelunasan')) || [];

function simpanKeLocalStorage() {
    localStorage.setItem('db_master_fasilitas', JSON.stringify(dbMasterFasilitas));
    localStorage.setItem('db_penarikan', JSON.stringify(dbPenarikan));
    localStorage.setItem('db_jadwal_angsuran', JSON.stringify(dbJadwalAngsuran));
    localStorage.setItem('db_pelunasan', JSON.stringify(dbPelunasan));
    syncToGoogleSheet();
}

function syncToGoogleSheet() {
    if (!WEB_APP_URL) return;
    var masterDataPayload = [["id_fasilitas", "kreditur", "nama_fasilitas", "tujuan_fasilitas", "sifat_fasilitas", "limit_schedule", "baki_debet_awal", "interest_rate"]];
    dbMasterFasilitas.forEach(m => masterDataPayload.push([m.id_fasilitas, m.kreditur, m.nama_fasilitas || '', m.tujuan_fasilitas || '', m.sifat_fasilitas, m.limit_schedule, m.baki_debet_awal || 0, m.interest_rate || '']));
    fetch(WEB_APP_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", sheetName: "master_fasilitas", payload: masterDataPayload }) });
}

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

function triggerFilterUpdate() { renderDashboard(); renderLaporanPeriode(); }

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

    // TABEL JADWAL ANGSURAN
    var tbodyJadwal = document.getElementById('tBodyJadwal');
    if (tbodyJadwal) {
        tbodyJadwal.innerHTML = "";
        let today = new Date().toISOString().split('T')[0];

        dbJadwalAngsuran.forEach(j => {
            let currentStatus = j.status_bayar;
            if (currentStatus === "Belum" && j.tgl_jatuh_tempo !== "-" && j.tgl_jatuh_tempo < today) currentStatus = "Menunggak";

            let badgeColor = "bg-warning text-dark";
            if (currentStatus === "Lunas") badgeColor = "bg-success";
            else if (currentStatus === "Menunggak") badgeColor = "bg-danger";
            else if (currentStatus.includes("Void")) badgeColor = "bg-secondary";

            tbodyJadwal.innerHTML += `<tr><td>${j.id_kontrak}</td><td>${j.angsuran_ke}</td><td>${j.tgl_jatuh_tempo}</td><td>${formatRp(j.saldo_pokok_awal)}</td><td>${formatRp(j.angsuran_pokok)}</td><td>${formatRp(j.angsuran_bunga)}</td><td><span class="badge ${badgeColor}">${currentStatus}</span></td></tr>`;
        });
    }

    // TABEL PENARIKAN
    var tbodyPenarikan = document.getElementById('tBodyPenarikan');
    if (tbodyPenarikan) {
        tbodyPenarikan.innerHTML = "";
        dbPenarikan.forEach(p => {
            tbodyPenarikan.innerHTML += `<tr><td>${p.id_kontrak}</td><td>${p.id_fasilitas}</td><td>${p.nama_customer}</td><td>${p.tgl_realisasi}</td><td>${formatRp(p.nilai_penarikan)}</td><td>${p.tenor} Bln</td><td><span class="badge ${p.status.includes('Lunas') ? 'bg-success' : 'bg-primary'}">${p.status}</span></td><td class="text-center"><button class="btn btn-danger btn-sm py-0 px-2" onclick="hapusPenarikan('${p.id_kontrak}')">🗑️ Hapus</button></td></tr>`;
        });
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
    var dropdownKontrak = document.getElementById('pelIdKontrak');

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
}

// ==========================================
// MODAL PELUNASAN & SIMPAN
// ==========================================
var modalPelunasan;
function bukaModalPelunasan() {
    if (!modalPelunasan) modalPelunasan = new bootstrap.Modal(document.getElementById('modalInputPelunasan'));
    document.getElementById('pelPokok').value = '';
    document.getElementById('pelBunga').value = '';
    document.getElementById('pelIdKontrak').innerHTML = '<option value="">-- Pilih Fasilitas Terlebih Dahulu --</option>';
    modalPelunasan.show();
}

function simpanPelunasan() {
    var idFasilitas = document.getElementById('pelIdFasilitas').value;
    var idKontrak = document.getElementById('pelIdKontrak').value;
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
        Swal.fire('Error Validasi', `Pembayaran Pokok (${formatRp(pokok)}) melebih Baki Debet Fasilitas yang tersisa (${formatRp(osAktif)}). Harap periksa kembali.`, 'error');
        return;
    }

    // UPDATE STATUS JADWAL ANGSURAN OTOMATIS
    if (jenis === "Angsuran Bulanan") {
        // Cari jadwal angsuran pertama yang masih "Belum" atau "Menunggak" untuk kontrak ini
        var jadwalDitemukan = dbJadwalAngsuran.find(j => j.id_kontrak === idKontrak && (j.status_bayar === "Belum" || j.status_bayar === "Menunggak"));
        if (jadwalDitemukan) {
            jadwalDitemukan.status_bayar = "Lunas";
        } else {
            Swal.fire('Info', 'Tidak ada jadwal angsuran yang berstatus Belum/Menunggak untuk kontrak ini. Status pelunasan tercatat namun tidak ada jadwal yang diubah.', 'info');
        }
    } else if (jenis === "Dipercepat") {
        dbPenarikan.forEach(p => { if (p.id_kontrak === idKontrak) p.status = "Lunas Dipercepat"; });
        dbJadwalAngsuran.forEach(j => {
            if (j.id_kontrak === idKontrak && j.status_bayar !== "Lunas") j.status_bayar = "Void/Cut-Off";
        });
    }

    // SIMPAN RIWAYAT PELUNASAN
    var objPelunasan = {
        id_pelunasan: "PLN-" + new Date().getTime(),
        id_fasilitas: idFasilitas,
        id_kontrak: idKontrak,
        tgl_bayar: tglBayar,
        jenis_pelunasan: jenis,
        pokok_dibayar: pokok,
        bunga_dibayar: bunga
    };
    dbPelunasan.push(objPelunasan);

    simpanKeLocalStorage();
    if (modalPelunasan) modalPelunasan.hide();

    Swal.fire('Berhasil', 'Pelunasan berhasil diproses & Jadwal Angsuran diperbarui!', 'success');
    renderData();
    triggerFilterUpdate();
}

function hapusPelunasan(idPelunasan) {
    Swal.fire({
        title: 'Hapus Transaksi Pelunasan?',
        text: "Data pembayaran ini akan dihapus. Perhatian: Status Jadwal Angsuran yang sebelumnya 'Lunas' harus Anda ubah manual jika ingin dikembalikan.",
        icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!'
    }).then((result) => {
        if (result.isConfirmed) {
            dbPelunasan = dbPelunasan.filter(p => p.id_pelunasan !== idPelunasan);
            simpanKeLocalStorage(); renderData(); triggerFilterUpdate();
            Swal.fire('Terhapus!', 'Data pelunasan berhasil dihapus.', 'success');
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
// UPLOAD KARTU PIUTANG
// ==========================================
function hapusPenarikan(idKontrak) {
    Swal.fire({ title: 'Hapus Data Kontrak?', text: "Kontrak & jadwal angsuran akan dihapus!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!' }).then((result) => {
        if (result.isConfirmed) { dbPenarikan = dbPenarikan.filter(p => p.id_kontrak !== idKontrak); dbJadwalAngsuran = dbJadwalAngsuran.filter(j => j.id_kontrak !== idKontrak); simpanKeLocalStorage(); renderData(); triggerFilterUpdate(); Swal.fire('Terhapus!', 'Data kontrak dihapus.', 'success'); }
    });
}

function prosesUploadKartu() {
    var fileInput = document.getElementById('fileKartuPiutang'); var selectedFasilitas = document.getElementById('pilihFasilitasUpload').value;
    if (!selectedFasilitas) { Swal.fire('Peringatan', 'Pilih Fasilitas tujuan!', 'warning'); return; }
    if (!fileInput.files.length) { Swal.fire('Error', 'Pilih file Excel Kartu Piutang!', 'error'); return; }

    var reader = new FileReader();
    reader.onload = function (e) {
        try {
            var data = new Uint8Array(e.target.result); var workbook = XLSX.read(data, { type: 'array' }); var worksheet = workbook.Sheets[workbook.SheetNames[0]]; var excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            var namaCustomer = "Tidak Diketahui", idKontrakGen = "KONTRAK-" + Math.floor(1000 + Math.random() * 9000);
            var nilaiPenarikan = 0, tenor = 0, bungaEffResult = "7.00%", tglRealisasi = new Date().toISOString().split('T')[0];

            for (var i = 0; i < Math.min(25, excelData.length); i++) {
                var row = excelData[i]; if (!row) continue;
                for (var c = 0; c < row.length; c++) {
                    let cellStr = row[c] ? row[c].toString().trim() : "";
                    if (cellStr.includes("Nama :")) {
                        let parts = (cellStr.replace("Nama :", "").trim() || (row[c + 1] ? row[c + 1].toString().trim() : "")).split("'");
                        namaCustomer = parts[0].trim(); if (parts.length > 1) idKontrakGen = parts[1].trim();
                    }
                }
                let rowText = row.filter(cell => cell != null && cell.toString().trim() !== "").join(" ");
                if ((rowText.includes("Pokok") || rowText.includes("Plafond")) && !rowText.includes("Angs")) { for (var c = 0; c < row.length; c++) if (row[c] && !isNaN(parseFloat(row[c])) && parseFloat(row[c]) > 1000) { nilaiPenarikan = parseFloat(row[c]); break; } }
                if (rowText.includes("Jk. Waktu") || rowText.includes("Tenor")) { for (var c = 0; c < row.length; c++) if (row[c] && !isNaN(parseInt(row[c])) && parseInt(row[c]) > 0 && parseInt(row[c]) < 1000) { tenor = parseInt(row[c]); break; } }
                if (rowText.includes("Realisasi")) {
                    for (var c = 0; c < row.length; c++) {
                        if (row[c]) {
                            if (typeof row[c] === 'number') { tglRealisasi = new Date(Math.round((row[c] - 25569) * 86400 * 1000)).toISOString().split('T')[0]; break; }
                            else if (row[c].toString().includes("-") || row[c].toString().includes("/")) { try { tglRealisasi = new Date(row[c]).toISOString().split('T')[0]; break; } catch (e) { } }
                        }
                    }
                }
            }

            var objJadwalArray = [], totalPokokJadwal = 0;
            for (var k = 8; k < excelData.length; k++) {
                var rowAngsuran = excelData[k]; if (!rowAngsuran || rowAngsuran.length < 4) continue;
                var colAngsuran = -1;
                if (!isNaN(parseInt(rowAngsuran[0])) && parseInt(rowAngsuran[0]) > 0) colAngsuran = 0;
                else if (!isNaN(parseInt(rowAngsuran[1])) && parseInt(rowAngsuran[1]) > 0) colAngsuran = 1;
                if (colAngsuran === -1) continue;

                var cellDate = rowAngsuran[colAngsuran + 1];
                if (typeof cellDate === 'number') cellDate = new Date(Math.round((cellDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                else if (cellDate) { try { cellDate = new Date(cellDate).toISOString().split('T')[0]; } catch (e) { } }

                var pokokBulanIni = parseFloat(rowAngsuran[colAngsuran + 3]) || 0;
                var statusExcel = rowAngsuran[colAngsuran + 6] ? rowAngsuran[colAngsuran + 6].toString().trim() : "Belum";
                if (statusExcel.toLowerCase().includes("lunas") || statusExcel.toLowerCase().includes("sudah")) { statusExcel = "Lunas"; } else { statusExcel = "Belum"; }

                objJadwalArray.push({
                    id_jadwal: idKontrakGen + "-A" + parseInt(rowAngsuran[colAngsuran]), id_kontrak: idKontrakGen,
                    angsuran_ke: parseInt(rowAngsuran[colAngsuran]), tgl_jatuh_tempo: cellDate || "-",
                    saldo_pokok_awal: parseFloat(rowAngsuran[colAngsuran + 2]) || 0, angsuran_pokok: pokokBulanIni,
                    angsuran_bunga: parseFloat(rowAngsuran[colAngsuran + 4]) || 0, status_bayar: statusExcel
                });
                totalPokokJadwal += pokokBulanIni;
            }

            if (nilaiPenarikan === 0 && totalPokokJadwal > 0) nilaiPenarikan = Math.round(totalPokokJadwal);
            dbPenarikan.push({ id_kontrak: idKontrakGen, id_fasilitas: selectedFasilitas, nama_customer: namaCustomer, nilai_penarikan: nilaiPenarikan, tgl_realisasi: tglRealisasi, tenor: tenor, bunga_efektif: bungaEffResult, status: "Aktif", link_bukti: fileInput.files[0].name });
            dbJadwalAngsuran = dbJadwalAngsuran.concat(objJadwalArray);

            simpanKeLocalStorage(); Swal.fire('Berhasil!', 'Data Penarikan diekstrak.', 'success');
            fileInput.value = ""; renderData(); triggerFilterUpdate();
        } catch (err) { Swal.fire('Error', 'Gagal membaca Excel: ' + err.message, 'error'); }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

document.addEventListener("DOMContentLoaded", function () { renderData(); triggerFilterUpdate(); });