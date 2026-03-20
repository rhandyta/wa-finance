# wa-finance (monorepo)

Bot WhatsApp untuk pencatatan keuangan (teks & foto struk) + dashboard web untuk monitoring. Backend menyimpan data di MySQL, melakukan OCR struk via Python (EasyOCR), dan bisa menggunakan AI (DeepSeek) untuk ekstraksi transaksi dari bahasa natural.

## Struktur Repo

- `wa-finance-be`: backend Node.js (Express) + WhatsApp bot (`whatsapp-web.js`)
- `wa-finance-fe`: frontend Expo (React Native Web) untuk dashboard

## Stack Teknologi

- **Backend**: Node.js + Express
- **WhatsApp**: `whatsapp-web.js` + `qrcode-terminal`
- **Database**: MySQL (`mysql2`)
- **OCR**: Python EasyOCR (dipanggil dari Node via `child_process`)
- **AI (NLP)**: DeepSeek (via `openai` library)
- **Frontend**: Expo + React Native Web

## Prasyarat

- Node.js (disarankan versi modern; minimal sesuai Expo yang digunakan)
- MySQL server (lokal atau docker)
- Python + EasyOCR (opsional, tapi diperlukan kalau mau OCR struk)

## Fitur Utama

- **Input transaksi dari chat WhatsApp**
  - Teks natural (contoh: “tadi bayar parkir 5000”)
  - Foto struk (OCR), atau foto + caption
  - Preview & konfirmasi sebelum simpan (bisa koreksi field sebelum `ok`)
- **Kelola transaksi**
  - Undo/batal dan restore
  - Edit transaksi terakhir / berdasarkan ID
  - Hapus transaksi (dengan audit log)
  - Pencarian transaksi (`cari <keyword>`, pagination)
- **Laporan & export**
  - Flow `laporan` (interactive list/buttons jika didukung)
  - Export CSV ringkas/detail, range custom
- **Budget & notifikasi**
  - Budget bulanan per kategori, status (ok/warn/over)
  - Notifikasi saat melewati ambang tertentu
- **Transaksi berulang**
  - Tambah/list/nonaktif transaksi recurring
- **Multi akun & sharing akses**
  - Akun (`accounts`) dan membership (`account_members`)
  - Token monitoring (`token`, `pakai token <token>`, `monitor off`)
  - Invite single-use (viewer/editor) dan manajemen akses
- **Dashboard web**
  - Ringkasan, timeseries, top kategori/merchant, budget status
  - Login tanpa API key: nomor HP + token akun + OTP WhatsApp
- **Operasional**
  - Healthcheck `/health`, metrics `/metrics`
  - Retention struk (opsional)
  - Audit log untuk aksi penting

## Setup Database

