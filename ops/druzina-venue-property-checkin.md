# Družina Moravy / BrnoWalkers — venue and property check-in SOP
Status: REVIEW / NOT DEPLOYED · Draft 2026-11-15 · Rule version `2026-11-15-property-v1`
Owner: Družina Moravy z. s. for its club events; verify the actual legal organiser/controller separately for other events.
New spending authorised: 0 Kč.

## Purpose and scope
Protect the owner's premises, third-party property, and club gear without purporting to remove rights from attendees or third parties. These rules apply prospectively only, without establishing the circumstances or cause of any past incident.

## Before booking
1. The existing shared `/register/` form has **two separate unchecked required controls**: safety guidance and property care. The property control links to `/register/property/` with full versions in Czech, English, Russian and Ukrainian. The photography and invitation choices remain optional and independent.
2. Both must be true before submission; server `imperion-register` validates both and the exact public property version. The existing RSVP/enquiry record captures the version in `safety_version`, alongside the existing `safety_acknowledged` and server-created `created_at` timestamp; a consistent version identifies that both mandatory controls were checked. Existing private intake bridge and CRM keep the same record IDs. Do not create another database or store a separate public attendance list.
3. **Minor children**: checking a webpage control does not replace separate written legal guardian consent or supervision/safety arrangements. A minor's damages are subject to Czech Civil Code §§2920–2921. Stop enrolment where actual guardian authorisation cannot be verified.

## Before using any indoor premises
1. Agree with the venue owner which rooms and toilets are actually available. The leader and venue representative should photograph all accessible rooms **at handover before and after use**, showing wide establishing shots, doors, corners and any pre-existing defects. Obtain lawful permission to document private premises and limit access to the photographs.
2. Give each attendee a working direct registration/QR URL, and check the existing private response against the real name before entry to activity space. **For walk-ins, enforce check-in before training**: the attendee must acknowledge both rules through the same secure form if a confirmed event is open. If the form is offline/registration closed, use a dated **paper acknowledgement** with name, guardian where applicable, organiser/event ID and signatures, held securely by the organiser for later integration into the existing protected event record. Do NOT manufacture an online checkmark or backdate any signature.
3. Explain the rooms and safe activity area orally, and explicitly prohibit blows against walls and fixtures. For HEMA, keep the existing instructor briefing, equipment check, and STOP rules.

## If damage is reported
1. Record exact room, location, time of discovery, identifying surrounding landmarks, the first discoverer and who had access. Ask for unedited original close-up and wide-shot photos, prior handover photos, access chronology and any witness account.
2. Do not accuse individuals, assume causation from chronological proximity, claim a blanket waiver, promise reimbursement or pay without competent fact-finding and the correct legal entity/insurance pathway. A property-care checkbox is not a confession.
3. If unsafe, ask the premises owner to isolate the affected area. Notify the relevant policyholder/insurer when a credible insured incident is identified, and follow policy deadlines. Do not publicize private evidence or involve attendees in speculative group blame.

## Release and readback gates
- Draft branch/PR != deployed. Confirm owner GO, legal wording, controller, tests, retention policy and correct form routing.
- Release order matters: update policy+frontends first, verify browser checkboxes in CZ/EN/RU/UK and the existing versioned response. Then deploy the **matching** Supabase Edge Function, test rejection of missing/version-mismatched property acknowledgement, and perform one synthetic permitted complete submission. Avoid a public/backend version mismatch.
- Confirm the recording in the existing private registration/enquiry table and CRM, the successful GitHub Pages release, and a real browser's disabled submit when the required box is empty. Only then set LIVE.
- For venues without registrations, a human check-in coordinator remains essential. A static page cannot make someone physically present accept terms automatically.

Evidence: `register/index.html`, `register/property/index.html`, `supabase/functions/imperion-register/index.ts`, `tests/druzina-property-care.test.cjs`.
