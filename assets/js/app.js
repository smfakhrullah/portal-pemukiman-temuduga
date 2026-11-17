/**
 * ============================================================================
 * PORTAL UJIAN PEMUKIMAN TEMU DUGA SESI 2027 — LOGIK FRONTEND UTAMA (app.js)
 * ============================================================================
 */

(function () {
  'use strict';

  const CONFIG = window.PORTAL_CONFIG;

  // State Aplikasi
  let state = {
    mode: '',               // 'AKADEMIK' atau 'PERSONALITI'
    nama: '',
    no_kp: '',
    angka_giliran: '',
    kumpulan: '',
    login_time: '',
    links: {},
    completedSubjects: new Set(),
    activeSubject: null,
    isFullscreen: false
  };

  // State Panel Urus Setia (Admin)
  let adminState = {
    password: '',
    candidates: [],
    groups: [],
    stats: null,
    fetchedAt: ''
  };

  // ==========================================================================
  // 1. INISIALISASI & PEMULIHAN SESI (SESSION PERSISTENCE)
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', function () {
    refreshIcons();
    setupInputFormatting();
    checkDemoBanner();
    restoreSessionFromStorage();
  });

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function isApiConfigured() {
    const url = (CONFIG.GAS_WEB_APP_URL || '').trim();
    return url.startsWith('https://script.google.com/macros/s/');
  }

  function checkDemoBanner() {
    const demoBanner = document.getElementById('demoModeBanner');
    if (!demoBanner) return;
    if (!isApiConfigured() && CONFIG.ENABLE_DEMO_WHEN_UNCONFIGURED) {
      demoBanner.classList.remove('hidden');
    } else {
      demoBanner.classList.add('hidden');
    }
  }

  function setupInputFormatting() {
    const icInput = document.getElementById('icInput');
    const icCounter = document.getElementById('icDigitCount');
    if (icInput) {
      icInput.addEventListener('input', function () {
        const digitsOnly = this.value.replace(/[^0-9]/g, '').slice(0, 12);
        if (this.value !== digitsOnly) {
          this.value = digitsOnly;
        }
        if (icCounter) {
          icCounter.innerText = `${digitsOnly.length}/12 digit`;
          icCounter.className = digitsOnly.length === 12
            ? 'text-[11px] font-bold text-green-600'
            : 'text-[11px] font-medium text-slate-400';
        }
      });
    }
  }

  function saveSessionToStorage() {
    if (!state.no_kp || !state.mode) return;
    const payload = {
      mode: state.mode,
      nama: state.nama,
      no_kp: state.no_kp,
      angka_giliran: state.angka_giliran,
      kumpulan: state.kumpulan,
      login_time: state.login_time,
      links: state.links,
      completed_subjects: Array.from(state.completedSubjects),
      saved_at: new Date().toISOString()
    };
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Gagal menyimpan sesi ke localStorage:', err);
    }
  }

  function restoreSessionFromStorage() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.no_kp && saved.mode && saved.links) {
        applyLoginData({
          status: 'BERJAYA',
          mode: saved.mode,
          nama: saved.nama,
          no_kp: saved.no_kp,
          angka_giliran: saved.angka_giliran,
          kumpulan: saved.kumpulan,
          login_time: saved.login_time || 'Sesi Dipulihkan',
          data_ujian: { links: saved.links },
          completed_subjects: saved.completed_subjects || []
        }, true);
      }
    } catch (err) {
      console.warn('Gagal memulihkan sesi:', err);
      localStorage.removeItem(CONFIG.STORAGE_KEY);
    }
  }

  // ==========================================================================
  // 2. KOMUNIKASI API (FETCH KE GOOGLE APPS SCRIPT / DEMO FALLBACK)
  // ==========================================================================
  async function callBackendApi(payload) {
    if (!isApiConfigured()) {
      if (CONFIG.ENABLE_DEMO_WHEN_UNCONFIGURED) {
        return simulateDemoBackend(payload);
      }
      throw new Error('URL Web App Google Apps Script belum ditetapkan dalam assets/js/config.js');
    }

    const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        // Penting: Gunakan text/plain bagi mengelakkan ralat CORS Preflight OPTIONS pada Google Apps Script
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    return await response.json();
  }

  // ==========================================================================
  // 3. PENGENDALIAN LOG MASUK CALON
  // ==========================================================================
  window.handleLogin = async function (e) {
    e.preventDefault();
    const icInput = document.getElementById('icInput').value;
    const passInput = document.getElementById('passInput').value;
    const cleanIC = icInput.replace(/[^0-9]/g, '');
    const cleanPass = passInput.trim();

    hideError();

    if (cleanIC.length < 6) {
      showError('Sila masukkan No. Kad Pengenalan yang sah (sekurang-kurangnya 6 digit).');
      return;
    }
    if (cleanPass.length < 1) {
      showError('Sila masukkan Kata Laluan Ujian.');
      return;
    }

    setLoading(true);
    try {
      const data = await callBackendApi({
        action: 'login',
        no_kp: cleanIC,
        password: cleanPass
      });
      onLoginResponse(data);
    } catch (err) {
      console.error('Ralat Log Masuk:', err);
      setLoading(false);
      showError('Gagal menghubungi pelayan. Sila periksa sambungan internet atau konfigurasi API anda.');
    }
  };

  function onLoginResponse(data) {
    setLoading(false);
    if (!data) {
      showError('Tiada respons daripada pelayan.');
      return;
    }

    if (data.status === 'BERJAYA') {
      applyLoginData(data, false);
    } else if (data.status === 'GAGAL_PASSWORD') {
      showError('Kata Laluan Ujian salah. Sila semak semula bersama urus setia.');
    } else if (data.status === 'GAGAL_IC') {
      showError('No. Kad Pengenalan tidak ditemui dalam pangkalan data calon.');
    } else if (data.status === 'ERROR_SHEET') {
      showError('Ralat pangkalan data: Helaian DATABASE atau UJIAN AKADEMIK tidak ditemui.');
    } else if (data.status === 'ERROR_CONFIG') {
      showError(data.message || 'Konfigurasi Script Properties belum lengkap.');
    } else {
      showError(data.message || 'Ralat sistem tidak diketahui.');
    }
  }

  function applyLoginData(data, isRestoredSession) {
    state.mode = data.mode;
    state.nama = data.nama || 'Calon';
    state.no_kp = data.no_kp || '-';
    state.angka_giliran = data.angka_giliran || '-';
    state.kumpulan = data.kumpulan || '-';
    state.login_time = data.login_time || new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
    state.links = (data.data_ujian && data.data_ujian.links) ? data.data_ujian.links : {};
    state.completedSubjects = new Set();
    state.activeSubject = null;

    // Gabungkan rekod selesai daripada pelayan (Sheet REKOD_UJIAN) & localStorage (jika calon sama)
    const serverCompleted = Array.isArray(data.completed_subjects) ? data.completed_subjects : [];
    serverCompleted.forEach(s => state.completedSubjects.add(s));

    try {
      const existingRaw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (existing && existing.no_kp === state.no_kp && existing.mode === state.mode && Array.isArray(existing.completed_subjects)) {
          existing.completed_subjects.forEach(s => state.completedSubjects.add(s));
        }
      }
    } catch (e) {}

    // Paparkan Maklumat Profil
    document.getElementById('dispNama').innerText = state.nama;
    document.getElementById('dispNamaPendek').innerText = state.nama.split(' ')[0];
    document.getElementById('dispIC').innerText = state.no_kp;
    document.getElementById('dispAngka').innerText = state.angka_giliran;
    document.getElementById('dispKumpulan').innerText = state.kumpulan;
    document.getElementById('dispMasaLogin').innerText = state.login_time;

    // Sediakan Tema & Senarai Subjek Mengikut Mod
    const bannerBg = document.getElementById('bannerBg');
    const modeLabel = document.getElementById('modeLabel');
    const bannerInstruction = document.getElementById('bannerInstruction');

    document.getElementById('cardStartAkademik').classList.add('hidden');
    document.getElementById('cardStartPersonaliti').classList.add('hidden');
    document.getElementById('embedContainer').classList.add('hidden');

    resetSubjectListsUI();

    if (state.mode === 'AKADEMIK') {
      modeLabel.innerText = 'MOD UJIAN: AKADEMIK';
      bannerInstruction.innerText = 'Sila selesaikan kesemua 5 subjek ujian akademik di bawah.';
      bannerBg.className = 'bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 rounded-2xl shadow-xl shadow-blue-900/15 p-6 md:p-8 text-white mb-8 relative overflow-hidden transition-all duration-500 border border-white/10';
      document.getElementById('cardStartAkademik').classList.remove('hidden');
    } else {
      modeLabel.innerText = 'MOD UJIAN: PERSONALITI & SAHSIAH';
      bannerInstruction.innerText = 'Sila lengkapkan kedua-dua ujian inventori di bawah.';
      bannerBg.className = 'bg-gradient-to-br from-purple-900 via-purple-800 to-slate-900 rounded-2xl shadow-xl shadow-purple-900/15 p-6 md:p-8 text-white mb-8 relative overflow-hidden transition-all duration-500 border border-white/10';
      document.getElementById('cardStartPersonaliti').classList.remove('hidden');
    }

    // Tandakan subjek yang sudah selesai (dari sesi terdahulu / Sheet)
    state.completedSubjects.forEach(subjectKey => {
      renderSubjectDoneUI(subjectKey);
    });

    updateProgressUI();
    saveSessionToStorage();

    // Tukar Paparan
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('btnLogout').classList.remove('hidden');
    document.getElementById('btnOpenAdminModal').classList.add('hidden');

    if (!isRestoredSession) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ==========================================================================
  // 4. PENGURUSAN SENARAI UJIAN & IFRAME SOALAN
  // ==========================================================================
  function resetSubjectListsUI() {
    const akdList = CONFIG.SUBJECTS.AKADEMIK;
    akdList.forEach((sub, idx) => {
      resetSingleSubjectRow(sub.key, idx + 1, 'blue');
    });

    const persList = CONFIG.SUBJECTS.PERSONALITI;
    persList.forEach((sub, idx) => {
      resetSingleSubjectRow(sub.key, idx + 1, 'purple');
    });
  }

  function resetSingleSubjectRow(subKey, number, themeColor) {
    const btn = document.getElementById(`btn-${subKey}`);
    const badge = document.getElementById(`badge-${subKey}`);
    const row = document.getElementById(`row-${subKey}`);
    const subStatus = document.getElementById(`status-${subKey}`);
    if (!btn || !badge || !row) return;

    const hoverBtn = themeColor === 'blue' ? 'hover:bg-blue-600' : 'hover:bg-purple-600';
    const hoverRow = themeColor === 'blue' ? 'hover:border-blue-200' : 'hover:border-purple-200';

    btn.className = `text-xs font-bold text-white bg-slate-800 ${hoverBtn} px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2`;
    btn.innerHTML = 'Jawab <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>';
    btn.onclick = function () { window.startExam(subKey); };

    badge.innerHTML = number;
    badge.className = 'w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200 transition-colors';

    row.className = `flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/80 ${hoverRow} hover:shadow-md transition-all group`;
    if (subStatus) {
      subStatus.innerText = 'Belum dijawab';
      subStatus.className = 'text-[11px] text-slate-400 font-medium';
    }
  }

  function getSubjectLabel(subjectKey) {
    const all = [...CONFIG.SUBJECTS.AKADEMIK, ...CONFIG.SUBJECTS.PERSONALITI];
    const found = all.find(item => item.key === subjectKey);
    return found ? found.label : subjectKey.toUpperCase();
  }

  window.startExam = function (subjectKey) {
    const frame = document.getElementById('examFrame');
    const embedContainer = document.getElementById('embedContainer');
    const embedTitle = document.getElementById('embedTitle');
    const linkExt = document.getElementById('linkExternal');
    const linkExtTop = document.getElementById('linkExternalTop');

    const url = state.links[subjectKey];
    if (!url || url === '#' || url.trim() === '') {
      showCustomToast('Pautan ujian bagi subjek ini belum dimasukkan di dalam Google Sheet.', 'amber');
      return;
    }

    state.activeSubject = subjectKey;
    embedTitle.innerText = `Sedang Menjawab: ${getSubjectLabel(subjectKey)}`;
    document.getElementById('iframeLoader').classList.remove('hidden');

    frame.src = url;
    if (linkExt) linkExt.href = url;
    if (linkExtTop) linkExtTop.href = url;

    document.getElementById('cardStartAkademik').classList.add('hidden');
    document.getElementById('cardStartPersonaliti').classList.add('hidden');
    embedContainer.classList.remove('hidden');

    refreshIcons();
    setTimeout(() => {
      embedContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  window.backToSubjectList = function () {
    if (state.isFullscreen) {
      window.toggleExamFullscreen();
    }
    const frame = document.getElementById('examFrame');
    frame.src = '';
    document.getElementById('embedContainer').classList.add('hidden');
    document.getElementById('iframeLoader').classList.remove('hidden');

    if (state.mode === 'AKADEMIK') {
      document.getElementById('cardStartAkademik').classList.remove('hidden');
    } else {
      document.getElementById('cardStartPersonaliti').classList.remove('hidden');
    }
  };

  window.toggleExamFullscreen = function () {
    const embedContainer = document.getElementById('embedContainer');
    const fsBtnText = document.getElementById('fullscreenBtnText');
    if (!embedContainer) return;

    state.isFullscreen = !state.isFullscreen;
    if (state.isFullscreen) {
      embedContainer.classList.add('exam-fullscreen');
      document.body.style.overflow = 'hidden';
      if (fsBtnText) fsBtnText.innerText = 'Keluar Skrin Penuh';
    } else {
      embedContainer.classList.remove('exam-fullscreen');
      document.body.style.overflow = '';
      if (fsBtnText) fsBtnText.innerText = 'Skrin Penuh';
    }
    refreshIcons();
  };

  window.triggerClose = function () {
    const subjLabel = state.activeSubject ? getSubjectLabel(state.activeSubject) : 'Ujian';
    const modalSubjName = document.getElementById('confirmModalSubjectName');
    if (modalSubjName) modalSubjName.innerText = subjLabel;
    document.getElementById('customConfirmModal').classList.remove('hidden');
  };

  window.closeCustomModal = function () {
    document.getElementById('customConfirmModal').classList.add('hidden');
  };

  window.confirmCloseExam = async function () {
    window.closeCustomModal();
    if (state.isFullscreen) {
      window.toggleExamFullscreen();
    }

    const frame = document.getElementById('examFrame');
    frame.src = '';
    document.getElementById('embedContainer').classList.add('hidden');
    document.getElementById('iframeLoader').classList.remove('hidden');

    const completedKey = state.activeSubject;
    if (completedKey) {
      state.completedSubjects.add(completedKey);
      renderSubjectDoneUI(completedKey);
    }

    if (state.mode === 'AKADEMIK') {
      document.getElementById('cardStartAkademik').classList.remove('hidden');
    } else {
      document.getElementById('cardStartPersonaliti').classList.remove('hidden');
    }

    updateProgressUI();
    saveSessionToStorage();

    // Segerakkan status selesai ke Google Sheets (Sheet: REKOD_UJIAN)
    await syncProgressToServer();
  };

  function renderSubjectDoneUI(subjectKey) {
    const badge = document.getElementById(`badge-${subjectKey}`);
    const btn = document.getElementById(`btn-${subjectKey}`);
    const row = document.getElementById(`row-${subjectKey}`);
    const subStatus = document.getElementById(`status-${subjectKey}`);

    if (!badge || !btn || !row) return;

    badge.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-white"></i>';
    badge.className = 'w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shadow-sm border border-green-600 transition-all';

    btn.className = 'text-xs font-bold text-green-700 bg-green-100/80 hover:bg-green-200/70 border border-green-300 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all';
    btn.innerHTML = '<i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Selesai (Buka Semula)';
    btn.title = 'Klik jika anda perlu menyemak semula borang ujian ini';
    btn.onclick = function () { window.startExam(subjectKey); };

    row.className = 'flex items-center justify-between p-4 bg-green-50/50 rounded-xl border border-green-200 transition-all';
    if (subStatus) {
      subStatus.innerText = 'Telah disahkan selesai';
      subStatus.className = 'text-[11px] text-green-600 font-semibold';
    }
  }

  function updateProgressUI() {
    const count = state.completedSubjects.size;
    const total = state.mode === 'AKADEMIK' ? 5 : 2;
    const percent = Math.min(100, Math.round((count / total) * 100));

    if (state.mode === 'AKADEMIK') {
      document.getElementById('progressText').innerText = `${count}/5 Selesai`;
    } else {
      document.getElementById('progressTextPers').innerText = `${count}/2 Selesai`;
    }

    const barFill = document.getElementById('visualProgressBar');
    const percentText = document.getElementById('visualProgressPercent');
    const countSummary = document.getElementById('visualProgressSummary');
    const allCompletedBanner = document.getElementById('allCompletedBanner');

    if (barFill) {
      barFill.style.width = `${percent}%`;
      barFill.className = percent === 100
        ? 'progress-bar-fill h-full bg-green-500 rounded-full'
        : 'progress-bar-fill h-full bg-blue-600 rounded-full';
    }
    if (percentText) percentText.innerText = `${percent}%`;
    if (countSummary) countSummary.innerText = `${count} daripada ${total} ujian selesai`;

    if (allCompletedBanner) {
      if (count >= total) {
        allCompletedBanner.classList.remove('hidden');
      } else {
        allCompletedBanner.classList.add('hidden');
      }
    }

    refreshIcons();
  }

  async function syncProgressToServer() {
    const syncBadge = document.getElementById('syncStatusBadge');
    if (syncBadge) {
      syncBadge.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Menyimpan rekod...';
      syncBadge.className = 'text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 inline-flex items-center gap-1.5';
      refreshIcons();
    }

    try {
      const res = await callBackendApi({
        action: 'updateProgress',
        angka_giliran: state.angka_giliran,
        nama: state.nama,
        no_kp: state.no_kp,
        kumpulan: state.kumpulan,
        mode: state.mode,
        completed_subjects: Array.from(state.completedSubjects)
      });

      if (res && res.status === 'BERJAYA' && syncBadge) {
        syncBadge.innerHTML = '<i data-lucide="cloud-check" class="w-3 h-3"></i> Disimpan ke Google Sheet';
        syncBadge.className = 'text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 inline-flex items-center gap-1.5';
        refreshIcons();
      }
    } catch (err) {
      console.warn('Gagal menyegerakkan progres ke pelayan (disimpan di pelayar):', err);
      if (syncBadge) {
        syncBadge.innerHTML = '<i data-lucide="hard-drive" class="w-3 h-3"></i> Disimpan di pelayar';
        syncBadge.className = 'text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5';
        refreshIcons();
      }
    }
  }

  window.hideIframeLoader = function () {
    const loader = document.getElementById('iframeLoader');
    if (loader) loader.classList.add('hidden');
  };

  // ==========================================================================
  // 5. PENGENDALIAN LOG KELUAR (LOGOUT)
  // ==========================================================================
  window.attemptLogout = function () {
    const requiredCount = state.mode === 'AKADEMIK' ? 5 : 2;
    const remaining = requiredCount - state.completedSubjects.size;

    if (remaining > 0) {
      const remSpan = document.getElementById('logoutRemainingCount');
      if (remSpan) remSpan.innerText = remaining;
      document.getElementById('logoutAlertModal').classList.remove('hidden');
      return;
    }
    window.doLogout();
  };

  window.doLogout = function () {
    if (state.isFullscreen) {
      window.toggleExamFullscreen();
    }
    state.completedSubjects.clear();
    state.mode = '';
    state.links = {};
    state.activeSubject = null;

    localStorage.removeItem(CONFIG.STORAGE_KEY);

    document.getElementById('icInput').value = '';
    document.getElementById('passInput').value = '';
    const icCounter = document.getElementById('icDigitCount');
    if (icCounter) {
      icCounter.innerText = '0/12 digit';
      icCounter.className = 'text-[11px] font-medium text-slate-400';
    }
    document.getElementById('examFrame').src = '';
    document.getElementById('iframeLoader').classList.remove('hidden');
    document.getElementById('logoutAlertModal').classList.add('hidden');

    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('btnLogout').classList.add('hidden');
    document.getElementById('btnOpenAdminModal').classList.remove('hidden');
    hideError();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ==========================================================================
  // 6. PANEL PEMANTAUAN URUS SETIA (ADMIN DASHBOARD)
  // ==========================================================================
  window.openAdminModal = function () {
    document.getElementById('adminPassInput').value = '';
    document.getElementById('adminErrorMsg').classList.add('hidden');
    document.getElementById('adminLoginModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('adminPassInput').focus(), 100);
  };

  window.closeAdminModal = function () {
    document.getElementById('adminLoginModal').classList.add('hidden');
  };

  window.handleAdminLogin = async function (e) {
    e.preventDefault();
    const pass = document.getElementById('adminPassInput').value.trim();
    const errBox = document.getElementById('adminErrorMsg');
    const btn = document.getElementById('btnAdminSubmit');

    if (!pass) {
      errBox.innerText = 'Sila masukkan kata laluan Urus Setia.';
      errBox.classList.remove('hidden');
      return;
    }

    errBox.classList.add('hidden');
    btn.disabled = true;
    btn.innerText = 'Mengesahkan...';

    try {
      const res = await callBackendApi({
        action: 'adminDashboard',
        admin_password: pass,
        refresh_cache: false
      });

      btn.disabled = false;
      btn.innerText = 'Buka Panel Urus Setia';

      if (res && res.status === 'BERJAYA') {
        adminState.password = pass;
        window.closeAdminModal();
        renderAdminDashboard(res);
      } else {
        errBox.innerText = (res && res.message) ? res.message : 'Kata laluan Urus Setia salah.';
        errBox.classList.remove('hidden');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerText = 'Buka Panel Urus Setia';
      errBox.innerText = 'Gagal menghubungi pelayan API.';
      errBox.classList.remove('hidden');
    }
  };

  window.refreshAdminData = async function (forceClearCache) {
    if (!adminState.password) return;
    const btn = document.getElementById('btnRefreshAdmin');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Memuatkan...';
      refreshIcons();
    }

    try {
      const res = await callBackendApi({
        action: 'adminDashboard',
        admin_password: adminState.password,
        refresh_cache: Boolean(forceClearCache)
      });
      if (res && res.status === 'BERJAYA') {
        renderAdminDashboard(res);
        showCustomToast('Data Urus Setia berjaya dikemas kini.', 'green');
      }
    } catch (err) {
      showCustomToast('Gagal memuat semula data.', 'red');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Muat Semula';
        refreshIcons();
      }
    }
  };

  function renderAdminDashboard(data) {
    adminState.candidates = data.candidates || [];
    adminState.groups = data.groups || [];
    adminState.stats = data.stats || {};
    adminState.fetchedAt = data.fetched_at || '-';

    document.getElementById('statTotal').innerText = adminState.stats.total || 0;
    document.getElementById('statHadir').innerText = adminState.stats.hadir || 0;
    document.getElementById('statBelumHadir').innerText = adminState.stats.belum_hadir || 0;
    document.getElementById('statAkademik').innerText = adminState.stats.selesai_akademik || 0;
    document.getElementById('statPersonaliti').innerText = adminState.stats.selesai_personaliti || 0;
    document.getElementById('adminFetchedTime').innerText = adminState.fetchedAt;

    // Isi dropdown Kumpulan
    const groupSelect = document.getElementById('adminGroupFilter');
    const currentGroup = groupSelect.value;
    groupSelect.innerHTML = '<option value="ALL">Semua Kumpulan</option>';
    adminState.groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.innerText = `Kumpulan: ${g}`;
      groupSelect.appendChild(opt);
    });
    if (adminState.groups.includes(currentGroup)) {
      groupSelect.value = currentGroup;
    }

    window.filterAdminTable();

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    document.getElementById('btnOpenAdminModal').classList.add('hidden');
    refreshIcons();
  }

  window.filterAdminTable = function () {
    const query = (document.getElementById('adminSearchInput').value || '').toLowerCase().trim();
    const groupVal = document.getElementById('adminGroupFilter').value || 'ALL';
    const statusVal = document.getElementById('adminStatusFilter').value || 'ALL';
    const tbody = document.getElementById('adminTableBody');
    const countLabel = document.getElementById('adminFilteredCount');

    const filtered = adminState.candidates.filter(c => {
      const matchQuery = !query ||
        (c.nama || '').toLowerCase().includes(query) ||
        (c.no_kp || '').toLowerCase().includes(query) ||
        (c.angka_giliran || '').toLowerCase().includes(query);

      const matchGroup = groupVal === 'ALL' || c.kumpulan === groupVal;

      let matchStatus = true;
      if (statusVal === 'HADIR') matchStatus = c.hadir;
      else if (statusVal === 'BELUM_HADIR') matchStatus = !c.hadir;
      else if (statusVal === 'AKD_DONE') matchStatus = c.akd_count >= 5;
      else if (statusVal === 'AKD_PENDING') matchStatus = c.akd_count < 5;
      else if (statusVal === 'PERS_DONE') matchStatus = c.pers_count >= 2;
      else if (statusVal === 'ALL_DONE') matchStatus = c.akd_count >= 5 && c.pers_count >= 2;

      return matchQuery && matchGroup && matchStatus;
    });

    if (countLabel) {
      countLabel.innerText = `Memaparkan ${filtered.length} daripada ${adminState.candidates.length} calon`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-10 text-center text-slate-400 text-sm">
            Tiada rekod calon yang sepadan dengan tapisan semasa.
          </td>
        </tr>`;
      return;
    }

    const akdKeys = CONFIG.SUBJECTS.AKADEMIK;
    const persKeys = CONFIG.SUBJECTS.PERSONALITI;

    tbody.innerHTML = filtered.map(c => {
      const hadirBadge = c.hadir
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">Hadir</span>
           <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(c.last_login)}</div>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">Belum Log Masuk</span>`;

      const akdPills = akdKeys.map(sub => {
        const done = Array.isArray(c.akd_subjek) && c.akd_subjek.includes(sub.key);
        const cls = done
          ? 'bg-green-500 text-white border-green-600'
          : 'bg-slate-100 text-slate-400 border-slate-200';
        return `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded border ${cls}" title="${sub.label}">${sub.code}</span>`;
      }).join('');

      const persPills = persKeys.map(sub => {
        const done = Array.isArray(c.pers_subjek) && c.pers_subjek.includes(sub.key);
        const cls = done
          ? 'bg-purple-600 text-white border-purple-700'
          : 'bg-slate-100 text-slate-400 border-slate-200';
        return `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded border ${cls}" title="${sub.label}">${sub.code}</span>`;
      }).join('');

      return `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
          <td class="px-4 py-3 font-bold text-blue-700 text-xs whitespace-nowrap">${escapeHtml(c.angka_giliran)}</td>
          <td class="px-4 py-3">
            <div class="font-bold text-slate-800 text-xs">${escapeHtml(c.nama)}</div>
            <div class="font-mono text-[11px] text-slate-400">${escapeHtml(c.no_kp)}</div>
          </td>
          <td class="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">${escapeHtml(c.kumpulan)}</td>
          <td class="px-4 py-3 whitespace-nowrap">${hadirBadge}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-xs font-extrabold ${c.akd_count >= 5 ? 'text-green-600' : 'text-slate-700'}">${c.akd_count}/5</span>
            </div>
            <div class="flex flex-wrap gap-1">${akdPills}</div>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-xs font-extrabold ${c.pers_count >= 2 ? 'text-purple-600' : 'text-slate-700'}">${c.pers_count}/2</span>
            </div>
            <div class="flex flex-wrap gap-1">${persPills}</div>
          </td>
        </tr>`;
    }).join('');
  };

  window.exportAdminCsv = function () {
    if (!adminState.candidates || adminState.candidates.length === 0) {
      showCustomToast('Tiada data untuk dieksport.', 'amber');
      return;
    }

    const headers = [
      'Angka Giliran',
      'Nama Calon',
      'No KP',
      'Kumpulan',
      'Status Kehadiran',
      'Log Masuk Terakhir',
      'Progres Akademik',
      'Subjek Akademik Selesai',
      'Progres Personaliti',
      'Subjek Personaliti Selesai'
    ];

    const rows = adminState.candidates.map(c => [
      c.angka_giliran,
      `"${(c.nama || '').replace(/"/g, '""')}"`,
      `"'${c.no_kp}"`,
      `"${(c.kumpulan || '').replace(/"/g, '""')}"`,
      c.hadir ? 'HADIR' : 'BELUM HADIR',
      `"${c.last_login}"`,
      `${c.akd_count}/5`,
      `"${(c.akd_subjek || []).join(', ')}"`,
      `${c.pers_count}/2`,
      `"${(c.pers_subjek || []).join(', ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Pemukiman_2027_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.closeAdminDashboard = function () {
    adminState.password = '';
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('btnOpenAdminModal').classList.remove('hidden');
  };

  // ==========================================================================
  // 7. UTILITI UI & MOD SIMULASI (DEMO FALLBACK)
  // ==========================================================================
  window.togglePasswordVisibility = function (inputId, iconId) {
    const input = document.getElementById(inputId);
    const iconContainer = document.getElementById(iconId);
    if (!input || !iconContainer) return;

    if (input.type === 'password') {
      input.type = 'text';
      iconContainer.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>';
    } else {
      input.type = 'password';
      iconContainer.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
    }
    refreshIcons();
  };

  window.fillDemoCredentials = function (modeType) {
    const icInput = document.getElementById('icInput');
    const passInput = document.getElementById('passInput');
    if (modeType === 'ADMIN') {
      window.openAdminModal();
      document.getElementById('adminPassInput').value = 'admin2027';
      return;
    }
    icInput.value = '081010101010';
    icInput.dispatchEvent(new Event('input'));
    passInput.value = modeType === 'AKADEMIK' ? 'AKD2027' : 'PERS2027';
    hideError();
  };

  function showError(msg) {
    const errText = document.getElementById('errorText');
    const errBox = document.getElementById('errorMessage');
    if (errText) errText.innerText = msg;
    if (errBox) errBox.classList.remove('hidden');
  }

  function hideError() {
    const errBox = document.getElementById('errorMessage');
    if (errBox) errBox.classList.add('hidden');
  }

  function setLoading(isLoading) {
    const btnSubmit = document.getElementById('btnSubmit');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const btnLoadingText = document.getElementById('btnLoadingText');
    const inputs = document.querySelectorAll('#loginSection input');

    if (isLoading) {
      btnSubmit.disabled = true;
      inputs.forEach(i => i.disabled = true);
      btnSubmit.classList.add('opacity-80', 'cursor-not-allowed');
      btnIcon.classList.add('hidden');
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');
      btnLoadingText.classList.remove('hidden');
    } else {
      btnSubmit.disabled = false;
      inputs.forEach(i => i.disabled = false);
      btnSubmit.classList.remove('opacity-80', 'cursor-not-allowed');
      btnIcon.classList.remove('hidden');
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
      btnLoadingText.classList.add('hidden');
    }
  }

  function showCustomToast(message, color) {
    const toast = document.getElementById('customToast');
    const toastText = document.getElementById('customToastText');
    if (!toast || !toastText) return;

    toastText.innerText = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Simulasi Pangkalan Data Tempatan (Apabila GAS_WEB_APP_URL belum ditetapkan)
  function simulateDemoBackend(payload) {
    return new Promise(resolve => {
      setTimeout(() => {
        const demoRecordsRaw = localStorage.getItem(CONFIG.DEMO_RECORDS_KEY);
        const demoRecords = demoRecordsRaw ? JSON.parse(demoRecordsRaw) : {
          'A001': { akd: [], pers: [], last_login: '-' },
          'A002': { akd: ['bm', 'bi', 'mat', 'sains', 'sej'], pers: ['personaliti'], last_login: '17/11/2026 08:30:00 AM' },
          'A003': { akd: ['bm', 'bi'], pers: [], last_login: '17/11/2026 08:45:12 AM' }
        };

        const nowStr = new Date().toLocaleString('ms-MY');

        if (payload.action === 'login') {
          if (payload.no_kp !== '081010101010') {
            resolve({ status: 'GAGAL_IC' });
            return;
          }
          const pass = payload.password.toUpperCase();
          if (pass === 'AKD2027') {
            demoRecords['A001'].last_login = nowStr;
            localStorage.setItem(CONFIG.DEMO_RECORDS_KEY, JSON.stringify(demoRecords));
            resolve({
              status: 'BERJAYA',
              mode: 'AKADEMIK',
              nama: 'AHMAD DANIAL BIN ZULKIFLI (MOD DEMO)',
              no_kp: '081010-10-1010',
              angka_giliran: 'A001',
              kumpulan: 'KUMPULAN 1 (AL-FARABI)',
              login_time: nowStr,
              completed_subjects: demoRecords['A001'].akd || [],
              data_ujian: {
                links: {
                  bm: 'https://example.com',
                  bi: 'https://example.com',
                  mat: 'https://example.com',
                  sains: 'https://example.com',
                  sej: 'https://example.com'
                }
              }
            });
          } else if (pass === 'PERS2027') {
            demoRecords['A001'].last_login = nowStr;
            localStorage.setItem(CONFIG.DEMO_RECORDS_KEY, JSON.stringify(demoRecords));
            resolve({
              status: 'BERJAYA',
              mode: 'PERSONALITI',
              nama: 'AHMAD DANIAL BIN ZULKIFLI (MOD DEMO)',
              no_kp: '081010-10-1010',
              angka_giliran: 'A001',
              kumpulan: 'KUMPULAN 1 (AL-FARABI)',
              login_time: nowStr,
              completed_subjects: demoRecords['A001'].pers || [],
              data_ujian: {
                links: {
                  personaliti: 'https://example.com',
                  sahsiah: 'https://example.com'
                }
              }
            });
          } else {
            resolve({ status: 'GAGAL_PASSWORD' });
          }
        } else if (payload.action === 'updateProgress') {
          const ag = payload.angka_giliran || 'A001';
          if (!demoRecords[ag]) demoRecords[ag] = { akd: [], pers: [], last_login: nowStr };
          if (payload.mode === 'AKADEMIK') {
            demoRecords[ag].akd = payload.completed_subjects || [];
          } else {
            demoRecords[ag].pers = payload.completed_subjects || [];
          }
          localStorage.setItem(CONFIG.DEMO_RECORDS_KEY, JSON.stringify(demoRecords));
          resolve({ status: 'BERJAYA', completed_subjects: payload.completed_subjects || [] });
        } else if (payload.action === 'adminDashboard') {
          if (payload.admin_password !== 'admin2027') {
            resolve({ status: 'GAGAL_ADMIN_AUTH', message: 'Kata laluan Demo Admin ialah: admin2027' });
            return;
          }
          const recA1 = demoRecords['A001'] || { akd: [], pers: [], last_login: '-' };
          const recA2 = demoRecords['A002'];
          const recA3 = demoRecords['A003'];

          const candidates = [
            {
              angka_giliran: 'A001',
              nama: 'AHMAD DANIAL BIN ZULKIFLI',
              no_kp: '081010101010',
              kumpulan: 'KUMPULAN 1 (AL-FARABI)',
              hadir: recA1.last_login !== '-',
              last_login: recA1.last_login,
              akd_count: recA1.akd.length,
              akd_subjek: recA1.akd,
              pers_count: recA1.pers.length,
              pers_subjek: recA1.pers
            },
            {
              angka_giliran: 'A002',
              nama: 'NUR AISYAH HUMAIRA BINTI KAMAL',
              no_kp: '080512102244',
              kumpulan: 'KUMPULAN 1 (AL-FARABI)',
              hadir: true,
              last_login: recA2.last_login,
              akd_count: recA2.akd.length,
              akd_subjek: recA2.akd,
              pers_count: recA2.pers.length,
              pers_subjek: recA2.pers
            },
            {
              angka_giliran: 'A003',
              nama: 'MUHAMMAD HAZIQ BIN ROSLAN',
              no_kp: '081123084311',
              kumpulan: 'KUMPULAN 2 (IBNU SINA)',
              hadir: true,
              last_login: recA3.last_login,
              akd_count: recA3.akd.length,
              akd_subjek: recA3.akd,
              pers_count: recA3.pers.length,
              pers_subjek: recA3.pers
            },
            {
              angka_giliran: 'A004',
              nama: 'SITI NURHALIZA BINTI FARID',
              no_kp: '080219015566',
              kumpulan: 'KUMPULAN 2 (IBNU SINA)',
              hadir: false,
              last_login: '-',
              akd_count: 0,
              akd_subjek: [],
              pers_count: 0,
              pers_subjek: []
            }
          ];

          const hadirCount = candidates.filter(c => c.hadir).length;
          resolve({
            status: 'BERJAYA',
            stats: {
              total: candidates.length,
              hadir: hadirCount,
              belum_hadir: candidates.length - hadirCount,
              selesai_akademik: candidates.filter(c => c.akd_count >= 5).length,
              selesai_personaliti: candidates.filter(c => c.pers_count >= 2).length
            },
            groups: ['KUMPULAN 1 (AL-FARABI)', 'KUMPULAN 2 (IBNU SINA)'],
            candidates: candidates,
            fetched_at: nowStr + ' (Mod Demo)'
          });
        }
      }, 450);
    });
  }
})();
