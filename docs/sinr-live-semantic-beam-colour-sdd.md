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

| Colour | Hex | Meaning (self-evident, no legend) |
|---|---|---|
| 🟢 GREEN | `#22c55e` | **Your serving link** (acquired / connected). Brightest = the protagonist's serving beam. |
| ◼ DIM SLATE | low-opacity cool (pin in S1) | **Background served beams** (context) — kills the per-sat rainbow → ONE context colour. |
| 🔵 BLUE | `#3b82f6` | **Candidate / incoming inter-HO target** (lining up). |
| 🟠 ORANGE | `#f97316` | **A beam being RELEASED** (the handover moment — the OLD beam). |

**Handover = `orange (old) → green (new)` flip.** Consistent metaphor: **green = on /
acquired, orange = releasing, blue = next, dim = background.** Unserved stays GREY.

## 4. intra vs inter (rides the shipped B1 sat-count, `d423060`)

- **intra** — 1 satellite. Old cell flares ORANGE, new cell flares GREEN; the two cones
  OVERLAP on the one satellite → the orange→green contrast IS the intra signal. (B1
  already narrows the steady scene to 1 sat here → nothing competes.)
- **inter** — 2 satellites. The candidate sat is BLUE (lining up); on HO the old sat's
  beam goes ORANGE and the new sat's GREEN. (B1 already lights the 2nd sat only when an
  inter HO is pending.)

Distinguished by **1-sat (intra) vs 2-sat (inter)** + the same orange→green flip.

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

PLANNED 2026-06-22 (owner chose semantic + Option A mosaic). Not started. Builds on the
shipped B1 beam-sat-by-HO-type + B2 vivid intra flash (`d423060`) and the LIVE RUN HUD
delete (`8cdb8c8`). Continue in-session (the colour-system map is loaded); this doc is the
handoff if the conversation is switched.
