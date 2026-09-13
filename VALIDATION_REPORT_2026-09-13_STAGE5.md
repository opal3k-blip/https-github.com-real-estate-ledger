# Opal — Stage 5: Capital Allocation Linking Engine + Naming Merge
Date: 2026-09-13

## Scope
Two explicit requests: (1) finish the naming merge interrupted before Stage 4 ("مستكشف
الفرص العقارية"), (2) build the actual linking engine closing the gap Stage 4 proved live —
IC decisions/Conditions were disconnected from `capitalAllocation`, which was itself
disconnected from the Fund Ledger.

## 1. Naming merge completed
Unified all product-naming references — previously split across legacy/inconsistent variants
and the target `مستكشف الفرص العقارية`
— to a single name everywhere: `index.html` (title, meta description, footer disclaimer),
`README.md`, `firebase-config.js`, `src/core.js` (document title, print letterhead, Excel
`wb.creator`/title cells), and the three feature files that referenced it
(`excel-workbook.js`, `ic-presentation.js`, `ic-book-print.js`). English name unified to
"Opal Real Estate Opportunity Explorer" throughout (was previously mixed with "...Ledger").
22 occurrences across 7 files; verified zero old variants remain.

## 2. Capital Allocation Linking Engine (new: `src/features/capital-allocation-engine.js`)

### What was built
- **An editable UI for `capitalAllocation`** (targetEquity / maxAllocation / priority /
  committeeNote) — did not exist anywhere before Stage 4 confirmed it live. Gated to Fund
  Manager role or above, matching the sensitivity of an actual capital-reservation decision
  (not left to the opportunity's own owner).
- **`icApprovalStatus(d)`** — reads `d.ic.decisions` (no core.js logic touched) and resolves
  the exact missing transition Stage 4 named: `approve_conditions` only counts as approved
  once every condition's `status === 'met'`.
- **A real capacity guard, not a cosmetic one** — before an opportunity can be linked as a
  fund asset, it must have (a) an IC decision that is `approve`, or `approve_conditions` with
  all conditions met, (b) a `capitalAllocation.targetEquity` set, and (c) that amount, added
  to whatever is already allocated to the fund's *other* linked assets, must not exceed the
  fund's actual paid-in capital (`fundLedgerSummary().paidIn`). This is enforced against real
  numbers pulled from the Fund Ledger at the moment of linking, not a static flag.
- **Two new, narrow, explicitly-commented extension points added to `core.js`** (no business
  logic added to core.js itself — it only calls out): `registerAssetLinkGuard(fn)` /
  `checkAssetLinkGuards()`, following the exact pattern of the project's existing
  `registerActionHandler`. The `if-toggle-asset` handler now consults this guard before
  *linking* (unlinking stays unconditional, unchanged) and, on success, logs an `assetLink`
  transaction into the existing `transactions` audit-trail collection — the same collection
  the Investor Ledger Excel export already reads, so Reporting reflects allocation events
  with no change to the export code itself.
- **`firestore.rules` hardened to match**: `capitalAllocation` was, until now, an ordinary
  opportunity field — any owner (a plain analyst) could set it via the normal edit path,
  since nothing in the rules singled it out. Added `capitalAllocationOnlyChange()`
  (mirroring the existing `icOnlyChange()` pattern exactly) and blocked the owner-edit path
  from touching `capitalAllocation` at all; only Fund Manager-or-above can change it now, on
  any opportunity, regardless of ownership — real enforcement in Firestore, not just a
  hidden button.

### What was deliberately left out of scope
Rebuilding the Fund Ledger itself into a true posted/locked/reversal accounting subledger —
flagged by Stage 2 and restated by Stage 4 as a deeper, separate gap. This engine allocates
against `commitments`/`capitalCalls` as they exist today (freely editable/deletable); it does
not change their accounting semantics. Stated here explicitly rather than left implicit.

## Testing — all against real, running systems

### Real Firestore emulator (not mocked)
Five new assertions added to `tests/rules/rules.test.mjs` for `capitalAllocationOnlyChange`,
run against a real local Firestore Emulator alongside the full existing suite:
**ALL PASSED**, including:
- Opportunity owner (plain analyst) blocked from setting `capitalAllocation` via the normal
  edit path.
- Fund Manager (not the owner) can set `capitalAllocation` — mirrors the `icOnlyChange`
  precedent for Senior IC.
- Fund Manager blocked from smuggling an unrelated field change (`land.price`) alongside a
  `capitalAllocation` change in the same write.
- Senior IC (without Fund Manager role) blocked from setting `capitalAllocation` — role-
  specific, not just "above analyst".

### Financial validation suite + syntax
16/16 unchanged, re-confirmed. `node --check` clean across every file in `src/`.

### Real browser regression (Playwright, real clicks) — 20/20 checks passed
Walked the actual gate end to end against the live rendered DOM:
1. Section renders; IC status correctly shows "no decision yet"; edit form correctly hidden
   for the unauthenticated demo visitor (same role gate as the IC "Approve" button in Stage 4).
2. **Blocked** — linking attempted before any IC decision exists.
3. **Blocked** — linking attempted with `approve_conditions` and one pending condition, exact
   condition text surfaced in the reason.
4. Condition flipped `pending → met` via a real click on the existing checkbox.
5. **Blocked** — all conditions met, but `capitalAllocation.targetEquity` not yet set.
6. **Blocked** — target set (2,000,000 SAR) but the fund has zero paid-in capital.
7. Funded the fund for real (investor → commitment → capital call → marked paid, 2,500,000
   SAR) via real UI clicks, then linking **succeeds**.
8. An `assetLink` transaction (2,000,000 SAR) is recorded automatically on success.
9. A **second**, independently-approved opportunity requesting 1,000,000 SAR against the
   *same* fund is **blocked** — the capacity math correctly nets out the first allocation and
   reports exactly 500,000 SAR remaining.
10. Unlinking remains unconditional, as designed.
11. Zero uncaught JS runtime errors across the entire walk.
12. Full Stage 4 regression suite (21/21) re-run after these changes to confirm no
    regression in the IC/Conditions/Fund-Ledger/Reporting flows already proven — still
    21/21.

## Bottom line
The five stations Stage 4 found disconnected are now a real pipeline for the specific
transition that was missing: an opportunity cannot be counted as fund capital deployed until
the committee has actually approved it (conditions and all), someone at Fund Manager level
has deliberately sized the allocation, and the fund actually has that much paid-in capital
free. Enforcement lives in `firestore.rules`, not only the UI, matching every other
governance control already in this codebase.
