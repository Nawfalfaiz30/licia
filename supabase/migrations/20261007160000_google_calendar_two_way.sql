alter table if exists public.schedule_blocks
  add column if not exists google_calendar_id text,
  add column if not exists google_event_id text,
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz,
  add column if not exists sync_source text default 'licia';

create unique index if not exists schedule_blocks_google_event_unique
  on public.schedule_blocks(user_id, google_calendar_id, google_event_id)
  where google_event_id is not null;

create index if not exists schedule_blocks_google_updated_idx
  on public.schedule_blocks(user_id, google_updated_at desc)
  where google_event_id is not null;