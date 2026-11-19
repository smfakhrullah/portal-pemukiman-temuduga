/**
 * ============================================================================
 * PORTAL UJIAN PEMUKIMAN TEMU DUGA SESI 2027 — BACKEND API (Google Apps Script)
 * ============================================================================
 * Seni Bina: REST JSON API untuk dihubung daripada GitHub Pages (fetch API).
 * Pangkalan Data: Google Sheets (DATABASE, UJIAN AKADEMIK, REKOD_UJIAN).
 *
 * PANDUAN TETAPAN AWAL (PENTING UNTUK KESELAMATAN REPO PUBLIC):
 * 1. Salin kod ini ke dalam projek Google Apps Script anda.
 * 2. Di dalam fungsi `setupConfig()` di bawah, masukkan SPREADSHEET_ID dan
 *    ADMIN_PASSWORD pilihan anda, kemudian jalankan (Run) fungsi `setupConfig`
 *    SEKALI SAHAJA di editor Apps Script.
 * 3. Selepas dijalankan, nilai tersebut disimpan dengan selamat di dalam
 *    Script Properties (tidak terdedah di GitHub).
 * 4. Klik "Deploy" > "New deployment" > Jenis: "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Salin Web App URL dan tampal ke dalam fail `assets/js/config.js`.
 * ============================================================================
 */

var SHEET_NAMES = {
  DATABASE: 'DATABASE',
  UJIAN: 'UJIAN AKADEMIK',
  REKOD: 'REKOD_UJIAN'
};

var CACHE_TTL_SECONDS = 120; // Simpan cache bacaan selama 2 minit untuk elak isu kuota serentak

/**
 * Jalankan fungsi ini SEKALI di dalam Editor Google Apps Script
 * untuk menyimpan konfigurasi rahsia ke dalam Script Properties.
 */
function setupConfig() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'SPREADSHEET_ID': 'MASUKKAN_SPREADSHEET_ID_DI_SINI',
    'ADMIN_PASSWORD': 'TUKAR_KATA_LALUAN_ADMIN_DI_SINI',
    'SUPERVISOR_PIN': '2027'
  });
  Logger.log('Konfigurasi berjaya disimpan ke dalam Script Properties!');
}

/**
 * Mendapatkan konfigurasi daripada Script Properties.
 */
function getAppConfig_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var adminPassword = props.getProperty('ADMIN_PASSWORD') || 'admin2027';
  var supervisorPin = props.getProperty('SUPERVISOR_PIN') || '2027';

  if (!spreadsheetId || spreadsheetId === 'MASUKKAN_SPREADSHEET_ID_DI_SINI') {
    throw new Error('SPREADSHEET_ID_BELUM_DITETAPKAN');
  }

  return {
    spreadsheetId: spreadsheetId.trim(),
    adminPassword: adminPassword.trim(),
    supervisorPin: supervisorPin.trim(),
    portalMode: (props.getProperty('PORTAL_MODE_STATUS') || 'OPEN_ALL').trim(),
    portalMessage: (props.getProperty('PORTAL_CUSTOM_MESSAGE') || '').trim()
  };
}

/**
 * Mengesahkan PIN Pengawas atau Kata Laluan Urus Setia bagi Log Keluar Kecemasan
 */
function handleVerifySupervisorPin_(pinInput) {
  var cleanPin = (pinInput || '').toString().trim();
  if (!cleanPin) {
    return { status: 'GAGAL_PIN', message: 'Sila masukkan PIN Pengawas.' };
  }
  var config = getAppConfig_();
  if (cleanPin === config.supervisorPin || cleanPin === config.adminPassword) {
    return { status: 'BERJAYA' };
  }
  return { status: 'GAGAL_PIN', message: 'PIN Pengawas tidak sah.' };
}

/**
 * Mendapatkan status semasa pembukaan sesi portal (boleh diakses secara umum oleh halaman log masuk)
 */
function getPublicPortalStatus_() {
  var props = PropertiesService.getScriptProperties();
  return {
    status: 'BERJAYA',
    portal_mode: (props.getProperty('PORTAL_MODE_STATUS') || 'OPEN_ALL').trim(),
    portal_message: (props.getProperty('PORTAL_CUSTOM_MESSAGE') || '').trim()
  };
}

