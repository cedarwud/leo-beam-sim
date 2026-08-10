# C-90 TLE archive / trajectory seam

## Completion criterion

Given an available `constellation + archive date + NORAD catalog ID + time-window preset`, the archive module returns an immutable source packet and the course provider returns a versioned, deterministic trajectory bundle. The bundle carries the exact per-object TLE epoch, target UTC for every frame, signed `target - epoch`, provenance/hash, observer identity, model label, and precomputed scene/look-angle values. The C-90 route can switch and replay those frames without running SGP4 or inventing KPI values in the browser. Missing source, malformed time, or identity mismatch fails closed.

## Time semantics

- `archiveDate`: date encoded in the archive filename; useful for lookup, never used as the object's epoch.
- `epochUtc`: parsed from the selected object's TLE line 1. This is the SGP4 element-set reference epoch.
- `targetUtc`: instant requested from the propagator. `targetUtc = now` only for a current-time request.
- `nowUtc`: display/reference clock only. It must not silently replace `targetUtc`.
- `ageSeconds = targetUtc - epochUtc`: signed propagation distance. Accuracy generally degrades as `abs(ageSeconds)` grows, but no universal pass/fail day threshold is claimed.

For historical operational replay, source selection uses the latest available TLE at or before the target (no future knowledge). A separate fixed-source teaching comparison may deliberately propagate old and recent TLEs to the same target; it reports model-output divergence, not measured position error.

## Modules and seam

### `tle_data` archive module

Small interface: list archive dates and resolve one immutable `tle-source-packet-v1`. It owns filesystem layout, line parsing, checksum, per-object epoch, and source hashes. It does not propagate or produce course KPI values.

### Backstage trajectory producer

Small interface: `produceTrajectory(sourcePacket, window, observer) -> tle-trajectory-bundle-v1`. It owns SGP4 plus TEME/Earth-fixed/geodetic/NTPU look-angle conversion. It is used before class or behind a future server adapter, never imported by the C-90 browser route.

### `CourseDataProvider`

Returns a preloaded `TleStudy`: source choices, bounded time-window presets, and validated trajectory bundles. Fixture and future server-backed adapters satisfy the same interface. Only the designated course-compatible source/window may continue into E1; archive comparisons remain TLE teaching traces.

## Failure rules

- Never derive epoch from the archive filename or download time.
- Never silently substitute `now` for the selected target.
- Never fill a missing geometry or KPI field with fallback numbers.
- Never attach E1/E2/IoT outcomes to an arbitrary TLE by relabeling identity.
- Unknown imported `.tle` may be inspected, but cannot enter the course until a matching precomputed bundle exists.
- A fallback is explicit and exported as fallback usage.

## Storage / performance policy

- Keep the full archive server-side; do not ship the 2.5 GB sibling repository to browsers.
- Cache on `(sourceHash, observerId, startUtc, endUtc, stepSec, producerVersion)`.
- Precompute only a selected satellite and bounded interval. Use sparse keyframes for long windows and interpolate display position; readouts remain keyed to producer frames.
- The fixture provider carries only a few teaching sources/windows. The future adapter may query the sibling archive without changing the UI/state machine.
