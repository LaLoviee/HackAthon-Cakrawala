const env = require('../config/env');
const { supabase, unwrap } = require('../config/supabase');
const { AppError } = require('../utils/errors');
const { toSession } = require('../utils/dbHelpers');
const { opSchema } = require('../schemas/board.schema');
const { createState, applyOp, serialize } = require('../utils/boardState');
const realtime = require('../utils/realtime');

const MAX_OBJECTS_PER_PAGE = 5000;
const MAX_PAGES = 500;
const WRITER_WINDOW_MS = 10_000;
const DB_PAGE = 1000; // batas baris per request di Supabase (default max-rows = 1000)
const EVENTS_PAGE_MAX = 900;

/**
 * "Room" = state sesi live yang disimpan di memori (single node).
 * Dibuat saat Start Session, atau dimuat ulang dari event di DB jika server restart.
 */
const rooms = new Map(); // sessionId -> room
const loading = new Map(); // sessionId -> Promise<room> (cegah load ganda)

function metaFrom(s) {
  return {
    status: s.status,
    hostId: s.hostId,
    accessMode: s.accessMode,
    revoked: new Set(s.revokedWriters),
    startedAt: s.startedAt ? s.startedAt.getTime() : Date.now(),
  };
}

// Lipat event dari DB ke state (opsional sampai seq/t tertentu). Mengembalikan seq terakhir.
async function foldFromDb(state, sessionId, { upToSeq, upToT } = {}) {
  let from = 0;
  let lastSeq = 0;
  for (;;) {
    let q = supabase
      .from('board_events')
      .select('seq, op')
      .eq('session_id', sessionId)
      .order('seq', { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (upToSeq != null) q = q.lte('seq', upToSeq);
    if (upToT != null) q = q.lte('t', upToT);
    const rows = unwrap(await q);
    for (const r of rows) {
      applyOp(state, r.op);
      lastSeq = r.seq;
    }
    if (rows.length < DB_PAGE) break;
    from += DB_PAGE;
  }
  return lastSeq;
}

async function loadRoom(id) {
  const row = unwrap(await supabase.from('sessions').select('*').eq('id', id).maybeSingle());
  if (!row) throw new AppError(404, 'SESSION_NOT_FOUND', 'Sesi tidak ditemukan');
  const s = toSession(row);
  const state = createState();
  const seq = await foldFromDb(state, id);
  return {
    id,
    meta: metaFrom(s),
    state,
    seq,
    writers: new Map(),
    lastActivity: s.lastActivityAt ? s.lastActivityAt.getTime() : Date.now(),
  };
}

async function getRoom(sessionId) {
  const id = String(sessionId);
  if (rooms.has(id)) return rooms.get(id);
  if (!loading.has(id)) {
    loading.set(
      id,
      loadRoom(id)
        .then((room) => {
          if (room.meta.status === 'live') rooms.set(id, room); // draft/ended tidak di-cache
          return room;
        })
        .finally(() => loading.delete(id))
    );
  }
  return loading.get(id);
}

function openRoom(session) {
  rooms.set(session.id, {
    id: session.id,
    meta: metaFrom(session),
    state: createState(),
    seq: 0,
    writers: new Map(),
    lastActivity: Date.now(),
  });
}
function syncMeta(session) {
  const r = rooms.get(session.id);
  if (r) r.meta = metaFrom(session);
}
function closeRoom(sessionId) {
  rooms.delete(String(sessionId));
}
function getLastActivity(sessionId) {
  const r = rooms.get(String(sessionId));
  return r ? r.lastActivity : null;
}

// ---------- izin ----------
function canWrite(meta, user) {
  if (meta.status !== 'live') return false;
  if (user.id === meta.hostId) return true;
  return user.role === 'mahasiswa' && meta.accessMode === 'student_write' && !meta.revoked.has(user.id);
}

async function canUserWrite(sessionId, user) {
  const room = await getRoom(sessionId);
  return canWrite(room.meta, user);
}

function trackWriter(room, userId) {
  const now = Date.now();
  for (const [uid, ts] of room.writers) if (now - ts > WRITER_WINDOW_MS) room.writers.delete(uid);
  if (!room.writers.has(userId) && room.writers.size >= env.maxActiveWriters) {
    throw new AppError(429, 'TOO_MANY_WRITERS', 'Terlalu banyak penulis aktif, coba lagi sebentar');
  }
  room.writers.set(userId, now);
}

// ---------- tulis event ke Supabase (dibatch tiap 500 ms agar ringan) ----------
let buffer = [];
let chain = Promise.resolve();

async function doFlush() {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  try {
    // upsert + ignoreDuplicates: aman jika batch yang sama dicoba ulang
    unwrap(await supabase.from('board_events').upsert(batch, { onConflict: 'session_id,seq', ignoreDuplicates: true }));
    const ids = [...new Set(batch.map((e) => e.session_id))];
    const now = new Date().toISOString();
    await Promise.all(ids.map((id) => supabase.from('sessions').update({ last_activity_at: now }).eq('id', id)));
  } catch (err) {
    console.error('[board] gagal menyimpan event:', err.message);
    buffer = batch.concat(buffer); // coba lagi di flush berikutnya
  }
}
function flushEvents() {
  chain = chain.then(doFlush);
  return chain;
}
function startFlusher() {
  setInterval(flushEvents, 500).unref();
}

// ---------- inti: terima op -> validasi -> beri seq -> simpan -> siarkan ----------
async function handleOp({ sessionId, user, clientOpId, rawOp }) {
  const room = await getRoom(sessionId);
  const { meta } = room;

  if (meta.status !== 'live') throw new AppError(409, 'SESSION_NOT_LIVE', 'Sesi belum dimulai atau sudah berakhir');
  if (!canWrite(meta, user)) throw new AppError(403, 'WRITE_FORBIDDEN', 'Kamu tidak punya izin menulis di board ini');

  const parsed = opSchema.safeParse(rawOp);
  if (!parsed.success) throw new AppError(400, 'INVALID_OP', 'Format aksi tidak valid');
  const op = parsed.data;
  const isHost = user.id === meta.hostId;

  if (!isHost && !['object.add', 'object.update', 'object.remove'].includes(op.type)) {
    throw new AppError(403, 'HOST_ONLY', 'Aksi ini hanya untuk dosen');
  }

  // --- setelah baris ini tidak ada await sampai event dikirim -> urutan seq pasti konsisten ---
  const pageMap = op.type === 'page.add' ? null : room.state.pages[op.page];
  if (op.type !== 'page.add' && !pageMap) throw new AppError(400, 'INVALID_PAGE', 'Halaman tidak ada');

  switch (op.type) {
    case 'object.add':
      if (pageMap.has(op.object.id)) throw new AppError(409, 'DUPLICATE_OBJECT', 'ID objek sudah dipakai');
      if (pageMap.size >= MAX_OBJECTS_PER_PAGE) throw new AppError(413, 'PAGE_FULL', 'Halaman terlalu penuh, tambah halaman baru');
      op.object.authorId = user.id; // server yang menentukan pemilik objek
      break;
    case 'object.update': {
      const obj = pageMap.get(op.id);
      if (!obj) throw new AppError(404, 'OBJECT_NOT_FOUND', 'Objek tidak ditemukan');
      if (!isHost && obj.authorId !== user.id) throw new AppError(403, 'NOT_OWNER', 'Hanya bisa mengubah coretan sendiri');
      break;
    }
    case 'object.remove':
      if (!isHost) {
        for (const oid of op.ids) {
          const obj = pageMap.get(oid);
          if (obj && obj.authorId !== user.id) throw new AppError(403, 'NOT_OWNER', 'Hanya bisa menghapus coretan sendiri');
        }
      }
      break;
    case 'page.add':
      if (room.state.pages.length >= MAX_PAGES) throw new AppError(413, 'TOO_MANY_PAGES', 'Jumlah halaman maksimum tercapai');
      op.page = room.state.pages.length; // indeks halaman baru
      break;
    default:
      break;
  }
  if (!isHost) trackWriter(room, user.id);

  const seq = ++room.seq;
  const t = Math.max(0, Date.now() - meta.startedAt);
  applyOp(room.state, op);
  room.lastActivity = Date.now();
  buffer.push({ session_id: sessionId, seq, t, author_id: user.id, op });

  if (op.type === 'page.add') {
    supabase
      .from('sessions')
      .update({ page_count: room.state.pages.length })
      .eq('id', sessionId)
      .then(({ error }) => error && console.error('[board]', error.message));
  }

  const event = { seq, t, author: user.id, clientOpId: clientOpId || null, op };
  realtime.emitToSession(sessionId, 'board:op', event); // dikirim sinkron -> urutan emit = urutan seq
  return event;
}

// ---------- baca (history, replay, join terlambat, reconnect) ----------
async function getEvents(sessionId, { afterSeq = 0, limit = 500 } = {}) {
  await flushEvents();
  const lim = Math.min(limit, EVENTS_PAGE_MAX);
  const rows = unwrap(
    await supabase
      .from('board_events')
      .select('seq, t, author_id, op')
      .eq('session_id', sessionId)
      .gt('seq', afterSeq)
      .order('seq', { ascending: true })
      .limit(lim + 1)
  );
  const hasMore = rows.length > lim;
  if (hasMore) rows.pop();
  const events = rows.map((e) => ({ seq: e.seq, t: e.t, author: e.author_id, op: e.op }));
  return { events, hasMore, lastSeq: events.length ? events[events.length - 1].seq : afterSeq };
}

async function getSnapshot(session, { upToSeq, upToT } = {}) {
  if (session.status === 'live' && upToSeq == null && upToT == null) {
    const room = await getRoom(session.id);
    return { state: serialize(room.state), lastSeq: room.seq };
  }
  await flushEvents();
  const state = createState();
  const lastSeq = await foldFromDb(state, session.id, { upToSeq, upToT });
  return { state: serialize(state), lastSeq };
}

module.exports = {
  EVENTS_PAGE_MAX,
  startFlusher,
  flushEvents,
  openRoom,
  syncMeta,
  closeRoom,
  getLastActivity,
  canUserWrite,
  handleOp,
  getEvents,
  getSnapshot,
};
