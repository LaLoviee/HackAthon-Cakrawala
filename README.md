# CakraBoard Backend

Backend whiteboard digital real-time (PRD v1.0 MVP). **JavaScript only**: Node.js + Express + Socket.IO + **Supabase (Postgres)**. SIAKAD di-mock untuk MVP.

## Setup Supabase (sekali saja)

1. Buat project di supabase.com -> **SQL Editor** -> New query -> tempel seluruh isi `supabase/schema.sql` -> **Run**.
2. **Project Settings -> API**: salin `Project URL` dan key **`service_role`** (bukan `anon`).
3. `cp .env.example .env`, isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`.

> Key `service_role` melewati RLS dan hanya boleh ada di backend. Jangan taruh di frontend atau commit ke git.
> Semua tabel sudah di-`enable row level security` tanpa policy, jadi akses langsung dari browser pakai anon key tidak bisa baca/tulis apa pun.

## Menjalankan

```bash
npm install
npm run seed     # 1 dosen, 3 mahasiswa, 1 kelas (aman diulang)
npm run dev      # http://localhost:4000
npm test         # tes logika state papan (tanpa DB)
npm run demo     # tes end-to-end real-time (server harus jalan)
```

Token login mock (`SIAKAD_MODE=mock`): `mock:D001:dosen:Pak Rudi`, `mock:M001:mahasiswa:Sinta`, `mock:M999:mahasiswa:Orang Luar` (tidak terdaftar di kelas).

## Testing dengan Thunder Client

1. **Import**: tab *Collections* -> menu `...` -> *Import* -> pilih `thunder-client/cakraboard.postman_collection.json`.
2. **Environment**: tab *Env* -> New -> buat variabel `baseUrl`=`http://localhost:4000`, lalu `dosenToken`, `mhsToken`, `outsiderToken`, `mhsId`, `courseId`, `sessionId`, `code` (kosongkan dulu). Pilih env itu sebagai aktif. (Atau import `cakraboard.postman_environment.json`.)
3. **Isi variabel otomatis**: di request tertentu buka tab *Vars* -> *Set Env Variable*, isi nama variabel dan nilai dari response:

| Request | Variabel = nilai |
|---|---|
| Login Dosen | `dosenToken` = `json.token` |
| Login Mahasiswa | `mhsToken` = `json.token`, `mhsId` = `json.user.id` |
| Login Mahasiswa luar kelas | `outsiderToken` = `json.token` |
| Daftar kelas (dosen) | `courseId` = `json.data[0].id` |
| Buat board | `sessionId` = `json.id`, `code` = `json.code` |

Kalau sintaks *Set Env Variable* di versi Thunder Client kamu beda, salin nilainya manual ke tab *Env*.

4. **Urutan tes** (folder 0 -> 4): health, login (dosen, mahasiswa, luar kelas), daftar kelas, buat board, join pakai kode, ubah izin, start, peserta, cabut izin, end, history. Request bertanda "(harus 4xx)" adalah tes negatif.

Hasil yang diharapkan:

| Request | Status |
|---|---|
| Login token salah | 401 `INVALID_SIAKAD_TOKEN` |
| Buat board oleh mahasiswa | 403 `FORBIDDEN` |
| Join kode salah | 404 `INVALID_CODE` |
| Join mahasiswa luar kelas | 403 `NOT_ENROLLED` |
| Start dua kali | 409 `INVALID_STATE` |
| Join setelah End | 410 `SESSION_ENDED` |
| Tanpa header Authorization | 401 `UNAUTHENTICATED` |

**Thunder Client tidak bisa Socket.IO.** Untuk tes real-time (kirim coretan, view-only ditolak, izin tulis, cabut izin, reconnect, rewind, replay) jalankan `npm run demo`: skrip memainkan dosen + mahasiswa lewat socket dan REST, lalu mencetak ✅/❌ per skenario. Setelah itu request *Events (replay)* dan *Snapshot* di Thunder Client akan berisi data.

## Struktur

```
src/
├─ server.js            bootstrap: DB, HTTP, Socket.IO, job
├─ app.js               Express: middleware + routes
├─ config/              env.js, supabase.js (client + unwrap error)
├─ schemas/             board.schema.js  <- kontrak operasi papan (zod)
├─ middleware/          auth (JWT), error, validate
├─ routes/              auth, course, session, history   (REST, tipis)
├─ services/            session.service (aturan sesi), board.service (inti real-time),
│                       siakad.service (adapter SSO)
├─ sockets/index.js     event Socket.IO
├─ jobs/autoEnd.js      auto-end sesi yang terlupa
├─ utils/               boardState (fold event), realtime, code, errors
└─ seed.js
supabase/schema.sql     skema tabel (jalankan di SQL Editor)
thunder-client/         koleksi + environment untuk Thunder Client
scripts/socket-demo.js  tes e2e real-time
test/boardState.test.js
```

