# Opal — Stage 6-b: Explicit, Separate Approval Gate (pending/declared → approved → paid/waived)
Date: 2026-09-13

## Scope
Stage 6 rebuilt the Fund Ledger into a posted/locked/reversal subledger, but its lifecycle was
still only two states before locking: `pending`/`declared` (draft, free edit) → `paid`/`waived`
(posted, locked). The user's own Stage 6 plan called for a distinct sequence — **`Draft →
Approval → Posted → Locked → Reversal/Adjustment → Audit Trail`** — with "mark paid" alone no
longer allowed to double as the approval step. Asked directly whether to add a separate approval
gate, the user's answer was explicit: **"نعم، أضف بوابة اعتماد منفصلة" (yes, add a separate
approval gate)**. This report documents that gate.

## 1. The new lifecycle
`capitalCalls`: `pending` → **`approved`** → `paid` / `waived`
`distributions`: `declared` → **`approved`** → `paid`

- **`pending`/`declared`** — draft. Freely editable/deletable, exactly as in Stage 6.
- **`approved`** — a new, mandatory intermediate state. Reachable only from the initial draft
  status. Once set, every field is frozen **except** `status`, `approvedBy`, `approvedAt` — the
  amount, dates, and everything else are locked in at the moment of approval, before posting.
  Delete is blocked here too (an approved record is no longer a draft, even though it is not yet
  posted).
- **`paid`/`waived`** — posted, locked exactly as in Stage 6. Reachable **only** from `approved`,
  and only via a clean transition that touches `status` alone — no bundling an amount change (or
  anything else) into the same request that also marks it paid.

No path skips `approved`. This is enforced at the *transition* level (`before.status →
after.status`), not just by checking the current status, so a single request cannot smuggle
`pending → paid` past the rules by presenting it as an "update."

Two narrow, pre-existing exceptions are preserved unchanged from Stage 6, because they represent
facts already executed elsewhere, not new discretionary transactions awaiting approval:
- a **reversal** entry (`reversalOfId` set) may be created directly in an already-posted state;
- an **in-kind auto-transfer capital call** (`linkedCommitmentId` set, generated automatically
  when an in-kind commitment is saved) may likewise be created directly `paid`.

## 2. What changed

### `firestore.rules`
- New `ledgerStatusTransitionOk(before, after)` function — the single source of truth for every
  legal `capitalCalls`/`distributions` status transition, used by both collections' `allow
  update` rules.
- `allow create` for both collections now requires the new document's `status` to be the initial
  draft value (`'pending'` / `'declared'`), unless it is one of the two exceptions above.
- **Bug found and fixed during this stage**: the first version of the `create` rule used direct
  field access (`request.resource.data.status`), which throws `Property status is undefined on
  object` — a hard evaluation error, not a graceful `false` — for any write that omits the field
  entirely (caught by the pre-existing generic collection-write test, which posts a bare
  `{name:'test'}` document). Fixed by switching to `request.resource.data.get('status', null)`
  throughout, which returns `null` instead of throwing when the field is absent.

### `src/core.js`
- `CAPITAL_CALL_STATUS` / `DISTRIBUTION_STATUS` gained the `approved` option.
- `blankCapitalCall`/`blankDistribution` gained `approvedBy:null, approvedAt:null`.
- New `isApprovedIfRecord()` / `isLockedIfRecord()` (posted OR approved) alongside the existing
  `isPostedIfRecord()`; the generic edit/delete guards now check `isLockedIfRecord()` so an
  approved-but-not-yet-posted record is protected too.
- New `if-approve` action: moves a record from its initial draft status to `approved`, stamping
  `approvedBy`/`approvedAt` for the audit trail. Rejects anything not currently in its initial
  draft status.
- `if-mark-paid` now requires `status === 'approved'` first; rejects otherwise with a clear
  message instead of a silent/confusing permission failure.
- New `if-waive` action (capital calls only) — same `approved`-only precondition as mark-paid.
- The manual status `<select>` in the capital-call/distribution forms is now shown only for
  reversal drafts; for a normal new draft it is replaced by an explanatory note describing the
  mandatory Approve → Mark Paid/Waive sequence, so the UI cannot be used to hand-pick a status
  that skips the gate.
- Row action buttons rewritten for the three states: draft shows Approve + Delete; approved shows
  Mark Paid (+ Waive for capital calls) and no Delete; posted shows Reverse only.
- Excel export status-column headers updated to name all four states.

## 3. Testing — all four tiers re-run after the gate, all passing

### Real Firestore emulator (not mocked) — 83/83 assertions passed
New section "١١) بوابة الاعتماد الصريحة والمنفصلة" added to `tests/rules/rules.test.mjs`,
covering: the direct `pending→paid` and `pending→waived` skips (both rejected), the
`pending→approved` step (accepted, with `approvedBy`/`approvedAt` recorded), an
`approved→paid` transition bundled with an unrelated field change (rejected — approval truly
freezes the record), a clean `approved→paid` (accepted), the same pattern for
`distributions` (`declared→approved→paid`), and the two create-time carve-outs
(reversal, in-kind auto-transfer) still working. The **pre-existing** Stage 4–6 sections were
re-run in full alongside it — including updating the two direct `pending→paid`/`declared→paid`
assertions in the Stage 6 section, which the new gate correctly turns from "allowed" into
"rejected," with the approval step inserted before them — and all passed, 0 failures.

### Financial jsdom test (`test_investor_contribution.mjs`) — 31/31 passed, unchanged
This suite exercises the in-kind commitment/reversal flow but never calls `if-mark-paid`, so it
was unaffected by the gate; re-run to confirm, no edits needed.

### Playwright browser regression (real Chromium, real clicks)
- **`stage4_e2e.mjs` — 21/21 passed.** Updated to click the new Approve action before Mark Paid.
- **`stage5_e2e.mjs` — 20/20 passed.** Same one-line insertion (approve before mark-paid) in the
  capital-allocation/fund-capacity flow; the capacity math itself needed no changes.
- **`stage6_e2e.mjs` — 39/39 passed.** Substantially expanded: asserts a pending call shows
  Approve but not Mark Paid; a raw `if-mark-paid` dispatch while still pending is rejected
  client-side; after approval the Delete button disappears and both Mark Paid and Waive appear;
  `approvedBy` is recorded and visible; the rest of the reversal flow (unchanged from Stage 6)
  still passes. Distributions get the analogous checks. Zero uncaught JS errors across the walk.

**Total: 4/4 test tiers green, 0 failures, after fixing the one real bug this stage surfaced**
(the unsafe `request.resource.data.status` dot-access).

## 4. Deployment status
The updated `firestore.rules` (with the approval gate) has been **dry-run validated** against
the live project `real-estate-ledger-f85a6` (compiles cleanly) and the **pre-deploy live ruleset
was backed up** (`firebase_backup/LIVE_firestore_pre_stage6b.rules`) as a rollback reference,
following the same due-diligence sequence used for the Stage 6 deploy earlier this session.

**The actual deploy has not gone through yet** — this session's own safety layer (separate from
Firebase's permissions) flagged the live `firebase deploy` command for explicit confirmation
before it will run. Everything short of that one command is done and verified; I'm holding the
deploy itself for your go-ahead before it touches the live project again.
