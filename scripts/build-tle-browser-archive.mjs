#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CONSTELLATION = 'oneweb';
const CONSTELLATIONS = Object.freeze({
  oneweb: Object.freeze({
    source: resolve(REPO_ROOT, '../tle_data/oneweb/tle'),
    output: resolve(REPO_ROOT, 'public/tle-archive/oneweb'),
    namePattern: /^oneweb_(\d{8})\.tle$/,
  }),
  starlink: Object.freeze({
    source: resolve(REPO_ROOT, '../tle_data/starlink/tle'),
    output: resolve(REPO_ROOT, 'public/tle-archive/starlink'),
    namePattern: /^starlink_(\d{8})\.tle$/,
  }),
});
const MAX_PROPAGATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TLE_LINE_LENGTH = 69;
const SOURCE_EXCLUSIONS = Object.freeze({
  oneweb: Object.freeze([]),
  starlink: Object.freeze([
    Object.freeze({
      fileName: 'starlink_20260528.tle',
      sha256: '20596c4397ee1b9ae0d97ce3003299d47b60fbaa254527d5907bbf8ade3c4c1c',
      reason: 'invalid 70-column TLE line 1 at source line 15197',
    }),
  ]),
});

function parseArgs(argv) {
  const options = {
    constellation: DEFAULT_CONSTELLATION,
    source: null,
    output: null,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') {
      options.check = true;
    } else if (token === '--constellation') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--constellation requires a value');
      options.constellation = value;
    } else if (token.startsWith('--constellation=')) {
      options.constellation = token.slice('--constellation='.length);
      if (!options.constellation) throw new Error('--constellation requires a value');
    } else if (token === '--source') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--source requires a value');
      options.source = resolve(value);
    } else if (token.startsWith('--source=')) {
      const value = token.slice('--source='.length);
      if (!value) throw new Error('--source requires a value');
      options.source = resolve(value);
    } else if (token === '--out') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--out requires a value');
      options.output = resolve(value);
    } else if (token.startsWith('--out=')) {
      const value = token.slice('--out='.length);
      if (!value) throw new Error('--out requires a value');
      options.output = resolve(value);
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  const constellation = CONSTELLATIONS[options.constellation];
  if (!constellation) {
    throw new Error(`unsupported constellation: ${options.constellation} (expected oneweb or starlink)`);
  }
  return {
    ...options,
    source: options.source ?? constellation.source,
    output: options.output ?? constellation.output,
    namePattern: constellation.namePattern,
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertArchiveDate(value, fileName) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`${fileName} contains an invalid archive date`);
  }
}

function tleChecksum(line) {
  let sum = 0;
  for (let index = 0; index < TLE_LINE_LENGTH - 1; index += 1) {
    const character = line[index];
    if (character >= '0' && character <= '9') sum += Number(character);
    else if (character === '-') sum += 1;
  }
  return sum % 10;
}

function validateTleLine(line, prefix, fileName, lineNumber) {
  if (line.length !== TLE_LINE_LENGTH || !line.startsWith(`${prefix} `)) {
    throw new Error(`${fileName}:${lineNumber} is not a valid ${TLE_LINE_LENGTH}-column TLE line ${prefix}`);
  }
  const checkDigit = line.at(-1);
  if (!/^\d$/.test(checkDigit) || tleChecksum(line) !== Number(checkDigit)) {
    throw new Error(`${fileName}:${lineNumber} has an invalid TLE checksum`);
  }
}

function tleEpochUtc(line1, fileName, lineNumber) {
  const match = /^(\d{2})(\d{3}\.\d{8})$/.exec(line1.slice(18, 32));
  if (match === null) throw new Error(`${fileName}:${lineNumber} has an invalid TLE epoch`);
  const shortYear = Number(match[1]);
  const year = shortYear >= 57 ? 1900 + shortYear : 2000 + shortYear;
  const dayOfYear = Number(match[2]);
  if (!Number.isFinite(dayOfYear) || dayOfYear < 1 || dayOfYear >= 367) {
    throw new Error(`${fileName}:${lineNumber} has an out-of-range TLE epoch`);
  }
  return new Date(Date.UTC(year, 0, 1) + Math.round((dayOfYear - 1) * 86_400_000)).toISOString();
}

function validateTleText(text, fileName) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0 || lines.some(line => line.trim() === '') || lines.length % 3 !== 0) {
    throw new Error(`${fileName} is not a complete 3LE snapshot`);
  }
  const identities = new Set();
  const epochs = [];
  for (let index = 0; index < lines.length; index += 3) {
    const name = lines[index].trim();
    const line1 = lines[index + 1];
    const line2 = lines[index + 2];
    if (name === '') throw new Error(`${fileName}:${index + 1} has an empty satellite name`);
    validateTleLine(line1, '1', fileName, index + 2);
    validateTleLine(line2, '2', fileName, index + 3);
    const catalog1 = line1.slice(2, 7);
    const catalog2 = line2.slice(2, 7);
    if (catalog1 !== catalog2) {
      throw new Error(`${fileName}:${index + 2} line identities disagree`);
    }
    if (identities.has(catalog1)) throw new Error(`${fileName} repeats satellite identity ${catalog1}`);
    identities.add(catalog1);
    epochs.push(tleEpochUtc(line1, fileName, index + 2));
  }
  epochs.sort();
  return {
    recordCount: lines.length / 3,
    identityCount: identities.size,
    minEpochUtc: epochs[0],
    maxEpochUtc: epochs.at(-1),
  };
}