/**
 * Mengemas kini status pembukaan sesi portal (hanya boleh diubah oleh Urus Setia)
 */
function handleSetPortalStatus_(adminPassInput, newMode, customMessage) {
  var config = getAppConfig_();
  if (!adminPassInput || adminPassInput.toString().trim() !== config.adminPassword) {
    return { status: 'GAGAL_ADMIN_AUTH', message: 'Kata laluan Urus Setia tidak sah.' };
  }

  var allowedModes = ['OPEN_ALL', 'ONLY_AKADEMIK', 'ONLY_PERSONALITI', 'CLOSED'];
  var modeToSave = allowedModes.indexOf(newMode) !== -1 ? newMode : 'OPEN_ALL';
  var msgToSave = (customMessage || '').toString().trim();

  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'PORTAL_MODE_STATUS': modeToSave,
    'PORTAL_CUSTOM_MESSAGE': msgToSave
  });

  return {
    status: 'BERJAYA',
    portal_mode: modeToSave,
    portal_message: msgToSave,
    updated_at: formatTimestamp_(new Date())
  };
}

/**
 * Endpoint GET: Digunakan untuk semakan kesihatan API (health check)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'status';
  if (action === 'status') {
    return jsonResponse_({
      status: 'OK',
      service: 'Portal Ujian Pemukiman API',
      timestamp: new Date().toISOString()
    });
  }
  return jsonResponse_({ status: 'ERROR', message: 'Gunakan kaedah POST untuk transaksi data.' });
}

/**
 * Endpoint POST: Menerima permintaan JSON daripada GitHub Pages (Content-Type: text/plain)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ status: 'ERROR_INVALID_REQUEST', message: 'Tiada data dihantar.' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || '';

    switch (action) {
      case 'getPortalStatus':
        return jsonResponse_(getPublicPortalStatus_());

      case 'login':
        return jsonResponse_(handleStudentLogin_(payload.no_kp, payload.password));

      case 'updateProgress':
        return jsonResponse_(handleUpdateProgress_(payload));

      case 'adminDashboard':
        return jsonResponse_(handleAdminDashboard_(payload.admin_password, payload.refresh_cache));

      case 'setPortalStatus':
        return jsonResponse_(handleSetPortalStatus_(payload.admin_password, payload.portal_mode, payload.portal_message));

      case 'verifySupervisorPin':
        return jsonResponse_(handleVerifySupervisorPin_(payload.pin));

      case 'clearCache':
        return jsonResponse_(handleClearCache_(payload.admin_password));

      default:
        return jsonResponse_({ status: 'ERROR_UNKNOWN_ACTION', message: 'Tindakan tidak dikenali.' });
    }
  } catch (err) {
    Logger.log('Ralat doPost: ' + err.toString());
    if (err.message === 'SPREADSHEET_ID_BELUM_DITETAPKAN') {
      return jsonResponse_({
        status: 'ERROR_CONFIG',
        message: 'SPREADSHEET_ID belum ditetapkan dalam Script Properties. Sila jalankan setupConfig() di Apps Script.'
      });
    }
    return jsonResponse_({
      status: 'ERROR_SYSTEM',
      message: 'Ralat pelayan dalaman: ' + err.message
    });
  }
}

/**
 * Pembantu untuk memulangkan respons JSON dengan header MIME yang betul
 */
function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Membaca data DATABASE dan UJIAN AKADEMIK (menggunakan CacheService untuk prestasi)
 */
function getCachedMasterData_(ss, forceRefresh) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'MASTER_DATA_V1';

  if (!forceRefresh) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Abaikan jika JSON cache rosak
      }
    }
  }

  var sheetDB = ss.getSheetByName(SHEET_NAMES.DATABASE);
  var sheetUjian = ss.getSheetByName(SHEET_NAMES.UJIAN);

  if (!sheetDB || !sheetUjian) {
    return null;
  }

  var dataDB = sheetDB.getDataRange().getDisplayValues();
  var dataUjian = sheetUjian.getDataRange().getDisplayValues();

  var master = {
    dbRows: dataDB,
    ujianRows: dataUjian
  };

  try {
    var serialized = JSON.stringify(master);
    if (serialized.length < 95000) { // Had maksimum item CacheService ialah 100KB
      cache.put(cacheKey, serialized, CACHE_TTL_SECONDS);
    }
  } catch (e) {
    Logger.log('Cache skip: ' + e.toString());
  }

  return master;
}

