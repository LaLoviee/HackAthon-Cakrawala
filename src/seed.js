// Data contoh untuk development: npm run seed (aman dijalankan berulang)
const { supabase, unwrap, checkConnection } = require('./config/supabase');

const upsertUser = async (siakad_id, name, role) =>
  unwrap(
    await supabase
      .from('users')
      .upsert({ siakad_id, name, role, email: `${siakad_id.toLowerCase()}@kampus.test` }, { onConflict: 'siakad_id' })
      .select()
      .single()
  );

(async () => {
  await checkConnection();
  const dosen = await upsertUser('D001', 'Pak Rudi', 'dosen');
  const students = [
    await upsertUser('M001', 'Sinta', 'mahasiswa'),
    await upsertUser('M002', 'Budi', 'mahasiswa'),
    await upsertUser('M003', 'Dewi', 'mahasiswa'),
  ];
  const course = unwrap(
    await supabase
      .from('courses')
      .upsert({ code: 'MK101', name: 'Kalkulus Dasar', lecturer_id: dosen.id }, { onConflict: 'code' })
      .select()
      .single()
  );
  unwrap(
    await supabase
      .from('course_students')
      .upsert(students.map((s) => ({ course_id: course.id, student_id: s.id })), { onConflict: 'course_id,student_id', ignoreDuplicates: true })
  );
  console.log('Seed selesai. Token mock untuk POST /api/auth/siakad:');
  console.log('  dosen    : mock:D001:dosen:Pak Rudi');
  console.log('  mahasiswa: mock:M001:mahasiswa:Sinta   (M002 Budi, M003 Dewi)');
  console.log('  non-kelas: mock:M999:mahasiswa:Orang Luar  (untuk tes NOT_ENROLLED)');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
