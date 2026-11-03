-- Home (PR 12) -------------------------------------------------------------------
--
--   Announcement          the cards at the top of Home. Tech adds and retires
--                         rows until an organizer editor exists; one tied to a
--                         deadline gets ends_at so it disappears on its own
--   active_announcements  the live rows for a member or a non-member, by
--                         database time
--   event_statuses        a student's status for every event they have a draft
--                         or an application for, for the Home badges
--
-- Hand-run in the Supabase SQL Editor (staging first). Independent of the event
-- day migrations. Safe to re-run.
-- -----------------------------------------------------------------------------

create table if not exists "Announcement" (
  announcement_id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  display_order int not null default 0,
  -- A membership offer is non_members only, so members never see it
  audience text not null default 'everyone' check (audience in ('everyone', 'members', 'non_members')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Only the API reads it
alter table "Announcement" enable row level security;

create or replace function active_announcements(p_is_member boolean)
returns setof "Announcement" language sql stable as $$
  select * from "Announcement"
  where is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and audience in ('everyone', case when p_is_member then 'members' else 'non_members' end)
  order by display_order asc, created_at desc;
$$;

-- status is the application's status, or null when there's only a draft
create or replace function event_statuses(p_user_id "Attendee".user_id%type)
returns table (event_id uuid, status "ATTENDEE_STATUS", has_draft boolean, payment_due_at timestamptz)
language sql stable as $$
  select coalesce(a.event_id, d.event_id), a.status, d.event_id is not null, a.payment_due_at
  from (select * from "Attendee" where user_id = p_user_id) a
  full join (select * from "Drafts" where user_id = p_user_id) d on d.event_id = a.event_id;
$$;

-- Only the API (service role) may call these
revoke execute on function active_announcements from public, anon, authenticated;
revoke execute on function event_statuses from public, anon, authenticated;
grant execute on function active_announcements to service_role;
grant execute on function event_statuses to service_role;
