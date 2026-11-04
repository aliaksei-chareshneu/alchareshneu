# Družina Moravy — training content rotation (owner-approved programme draft)

**Version:** 2026-11-04, corrected content-rotation policy. Pilot content only; not a booking or event confirmation.
**Applies to:** candidate Monday and Saturday sessions only, subject to confirmed calendar, venue, instructor, insurance and safeguarding checks. Thursday 18:00 is excluded. A 120-minute lesson is a proposed format, NOT a confirmed duration or booking. Saturday 2026-11-07 is cancelled; Monday 2026-11-09 remains tentative. Does not authorise new paid HEMA bookings.

## One three-week schedule, independent of weekday

| Cycle week | Monday (candidate) | Saturday (candidate) |
|---|---|---|
| 1 | TECH | GROUP |
| 2 | GROUP | SCENARIO |
| 3 | SCENARIO | TECH |

This is a content rotation, not a published event schedule. All slots require separate verification. The cancelled 7 November session is not reinstated.

Repeat the pattern without resetting when a session is cancelled. The deterministically tested calculation is in `scripts/druzina_training_rotation.py`: `format = FORMATS[(whole_weeks_since_2026_11_02 + weekday_offset)%3]`, offset Mon=0, Sat=1 (update the implementation and tests before relying on computed overlays). Dates are interpreted as **Europe/Prague LOCAL dates**; never derive the format from the UTC weekday of a midnight boundary.

The **weekly lesson theme** is independently selected from the existing `Druzina_Pesak_Modules` 12-module syllabus (PESAK-01 through 12, repeat for revision). A person may enter on any weekday: personal STOP/safety induction is always required, regardless of the scheduled module. Existing `Monday_Foundations` / `Thursday_Application` / `Saturday_Team_LARP` columns are drill-library variants, **not** fixed-day assignments after this rotation.

### Three formats

- **TECH — controlled technique:** stance, distance, safe defence, timing, movement, weapon recovery and personal corrective feedback; adapt sword-and-shield, archer, or advanced-weapon work to the trainer's verified competence.
- **GROUP — shield-line / small-team exercises:** 2v2 or 3v3 cooperative roles, safe formations, signals, protection of a teammate, rotation and graduated controlled pressure. No unstructured full-intensity novice melee.
- **SCENARIO — objective-based tactics:** safe defence of a corridor or flag, line withdrawal, flank coordination, rescue or formation change. Short, timed rounds, role switching, explicit rules and post-round debrief; never award unverified kills or harmful aggression.

**Proposed 120-minute template (not yet a confirmed session duration):** 0–15 min risk/gear/STOP, 15–35 shared weekly module + novice induction, 35–85 format-specific supervised practice, 85–105 controlled application or LARP-role scenario, 105–120 cooldown/debrief and private feedback. For any confirmed shorter slot, the instructor must shorten the plan to fit the authorised booking. No exercise is mandatory when a person needs a safe non-contact alternative.

### Safety and rank separation

- Observe event-specific permitted targets and approved soft-weapon specifications. No unauthorized thrust, shield bash, joint lock or unsupervised projectile use.
- Archery only on a separately confirmed, adequately supervised range/lane. Never shoot into a mixed group-fighting area by default.
- Attendance is not a completed skill; a verified instructor signs a distinct private record with member, session, date, safety observation and real evidence. Payments and reservations never count as attendance.
- Discipline levels I / II / III are *educational milestones*. The approved earned combat rank **B-I–B-V**, command qualification **C-I–C-V**, craft qualification **K-I–K-V**, temporary role **O**, tariff **S**, and merit **A** remain separate. No Tier-III `Master` means an automatic teacher/instructor licence. The optional mentor / instructor-candidate activity requires separate assessment and lawful authorisation.
- Leadership C-I is a supervised 2–5-person task; C-II has two tasks on different dates; higher command is evidenced leadership and independent review — **not** combat attendance quotas.

### Source-of-truth integration / no duplicate CRM

Inside the EXISTING Community Hub:
1. `Druzina_Sessions` holds actual staged session ID, time, location, booking/attendance state and the updated future **Theme**. No new or changed booking products, capacity, calendar time or payment policy.
2. `Druzina_Training_Rotation` holds the content overlay by existing `Session_ID` (previously staged records (reconcile with current cancellations and tentative dates before use), `INTERNAL_PLAN_ONLY`), topic, cycle, independent calendar check, staff review and exception notes. This is **not** a second session book or attendance log. The declared content for future ungenerated dates can be computed by the script when the underlying session exists.
3. `Druzina_Pesak_Modules` and `Druzina_Pesak_Progress` remain the Tier-I infantry module catalogue and evidence. `Druzina_Track_Checkpoints` and `Druzina_Track_Progress` remain DRAFT skill assessments for archer and advanced tracks; do not switch status to ACTIVE without approval.
4. `Druzina_Public_Profiles` + `Druzina_Achievement_Evidence` are opt-in adult public leaderboard sources, with explicit proof and double-count protection. Do not publish raw roster or child data.

**Whenever new sessions are staged:** resolve authoritative local start date; compute format with `plan_for_day()`; look up the existing `Session_ID`; append a single matching content overlay row after verifying uniqueness and date; use a reviewed `Theme` in the same existing `Druzina_Sessions` row. If calendar, qualified instructor or venue is missing, retain `INTERNAL_PLAN_ONLY`. If the planned date is cancelled, record verified cancellation instead of inventing attendance or shifting the 3-week cadence.

**Private scheduling exceptions:** instructor/venue feasibility, holidays and other conflicts are reviewed in the access-controlled Community Hub only. Do not copy calendar details into public website content; do not silently cancel agreed lessons.

**Tests:** `python3 -m unittest discover -s tests -p 'test_druzina_rotation.py' -v` and `npm test` (browser path test). Review after three complete rotation weeks for fairness, instructor load, incidents, repeat attendance and participant feedback. Do not interpret enrolment or site clicks as successful training.

## 2026-11-04 publication and retention safeguards

- Public-facing specialisations describe learning choices, not earned rank, event admission, instructor certification or a promise of a booked session.
- Tie SCENARIO objectives to a *specific organiser-confirmed LARP* only after checking its date, participation, equipment, permitted actions and safety rules. Otherwise describe hypothetical practice scenarios without implying event participation.
- Existing earned B/C/K ranks and member rights remain untouched; reconcile public rank descriptions against the approved rank register before changing any rank labels or thresholds. Conflicting B/C/K ranges in older drafts must not be treated as authoritative.
- Invite Martin, Ethan and Pasha individually to a voluntary small pilot only after checking contact history, preferences and consent; no presumed attendance or new payment commitment. Ask about preferred roles, LARP relevance, barriers to return and whether they want follow-up. Store answers in the existing private motivation/CRM record, not public profiles.
- Pilot: three *actually confirmed* sessions, with opt-in participation; track invitations, consent, actual attendance, safety issues, perceived LARP usefulness and voluntary return interest. Review after the third delivered session, not after three calendar slots.