/**
 * Mencari atau mencipta sheet REKOD_UJIAN secara automatik jika belum wujud
 */
function getOrCreateRekodSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_NAMES.REKOD);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.REKOD);
    var headers = [
      'ANGKA GILIRAN',
      'NAMA CALON',
      'NO KP',
      'KUMPULAN',
      'LOG MASUK TERAKHIR',
      'STATUS AKADEMIK',
      'SUBJEK AKADEMIK SELESAI',
      'STATUS PERSONALITI',
      'SUBJEK PERSONALITI SELESAI',
      'KEMAS KINI TERAKHIR',
      'KIRAAN TUKAR TAB'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else {
    // Pastikan lajur ke-11 (KIRAAN TUKAR TAB) wujud untuk helaian sedia ada
    var col11Header = sheet.getRange(1, 11).getDisplayValue();
    if (!col11Header) {
      sheet.getRange(1, 11).setValue('KIRAAN TUKAR TAB')
        .setFontWeight('bold')
        .setBackground('#1e293b')
        .setFontColor('#ffffff');
    }
  }
  return sheet;
}

/**
 * 1. FUNGSI LOG MASUK CALON
 */
function handleStudentLogin_(noKPInput, passInput) {
  if (!noKPInput || !passInput) {
    return { status: 'GAGAL_INPUT' };
  }

  var config = getAppConfig_();

  // Semak jika portal ditutup sepenuhnya oleh Urus Setia
  if (config.portalMode === 'CLOSED') {
    return {
      status: 'PORTAL_CLOSED',
      portal_mode: 'CLOSED',
      message: config.portalMessage || 'Sesi ujian ditutup buat sementara waktu. Sila tunggu arahan daripada Urus Setia.'
    };
  }

  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var master = getCachedMasterData_(ss, false);

  if (!master) {
    return { status: 'ERROR_SHEET' };
  }

  var cleanInputIC = noKPInput.toString().replace(/[^0-9]/g, '');
  var cleanInputPass = passInput.toString().trim();

  // Langkah 1: Cari Pelajar dalam 'DATABASE' guna No KP
  var studentData = null;
  for (var i = 1; i < master.dbRows.length; i++) {
    var row = master.dbRows[i];
    var sheetIC = (row[2] || '').toString().replace(/[^0-9]/g, '');
    if (sheetIC && sheetIC === cleanInputIC) {
      studentData = {
        angka_giliran: (row[0] || '').toString().trim(),
        nama: (row[1] || '').toString().trim(),
        no_kp: (row[2] || '').toString().trim(),
        kumpulan: (row[3] || '').toString().trim()
      };
      break;
    }
  }

  if (!studentData) {
    return { status: 'GAGAL_IC' };
  }

  // Langkah 2: Padankan Angka Giliran & Kata Laluan dalam 'UJIAN AKADEMIK'
  var foundDetails = null;
  var modeUjian = null;

  for (var j = 1; j < master.ujianRows.length; j++) {
    var rowU = master.ujianRows[j];
    if ((rowU[0] || '').toString().trim() === studentData.angka_giliran) {
      var passAkademik = (rowU[1] || '').toString().trim();
      var passPersonaliti = (rowU[7] || '').toString().trim();

      if (cleanInputPass === passAkademik && passAkademik !== '') {
        modeUjian = 'AKADEMIK';
        foundDetails = {
          links: {
            bm: rowU[2] || '',
            bi: rowU[3] || '',
            mat: rowU[4] || '',
            sains: rowU[5] || '',
            sej: rowU[6] || ''
          }
        };
      } else if (cleanInputPass === passPersonaliti && passPersonaliti !== '') {
        modeUjian = 'PERSONALITI';
        foundDetails = {
          links: {
            personaliti: rowU[8] || '',
            sahsiah: rowU[9] || ''
          }
        };
      }
      break;
    }
  }

  if (!modeUjian || !foundDetails) {
    return { status: 'GAGAL_PASSWORD' };
  }

  // Semak jika hanya sesi tertentu sahaja dibuka oleh Urus Setia
  if (config.portalMode === 'ONLY_AKADEMIK' && modeUjian !== 'AKADEMIK') {
    return {
      status: 'SESI_DITUTUP',
      portal_mode: config.portalMode,
      message: config.portalMessage || 'Sesi Ujian Personaliti & Sahsiah belum dibuka oleh Urus Setia. Hanya Sesi Ujian Akademik dibuka buat masa ini.'
    };
  }
  if (config.portalMode === 'ONLY_PERSONALITI' && modeUjian !== 'PERSONALITI') {
    return {
      status: 'SESI_DITUTUP',
      portal_mode: config.portalMode,
      message: config.portalMessage || 'Sesi Ujian Akademik telah ditutup atau belum bermula. Hanya Sesi Ujian Personaliti & Sahsiah dibuka buat masa ini.'
    };
  }

  // Langkah 3: Rekod Log Masuk & Ambil Rekod Subjek Selesai Sedia Ada daripada 'REKOD_UJIAN'
  var syncRecord = syncStudentLoginRecord_(ss, studentData, modeUjian);

  return {
    status: 'BERJAYA',
    mode: modeUjian,
    nama: studentData.nama,
    no_kp: studentData.no_kp,
    angka_giliran: studentData.angka_giliran,
    kumpulan: studentData.kumpulan,
    data_ujian: foundDetails,
    completed_subjects: syncRecord.completedList,
    tab_switch_count: syncRecord.tabSwitchCount,
    login_time: formatTimestamp_(new Date())
  };
}

