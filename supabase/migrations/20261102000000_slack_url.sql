-- Event day: Discord to Slack ------------------------------------------------------
--
--   Event.slack_url   the event's Slack channel link, shown to Registered students
--                     in Team Formation. Was discord_url; PMC moved from Discord to
--                     Slack. Links already saved carry over.
--
-- Hand-run in the Supabase SQL Editor (staging first), after
-- 20261028000000_event_day_schema.sql. A database that ran the newer event day
-- schema already has slack_url, and this does nothing. Safe to re-run.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Event' and column_name = 'discord_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Event' and column_name = 'slack_url'
  ) then
    alter table "Event" rename column discord_url to slack_url;
  end if;
end $$;

alter table "Event" drop constraint if exists event_discord_url_check;
alter table "Event" drop constraint if exists event_slack_url_check;
alter table "Event" add constraint event_slack_url_check
  check (slack_url is null or slack_url ~ '^https://');
