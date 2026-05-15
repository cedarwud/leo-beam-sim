# MODQN Demo Readability Redesign — Mini SDD

Status: draft (awaiting user sign-off)
Owner: leo-beam-sim UI
Scope: visual + information-architecture refresh of the MODQN-related panels so a thesis-defence viewer can immediately see (1) baseline MODQN has been reproduced in code and (2) it is integrated into the adjustable live HOBS handover environment.
Non-scope: producer truth, replay artifact values, reward semantics, evidence labels, provenance, or any `visual-showcase-v1` contract field. CLAUDE.md §3–§5 invariants hold.

## 1. Motivation

The current MODQN-facing UI (`ModqnReplayPlaybackShell.tsx`, `ModqnBaselineIntegrationPanel.tsx`, `DiagnosticsDrawer.tsx`) renders producer-debug language (`fail-closed`, `phase7h_open_for_validation`, `claim boundaries`) and 9-row 12 px mono lists. A viewer cannot tell which row proves "baseline MODQN replicated" or how the handover-policy sliders cause handover behavior to change.

The redesign is presentation-only. All data anchors already exist in the runtime (`simState.serving.*`, `hoCount`, `intraHoCount`, `lastHoReason`, `recentHo*`) and in the replay model (`currentSlot.focusRow.scalarReward`, `rewardVector`, `selectedServing`, `handoverEventKind`, `eventCounts`, `rowCount`, `slotCount`, `MODQN_PAPER_ID`).

## 2. Design system (from `ui-ux-pro-max`)

| Token | Value | Source |
|---|---|---|
| Pattern | Real-Time / Operations Landing — Hero + Key metrics + How-it-works + CTA | design-system run |
| Style | Dark Mode (OLED) — high contrast, status colors green/amber/red | design-system run |
| Heading + body font | **JetBrains Mono** (single-family, weights 400/500) | typography query "monospace technical dashboard" |
| Mono for code/IDs | inherits JetBrains Mono | same |
| Type scale | 12 / 14 / 18 / 24 (modular, no in-betweens) | ux query Result 3 |
| Hero KPI chart | Bullet chart (performance vs target, multi-KPI grid) | chart query Result 1 |
| Live monitoring chart | Streaming area / sparkline, pause control required, prefers-reduced-motion respected | chart query Result 2 |
| Anti-patterns | Light-mode default, slow rendering, emojis as icons, random sizes, AAA contrast violation | design-system + ux query Result 3 |
| Required a11y | text always visible (no hover-only values), `aria-live` on streaming KPI, sequential heading levels | ux Result 2 |

Existing tokens in `src/constants/uiTokens` (UI_TOKENS.type.size.*, color.semantic.*) stay the authority. The bump-up changes only the **mapping** of `tiny`/`caption`/`body`/`bodyLg` to the 12/14/18/24 scale and confirms `family.mono === 'JetBrains Mono'` (add Google Font import if absent).

## 3. Information architecture

```
┌─────────────────── MODQNProofStrip (NEW, top of canvas) ─────────────────────┐
│ ┌────────── Card A ─────────┐  ┌────────── Card B ─────────┐  ┌── Card C ──┐ │
│ │ Baseline MODQN replicated │  │ Integrated → live sim     │  │ Param  → ΔHO│ │
│ │ ───────────────────────── │  │ ─────────────────────────  │  │ ─────────── │ │
│ │ Paper PAP-2024-...        │  │ Replay serving:  S03/B4    │  │ Offset 2.5dB│ │
│ │ 7 beams/sat • N slots     │  │ Live    serving: S07/B2    │  │ TTT  3.0s   │ │
│ │ Reward: r̄ = 0.62 ✓        │  │ Both feed same scene ✓     │  │ Inter HO 12 │ │
│ │ ▮▮▮▮▮▮▮▮▮▯  bullet         │  │                            │  │ Intra HO 38 │ │
│ └───────────────────────────┘  └────────────────────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
              3D scene (unchanged)
┌── left sidebar ──┐                          ┌── right sidebar ──┐
│ Live handover    │                          │ MODQN replay tab  │
│  - HandoverPolicy │                         │  ReplayPlaybackShell (FOLDED) │
│    Controls      │                          │  ProofEvidenceDetails (FOLDED)│
│ Signal formula   │                          │ Live status tab   │
│                  │                          │  InfoPanel        │
│                  │                          │  DiagnosticsDrawer (FOLDED)   │
└──────────────────┘                          └───────────────────┘
```

`MODQNProofStrip` sits in `App.tsx` between `ControlBar` and `leo-shell-row`, full-canvas width, ~96 px tall, three cards in a 1:1:1 grid (collapses to stack < 900 px).

## 4. Component specs

### 4.1 `MODQNProofStrip` (new)
Props derived from already-rendered state:
- `replayDisplayState: ModqnReplayPlaybackDisplayState | null`
- `simState: SimState`
- `appliedHandoverPolicy: HandoverPolicyTuningState`

