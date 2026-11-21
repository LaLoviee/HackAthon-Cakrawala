const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID.test(v);

// Sesi + data kelas & host sekaligus (satu query lewat relasi Supabase)
const SESSION_SELECT = '*, course:courses!course_id(id, code, name), host:users!host_id(id, name)';

const date = (v) => (v ? new Date(v) : null);

// Baris snake_case dari Postgres -> objek camelCase yang dipakai service
function toSession(r) {
  if (!r) return null;
  return {
    id: r.id,
    courseId: r.course_id,
    hostId: r.host_id,
    title: r.title,
    code: r.code,
    status: r.status,
    accessMode: r.access_mode,
    allowExport: r.allow_export,
    revokedWriters: r.revoked_writers || [],
    pageCount: r.page_count,
    startedAt: date(r.started_at),
    endedAt: date(r.ended_at),
    lastActivityAt: date(r.last_activity_at),
    createdAt: date(r.created_at),
    course: r.course || null,
    host: r.host || null,
  };
}

module.exports = { isUuid, SESSION_SELECT, toSession };
