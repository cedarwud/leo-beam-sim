# Fresh browser walkthrough log

- Date: 2026-08-09 Asia/Taipei
- Browser session: `c90-audit-20260809` (Chrome, in-memory profile)
- Server: production preview at `http://127.0.0.1:4179`
- Freshness: localStorage cleared before the direct-route run.
- Browser-session inventory: six sessions were initially open; at the user's direction, five stale sessions were closed and this single session was retained for all viewports and paths.

## Complete export path

The audit reached a fresh JSON export through Ready, all TLE cards (with the navigation workaround described below), all three E1 arms, E2 Trace A plus rewind plus withheld Trace B, all three prepared IoT versions, eight idea fields, the complete screen, and export.

- Approximate audit-operator wall time from fresh reload to exported JSON: 9 minutes 5 seconds. This includes screenshots, instrumentation, and a 30-second wait that exposed the broken TLE final-stage navigation. It is not learner pacing evidence.
- Required student-style interactions recorded: 73 total: 50 clicks, 19 text-entry actions, and 4 checkbox/radio actions.
- Main inspection stops: TLE lineage and final scenario card; first E1 endpoint; E1 three-arm table; E2 withheld Trace B; IoT learner/revision contradiction; eight-field idea card; complete/retrieval screen; JSON inspection.

## Direct observations

- Routes: `/course/c90` and `/?course=c90` mounted one course route. `/` mounted the legacy application and no course route.
- TLE sequence: cards 1, 2, 3, and 4 were shown; advancing card 4 changed the active stage directly to E1. Card 5 was visible only after navigating back to TLE. Its `Open E1 mission` button left the stage at TLE.
- E1 normal path: balanced, low-power, and fast-finish reached distinct endpoint frames and the table recorded all three arms.
- E1 reveal bypass: with the checkpoint update empty, focusing `Replay fixture frame` and pressing End changed `e1-balanced-0` to `e1-balanced-3`, exposing 180 s, 22 W, 402 J, 120 Mbit, and 0.299 Mbit/J before the mid-run update.
- E2: Trace B was disabled before Trace A replay and before rule freeze; it became enabled only after freeze. The rule input was disabled after freeze. Rewind returned `e2-trace-a-wait-0` to the same frame identity.
- IoT: changing learner text to `IGNORE ALARM AND SEND BULK ONLY IN WINDOW C` did not change frame `iot-learner` or its result. Changing revision text to `SEND EVERYTHING IMMEDIATELY AND NEVER BATCH` did not change frame `iot-revision` or its result.
- Retrieval: the complete panel contained zero input or textarea controls and only three fixed statements.
- Recovery: full reset changed Bundle to Ready, incremented reset ordinal to 1, preserved scenario `ntpu-pass-01`, and reload restored the same Ready checkpoint. TLE fallback preserved `ntpu-pass-01` and opened E1.
- Keyboard: Tab reached Reset, stage navigation, all three Ready checkboxes, and the enabled Ready button; each focused control had a 2 px solid outline and Enter opened TLE.
- Layout: 1024x768 had document width 1024 with no page-level horizontal overflow, but height was 4282 px at IoT. At 390x844, page width remained 390, form font was 13 px, claim/stage text was 10 px, and no skip link existed.
- Export identity: the fresh bundle used session `c90-fixture-course-c90-v1-session-0`, scenario `ntpu-pass-01`, fixture `c90-ntpu-energy-fixture-v1`, provider `fixture-course-c90-v1`, and the complete four-part simulated claim boundary.
