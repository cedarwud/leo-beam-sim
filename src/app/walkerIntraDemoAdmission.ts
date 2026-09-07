export interface WalkerIntraDemoAdmissionInput {
  readonly presentation: {
    readonly servingSinrDb: number;
    readonly candidateSinrDb: number;
  } | null | undefined;
  readonly manualHandoverActive: boolean;
  readonly visibleHandoverActive: boolean;
  readonly handoverBusy: boolean;
}

/**
 * Decide whether the display-only intra-demo cue may be admitted.  The caller
 * still owns refs, playback, request identity, and state publication.
 */
export function canRequestWalkerIntraDemo(
  input: WalkerIntraDemoAdmissionInput,
): boolean {
  const { presentation } = input;
  return presentation !== null
    && presentation !== undefined
    && !input.manualHandoverActive
    && !input.visibleHandoverActive
    && !input.handoverBusy
    && Number.isFinite(presentation.servingSinrDb)
    && Number.isFinite(presentation.candidateSinrDb);
}
