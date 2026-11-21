const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, siakadId: user.siakad_id },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function verifyToken(token) {
  try {
    const p = jwt.verify(token, env.jwtSecret);
    return { id: p.sub, role: p.role, name: p.name, siakadId: p.siakadId };
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Token tidak valid atau sudah kedaluwarsa');
  }
}

function requireAuth(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Login diperlukan');
  req.user = verifyToken(token);
  next();
}

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new AppError(403, 'FORBIDDEN', 'Akses ditolak untuk peran ini');
    next();
  };

module.exports = { signToken, verifyToken, requireAuth, requireRole };