## Alur utama (untuk frontend)

**Dosen**: `POST /api/auth/siakad` -> `POST /api/sessions` (dapat `code`, `joinUrl`, `qrDataUrl`) -> atur izin `PATCH /:id/settings` -> `POST /:id/start` -> socket `session:join` -> kirim `board:op` -> `POST /:id/end`.

**Mahasiswa**: `POST /api/auth/siakad` -> scan QR (isi: `<FRONTEND_URL>/join?code=XXXXXX`, ambil parameter `code`) atau ketik kode -> `POST /api/sessions/join {code}` -> socket `session:join` -> terima `board:op`. Setelah sesi: `GET /api/history` -> replay via `/events` atau `/snapshot`.

Semua REST (kecuali `/auth/siakad`, `/health`) memakai header `Authorization: Bearer <JWT>`.
Format error REST: `{ "error": { "code", "message" } }`. Ack socket gagal: `{ ok:false, code, message }`.

## REST API

| Method & path | Peran | Keterangan |
|---|---|---|
| `POST /api/auth/siakad` `{token}` | - | Tukar token SIAKAD -> `{token, user}`. Non-SIAKAD ditolak (401) |
| `GET /api/auth/me` | semua | Info user dari JWT |
| `GET /api/courses` | semua | Kelas yang diampu/diikuti |
| `GET /api/sessions` | dosen | Sesi draft/live milik dosen |
| `POST /api/sessions` `{courseId, title?}` | dosen | Buat board + kode + QR (status `draft`) |
| `POST /api/sessions/join` `{code}` | mahasiswa | Validasi kode + terdaftar di kelas. Error: `INVALID_CODE` 404, `SESSION_ENDED` 410, `NOT_ENROLLED` 403 |
| `GET /api/sessions/:id` | peserta/host | Detail sesi |
| `POST /api/sessions/:id/start` | host | `draft` -> `live`, rekaman mulai |
| `POST /api/sessions/:id/end` | host | `live` -> `ended`, join baru ditutup |
| `PATCH /api/sessions/:id/settings` `{accessMode?, allowExport?}` | host | `accessMode`: `view_only` \| `student_write`. Berlaku seketika |
| `GET /api/sessions/:id/participants` | host | Daftar peserta + online + canWrite |
| `PUT /api/sessions/:id/participants/:userId/write` `{allowed}` | host | Cabut/beri izin tulis per mahasiswa |
| `GET /api/sessions/:id/events?afterSeq=0&limit=500` | peserta/host | Aksi berurutan `{events:[{seq,t,author,op}], hasMore, lastSeq, durationMs}` untuk replay. `limit` maks 900; ulangi dengan `afterSeq=lastSeq` selama `hasMore` |
| `GET /api/sessions/:id/snapshot?upToSeq=&upToT=` | peserta/host | State papan pada titik tertentu (rewind/geser timeline). Tanpa parameter = terkini |
| `GET /api/history?page=1&limit=20` | semua | Mahasiswa: sesi yang diikuti. Dosen: sesi yang di-host. Terbaru dulu |

Status sesi: `draft` (lobi, belum direkam) -> `live` -> `ended`. Aksi papan hanya diterima saat `live`.

## Socket.IO

Koneksi: `io(URL, { auth: { token: JWT } })`.

**Client -> server**

| Event | Payload | Ack |
|---|---|---|
| `session:join` | `{ sessionId, afterSeq? }` | `{ok, session, state, lastSeq}` atau (reconnect, `afterSeq` diberikan) `{ok, session, events, lastSeq}` |
| `session:leave` | - | `{ok}` |
| `board:op` | `{ clientOpId?, op }` | `{ok, seq, t}` / `{ok:false, code}` |
| `stroke:progress` | `{ page, objectId, tool, color, size, points }` (maks 200 titik) | - |

**Server -> client**

| Event | Payload |
|---|---|
| `board:op` | `{ seq, t, author, clientOpId, op }` (dikirim ke semua termasuk pengirim; terapkan berdasarkan `seq`) |
| `stroke:progress` | payload di atas + `author` (volatile, tidak disimpan; hapus preview saat `board:op` final tiba) |
| `session:status` | `{ status: 'live'\|'ended', ..., reason? }` |
| `session:settings` | `{ accessMode, allowExport, revokedWriters: [userId] }` -> `canWrite = isHost \|\| (accessMode==='student_write' && !revokedWriters.includes(myId))` |
| `participants:update` | `{ online }` (jumlah user terhubung, termasuk dosen) |

**Reconnect**: simpan `lastSeq` terakhir, saat tersambung ulang kirim `session:join {sessionId, afterSeq: lastSeq}`. Abaikan event dengan `seq <= lastSeq` (bisa tumpang tindih dengan ack join). Jika selisih terlalu besar, server membalas dengan `state` penuh.

### Operasi papan (`op`)

