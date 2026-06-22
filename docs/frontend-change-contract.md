# Frontend Change Contract — read before ANY frontend edit

**Binds:** every agent (Claude, Codex, any dispatched sub-agent, human) that
touches `src/scene/`, `src/viz/`, `src/ui/`, `src/app/`, render-plan, or any
runtime rendering boundary. This is the ENFORCED protocol; it exists because
"整頓" rounds kept leaving the frontend "越疊越亂".

> Memory (`.agent-memory/`) does NOT travel with the repo and is read-dependent.
> Prose docs are advisory. The pre-commit hook + CI gates are what actually bind
> an agent that did not read or cannot recall the rules. This doc tells you what
> the gates expect so you pass them on purpose, not by luck.

## Why this exists — 3 entropy loops (do not feed them)

From `docs/handoff/sinr-live-render-consolidation-brief.md` ("Why it got this
way"):

1. **Accretion ratchet** — slice-by-slice dev + a park-not-delete default → every
   feature adds a flag + a layer + a validator and nothing ever leaves.
2. **Inverted governance** — validators that source-PIN names / call-counts /
   body-strings make DELETING or UNIFYING expensive while ADDING a flag beside the
   old one is cheap → "add, never refactor" becomes the locally rational move.
3. **False-green** — gates that test MODEL invariants while the END-TO-END VISUAL
   is broken (a UE shows connected with no beam, yet the gate is green).

If you only fix the symptom in front of you without respecting the rules below,
the mess regrows. The rules ARE the anti-entropy mechanism.

## The 7 non-negotiable rules

1. **Screenshot before AND after every visual change.** Start vite (it serves on
   `http://localhost:3000`), capture the current sinr-live state FIRST, change one
   thing, capture again, compare. Never iterate blind (the repo's "~10 blind
   iterations" rejection is why this is rule #1). A throwaway capture harness
   pattern lives in `scripts/_p0-recheck.ts` (untracked) — copy it.
2. **One concern per commit.** No batched "and also" commits. Each commit must pass
   the pre-commit gate on its own.
3. **DELETE, don't park.** Remove dead code outright. If you genuinely must park
   something, the comment MUST carry a dated un-park trigger + an owner — otherwise
   it rots into a lie (see rule 6).
4. **Validators pin INVARIANTS / CONTRACTS, not source text.** Pinning a symbol
   name / call-count / body-string is debt — it punishes the next person's refactor.
   Assert a runtime OUTPUT or an invariant instead. Adding a source-pin needs a
   one-line justification in the commit body.
5. **Flag / layer BUDGET.** Do not add a render-plan flag or a render layer without
   removing or explicitly justifying one. The render boundary (pure resolvers,
   per-lane flags) is GOOD and STAYS — the problem was never the lane split, it was
   the unbounded accretion of flags/layers on top.
6. **Comments must not lie.** If you change behaviour, fix every comment that now
   describes the old behaviour in the same commit. A stale comment that asserts the
   opposite of reality is a bug.
7. **Never move SINR / golden truth from a display need.** Display-only knobs
   (visual angle / width / colour / opacity) live in `src/scene/beamDisplaySpec.ts`
   and multiply the RENDER only. The antenna beamwidth / gain / link-budget / the
   `s0:geometry-trace` golden are physics truth — do not touch them to make
   something look different. (CLAUDE.md Rules #2, #6.)

## SACRED invariants (a gate fails if you break one)

These encode "what the user must see". Keep them green; do not weaken a gate to
make your change pass.

| Invariant | Enforced by |
|---|---|
| Served ⇒ its serving beam is illuminated (else honest coverage-gap) | `validate:s0:connected-sat-has-beam` (model) + `validate:beam:visual-invariants:browser` (visual) |
| Cone colour == its served UE's marker colour (ONE colour authority `src/constants/servingColour.ts`) | `validate:beam:colour-match` (in the pre-commit gate) |
| Every COUNTED handover RENDERS (ticker count vs on-screen flares) | `validate:phase-c:handover-pulse:render:browser` + `validate:phase-c:handover-ticker:render:browser` |
| ONE viewport frame = ONE authoritative scene lane | `validate:frontend:scene-lane-governance` (Rule #1–9) |
| Geometry / serving truth is byte-stable | `validate:s0:geometry-trace` (golden zero-diff) |

A legitimate truth change (rare, owner-approved) re-baselines the
`s0:geometry-trace` golden deliberately — it is NOT the frozen Rule #4
`baseline-kpi-*.json`. If you think you need to move the golden, STOP and confirm
with the owner first.

## Gate map — what to run, when

| When | Command | Covers |
|---|---|---|
| Every commit (auto, ~16s) | pre-commit hook → `validate:governance` | lint + lane-governance + s0 model + **colour-match visual-truth** |
| Before a handoff / PR (~3min) | `npm run validate:governance:full` | the above + S1–S5 deterministic invariants + warm-start + goldens |
| Before a handoff / PR (~8min) | `npm run validate:static:all` | EVERY static validator (catches a refactor that orphans/breaks one) |
| **Before declaring render work "done"** | `npm run validate:ready` | governance:full + the BROWSER visual gates (needs vite running + `APP_URL`) |

The pre-commit hook is the fast foundation set; **the browser VISUAL gates live
only in `validate:ready`.** A green commit does NOT mean the visual is correct —
for STRUCTURAL render work you MUST run `validate:ready` and paste its result before
you say it is done (the loop-3 fix: don't trust model-green for a visual claim). For a
NON-STRUCTURAL change, see the fast-path immediately below — do NOT burn 8 minutes on it.

### Fast-path — NON-STRUCTURAL changes (right-size the validation)

**The principle:** the heavy browser smoke (`validate:ready` → `validate:phase-h…browser`)
asserts only 3D STRUCTURE — beam/satellite mesh COUNTS + positions, lane resolution, no
artifact-leak, no console errors. **A change that cannot alter mesh existence / count /
position cannot break it.** That covers a whole family, not just colour:

| Non-structural change | Why it can't break the structural smoke |
|---|---|
| **colour / opacity VALUE** (a `BeamDisplaySpec` field default in `sinrLiveConeStyle.ts`) | outside the geometry snapshot; `s0:geometry-trace` zero-diff; mounts no mesh |
| **CSS / SCSS** (`src/styles/**`, `main.scss` + partials) | compiles to DOM styling only; mounts no mesh (not even in the binding scope above) |
| **pure text / caption / HUD copy** | a string change moves no mesh (honesty-locked captions are pinned by `scene-lane-governance`, already in the ~16s gate) |
| **DOM-only sidebar / panel layout** (`src/ui`, no `<Canvas>` / Three import) | DOM reflow can't move a 3D mesh |
| **camera-pose MAGNITUDE / playback SPEED value** | a view transform / `dt` scale — never changes mesh existence or count |

For any of these:
- **RUN:** `npm run validate:visual` — ONE command (≈30s): `validate:governance` (~16s — INCLUDES
  `colour-match`, `scene-lane-governance` [locks the INV `:root` tokens + honesty captions], +
  `beam-display-spec-purity`) **then a `:3000` screenshot** (`scripts/shot.ts` → `output/shot/visual-*.png`).
  LOOK at the PNG — it IS the pixel proof (loop-3 "don't trust model-green for a visual claim").
  (Needs vite running — `npm run dev`; `shot.ts` warns + skips the screenshot if it isn't, the
  governance gate still ran.)
- **SKIP:** `validate:ready` (the ~T+930s, 6-serial-browser smoke, ~11min) + `validate:static:all`
  (~8min) — they
  verify STRUCTURE these changes cannot move, so running them here is pure wasted wall-clock
  (the "why did changing one hex / one CSS line take 8 minutes?" complaint). This directly
  unblocks the HUD-overhaul backlog, where almost every change is CSS/text.

**GUARDRAILS — these stay STRUCTURAL (run the full `validate:ready`), never fast-path them:**
a **lane switch**; a **new mount / proof layer / mesh**; blending mode, cone geometry,
`focusScope`/which-beams, or anything in the `beam-display-spec-purity` KNOWN-GAPS; **a change
to a COUNTED invariant** — the handover-ticker COUNT (`handover-ticker:render:browser`), the
cinema **focus/restore lifecycle** or **speed TIER** (`director-cinematic` / `handover-cinema`
browser gates), or the served/beam counts. **When unsure, treat it as structural.** The
carve-out is "DOM / style / text / colour / pose-magnitude only, no lane / mount / counted-
invariant change" — not a licence to skip the visual gate on real render work.

Activate the hook on a fresh clone: `npm run setup:hooks`. Do NOT normalize
`git commit --no-verify`.

## Dispatch-prompt template (for spawning a frontend sub-agent)

Paste this into any agent you send to do frontend work:

```
Read docs/frontend-change-contract.md FIRST and follow it exactly. You are doing
a PURE-FRONTEND / display-only change: <task>.

Hard rules:
- Start vite (http://localhost:3000) and SCREENSHOT the sinr-live state before and
  after — never iterate blind.
- ONE concern, small steps. DELETE-not-park. Comments must not lie.
- Do NOT touch engine SINR, the s0:geometry-trace golden, or any link-budget
  physics. Display-only knobs go in src/scene/beamDisplaySpec.ts (render only).
- Do NOT add a render-plan flag/layer without removing or justifying one.
- Validators pin invariants, not source text.

Before you return, you MUST:
1. Run `npm run validate:ready` and paste the FULL result (it is the visual gate;
   a green pre-commit is not enough).
2. List the before/after screenshot paths and what changed visually.
3. Summarise your diff (files + why), one concern only.

Do NOT commit to main and do NOT push. Leave the change in your worktree for
review.
```

When the controller dispatches via the Agent tool it SHOULD use
`isolation: "worktree"` so a bad change cannot reach `main`, and review the diff
(e.g. the `caveman:cavecrew-reviewer` agent) before accepting.

## Honest limits (do not overclaim)

The pre-commit hook + static gates are COOPERATIVE, not adversarial (CLAUDE.md
"LIMITS"): `git commit --no-verify` bypasses them; the hook lives in the working
tree so one commit can both regress and defang it; the browser visual coverage is
only in the MANUAL `validate:ready`. The ONLY unbypassable layer is **server-side
CI on a PR** (`.github/workflows/`), which gates merges regardless of local state.
Until a change lands through that CI, "the gates passed locally" means a
cooperating agent passed them — it is not proof against a careless or adversarial
one.

## See also

- `docs/handoff/sinr-live-render-consolidation-brief.md` — the diagnosis + the 3 loops in full.
- `docs/frontend-render-governance.md` + `docs/decisions/ADR-001-scene-lane-render-boundary.md` — the lane / truth-vs-display boundary.
- `CLAUDE.md` / `AGENTS.md` — "Frontend Render Governance Rule" + the layered-enforcement description.
