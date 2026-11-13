# Imperion events: live CRM feed to protected signup catalog

- Source of truth: Community Hub spreadsheet, `Events` tab. Deployed Apps Script publishes Active, non-corporate, future entries with a registration link. Separately approved statuses remain in Supabase RSVP intake.
- Cron `imperion_catalog_sheet_feed_hourly` runs at minute 7 UTC using existing Supabase Vault cron secret. Private Edge `imperion-catalog-sync` accepts POST only with authenticated token, fetches fixed Google Apps Script public JSONP feed, strict JSON parses, validates freshness and IDs, and calls service-role transactional RPC `imperion_catalog_apply_feed`.
- New Active feed entries become catalog `PLANNED` and `is_open=false`; only separately approved events open `FORM`. Material venue/date/price/category or Družina-controller shift closes FORM until owner verifies it. Cosmetic community renames do not.
- Entries removed from public Active feed are hidden and blocked, not deleted. Other manual entries outside feed are unaffected.
- Unknown prices remain unknown; server-side POST requires `price_verified=true`, `source_active=true`, `registration_mode=FORM`, `is_open=true`.
- SQL receipt: `select * from public.imperion_catalog_sync_state where id=1`. Raw HTTP response by pg_net ID for independent readback.
- GitHub `Code.gs` source raises the feed limit from 6 to 80 and fixes null prices; **this GAS source update is NOT deployed** until authenticated Apps Script editor/CLI is available. Live GAS still has six-item cap and 300-second cache. Never claim unbounded feed coverage while that is the case.
- Three Community Hub Events row URLs (15,20,25) now point to `/register/?event=ID`, already verified by readback. New public calendar cards will link similarly; status gates remain server-side.
- Automatic export of confidential RSVP details to the same Google Sheet `Registrations` and Gmail/Telegram notifications is **NOT active**: server-to-Google authenticated write credential has not been connected. Do not expose a public PII export or create duplicate CRM.