#### Card A — "Baseline MODQN replicated"
- Eyebrow: `Paper PAP-2024-MORL-MULTIBEAM` (12 px, color muted)
- Headline: `Baseline reproduced ✓` (18 px, semantic.good)
- Metric row: `7 beams/sat · {rowCount} rows · {slotCount} slots` (14 px mono)
- Reward bullet bar: horizontal bullet chart for current `scalarReward` against the replay-wide max (cached on mount), label `r̄ = N.NN` on the right
- Footer details (folded): old `evidenceStatus`, `diagnosticsStatus`, `sourceOwner`, `sourcePath`, claim-boundary text — moved into `<details><summary>Provenance & evidence</summary>…</details>`

#### Card B — "Integrated into live sim"
- Eyebrow: `Replay ⇄ Live HOBS` (12 px)
- Two `BeamIdentity` rows side-by-side:
  - `Replay serving: {selectedServing.satId}/B{localBeamIndex+1}`
  - `Live   serving: {serving.satId}/B{serving.beamId}` (em-dash if null)
- Status badge: `Same scene · adjustable` (semantic.good) when both are non-null, otherwise `Pending live attach` (amber)
- Footer details (folded): old "Replay/live boundary" disclosure

#### Card C — "Parameter → handover behavior"
- Eyebrow: `Live policy (effective)` (12 px)
- Two-column 14 px chips: `Offset {offsetDb} dB · TTT {triggerTimeSec} s`
- Two bullet bars stacked:
  - `Inter-sat handover` count (live `hoCount - intraHoCount`) vs replay `eventCounts['inter-satellite-handover']`
  - `Intra-sat beam switch` count (live `intraHoCount`) vs replay `eventCounts['intra-satellite-beam-switch']`
- Sparkline (canvas, prefers-reduced-motion off): `serving.sinrDb` over last 60 s — used as **SINR throughput proxy** rendered as `log2(1 + 10^(sinr/10))` bits/s/Hz on the y-axis
- Last reason line, single ellipsised row: `Last decision: {formatHandoverReason(lastHoReason)}`

Accessibility:
- All numeric values rendered as text alongside any bar/chart (no hover-only values).
- `aria-live="polite"` on Card C sparkline label.
- `prefers-reduced-motion`: sparkline freezes to a static last value when reduced motion is on.
- Sequential headings: each card uses `<h2>` eyebrow + `<p>` headline.

### 4.2 `ModqnReplayPlaybackShell` (refold)
Keep play/pause toggle, reset, loop checkbox, slot scrubber as the visible row. Wrap `Source slot details` and `Producer truth details` in `<details>` that are **closed by default** (current code already has the markup; remove the `data-phase7h-open-for-validation="true"` open behavior in DOM but keep the `data-*` attribute for tests). Replace numbered/codey summaries with human-language strings:
- `Source slot details` → `What this slot contains`
- `Producer truth details` → `Reward, serving beam, event`

### 4.3 `DiagnosticsDrawer` (refold)
Top of expanded state shows three chips only:
- `HO {hoCount}` · `Intra {intraHoCount}` · `Last: {short reason}`
Everything else (BEAM HOPPING, Handover policy readout, DPC, DEBUG/VALIDATION, VISUAL FREQUENCY SOURCE) moves inside `<details><summary>Engineering details</summary>…</details>`, default collapsed. Collapsed-state tab unchanged.

### 4.4 `ModqnBaselineIntegrationPanel` (deprecate hero rows)
`ModqnBaselineReplayEvidence` and `ModqnBaselineHandoverControls` keep their exports (for tests and the sidebar-only fallback path), but the surface-area duplication of metrics is removed because `MODQNProofStrip` now carries the proof. The two functions become **thin wrappers** that:
- Reuse the same `ProofMetric` building blocks but render only `Open handover controls` / `Reset` buttons + a one-line status line ("Baseline MODQN integrated. See proof strip above.").

## 5. Language rewrite

| Current string (developer-facing) | New summary text (folded `<details>`) |
|---|---|
| `Replay/live boundary` | `How replay relates to the live sim` |
| `Source slot details` | `What this slot contains` |
| `Producer truth details` | `Reward, serving beam, event` |
| `Claim boundaries` | `What this evidence does and does not cover` |
| `fail-closed code missing-slots` (still surfaced) | Card A switches to amber `Evidence unavailable` badge; technical code stays in folded details and on `data-fail-closed-code` for tests |
| `phase7h_open_for_validation` | retained as `data-*` attribute only; not in DOM text |

No producer truth, reward, action, evidence-label, or provenance string is altered. All currently-asserted strings remain present in the DOM, only their visibility default changes (closed `<details>`).

## 6. testid preservation list

The following testids and `data-*` attributes MUST remain reachable by selectors (verified by grepping `tests/` and Playwright suites):

