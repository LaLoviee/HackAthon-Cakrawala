// Jembatan agar service bisa mengirim event socket tanpa import circular.
let io = null;

const roomName = (sessionId) => `session:${sessionId}`;

function setIO(instance) {
  io = instance;
}

function emitToSession(sessionId, event, payload) {
  if (io) io.to(roomName(sessionId)).emit(event, payload);
}

// Set userId yang sedang terhubung di sesi tsb (single node)
function onlineUserIds(sessionId) {
  const set = new Set();
  if (!io) return set;
  const socketIds = io.sockets.adapter.rooms.get(roomName(sessionId));
  if (!socketIds) return set;
  for (const sid of socketIds) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.data.user) set.add(s.data.user.id);
  }
  return set;
}

module.exports = { setIO, roomName, emitToSession, onlineUserIds };
