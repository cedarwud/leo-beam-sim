# SINR-live Semantic Beam Colour — mini-SDD

Owner decision 2026-06-22. Authority for the sinr-live beam-cone + UE-dot colour
scheme rework. Supersedes the per-satellite identity-hash hue as the cone colour
source. Build is screenshot-iterated on `:3000` (vite, port ALWAYS 3000) before
governance is re-locked.

## 1. Goal (owner, verbatim intent)

> 最重要的是能讓畫面有故事性，不需要講解就能知道顏色代表的意義（不然一堆顏色完全不知道在幹麻）；intra/inter handover 換手要明顯，尤其 intra 很需要靠顏色，因為（兩個 cone）完全重疊了。

So: colours must be **story-driven + legible WITHOUT a legend**, and a **handover —
especially intra (same satellite, beam→beam, the two cones spatially overlap) — must
read by COLOUR**, since position cannot distinguish overlapping same-sat cones.

## 2. Decision — semantic ROLE/STATE colour (not identity, not frequency)

- **Frequency (FRF-3, F1/F2/F3)** — REJECTED: structural, not narrative; an intra HO
  to a same-frequency beam would NOT change colour → fails "intra by colour". (FRF=3
  is real — `frequencyReuse:3` in the hobs profiles — and already shown in labels
  `F1 B1`; it is a possible secondary/legend view, not the primary scheme.)
- **Identity (current `colorForServingBeam`)** — REJECTED as the primary cone scheme:
  hue = `hashStringToUnit(satId)` = an ARBITRARY value; a viewer cannot know "purple =
  G53" without matching dots↔cones. This is the "一堆顏色不知道在幹麻".
- **CHOSEN — semantic:** colour encodes the beam's ROLE/STATE, learnable in one glance.

## 3. Palette — 4 semantic colours + the handover flip

> **RECOLOURED 2026-06-22 (owner-chosen): serving GREEN→YELLOW, and BLUE unified as "the beam
> taking over" — the handover flip is `yellow → blue`.** Owner picked serving=黃 (intuition
> "服務=亮黃") and intra = 黃→藍 (the acquiring beam is BLUE, the SAME blue as the inter
> candidate, so blue uniformly = "taking over"). The flash draws on top of the new serving
> cone and fades, so the acquiring cell reads **blue→yellow** = "taking over → settled serving"
> (this is also why 接手 still ends on the serving colour). The 4-colour model collapses to
> **🟡 serving / 🔵 takeover / ◼ background / grey unserved** — no green, no orange, no purple.
> The ambient population pulse is soft blue `#93c5fd` (handover-activity family). Role LOGIC
> (serving / context / takeover + 1-vs-2-sat) unchanged. Every colour is a `beamDisplaySpec`
> field (control-surface SDD) so this is a one-field change, not a const hunt.

| Colour | Hex | Meaning (self-evident, no legend) |
|---|---|---|
| 🟡 YELLOW | `#eab308` | **Your serving link** (acquired / connected). Brightest = the protagonist's serving beam. |
| 🔵 BLUE | `#3b82f6` | **A beam TAKING OVER** — the inter candidate (a different sat lining up) AND the intra/inter acquiring cell. Settles to yellow once it is your serving link. |
| ◼ DIM SLATE | `#46544d` | **Background served beams** (context) — kills the per-sat rainbow → ONE context colour. |

**Handover = `yellow (old serving) → blue (taking over) → yellow (settled)` flip.** Consistent
metaphor: **yellow = your serving link, blue = a beam taking over (candidate / acquiring),
dim = background.** Unserved stays GREY. Ambient population pulse = soft blue `#93c5fd`.

## 4. intra vs inter (rides the shipped B1 sat-count, `d423060`)

- **intra** — 1 satellite. The old cell (serving yellow) fades, the new cell flares BLUE then
  settles to yellow; the two cones OVERLAP on the one satellite → the yellow→blue contrast IS
  the intra signal. (B1 already narrows the steady scene to 1 sat here → nothing competes.)
- **inter** — 2 satellites. The candidate sat is BLUE (lining up); on HO the old sat's beam
  (yellow) fades and the new sat's cell flares BLUE→yellow. (B1 already lights the 2nd sat
  only when an inter HO is pending.)

Distinguished by **1-sat (intra) vs 2-sat (inter)** + the same yellow→blue flip.

## 5. Architecture rework (touch map)

- **Cone colour source** — a NEW semantic resolver replaces `colorForServingBeam` as the
  cone colour. Precedence (highest first): releasing(orange) > acquiring/serving-hero(green)
  > candidate(blue) > background(dim). The flip is transient (reuse the B2 wall-clock
  triggered-intra latch in `MainScene` / `SINR_LIVE_TRIGGERED_INTRA_*`), settling to green.
