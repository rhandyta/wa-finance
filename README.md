# 🤑 wa-finance

Bot WhatsApp untuk pencatatan keuangan pribadi (teks & foto struk) + dashboard web untuk monitoring.  
Backend menyimpan data di MySQL, melakukan OCR struk via Python (EasyOCR), dan menggunakan AI (DeepSeek) untuk ekstraksi transaksi dari bahasa natural.

---

## Struktur Repo

```
wa-finance/
├── wa-finance-be/   # Backend Node.js (Express) + WhatsApp bot
├── wa-finance-fe/   # Frontend Expo (React Native Web) dashboard
├── .env.example     # Template environment variables
└── docker-compose.yml / docker-compose.prod.yml
```

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| **Backend** | Node.js + Express |
| **WhatsApp** | `whatsapp-web.js` + `qrcode-terminal` |
| **Database** | MySQL (`mysql2`) |
| **OCR** | Python EasyOCR (via `child_process`) + `jimp` (preprocessing) |
| **AI (NLP)** | DeepSeek (via `openai` library) + `lru-cache` |
| **Frontend** | Expo + React Native Web |

## Prasyarat

- **Node.js** (v16+)
- **MySQL** server (lokal atau Docker)
- **Python 3** + `easyocr` (opsional, untuk fitur OCR struk)

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd wa-finance
cp .env.example .env   # edit sesuai kebutuhan
npm run setup           # install semua dependency (root + be + fe)
```

### 2. Setup Database

1. Buat database MySQL (contoh: `wa_finance`)
2. Import skema: jalankan `wa-finance-be/setup.sql`
3. `ensureSchema()` akan otomatis menambahkan tabel/kolom baru saat aplikasi berjalan

### 3. Jalankan

```bash
# Backend + Frontend (tanpa bot WhatsApp)
npm run dev

# Backend + Frontend + Bot WhatsApp (untuk OTP & fitur bot)
npm run dev:bot
```

Saat bot aktif, scan QR code di terminal menggunakan WhatsApp → Linked Devices.

---

## Konfigurasi (.env)

### Wajib

| Variable | Keterangan |
|----------|------------|
| `DB_HOST` | Host database MySQL |
| `DB_USER` | Username database |
| `DB_PASSWORD` | Password database |
| `DB_NAME` | Nama database |

### Opsional (Direkomendasikan)

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port HTTP server |
| `DISABLE_BOT` | `0` | Set `1` untuk matikan bot WhatsApp |
| `DEEPSEEK_API_KEY` | — | API key DeepSeek untuk ekstraksi AI |
| `DEEPSEEK_API_BASE_URL` | `https://api.deepseek.com/v1` | Base URL API DeepSeek |
| `HTTP_API_KEY` | — | Auth lama via header `x-api-key` |
| `QR_AUTH_TOKEN` | *(auto-generated)* | Token untuk akses QR code via HTTP |
| `AUTH_OTP_SECRET` | — | Secret hashing OTP dashboard |
| `CORS_ALLOW_ORIGINS` | `localhost` | Whitelist origin (comma-separated, support `*`) |
| `RECEIPT_RETENTION_DAYS` | — | Hapus struk lama setelah N hari |
| `EXPO_PUBLIC_BASE_URL` | `http://localhost:3000` | Base URL backend untuk frontend |

