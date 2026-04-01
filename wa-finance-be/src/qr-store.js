// QR Code storage module (avoids circular dependency)
const crypto = require('crypto');

let lastQrCode = null;
let qrTimestamp = null;

// Generate QR auth token on startup (or use env var)
const QR_AUTH_TOKEN = process.env.QR_AUTH_TOKEN || crypto.randomBytes(32).toString('base64url');

function setQrCode(qr) {
  lastQrCode = qr;
  qrTimestamp = Date.now();
}

function getQrCode() {
  return { qr: lastQrCode, timestamp: qrTimestamp };
}

function getQrAuthToken() {
  return QR_AUTH_TOKEN;
}

module.exports = { setQrCode, getQrCode, getQrAuthToken };
