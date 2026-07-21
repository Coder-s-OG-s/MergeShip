-- ---------- chat_channels ----------
create table if not exists chat_channels (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references profiles(id) on delete cascade,
  mentee_id    uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists chat_channels_mentor_mentee_uniq on chat_channels(mentor_id, mentee_id);
create index if not exists chat_channels_mentor_idx on chat_channels(mentor_id);
create index if not exists chat_channels_mentee_idx on chat_channels(mentee_id);

-- ---------- chat_messages ----------
create table if not exists chat_messages (
  id           bigserial primary key,
  channel_id   uuid not null references chat_channels(id) on delete cascade,
  sender_id    uuid not null references profiles(id) on delete cascade,
  content      text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists chat_messages_channel_time_idx on chat_messages(channel_id, created_at);

-- Enable RLS
alter table chat_channels enable row level security;
alter table chat_messages enable row level security;

-- Policies for chat_channels
drop policy if exists chat_channels_access_policy on chat_channels;
create policy chat_channels_access_policy on chat_channels
  for all
  using (auth.uid() = mentor_id or auth.uid() = mentee_id)
  with check (auth.uid() = mentor_id or auth.uid() = mentee_id);

-- Policies for chat_messages
drop policy if exists chat_messages_read_policy on chat_messages;
create policy chat_messages_read_policy on chat_messages
  for select
  using (
    exists (
      select 1 from chat_channels cc
      where cc.id = chat_messages.channel_id
        and (cc.mentor_id = auth.uid() or cc.mentee_id = auth.uid())
    )
  );

drop policy if exists chat_messages_insert_policy on chat_messages;
create policy chat_messages_insert_policy on chat_messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from chat_channels cc
      where cc.id = chat_messages.channel_id
        and (cc.mentor_id = auth.uid() or cc.mentee_id = auth.uid())
    )
  );

drop policy if exists chat_messages_update_policy on chat_messages;
create policy chat_messages_update_policy on chat_messages
  for update
  using (
    exists (
      select 1 from chat_channels cc
      where cc.id = chat_messages.channel_id
        and (cc.mentor_id = auth.uid() or cc.mentee_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from chat_channels cc
      where cc.id = chat_messages.channel_id
        and (cc.mentor_id = auth.uid() or cc.mentee_id = auth.uid())
    )
  );

-- Enable Realtime
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  alter publication supabase_realtime add table chat_messages, chat_channels;
exception
  when others then
    -- Already added or unsupported
    null;
end$$;
