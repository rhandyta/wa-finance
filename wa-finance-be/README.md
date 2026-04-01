# wa-finance-be

Backend Node.js (Express) untuk bot WhatsApp keuangan.  
Lihat [README utama](../README.md) untuk dokumentasi lengkap monorepo.

---

## Arsitektur

```
src/
├── index.js          # Entry point (HTTP server + bot + scheduler)
├── config.js         # Konfigurasi dari .env
├── ai.js             # Integrasi DeepSeek AI + LRU cache
├── ocr.js            # OCR wrapper (preprocessing jimp + EasyOCR Python)
├── ocr_easyocr.py    # Script Python EasyOCR
├── file-saver.js     # Simpan file struk ke disk
├── logger.js         # Structured JSON logger
├── metrics.js        # Counter & gauge metrics internal
├── qr-store.js       # In-memory QR code storage + auth token
│
├── bot/              # WhatsApp bot handlers
│   ├── index.js      # Client setup, QR, message routing
│   ├── account.js    # Akun, token, invite, akses
│   ├── category.js   # Kategori commands
│   ├── merchant.js   # Merchant commands
│   ├── report.js     # Laporan interaktif
│   ├── state.js      # User state management
│   ├── utils.js      # Helper functions
│   ├── interactive.js # Interactive message support
│   └── transaction/  # Transaksi: process, pending, export, budget, recurring
│
├── db/               # Database layer (MySQL)
│   ├── pool.js       # Connection pool
│   ├── schema.js     # Auto-migration (ensureSchema)
│   ├── schemaCheck.js # Schema validation untuk healthcheck
│   ├── accounts.js   # CRUD akun & membership
│   ├── transactions.js # CRUD transaksi
│   ├── budgets.js    # Budget bulanan
│   ├── recurring.js  # Transaksi berulang
│   ├── categories.js # Kategori & mapping
│   ├── merchants.js  # Merchant & mapping
│   ├── dashboard.js  # Query dashboard (summary, timeseries, breakdown)
│   └── ...
│
├── http/             # HTTP server
│   ├── app.js        # Express app (CORS, rate-limit, auth middleware)
│   ├── routes.js     # Root routes (/health, /metrics, /qr)
│   └── api/          # /api/* routes (auth, dashboard, transactions, audit, import)
│
├── import/           # CSV import parser
├── jobs/             # Scheduled jobs (receipt retention)
└── ocr/              # OCR post-processing
```

## Menjalankan

```bash
# Development (dari root monorepo)
npm run dev        # tanpa bot
npm run dev:bot    # dengan bot

# Standalone
node src/index.js

# PM2
npm run start:pm2

# Docker
docker compose up --build
```

## Environment Variables

Semua env disimpan di file `.env` di **root monorepo** (bukan di folder ini).  
Lihat [konfigurasi lengkap di README utama](../README.md#konfigurasi-env).

## API Reference

Lihat [HTTP API di README utama](../README.md#http-api).

## Testing

```bash
npm test     # menjalankan node --test
```

Test files:
- `test/csv.test.js` — CSV import parsing
- `test/health.test.js` — Healthcheck endpoint
- `test/logger.test.js` — Logger & masking
- `test/monitor_off.test.js` — Monitor off flow
- `test/ocr_postprocess.test.js` — OCR post-processing
- `test/utils.test.js` — Bot utility functions

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `/health` 503 | Cek `schema.missingTables/missingColumns` di response |
| OCR lambat/timeout | Naikkan `OCR_TIMEOUT_MS`, aktifkan `OCR_DEBUG_SAVE=true` |
| "Unknown column" | Restart app agar `ensureSchema()` migrasi |
| Python error | Cek `PYTHON_BIN` dan `python -c "import easyocr; print(1)"` |

## Backup & Restore

```bash
# Backup
mysqldump -u <user> -p <db_name> > backup.sql

# Restore
mysql -u <user> -p <db_name> < backup.sql
```
