# IMPERION Social Publisher — staging guide

**Status: staged in feature branch / draft pull request, NOT merged, NOT deployed, zero live social posts or connected credentials yet.**
**Owner review required before activating the timer or posting publicly.** Uses the existing Community Hub and its Events tab rather than a competing event CRM.

## Source & deliverables

- Canonical event source: Community Hub spreadsheet, tab `Events` (`SPREADSHEET_ID` in the existing `Code.gs`).
- Existing integrations reused: `getHeaderMap`, `getChannelId`, `sendTelegramMessage`, `postToFacebookPage`, `TELEGRAM_BOT_TOKEN`, `FACEBOOK_ENABLED`. Do not delete or modify the original `Code.gs`.
- New files: `SocialPublisher.gs`, `SocialPublisherAdapters.gs`, `SocialPublisherManual.gs`, and test `tests/social-publisher.test.cjs`.
- Delivery queue/receipts: additional `SocialPublishing` tab in that SAME spreadsheet. No new lead/customer CRM. Individual publication record per (Event_ID, Channel), with caption, scheduled date, attempt, post ID/link, error and legal checks.
- Channel routing: Telegram @pochody_brno_news (Brnowalkers) / @druzinamoravy_news (Družina); official Facebook **Pages**; professional Instagram single **IMAGE** posting; small YouTube video uploads where explicitly enabled; WhatsApp, personal Facebook and TikTok through owner-operated manual link/copy flow.

## Permissions and limits by channel

| Channel | Capability in this implementation | Prerequisite |
| --- | --- | --- |
| Telegram owned channels | **Automatic**, through existing Telegram Bot API | Valid bot token in Apps Script Properties, bot admin `Post Messages`, approved job and source event; get actual `message_id` |
| Facebook Pages | **Automatic**, official Graph Page feed | Valid Page token and `FACEBOOK_ENABLED=true`, correct per-brand Page routing; NOT personal profile |
| Facebook *personal* profile (~6.5k followers) | **Manual share panel**, copy, open, post, paste actual permalink | Official Facebook API does **not** provide posting to user profile; do not use self-bots, passwords or browser session bypass |
| Instagram photo feed | **Automatic** for an approved public HTTPS image | Professional IG account, Meta publishing permissions, stored `SOCIAL_IG_USER_ID` and `SOCIAL_IG_ACCESS_TOKEN`, `SOCIAL_INSTAGRAM_ENABLED=true` and rights, app permissions |
| WhatsApp groups/channels/status | **Manual share panel** with prefilled text; no auto-post to ordinary groups/channels | Personal/group WhatsApp ≠ opt-in WhatsApp Business messaging API; do not mass-message |
| YouTube (small video) | **Automatic**, via official `videos.insert`, staged adapter | Owner-authorised `youtube.upload` OAuth scope, `SOCIAL_YOUTUBE_ENABLED=true`; public upload separately `SOCIAL_YOUTUBE_PUBLIC_ENABLED=true`; approved rights and `Made_For_Kids`; video in Drive <=20 MiB |
| YouTube large videos | No auto in this Apps Script adapter | Use existing ShortFactory/VPS authenticated resumable upload worker after actual test. Don't load 100MB clips into GAS. |
| TikTok | **Manual owner share** pending developer Content Posting API authorization/audit | Video + usage rights and owner approved post; only change to direct automatic when audited app and auth are live |

**Meta brand mapping:** Metricool currently has one connected personal brand `chareshneu` for Facebook / Instagram / YouTube / Google Business, but its 13/16 Oct IG scheduled posts returned `ERROR: You have reached your Metricool account limit`. This code does NOT bypass any Metricool quota or automatically imply corresponding Meta developer authorisation. Do not duplicate earlier successfully published content; check live per-platform links first.

## Owner setup: minimum necessary sequence

