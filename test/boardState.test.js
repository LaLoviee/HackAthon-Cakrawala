const test = require('node:test');
const assert = require('node:assert');
const { createState, applyOp, foldEvents, serialize } = require('../src/utils/boardState');

const stroke = (id, authorId = 'u1') => ({ id, kind: 'stroke', tool: 'pen', color: '#000', size: 2, points: [[0, 0], [1, 1]], authorId });

test('add, update, remove', () => {
  const s = createState();
  applyOp(s, { type: 'object.add', page: 0, object: stroke('a') });
  applyOp(s, { type: 'object.add', page: 0, object: stroke('b') });
  applyOp(s, { type: 'object.update', page: 0, id: 'a', patch: { color: '#f00' } });
  applyOp(s, { type: 'object.remove', page: 0, ids: ['b'] });
  const out = serialize(s);
  assert.strictEqual(out.pages[0].objects.length, 1);
  assert.strictEqual(out.pages[0].objects[0].color, '#f00');
});

test('page.add, page.focus, page.clear', () => {
  const s = createState();
  applyOp(s, { type: 'page.add', page: 1 });
  applyOp(s, { type: 'page.focus', page: 1 });
  applyOp(s, { type: 'object.add', page: 1, object: stroke('x') });
  assert.strictEqual(serialize(s).currentPage, 1);
  assert.strictEqual(serialize(s).pages[1].objects.length, 1);
  applyOp(s, { type: 'page.clear', page: 1 });
  assert.strictEqual(serialize(s).pages[1].objects.length, 0);
});

test('op ke halaman yang tidak ada diabaikan', () => {
  const s = createState();
  applyOp(s, { type: 'object.add', page: 9, object: stroke('z') });
  assert.strictEqual(serialize(s).pages.length, 1);
});

test('foldEvents sampai titik tertentu = rewind', () => {
  const events = [
    { seq: 1, op: { type: 'object.add', page: 0, object: stroke('a') } },
    { seq: 2, op: { type: 'object.add', page: 0, object: stroke('b') } },
    { seq: 3, op: { type: 'object.remove', page: 0, ids: ['a'] } },
  ];
  assert.strictEqual(serialize(foldEvents(events.slice(0, 2))).pages[0].objects.length, 2);
  assert.strictEqual(serialize(foldEvents(events)).pages[0].objects.length, 1);
});
