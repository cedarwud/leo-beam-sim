#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as satellite from 'satellite.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const requestedTleDataRoot = optionValue('--tle-data-root');
const TLE_DATA_ROOT = requestedTleDataRoot === undefined
  ? resolve(REPO_ROOT, '../tle_data')
  : resolve(requestedTleDataRoot);
const requestedArchiveQuery = optionValue('--archive-query');
const ARCHIVE_QUERY = requestedArchiveQuery === undefined
  ? resolve(SCRIPT_DIR, 'tle_archive_query.py')
  : resolve(requestedArchiveQuery);
const OUTPUT_PATH = resolve(REPO_ROOT, 'src/course/fixtures/c90-tle-study.generated.json');

const DEFAULT_TARGET_UTC = '2026-08-09T06:30:00.000Z';
const NORAD_CATALOG_ID = 49100;
const PRODUCER_VERSION = 'c90-sgp4-geometry-v1';
const STUDY_VERSION = 'c90-tle-study-v1';

const requestedTarget = optionValue('--target') ?? DEFAULT_TARGET_UTC;
if (!requestedTarget.endsWith('Z') || !Number.isFinite(Date.parse(requestedTarget))) {
  throw new Error('--target must be a parseable UTC timestamp ending in Z');
}
const TARGET_UTC = new Date(requestedTarget).toISOString();

const SOURCE_SPECS = Object.freeze([
  {
    archiveDate: '20250727',
    label: '約一年前的 archived TLE',
    shortLabel: '舊資料',
    role: 'teaching-comparison',
  },
  {
    archiveDate: '20260209',
    label: '約半年前的 archived TLE',
    shortLabel: '中期資料',
    role: 'teaching-comparison',
  },
  {
    archiveDate: '20260808',
    label: '課程指定的 recent archived TLE',
    shortLabel: '課程資料',
    role: 'course-compatible',
  },
]);

const WINDOWS = Object.freeze([
  {
    windowId: 'course-10m',
    label: '10 分鐘課堂觀察',
    description: '從 target UTC 起，每 1 秒一個 producer frame；可與 E1/E2/IoT fixture clock 精確對齊。',
    startOffsetSec: 0,
    durationSec: 600,
    stepSec: 1,
  },
  {
    windowId: 'context-30m',
    label: '30 分鐘 pass context',
    description: '從 target UTC 起，每 30 秒一個 producer frame。',
    startOffsetSec: 0,
    durationSec: 1800,
    stepSec: 30,
  },
  {
    windowId: 'context-90m',
    label: '90 分鐘 orbit context',
    description: '從 target UTC 起，每 60 秒一個 producer frame。',
    startOffsetSec: 0,
    durationSec: 5400,
    stepSec: 60,
  },
]);

const OBSERVER = Object.freeze({
  observerId: 'ntpu-sanxia-course-observer-v1',
  label: 'NTPU Sanxia course observer',
  latitudeDeg: 24.944,
  longitudeDeg: 121.371,
  heightKm: 0.05,
  provenance: 'COURSE-ASSUMPTION',
  note: 'Course-owned approximate Sanxia campus point; not a surveyed antenna coordinate.',
});

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isoAtOffset(baseUtc, offsetSec) {
  return new Date(Date.parse(baseUtc) + offsetSec * 1000).toISOString();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readSourcePacket(spec) {
  const stdout = execFileSync(
    'python3',
    [
      ARCHIVE_QUERY,
      '--root',
      TLE_DATA_ROOT,
      'source',
      '--constellation',
      'oneweb',
      '--date',
      spec.archiveDate,
      '--norad',
      String(NORAD_CATALOG_ID),
    ],
    { encoding: 'utf8' },
  );
  const packet = JSON.parse(stdout);
  return {
    ...packet,
    filename: packet.archivePath.split('/').at(-1),
    label: spec.label,
    shortLabel: `${spec.shortLabel} · ${packet.archiveDate.slice(0, 4)}-${packet.archiveDate.slice(4, 6)}-${packet.archiveDate.slice(6, 8)}`,
    role: spec.role,
    note: `${packet.note}; deterministic offline course source, not live telemetry.`,
  };
}

function vector(value, label) {
  if (value === false || value === undefined) {
    throw new Error(`SGP4 producer returned no ${label}`);
  }
  return value;
}

function scenePosition(azimuthRad, elevationRad) {
  const radius = 720;
  const horizontal = Math.cos(elevationRad) * radius;
  return [
    round(Math.sin(azimuthRad) * horizontal, 3),
    round(60 + Math.sin(elevationRad) * radius, 3),
    round(-Math.cos(azimuthRad) * horizontal, 3),
  ];
}

function propagate(source, targetUtc) {
  const satrec = satellite.twoline2satrec(source.line1, source.line2);
  if (satrec.error !== 0) {
    throw new Error(`SGP4 initialization failed for ${source.sourceId}: ${satrec.error}`);
  }
  const instant = new Date(targetUtc);
  const state = satellite.propagate(satrec, instant);
  const positionEci = vector(state.position, 'TEME position');
  const velocityEci = vector(state.velocity, 'TEME velocity');
  const gmst = satellite.gstime(instant);
  const positionEcf = satellite.eciToEcf(positionEci, gmst);
  const geodetic = satellite.eciToGeodetic(positionEci, gmst);
  const look = satellite.ecfToLookAngles({
    latitude: satellite.degreesToRadians(OBSERVER.latitudeDeg),
    longitude: satellite.degreesToRadians(OBSERVER.longitudeDeg),
    height: OBSERVER.heightKm,
  }, positionEcf);
  const elevationDeg = satellite.radiansToDegrees(look.elevation);
  const azimuthDeg = satellite.radiansToDegrees(look.azimuth);
  return {
    temePositionKm: [round(positionEci.x), round(positionEci.y), round(positionEci.z)],
    temeVelocityKmPerSec: [round(velocityEci.x), round(velocityEci.y), round(velocityEci.z)],
    geodetic: {
      latitudeDeg: round(satellite.degreesLat(geodetic.latitude)),
      longitudeDeg: round(satellite.degreesLong(geodetic.longitude)),
      altitudeKm: round(geodetic.height),
    },
    look: {
      azimuthDeg: round(azimuthDeg),
      elevationDeg: round(elevationDeg),
      rangeKm: round(look.rangeSat),
      visible: elevationDeg >= 0,
    },
    scene: {
      satellitePosition: scenePosition(look.azimuth, look.elevation),
      observerPosition: [0, 8, 0],
    },
  };
}

function distanceKm(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2
      + (a[1] - b[1]) ** 2
      + (a[2] - b[2]) ** 2,
  );
}

