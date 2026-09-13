# Opal — Stage 4: Full Institutional Validation
Date: 2026-09-13

## Scope
Requested explicitly as the next stage after Stage 2 hardening: run the real Firestore
emulator (not a mock), run a real browser regression pass, and attempt to walk the full
cycle **IC → Conditions → Allocation → Fund Ledger → Reporting** end-to-end instead of
validating each layer in isolation.

## Executed

### 1. Real Firestore emulator (not mocked)
- Installed `tests/rules` dependencies fresh (`@firebase/rules-unit-testing`, `firebase-tools`).
- Ran `firebase emulators:exec --only firestore --project demo-test "node rules.test.mjs"`
  against a real, locally-running Firestore Emulator (standard edition).
- **Result: ALL PASSED** — every assertion (ownership, `icOnlyChange`, role-gated
  `investors`/`funds`/`commitments`/`capitalCalls`/`distributions`/`transactions` writes,
  append-only `oppAuditLog`/`underwritingVersions`/`icDecisions`) evaluated against real
  Firestore security-rule evaluation, closing the Stage 2 limitation ("no fresh emulator
  PASS is claimed").

### 2. Financial validation suite + syntax
- `node tests/financial/validation-suite.cjs`: **16/16 PASS** (unchanged set, re-confirmed).
- `node --check` on every file under `src/`: clean.

### 3. Real browser regression (Playwright, not a DOM simulation)
Ran headless Chromium against the app served over HTTP with `?demo=1` (the app's own
built-in local mode: Firebase is skipped entirely, state lives in `localStorage`), driving
real clicks against the real rendered DOM — not calling internal functions directly except
where explicitly noted below.

The sandbox's egress proxy resets connections to the CDN hosts `index.html` loads
(`cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, Google Fonts) — confirmed independently, and
already anticipated by the app itself (`core.js:3418`, "CDN blocked/offline — charts are a
visual enhancement, never load-bearing"). To keep the run genuine rather than skip
Reporting checks, the exact pinned CDN files (ExcelJS 4.4.0, pptxgenjs 3.12.0, Chart.js
4.5.1, Leaflet 1.9.4) were served from the equivalent npm packages via Playwright request
routing — the real libraries still executed, only the transport changed. This is a sandbox
network constraint, not an application defect, and does not affect end users.

**21/21 checks passed:**

| # | Check | Result |
|---|---|---|
| 1 | Dashboard loads in DEMO_MODE without throwing | ✅ |
| 2 | Demo seed opportunities present | ✅ |
| 3 | Opportunity detail opens | ✅ |
| 4 | `capitalAllocation` has no editable UI anywhere (see Finding A) | ✅ confirmed absent |
| 5 | IC decision written via the production write path (opportunity save → `icDecisions` append) | ✅ |
| 6 | IC Workflow section renders the new decision badge | ✅ |
| 7 | IC condition text renders in the detail view | ✅ |
| 8 | Institutional Hardening ledger count reflects the new `icDecisions` record | ✅ |
| 9 | Condition checkbox is a real, clickable control | ✅ |
| 10 | Real click flips condition `pending → met` | ✅ |
| 11 | New investor created via real UI form + click | ✅ |
| 12 | New fund created via real UI form + click | ✅ |
| 13 | Commitment recorded via real UI (1,000,000 SAR) | ✅ |
| 14 | Capital call recorded via real UI (400,000 SAR) | ✅ |
| 15 | Capital call marked paid via real click | ✅ |
| 16 | `fundLedgerSummary().paidIn` = 400,000 | ✅ |
| 17 | `investorLedgerRows().unfunded` = committed − paidIn = 600,000 | ✅ |
| 18 | Investor Ledger Excel export downloaded via real click (15,291 bytes, real .xlsx) | ✅ |
| 19 | `exportOpportunityExcel()` (underwriting workbook) runs clean on an opportunity carrying an IC decision | ✅ |
| 20 | `exportOpportunityPptx()` (IC deck) runs clean | ✅ |
| 21 | Zero uncaught JS runtime errors across the entire walk | ✅ |

Screenshots and raw results saved alongside this report's source run (dashboard, detail
before/after IC decision, condition toggled to met, fund detail empty/populated).

## Central finding: the five layers are real, but not wired to each other

Stage 4 was asked to validate the **cycle**, not just each station on it. Walking it end to
end surfaces a structural fact worth stating plainly rather than papering over with a green
checkmark:

**IC decisions, `capitalAllocation`, and the Fund Ledger are three independent data models
today, not one connected pipeline.**

- **IC → Conditions** is real and tested: a decision (`approve` / `approve_conditions` /
  `reject`) lives on the opportunity (`d.ic.decisions`, editable only by role via
  `canApproveIC()`) with its own `conditions[]` array (text/owner/dueDate/status), toggled
  independently, plus an immutable audit copy in the `icDecisions` collection. This part of
  the cycle works and is now proven against a real Firestore emulator and a real browser.
- **Conditions → Allocation** does not exist as a transition. Meeting all conditions on an
  IC decision does not trigger, unlock, or even flag anything in `capitalAllocation`. There
  is no code path that reads `conditions[].status` and writes to `capitalAllocation`.
- **Allocation itself is a schema stub, confirmed live in this run (Finding A):**
  `capitalAllocation:{targetEquity, maxAllocation, priority, committeeNote}` is added to
  every opportunity by `institutional-hardening.js`, but grep across `src/` and a live DOM
  scan of the rendered detail view (check #4 above) both confirm there is no wizard field,
  no detail-section input, and no `if-save`-style handler anywhere that lets a user set
  these four fields, and no other file reads them either. It is inert — present in every
  saved document, touched by nothing.
- **Allocation → Fund Ledger** consequently also does not exist. The Fund Ledger
  (`investors` / `funds` / `commitments` / `capitalCalls` / `distributions`) is a fully
  separate, fully working data model (proven again in this run: real commitment → real
  capital call → real "mark paid" → correct `fundLedgerSummary()`/`investorLedgerRows()`
  arithmetic → correct Excel export), but nothing about approving an opportunity, or
  setting its `capitalAllocation`, creates or updates a commitment, a capital call, or
  reserves capital against a fund. A fund manager has to separately, manually go create
  those records in the Investors & Funds view for a deal the IC just approved — there is no
  linkage, not even a suggested amount.
- **Reporting** correctly reflects whichever of the two models it was built to read:
  `institutional-hardening.js`'s detail section reads the `icDecisions` ledger; the
  Excel/pptx exports for an opportunity read that opportunity's own computed metrics; the
  Investor Ledger export reads the Fund Ledger collections. Each is internally consistent
  (confirmed above) — none of them stitches the other two together, because nothing upstream
  does either.

None of this is a defect introduced by Stage 2 or by this validation pass — it is the
state the codebase has been in since `capitalAllocation` was added "for future allocation
engine integration" (Stage 2 report, Important Limits). Stage 4 makes it verifiable rather
than assumed: the gap is exactly at the two arrows "Conditions → Allocation" and
"Allocation → Fund Ledger", confirmed by direct DOM inspection and by tracing every read/
write site of `capitalAllocation` and `icDecisions` in the source.

## What would actually close the cycle (Stage 5 candidate, not done here)
Validation intentionally stops short of building this — it would be new feature work, not
verification — but concretely, closing the loop would need:
1. A UI surface for `capitalAllocation` (wizard step or detail-section form), currently
   fully absent.
2. A transition rule: an IC decision reaching `approve` (or `approve_conditions` with all
   conditions `met`) becomes the trigger that either unlocks manual allocation entry or
   auto-drafts a commitment/capital-call pair against a chosen fund.
3. A real accounting subledger under the Fund Ledger itself — Stage 2's own "Important
   Limits" already flagged this ("Fund ledger still requires a full posted/locked/reversal
   accounting subledger for true fund-accounting grade"); today `commitments`/
   `capitalCalls`/`distributions` are freely editable/deletable records, not posted ledger
   entries with a reversal trail, so even a wired-up allocation engine would still be
   posting into a ledger that doesn't yet enforce immutability the way `icDecisions`/
   `underwritingVersions` already do.

## Important limits of this validation
- Playwright ran as an unauthenticated demo visitor (`analyst` role under `?demo=1`), which
  is *blocked by design* (`canApproveIC()`) from clicking the real "Approve" button — the
  approval *write* was therefore exercised by replicating the exact production write path
  (`persistOpportunity` then `persistIfRecord('icDecisions', ...)`, in that order, matching
  the documented "only after the opportunity save succeeds" invariant) rather than by an
  authenticated click. The condition-toggle *click* itself was a real, unmodified UI click
  (`canEditOpp()` is ownership-based and returns `true` in local/no-Firestore mode).
- Reporting/export libraries were served from local npm-equivalent files instead of the
  live CDNs because this sandbox's egress proxy resets those specific hosts; production
  users load the real CDN and are unaffected.
- Map rendering (Leaflet) and font loading were stubbed/local for the same reason; no map
  feature was exercised in this pass.
- This remains a single-node/local-mode regression pass, not a multi-user concurrency test
  (e.g. two users editing the same commitment simultaneously) and not a load test.
