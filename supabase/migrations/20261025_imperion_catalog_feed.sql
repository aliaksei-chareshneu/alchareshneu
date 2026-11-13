-- Live catalog synchronization migration, applied 2026-10-25. Secrets are only in Vault.
alter table public.imperion_rsvp_events
 add column if not exists source_kind text not null default 'MANUAL',
 add column if not exists source_seen_at timestamptz,
 add column if not exists source_active boolean not null default true,
 add column if not exists end_time_verified boolean not null default true,
 add column if not exists price_verified boolean not null default true;
alter table public.imperion_rsvp_events drop constraint if exists imperion_rsvp_events_source_kind_check;
alter table public.imperion_rsvp_events add constraint imperion_rsvp_events_source_kind_check check(source_kind in ('MANUAL','SHEET_FEED'));
create table if not exists public.imperion_catalog_sync_state (
 id integer primary key check(id=1),last_success_at timestamptz,feed_generated_at timestamptz,
 events_seen integer not null default 0,events_added integer not null default 0,
 events_updated integer not null default 0,events_withdrawn integer not null default 0,
 last_error_at timestamptz,last_error text,updated_at timestamptz not null default now());
alter table public.imperion_catalog_sync_state enable row level security;
revoke all on public.imperion_catalog_sync_state from public,anon,authenticated;
grant select,insert,update,delete on public.imperion_catalog_sync_state to service_role;
insert into public.imperion_catalog_sync_state(id) values(1) on conflict(id) do nothing;
CREATE OR REPLACE FUNCTION public.imperion_catalog_apply_feed(p_events jsonb, p_generated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_now timestamptz:=clock_timestamp();
 v_record jsonb;
 v_old public.imperion_rsvp_events%rowtype;
 v_id text;
 v_title text;
 v_comm text;
 v_cat text;
 v_venue text;
 v_begin timestamptz;
 v_price integer;
 v_known boolean;
 v_contact boolean;
 v_changed boolean;
 v_ids text[]:=array[]::text[];
 v_added integer:=0;
 v_updated integer:=0;
 v_withdrawn integer:=0;
 v_count integer;
begin
 if jsonb_typeof(p_events)<>'array' then raise exception 'events must be an array';end if;
 v_count:=jsonb_array_length(p_events);
 if v_count<1 or v_count>120 then raise exception 'unexpected feed length %',v_count;end if;
 if p_generated_at is null or p_generated_at<v_now-interval '36 hours'
   or p_generated_at>v_now+interval '1 hour'
 then raise exception 'stale or invalid feed timestamp';end if;

 for v_record in select value from jsonb_array_elements(p_events) loop
   v_id:=v_record->>'event_id';
   v_title:=left(btrim(v_record->>'title'),180);
   v_comm:=left(btrim(v_record->>'community'),100);
   v_cat:=left(btrim(v_record->>'category'),100);
   v_venue:=left(btrim(v_record->>'venue'),300);
   v_begin:=(v_record->>'begins_at')::timestamptz;
   v_price:=(v_record->>'price_czk')::integer;
   v_known:=coalesce((v_record->>'price_verified')::boolean,false);
   v_contact:=coalesce((v_record->>'contact_activity')::boolean,false);
   if v_id is null or v_id !~ '^PUB-[A-Z0-9-]{4,90}$'
     or v_id=any(v_ids) or char_length(v_title)<3
     or char_length(v_comm)<3 or char_length(v_cat)<2
     or char_length(v_venue)<3
     or v_begin is null or v_begin<v_now-interval '30 days'
     or v_begin>v_now+interval '550 days'
     or v_price is null or v_price<0 or v_price>999999
   then raise exception 'invalid/duplicated event feed row';end if;
   v_ids:=array_append(v_ids,v_id);

   select * into v_old from public.imperion_rsvp_events where event_id=v_id for update;
   if not found then
     insert into public.imperion_rsvp_events
       (event_id,title,community,category,begins_at,ends_at,venue,price_czk,
        data_controller,rules_url,contact_activity,public_listing,is_open,
        registration_mode,public_note,source_url,source_kind,source_seen_at,
        source_active,end_time_verified,price_verified)
     values
       (v_id,v_title,v_comm,v_cat,v_begin,v_begin+interval '1 minute',
        v_venue,v_price,'Organiser to confirm',
        'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/',
        v_contact,true,false,'PLANNED',
        'New event from the public Community Hub feed. End time, organiser, safety terms and registration are awaiting confirmation.',
        'https://script.google.com/macros/s/AKfycbzKdIEwIF4gH9Cku3IQPC8uTrvR1CtHjMAOIzexrR3Mz9nDSLQ1znfT8Y2SS873jCtsLg/exec',
        'SHEET_FEED',v_now,true,false,v_known);
     v_added:=v_added+1;
   else
     v_changed:=(v_old.begins_at is distinct from v_begin)
       or (v_old.venue is distinct from v_venue)
       or (v_old.price_czk is distinct from v_price)
       or (v_old.price_verified is distinct from v_known)
       or ((position('družina' in lower(v_old.community))>0) is distinct from (position('družina' in lower(v_comm))>0))
       or (v_old.category is distinct from v_cat);
     update public.imperion_rsvp_events
       set title=v_title,
           community=v_comm,
           category=v_cat,
           begins_at=v_begin,
           ends_at=case when ends_at<=v_begin then v_begin+interval '1 minute' else ends_at end,
           end_time_verified=case when v_old.begins_at is distinct from v_begin then false else end_time_verified end,
           venue=v_venue,
           price_czk=v_price,
           price_verified=v_known,
           source_kind='SHEET_FEED',
           source_seen_at=v_now,
           source_active=true,
           source_url='https://script.google.com/macros/s/AKfycbzKdIEwIF4gH9Cku3IQPC8uTrvR1CtHjMAOIzexrR3Mz9nDSLQ1znfT8Y2SS873jCtsLg/exec',
           public_listing=case when not v_old.source_active and v_old.source_kind='SHEET_FEED'
             then true else public_listing end,
           is_open=case when v_changed then false else is_open end,
           registration_mode=case when v_changed and registration_mode='FORM'
             then 'PLANNED' else registration_mode end,
           public_note=case when v_changed and v_old.registration_mode='FORM'
             then 'Public source details changed; online registration paused pending organiser re-approval.'
             else public_note end,
           updated_at=case when v_changed or v_old.title is distinct from v_title
                 or not v_old.source_active then v_now else updated_at end
       where event_id=v_id;
     v_updated:=v_updated+1;
   end if;
 end loop;

 update public.imperion_rsvp_events
   set source_active=false,is_open=false,registration_mode='PLANNED',
       public_listing=false,
       public_note='Removed from active public source. Do not register or travel without organiser confirmation.',
       updated_at=v_now
 where source_kind='SHEET_FEED'
   and source_active=true
   and event_id<>all(v_ids);
 get diagnostics v_withdrawn=row_count;

 update public.imperion_catalog_sync_state
   set last_success_at=v_now,feed_generated_at=p_generated_at,
     events_seen=v_count,events_added=v_added,events_updated=v_updated,
     events_withdrawn=v_withdrawn,last_error=null,updated_at=v_now
 where id=1;

 return jsonb_build_object('ok',true,'source','Community Hub public Active feed',
       'seen',v_count,'added',v_added,'updated',v_updated,
       'withdrawn',v_withdrawn,'last_success_at',v_now);
end;
$function$
;
revoke all on function public.imperion_catalog_apply_feed(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.imperion_catalog_apply_feed(jsonb,timestamptz) to service_role;
CREATE OR REPLACE FUNCTION private.kick_imperion_catalog_sync()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_token text; v_request_id bigint;
begin
 select decrypted_secret into v_token
 from vault.decrypted_secrets
 where name='event_operator_cron_token';
 if length(coalesce(v_token,''))<24 then
   raise exception 'catalog cron credential unavailable';
 end if;
 select net.http_post(
   url:='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-catalog-sync',
   body:='{}'::jsonb,
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-token',v_token),
   timeout_milliseconds:=30000
 ) into v_request_id;
 return v_request_id;
end;
$function$
;
revoke all on function private.kick_imperion_catalog_sync() from public,anon,authenticated;
select cron.schedule('imperion_catalog_sheet_feed_hourly','7 * * * *','select private.kick_imperion_catalog_sync();');
