const QRCode = require('qrcode');
const env = require('../config/env');
const { supabase, unwrap } = require('../config/supabase');
const board = require('./board.service');
const realtime = require('../utils/realtime');
const { generateCode } = require('../utils/code');
const { AppError } = require('../utils/errors');
const { isUuid, SESSION_SELECT, toSession } = require('../utils/dbHelpers');

async function findSession(id) {
  if (!isUuid(id)) throw new AppError(404, 'SESSION_NOT_FOUND', 'Sesi tidak ditemukan');
  const row = unwrap(await supabase.from('sessions').select(SESSION_SELECT).eq('id', id).maybeSingle());
  if (!row) throw new AppError(404, 'SESSION_NOT_FOUND', 'Sesi tidak ditemukan');
  return toSession(row);
}

// Update lalu kembalikan sesi terbaru (dengan data kelas & host)
async function saveSession(id, patch) {
  const row = unwrap(await supabase.from('sessions').update(patch).eq('id', id).select(SESSION_SELECT).single());
  return toSession(row);
}

async function assertHost(sessionId, user) {
  const s = await findSession(sessionId);
  if (s.hostId !== user.id) throw new AppError(403, 'NOT_HOST', 'Hanya dosen pemilik sesi yang boleh melakukan ini');
  return s;
}

// Host, atau mahasiswa yang sudah join (join memvalidasi kode + kelas)
async function assertAccess(sessionId, user) {
  const s = await findSession(sessionId);
  if (s.hostId === user.id) return s;
  if (user.role === 'mahasiswa') {
    const p = unwrap(
      await supabase.from('participants').select('user_id').eq('session_id', s.id).eq('user_id', user.id).maybeSingle()
    );
    if (p) return s;
  }
  throw new AppError(403, 'NOT_PARTICIPANT', 'Kamu bukan peserta sesi ini');
}

async function toDTO(session, user, { withQr = false } = {}) {
  const isHost = session.hostId === user.id;
  const live = session.status === 'live';
  const joinUrl = `${env.frontendUrl}/join?code=${session.code}`;

  const dto = {
    id: session.id,
    title: session.title,
    code: session.code,
    joinUrl,
    status: session.status,
    accessMode: session.accessMode,
    allowExport: session.allowExport,
    revokedWriters: session.revokedWriters,
    pageCount: session.pageCount,
    course: session.course,
    host: session.host,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdAt: session.createdAt,
    me: {
      isHost,
      canWrite: isHost ? live : live && session.accessMode === 'student_write' && !session.revokedWriters.includes(user.id),
    },
  };
  if (isHost && withQr) dto.qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
  return dto;
}

function emitSettings(s) {
  realtime.emitToSession(s.id, 'session:settings', {
    accessMode: s.accessMode,
    allowExport: s.allowExport,
    revokedWriters: s.revokedWriters,
  });
}

// ---------- dosen ----------
async function createSession(user, { courseId, title }) {
  if (!isUuid(courseId)) throw new AppError(404, 'COURSE_NOT_FOUND', 'Kelas tidak ditemukan');
  const course = unwrap(await supabase.from('courses').select('id, name, lecturer_id').eq('id', courseId).maybeSingle());
  if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Kelas tidak ditemukan');
  if (course.lecturer_id !== user.id) throw new AppError(403, 'NOT_LECTURER', 'Kamu bukan pengampu kelas ini');

  const defaultTitle = `${course.name} - ${new Date().toLocaleDateString('id-ID')}`;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from('sessions')
      .insert({ course_id: course.id, host_id: user.id, title: title || defaultTitle, code: generateCode() })
      .select(SESSION_SELECT)
      .single();
    if (!error) return toSession(data);
    if (error.code === '23505') continue; // kode bentrok, coba lagi
    console.error('[supabase]', error.message);
    throw new AppError(500, 'DB_ERROR', 'Terjadi kesalahan pada database');
  }
  throw new AppError(500, 'CODE_GENERATION_FAILED', 'Gagal membuat kode sesi, coba lagi');
}

async function listHosted(user) {
  const rows = unwrap(
    await supabase
      .from('sessions')
      .select(SESSION_SELECT)
      .eq('host_id', user.id)
      .in('status', ['draft', 'live'])
      .order('created_at', { ascending: false })
  );
  return rows.map(toSession);
}

async function startSession(session) {
  if (session.status !== 'draft') throw new AppError(409, 'INVALID_STATE', 'Sesi sudah dimulai atau sudah berakhir');
  const now = new Date().toISOString();
  const updated = await saveSession(session.id, { status: 'live', started_at: now, last_activity_at: now });
  board.openRoom(updated);
  realtime.emitToSession(updated.id, 'session:status', { status: 'live', startedAt: updated.startedAt });
  return updated;
}

