export type HandoverToastCopyKind = 'intra' | 'inter' | null;
export type HandoverToastCopyPhase =
  | 'serving'
  | 'measuring'
  | 'holding'
  | 'releasing'
  | 'settled'
  | null;

export interface HandoverToastCopy {
  readonly eventLabel?: string;
  readonly eventReason?: string;
}

export interface HandoverToastCopyInput {
  readonly homepageVisualIdentity: boolean;
  readonly presentationActive: boolean;
  readonly presentationKind: HandoverToastCopyKind;
  readonly presentationPhase: HandoverToastCopyPhase;
  readonly authorityPresentationCommitObserved: boolean;
  readonly forcedContinuity: boolean;
  readonly forcedContinuityReason?: string;
}

export function resolveHandoverToastCopy(
  input: HandoverToastCopyInput,
): HandoverToastCopy {
  const hasPresentationEvent = input.presentationActive && input.presentationKind !== null;
  const eventLabel = hasPresentationEvent
    ? input.presentationKind === 'intra'
      ? '同衛星波束換手'
      : '跨衛星換手'
    : input.forcedContinuity
      ? 'Forced continuity'
      : undefined;

  const eventReason = input.homepageVisualIdentity
    ? undefined
    : hasPresentationEvent
      ? input.authorityPresentationCommitObserved
        ? input.presentationPhase === 'settled'
          ? '新服務鏈路已接手；舊鏈路已釋放'
          : '換手已提交；畫面正在呈現舊鏈路退出與新鏈路接手'
        : input.presentationPhase === 'holding'
          ? '候選已通過門檻與 TTT；現行鏈路維持至提交'
          : input.presentationPhase === 'releasing' || input.presentationPhase === 'settled'
            ? '換手尚未提交；現行服務鏈路保持不中斷'
            : '候選鏈路正在量測；現行服務保持不中斷'
      : input.forcedContinuity
        ? input.forcedContinuityReason
        : undefined;

  return { eventLabel, eventReason };
}