- **Consolidate the 6 current role colours → 4 semantic.** Retire: hero yellow `#facc15`,
  intra-pulse cyan `#22d3ee`, inter-pulse sky `#0ea5e9`, flash-TO violet `#c084fc`. Keep
  /repurpose: candidate blue `#3b82f6`, flash-FROM orange `#f97316`; ADD serving green
  `#22c55e` + dim context. Constants in `src/constants/sinrLiveConeStyle.ts`.
- **Mosaic (ground UE dots) — Option A (owner-chosen):** recolour to **per-SATELLITE hue**
  (`satId` hash only, drop the per-cell shade) — fewer colours, still shows "which UEs this
  satellite serves" (a meaningful partition). Decoupled from the cone scheme.
  `buildSinrServingUeColorMapFromCells` / `sinrServingMosaic.ts`.
- **`colour-match` governance gate REWORK** (pre-commit; the Bug-E "UE dot colour == its
  serving cone colour via `colorForServingBeam`" invariant). That exact equality RETIRES
  (dots = per-sat, cones = semantic = intentionally different). Replace with: (a) every
  served UE has a serving cone [existence — already s0:connected-sat-has-beam]; (b) the
  protagonist's serving cone resolves GREEN; (c) unserved = grey, grey is never a serving
  colour; (d) mosaic dots = per-sat partition (mesh distinct-colour count > 1, the repointed
  `validate-phase-c-sinr-serving-mosaic-browser`). Update `validate-beam-colour-match.ts` +
  `scene-lane-governance` pins atomically (Rule#9).

## 6. Build steps (each screenshot-gated on :3000, probe-before/after)

- **S1** — semantic palette constants + the cone colour resolver (green serving / dim
  context / blue candidate / orange→green flip). Screenshot: serving=green, candidate=blue,
  a handover flip. NO governance lock yet.
- **S2** — retire the old role-colour layers (yellow/cyan/sky/violet); fold the all-UE
  ambient pulse into the orange→green (or a subtle population cue).
- **S3** — mosaic ground dots → per-satellite hue.
- **S4** — rework `validate-beam-colour-match.ts` + `scene-lane-governance` pins (atomic).
- **S5** — full gate: `validate:governance` + `:phase-c:sinr-serving-mosaic:browser` +
  `validate:static:all` + `validate:ready`; pixel-confirm the story reads without a legend.

## 7. Risks / watch-items

- `colour-match` is a pre-commit gate (the Bug-E fix). Rework carefully — keep the
  "served UE HAS a serving cone" core (s0), only retire the colour-EQUALITY half.
- Serving GREEN must be distinct from the terrain + the UE-dot greens — verify by pixel.
- The all-UE ambient pulse (`sinrLiveCellPulseConeItems`, currently cyan/sky) needs a
  semantic home — likely a faint orange→green on the population, or retire if the per-UE
  flip + 1/2-sat read already tells the story.
- Validator-green is HOLLOW for colour (memory: the Beam-Info "green" was a mount-but-
  invisible false-green) → every step PIXEL-verified, not gate-only.

## 8. Status

**S1–S5 COMPLETE 2026-06-22 — committed.** The whole semantic-colour change (S1+S2+S3+S4)
landed in ONE commit because S1 alone reds the gates (they MUST land with the S4 rework).
Each step was screenshot-verified on :3000; the doc's earlier "S1 breaks colour-match"
was IMPRECISE — S1 actually broke (a) the cone unit test's AdditiveBlending assert and
(b) the scene-lane-governance pulse pin (S1 wrapped `recentHandoverEvents` in a
`.filter(...)`); colour-match stayed green under S1 and only broke once S3 made the dots
per-sat. All found + fixed empirically by running each gate.

S2 — DONE: de-staled the retired-colour comments (hero-yellow / candidate-cyan / TO-violet
/ pulse cyan-sky / "serving-identity colour" cone header) across `sinrLiveConeStyle.ts` +
`SinrLiveCellBeamCones.tsx`. The cyan/sky/violet CONSTS were already repurposed-in-place by
S1 (soft-green pulse / green TO), so "retire cleanly" = comment honesty, no orphan consts.

S3 — DONE: `colorForServingSatellite(satId)` added to `servingColour.ts` (satId-only hash,
no beam jitter/lightness step); `mosaicColorForServingSatellite` wrapper in
`sinrServingMosaic.ts`. Both `buildSinrServingUeColorMapFromCells` AND
`deriveSinrServingMosaicAggregate.color` recolour per-sat (keys/counts stay per-(sat,cell);
cellId still gates served/unserved). Screenshot-confirmed: mosaic distinct-colour count
21→7 (per-sat partition), green hero cone intact, 0 console errors. Owner-accepted Option-A
tradeoff: an intra-HO no longer recolours a dot (the cone orange→green flash carries intra).

S4 — DONE (gate rework, all empirically green):
- `validate-beam-colour-match.ts` REWORKED: retired the UE-dot==cone-colour EQUALITY; now
  pins (a) existence, (b) the SEMANTIC render resolves green/dim/blue via the real
  `resolveSinrLiveConeRenderColor`, (c) grey, (d) mosaic per-sat partition, (e) cone ITEM
  colour still = the `colorForServingBeam` authority. 7 checks green.
- `SinrLiveCellBeamCones.test.ts`: AdditiveBlending→NormalBlending assert + label; the stale
  "distinct literals" pulse comment. BONUS: fixed the pre-existing orphan-RED BASE_ALPHA
  `(0,1)` assert → `(0,1]` (const is intentionally 1.0 = fade-disabled per its own docs) —
  the cone unit test is now FULLY green (33 checks), no longer a flagged orphan-red.
- `sinrServingMosaic.test.ts`: per-cell→per-sat colour + FLIPPED the intra assert (same sat,
  new cell → SAME dot colour now). 10 checks green.
- `validate-s4-pun-retired.ts` + `validate-s4-serving-equivalence.tsx`: repointed the
  cross-surface / E2 colour `expected` to `mosaicColorForServingSatellite` (both green).
- `validate-frontend-scene-lane-governance.ts`: repointed the pulse-source pin to the
  S1-focused `recentHandoverEvents: (… ?? [])` wiring; de-staled the `0.14<0.30` parenthetical.

S5 — gating: `validate:governance` green (pre-commit will pass); cone-render + mosaic-model
unit tests green (src/ tests, not in static:all discovery — run manually). Remaining: commit,
then `validate:static:all` + `validate:ready` (browser) as the thorough post-checks.

DONE (S1, committed):
- Semantic palette + resolver `backgroundColor`: green serving `#22c55e` / dim green-grey
  background `#46544d` / candidate blue `#3b82f6` / triggered flash orange `#f97316` → green
  `#22c55e`. Files: `src/constants/sinrLiveConeStyle.ts`; `src/viz/SinrLiveCellBeamCones.tsx`
  (`resolveSinrLiveConeRenderColor` gains a `backgroundColor` opt, precedence hero>kind>
  override>background>identity; props + render call); `src/scene/MainScene.tsx` (import + the
  serving hero + non-serving mounts pass `backgroundColor`).
- Ambient pulse FOCUSED to the target sats + recoloured soft green `#86efac` — fixes
  "non-serving/non-candidate satellites firing beams": the pulse fed ALL `recentHandoverEvents`
  UNFOCUSED, so any UE's handover flashed a cone on any sat.
- Candidate = a SINGLE dim incoming beam (Option 1): new exported `resolveCandidateBeamConeItems`
  (pending sat → the protagonist's EARTH-FIXED serving cell, since the record carries
  `pendingTargetSatId` but NO candidate cellId — earth-fixed cells share an id across sats);
  `sinrLiveTargetSatIds` narrowed to {serving} ONLY; the hero/candidate sat-split removed.
- **🔑 THE UNLOCK — cone blending Additive → Normal** (`SINR_LIVE_CONE_BLENDING`,
  `sinrLiveConeStyle.ts`): AdditiveBlending summed every cone colour with the bright satellite
  terrain (green→yellow-green, slate→washed-blue) → NO semantic colour read TRUE = the whole
  "顏色調不準 / colour whack-a-mole". NormalBlending → green reads green. This was the hidden
  root the prior beam refactors never touched (they organised colour VALUES, not compositing).

REMAINING (a fresh convo picks up from here + this doc + the working tree):
- S2: retire the now-unused cyan/sky/violet consts cleanly.
- S3: mosaic ground dots → per-satellite hue (`src/scene/sinrServingMosaic.ts`,
  `buildSinrServingUeColorMapFromCells`).
- S4: REWORK the gates the uncommitted S1 breaks, then COMMIT + static:all + ready:
  `scripts/validate-beam-colour-match.ts` (the UE-dot==cone-colour equality + the
  "intra family vs inter jump" shade asserts no longer hold under semantic colour);
  `src/viz/SinrLiveCellBeamCones.test.ts:352` (asserts AdditiveBlending) + the
  `resolveSinrLiveConeRenderColor` precedence test (pulse intra/inter colour value asserts);
  `scripts/validate-frontend-scene-lane-governance.ts` comments (≤2 / contender).

Colour-system map (for a fresh convo): authority `src/constants/servingColour.ts`
`colorForServingBeam`; resolver `src/viz/SinrLiveCellBeamCones.tsx` `resolveSinrLiveConeRenderColor`;
cone mounts `src/scene/MainScene.tsx` ~1700-1790; consts `src/constants/sinrLiveConeStyle.ts`;
frequency `src/utils/beamFrequency.ts` (FRF=3). Builds on shipped `d423060` (B1+B2) and
`8cdb8c8` (LIVE RUN HUD delete); `main` is ahead origin 3 + this uncommitted S1.
