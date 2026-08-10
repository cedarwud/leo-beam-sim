import type { TleSource } from './contract';

export class TleImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TleImportError';
  }
}

interface ImportedTleRecord {
  readonly line0: string;
  readonly line1: string;
  readonly line2: string;
}

function checksumIsValid(line: string): boolean {
  if (line.length < 69 || !/\d/.test(line[68] ?? '')) return false;
  let checksum = 0;
  for (const character of line.slice(0, 68)) {
    if (/\d/.test(character)) checksum += Number(character);
    if (character === '-') checksum += 1;
  }
  return checksum % 10 === Number(line[68]);
}

export function parseImportedTle(text: string): readonly ImportedTleRecord[] {
  const lines = text.split(/\r?\n/).map(line => line.trimEnd()).filter(line => line.trim() !== '');
  const records: ImportedTleRecord[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line1 = lines[index];
    if (!line1.startsWith('1 ')) continue;
    const line2 = lines[index + 1];
    if (line2 === undefined || !line2.startsWith('2 ')) {
      throw new TleImportError(`line ${index + 1} has no adjacent TLE line 2`);
    }
    if (!checksumIsValid(line1) || !checksumIsValid(line2)) {
      throw new TleImportError(`record at line ${index + 1} has an invalid TLE checksum`);
    }
    if (line1.slice(2, 7) !== line2.slice(2, 7)) {
      throw new TleImportError(`record at line ${index + 1} has mismatched catalog identity`);
    }
    const possibleName = lines[index - 1];
    records.push({
      line0: possibleName !== undefined && !possibleName.startsWith('1 ') && !possibleName.startsWith('2 ') ? possibleName.trim() : '',
      line1,
      line2,
    });
    index += 1;
  }
  if (records.length === 0) throw new TleImportError('file contains no checksum-valid 2LE/3LE record');
  return records;
}

export interface TleImportMatch {
  readonly source: TleSource;
  readonly importedRecordCount: number;
}

/**
 * Phase 1 can render an import immediately only when its exact two-line record
 * already has a precomputed provider bundle. Unknown records fail closed.
 */
export function matchImportedTle(text: string, sources: readonly TleSource[]): TleImportMatch {
  const records = parseImportedTle(text);
  for (const record of records) {
    const source = sources.find(candidate => candidate.line1 === record.line1 && candidate.line2 === record.line2);
    if (source !== undefined) return { source, importedRecordCount: records.length };
  }
  throw new TleImportError('TLE is valid, but no exact precomputed trajectory bundle exists; run the backstage generator before rendering');
}
