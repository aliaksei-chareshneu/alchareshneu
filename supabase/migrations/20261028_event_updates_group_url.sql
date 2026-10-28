-- Logistics-only group invitation per event. Canonical source: existing Events AG.
-- The anonymous /imperion-register GET catalog excludes this column.
alter table public.imperion_rsvp_events
  add column if not exists updates_group_url text;
comment on column public.imperion_rsvp_events.updates_group_url is
  'Event-specific logistics invite. Show only in adult non-declined RSVP POST response or transactional email.';
do $$
begin
 if not exists (
   select 1 from pg_constraint
   where conname = 'imperion_updates_group_url_whatsapp_only'
     and conrelid = 'public.imperion_rsvp_events'::regclass
 ) then
   alter table public.imperion_rsvp_events
     add constraint imperion_updates_group_url_whatsapp_only
     check (updates_group_url is null or
       updates_group_url ~ '^https://chat[.]whatsapp[.]com/[A-Za-z0-9]{22}$');
 end if;
end $$;
