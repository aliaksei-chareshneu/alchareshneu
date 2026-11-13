# Community links after existing RSVP — privacy and deployment

Updated 2026-11-01. Implementation uses existing GitHub Pages, Supabase
`imperion-register`, and bound Community Hub Apps Script and CRM. A source
commit alone does not update the bound Apps Script.

## Rules
- CS/EN -> WhatsApp News. RU/UK -> Telegram News. The server selects
  the community by verified event.community (Družina or BrnoWalkers).
- Successful adult RSVP, except NO, receives a **voluntary** information
  channel link, with phone/profile visibility disclosure. Unknown organizers,
  minors, declined RSVP receive no community invitation.
- Never return restricted chat links from public GET or post-submission API.
- BrnoWalkers discussion chat: only after confirmed attendance plus manual
  `Chat_Access_Approval=ATTENDED_VERIFIED` in canonical `Registrations`.
- Družina Moravy discussion chat: after first training and verified payment
  for the subsequent session plus operator approval
  `Chat_Access_Approval=ATTENDED_AND_NEXT_TRAINING_PAID_VERIFIED`.
- Marketing consent remains separate, requires verification; RSVP is not a
  waiver, confirmed attendance, booking, invoicing or payment. Minors keep
  existing guardian requirements and never receive invitation links.

## Sources
`00 READ FIRST — CANONICAL WEBSITE FACTS` and `00 IMPERION — GLOBAL
CANONICAL MASTER` on the existing Google Drive, with matching site links.
All eight destination HTML pages returned HTTP 200 and matching titles on
2026-11-01; administrator join approval remains outside HTTP verification.

## Private Apps Script configuration (existing bound project only)
Restricted community-chat URLs are intentionally **not hardcoded into the
public GitHub repository**. Enter the exact verified links from the above
Drive documents into Script Properties of the verified Community Hub bound
Apps Script, with these keys:

- `IMPERION_CHAT_DRUZINA_WA` — Družina WhatsApp chat
- `IMPERION_CHAT_DRUZINA_TG` — Družina Telegram chat
- `IMPERION_CHAT_BRNOWALKERS_WA` — BrnoWalkers WhatsApp chat
- `IMPERION_CHAT_BRNOWALKERS_TG` — BrnoWalkers Telegram chat

No value or malformed value => no chat invitation. The same existing
`Registrations` tab gains only `Chat_Access_Approval`,
`Chat_Invite_Status`, `Chat_Invite_Attempts` and `Chat_Invite_Sent_At`
columns on **optional** chat invitation queue activation.
`IMPERION_CHAT_INVITES_LIVE` must be explicitly `true`; default disabled.
Check `Check_In_At`, proper controller, language, approval and
`SENT_TO_PROVIDER` readback. Sending != delivery/accepted membership.

**Bound-script deployment gate:** verify the current Community Hub bound
Apps Script first. Replace ONLY its existing `imperion-intake-sync.gs`
script file with the tested source, do not overwrite `Code.gs` or install
a duplicate trigger/CRM. Test receipt email to an authorized address and
read back the current installed script. A GitHub merge does not fulfill
this release gate; leave it marked BLOCKED if the bound project is
not accessible. News group and restricted-chat emails remain source-only
until this gate is verified.

## Local tests
```sh
node --test tests/imperion-community-routing.test.cjs tests/imperion-intake-bridge-source.test.cjs tests/imperion-receipt-mailer.test.cjs
node tests/imperion-rsvp-source.test.cjs
npm run test:security
npm run test:dom
```
Read-only live check GET / GET site / OPTIONS. Do not create synthetic
production registrations just to assert an email.
