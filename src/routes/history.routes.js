const router = require('express').Router();
const { z } = require('zod');
const svc = require('../services/session.service');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Mahasiswa: sesi yang pernah diikuti. Dosen: sesi yang pernah di-host. Terbaru dulu.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await svc.history(req.user, query.parse(req.query)));
  })
);

module.exports = router;
