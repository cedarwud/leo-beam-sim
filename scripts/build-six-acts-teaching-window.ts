#!/usr/bin/env node
/**
 * Generates the pinned six-acts teaching-window fixture from the published
 * NTPU 90-day TLE event atlas.
 *
 * The atlas is a 30 s coarse offline forecast. This script extracts the one
 * source-backed OneWeb window the classroom slice replays, together with every
 * digest needed to prove where it came from. It deliberately does NOT emit beat
 * timings: the director calibrates those against live replay dt.
 *
 *   npm run generate:six-acts:teaching-window
 *   npm run check:six-acts:teaching-window   # deterministic re-generation gate
 */

import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SIX_ACTS_TEACHING_WINDOW_SCHEMA,
  SIX_ACTS_TEACHING_WINDOW_BOUNDARY,
  SIX_ACTS_BEAT_CALIBRATION,
  type SixActsTeachingWindowFixture,
  type SixActsAtlasForecastSample,
  type SixActsTleIdentity,
} from '../src/course/sixActs/teachingWindowSchema';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const ATLAS_DIR_REL = 'artifacts/tle-event-atlas/20260818-ntpu-90d';
const ATLAS_FILE_REL = `${ATLAS_DIR_REL}/oneweb-atlas.json.gz`;
const MANIFEST_FILE_REL = `${ATLAS_DIR_REL}/oneweb-run-manifest.json`;
const OUTPUT_REL = 'src/course/sixActs/fixtures/teachingWindow.generated.json';

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number in the atlas`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string in the atlas`);
  }
  return value;
}

/** Keep only the link fields a teaching card actually shows. */
function trimLink(raw: Record<string, unknown> | null): SixActsAtlasForecastSample['serving'] | null {
  if (raw === null) return null;
  return {
    satelliteId: requireString(raw.satelliteId, 'link.satelliteId'),
    userId: requireString(raw.userId, 'link.userId'),
    userIndex: requireNumber(raw.userIndex, 'link.userIndex'),
    beamId: requireNumber(raw.beamId, 'link.beamId'),
    elevationDeg: requireNumber(raw.elevationDeg, 'link.elevationDeg'),
    rangeKm: requireNumber(raw.rangeKm, 'link.rangeKm'),
    offAxisAngleRad: requireNumber(raw.offAxisAngleRad, 'link.offAxisAngleRad'),
    actualPowerW: requireNumber(raw.actualPowerW, 'link.actualPowerW'),
    sinrDb: requireNumber(raw.sinrDb, 'link.sinrDb'),
    rateBps: requireNumber(raw.rateBps, 'link.rateBps'),
    qosMet: raw.qosMet === true,
  };
}

function trimAnchor(raw: Record<string, unknown>): SixActsAtlasForecastSample {
  return {
    role: requireString(raw.role, 'anchor.role') as SixActsAtlasForecastSample['role'],
    anchorIndex: requireNumber(raw.anchorIndex, 'anchor.anchorIndex'),
    instantUtc: requireString(raw.instantUtc, 'anchor.instantUtc'),
    state: requireString(raw.state, 'anchor.state'),
    event: requireString(raw.event, 'anchor.event'),
    servingSatelliteId: requireString(raw.servingSatelliteId, 'anchor.servingSatelliteId'),
    candidateSatelliteId: raw.candidateSatelliteId === null
      ? null
      : requireString(raw.candidateSatelliteId, 'anchor.candidateSatelliteId'),
    deltaSinrDb: raw.deltaSinrDb === null ? null : requireNumber(raw.deltaSinrDb, 'anchor.deltaSinrDb'),
    serving: trimLink(raw.serving as Record<string, unknown>),
    candidate: trimLink(raw.candidate as Record<string, unknown> | null),
    concurrentVisibleSatelliteCount: requireNumber(
      raw.concurrentVisibleSatelliteCount,
      'anchor.concurrentVisibleSatelliteCount',
    ),
    systemPowerW: requireNumber(raw.systemPowerW, 'anchor.systemPowerW'),
    totalRateBps: requireNumber(raw.totalRateBps, 'anchor.totalRateBps'),
    instantaneousEeBitsPerJ: requireNumber(raw.instantaneousEeBitsPerJ, 'anchor.instantaneousEeBitsPerJ'),
    evaluationEeBitsPerJ: requireNumber(raw.evaluationEeBitsPerJ, 'anchor.evaluationEeBitsPerJ'),
  };
}

