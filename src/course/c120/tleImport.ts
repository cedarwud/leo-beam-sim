import { C120ContractError, type C120TleAnchor } from './contract';

export interface C120PinnedTleImportReceipt {
  readonly fileName: string;
  readonly sourceLabel: string;
  readonly recordSha256: string;
  readonly importedLines: readonly [string, string, string];
}

function normalizedLines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim().split('\n').map(line => line.trimEnd());
}

/**
 * Identity-only import check. It never propagates an orbit or energy formula;
 * the provider remains the sole owner of all scene and evidence values.
 */
export function validateC120PinnedTleImport(
  text: string,
  fileName: string,
  anchor: C120TleAnchor,
): C120PinnedTleImportReceipt {
  if (typeof text !== 'string' || text.trim() === '') throw new C120ContractError('pinned TLE import is empty');
  if (typeof fileName !== 'string' || fileName.trim() === '') throw new C120ContractError('pinned TLE import file name is missing');
  const lines = normalizedLines(text);
  if (lines.length !== 3 || lines.some((line, index) => line !== anchor.lines[index])) {
    throw new C120ContractError('pinned TLE import record does not match this provider scenario');
  }
  return {
    fileName,
    sourceLabel: anchor.sourceLabel,
    recordSha256: anchor.recordSha256,
    importedLines: [lines[0]!, lines[1]!, lines[2]!],
  };
}
