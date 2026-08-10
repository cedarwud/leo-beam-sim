import type { C120WorkbookStatus } from './contract';

export interface C120InitialWorkbookStatusInput {
  readonly recovered: boolean;
  readonly status: C120WorkbookStatus;
  readonly completedSegmentCount: number;
}

export function initialC120WorkbookStatus(input: C120InitialWorkbookStatusInput): string {
  if (!input.recovered) return 'No workbook export yet.';
  if (!Number.isInteger(input.completedSegmentCount)
    || input.completedSegmentCount < 0
    || input.completedSegmentCount > 8) {
    throw new Error('C-120 recovered segment count must be an integer from 0 to 8');
  }
  return `LOCAL SESSION RECOVERED · ${input.status} · ${input.completedSegmentCount}/8 segments · export available`;
}
