const env = require('../config/env');
const { AppError } = require('../utils/errors');

const ROLE_MAP = { dosen: 'dosen', lecturer: 'dosen', mahasiswa: 'mahasiswa', student: 'mahasiswa' };

/**
 * Adapter SIAKAD. Semua kode lain hanya memanggil verifyToken().
 * - mock : token "mock:<siakadId>:<dosen|mahasiswa>:<nama>" (hanya development)
 * - http : memanggil `${SIAKAD_BASE_URL}/sso/verify` dengan header Bearer.
 *          ASUMSI respons: { id, name, email, role }  -> sesuaikan bila API SIAKAD berbeda.
 */
async function verifyToken(token) {
  return env.siakadMode === 'mock' ? verifyMock(token) : verifyHttp(token);
}

function verifyMock(token) {
  const [prefix, siakadId, role, ...nameParts] = token.split(':');
  if (prefix !== 'mock' || !siakadId || !ROLE_MAP[role]) {
    throw new AppError(401, 'INVALID_SIAKAD_TOKEN', 'Token SIAKAD tidak valid (format mock: mock:<id>:<dosen|mahasiswa>:<nama>)');
  }
  return { siakadId, role: ROLE_MAP[role], name: nameParts.join(':') || siakadId, email: null };
}

async function verifyHttp(token) {
  if (!env.siakadBaseUrl) throw new AppError(500, 'SIAKAD_NOT_CONFIGURED', 'SIAKAD_BASE_URL belum diatur');
  let res;
  try {
    res = await fetch(`${env.siakadBaseUrl}/sso/verify`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new AppError(502, 'SIAKAD_UNREACHABLE', 'SIAKAD tidak dapat dihubungi');
  }
  if (!res.ok) throw new AppError(401, 'INVALID_SIAKAD_TOKEN', 'Akun tidak terverifikasi oleh SIAKAD');
  const d = await res.json();
  const role = ROLE_MAP[String(d.role || '').toLowerCase()];
  if (!d.id || !role) throw new AppError(403, 'ROLE_NOT_ALLOWED', 'Akun bukan dosen atau mahasiswa');
  return { siakadId: String(d.id), name: d.name || String(d.id), email: d.email || null, role };
}

module.exports = { verifyToken };
