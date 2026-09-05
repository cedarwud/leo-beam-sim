/**
 * A ledger of handover commits that ACTUALLY executed.
 *
 * `scripts/check-handover.ts` asserts that every declared HandoverCommitPath is
 * observed by some scenario. A cross-family review showed that gate could be
 * satisfied without the route running at all: a scenario that pushes a record
 * carrying a commitPath satisfies coverage even when the production path is
 * unreachable. The oracle was reading what the scenario said, not what the
 * engines did.
 *
 * Entries here are appended by the production commit sites themselves, after
 * the commit has taken effect -- after `eventLog.push` and the serving-state
 * mutation in HandoverManager, and after the accepted assignment transaction in
 * SinrLiveCellModel. A proposed receipt that never commits appends nothing.
 *
 * Scenario code must never append. It may read, cursor and reset.
 *
 * Honest limit: this is white-box reachability evidence, not proof against
 * someone who edits a production route and its instrumentation together. What
 * it does close is the gap where the oracle's own scenarios were the only
 * witnesses to their own claims.
 */

import type { CandidateLinkKey } from './candidateDecisionContract';
import type { HandoverCommitPath } from './commitProvenance';

export interface HandoverCommitExecution {
  readonly engine: 'handover-manager' | 'sinr-live-cell-model';
  readonly path: HandoverCommitPath;
  readonly action: 'inter-handover' | 'intra-switch';
  readonly simTimeMs: number;
  readonly sourceFrameId: string | null;
  readonly from: CandidateLinkKey | null;
  readonly to: CandidateLinkKey;
}

const ledger: HandoverCommitExecution[] = [];

/**
 * Append-only, and called only from a production commit site after the commit
 * has taken effect. Exported because the two engines live in different modules;
 * it is not part of any public API and nothing in `scripts/` may call it.
 */
export function recordHandoverCommitExecution(execution: HandoverCommitExecution): void {
  ledger.push(Object.freeze({ ...execution }));
}

/** Everything recorded so far, oldest first. */
export function handoverCommitExecutions(): readonly HandoverCommitExecution[] {
  return ledger.slice();
}

/** Entries appended since `cursor`, for a scenario to match against its own receipt. */
export function handoverCommitExecutionsSince(cursor: number): readonly HandoverCommitExecution[] {
  return ledger.slice(Math.max(0, cursor));
}

/** How many entries exist, for use as a cursor before driving an engine. */
export function handoverCommitExecutionCursor(): number {
  return ledger.length;
}

/** Only for a check run that wants a clean ledger before it starts. */
export function resetHandoverCommitExecutions(): void {
  ledger.length = 0;
}
