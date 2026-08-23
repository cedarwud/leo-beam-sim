import type { SixActsFrameFacts } from './liveReplayBridge';

export interface SixActsProvenanceBadgeModel {
  readonly provenance: 'focused-link-projection';
  readonly canonicalErrorCode: string | null;
  readonly message: string;
}

/**
 * Resolves the classroom provenance disclosure without coupling the decision
 * to React or the scene stylesheet. Canonical aggregate output is deliberately
 * silent; only the focused-link fallback earns a disclosure badge.
 */
export function resolveSixActsProvenanceBadge(
  facts: Pick<SixActsFrameFacts, 'provenance' | 'provenanceErrorCode'>,
): SixActsProvenanceBadgeModel | null {
  if (facts.provenance !== 'focused-link-projection') return null;
  return Object.freeze({
    provenance: 'focused-link-projection' as const,
    canonicalErrorCode: facts.provenanceErrorCode,
    message: 'canonical 聚合不可用；目前顯示單一鏈路投影（非全系統聚合）',
  });
}
