import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseTleSnapshotText,
  parseTleWebArchiveCatalog,
} from '../src/simulator/archive';
import type { SimulatorConstellation } from '../src/simulator/types';
import {
  buildVisualLabGlobalConstellationArtifact,
  VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE,
  VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC,
  type VisualLabGlobalConstellationArtifact,
} from '../src/visualLab/globalConstellation/visualLabGlobalConstellationArtifact';
import { parseUtcInstant } from '../src/tle/time';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const constellations: readonly SimulatorConstellation[] = ['oneweb', 'starlink'];

function usage(): never {
  throw new Error('usage: node --import tsx/esm scripts/generate-visual-lab-global-first-frame.ts [--check] [--constellation oneweb|starlink]');
}

function parseArguments(): { readonly check: boolean; readonly constellations: readonly SimulatorConstellation[] } {
  let check = false;
  let selected: SimulatorConstellation | null = null;
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === '--check') {
      check = true;
      continue;
    }
    if (argument === '--constellation') {
      const value = process.argv[++index];
      if (value !== 'oneweb' && value !== 'starlink') usage();
      selected = value;
      continue;
    }
    if (argument === '--help' || argument === '-h') usage();
    usage();
  }
  return { check, constellations: selected === null ? constellations : [selected] };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sourcePathFor(constellation: SimulatorConstellation): string {
  return `/tle-archive/${constellation}/${constellation}_${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE}.tle`;
}

async function sourceArtifact(
  constellation: SimulatorConstellation,
): Promise<{ readonly artifact: VisualLabGlobalConstellationArtifact; readonly outputPath: string }> {
  const catalogPath = join(repoRoot, 'public', 'tle-archive', constellation, 'catalog.json');
  const catalogRaw = JSON.parse(await readFile(catalogPath, 'utf8')) as unknown;
  const catalog = parseTleWebArchiveCatalog(catalogRaw);
  const metadata = catalog.snapshots.find(
    snapshot => snapshot.archiveDate === VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE,
  );
  if (metadata === undefined) {
    throw new Error(`${constellation} catalog has no ${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE} publication`);
  }
  const expectedPath = sourcePathFor(constellation);
  if (metadata.path !== expectedPath) {
    throw new Error(`${constellation} catalog publication path drifted: ${metadata.path}`);
  }

  const sourceFilePath = join(repoRoot, 'public', metadata.path.replace(/^\//, ''));
  const sourceBytes = new Uint8Array(await readFile(sourceFilePath));
  const sourceSha256 = sha256(sourceBytes);
  if (sourceBytes.byteLength !== metadata.byteLength) {
    throw new Error(`${metadata.path} byteLength drifted: expected ${metadata.byteLength}, got ${sourceBytes.byteLength}`);
  }
  if (sourceSha256 !== metadata.sha256) {
    throw new Error(`${metadata.path} SHA-256 drifted: expected ${metadata.sha256}, got ${sourceSha256}`);
  }
  const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes);
  const entries = parseTleSnapshotText(sourceText, metadata);
  if (entries.length !== metadata.recordCount || entries.some(entry => entry.sourcePath !== expectedPath)) {
    throw new Error(`${metadata.path} did not produce one identity-bound entry per catalog record`);
  }

  const requestedMs = parseUtcInstant(VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC, 'instantUtc').ms;
  const admittedEntries = entries.filter(entry => {
    const epochMs = parseUtcInstant(entry.epochUtc, `${entry.satelliteId}.epochUtc`).ms;
    return epochMs <= requestedMs && epochMs >= requestedMs - catalog.maxPropagationAgeMs;
  });
  if (admittedEntries.length === 0) throw new Error(`${metadata.path} has no TLE records admitted at the default instant`);

  const artifact = buildVisualLabGlobalConstellationArtifact(admittedEntries, {
    constellation,
    snapshotPath: expectedPath,
    snapshotSha256: sourceSha256,
    instantUtc: VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC,
    maxPropagationAgeMs: catalog.maxPropagationAgeMs,
  });
  if (artifact.satelliteCount !== admittedEntries.length) {
    throw new Error(`${metadata.path} artifact count drifted: expected ${admittedEntries.length}, got ${artifact.satelliteCount}`);
  }
  const outputPath = join(repoRoot, 'public', 'global-first-frame', `${constellation}-${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATE}.json`);
  return { artifact, outputPath };
}

async function materialize(
  artifact: VisualLabGlobalConstellationArtifact,
  outputPath: string,
  check: boolean,
): Promise<void> {
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  let existing: string | null = null;
  try {
    existing = await readFile(outputPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (check) {
    if (existing !== serialized) {
      throw new Error(`global first-frame artifact is stale or missing: ${relative(repoRoot, outputPath)}`);
    }
    return;
  }
  if (existing === serialized) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, 'utf8');
}

const { check, constellations: requestedConstellations } = parseArguments();
for (const constellation of requestedConstellations) {
  const { artifact, outputPath } = await sourceArtifact(constellation);
  await materialize(artifact, outputPath, check);
  console.log(`${check ? 'checked' : 'generated'} ${relative(repoRoot, outputPath)}: ${artifact.satelliteCount} admitted satellites, ${artifact.ntpuVisibleSatelliteCount} visible from NTPU, median altitude ${artifact.medianAltitudeKm} km`);
}
