const { z } = require('zod');

/**
 * KONTRAK OPERASI PAPAN (dikirim frontend lewat socket "board:op").
 * Field di luar skema akan dibuang otomatis (zod strip) -> aman disimpan ke kolom jsonb Supabase.
 */
const id = z.string().min(1).max(64);
const num = z.number().finite();
const color = z.string().max(32);
const size = z.number().min(0.5).max(200);
const point = z.array(num).min(2).max(3); // [x, y, pressure?]

const stroke = z.object({
  id,
  kind: z.literal('stroke'),
  tool: z.enum(['pen', 'pencil', 'eraser']),
  color,
  size,
  smoothing: z.boolean().optional(),
  points: z.array(point).min(1).max(10000),
});

// Bounding box: line/arrow digambar dari (x,y) ke (x+w, y+h)
const shape = z.object({
  id,
  kind: z.literal('shape'),
  shape: z.enum(['line', 'rect', 'ellipse', 'triangle', 'arrow']),
  x: num,
  y: num,
  w: num,
  h: num,
  rotation: num.optional(),
  color,
  size,
  fill: color.optional(),
});

const text = z.object({
  id,
  kind: z.literal('text'),
  x: num,
  y: num,
  text: z.string().max(5000),
  font: z.string().max(64).optional(),
  fontSize: z.number().min(4).max(400),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color,
});

const boardObject = z.discriminatedUnion('kind', [stroke, shape, text]);

// Field yang boleh diubah lewat object.update (id/kind/authorId tidak bisa diubah)
const patch = z.object({
  x: num.optional(),
  y: num.optional(),
  w: num.optional(),
  h: num.optional(),
  rotation: num.optional(),
  color: color.optional(),
  size: size.optional(),
  fill: color.optional(),
  text: z.string().max(5000).optional(),
  font: z.string().max(64).optional(),
  fontSize: z.number().min(4).max(400).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  points: z.array(point).min(1).max(10000).optional(),
});

const page = z.number().int().min(0).max(499);

const opSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('object.add'), page, object: boardObject }),
  z.object({ type: z.literal('object.update'), page, id, patch }),
  z.object({ type: z.literal('object.remove'), page, ids: z.array(id).min(1).max(500) }),
  z.object({ type: z.literal('page.clear'), page }), // dosen saja
  z.object({ type: z.literal('page.add') }), // dosen saja; server mengisi op.page = indeks halaman baru
  z.object({ type: z.literal('page.focus'), page }), // dosen saja; halaman yang sedang ditampilkan dosen
]);

// Coretan yang masih berjalan (tidak disimpan, hanya diteruskan ke peserta lain)
const progressSchema = z.object({
  page,
  objectId: id,
  tool: z.enum(['pen', 'pencil', 'eraser']),
  color,
  size,
  points: z.array(point).min(1).max(200), // potongan titik terbaru
});

module.exports = { opSchema, progressSchema };
