-- Add explicit public catalog visibility separately from registration eligibility.
-- Applied to production 2026-10-25. Public events are never writable by anon.
alter table public.imperion_rsvp_events
 add column if not exists registration_mode text not null default 'PLANNED',
 add column if not exists action_url text,
 add column if not exists public_note text,
 add column if not exists source_url text;
alter table public.imperion_rsvp_events
 drop constraint if exists imperion_rsvp_registration_mode_check;
alter table public.imperion_rsvp_events
 add constraint imperion_rsvp_registration_mode_check
 check (registration_mode in ('FORM','CONTACT','PLANNED'));

-- Keep the original explicitly open free hike bookable when replayed from scratch.
update public.imperion_rsvp_events
 set registration_mode='FORM',updated_at=now()
 where is_open=true and registration_mode='PLANNED';
-- 14.11 confirmed Orel accepts contact only until the organiser acknowledges it.
update public.imperion_rsvp_events
 set registration_mode='CONTACT',
 action_url='https://wa.me/420702914842?text=OREL%2014',
 public_note='Confirmed event; the organiser must personally accept each request.',
 updated_at=now()
 where event_id='PUB-OREL-20261114' and not is_open;

-- POST must independently check is_open=true AND registration_mode='FORM'.
-- No blanket sync: the source calendar contains cancelled, closed-school and
-- internal-only sessions that must not be silently opened to the public.
