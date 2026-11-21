const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const { AppError } = require('../utils/errors');

// Memakai service_role key: backend yang menegakkan hak akses, bukan RLS.
const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Buka hasil query; lempar error generik jika gagal (detail hanya di log server)
function unwrap({ data, error }) {
  if (error) {
    console.error('[supabase]', error.message);
    throw new AppError(500, 'DB_ERROR', 'Terjadi kesalahan pada database');
  }
  return data;
}

async function checkConnection() {
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    throw new Error(`Gagal terhubung ke Supabase: ${error.message}. Cek URL/key di .env dan pastikan supabase/schema.sql sudah dijalankan.`);
  }
  console.log('[db] terhubung ke Supabase');
}

module.exports = { supabase, unwrap, checkConnection };
