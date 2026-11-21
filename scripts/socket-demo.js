/**
 * Tes end-to-end REAL-TIME (Thunder Client tidak mendukung Socket.IO).
 * Menjalankan skenario dosen + mahasiswa dan mencetak ✅/❌.
 *
 * Prasyarat: server jalan (npm run dev) dan sudah `npm run seed`.
 * Jalankan : npm run demo      (opsional BASE_URL=http://localhost:4000)
 */
const { io } = require('socket.io-client');

const BASE = process.env.BASE_URL || 'http://localhost:4000';
let failed = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : '  -> ' + extra}`);
  if (!cond) failed++;
};

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const login = async (t) => (await api('POST', '/api/auth/siakad', null, { token: t })).json;
const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
const emit = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const waitFor = (s, ev, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout menunggu "${ev}"`)), ms);
    s.once(ev, (d) => {
      clearTimeout(t);
      resolve(d);
    });
  });
const stroke = (id) => ({ id, kind: 'stroke', tool: 'pen', color: '#000000', size: 3, points: [[0, 0], [10, 10], [20, 15]] });
const add = (id) => ({ type: 'object.add', page: 0, object: stroke(id) });

(async () => {
  const dosen = await login('mock:D001:dosen:Pak Rudi');
  const mhs = await login('mock:M001:mahasiswa:Sinta');
  ok('login dosen & mahasiswa (mock SIAKAD)', !!dosen.token && !!mhs.token, JSON.stringify(dosen));

  const courses = (await api('GET', '/api/courses', dosen.token)).json.data || [];
  if (!courses.length) throw new Error('Kelas kosong. Jalankan `npm run seed` dulu.');

  const created = await api('POST', '/api/sessions', dosen.token, { courseId: courses[0].id });
  ok('buat sesi: kode + QR', created.status === 201 && !!created.json.code && String(created.json.qrDataUrl).startsWith('data:image'), JSON.stringify(created.json));
  const sid = created.json.id;

  const join = await api('POST', '/api/sessions/join', mhs.token, { code: created.json.code });
  ok('mahasiswa join pakai kode', join.status === 200, JSON.stringify(join.json));

  const outsider = await login('mock:M999:mahasiswa:Orang Luar');
  const bad = await api('POST', '/api/sessions/join', outsider.token, { code: created.json.code });
  ok('mahasiswa di luar kelas ditolak (NOT_ENROLLED)', bad.status === 403 && bad.json.error?.code === 'NOT_ENROLLED', JSON.stringify(bad.json));

  const start = await api('POST', `/api/sessions/${sid}/start`, dosen.token);
  ok('start session', start.json.status === 'live', JSON.stringify(start.json));

  const sd = await connect(dosen.token);
  const sm = await connect(mhs.token);
  const jd = await emit(sd, 'session:join', { sessionId: sid });
  const jm = await emit(sm, 'session:join', { sessionId: sid });
  ok('dosen & mahasiswa join socket', jd.ok && jm.ok, JSON.stringify([jd, jm]));

  // 1. view_only (default): mahasiswa ditolak SERVER
  let r = await emit(sm, 'board:op', { clientOpId: 'm0', op: add('m-0') });
  ok('view_only: mahasiswa menulis ditolak server', r.ok === false && r.code === 'WRITE_FORBIDDEN', JSON.stringify(r));

  // 2. dosen menulis -> mahasiswa menerima real-time
  const got = waitFor(sm, 'board:op');
  const t0 = Date.now();
  r = await emit(sd, 'board:op', { clientOpId: 'd1', op: add('d-1') });
  const ev = await got;
  const ms = Date.now() - t0;
  ok('dosen gambar -> mahasiswa terima (seq=1)', r.ok && ev.seq === 1 && ev.op.object.id === 'd-1', JSON.stringify({ r, ev }));
  ok(`latensi lokal ${ms} ms (target <= 500 ms)`, ms <= 500, `${ms} ms`);

  // 3. dosen izinkan mahasiswa menulis (berlaku seketika)
  const settings = waitFor(sm, 'session:settings');
  await api('PATCH', `/api/sessions/${sid}/settings`, dosen.token, { accessMode: 'student_write' });
  const st = await settings;
  ok('event session:settings diterima mahasiswa', st.accessMode === 'student_write', JSON.stringify(st));
  r = await emit(sm, 'board:op', { clientOpId: 'm1', op: add('m-1') });
  ok('student_write: mahasiswa boleh menulis (seq=2)', r.ok && r.seq === 2, JSON.stringify(r));

  // 4. batas hak mahasiswa
  r = await emit(sm, 'board:op', { op: { type: 'object.remove', page: 0, ids: ['d-1'] } });
  ok('mahasiswa tidak bisa hapus coretan dosen (NOT_OWNER)', r.code === 'NOT_OWNER', JSON.stringify(r));
  r = await emit(sm, 'board:op', { op: { type: 'page.clear', page: 0 } });
  ok('mahasiswa tidak bisa page.clear (HOST_ONLY)', r.code === 'HOST_ONLY', JSON.stringify(r));
  r = await emit(sm, 'board:op', { op: { type: 'object.add', page: 0, object: { id: 'x', kind: 'stroke' } } });
  ok('payload tidak valid ditolak (INVALID_OP)', r.code === 'INVALID_OP', JSON.stringify(r));

  // 5. dosen cabut izin tulis mahasiswa tsb -> seketika
  const rv = await api('PUT', `/api/sessions/${sid}/participants/${mhs.user.id}/write`, dosen.token, { allowed: false });
  ok('dosen cabut izin tulis per mahasiswa', rv.status === 200, JSON.stringify(rv.json));
  r = await emit(sm, 'board:op', { op: add('m-2') });
  ok('setelah dicabut, mahasiswa ditolak', r.code === 'WRITE_FORBIDDEN', JSON.stringify(r));

  // 6. snapshot + events + rewind (REST)
  await new Promise((res) => setTimeout(res, 800)); // tunggu flush batch ke Supabase
  const snap = await api('GET', `/api/sessions/${sid}/snapshot`, mhs.token);
  ok('snapshot live berisi 2 objek', snap.json.state?.pages?.[0]?.objects?.length === 2, JSON.stringify(snap.json).slice(0, 200));
  const evs = await api('GET', `/api/sessions/${sid}/events`, mhs.token);
  ok('events tersimpan di Supabase (2 aksi, seq 1-2)', evs.json.events?.length === 2 && evs.json.events[1].seq === 2, JSON.stringify(evs.json).slice(0, 200));
  const rew = await api('GET', `/api/sessions/${sid}/snapshot?upToSeq=1`, mhs.token);
  ok('rewind ke seq=1 berisi 1 objek', rew.json.state?.pages?.[0]?.objects?.length === 1, JSON.stringify(rew.json).slice(0, 200));

  // 7. reconnect: hanya terima aksi yang terlewat
  sm.disconnect();
  const sm2 = await connect(mhs.token);
  const rj = await emit(sm2, 'session:join', { sessionId: sid, afterSeq: 1 });
  ok('reconnect afterSeq=1 -> hanya 1 aksi terlewat', rj.ok && rj.events?.length === 1 && rj.events[0].seq === 2, JSON.stringify(rj).slice(0, 200));

  // 8. end session
  const ended = waitFor(sm2, 'session:status');
  const end = await api('POST', `/api/sessions/${sid}/end`, dosen.token);
  const es = await ended;
  ok('end session + event session:status', end.json.status === 'ended' && es.status === 'ended', JSON.stringify({ end: end.json.status, es }));
  r = await emit(sd, 'board:op', { op: add('d-2') });
  ok('setelah End: aksi ditolak (SESSION_NOT_LIVE)', r.code === 'SESSION_NOT_LIVE', JSON.stringify(r));
  const late = await api('POST', '/api/sessions/join', mhs.token, { code: created.json.code });
  ok('kode kedaluwarsa setelah End (410)', late.status === 410, JSON.stringify(late.json));
  const hist = await api('GET', '/api/history', mhs.token);
  ok('history mahasiswa memuat sesi ini', (hist.json.data || []).some((s) => s.id === sid), JSON.stringify(hist.json).slice(0, 200));
  const replay = await api('GET', `/api/sessions/${sid}/events`, mhs.token);
  ok('replay sesi selesai: 2 aksi + durationMs', replay.json.events?.length === 2 && replay.json.durationMs > 0, JSON.stringify(replay.json).slice(0, 200));

  sd.disconnect();
  sm2.disconnect();
  console.log(failed ? `\n${failed} tes GAGAL` : '\nSemua tes lulus 🎉');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
