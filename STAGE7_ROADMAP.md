# Opal — Stage 7 Roadmap: Investment Intelligence & Portfolio Control
Date: 2026-09-13 — planning only, no code in this document

Per your decision — **"قسّمها أولاً إلى مراحل فرعية مرتبة بالأولوية" (split it first into
prioritized sub-stages)** — this breaks the Stage 7 list you gave into ordered sub-stages, each
scoped to be buildable and independently verifiable, in the same posted/locked/reversal-tested
discipline as Stages 4–6. Nothing here is built yet.

## Ordering logic
Each sub-stage is scored on two things: does the platform have a real, load-bearing gap without
it (not a cosmetic one), and does a later sub-stage depend on its data existing first. Items with
no dependency and a real gap come first; a UI-facing item that only *displays* data another
sub-stage produces is sequenced right after that data exists, not before.

## 7.1 — Actual vs. Underwriting Variance (foundation — build first)
**Why first:** every other intelligence feature in your list — thesis versioning, performance,
concentration, scenario matrix, confidence, Next Best Action — either compares actual results to
an original assumption or needs a place to record what "actual" means once an asset is live.
Right now the platform records underwriting assumptions and IC decisions, but nothing captures
what happened *after* the money moved. This is the single missing data spine, not a display
feature.
- New `assetActuals` posted/locked subledger (same accounting discipline as Stage 6): rent
  actually collected, occupancy actually achieved, opex actually spent, per period, per linked
  asset.
- Variance calculation: actual vs. the underwriting figures already stored on the opportunity —
  no new assumption model needed, only a diff engine against data that already exists.
- This is the one sub-stage that is almost pure Fund Accounting continuation, not "Portfolio
  Intelligence" yet — which is why it belongs immediately after Stage 6-b rather than later.

## 7.2 — Post-Investment Performance (depends on 7.1)
**Why second:** this is 7.1's numbers rolled up over time into the metrics a fund actually
reports (cash yield, DPI/RVPI/TVPI-style measures) — it has no independent data source, so it
cannot usefully precede 7.1.
- Per-asset and per-fund performance rollups computed from `assetActuals` + the existing Fund
  Ledger (`capitalCalls`/`distributions`).
- This is also where "Investment Passport" (a single-asset summary view) becomes buildable —
  it is presentation over 7.1+7.2 data, not a new data model, so it is folded in here rather than
  listed as its own separately-numbered stage.

## 7.3 — Portfolio Concentration & Capital Allocation Across Opportunities (depends on 7.1)
**Why third:** concentration analysis (by geography, sector, investor, single-asset exposure)
needs real allocation data, which Stage 5's Capital Allocation Linking Engine already produces —
so this can start as soon as 7.1 exists, in parallel with 7.2 if you want to split effort, but is
sequenced after 7.2 here because it is a smaller, more self-contained slice.
- Concentration dashboards/thresholds across the existing `capitalAllocation` + fund-linkage data.
- Alerts when a single opportunity, geography, or investor crosses a configurable concentration
  limit — a governance control, not just a chart.

## 7.4 — IC Voting, Conflicts & Decision Confidence (independent of 7.1–7.3, but needs Stage 6-b)
**Why fourth:** this extends IC governance (already strong per Stage 4/5) rather than portfolio
math, so it does not depend on the variance/performance work above — but it does depend on this
session's approval-gate pattern (Stage 6-b) as the template for "who decided what, and when, with
what's now locked."
- Multi-member IC voting (today's `icDecisions` records a single decision, not a quorum/vote);
  conflict-of-interest declaration per voting member.
- Decision confidence — a structured field IC members fill in alongside their vote, not an
  AI-inferred score, unless you want to scope that as a separate, explicitly-labeled sub-stage
  later.

## 7.5 — Closing Conditions → Blocking Actions (depends on 7.4's structured decision data being real)
**Why fifth:** the platform already has IC conditions (Stage 4/5) that block fund-linkage; this
generalizes the same "condition not met → action blocked" pattern to closing-specific conditions
(financing contingency, title, inspection) with the same enforcement style already proven in
Stage 5's capital-allocation gate.

## 7.6 — Investment Thesis Versioning (depends on nothing above — can be pulled earlier if you prefer)
**Why sixth, not first:** this is valuable but self-contained — it does not block or get blocked
by any other 7.x item. It is placed after the data-spine work (7.1–7.5) because those closed a
real functional gap (no actuals data at all), while thesis versioning improves traceability of an
existing, already-functional field (the underwriting thesis). Worth doing, but not urgent by
comparison.
- Append-only version history on the opportunity's investment thesis/underwriting narrative,
  mirroring the existing `underwritingVersions` append-only pattern already in the rules.

## 7.7 — Scenario/Stress Matrix & P10/P50/P90 (depends on 7.1 + 7.6 for realistic inputs)
**Why seventh:** a stress matrix is only as trustworthy as the actuals-vs-underwriting baseline
(7.1) and thesis history (7.6) it stresses against. Building this first, on assumption data alone
with no actuals feedback loop yet, risks a scenario tool nobody trusts.
- Deterministic scenario toggles first (vacancy shock, rate shock, exit cap shock — you already
  described these), each driven by variables, never hardcoded — Monte Carlo/P10-P50-P90 as a
  later refinement once the deterministic version is validated and used.

## 7.8 — Data Room → DD → Evidence → IC Gate → Decision (last — largest scope, benefits from everything above)
**Why last:** this is the most structurally invasive item — it threads a new evidence/document
model through the entire opportunity lifecycle and touches the IC gate that 7.4 will have just
finished restructuring. Sequencing it last means it is built once, against the final IC/decision
shape, instead of twice.
- Document/evidence attachment model per opportunity, linked to specific underwriting claims;
  DD checklist gating the IC gate itself (not just closing conditions).

## 7.9 — Next Best Action (last, deliberately)
**Why last of all:** every other 7.x item feeds this one — "next best action" is only as good as
the variance, concentration, confidence, and condition data it reasons over. Building it before
that data exists would mean recommendations with nothing real behind them. This is explicitly the
capstone, not a quick win.

## What this roadmap does NOT do
It does not start writing any Stage 7 code. Per your decision, this is the ordered breakdown for
you to review, reprioritize, or approve a starting sub-stage from — Stage 6-b (the approval gate)
is finished and tested; Stage 7 work begins only once you pick where to start.
