# AI01 — Practical AI at Work
## Instructor-ready 3-hour workshop pilot (general and B2B)

**Status:** workshop plan and exercises ready for an agreed pilot. Quotation, attendance, employer approval, tools and data-access scope must be agreed before a paid delivery. Existing standard corporate workshop reference: indicative 12,900 Kč for 3 hours; do not treat this note as a binding offer.

**Audience:** operations, administration, support and technical teams.
**Outcome:** one selected repetitive task is described as a safe draft → verify → approve workflow, with a sample checklist, owner and measurement plan.
**Boundaries:** no client files, employee personal data, contracts or non-public documents are entered into a third-party model without the client's explicit authorised security review.

### Agenda (180 minutes)
- 00–15: baseline questionnaire; what task takes time, who approves the result?
- 15–35: distinguish drafting, extraction, classification and decision-making.
- 35–60: exercise 1 — rewrite a vague request into a specific prompt with checks.
- 60–80: exercise 2 — identify unsupported claims, fabricated references and hidden assumptions in a sample AI answer.
- 80–90: break.
- 90–120: exercise 3 — design a small task automation with a mandatory human approval gate.
- 120–145: exercise 4 — create a test set, acceptable-error thresholds and a fallback.
- 145–165: peer review and privacy/security checklist.
- 165–180: measured next steps and one-page handover.

### Practice case — entirely fictional
A small repair service receives ten synthetic enquiries about opening hours, repair status and invoice questions. Drafts must never claim an invoice was paid, reveal personal details or promise a delivery date without a verified source.

**Task:** create a rubric that accepts a proposed answer only if:
1. It matches an approved information source.
2. It explicitly marks missing facts as unknown.
3. It does not invent a commitment, discount or payment.
4. It leaves customer-facing sending to a named human reviewer.
5. It can be reproduced on a short test set.

### Reusable prompt template
```
Role: Draft assistant; not authorised to send, approve or promise.
Input: {synthetic_task_description}
Approved sources: {list_approved_non_sensitive_sources}
Output: (a) proposed draft, (b) factual source for each claim,
(c) uncertainties / items requiring human confirmation,
(d) security and privacy risks, (e) suggested reviewer.
Rules: Do not invent missing facts, names, dates, approvals,
prices or commitments. Ask for review when information is absent.
```

### Evaluation worksheet
Test five fictional cases: straightforward request, incomplete date, conflicting source, request involving third-party data, and attempted instruction injection. Record pass/fail plus reason. Baseline metric: total human minutes per case **including review and correction**; do not claim saved time without a before/after measurement.

### Completion and follow-up
Participants submit a one-page workflow card: owner, trigger, approved data, model task, human gate, tests, failure path and metric. Instructor performs substantive review. A company-specific implementation is a **separate paid and signed scope**, not silently included in this workshop.