function buildStudy() {
  const sources = SOURCE_SPECS.map(readSourcePacket);
  const courseSource = sources.find(source => source.role === 'course-compatible');
  if (courseSource === undefined) throw new Error('No course-compatible TLE source configured');
  if (Date.parse(courseSource.epochUtc) > Date.parse(TARGET_UTC)) {
    throw new Error(`Course source epoch ${courseSource.epochUtc} is after target ${TARGET_UTC}; choose a later --target to avoid future-data leakage`);
  }
  const windows = WINDOWS.map(window => ({
    ...window,
    targetUtc: TARGET_UTC,
    startUtc: isoAtOffset(TARGET_UTC, window.startOffsetSec),
    endUtc: isoAtOffset(TARGET_UTC, window.startOffsetSec + window.durationSec),
    frameCount: Math.floor(window.durationSec / window.stepSec) + 1,
  }));

  const bundles = [];
  for (const source of sources) {
    for (const window of windows) {
      const frames = [];
      for (let frameIndex = 0; frameIndex < window.frameCount; frameIndex += 1) {
        const elapsedSec = window.startOffsetSec + frameIndex * window.stepSec;
        const targetUtc = isoAtOffset(TARGET_UTC, elapsedSec);
        const propagated = propagate(source, targetUtc);
        const courseReference = propagate(courseSource, targetUtc);
        frames.push({
          frameId: `tle-${source.archiveDate}-${window.windowId}-${String(frameIndex).padStart(3, '0')}`,
          frameIndex,
          elapsedSec,
          targetUtc,
          ageSeconds: Math.round((Date.parse(targetUtc) - Date.parse(source.epochUtc)) / 1000),
          modelDeltaFromCourseSourceKm: round(distanceKm(propagated.temePositionKm, courseReference.temePositionKm), 3),
          ...propagated,
        });
      }
      const bundleIdentity = [
        source.recordSha256,
        OBSERVER.observerId,
        window.startUtc,
        window.endUtc,
        String(window.stepSec),
        PRODUCER_VERSION,
      ].join('|');
      bundles.push({
        schemaVersion: 'tle-trajectory-bundle-v1',
        producerVersion: PRODUCER_VERSION,
        model: 'SGP4 via satellite.js 6.0.2',
        bundleId: `c90-${source.archiveDate}-${window.windowId}-${sha256(bundleIdentity).slice(0, 12)}`,
        sourceId: source.sourceId,
        sourceRecordSha256: source.recordSha256,
        observerId: OBSERVER.observerId,
        windowId: window.windowId,
        startUtc: window.startUtc,
        endUtc: window.endUtc,
        stepSec: window.stepSec,
        frames,
      });
    }
  }

  return {
    schemaVersion: STUDY_VERSION,
    targetUtc: TARGET_UTC,
    defaultSourceId: courseSource.sourceId,
    courseSourceId: courseSource.sourceId,
    defaultWindowId: 'course-10m',
    observer: OBSERVER,
    sources,
    windows,
    bundles,
    externalSources: [
      {
        sourceId: 'celestrak',
        label: 'CelesTrak GP data',
        url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle',
        accessNote: 'OneWeb group TLE; provider caching/rate policy applies.',
      },
      {
        sourceId: 'space-track',
        label: 'Space-Track.org',
        url: 'https://www.space-track.org/',
        accessNote: 'Authoritative catalog access; account and API limits apply.',
      },
      {
        sourceId: 'satnogs',
        label: 'SatNOGS DB API',
        url: 'https://db.satnogs.org/api/',
        accessNote: 'Community satellite database/API; inspect provenance before use.',
      },
      {
        sourceId: 'amsat',
        label: 'AMSAT current elements',
        url: 'https://www.amsat.org/tle/current/',
        accessNote: 'Current amateur-satellite element sets; not a OneWeb archive replacement.',
      },
    ],
    archiveCatalogCommand: 'python3 scripts/tle_archive_query.py --root /absolute/path/to/tle_data catalog --constellation oneweb',
    updateCommand: 'Run the external archive repository updater separately; never fetch during class.',
    generationCommand: `npm run generate:c90:tle-study -- --tle-data-root /absolute/path/to/tle_data --target ${TARGET_UTC}`,
    boundary: 'Precomputed model output for simulated teaching; not measured truth and not a live backend.',
  };
}

const output = `${JSON.stringify(buildStudy(), null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = readFileSync(OUTPUT_PATH, 'utf8');
  if (current !== output) {
    throw new Error(`Generated TLE study is stale: ${OUTPUT_PATH}`);
  }
  process.stdout.write(`C-90 TLE study is deterministic and current (${Buffer.byteLength(output)} bytes)\n`);
} else {
  writeFileSync(OUTPUT_PATH, output, 'utf8');
  process.stdout.write(`Wrote ${OUTPUT_PATH} (${Buffer.byteLength(output)} bytes)\n`);
}