1. In Google Drive/Apps Script attached to the existing Community Hub workbook, review and add the THREE `.gs` files from this feature branch, without altering original `Code.gs`. Verify local scope, OAuth and source-version alignment before any push/deployment. No secrets in GitHub/public repo or ChatGPT.
2. Execute `spInstallMenu()` ONCE in the bound Apps Script (asks for spreadsheet authorization and adds **Social Publisher** menu). Reload Community Hub. This is a menu installer, **not** a publishing action.
3. In existing `Events`, select one valid **Active**, non-Corporate real event and choose **Social Publisher → Prepare drafts**. This fills a `SocialPublishing` tab; it does NOT publish.
4. In each generated `SocialPublishing` row, confirm the correct legal `Entity` (OSVČ vs Družina z.s.), `Grant_Funded` = YES/NO and exact required `Grant_Text`, accurate `Caption`, `Scheduled_At`, `Media_URL` and rights; **inspect existing live platform for duplicates and set `Duplicate_Checked=YES` only after checking**. Video draft requires `Video_Drive_ID`, `Rights_OK=YES`, `Visibility` and `Made_For_Kids=YES/NO`; no fabricated media rights. Image post requires rights.
5. Select one draft row and choose **Approve selected job**. Only this operation changes state to `APPROVED` for official API routes, or `READY_MANUAL` for personal FB/WA/TikTok. Telegram and Facebook Pages check pre-existing `Telegram_Post_ID` / `Facebook_Post_ID` from canonical Events and reuse receipts.
6. For Facebook PERSONAL and WhatsApp choose **Open manual share panel**, click **Copy text**, then **Open destination**, and complete posting on your own account. If Facebook/TikTok, replace `Post_URL` with actual published post permalink; choose **Confirm manual publication**. WhatsApp status is marked **MANUAL_OWNER_CONFIRMED** (not verified by API).
7. For official API integrations, test ONE owner-approved nonpromotional post (e.g., private YouTube upload); inspect actual provider post IDs/permalinks before wider activation. **Do not install 15-minute timer until real adapter tests and permissions are verified.** `spRunDue()` is manually callable for a single due approved job and processes at most six per invocation.
8. Only after verification, **Install 15-minute publisher timer**. Unapproved `DRAFT` jobs are ignored. Status changes: `DRAFT → APPROVED → CLAIMED → PUBLISHED/ALREADY_POSTED`, or `REVIEW_REQUIRED` on API error; manual `READY_MANUAL → MANUAL_LINK_RECORDED / MANUAL_OWNER_CONFIRMED`. `CLAIMED` and errors are never automatically retried; inspect the remote platform before retrying because an API timeout may follow a successful publication.

## Work left before production acceptance

- Official Meta app permissions, correct professional IG profile IDs/Page tokens for each entity, verified public media hosting and relevant grant sponsor visuals.
- Apps Script `youtube.upload` consent/scopes and short sample clip test; video `Made_For_Kids` accurately assigned.
- Confirm whether existing Telegram tokens/admin rights and Apps Script installable triggers are actually live; run one bounded smoke post and check message IDs.
- Confirm originals of current event, price, location, non-profit vs commercial legal entity, insurance/safety before mass amplification; **18 Oct free hike** and **21 Oct 17:00–20:00** free HEMA/archery have distinct programme/venue and must not be mixed.
- A more advanced internal media/video pipeline should adapt vertical media to Instagram Reel, TikTok and YouTube Shorts from the existing ShortFactory, not republish photos as a fake “video”.
- Real provider receipts and owner action logs in existing Community Hub/IMPERION_Execution_Receipts. Zero verified Facebook personal posts, WA posts, Telegram bot posts, IG auto posts, TikTok posts, YouTube uploads from THIS new code so far.

## Safety & quality

- Default fail-closed: no approval, no post. Existing public post must be checked before approval (`Duplicate_Checked=YES`). Missing actual legal entity, grant terms or media rights blocks relevant destinations.
- Never auto-send direct marketing messages to member lists or WhatsApp contacts; only publish into authorised owned groups/channels.
- No production deployment, trigger installation, personal-account automation, API secrets or unconsented footage as part of this PR.
- Smoke check on authorized device `zmrzlina` using Node's `vm.Script`: two Apps Script files syntax OK; seven manual safety/approval checks passed. Full provider-connected integration E2E **not yet run**. This proves code parsing and guards only, not delivery.

## External distribution with permission

Already proven publisher: Brno Expat Centre (21 Oct HEMA/archery and 1 Nov hike on website; 21 Oct in newsletter by email 7 Oct). Warm students: ESN VUT (contacted, 14 Nov HEMA sharing agreement), ESN MUNI, FI/FSS MUNI channels where editors have earlier shown interest, SU FIT and SPS FEKT. Next low-friction discoverability: own website event listing/SEO, Czech event directories/city calendars, Google Business Profile, co-organisers' official university/event calendar listings. Participate in regional Facebook groups only within each group's advertising rules, never bulk scraped/member-spam. Measure `source → RSVP → actually attended → qualified inquiry/paid service`, separating nonprofit grant activity from OSVČ cash.

The master operations truth and current deployment status live in Google Drive project 03 and 80; this public engineering guide contains no private contact data or credentials.
