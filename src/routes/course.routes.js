const router = require('express').Router();
const { supabase, unwrap } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

// Dosen: kelas yang diampu. Mahasiswa: kelas yang diikuti.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    let data;
    if (req.user.role === 'dosen') {
      data = unwrap(await supabase.from('courses').select('id, code, name').eq('lecturer_id', req.user.id).order('name'));
    } else {
      const rows = unwrap(
        await supabase.from('course_students').select('course:courses!course_id(id, code, name)').eq('student_id', req.user.id)
      );
      data = rows.map((r) => r.course).filter(Boolean);
    }
    res.json({ data });
  })
);

module.exports = router;
