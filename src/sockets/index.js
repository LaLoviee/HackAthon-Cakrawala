const { Server } = require('socket.io');
const { z, ZodError } = require('zod');
const env = require('../config/env');
const { verifyToken } = require('../middleware/auth');
const sessionService = require('../services/session.service');
const board = require('../services/board.service');
const realtime = require('../utils/realtime');
const { progressSchema } = require('../schemas/board.schema');
const { AppError } = require('../utils/errors');

const joinSchema = z.object({ sessionId: z.string().min(1), afterSeq: z.number().int().min(0).optional() });
const opPayload = z.object({ clientOpId: z.string().max(64).optional(), op: z.any() });

const makeLimiter = (max, windowMs) => {
  let count = 0;
  let start = Date.now();
  return () => {
    const now = Date.now();
    if (now - start > windowMs) {
      start = now;
      count = 0;
    }
    return ++count <= max;
  };
};

// Bungkus handler: semua error menjadi ack { ok:false, code, message }
const safe = (handler) => async (payload, ack) => {
  const reply = typeof ack === 'function' ? ack : () => {};
  try {
    reply({ ok: true, ...(await handler(payload || {})) });
  } catch (err) {
    if (err instanceof AppError) return reply({ ok: false, code: err.code, message: err.message });
    if (err instanceof ZodError) return reply({ ok: false, code: 'VALIDATION_ERROR', message: 'Data tidak valid' });
    console.error('[socket]', err);
    reply({ ok: false, code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' });
  }
};

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    maxHttpBufferSize: 1e6,
  });
  realtime.setIO(io);

  // Auth: client mengirim { auth: { token: <JWT CakraBoard> } }
  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth && socket.handshake.auth.token);
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  const announcePresence = (sessionId) =>
    realtime.emitToSession(sessionId, 'participants:update', { online: realtime.onlineUserIds(sessionId).size });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const opLimiter = makeLimiter(60, 1000);
    const progressLimiter = makeLimiter(120, 1000);

    const leaveCurrent = async () => {
      const id = socket.data.sessionId;
      if (!id) return;
      socket.data.sessionId = null;
      await socket.leave(realtime.roomName(id));
      announcePresence(id);
    };

    // Masuk ke sesi. Dengan afterSeq (reconnect): balasan berisi `events` yang terlewat;
    // tanpa itu (atau jika terlalu banyak yang terlewat): balasan berisi `state` penuh.
    socket.on(
      'session:join',
      safe(async (payload) => {
        const { sessionId, afterSeq } = joinSchema.parse(payload);
        const session = await sessionService.assertAccess(sessionId, user);
        await leaveCurrent();
        const id = session.id;
        socket.data.sessionId = id;
        await socket.join(realtime.roomName(id)); // join dulu agar tidak ada op yang terlewat

        const result = { session: await sessionService.toDTO(session, user) };
        if (afterSeq !== undefined) {
          const r = await board.getEvents(session.id, { afterSeq, limit: board.EVENTS_PAGE_MAX });
          if (!r.hasMore) {
            result.events = r.events;
            result.lastSeq = r.lastSeq;
          }
        }
        if (!result.events) {
          const snap = await board.getSnapshot(session);
          result.state = snap.state;
          result.lastSeq = snap.lastSeq;
        }
        announcePresence(id);
        return result;
      })
    );

    socket.on('session:leave', safe(async () => { await leaveCurrent(); return {}; }));

    // Aksi final di papan (disimpan ke rekaman + disiarkan ke semua peserta, termasuk pengirim)
    socket.on(
      'board:op',
      safe(async (payload) => {
        const sessionId = socket.data.sessionId;
        if (!sessionId) throw new AppError(400, 'NOT_IN_SESSION', 'Kirim session:join terlebih dahulu');
        if (!opLimiter()) throw new AppError(429, 'RATE_LIMITED', 'Terlalu banyak aksi, pelan-pelan');
        const { clientOpId, op } = opPayload.parse(payload);
        const event = await board.handleOp({ sessionId, user, clientOpId, rawOp: op });
        return { seq: event.seq, t: event.t };
      })
    );

    // Coretan yang sedang digambar: tidak disimpan, hanya diteruskan agar terlihat real-time
    socket.on(
      'stroke:progress',
      safe(async (payload) => {
        const sessionId = socket.data.sessionId;
        if (!sessionId || !progressLimiter()) return {};
        const data = progressSchema.parse(payload);
        if (!(await board.canUserWrite(sessionId, user))) throw new AppError(403, 'WRITE_FORBIDDEN', 'Tidak punya izin menulis');
        socket.to(realtime.roomName(sessionId)).volatile.emit('stroke:progress', { ...data, author: user.id });
        return {};
      })
    );

    socket.on('disconnect', () => {
      if (socket.data.sessionId) announcePresence(socket.data.sessionId);
    });
  });

  return io;
}

module.exports = { initSockets };
