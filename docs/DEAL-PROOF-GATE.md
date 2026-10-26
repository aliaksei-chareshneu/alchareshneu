# Deal Proof Gate — evidence before revenue

This is a **read-only local check** for a single OSVČ B2B opportunity. It does not open Gmail, read the CRM, connect to a bank, write to a spreadsheet, contact a customer, create an invoice or declare a sale.

## Use from the existing repository

```sh
node ops/deal-proof-gate.cjs
node ops/deal-proof-gate.cjs --stdin < private-local-input.json
node --test tests/deal-proof-gate.test.cjs
```

The JSON input stays on the operator's machine. Do not add real opportunities or identifiable buyer evidence to Git or CI. Use brief **source reference labels** only; the utility never echoes them. The recognized fields are:

- `entity`: `OSVC`. Separate NGO and unlicensed competitive/sports HEMA activity require legal review and remain on hold.
- `buyer_source`, `problem`, `authority`, `budget_source`: qualify the real buyer.
- `scope`, `deliverable`, `acceptance`, `price_source`, `payment_terms`, `cancellation_terms`: create a complete nonbinding proposal gate.
- `written_order_source`: order evidence, not an automatic contract.
- `invoice_source`: invoice evidence, not a payment.
- `bank_readback_source`, `payee_confirmation`: bank and correct-beneficiary evidence; must be independently reviewed.
- Optional `economics`: `quoted_czk`, `external_cost_czk`, `founder_hours`, `probability`, `probability_source`, `expected_payment_days`. Calculations are explicitly **scenario** values, not cleared cash.

Example input below is *entirely synthetic*:

```json
{
  "entity": "OSVC",
  "buyer_source": "Synthetic buyer reply",
  "problem": "Manual report transformation",
  "authority": "Synthetic budget owner confirmed",
  "budget_source": "Synthetic budget note",
  "scope": "One repeatable internal data process",
  "deliverable": "Reproducible QA checks and code",
  "acceptance": "Runs correctly on the agreed synthetic dataset",
  "price_source": "Synthetic approved quote",
  "payment_terms": "As agreed in signed order",
  "cancellation_terms": "As agreed in signed order",
  "economics": {
    "quoted_czk": 14900,
    "external_cost_czk": 2900,
    "founder_hours": 8,
    "probability": 0.4,
    "probability_source": "Synthetic research scenario",
    "expected_payment_days": 21
  }
}
```

Result levels `LEAD` → `BUYER` → `OFFER` → `ORDER` → `INVOICE` → `BANK` describe **entered evidence completeness only**; `verified_cash` and `verified_order` remain false. Production classification requires original Gmail/contract/invoice/bank readbacks, deduplicated in the existing canonical pipeline. This tool is not a replacement for CRM, legal documents, invoice software, owner approval or an actual bank statement.

Status: **GitHub source/CI pilot only**; no rollout to private Apps Script and no earnings attributed to this utility.