/**
 * Menyegerakkan log masuk calon dengan sheet REKOD_UJIAN dan memulangkan subjek yang telah selesai serta kiraan tukar tab
 */
function syncStudentLoginRecord_(ss, studentData, modeUjian) {
  var lock = LockService.getScriptLock();
  var completedList = [];
  var tabSwitchCount = 0;

  try {
    lock.waitLock(10000);
    var sheetRekod = getOrCreateRekodSheet_(ss);
    var dataRekod = sheetRekod.getDataRange().getDisplayValues();
    var nowStr = formatTimestamp_(new Date());
    var foundRowIndex = -1;

    for (var i = 1; i < dataRekod.length; i++) {
      if ((dataRekod[i][0] || '').toString().trim() === studentData.angka_giliran) {
        foundRowIndex = i + 1; // Indeks baris 1-based dalam Sheet
        var rawSubjects = modeUjian === 'AKADEMIK' ? (dataRekod[i][6] || '') : (dataRekod[i][8] || '');
        if (rawSubjects.trim() !== '') {
          completedList = rawSubjects.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        }
        tabSwitchCount = parseInt(dataRekod[i][10], 10) || 0;
        break;
      }
    }

    if (foundRowIndex === -1) {
      sheetRekod.appendRow([
        studentData.angka_giliran,
        studentData.nama,
        "'" + studentData.no_kp,
        studentData.kumpulan,
        nowStr,
        '0/5',
        '',
        '0/2',
        '',
        nowStr,
        0
      ]);
    } else {
      sheetRekod.getRange(foundRowIndex, 5).setValue(nowStr); // Log Masuk Terakhir
      sheetRekod.getRange(foundRowIndex, 10).setValue(nowStr); // Kemas Kini Terakhir
    }
  } catch (e) {
    Logger.log('Ralat syncStudentLoginRecord_: ' + e.toString());
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }

  return {
    completedList: completedList,
    tabSwitchCount: tabSwitchCount
  };
}

/**
 * 2. FUNGSI KEMAS KINI STATUS SELESAI SUBJEK & KIRAAN TUKAR TAB KE SHEET 'REKOD_UJIAN'
 */
