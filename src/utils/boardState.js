/**
 * Event sourcing board: state papan = hasil "melipat" (fold) semua op berurutan.
 * Fungsi di sini murni (tanpa DB/socket) sehingga mudah dites dan
 * logikanya bisa disalin ke frontend untuk replay lokal.
 */

function createState() {
  return { pages: [new Map()], currentPage: 0 };
}

function applyOp(state, op) {
  switch (op.type) {
    case 'page.add':
      state.pages.push(new Map());
      break;
    case 'page.focus':
      if (state.pages[op.page]) state.currentPage = op.page;
      break;
    case 'object.add': {
      const p = state.pages[op.page];
      if (p) p.set(op.object.id, op.object);
      break;
    }
    case 'object.update': {
      const p = state.pages[op.page];
      const cur = p && p.get(op.id);
      if (cur) p.set(op.id, { ...cur, ...op.patch });
      break;
    }
    case 'object.remove': {
      const p = state.pages[op.page];
      if (p) for (const id of op.ids) p.delete(id);
      break;
    }
    case 'page.clear': {
      const p = state.pages[op.page];
      if (p) p.clear();
      break;
    }
    default:
      break;
  }
  return state;
}

function foldEvents(events, state = createState()) {
  for (const e of events) applyOp(state, e.op);
  return state;
}

// Bentuk JSON yang dikirim ke frontend
function serialize(state) {
  return {
    currentPage: state.currentPage,
    pages: state.pages.map((p) => ({ objects: [...p.values()] })),
  };
}

module.exports = { createState, applyOp, foldEvents, serialize };