function trimIdentity(raw: Record<string, unknown>): SixActsTleIdentity {
  return {
    satelliteId: requireString(raw.satelliteId, 'tle.satelliteId'),
    satelliteName: requireString(raw.satelliteName, 'tle.satelliteName'),
    epochUtc: requireString(raw.epochUtc, 'tle.epochUtc'),
    sourcePath: requireString(raw.sourcePath, 'tle.sourcePath'),
    line1: requireString(raw.line1, 'tle.line1'),
    line2: requireString(raw.line2, 'tle.line2'),
  };
}

function buildFixture(): SixActsTeachingWindowFixture {
  const atlasBytes = readFileSync(resolve(REPO_ROOT, ATLAS_FILE_REL));
  const atlas = JSON.parse(gunzipSync(atlasBytes).toString('utf8')) as Record<string, any>;
  const manifest = JSON.parse(
    readFileSync(resolve(REPO_ROOT, MANIFEST_FILE_REL), 'utf8'),
  ) as Record<string, any>;

  const requestedVariantId = optionValue('--variant-id');
  const rankedIds: readonly string[] = atlas.rankedPreferredVariantIds;
  const variantId = requestedVariantId ?? rankedIds[0];
  const rank = rankedIds.indexOf(variantId) + 1;
  if (rank === 0) {
    throw new Error(`variant ${variantId} is not in the atlas ranking`);
  }

  const event = (atlas.preferredEvents as readonly Record<string, any>[])
    .find(candidate => candidate.variantId === variantId);
  if (event === undefined) {
    throw new Error(`variant ${variantId} has no retained clip in preferredEvents`);
  }
  if (event.sourceEvent !== 'inter-handover') {
    throw new Error(`variant ${variantId} is ${String(event.sourceEvent)}, not a valid Offset+TTT event`);
  }

  const requestedT0Utc = requireString(event.requestedT0Utc, 'event.requestedT0Utc');
  const triggerInstantUtc = requireString(event.triggerInstantUtc, 'event.triggerInstantUtc');
  const triggerOffsetSec = (Date.parse(triggerInstantUtc) - Date.parse(requestedT0Utc)) / 1000;
  if (!Number.isInteger(triggerOffsetSec) || triggerOffsetSec <= 0) {
    throw new Error(`trigger offset ${String(triggerOffsetSec)} s is not a positive whole second`);
  }

  const qualificationAnchors = (event.qualificationAnchors as readonly Record<string, any>[]).map(anchor => ({
    anchorIndex: requireNumber(anchor.anchorIndex, 'qualification.anchorIndex'),
    instantUtc: requireString(anchor.instantUtc, 'qualification.instantUtc'),
    deltaDb: requireNumber(anchor.deltaDb, 'qualification.deltaDb'),
    progressSec: requireNumber(anchor.progressSec, 'qualification.progressSec'),
  }));
  const qualificationSpanSec = qualificationAnchors.length === 0
    ? 0
    : qualificationAnchors[qualificationAnchors.length - 1].progressSec;
  if (qualificationSpanSec < event.handoverPolicy.tttSec) {
    throw new Error(
      `qualification span ${qualificationSpanSec} s is shorter than TTT ${String(event.handoverPolicy.tttSec)} s`,
    );
  }

  const identities = (event.tleIdentities as readonly Record<string, any>[]).map(trimIdentity);
  const fromIdentity = identities.find(identity => identity.satelliteId === event.fromSatelliteId);
  const toIdentity = identities.find(identity => identity.satelliteId === event.toSatelliteId);
  if (fromIdentity === undefined || toIdentity === undefined) {
    throw new Error('the atlas clip is missing a TLE identity for one side of the pair');
  }

  const windowReceipt = (atlas.windows as readonly Record<string, any>[]).find(
    receipt => receipt.requestedT0Utc === requestedT0Utc && receipt.status === 'accepted',
  );
  if (windowReceipt === undefined) {
    throw new Error(`no accepted window receipt for ${requestedT0Utc}`);
  }

  return {
    schema: SIX_ACTS_TEACHING_WINDOW_SCHEMA,
    beatCalibration: SIX_ACTS_BEAT_CALIBRATION,
    boundary: SIX_ACTS_TEACHING_WINDOW_BOUNDARY,
    generationCommand: 'npm run generate:six-acts:teaching-window',
    provenance: {
      atlasId: requireString(atlas.atlasId, 'atlas.atlasId'),
      atlasSchema: requireString(atlas.schema, 'atlas.schema'),
      atlasGeneratedAtUtc: requireString(atlas.generatedAtUtc, 'atlas.generatedAtUtc'),
      atlasArtifactPath: ATLAS_FILE_REL,
      atlasArtifactSha256: sha256(atlasBytes),
      sourceArchiveContentSha256: requireString(
        atlas.sourceArchiveContentSha256,
        'atlas.sourceArchiveContentSha256',
      ),
      configDigest: requireString(atlas.configDigest, 'atlas.configDigest'),
      canonicalParameterDigest: requireString(
        atlas.canonicalParameterDigest,
        'atlas.canonicalParameterDigest',
      ),
      canonicalScenarioDigest: requireString(
        atlas.canonicalScenarioDigest,
        'atlas.canonicalScenarioDigest',
      ),
      resolverRevision: requireString(atlas.resolverRevision, 'atlas.resolverRevision'),
      visibilityRevision: requireString(atlas.visibilityRevision, 'atlas.visibilityRevision'),
      exactSgp4Revision: requireString(atlas.exactSgp4Revision, 'atlas.exactSgp4Revision'),
      propagationMode: requireString(atlas.propagationMode, 'atlas.propagationMode'),
      evidenceClass: requireString(atlas.evidenceClass, 'atlas.evidenceClass'),
      observer: {
        id: requireString(atlas.observer.id, 'observer.id'),
        label: requireString(manifest.observer.label, 'manifest.observer.label'),
        latitudeDeg: requireNumber(atlas.observer.latitudeDeg, 'observer.latitudeDeg'),
        longitudeDeg: requireNumber(atlas.observer.longitudeDeg, 'observer.longitudeDeg'),
        heightKm: requireNumber(atlas.observer.heightKm, 'observer.heightKm'),
      },
      search: {
        startUtc: requireString(atlas.search.startUtc, 'search.startUtc'),
        endUtcExclusive: requireString(atlas.search.endUtcExclusive, 'search.endUtcExclusive'),
        windowStepSec: requireNumber(atlas.search.windowStepSec, 'search.windowStepSec'),
        physicalDurationSec: requireNumber(atlas.search.physicalDurationSec, 'search.physicalDurationSec'),
      },
    },
    selection: {
      rank,
      variantId,
      logicalEventKey: requireString(event.logicalEventKey, 'event.logicalEventKey'),
      sourceEvent: 'inter-handover',
      traceDigest: requireString(event.traceDigest, 'event.traceDigest'),
      geometryRunId: requireString(event.geometryRunId, 'event.geometryRunId'),
      analysisRunId: requireString(event.analysisRunId, 'event.analysisRunId'),
      rankingBasis:
        'presentation-only lexicographic order; handover validity remains the canonical 3 dB offset and 30 s TTT trace',
      populationContext: {
        validInterHandoverCount: requireNumber(
          atlas.summary.validInterHandoverCount,
          'summary.validInterHandoverCount',
        ),
        forcedContinuityCount: requireNumber(
          atlas.summary.forcedContinuityCount,
          'summary.forcedContinuityCount',
        ),
        validInterHandoversPerPhysicalHour: requireNumber(
          atlas.summary.validInterHandoversPerPhysicalHour,
          'summary.validInterHandoversPerPhysicalHour',
        ),
        validAtLeast45DegCount: requireNumber(
          atlas.summary.validAtLeast45DegCount,
          'summary.validAtLeast45DegCount',
        ),
      },
    },
    window: {
      constellation: requireString(event.constellation, 'event.constellation'),
      requestedT0Utc,
      triggerInstantUtc,
      triggerOffsetSec,
      handoverPolicy: {
        offsetDb: requireNumber(event.handoverPolicy.offsetDb, 'policy.offsetDb'),
        tttSec: requireNumber(event.handoverPolicy.tttSec, 'policy.tttSec'),
        anchorStepSec: requireNumber(event.handoverPolicy.anchorStepSec, 'policy.anchorStepSec'),
      },
      evaluation: {
        evaluationBitsPerJ: requireNumber(
          windowReceipt.evaluation.evaluationBitsPerJ,
          'window.evaluationBitsPerJ',
        ),
        deliveredBits: requireNumber(windowReceipt.evaluation.deliveredBits, 'window.deliveredBits'),
        consumedEnergyJ: requireNumber(windowReceipt.evaluation.consumedEnergyJ, 'window.consumedEnergyJ'),
        durationS: requireNumber(windowReceipt.evaluation.durationS, 'window.durationS'),
        sampleCount: requireNumber(windowReceipt.evaluation.sampleCount, 'window.sampleCount'),
      },
    },
    pair: { from: fromIdentity, to: toIdentity },
    qualification: {
      anchors: qualificationAnchors,
      spanSec: qualificationSpanSec,
      preCommit: {
        servingSatelliteId: requireString(event.preCommit.servingSatelliteId, 'preCommit.serving'),
        candidateSatelliteId: requireString(event.preCommit.candidateSatelliteId, 'preCommit.candidate'),
        servingSinrDb: requireNumber(event.preCommit.servingSinrDb, 'preCommit.servingSinrDb'),
        candidateSinrDb: requireNumber(event.preCommit.candidateSinrDb, 'preCommit.candidateSinrDb'),
        deltaDb: requireNumber(event.preCommit.deltaDb, 'preCommit.deltaDb'),
      },
      postCommit: {
        servingSatelliteId: requireString(event.postCommit.servingSatelliteId, 'postCommit.serving'),
        instantUtc: requireString(event.postCommit.instantUtc, 'postCommit.instantUtc'),
      },
    },
    atlasForecast: {
      note:
        'A 30 s coarse offline forecast. It identifies the window and nothing else — never use these instants as director beat times.',
      stepSec: requireNumber(event.handoverPolicy.anchorStepSec, 'policy.anchorStepSec'),
      samples: (event.anchors as readonly Record<string, any>[]).map(trimAnchor),
    },
    quality: {
      minimumEventElevationDeg: requireNumber(
        event.quality.minimumEventElevationDeg,
        'quality.minimumEventElevationDeg',
      ),
      deltaSinrDynamicRangeDb: requireNumber(
        event.quality.deltaSinrDynamicRangeDb,
        'quality.deltaSinrDynamicRangeDb',
      ),
      candidateResidualVisibilitySec: requireNumber(
        event.quality.candidateResidualVisibilitySec,
        'quality.candidateResidualVisibilitySec',
      ),
      concurrentVisibleSatelliteCount: requireNumber(
        event.quality.concurrentVisibleSatelliteCount,
        'quality.concurrentVisibleSatelliteCount',
      ),
      complete: event.quality.complete === true,
    },
  };
}

const outputPath = resolve(REPO_ROOT, OUTPUT_REL);
const output = `${JSON.stringify(buildFixture(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== output) {
    throw new Error(`Generated six-acts teaching window is stale: ${OUTPUT_REL}`);
  }
  process.stdout.write(
    `Six-acts teaching window is deterministic and current (${Buffer.byteLength(output)} bytes)\n`,
  );
} else {
  writeFileSync(outputPath, output, 'utf8');
  process.stdout.write(`Wrote ${OUTPUT_REL} (${Buffer.byteLength(output)} bytes)\n`);
}
