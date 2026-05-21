-- Add mentorship session and message logging tables.

create table if not exists mentorship_sessions (
  id bigserial primary key,
  mentor_id uuid not null references profiles(id) on delete cascade,
  mentee_id uuid not null references profiles(id) on delete cascade,
  level integer not null default 1,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists mentorship_sessions_mentor_id_idx on mentorship_sessions(mentor_id);
create index if not exists mentorship_sessions_mentee_id_idx on mentorship_sessions(mentee_id);

create table if not exists messages (
  id bigserial primary key,
  session_id bigint not null references mentorship_sessions(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  timestamp timestamptz not null default now(),
  read_status text not null default 'unread' check (read_status in ('unread', 'read'))
);

create index if not exists messages_session_id_idx on messages(session_id);
create index if not exists messages_sender_id_idx on messages(sender_id);
