-- =============================================================================
-- In-app notifications (docs/03-database-schema.md §23, docs/11 §24, §40).
--
-- Written only by the nightly reminders job — the send-reminders Edge
-- Function, which uses the service role on the server. Signed-in users can
-- read their own notifications and mark them read; nothing else. No email or
-- SMS: notifications stay inside the app (docs/08 §37, docs/11 §37).
--
--   ASSIGNMENT_OVERDUE  to the person holding an asset past its expected return
--   WARRANTY_EXPIRING   to admins, when an asset's warranty ends within 30 days
--
-- dedupe_key names the reminder (e.g. "warranty:<asset>:<date>"), so running
-- the job twice never sends the same reminder twice.
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  type text not null,
  title text not null,
  message text not null,
  -- Where the notification leads in the app (a relative path).
  link text,
  dedupe_key text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_user_dedupe_key unique (user_id, dedupe_key),
  constraint notifications_type_valid
    check (type in ('ASSIGNMENT_OVERDUE', 'WARRANTY_EXPIRING')),
  constraint notifications_title_length
    check (char_length(btrim(title)) between 1 and 200),
  constraint notifications_message_length
    check (char_length(btrim(message)) between 1 and 1000),
  -- Same-site paths only, so a notification can never send someone elsewhere.
  constraint notifications_link_safe check (
    link is null
    or (
      char_length(link) <= 300
      and link ~ '^/[A-Za-z0-9/_.?=&%-]*$'
      and link !~ '^//'
    )
  ),
  constraint notifications_dedupe_key_length
    check (char_length(dedupe_key) between 1 and 200),
  constraint notifications_read_matches check (is_read = (read_at is not null))
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;

-- Only the read flag may change; read_at follows it.
create function private.notifications_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.link is distinct from old.link
    or new.dedupe_key is distinct from old.dedupe_key
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only the read status of a notification can change'
      using errcode = 'check_violation';
  end if;
  new.read_at := case when new.is_read then coalesce(old.read_at, now()) end;
  return new;
end;
$$;

create trigger notifications_before_update
  before update on public.notifications
  for each row execute function private.notifications_before_update();

-- -----------------------------------------------------------------------------
-- Access. Clients may read their own notifications and change only is_read;
-- they cannot create or delete any. The reminders job uses the service role,
-- which bypasses RLS; its privileges are granted explicitly here.
-- -----------------------------------------------------------------------------

alter table public.notifications enable row level security;

grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant select, insert, delete on public.notifications to service_role;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()))
  with check (user_id = (select auth.uid()));
