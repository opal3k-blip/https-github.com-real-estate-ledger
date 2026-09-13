# Opal — Stage 7-a: Investment Thesis Versioning + Recurring Actual Performance Tracking
Date: 2026-09-13

## Scope

After Stage 6-b shipped, the user said **"نفّذ المرحلة السابعة مباشرة" (implement Stage 7
directly)**. Before writing new code against my own Stage 7 roadmap, I mapped the codebase first
and found a substantial, already-wired extension-module system under `src/features/` (~35
modules) that already implements a large share of what the roadmap called "Stage 7" — Portfolio
Intelligence (AUM/committed/paid-in/NAV rollups, real investor-level Net IRR via a from-scratch
XIRR, LTV/DSCR, concentration risk by fund/city/type), multi-stage underwriting version snapshots,
data-quality scoring, alerts/tasks, and more — all genuinely complete, not stubs.

I presented this finding to the user directly (rather than silently re-scoping their instruction)
and asked where to start given that most of the roadmap was already covered. The user chose the
recommended option: **"تتبّع الأداء الفعلي المتكرر + نسخ الأطروحة" (recurring actual-performance
tracking + thesis versioning)** — the one real, still-open gap in the existing underwriting-versions
system. This report documents that work.

## 1. The gap that was actually there

The pre-existing `underwriting-versions.js` module already froze immutable **numeric** snapshots
(`price`, `equityIRR`, `projectIRR`, `MOIC`, `dscrMin`) at `v1_asking` → `v2_post_dd` →
`v3_term_sheet` → `v4_ic_approved` (auto-captured on IC approval) or `manual`. Alongside it sat one
lonely mutable field, `d.actuals` — a single object overwritten in full on every save, with no
history and no immutability, which contradicted the project's own append-only discipline (the same
discipline Stage 6/6-b enforces for the ledger). Two real gaps followed from that:

- **No qualitative thesis history.** The numeric snapshots said *what the numbers were*, but
  nothing recorded *why the deal was worth it* at each stage, or whether that reasoning had since
  drifted from the current text.
- **No real actuals history.** Post-close performance could only ever hold the *latest* entry —
  there was no way to see a trend across quarters, and every "update" silently destroyed the prior
  reading.

## 2. Design

Both additions extend the **same** module and the **same** underlying philosophy the file already
uses, rather than building a parallel system:

