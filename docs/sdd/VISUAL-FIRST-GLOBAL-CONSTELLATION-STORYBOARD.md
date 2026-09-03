# Visual-first global constellation storyboard

Status: implemented teaching slice

Route: `/prototype/global-constellation`

This storyboard is a display-only lesson about three different questions:
global constellation quantity, orbital altitude, and which archived points are
at least 10° above the NTPU local horizon at one fixed instant. It does not
implement handover, link quality, energy efficiency, TLE parsing, a live count,
or an API.

## Source and truth boundary

Both constellations use the checked-in first-frame artifacts in
`public/global-first-frame/*-20260812.json`. The artifacts are validated by the
existing `visualLab/globalConstellation` loader and are rendered together at:

```text
2026-08-12T12:00:00.000Z
world frame: earth-fixed-radius-2.48-v1
source: archived TLE + SGP4 first-frame artifact
```

| system | artifact points | raw horizon (`α >= 0°`) | Act 1 observation (`α >= 10°`) | median altitude | accepted snapshot |
| --- | ---: | ---: | ---: | ---: | --- |
| Starlink | 10,754 | 475 | 177 | 481.899 km | `/tle-archive/starlink/starlink_20260812.tle` |
| OneWeb | 651 | 39 | 18 | 1212.183 km | `/tle-archive/oneweb/oneweb_20260812.tle` |

The two accepted source digests are carried in the director facts and exposed
as browser render-state invariants. A point is one successfully located
artifact satellite. Point size is a readability encoding, not physical size.
The checked-in artifact retains its original geometric-horizon mask
(`elevation >= 0°`) as provenance. Act 1 does not relabel that mask: it derives
a separate 10° classroom observation mask from the same Earth-fixed positions
and NTPU WGS84 observer using `α = atan2(U, √(E²+N²))`. This 10° threshold is an
explicit lesson boundary, not a service-coverage test; the separate pass/service
policy remains 15°. A height ring is a median-altitude guide only: it must not
be read as all points occupying one common shell. The Earth and shell radii use
the existing canonical world-frame scale; no local teaching zoom is introduced.

## Directed flow

The director owns one primary visual cue per beat and at most two caption lines.
The nominal flow is 66 seconds. Autoplay pauses at the constellation-comparison
checkpoint and again at the NTPU reveal until the learner completes the named
scene-local action.

| beat | duration | camera / primary cue | visual action and short copy |
| --- | ---: | --- | --- |
| 1. Earth question | 6 s | earth-wide / archived-position definition | Starlink is already visible; the first sentence defines what every point means. |
| 2. Starlink density | 8 s | starlink-close / Starlink density cloud | `10,754` is paired with the fixed instant and the inclination/density-band explanation. |
| 3. OneWeb compare | 8 s (paused) | compare-wide / manual constellation switch | The learner switches between Starlink and OneWeb; only one point cloud is displayed at a time and neither colour encoding dims. |
| 4. Height cross-section | 8 s | height-oblique / median-height guides | Labelled rings show `482 km` and `1,212 km` as median-height guides, not orbital planes. |
| 5. NTPU reveal | 12 s (paused) | ntpu-approach / reveal control | A keyboard-focusable control reveals the one-instant 10° observation mask and its station-centred angle construction. |
| 6. Starlink visible | 9 s | starlink-visibility / 10° observation mask | Only `177 / 10,754` points remain; the caption states the fixed instant and non-service boundary. |
| 7. OneWeb visible | 9 s | oneweb-visibility / 10° observation mask | Only `18 / 651` points remain under the same formula and visual encoding. |
| 8. Stable finale | 6 s | synthesis / stable replay | The global result remains visible with replay and persistent six-scene navigation; Play at the end restarts from zero. |

During playback the camera is director-owned; while paused the learner may
rotate the globe. Clicking the scene toggles playback. `prefers-reduced-motion`
removes camera/reveal interpolation while keeping the same beat and interaction
semantics. At 1920×1080 the stage is a single full
viewport, with the render-state gate requiring at least 85% of the stage to
remain exposed after conservative overlay measurement. 768 px and 320 px
checks require full-width, no-overflow layout and keyboard-safe controls.

## Interaction contract

Beat 3 is a manual comparison checkpoint: the learner switches between
Starlink and OneWeb and then resumes the director. Beat 5 exposes `顯示` as a
regular keyboard-focusable control; the clock remains paused until activation,
then transitions to the Starlink observation-mask beat. These interactions
change display state only; artifact counts, source identities, positions,
fixed instant, and height-guide semantics remain unchanged. Persistent scene
navigation is available throughout. The finale exposes replay and the next
scene link; Play at the terminal time also restarts from zero.

## Engineering and evidence

The implementation is intentionally isolated under
`src/prototype/global-constellation/**`. It reuses the validated artifact
loader and Earth/world-frame asset, but does not mount the legacy shell,
controls, timeline, shell census, Walker runtime, handover runtime, EE pages,
or canonical model producer. Existing `Act1*` modules remain available as
read-only/history-capability modules; the new compositor does not delete their
data path.

Focused evidence commands:

```bash
npm run test:global-constellation
npm run validate:global-constellation:browser
npm run record:global-constellation
```

The browser gate checks beat order/cue uniqueness, caption length, full stage,
absence of student side panels, exact artifact identity/count/height/mask
semantics, exclusive point-cloud switching and stable color encoding, projector-readable
truth text with computed font size, camera/focus bridge state, height-guide render
state, keyboard and pointer reveal, display-only restore, measured camera
settlement, frozen finale progress, responsive layout, and the post-settlement
six-second finale. The recorder saves one screenshot per beat plus a
1920×1080 WebM and manifest under
`output/playwright/global-constellation/`.

## Honest limits

This is a visual explanation of one archived SGP4 first-frame artifact. It is
not a live operational constellation census, telemetry stream, calibrated RF
link budget, service-coverage claim, handover trace, energy-saving result, or
platform integration. The 10° mask is a course observation threshold derived
from the archived Earth-fixed positions; the artifact's separate 0° horizon
mask remains provenance only. The visual point cloud and median rings answer
geometry questions only; they do not directly establish signal quality or
service policy.
