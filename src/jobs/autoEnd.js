const env = require('../config/env');
const { supabase, unwrap } = require('../config/supabase');
const sessionService = require('../services/session.service');
const board = require('../services/board.service');
const realtime = require('../utils/realtime');
const { toSession } = require('../utils/dbHelpers');

// Dosen lupa End Session -> akhiri otomatis.
// Aturan: (tidak ada aktivitas > INACTIVITY_MINUTES DAN dosen tidak terhubung) ATAU durasi > MAX_SESSION_MINUTES.
async function tick() {
  const now = Date.now();
  const live = unwrap(await supabase.from('sessions').select('*').eq('status', 'live')).map(toSession);
  for (const s of live) {
    try {
      const last = board.getLastActivity(s.id) ?? (s.lastActivityAt || s.startedAt || s.createdAt).getTime();
      const hostOnline = realtime.onlineUserIds(s.id).has(s.hostId);
      const idle = now - last > env.inactivityMinutes * 60_000 && !hostOnline;
      const tooLong = s.startedAt && now - s.startedAt.getTime() > env.maxSessionMinutes * 60_000;
      if (idle || tooLong) {
        await sessionService.endSession(s, idle ? 'auto-inactivity' : 'auto-max-duration');
        console.log(`[job] sesi ${s.code} diakhiri otomatis`);
      }
    } catch (err) {
      console.error('[job] gagal mengakhiri sesi:', err.message);
    }
  }
}

function startAutoEndJob() {
  setInterval(() => tick().catch((e) => console.error('[job]', e.message)), 60_000).unref();
}

module.exports = { startAutoEndJob };