1. Buat database (contoh: `wa_finance`)
2. Import skema awal dari [setup.sql](file:///d:/Project/Real%20Project/wa-finance/wa-finance-be/setup.sql)
3. Saat aplikasi berjalan, `ensureSchema()` akan membantu menambahkan tabel/kolom yang belum ada (migrasi ringan)

## Konfigurasi (.env)

Gunakan file `.env` di root repo (contoh: `.env.example`).

**Minimal agar jalan**
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_PORT` (opsional; kalau kosong, driver pakai default MySQL)
- `PORT` (default 3000)
- `DISABLE_BOT` (0 aktifkan bot, 1 matikan bot)
- `EXPO_PUBLIC_BASE_URL` (default `http://localhost:3000`)

**Opsional (direkomendasikan)**
- `DEEPSEEK_API_KEY`, `DEEPSEEK_API_BASE_URL` (untuk ekstraksi AI)
- `HTTP_API_KEY` (opsional, dukung auth lama `x-api-key`)
- `AUTH_OTP_SECRET` (secret hashing OTP dashboard)
- `CORS_ALLOW_ORIGINS` (whitelist origin web, comma-separated; support wildcard `*`, contoh `http://localhost:*`)
- `RECEIPT_RETENTION_DAYS` (hapus struk lama setelah N hari)

**Env terkait OCR**
- `PYTHON_BIN` (default `python`)
- `OCR_TIMEOUT_MS` (default internal; gunakan env untuk menaikkan timeout)
- `OCR_LEXICON_EXTRA` (opsional; daftar kata dipisah koma untuk bantu koreksi)
- `OCR_DEBUG_SAVE` (opsional; simpan output debug OCR)

## Menjalankan (Dev)

Salin env:

```bash
copy .env.example .env
```

Install semua dependency:

```bash
npm run setup
```

Jalankan backend + frontend (tanpa bot):

```bash
npm run dev
```

Jalankan backend + frontend + bot (untuk OTP WhatsApp & fitur bot):

```bash
npm run dev:bot
```

Saat bot aktif, scan QR di terminal menggunakan WhatsApp (Linked Devices).

## Dashboard Web (Login OTP WhatsApp)

1. Isi nomor HP WhatsApp dan token akun.
2. Klik **Kirim OTP WhatsApp** (kode masuk ke WhatsApp).
3. Masukkan OTP 6 digit.
4. Klik **Verifikasi & Masuk**.

Token akun bisa didapat dari bot WhatsApp: kirim `token` (khusus owner).

## Perintah Bot WhatsApp (Ringkas)

- `help` / `menu`
- `laporan`
- `cari <keyword>` / `cari <keyword> page <n>`
- `export ringkas <periode>` / `export detail <periode>` / `export YYYY-MM-DD YYYY-MM-DD`
- `struk terakhir`
- `undo` / `batal` / `undo kembali`
- `edit transaksi terakhir jumlah <angka>`
- `edit transaksi <id> jumlah <angka>`
- `hapus transaksi <id>`
- `set currency <IDR|USD|EUR>`
- `budget set <kategori> <jumlah>` / `budget list`
- `ulang tambah <in|out> <jumlah> <kategori> ; <keterangan> ; <tgl 1-28>`
- `ulang list` / `ulang hapus <id>`
- `kategori list` / `kategori tambah <nama>` / `kategori map <keyword> => <kategori>` / `kategori rules`
- `merchant map <keyword> => <merchant>` / `merchant rules`
- Akun & akses:
  - `akun` / `akun pilih <nomor>` / `akun baru`
  - `token` / `token reset` / `pakai token <token>` / `monitor off`
  - `invite` / `invite editor` / `invite list` / `invite cabut <id>`
  - `akses list` / `akses cabut <user_id>`

## HTTP API (Backend)

Server default di `http://localhost:3000`.

- Healthcheck: `GET /health`
- Metrics: `GET /metrics`
- Debug config: `GET /debug/config`

**Auth Dashboard (OTP via WhatsApp)**
- `POST /api/auth/request-otp` body: `{ phone, token }`
- `POST /api/auth/verify-otp` body: `{ phone, token, otp }` → return `{ sessionToken, currency }`

**Dashboard**
- `GET /api/dashboard/summary?start=YYYY-MM-DD&end=YYYY-MM-DD&currency=IDR`
- `GET /api/dashboard/timeseries?start=...&end=...&bucket=day&currency=...`
- `GET /api/dashboard/by-category?start=...&end=...&type=OUT&limit=...&currency=...`
- `GET /api/dashboard/by-merchant?start=...&end=...&type=OUT&limit=...&currency=...`
- `GET /api/dashboard/budget-status?month=YYYY-MM&currency=...`

**Transaksi**
- `GET /api/transactions?...` (filter `start/end/type/category/merchant/q`, pagination `limit/offset`, `includeItems`)
- `GET /api/transactions/:id`

**Audit**
- `GET /api/audit?start=...&end=...&action=...&limit=...&offset=...`

**Import**
- `POST /api/import/statement` body: `{ csv, dryRun }`

Catatan: endpoint `/api/*` bisa diakses pakai `Authorization: Bearer <sessionToken>` (dashboard), dan opsional masih mendukung `x-api-key` jika `HTTP_API_KEY` diset.

## Docker & PM2 (Backend)

- Docker: jalankan dari `wa-finance-be/docker-compose.yml`
- PM2: `npm --prefix wa-finance-be run start:pm2`

## Evaluasi OCR (Batch)

Jalankan evaluasi OCR untuk folder gambar:

```bash
node wa-finance-be/scripts/ocr_eval.js path\to\folder\images
```

## Troubleshooting

- **CORS error dari web**: set `CORS_ALLOW_ORIGINS` agar mencakup origin FE (contoh `http://localhost:*`)
- **OTP tidak terkirim**: pastikan bot aktif (`npm run dev:bot`) dan QR sudah discan
- **`/health` 503**: biasanya DB belum siap atau Python EasyOCR tidak tersedia (cek detail JSON response)
- **OCR lambat/timeout**: naikkan `OCR_TIMEOUT_MS` atau set `PYTHON_BIN` yang benar

## Testing

Jalankan test backend + typecheck frontend:

```bash
npm test
```
