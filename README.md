# Portal Ujian Pemukiman — Temu Duga Pelajar Baharu Sesi 2027

Aplikasi web portal ujian berpusat untuk calon **Pemukiman Temu Duga Pelajar Baharu Sesi 2027**. Direka bentuk dengan seni bina hibrid moden: **Static Frontend (GitHub Pages)** yang pantas + **Google Apps Script JSON API** + **Google Sheets** sebagai pangkalan data masa nyata.

---

## ✨ Ciri-Ciri Utama

1. **Pengesahan Calon Dwi-Mod (Akademik & Personaliti):**
   - Menyokong log masuk menggunakan **No. Kad Pengenalan (12 digit)** dan **Kata Laluan Sesi**.
   - Secara automatik membuka **Mod Ujian Akademik** (5 subjek: *BM, BI, Matematik, Sains, Sejarah*) atau **Mod Ujian Personaliti & Sahsiah** (2 ujian) berdasarkan kata laluan yang dimasukkan.
2. **Ketahanan Sesi (*Session Persistence*) Dwi-Lapisan:**
   - **Simpanan Pelayar (`localStorage`):** Jika calon tertekan *Refresh* (F5) atau terkeluar pelayar, sesi dan subjek yang telah dijawab tidak akan hilang.
   - **Simpanan Awan (`Sheet: REKOD_UJIAN`):** Status selesai setiap subjek direkodkan secara langsung ke dalam Google Sheet. Walaupun calon bertukar komputer di tengah-tengah ujian, rekod subjek yang telah dijawab dipulihkan secara automatik.
3. **Pengalaman Menjawab Mesra Pengguna:**
   - Soalan Google Form dibuka terus di dalam portal (`<iframe>`) dilengkapi **Mod Skrin Penuh (*Fullscreen*)**.
   - Bar kemajuan visual (*Visual Progress Bar* 0%–100%) dan sekatan log keluar selagi kesemua kertas ujian belum diselesaikan.
4. **Panel Pemantauan Urus Setia (Mod Admin):**
   - Papan pemuka masa nyata untuk menyemak statistik kehadiran, status penyelesaian ujian mengikut kumpulan/calon, carian pantas, cetakan laporan, dan muat turun **CSV (Excel)**.
5. **Selamat untuk Repositori GitHub Public:**
   - `SPREADSHEET_ID` dan `ADMIN_PASSWORD` disimpan di dalam **Google Apps Script Properties** (tidak didedahkan di dalam kod sumber GitHub).

---

## 📁 Struktur Fail Projek

```text
portal-pemukiman-temuduga/
├── index.html                  # Antara muka utama (Calon & Panel Urus Setia)
├── assets/
│   ├── css/
│   │   └── style.css           # Gaya tersuai, animasi & mod skrin penuh
│   ├── js/
│   │   ├── config.js           # Konfigurasi URL Web App Google Apps Script
│   │   └── app.js              # Logik aplikasi frontend, API & localStorage
│   └── img/
│       └── logo.png            # Logo rasmi (dioptimumkan ~52KB)
├── backend/
│   └── code.gs                 # Skrip Google Apps Script (Backend REST API)
├── .gitignore
└── README.md
```

---

## 📊 Struktur Google Sheets (Database)

Pastikan fail Google Sheet anda mempunyai **2 helaian asal** berikut (helaian ke-3 `REKOD_UJIAN` akan dicipta secara automatik oleh sistem):

### 1. Helaian `DATABASE`
| Lajur A | Lajur B | Lajur C | Lajur D |
| :--- | :--- | :--- | :--- |
| **ANGKA GILIRAN** | **NAMA** | **NO KP** | **KUMPULAN** |
| A001 | AHMAD DANIAL BIN ZULKIFLI | 081010101010 | KUMPULAN 1 |

### 2. Helaian `UJIAN AKADEMIK`
| A | B | C | D | E | F | G | H | I | J |
| :- | :- | :- | :- | :- | :- | :- | :- | :- | :- |
| **ANGKA** | **PASS AKD** | **LINK BM** | **LINK BI** | **LINK MAT** | **LINK SAINS** | **LINK SEJ** | **PASS PERS** | **LINK PERSONALITI** | **LINK SAHSIAH** |

### 3. Helaian `REKOD_UJIAN` *(Dicipta Automatik)*
Merekodkan masa log masuk terakhir dan senarai subjek yang telah diselesaikan oleh setiap calon secara langsung.

---

## 🚀 Panduan Pemasangan & Deploy ke GitHub Pages

### Langkah 1: Sediakan Backend di Google Apps Script
1. Buka Google Sheet anda, klik menu **Extensions > Apps Script**.
2. Padam kod lama di dalam `Code.gs`, kemudian salin dan tampal keseluruhan kod daripada fail [`backend/code.gs`](backend/code.gs).
3. Di bahagian atas kod `setupConfig()`, gantikan nilai:
   - `SPREADSHEET_ID`: Masukkan ID Google Sheet anda.
   - `ADMIN_PASSWORD`: Masukkan kata laluan pilihan anda untuk Panel Urus Setia.
4. Pilih fungsi **`setupConfig`** pada bar atas editor Apps Script dan klik **Run** (berikan kebenaran akses *Review Permissions* jika diminta).
   > **Tip Keselamatan:** Selepas `setupConfig` berjaya dijalankan, ID Sheet dan kata laluan disimpan di dalam *Script Properties*.
5. Klik butang **Deploy > New deployment**:
   - **Select type:** *Web app*
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
6. Klik **Deploy** dan salin **Web App URL** (berakhir dengan `/exec`).

### Langkah 2: Sambungkan URL API ke Frontend
1. Buka fail [`assets/js/config.js`](assets/js/config.js).
2. Tampal **Web App URL** tadi pada pemboleh ubah `GAS_WEB_APP_URL`:
   ```javascript
   GAS_WEB_APP_URL: 'https://script.google.com/macros/s/XXXX.../exec',
   ```

### Langkah 3: Muat Naik ke GitHub & Aktifkan GitHub Pages
1. Muat naik (*push*) folder projek ini ke repositori GitHub anda:
   ```bash
   git init
   git add .
   git commit -m "Initial release: Portal Ujian Pemukiman Sesi 2027"
   git branch -M main
   git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPO.git
   git push -u origin main
   ```
2. Di halaman GitHub repositori anda, pergi ke **Settings > Pages**.
3. Di bawah **Build and deployment > Branch**, pilih **`main`** dan folder **`/ (root)`**, kemudian klik **Save**.
4. Dalam masa 1–2 minit, portal anda boleh diakses secara publik di `https://USERNAME_ANDA.github.io/NAMA_REPO/`.
