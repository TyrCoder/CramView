-- Cramview cloud sync. Paste this whole file into Supabase > SQL Editor > New query > Run.
-- One generic table: every reviewer, question, flashcard and attempt is a row holding its JSON.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  store      text        not null check (store in ('reviewers', 'questions', 'flashcards', 'attempts')),
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,                 -- when the user last edited it (set by the app)
  synced_at  timestamptz not null default now(),   -- when the server received it (set by trigger)
  primary key (user_id, store, id)
);

create index if not exists records_pull_idx on public.records (user_id, synced_at);

-- Each person can only see and change their own rows.
alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.touch_synced_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at = now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_synced_at();