- **Thesis versioning reuses the existing `underwritingVersions` records.** Every version snapshot
  (manual or auto-captured) now also carries a frozen `thesisSnapshot` — the free-text investment
  thesis exactly as it read at that moment. No new collection or rules were needed for this half;
  it rides on the exact same append-only records Stage 6/6-b-style discipline already protects.
  The detail view shows each snapshot's thesis alongside a live comparison against the *current*
  thesis text, flagging drift ("**تغيّرت الأطروحة منذ هذه اللقطة** / thesis has changed since this
  snapshot") the moment the analyst edits it.

- **Recurring actuals get a new sibling collection, `assetActuals`**, mirroring
  `underwritingVersions`' Firestore-rules pattern exactly: any authorized member may **create** a
  new dated entry (`period`, `asOfDate`, `actualEquityIRR`, `actualMOIC`, `actualDSCR`, `notes`);
  **update and delete are unconditionally `false` — even for admin.** The correction for a bad
  entry is a *new* entry with a different period/date, never an edit of the old one — the same
  rule the project already applies to `underwritingVersions` and `icDecisions`.

- **Variance is measured against a frozen baseline, not a live recompute.** Each actual entry
  shows Δ vs. the latest `v4_ic_approved` snapshot (or the earliest available snapshot if the deal
  was never formally approved) — never against whatever the model currently computes live. This
  was a deliberate choice: comparing against a moving live baseline would defeat the entire point
  of the file ("did the deal underperform, or did our own assumptions just change?"), since both
  sides of the comparison would drift together.

- **Zero data loss, zero new entry points for the old field.** The legacy `d.actuals` handler and
  schema field are left completely intact in code — nothing was deleted. If a record still has
  `d.actuals.enabled === true`, it renders as a synthetic, clearly-labeled, read-only first row
  ("**لقطة قديمة (نظام سابق)** / Legacy snapshot (previous system)") at the top of the new
  `assetActuals` timeline, with no way to add another one through it. Old data keeps rendering;
  new data only ever grows the append-only collection.

## 3. What changed

### `firestore.rules`
New `assetActuals` match block, inserted immediately after `underwritingVersions`, identical in
shape:
```
match /assetActuals/{id} {
  allow read: if isAuthorized();
  allow create: if isAuthorized() && !exists(/databases/$(database)/documents/assetActuals/$(id));
  allow update, delete: if false;
}
```

### `src/features/underwriting-versions.js`
- `ACTUALS_COLLECTION = 'assetActuals'` registered via `core.registerDataCollection(...)` — this
  one call is all that was needed to get the new collection fully live-synced (Firestore listener,
  `STORE`, localStorage fallback) through the existing extension-point machinery; no new plumbing.
- `resolveBaseline(versions)` — picks the latest `v4_ic_approved` snapshot, falling back to the
  earliest snapshot of any stage if the deal has none.
- The opportunity schema now carries a `thesis: ''` field (via
  `registerOpportunitySchemaExtender`).
- The `registerBeforeOpportunitySave` hook (which already auto-captures a `v4_ic_approved`
  snapshot on IC approval) now also stamps `thesisSnapshot` onto every version record, manual or
  automatic.
- Detail view gained: an editable thesis textarea + save button; a thesis-history mini-timeline
  with changed/matches badges; an actuals timeline table with Δ-vs-baseline columns for
  Equity IRR/MOIC/DSCR; an add-entry form. Two new action handlers, `thesis-save` and
  `actual-add`.
- The old `uw-save-actuals` handler and `d.actuals` field are untouched, just no longer the primary
  UI path (see legacy-row behavior above).

### `tests/rules/rules.test.mjs`
New section **"٧-ب) الأداء الفعلي المتكرر (assetActuals)"**: create succeeds for a normal analyst
(append-only, not a gated reference library); re-using an existing id to overwrite via `create`
fails; `update` fails for both `senior_ic` and `admin`; `delete` fails for `admin`. Five new
assertions, all passing.

## 4. Test results (all four tiers, zero regressions)

| Tier | Result |
|---|---|
| Firestore emulator rules suite (`tests/rules`, real `@firebase/rules-unit-testing`) | **88/88 passed** (was 83/83 before this stage — the 5 new `assetActuals` assertions all pass) |
| Stage 4 Playwright regression (IC decisions, investors/funds, ledger, exports) | **21/21 passed** |
| Stage 5 Playwright regression (asset-fund linkage guards) | **20/20 passed** |
| Stage 6 Playwright regression (reversal/lock ledger) | **39/39 passed** |
| Investor-contribution Playwright regression (in-kind commitments) | **ALL PASSED** |
| **New** Stage 7-a Playwright regression (`stage7a_e2e.mjs`) | **16/16 passed** |

The new Stage 7-a walk verifies, against a real Chromium browser and the real app (not mocks):
thesis textarea renders and saves; a manual snapshot freezes the thesis text as-of that moment and
the UI reports "matches current thesis"; editing the thesis flags the earlier snapshot as changed;
a real IC approval (via the actual production write path in `ic-workflow.js`, not a shortcut)
auto-captures a `v4_ic_approved` snapshot whose `thesisSnapshot` is the *current* (post-edit) text,
not the stale one; two periodic actuals entries **add** to the series rather than overwrite (count
grows 1 → 2, proving real history, not a mutable snapshot); a Δ-vs-baseline variance figure is
rendered; **no edit/delete controls exist anywhere in the UI** for `assetActuals` entries; the
legacy `d.actuals` field still renders correctly as a read-only row with zero crashes; zero
uncaught JS errors across the entire walk.

One issue surfaced and fixed **in the test script itself**, not the product: the first draft of
the IC-approval simulation mutated the live `opportunities` record's `ic.decisions` array in place
before calling `persistOpportunity`, so the before-save hook's old-vs-new diff saw no difference
(both "old" and "new" pointed at the same mutated array) and the `v4_ic_approved` capture did not
fire. The real production code in `ic-workflow.js` never does this — it builds an immutable
`draft` via `core.withDefaults()` and appends with `.concat()` (a new array), which is exactly why
the auto-capture already worked correctly for real users. The test was rewritten to mirror that
real write path, after which all 16 checks passed.

## 5. Screenshots
Captured during the Stage 7-a Playwright walk (attached alongside this report):
- `01_thesis_and_versions.png` — thesis editor + version history with drift badges
- `02_actuals_timeline.png` — recurring actuals table with two periods and variance columns
- `03_legacy_row.png` — the old single-snapshot `d.actuals` rendering as a read-only legacy row

## 6. Still pending — the live Firebase deploy

The Stage 6-b approval-gate rules, and now this stage's `assetActuals` rule, have **not** been
deployed to the live project (`real-estate-ledger-f85a6`) yet. The first two deploy attempts for
Stage 6-b were blocked by this session's own automatic safety layer, which flags `firebase
deploy` as a "[Production Deploy]" action it will not perform without further confirmation — this
is a restriction on my side, not a Firebase error; dry-run validation and a full backup of the
live rules both completed successfully, confirming only the actual write step is blocked. This
was disclosed after Stage 6-b but hasn't yet been addressed — happy to attempt the deploy again,
or you're welcome to run `firebase deploy --only firestore:rules` yourself from the project
directory using the already-validated `firestore.rules` file.

## 7. Deferred (by your own choice, not forgotten)

The remaining genuine Stage 7 gaps identified during the codebase mapping — multi-member IC voting
with conflicts-of-interest and decision confidence, a dedicated closing-conditions blocking
checklist, probabilistic P10/P50/P90 scenario modeling, an "Investment Passport" one-pager, and a
"Next Best Action" prompt — remain unbuilt. You chose to do the recurring-actuals + thesis work
first; say the word for any of these next.
