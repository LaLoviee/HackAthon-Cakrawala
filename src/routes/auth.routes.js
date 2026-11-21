const router = require('express').Router();
const { z } = require('zod');
const { supabase, unwrap } = require('../config/supabase');
const siakad = require('../services/siakad.service');
const { signToken, requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/errors');

const userDTO = (u) => ({ id: u.id, siakadId: u.siakad_id, name: u.name, role: u.role });

// Tukar token SIAKAD (mock di MVP) -> JWT CakraBoard. Akun non-SIAKAD ditolak di sini.
router.post(
  '/siakad',
  validate(z.object({ token: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const p = await siakad.verifyToken(req.body.token);
    const user = unwrap(
      await supabase
        .from('users')
        .upsert({ siakad_id: p.siakadId, name: p.name, email: p.email, role: p.role }, { onConflict: 'siakad_id' })
        .select()
        .single()
    );
    res.json({ token: signToken(user), user: userDTO(user) });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
