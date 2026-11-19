/**
 * ============================================================================
 * KONFIGURASI PORTAL UJIAN PEMUKIMAN TEMU DUGA SESI 2027
 * ============================================================================
 * PANDUAN PENTING:
 * Selepas anda melakukan "Deploy > New deployment > Web app" pada fail
 * `backend/code.gs` di Google Apps Script, salin URL Web App tersebut
 * (berakhir dengan `/exec`) dan tampal pada ruangan `GAS_WEB_APP_URL` di bawah.
 */

window.PORTAL_CONFIG = {
  // ⬇️ TAMPAL URL WEB APP GOOGLE APPS SCRIPT ANDA DI SINI ⬇️
  GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzZBKL1wnnYk9r40aQSc0kHlS06eiXoR0gsKtV63Ml7tdxdnRziYhoxgUb4XuLhLRm4/exec',

  // Kunci simpanan sesi pelayar (localStorage)
  STORAGE_KEY: 'PORTAL_PEMUKIMAN_SESSION_2027',
  DEMO_RECORDS_KEY: 'PORTAL_PEMUKIMAN_DEMO_RECORDS_2027',

  // Benarkan Mod Simulasi/Demo jika URL Web App belum dimasukkan (untuk ujian pantas)
  ENABLE_DEMO_WHEN_UNCONFIGURED: false,

  // Hash SHA-256 bagi PIN Pengawas untuk Log Keluar Kecemasan (tiada teks biasa didedahkan di frontend).
  // Pengesahan utama dibuat melalui Script Properties (SUPERVISOR_PIN / ADMIN_PASSWORD) di pelayan Apps Script.
  PIN_PENGAWAS_SHA256: '5313e5bf17148de844ff74be3663d47c6e361ca469b30a36337701233c89a15e',

  // Pengesanan Tukar Tab / Tingkap semasa calon menjawab ujian (Anti-Cheat Ringan)
  ENABLE_TAB_SWITCH_MONITOR: true,

  // Tempoh Auto-Refresh Panel Urus Setia (dalam saat)
  ADMIN_AUTO_REFRESH_SECONDS: 30,

  // Metadata Subjek Mengikut Mod
  SUBJECTS: {
    AKADEMIK: [
      { key: 'bm', label: 'Bahasa Melayu', code: 'BM' },
      { key: 'bi', label: 'Bahasa Inggeris', code: 'BI' },
      { key: 'mat', label: 'Matematik', code: 'MAT' },
      { key: 'sains', label: 'Sains', code: 'SNS' },
      { key: 'sej', label: 'Sejarah', code: 'SEJ' }
    ],
    PERSONALITI: [
      { key: 'personaliti', label: 'Ujian Personaliti', code: 'PERS' },
      { key: 'sahsiah', label: 'Ujian Sahsiah', code: 'SAHS' }
    ]
  }
};