function handleUpdateProgress_(payload) {
  var angkaGiliran = (payload.angka_giliran || '').toString().trim();
  var mode = (payload.mode || '').toString().trim();
  var incomingSubjects = Array.isArray(payload.completed_subjects) ? payload.completed_subjects : [];
  var incomingTabSwitches = parseInt(payload.tab_switch_count, 10) || 0;

  if (!angkaGiliran || !mode) {
    return { status: 'ERROR_INVALID_DATA' };
  }

  var validSubjects = mode === 'AKADEMIK'
    ? ['bm', 'bi', 'mat', 'sains', 'sej']
    : ['personaliti', 'sahsiah'];

  var cleanCompleted = [];
  for (var k = 0; k < validSubjects.length; k++) {
    if (incomingSubjects.indexOf(validSubjects[k]) !== -1) {
      cleanCompleted.push(validSubjects[k]);
    }
  }

  var config = getAppConfig_();
  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    var sheetRekod = getOrCreateRekodSheet_(ss);
    var dataRekod = sheetRekod.getDataRange().getDisplayValues();
    var nowStr = formatTimestamp_(new Date());
    var foundRowIndex = -1;
    var existingTabSwitches = 0;

    for (var i = 1; i < dataRekod.length; i++) {
      if ((dataRekod[i][0] || '').toString().trim() === angkaGiliran) {
        foundRowIndex = i + 1;
        // Gabungkan dengan yang sedia ada dalam sheet supaya tiada kehilangan rekod
        var existingRaw = mode === 'AKADEMIK' ? (dataRekod[i][6] || '') : (dataRekod[i][8] || '');
        var existingArr = existingRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        for (var m = 0; m < existingArr.length; m++) {
          if (validSubjects.indexOf(existingArr[m]) !== -1 && cleanCompleted.indexOf(existingArr[m]) === -1) {
            cleanCompleted.push(existingArr[m]);
          }
        }
        existingTabSwitches = parseInt(dataRekod[i][10], 10) || 0;
        break;
      }
    }

    var finalTabSwitches = Math.max(existingTabSwitches, incomingTabSwitches);
    var totalRequired = validSubjects.length;
    var count = cleanCompleted.length;
    var statusLabel = count >= totalRequired
      ? 'SELESAI (' + count + '/' + totalRequired + ')'
      : count + '/' + totalRequired;
    var subjectsCsv = cleanCompleted.join(',');

    if (foundRowIndex === -1) {
      var akdStatus = mode === 'AKADEMIK' ? statusLabel : '0/5';
      var akdCsv = mode === 'AKADEMIK' ? subjectsCsv : '';
      var persStatus = mode === 'PERSONALITI' ? statusLabel : '0/2';
      var persCsv = mode === 'PERSONALITI' ? subjectsCsv : '';

      sheetRekod.appendRow([
        angkaGiliran,
        payload.nama || '-',
        "'" + (payload.no_kp || '-'),
        payload.kumpulan || '-',
        nowStr,
        akdStatus,
        akdCsv,
        persStatus,
        persCsv,
        nowStr,
        finalTabSwitches
      ]);
    } else {
      if (mode === 'AKADEMIK') {
        sheetRekod.getRange(foundRowIndex, 6, 1, 2).setValues([[statusLabel, subjectsCsv]]);
      } else {
        sheetRekod.getRange(foundRowIndex, 8, 1, 2).setValues([[statusLabel, subjectsCsv]]);
      }
      sheetRekod.getRange(foundRowIndex, 10, 1, 2).setValues([[nowStr, finalTabSwitches]]);
    }

    return {
      status: 'BERJAYA',
      completed_subjects: cleanCompleted,
      tab_switch_count: finalTabSwitches,
      progress_label: statusLabel,
      updated_at: nowStr
    };
  } catch (e) {
    Logger.log('Ralat handleUpdateProgress_: ' + e.toString());
    return { status: 'ERROR_LOCK', message: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * 3. FUNGSI PAPAN PEMUKA URUS SETIA (ADMIN DASHBOARD)
 */
function handleAdminDashboard_(adminPassInput, forceRefresh) {
  var config = getAppConfig_();
  if (!adminPassInput || adminPassInput.toString().trim() !== config.adminPassword) {
    return { status: 'GAGAL_ADMIN_AUTH', message: 'Kata laluan Urus Setia tidak sah.' };
  }

  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var master = getCachedMasterData_(ss, Boolean(forceRefresh));
  if (!master) {
    return { status: 'ERROR_SHEET' };
  }

  var sheetRekod = getOrCreateRekodSheet_(ss);
  var dataRekod = sheetRekod.getDataRange().getDisplayValues();

  // Bina peta rekod mengikut angka giliran
  var rekodMap = {};
  for (var r = 1; r < dataRekod.length; r++) {
    var rowR = dataRekod[r];
    var ag = (rowR[0] || '').toString().trim();
    if (ag) {
      rekodMap[ag] = {
        last_login: rowR[4] || '-',
        status_akademik: rowR[5] || '0/5',
        subjek_akademik: rowR[6] ? rowR[6].split(',').filter(Boolean) : [],
        status_personaliti: rowR[7] || '0/2',
        subjek_personaliti: rowR[8] ? rowR[8].split(',').filter(Boolean) : [],
        updated_at: rowR[9] || '-',
        tab_switch_count: parseInt(rowR[10], 10) || 0
      };
    }
  }

  var candidates = [];
  var groupsSet = {};
  var stats = {
    total: 0,
    hadir: 0,
    belum_hadir: 0,
    selesai_akademik: 0,
    selesai_personaliti: 0,
    selesai_semua: 0,
    amaran_tukar_tab: 0
  };

  for (var i = 1; i < master.dbRows.length; i++) {
    var row = master.dbRows[i];
    var ag = (row[0] || '').toString().trim();
    var nama = (row[1] || '').toString().trim();
    var ic = (row[2] || '').toString().trim();
    var kumpulan = (row[3] || '').toString().trim() || 'Tiada Kumpulan';

    if (!ag && !nama) continue;

    stats.total++;
    groupsSet[kumpulan] = true;

    var rec = rekodMap[ag] || null;
    var akdCount = rec ? rec.subjek_akademik.length : 0;
    var persCount = rec ? rec.subjek_personaliti.length : 0;
    var tabSwitchCount = rec ? (rec.tab_switch_count || 0) : 0;
    var isHadir = Boolean(rec);
    var isAkdDone = akdCount >= 5;
    var isPersDone = persCount >= 2;

    if (isHadir) stats.hadir++;
    else stats.belum_hadir++;

    if (isAkdDone) stats.selesai_akademik++;
    if (isPersDone) stats.selesai_personaliti++;
    if (isAkdDone && isPersDone) stats.selesai_semua++;
    if (tabSwitchCount > 0) stats.amaran_tukar_tab++;

    candidates.push({
      angka_giliran: ag,
      nama: nama,
      no_kp: ic,
      kumpulan: kumpulan,
      hadir: isHadir,
      last_login: rec ? rec.last_login : '-',
      akd_count: akdCount,
      akd_subjek: rec ? rec.subjek_akademik : [],
      pers_count: persCount,
      pers_subjek: rec ? rec.subjek_personaliti : [],
      tab_switch_count: tabSwitchCount,
      updated_at: rec ? rec.updated_at : '-'
    });
  }

  return {
    status: 'BERJAYA',
    stats: stats,
    groups: Object.keys(groupsSet).sort(),
    candidates: candidates,
    portal_mode: config.portalMode,
    portal_message: config.portalMessage,
    fetched_at: formatTimestamp_(new Date())
  };
}

/**
 * 4. FUNGSI KOSONGKAN CACHE MASTER DATA
 */
function handleClearCache_(adminPassInput) {
  var config = getAppConfig_();
  if (!adminPassInput || adminPassInput.toString().trim() !== config.adminPassword) {
    return { status: 'GAGAL_ADMIN_AUTH' };
  }
  CacheService.getScriptCache().remove('MASTER_DATA_V1');
  return { status: 'BERJAYA', message: 'Cache pangkalan data telah dikosongkan.' };
}

/**
 * Format tarikh & masa Malaysia (GMT+8)
 */
function formatTimestamp_(dateObj) {
  return Utilities.formatDate(dateObj, 'Asia/Kuala_Lumpur', 'dd/MM/yyyy hh:mm:ss a');
}
