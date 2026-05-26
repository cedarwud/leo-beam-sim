# MODQN Visibility Fix Mini-SDD

## 1. Problem

The live `modqn-demo` profile currently declares the paper baseline shell as:

```json
{ "altitudeKm": 780, "inclinationDeg": 53, "planes": 1, "satsPerPlane": 4 }
```

That is paper-literal in total satellite count, but it places all four
satellites in one orbital plane. With the live renderer elevation gate
(`MIN_ELEVATION_DEG = 15`) the plane crosses the Beijing service area in a
short pass and then leaves no visible satellite for most of the 1200 second
demo cycle.

This is a live profile geometry issue. It is not a replay artifact issue and
must not be solved by changing `showcaseArtifactToScene.ts`, producer replay
values, SINR truth, reward truth, or global visibility thresholds.

## 2. Goal

For `modqn-demo`, keep the paper baseline count and beam shape:

- 4 satellites total.
- 7 beams per satellite.
- 780 km altitude.
- 53 degree inclination.
- 100 UE paper baseline remains unchanged.

The scene should show at least one satellite above 15 degrees elevation for
the full 0..1200 second simulation cycle. More than one visible satellite is
allowed, but the fix should not inflate the MODQN paper baseline into a 16+
satellite constellation.

## 3. Chosen Design

Use Option B with a small service-area phasing extension:

```json
{
  "planes": 4,
  "satsPerPlane": 1,
  "serviceAreaPassTargetsSec": [100, 400, 700, 1000]
}
```

The existing Walker generator already supports multiple planes, but absolute
RAAN values are epoch-sensitive. A hard-coded RAAN array that looks correct at
one epoch can drift when the cache is built with a different epoch. The new
field is therefore semantic rather than absolute: each listed target time asks
the orbit module to initialize one plane's single satellite so that it passes
over the configured observer at that simulation second.

The generator derives the actual RAAN and mean anomaly from:

- shell altitude and inclination,
- profile observer latitude and longitude,
- cache epoch,
- per-plane target pass second.

This keeps the profile compact and robust for both the fixed app epoch and
standalone validators that call `createTrajectoryCache(..., Date.now())`.

## 4. Boundary Rules

- `serviceAreaPassTargetsSec` is live-sim profile geometry only.
- The field must be ignored unless `planes > 0`, `satsPerPlane === 1`, and the
  caller provides an observer position.
- Standard Walker behavior remains the fallback for all existing profiles.
- Satellite IDs remain `shellId-P{plane}-S0`.
- `MIN_ELEVATION_DEG` remains unchanged.
- `showcaseArtifactToScene.ts` remains untouched.
- The replay artifact path remains immutable and producer-owned.

## 5. Alternatives Rejected

1. `demoStartOffsetSec` only shifts the short visibility window. It does not
   make the 1200 second cycle continuously visible.
2. Lowering `MIN_ELEVATION_DEG` weakens all profiles and changes a global live
   simulation rule.
3. A 16 satellite Walker shell improves visual density but changes the paper
   baseline count.
4. Absolute RAAN / mean-anomaly arrays are brittle across epoch changes and
   make the caller responsible for orbital initialization math.

## 6. Validation

The fix is accepted only if:

1. The reproduction one-liner reports `above15deg >= 1` at all sampled times
   from 0 to 1200 seconds.
2. A one-second sweep of 0..1200 seconds has no `above15deg === 0` gaps.
3. `npm run lint` is clean.
4. The requested validator set remains green.
5. Browser smoke in `modqn-demo` confirms satellites remain visible while the
   timeline is scrubbed.
