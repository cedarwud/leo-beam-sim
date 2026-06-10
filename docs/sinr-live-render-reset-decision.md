# SINR-Live Render Reset — Decision Note

**Goal:** deliver showcase goals **1 (好看)** + **2 (一直有換手 → 衛星夠多)** on leo's
own decoupled world. Does NOT touch MODQN proof (that = the producer dense-Q
request + replay lane). Date 2026-06-10.

## Root cause we are fixing
Live sinr-live currently renders the **old steered + UE-anchor** path
(`MainScene.tsx:797 disableUeAnchor=false`) under the **profile's 12° steering**
(`hobs-2024-candidate-rich.json:23`). Consequence: only 1–3 sats can steer to the
area, the serving beam is **glued to the focus UE (always centred)**, so intra-HO
is invisible. The 1-line anchor flip I tried exposed that the steered geometry
isn't real (beams drift horizontal at the edge) — confirmed dead end.

The correct multi-sat geometry **already exists but is PARKED**: the earth-fixed
cell-truth model (`sinrLiveCellRuntime.ts`) runs steer **50°**, beamwidth **3.32°**
(~32 km footprint), **37 cells**, **6–8 serving sats** at the demo window, 7-beam/sat
hopping — UEs sit off-axis by construction, intra/inter-HO continuous. `be60db2`
parked its render (`showSinrLiveCellBeams=false`) after ~10 look-tuning rounds.

## LOCKED (not re-litigated)
1. **Truth source = the cell model** (50° / 3.32° / 37 cells / hopping). Numbers
   confirmed live in `sinrLiveCellRuntime.ts`; grounded in 3GPP TR 38.821 + Starlink.
   Beamwidth stays 3.32° — wider blobs out on 200×90 (user constraint).
2. **Retire steered + anchor on sinr-live**: un-park `showSinrLiveCellBeams`,
   set `disableUeAnchor=true`, suppress the steered `<SatelliteBeams>` on the lane,
   re-point governance asserts from "parked" back to "rendered". Other lanes untouched.
3. Service breadth (all served UEs) stays in the **UE mosaic dots + aggregate**,
   not in drawing every cone (Rule#6).

## OPEN knob = beam render STYLE (the thing that looped ~10×)
Tension: multi-sat ⇒ many cones ⇒ busy/washed; but user wants **few, legible beams,
connections visible**. No clean prior answer → **resolve by screenshot loop on :3001**,
not by spec. Candidates (start point → iterate by eye):

- **A (recommended start):** restore the S-cells-4 cone render as baseline (all
  serving sats, NormalBlending, freq-reuse colour, opacity ~0.18–0.22), screenshot,
  then tune the two live knobs `SINR_LIVE_CELL_CONE_OPACITY` + `SINR_LIVE_CONE_MAX_FOCUS_SATS`
  down until legible. Fastest to something on screen.
- **B (if A still busy):** focus-subset — bright cones ONLY for the 1–2 sats in the
  current handover; all other serving sats shown as mosaic dots only (no cone).
  Matches "few beams + see the action"; risk = a connected sat with no cone (user
  disliked this before — mitigate by always drawing the primary-UE serving sat).
- **C (different primitive):** drop tall cones; serving = flat ground **footprint
  discs** + sat→cell thin line. Least washout; loses the "beam from sky" look.

## Plan (screenshot-driven, no blind tuning)
1. Implement the LOCKED un-park (truth+kill) + render-style **A** baseline.
2. Capture :3001 (`scripts/p2-capture-sinr-live.ts`), show user before/after.
3. User reacts → tune knobs / switch to B or C → re-shoot. Repeat until 好看 + HO visible.
4. Lock: cavecrew-reviewer → governance Rule#9 update → browser gates → commit.

## Open question for user
Start at **A** (restore + tune down), or go straight to **B** (focus-subset, fewest
beams)? Default = A.
