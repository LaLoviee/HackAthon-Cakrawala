const router = require('express').Router();
const { z } = require('zod');
const svc = require('../services/session.service');
const board = require('../services/board.service');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/errors');

const createSchema = z.object({ courseId: z.string().min(1), title: z.string().trim().max(120).optional() });
const joinSchema = z.object({ code: z.string().trim().min(4).max(12) });
const settingsSchema = z
  .object({ accessMode: z.enum(['view_only', 'student_write']).optional(), allowExport: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Minimal satu pengaturan harus diisi' });
const writeSchema = z.object({ allowed: z.boolean() });
const eventsQuery = z.object({
  afterSeq: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(900).default(500),
});
const snapshotQuery = z.object({
  upToSeq: z.coerce.number().int().min(0).optional(),
  upToT: z.coerce.number().min(0).optional(),
});

const durationMs = (s) => (s.startedAt ? (s.endedAt || new Date()) - s.startedAt : 0);

router.use(requireAuth);

// ---- Dosen ----
router.get(
  '/',
  requireRole('dosen'),
  asyncHandler(async (req, res) => {
    const list = await svc.listHosted(req.user);
    res.json({ data: await Promise.all(list.map((s) => svc.toDTO(s, req.user))) });
  })
);

router.post(
  '/',
  requireRole('dosen'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const s = await svc.createSession(req.user, req.body);
    res.status(201).json(await svc.toDTO(s, req.user, { withQr: true }));
  })
);

// ---- Mahasiswa: join via kode (isi QR = <FRONTEND_URL>/join?code=XXXXXX, frontend ambil parameter code) ----
router.post(
  '/join',
  validate(joinSchema),
  asyncHandler(async (req, res) => {
    const s = await svc.joinByCode(req.user, req.body.code);
    res.json(await svc.toDTO(s, req.user));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const s = await svc.assertAccess(req.params.id, req.user);
    res.json(await svc.toDTO(s, req.user, { withQr: true }));
  })
);

router.post(
  '/:id/start',
  requireRole('dosen'),
  asyncHandler(async (req, res) => {
    const s = await svc.assertHost(req.params.id, req.user);
    const updated = await svc.startSession(s);
    res.json(await svc.toDTO(updated, req.user));
  })
);

router.post(
  '/:id/end',
  requireRole('dosen'),
  asyncHandler(async (req, res) => {
    const s = await svc.assertHost(req.params.id, req.user);
    const updated = await svc.endSession(s);
    res.json(await svc.toDTO(updated, req.user));
  })
);

router.patch(
  '/:id/settings',
  requireRole('dosen'),
  validate(settingsSchema),
  asyncHandler(async (req, res) => {
    const s = await svc.assertHost(req.params.id, req.user);
    const updated = await svc.updateSettings(s, req.body);
    res.json(await svc.toDTO(updated, req.user));
  })
);

router.get(
  '/:id/participants',
  requireRole('dosen'),
  asyncHandler(async (req, res) => {
    const s = await svc.assertHost(req.params.id, req.user);
    res.json({ data: await svc.listParticipants(s) });
  })
);

router.put(
  '/:id/participants/:userId/write',
  requireRole('dosen'),
  validate(writeSchema),
  asyncHandler(async (req, res) => {
    const s = await svc.assertHost(req.params.id, req.user);
    await svc.setStudentWrite(s, req.params.userId, req.body.allowed);
    res.json({ ok: true });
  })
);

// ---- Replay / rewind / join terlambat ----
// Daftar aksi berurutan (paginasi). Frontend melipatnya sendiri untuk replay.
router.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    const s = await svc.assertAccess(req.params.id, req.user);
    const q = eventsQuery.parse(req.query);
    const result = await board.getEvents(s.id, q);
    res.json({ ...result, durationMs: durationMs(s) });
  })
);

// State papan pada titik tertentu (?upToSeq= atau ?upToT=ms). Tanpa parameter = kondisi terkini.
router.get(
  '/:id/snapshot',
  asyncHandler(async (req, res) => {
    const s = await svc.assertAccess(req.params.id, req.user);
    const q = snapshotQuery.parse(req.query);
    const snap = await board.getSnapshot(s, q);
    res.json({ ...snap, status: s.status, allowExport: s.allowExport, durationMs: durationMs(s) });
  })
);

module.exports = router;