- `modqn-replay-playback-shell`, `phase7f-mode-label`, `phase7f-evidence-status`, `modqn-replay-fail-closed`, `modqn-replay-play-toggle`, `modqn-replay-reset`, `modqn-replay-loop-toggle`, `modqn-replay-scrub`, `modqn-replay-current-slot`, `modqn-replay-current-row-range`, `modqn-replay-current-focus-row`, `modqn-replay-current-event-mix`, `modqn-replay-artifact-event-total`, `modqn-replay-selected-serving`, `modqn-replay-previous-serving`, `modqn-replay-handover-event`, `modqn-replay-scalar-reward`, `modqn-replay-reward-vector`, `modqn-replay-diagnostics-status`
- `modqn-baseline-integration-panel`, `modqn-baseline-integration-status`, `modqn-baseline-artifact-shape`, `modqn-baseline-current-source`, `modqn-baseline-event-totals`, `modqn-baseline-replay-blocked`, `modqn-baseline-handover-controls`, `modqn-live-handover-offset`, `modqn-live-handover-trigger`, `modqn-live-handover-threshold`, `modqn-open-handover-policy-controls`, `modqn-reset-handover-policy`
- `diagnostics-drawer`, `diagnostics-drawer-tab`, `diagnostics-drawer-beam-hopping`, `handover-policy-readout`, `dpc-status-block`, `diagnostics-drawer-debug-validation`, `visual-frequency-diagnostics`
- `handover-policy-controls`, `handover-policy-readonly`

New testids introduced by the proof strip (additive):
- `modqn-proof-strip`, `modqn-proof-card-baseline`, `modqn-proof-card-integration`, `modqn-proof-card-causal`, `modqn-proof-reward-bullet`, `modqn-proof-sinr-sparkline`, `modqn-proof-throughput-proxy`

## 7. Files touched (estimate)

| File | Change |
|---|---|
| `src/ui/MODQNProofStrip.tsx` | new component (~250 LOC) |
| `src/ui/proof-strip/RewardBullet.tsx` | new (~60 LOC) |
| `src/ui/proof-strip/SinrSparkline.tsx` | new (~90 LOC, canvas) |
| `src/App.tsx` | mount `MODQNProofStrip` between `ControlBar` and `leo-shell-row`; thread `simState`, `replayDisplayState`, `appliedHandoverPolicy` |
| `src/ui/ModqnReplayPlaybackShell.tsx` | fold default-open `<details>`, rename summaries |
| `src/ui/ModqnBaselineIntegrationPanel.tsx` | shrink to wrappers; keep testids |
| `src/ui/DiagnosticsDrawer.tsx` | fold low-signal sections, surface 3 chips |
| `src/constants/uiTokens.ts` | type scale + add JetBrains Mono Google Fonts link in `index.html` |
| `index.html` | `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" />` |
| `tests/playwright/*` (verify only) | run smoke suite; no test edits expected |

Total: 1 new directory, ~5 edits, 0 deletions.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Hidden DOM text breaks tests that read fail-closed strings unconditionally | Keep strings in DOM inside `<details>` (still queryable by Playwright `getByText` after expanding, and by `data-fail-closed-code` attribute always). Audit tests before merge. |
| Card layout collides with existing absolute-positioned `DiagnosticsDrawer` collapsed tab | Constrain proof strip to `position: relative` flow in `leo-app-shell`; drawer remains in canvas. |
| Sparkline rAF cost on SwiftShader headless | Use canvas, throttle to 4 Hz (matches headless), respect prefers-reduced-motion → freeze. |
| Adding Google Font breaks offline demo | Embed JetBrains Mono via local `@font-face` if `npm run build` artefact is for offline distribution. Confirm with user. |

## 9. Locked decisions (user sign-off 2026-05-14)

1. Proof strip placement: **above the 3D canvas, 96 px three-card horizontal strip** between `ControlBar` and `leo-shell-row`. Canvas height drops ~10%; sky-dome H700/V400 auto-fits; satellites remain visible.
2. Reward representation: **scalar `r̄` single bullet bar** in Card A. `rewardVector` components stay accessible inside the folded provenance details.
3. SINR throughput proxy: **Shannon `log2(1 + 10^(SINR/10))` bits/s/Hz** plotted on Card C sparkline.
4. Typography source: **JetBrains Mono via Google Fonts CDN** (single `<link>` in `index.html`). Offline-distribution concern parked; revisit only if `npm run build` ships without network.

## 10. Validation checklist (before merge)

- [ ] `npm run typecheck`
- [ ] `npm run test` (vitest)
- [ ] `npm run test:e2e` (playwright)
- [ ] `npm run dev` smoke; capture before/after screenshots at 1440×900
- [ ] All testids in §6 still resolvable
- [ ] AAA dark-mode contrast on the three cards (axe-core run)
- [ ] `prefers-reduced-motion` → sparkline static
- [ ] No producer truth field rewritten in any new code path (grep audit)