async function endSession(session, reason = 'manual') {
  if (session.status === 'ended') throw new AppError(409, 'INVALID_STATE', 'Sesi sudah berakhir');
  const updated = await saveSession(session.id, { status: 'ended', ended_at: new Date().toISOString() });
  board.syncMeta(updated); // op baru langsung ditolak
  await board.flushEvents(); // pastikan semua rekaman tersimpan
  board.closeRoom(updated.id);
  realtime.emitToSession(updated.id, 'session:status', { status: 'ended', endedAt: updated.endedAt, reason });
  return updated;
}

async function updateSettings(session, { accessMode, allowExport }) {
  if (session.status === 'ended') throw new AppError(409, 'INVALID_STATE', 'Sesi sudah berakhir');
  const patch = {};
  if (accessMode) patch.access_mode = accessMode;
  if (allowExport !== undefined) patch.allow_export = allowExport;
  const updated = await saveSession(session.id, patch);
  board.syncMeta(updated); // berlaku seketika
  emitSettings(updated);
  return updated;
}

async function setStudentWrite(session, studentId, allowed) {
  if (session.status === 'ended') throw new AppError(409, 'INVALID_STATE', 'Sesi sudah berakhir');
  const p = isUuid(studentId)
    ? unwrap(await supabase.from('participants').select('user_id').eq('session_id', session.id).eq('user_id', studentId).maybeSingle())
    : null;
  if (!p) throw new AppError(404, 'PARTICIPANT_NOT_FOUND', 'Peserta tidak ditemukan');

  const revoked = new Set(session.revokedWriters);
  if (allowed) revoked.delete(studentId);
  else revoked.add(studentId);
  const updated = await saveSession(session.id, { revoked_writers: [...revoked] });
  board.syncMeta(updated);
  emitSettings(updated);
  return updated;
}

async function listParticipants(session) {
  const rows = unwrap(
    await supabase.from('participants').select('joined_at, user:users!user_id(id, name, siakad_id)').eq('session_id', session.id)
  );
  const online = realtime.onlineUserIds(session.id);
  const revoked = new Set(session.revokedWriters);
  return rows
    .filter((p) => p.user)
    .map((p) => ({
      userId: p.user.id,
      name: p.user.name,
      siakadId: p.user.siakad_id,
      joinedAt: p.joined_at,
      online: online.has(p.user.id),
      canWrite: session.accessMode === 'student_write' && !revoked.has(p.user.id),
    }));
}

// ---------- mahasiswa ----------
async function joinByCode(user, rawCode) {
  const code = String(rawCode).trim().toUpperCase();
  const row = unwrap(await supabase.from('sessions').select(SESSION_SELECT).eq('code', code).maybeSingle());
  if (!row) throw new AppError(404, 'INVALID_CODE', 'Kode sesi tidak ditemukan. Periksa kembali kodenya.');
  const session = toSession(row);
  if (session.status === 'ended') throw new AppError(410, 'SESSION_ENDED', 'Kode sudah kedaluwarsa karena sesi telah berakhir');

  if (session.hostId === user.id) return session; // dosen masuk kembali ke sesinya
  if (user.role !== 'mahasiswa') throw new AppError(403, 'FORBIDDEN', 'Hanya mahasiswa kelas ini yang dapat bergabung');

  const enrolled = unwrap(
    await supabase.from('course_students').select('student_id').eq('course_id', session.courseId).eq('student_id', user.id).maybeSingle()
  );
  if (!enrolled) throw new AppError(403, 'NOT_ENROLLED', 'Kamu tidak terdaftar di kelas ini');

  unwrap(
    await supabase
      .from('participants')
      .upsert({ session_id: session.id, user_id: user.id }, { onConflict: 'session_id,user_id', ignoreDuplicates: true })
  );
  return session;
}

async function history(user, { page, limit }) {
  const from = (page - 1) * limit;
  let query = supabase.from('sessions').select(SESSION_SELECT, { count: 'exact' });

  if (user.role === 'dosen') {
    query = query.eq('host_id', user.id);
  } else {
    const joined = unwrap(await supabase.from('participants').select('session_id').eq('user_id', user.id));
    const ids = joined.map((p) => p.session_id);
    if (!ids.length) return { data: [], page, limit, total: 0 };
    query = query.in('id', ids).neq('status', 'draft');
  }

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + limit - 1);
  if (error) {
    console.error('[supabase]', error.message);
    throw new AppError(500, 'DB_ERROR', 'Terjadi kesalahan pada database');
  }
  const items = await Promise.all(data.map((r) => toDTO(toSession(r), user)));
  return { data: items, page, limit, total: count ?? items.length };
}

module.exports = {
  findSession,
  assertHost,
  assertAccess,
  toDTO,
  createSession,
  listHosted,
  startSession,
  endSession,
  updateSettings,
  setStudentWrite,
  listParticipants,
  joinByCode,
  history,
};
