require('dotenv').config();

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4000),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-ganti-di-produksi',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  frontendUrl,
  corsOrigins: (process.env.CORS_ORIGINS || frontendUrl).split(',').map((s) => s.trim()),
  siakadMode: process.env.SIAKAD_MODE || 'mock',
  siakadBaseUrl: process.env.SIAKAD_BASE_URL || '',
  inactivityMinutes: num(process.env.INACTIVITY_MINUTES, 45),
  maxSessionMinutes: num(process.env.MAX_SESSION_MINUTES, 240),
  maxActiveWriters: num(process.env.MAX_ACTIVE_WRITERS, 15),
};

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di file .env');
}

if (env.nodeEnv === 'production') {
  if (env.jwtSecret.startsWith('dev-secret')) throw new Error('JWT_SECRET wajib diisi di production');
  if (env.siakadMode === 'mock') throw new Error('SIAKAD_MODE=mock tidak boleh dipakai di production');
}

module.exports = env;
