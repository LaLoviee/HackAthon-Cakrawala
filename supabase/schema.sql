-- CakraBoard: jalankan SELURUH file ini di Supabase -> SQL Editor -> New query -> Run
create extension if not exists pgcrypto;

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  siakad_id   text unique not null,                       -- NIM / NIDN (mock di MVP)
  name        text not null,
  email       text,
  role        text not null check (role in ('dosen', 'mahasiswa')),
  created_at  timestamptz not null default now()
);

create table if not exists courses (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  name         text not null,
  lecturer_id  uuid not null references users(id),
  created_at   timestamptz not null default now()
);

create table if not exists course_students (
  course_id   uuid not null references courses(id) on delete cascade,
  student_id  uuid not null references users(id) on delete cascade,
  primary key (course_id, student_id)
);
create index if not exists course_students_student_idx on course_students(student_id);

create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references courses(id),
  host_id          uuid not null references users(id),
  title            text not null,
  code             text unique not null,
  status           text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  access_mode      text not null default 'view_only' check (access_mode in ('view_only', 'student_write')),
  allow_export     boolean not null default true,
  revoked_writers  uuid[] not null default '{}',
  page_count       int not null default 1,
  started_at       timestamptz,
  ended_at         timestamptz,
  last_activity_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists sessions_host_idx on sessions(host_id);
create index if not exists sessions_status_idx on sessions(status);

create table if not exists participants (
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists participants_user_idx on participants(user_id);

-- Rekaman papan: satu baris = satu aksi (bukan video)
create table if not exists board_events (
  session_id  uuid not null references sessions(id) on delete cascade,
  seq         int not null,        -- urutan per sesi, mulai dari 1
  t           int not null,        -- ms sejak sesi di-start
  author_id   uuid not null references users(id),
  op          jsonb not null,
  primary key (session_id, seq)
);

-- Keamanan: backend memakai service_role key (melewati RLS).
-- RLS diaktifkan TANPA policy supaya anon key / akses langsung dari browser tidak bisa baca-tulis apa pun.
alter table users           enable row level security;
alter table courses         enable row level security;
alter table course_students enable row level security;
alter table sessions        enable row level security;
alter table participants    enable row level security;
alter table board_events    enable row level security;
