# Opal — Stage 6: Fund Ledger Full Re-Architecture (Posted / Locked / Reversal)
Date: 2026-09-13

## Scope
The gap Stage 5 explicitly left out of scope, by the user's own explicit choice after being
asked directly whether closing it was risky and whether I could do it: rebuild the Fund
Ledger (`commitments`, `capitalCalls`, `distributions`, `transactions`) into a real
posted/locked/reversal accounting subledger — no direct edit or delete on any posted record;
every correction is a new, documented reversal entry. Scope selected: **"إعادة هندسة كاملة
الآن" (full re-architecture now)**.

## 1. What "posted" means for each collection
- **`commitments`** — locked from the moment of creation. There is no draft state: an
  investor's commitment is a single accounting fact, not a form that stays open. `allow
  create` only; `update`/`delete` are unconditionally `false`.
- **`capitalCalls`** — a draft while `status=='pending'` (freely editable/deletable, exactly
  as before this stage). Locked the instant `status` becomes `'paid'` or `'waived'` — that one
  transition (`pending → paid/waived`) is the only write a posted record's lifecycle permits,
  enforced as `allow update: if ... resource.data.status == 'pending'`. A call auto-generated
  by an in-kind commitment (`linkedCommitmentId` set) is created already `'paid'`, so it is
  locked immediately too.
- **`distributions`** — same pattern: draft while `status=='declared'`, locked at `'paid'`.
- **`transactions`** — the audit trail already had no edit UI (verified before touching
  anything); now enforced server-side too: `allow create` only, matching `icDecisions` /
  `underwritingVersions` / `oppAuditLog`.

The only way to correct a posted record is a **new** document with `reversalOfId` pointing at
the original and a negative/offsetting amount. This is why `fundLedgerSummary()` and
`investorLedgerRows()` needed **zero code changes** — both already `.reduce()`-sum the amount
fields, so a reversal's negative amount nets out automatically. Verified explicitly (not
assumed) in every test tier below.

## 2. What changed

### `firestore.rules`
`commitments`/`capitalCalls`/`distributions`/`transactions` rewritten per the semantics above
(replacing the previous unconditional `allow create, update, delete: if isFundManagerOrAbove()`
on all four). `investors`/`funds` are untouched — they remain master data with full CRUD for
fund_manager+, as before.

### `src/core.js` (narrow, commented touches — same file the existing investors/funds/
commitments/capitalCalls/distributions UI already lives in, with no independent extension
point available, per the project's standing constraint)
- `blankCommitment`/`blankCapitalCall`/`blankDistribution` gained `reversalOfId:null`
  (`blankCommitment` also gained `notes:''`, matching the other two).
- New `isPostedIfRecord(kind, rec)` — single source of truth for "is this locked?", mirroring
  the rules exactly, used by both rendering and the action handlers.
- `renderFundDetail()`: commitment rows never show a delete button (always locked); capital-
  call and distribution rows show delete only while still in draft status, and a **Reverse**
  (↩️) button once posted. A small ↩️ tag marks any row that is itself a reversal.
- New `if-reverse` action handler: opens the existing create-form pre-filled with a negative
  offsetting amount and a `reversalOfId`, so the person posting the correction can see and edit
  the reason before saving — not a silent one-click undo.
- `if-save` gained a central guard: any attempt to persist an *edit* (non-new save) against a
  record that was already posted before that save is rejected client-side, regardless of which
  code path tried it.
- `if-delete` and `if-edit` gained matching defensive guards (belt-and-suspenders; the real,
  unbypassable enforcement is `firestore.rules` — these only give a clear message instead of a
  surprise permission error, and stop DEMO_MODE/local mode — which has no real Firestore to
  enforce anything — from being silently permissive).
- Investor Ledger Excel export: `commitments`/`capitalCalls`/`distributions` sheets each gained
  one new column, **"عكس لسجل (Reversal Of)"**, appended at the end of each sheet — appended
  strictly at the end (never in between) so the existing `SUMIFS` formulas in the "دفتر
  المستثمرين" sheet, which reference columns by letter, are provably unaffected (verified with
  LibreOffice recalculation below, not assumed).

## 3. Testing — all against real, running systems

### Real Firestore emulator (not mocked) — 65/65 passed
Ten new assertions added to `tests/rules/rules.test.mjs` (section ١٠), run against the same
local Firestore Emulator as every prior stage:
- Commitment: update and delete both rejected for `FUND_MANAGER`, even though the same role can
  freely create; a reversal (new doc, negative amount, `reversalOfId`) succeeds.
- Capital call: free update while `pending`; the `pending → paid` transition succeeds; **any**
  further update or delete after that fails; a reversal creation succeeds.
- Distribution: same pattern, `declared → paid`.
- Transactions: update and delete both rejected unconditionally; create remains open.

Full existing suite (all six earlier sections — opportunity edit gates, IC-only-change,
capital-allocation-only-change, ledger role gating, audit log, comparables, underwriting
versions, IC decisions) re-run alongside: unchanged, still green.

### Financial / functional suite (jsdom, real core.js import, real click simulation)
`test_investor_contribution.mjs` rewritten to match the new behavior rather than left
asserting the old one — sections that used to test "edit a commitment" and "delete cascades to
its linked capital call" now assert the opposite (edit/delete rejected, count unchanged), and
new sections were added proving: the reversal flow actually works end-to-end for an in-kind
commitment (creates a new negative commitment **and** its own new negative linked capital call,
via the same in-kind auto-link logic already in `if-save` — no special-casing needed), and that
`investorLedgerRows()` nets the pair to exactly zero. **31/31 passed.** All other financial
suites re-run: `test_exports_reflect_phase8.mjs`, `test_pptx_print_reflect_phase8.mjs`,
`test_integration_phase4/5/6/7.mjs` — unchanged, still green.

One pre-existing, unrelated gap noted honestly rather than worked around: `test_functions.mjs`
fails in this environment because `functions/node_modules` was never installed this session
(`firebase-functions` missing) — this is the separate Cloud Function that mirrors
`oppAuditLog`, untouched by this stage's work, and the failure predates it.

### Real browser regression (Playwright, real clicks)
- **Stage 4 regression: 21/21**, **Stage 5 regression: 20/20** — re-run unchanged after every
  edit in this stage, confirming zero breakage to the IC → Conditions → Allocation → Fund
  Ledger → Reporting cycle already proven live.
- **New Stage 6 script: 28/28** — walks the actual rendered DOM: a fresh commitment shows no
  delete button and a Reverse button instead; clicking Reverse opens a form with a banner
  naming the original record and a pre-filled negative amount; saving creates a new record,
  leaves the original untouched, and nets `investorLedgerRows()`/`fundLedgerSummary()` back to
  zero. Same walk repeated for a capital call (free edit while pending → locked once marked
  paid → reversed) and a distribution (declared → paid → reversed). A direct `if-delete`
  dispatch on an already-posted record (simulating a stray call bypassing the UI entirely) is
  still rejected by the client-side guard. Zero uncaught JS errors across the whole walk.

### Excel export re-verified end-to-end, not just unit-tested
Downloaded a real export via a real click after seeding a commitment + its reversal, then
opened it with `openpyxl` and recalculated it with LibreOffice: the new "Reversal Of" column
shows the correct reference id, `recalc.py` reports **0 formula errors** across all 14
formulas, and the Investor Ledger sheet's `SUMIFS`-computed "Committed" total for that investor
correctly nets the ±777,000 pair back to the pre-existing total — proof, not assumption, that
appending the column at the end left every existing formula intact.

## 4. Bottom line
`commitments`/`capitalCalls`/`distributions`/`transactions` are now a real accounting
subledger: once posted, a record cannot be edited or deleted by anyone — not the owner, not the
fund manager, not the admin — enforced in `firestore.rules`, the same non-bypassable layer that
already protects `icDecisions`/`underwritingVersions`/`oppAuditLog`. Every correction is a new,
signed, documented reversal entry, and the existing ledger math (`fundLedgerSummary`,
`investorLedgerRows`, the Excel export) required no changes to net those reversals correctly —
confirmed by test at every tier, from the raw Firestore rules up through a real downloaded
spreadsheet.

## 5. Before this goes anywhere near the live project
Repeating the recommendation already given when this scope was chosen: do **not** deploy this
`firestore.rules` to the live Firebase project (`real-estate-ledger-f85a6`) without review, and
ideally test it first against a separate/staging Firebase project. This stage changes
`allow update, delete` from "any fund manager, any time" to "never, once posted" on four
collections — if any existing production commitment/capitalCall/distribution/transaction
record was relying on being editable after the fact, that workflow stops working the moment
these rules go live; the correct replacement workflow (reversal entries) is built and tested
here, but the people using the live system should know about the change before it lands, not
discover it the first time a save fails.