async function collectSource({ source, constellation, namePattern }) {
  const names = (await readdir(source))
    .filter(name => namePattern.test(name))
    .sort();
  if (names.length === 0) throw new Error(`no ${constellation} TLE snapshots found in ${source}`);

  const snapshots = [];
  const exclusions = [];
  const expectedExclusions = new Map(SOURCE_EXCLUSIONS[constellation].map(exclusion => [exclusion.fileName, exclusion]));
  for (const fileName of names) {
    const match = namePattern.exec(fileName);
    assertArchiveDate(match[1], fileName);
    const bytes = await readFile(resolve(source, fileName));
    const digest = sha256(bytes);
    const exclusion = expectedExclusions.get(fileName);
    if (exclusion !== undefined) {
      if (digest !== exclusion.sha256) {
        throw new Error(`${fileName} no longer matches its reviewed source exclusion; expected ${exclusion.sha256}, found ${digest}`);
      }
      exclusions.push(exclusion);
      expectedExclusions.delete(fileName);
      continue;
    }
    const validation = validateTleText(bytes.toString('utf8'), fileName);
    snapshots.push({
      archiveDate: match[1],
      path: `/tle-archive/${constellation}/${fileName}`,
      fileName,
      byteLength: bytes.byteLength,
      ...validation,
      sha256: digest,
      bytes,
    });
  }
  if (expectedExclusions.size > 0) {
    throw new Error(`reviewed source exclusions are missing: ${[...expectedExclusions.keys()].join(', ')}`);
  }
  return { snapshots, exclusions, sourceSnapshotCount: names.length };
}

function publicCatalog(snapshots, constellation, exclusions, sourceSnapshotCount) {
  const first = snapshots[0].archiveDate;
  const last = snapshots[snapshots.length - 1].archiveDate;
  const archiveContentSha256 = sha256(Buffer.from([
    ...snapshots.map(snapshot => `${snapshot.fileName}:${snapshot.sha256}`),
    ...exclusions.map(exclusion => `EXCLUDED:${exclusion.fileName}:${exclusion.sha256}:${exclusion.reason}`),
  ].join('\n')));
  return {
    schemaVersion: 'tle-web-archive-v1',
    archiveId: `${constellation}-${first}-${last}-${archiveContentSha256.slice(0, 12)}`,
    archiveContentSha256,
    constellation,
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    firstArchiveDate: first,
    lastArchiveDate: last,
    snapshotCount: snapshots.length,
    ...(exclusions.length === 0 ? {} : {
      sourceSnapshotCount,
      excludedSnapshots: exclusions,
    }),
    maxPropagationAgeMs: MAX_PROPAGATION_AGE_MS,
    snapshots: snapshots.map(({ archiveDate, path, byteLength, recordCount, identityCount, minEpochUtc, maxEpochUtc, sha256: digest }) => ({
      archiveDate,
      path,
      byteLength,
      recordCount,
      identityCount,
      minEpochUtc,
      maxEpochUtc,
      sha256: digest,
    })),
  };
}

async function verifyOutput(output, snapshots, catalog, namePattern) {
  const expectedCatalog = `${JSON.stringify(catalog, null, 2)}\n`;
  const catalogPath = resolve(output, 'catalog.json');
  const catalogStat = await stat(catalogPath);
  if ((catalogStat.mode & 0o777) !== 0o644) throw new Error('catalog.json must have mode 0644');
  const actualCatalog = await readFile(catalogPath, 'utf8');
  if (actualCatalog !== expectedCatalog) throw new Error('catalog.json is stale');

  const outputNames = (await readdir(output)).filter(name => namePattern.test(name)).sort();
  const expectedNames = snapshots.map(snapshot => snapshot.fileName);
  if (JSON.stringify(outputNames) !== JSON.stringify(expectedNames)) {
    throw new Error('browser archive file set does not match the source archive');
  }
  for (const snapshot of snapshots) {
    const outputPath = resolve(output, snapshot.fileName);
    const outputStat = await stat(outputPath);
    if ((outputStat.mode & 0o777) !== 0o644) throw new Error(`${snapshot.fileName} must have mode 0644`);
    if (outputStat.size !== snapshot.byteLength) throw new Error(`${snapshot.fileName} byte length drift`);
    const outputBytes = await readFile(outputPath);
    if (sha256(outputBytes) !== snapshot.sha256) throw new Error(`${snapshot.fileName} content drift`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { snapshots, exclusions, sourceSnapshotCount } = await collectSource(options);
  const catalog = publicCatalog(snapshots, options.constellation, exclusions, sourceSnapshotCount);

  if (options.check) {
    await verifyOutput(options.output, snapshots, catalog, options.namePattern);
    console.log(`TLE browser archive verified: ${snapshots.length}/${sourceSnapshotCount} snapshots (${exclusions.length} excluded)`);
    return;
  }

  await mkdir(options.output, { recursive: true });
  for (const snapshot of snapshots) {
    const outputPath = resolve(options.output, snapshot.fileName);
    await copyFile(resolve(options.source, snapshot.fileName), outputPath);
    await chmod(outputPath, 0o644);
  }
  const catalogPath = resolve(options.output, 'catalog.json');
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await chmod(catalogPath, 0o644);
  await verifyOutput(options.output, snapshots, catalog, options.namePattern);
  console.log(`TLE browser archive built: ${snapshots.length}/${sourceSnapshotCount} snapshots (${exclusions.length} excluded; ${catalog.firstArchiveDate}..${catalog.lastArchiveDate})`);
}

await main();
