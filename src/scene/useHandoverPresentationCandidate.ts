import { useMemo } from 'react';
import { type HandoverPresentationEvent } from './handoverPresentationOwner';
import { resolveHandoverPresentationCandidate, type HandoverPresentationCandidateInput } from './handoverPresentationCandidate';

export interface UseHandoverPresentationCandidateParameters {
  handoverPresentationCandidateInput: HandoverPresentationCandidateInput;
}

export interface UseHandoverPresentationCandidateResult {
  handoverPresentationCandidate: HandoverPresentationEvent | null;
}

export function useHandoverPresentationCandidate({ handoverPresentationCandidateInput }: UseHandoverPresentationCandidateParameters): UseHandoverPresentationCandidateResult {
  const handoverPresentationCandidate = useMemo(
      () => resolveHandoverPresentationCandidate(handoverPresentationCandidateInput),
      [handoverPresentationCandidateInput],
    );
  return { handoverPresentationCandidate };
}
