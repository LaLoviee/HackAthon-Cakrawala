const crypto = require('crypto');

// Tanpa karakter yang mirip (0/O, 1/I) agar mudah diketik dari layar proyektor
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 karakter

function generateCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

module.exports = { generateCode };