### OCR

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PYTHON_BIN` | `python` | Path ke binary Python |
| `OCR_TIMEOUT_MS` | `120000` | Timeout OCR dalam ms |
| `OCR_LEXICON_EXTRA` | — | Kata tambahan untuk koreksi OCR (comma-separated) |
| `OCR_DEBUG_SAVE` | `false` | Simpan output OCR debug |

---

## Fitur Utama

### 📱 Input Transaksi via WhatsApp
- **Teks natural** — *"tadi bayar parkir 5000"*
- **Foto struk** (OCR otomatis) atau foto + caption
- **Preview & konfirmasi** sebelum simpan (bisa koreksi field)

### 🖥️ Dashboard Web (Enhanced)
- **Ringkasan keuangan** — Pemasukan, pengeluaran, net, saving rate
- **Daftar transaksi** — Pagination, filter (tanggal, tipe, kategori, merchant), dan pencarian
- **Detail transaksi** — Lihat item transaksi, edit, dan hapus
- **Tambah transaksi** — Form lengkap dengan dropdown kategori/merchant
- **Grafik keuangan** — Visualisasi timeseries (minggu/bulan/tahun)
- **Log audit** — Riwayat aktivitas dengan detail expandable
- **Budget status** — Monitoring budget per kategori
- Login via OTP WhatsApp (nomor HP + token akun)

### 📊 Laporan & Export
- Laporan interaktif (list/buttons jika didukung)
- Export CSV ringkas/detail, range custom

### 💰 Budget & Notifikasi
- Budget bulanan per kategori
- Notifikasi otomatis saat 80% dan 100%

### 🔁 Transaksi Berulang
- Tambah, list, dan nonaktifkan recurring transaction

### 👥 Multi Akun & Sharing
- Akun terpisah (`accounts` + `account_members`)
- Token monitoring (read-only), invite viewer/editor
- Manajemen akses

### 🔧 Operasional
- Healthcheck `/health`, metrics `/metrics`
- QR code via HTTP `/qr`
- Audit log, retention struk

---

## Perintah Bot WhatsApp

### Umum
| Perintah | Keterangan |
|----------|------------|
| `help` / `menu` | Daftar perintah |
| `laporan` | Menu periode laporan |
| `cari <keyword>` | Cari transaksi (+ `page <n>` untuk pagination) |

### Transaksi
| Perintah | Keterangan |
|----------|------------|
| `undo` / `batal` | Batalkan transaksi terakhir |
| `undo kembali` | Restore transaksi yang dibatalkan |
| `edit transaksi terakhir jumlah <n>` | Edit nominal terakhir |
| `edit transaksi <id> jumlah <n>` | Edit nominal berdasarkan ID |
| `hapus transaksi <id>` | Hapus transaksi |
| `set currency <IDR\|USD\|EUR>` | Ubah mata uang |

### Export
| Perintah | Keterangan |
|----------|------------|
| `export ringkas <periode>` | Export CSV ringkas |
| `export detail <periode>` | Export CSV per-item |
| `export YYYY-MM-DD YYYY-MM-DD` | Export range custom |
| `struk terakhir` | Kirim file struk terakhir |

### Budget & Recurring
| Perintah | Keterangan |
|----------|------------|
| `budget set <kategori> <jumlah>` | Set budget |
| `budget list` | Status budget bulan ini |
| `ulang tambah <in\|out> <jumlah> <kategori> ; <ket> ; <tgl>` | Tambah recurring |
| `ulang list` | List recurring |
| `ulang hapus <id>` | Nonaktifkan recurring |

### Kategori & Merchant
| Perintah | Keterangan |
|----------|------------|
| `kategori list` / `kategori tambah <nama>` | Kelola kategori |
| `kategori map <keyword> => <kategori>` | Mapping keyword → kategori |
| `merchant map <keyword> => <merchant>` | Normalisasi merchant |
| `kategori rules` / `merchant rules` | Lihat daftar mapping |

### Akun & Akses
| Perintah | Keterangan |
|----------|------------|
| `akun` / `akun pilih <n>` / `akun baru` | Kelola akun |
| `token` / `token reset` | Token akun (owner only) |
| `pakai token <token>` | Monitoring akun lain (read-only) |
| `monitor off` | Kembali ke akun sendiri |
| `invite` / `invite editor` | Buat invite viewer/editor |
| `invite list` / `invite cabut <id>` | Kelola invite |
| `akses list` / `akses cabut <user_id>` | Kelola member |

---

## HTTP API

Server default: `http://localhost:3000`

### Endpoint Publik

| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/health` | Healthcheck (DB, Python, schema) |
| `GET` | `/metrics` | Metrics internal |
| `GET` | `/qr?token=<QR_AUTH_TOKEN>` | QR code WhatsApp (PNG) |
| `GET` | `/debug/config` | Debug config (localhost only) |
| `GET` | `/debug/cors` | Debug CORS (localhost only) |

### Auth (OTP via WhatsApp)

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/auth/request-otp` | `{ phone, token }` |
| `POST` | `/api/auth/verify-otp` | `{ phone, token, otp }` → `{ sessionToken, currency }` |

### Dashboard
Auth: `Authorization: Bearer <sessionToken>`

| Method | Path | Query Params |
|--------|------|--------------|
| `GET` | `/api/dashboard/summary` | `start`, `end`, `currency` |
| `GET` | `/api/dashboard/timeseries` | `start`, `end`, `bucket`, `currency` |
| `GET` | `/api/dashboard/by-category` | `start`, `end`, `type`, `limit`, `currency` |
| `GET` | `/api/dashboard/by-merchant` | `start`, `end`, `type`, `limit`, `currency` |
| `GET` | `/api/dashboard/budget-status` | `month`, `currency` |
| `GET` | `/api/dashboard/categories` | — (list kategori) |
| `GET` | `/api/dashboard/merchants` | — (list merchant) |

### Transaksi (CRUD)

| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/api/transactions` | List transaksi (dengan pagination & filter) |
| `GET` | `/api/transactions/:id` | Detail transaksi |
| `POST` | `/api/transactions` | Buat transaksi baru |
| `PUT` | `/api/transactions/:id` | Update transaksi |
| `DELETE` | `/api/transactions/:id` | Hapus transaksi (soft delete) |

**Body POST/PUT `/api/transactions`:**
```json
{
  "transaction_date": "2024-01-15",
  "type": "OUT",
  "amount": 50000,
  "currency": "IDR",
  "category": "Makanan",
  "merchant": "Warung Pak Budi",
  "description": "Makan siang",
  "items": [
    { "item_name": "Nasi Goreng", "quantity": 1, "price": 25000 }
  ]
}
```

### Audit & Import

| Method | Path | Query Params |
|--------|------|--------------|
| `GET` | `/api/audit` | `start`, `end`, `action`, `limit`, `offset` |
| `POST` | `/api/import/statement` | Body: `{ csv, dryRun }` |

---

## Dashboard Web (Login OTP)

1. Isi nomor HP WhatsApp dan token akun
2. Klik **Kirim OTP WhatsApp** (kode masuk ke WhatsApp)
3. Masukkan OTP 6 digit
4. Klik **Verifikasi & Masuk**

> Token akun didapat dari bot WhatsApp: kirim `token` (khusus owner).

### Fitur Dashboard Web

| Fitur | Keterangan |
|-------|------------|
| **📊 Dashboard** | Ringkasan keuangan, top kategori, top merchant, budget status |
| **💳 Transaksi** | Daftar transaksi dengan filter, pencarian, dan pagination |
| **➕ Tambah** | Form tambah transaksi baru dengan dropdown kategori/merchant |
| **📈 Grafik** | Visualisasi pemasukan/pengeluaran (minggu/bulan/tahun) |
| **📋 Audit** | Log aktivitas dengan detail expandable |

Navigasi menggunakan bottom tab bar dengan tombol FAB (+) untuk tambah transaksi cepat.

---

## Deployment

### Coolify (Rekomendasi untuk Production)

Proyek ini sudah disiapkan untuk integrasi mudah dengan [Coolify](https://coolify.io/).

1. Tambahkan resource baru di Coolify: **Project -> New -> Git Repository** (atau Docker Compose jika menggunakan kode lokal).
2. Tentukan repository Git proyek Anda.
3. Pada tab **Configuration**, ubah build pack ke **Docker Compose**.
4. Di textbox Docker Compose, Anda bisa melakukan salah satu dari dua cara berikut:
   - Pilih file `docker-compose.coolify.yml`.
   - Atau langsung isi isinya jika menggunakan text editor bawaan Coolify.
5. Pastikan semua Environment Variables di dalam Coolify terisi (khususnya `HTTP_API_KEY`, `DEEPSEEK_API_KEY`, `AUTH_OTP_SECRET`, dan `EXPO_PUBLIC_BASE_URL`).
   - `EXPO_PUBLIC_BASE_URL` adalah URL publik backend Anda (contoh: `https://api.domain-anda.com`).
6. Atur routing subdomain/domain di menu **Domains** di dalam container `frontend` dan `backend` di konfigurasi Coolify:
   - Container `frontend`: misalnya `https://app.domain-anda.com`
   - Container `backend`: misalnya `https://api.domain-anda.com`
7. Klik **Deploy**.

> **Note:** `docker-compose.coolify.yml` secara sengaja tidak mem-bind port ke host (contohnya port 3000 atau 3306) untuk menghindari bentrok port pada instance server Coolify Anda. Coolify internal proxy (Traefik/Caddy) akan secara otomatis menangani routing dari web ke container melalui internal docker network.

### Docker Compose Lokal

```bash
npm run docker:up    # build & start
npm run docker:down  # stop
```

### PM2

```bash
npm --prefix wa-finance-be run start:pm2
```

### Build Web untuk Production

```bash
npm run build:web    # output ke wa-finance-be/public/web/
npm run deploy:web   # build + start backend
```

---

## Testing

```bash
npm test   # backend unit tests + frontend typecheck
```

## Evaluasi OCR (Batch)

```bash
node wa-finance-be/scripts/ocr_eval.js path\to\folder\images
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| CORS error dari web | Set `CORS_ALLOW_ORIGINS` mencakup origin FE (contoh: `http://localhost:*`) |
| OTP tidak terkirim | Pastikan bot aktif (`npm run dev:bot`) dan QR sudah discan |
| `/health` 503 | Cek DB, Python EasyOCR, atau schema — lihat detail JSON response |
| OCR lambat/timeout | Naikkan `OCR_TIMEOUT_MS`, cek `PYTHON_BIN` |
| "Unknown column …" | Restart aplikasi agar `ensureSchema()` migrasi kolom baru |