Semua koordinat/ukuran dalam satuan kanvas yang disepakati frontend. Server menentukan `authorId`; field di luar skema dibuang.

```js
{ type: 'object.add', page: 0, object: <stroke|shape|text> }
{ type: 'object.update', page: 0, id, patch: { x, y, w, h, color, text, points, ... } }
{ type: 'object.remove', page: 0, ids: ['id1'] }
{ type: 'page.clear', page: 0 }     // dosen
{ type: 'page.add' }                // dosen; di event siaran, op.page = indeks halaman baru
{ type: 'page.focus', page: 1 }     // dosen; halaman yang sedang ditampilkan
```
Objek (id dibuat client, unik, mis. `nanoid`):
```js
{ id, kind:'stroke', tool:'pen'|'pencil'|'eraser', color, size, smoothing?, points:[[x,y,pressure?],...] }
{ id, kind:'shape', shape:'line'|'rect'|'ellipse'|'triangle'|'arrow', x,y,w,h, rotation?, color, size, fill? }
{ id, kind:'text', x,y, text, font?, fontSize, bold?, italic?, underline?, color }
```
- **Undo** = kirim `object.remove` untuk objek sendiri; **redo** = `object.add` ulang dengan objek yang sama.
- Mahasiswa hanya boleh `object.*` dan hanya pada objek miliknya; dosen boleh semua (termasuk menghapus/memulihkan coretan mahasiswa).
- `DUPLICATE_OBJECT` pada retry berarti op sebelumnya sudah masuk: anggap sukses.
- Alur coretan: kirim `stroke:progress` saat menggambar, lalu satu `board:op` (`object.add`, titik lengkap) saat pena diangkat.

Kode error umum: `WRITE_FORBIDDEN`, `SESSION_NOT_LIVE`, `HOST_ONLY`, `NOT_OWNER`, `INVALID_OP`, `INVALID_PAGE`, `RATE_LIMITED`, `TOO_MANY_WRITERS`, `NOT_PARTICIPANT`.

## Pemetaan ke PRD

| Kebutuhan PRD | Implementasi |
|---|---|
| Real-time <= 500 ms | Socket.IO, kirim data stroke (bukan gambar), `stroke:progress` volatile, siaran sebelum simpan DB |
| Rekaman & replay | Event sourcing: tiap aksi = satu baris `board_events` (`seq`, `t`, `op` jsonb), bukan video; `/events` + `/snapshot` |
| View only ditolak di server | `canWrite()` di `board.service` dicek tiap op; cabut izin berlaku seketika |
| Join QR/kode, non-SIAKAD ditolak | `joinByCode` cek kode, status, dan pendaftaran kelas; auth lewat adapter SIAKAD |
| Batasi penulis aktif | `MAX_ACTIVE_WRITERS` (penulis dalam 10 detik terakhir) + rate limit per socket |
| Dosen lupa End Session | `jobs/autoEnd.js` |
| Dosen putus koneksi | Sesi tidak berakhir; auto-end hanya jika tidak aktif > `INACTIVITY_MINUTES` dan dosen tidak terhubung |
| Join terlambat | `session:join` langsung mengirim state terkini |

## Asumsi & hal yang perlu dikonfirmasi

1. **SIAKAD di-mock** (cukup untuk MVP/hackathon). Adapter ada di `siakad.service.js`; kalau nanti ada API sungguhan, ganti `SIAKAD_MODE=http` (asumsi respons `{id, name, email, role}`). Data kelas/peserta saat ini dari `npm run seed`; untuk demo tambahkan baris di tabel `users`, `courses`, `course_students` lewat Table Editor Supabase.
2. **Mode izin**: PRD menyebut "Edit penuh (dosen saja)" dan "View only"; keduanya berarti mahasiswa tidak bisa menulis, jadi dipakai 2 mode: `view_only` dan `student_write`.
3. **Ekspor** PDF/JPG/PNG dirender di frontend (canvas + jsPDF) sesuai PRD. `allowExport` hanya penanda yang dikirim ke frontend, belum bisa dipaksakan server.
4. **Retensi rekaman** belum diimplementasi (pertanyaan terbuka di PRD).
5. **Single node**: state live ada di memori. Untuk scale horizontal tambahkan `@socket.io/redis-adapter` + sticky session, dan pindahkan state room/presence ke Redis.
6. Event ditulis ke Supabase tiap 500 ms (batch). Jika server mati mendadak, maksimal ~0,5 detik aksi terakhir bisa hilang. Shutdown normal (SIGTERM) melakukan flush.
7. Belum ada rate limit untuk REST; tambahkan `express-rate-limit` bila perlu.
8. Supabase membatasi 1000 baris per request, jadi pembacaan event dipaginasi (sudah ditangani di service).
9. Auth memakai JWT sendiri (hasil tukar token SIAKAD mock), bukan Supabase Auth; Supabase dipakai murni sebagai database.
