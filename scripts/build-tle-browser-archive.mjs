#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_SOURCE = resolve(REPO_ROOT, '../tle_data/oneweb/tle');
const DEFAULT_OUTPUT = resolve(REPO_ROOT, 'public/tle-archive/oneweb');
const NAME_PATTERN = /^oneweb_(\d{8})\.tle$/;
const MAX_PROPAGATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TLE_LINE_LENGTH = 69;

function parseArgs(argv) {
  const options = { source: DEFAULT_SOURCE, output: DEFAULT_OUTPUT, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') {
      options.check = true;
    } else if (token === '--source') {
      options.source = resolve(argv[++index] ?? '');
    } else if (token === '--out') {
      options.output = resolve(argv[++index] ?? '');
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  return options;
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

async function collectSource(source) {
  const names = (await readdir(source))
    .filter(name => NAME_PATTERN.test(name))
    .sort();
  if (names.length === 0) throw new Error(`no OneWeb TLE snapshots found in ${source}`);

  const snapshots = [];
  for (const fileName of names) {
    const match = NAME_PATTERN.exec(fileName);
    assertArchiveDate(match[1], fileName);
    const bytes = await readFile(resolve(source, fileName));
    const validation = validateTleText(bytes.toString('utf8'), fileName);
    snapshots.push({
      archiveDate: match[1],
      path: `/tle-archive/oneweb/${fileName}`,
      fileName,
      byteLength: bytes.byteLength,
      ...validation,
      sha256: sha256(bytes),
      bytes,
    });
  }
  return snapshots;
}

function publicCatalog(snapshots) {
  const first = snapshots[0].archiveDate;
  const last = snapshots[snapshots.length - 1].archiveDate;
  const archiveContentSha256 = sha256(Buffer.from(snapshots.map(snapshot => `${snapshot.fileName}:${snapshot.sha256}`).join('\n')));
  return {
    schemaVersion: 'tle-web-archive-v1',
    archiveId: `oneweb-${first}-${last}-${archiveContentSha256.slice(0, 12)}`,
    archiveContentSha256,
    constellation: 'oneweb',
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    firstArchiveDate: first,
    lastArchiveDate: last,
    snapshotCount: snapshots.length,
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

async function verifyOutput(output, snapshots, catalog) {
  const expectedCatalog = `${JSON.stringify(catalog, null, 2)}\n`;
  const actualCatalog = await readFile(resolve(output, 'catalog.json'), 'utf8');
  if (actualCatalog !== expectedCatalog) throw new Error('catalog.json is stale');

  const outputNames = (await readdir(output)).filter(name => NAME_PATTERN.test(name)).sort();
  const expectedNames = snapshots.map(snapshot => snapshot.fileName);
  if (JSON.stringify(outputNames) !== JSON.stringify(expectedNames)) {
    throw new Error('browser archive file set does not match the source archive');
  }
  for (const snapshot of snapshots) {
    const outputPath = resolve(output, snapshot.fileName);
    const outputStat = await stat(outputPath);
    if (outputStat.size !== snapshot.byteLength) throw new Error(`${snapshot.fileName} byte length drift`);
    const outputBytes = await readFile(outputPath);
    if (sha256(outputBytes) !== snapshot.sha256) throw new Error(`${snapshot.fileName} content drift`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshots = await collectSource(options.source);
  const catalog = publicCatalog(snapshots);

  if (options.check) {
    await verifyOutput(options.output, snapshots, catalog);
    console.log(`TLE browser archive verified: ${snapshots.length} snapshots`);
    return;
  }

  await mkdir(options.output, { recursive: true });
  for (const snapshot of snapshots) {
    const outputPath = resolve(options.output, snapshot.fileName);
    await copyFile(resolve(options.source, snapshot.fileName), outputPath);
    await chmod(outputPath, 0o644);
  }
  await writeFile(resolve(options.output, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await verifyOutput(options.output, snapshots, catalog);
  console.log(`TLE browser archive built: ${snapshots.length} snapshots (${catalog.firstArchiveDate}..${catalog.lastArchiveDate})`);
}

await main();
