import { useMemo } from 'react';
import {
  resolveAuthorityPairConeItems,
  resolveCinemaPairConeItems,
  resolvePulseConeItems,
  resolveTriggeredIntraConeItems,
  type AuthorityPairConeInput,
  type CinemaPairConeInput,
  type PulseConeInput,
  type TriggeredIntraConeInput,
} from './handoverConeResolvers';
import { type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';

export interface UseHandoverConeItemsParameters {
  /** Four independent output seams; each input contains only its own policy. */
  readonly pulse: PulseConeInput;
  readonly triggeredIntra: TriggeredIntraConeInput;
  readonly cinemaPair: CinemaPairConeInput;
  readonly authorityPair: AuthorityPairConeInput;
}

export interface UseHandoverConeItemsResult {
  readonly sinrLiveCellPulseConeItems: readonly SinrLiveCellBeamConeRenderItem[];
  readonly triggeredIntraConeItems: readonly SinrLiveCellBeamConeRenderItem[];
  readonly sinrLiveCinemaHandoverPairConeItems: readonly SinrLiveCellBeamConeRenderItem[];
  readonly authorityHandoverPairConeItems: readonly SinrLiveCellBeamConeRenderItem[];
}

/** Thin React facade: one memo and one result for each handover output. */
export function useHandoverConeItems(
  input: UseHandoverConeItemsParameters,
): UseHandoverConeItemsResult {
  const sinrLiveCellPulseConeItems = useMemo(
    () => resolvePulseConeItems(input.pulse),
    [input.pulse],
  );
  const triggeredIntraConeItems = useMemo(
    () => resolveTriggeredIntraConeItems(input.triggeredIntra),
    [input.triggeredIntra],
  );
  const sinrLiveCinemaHandoverPairConeItems = useMemo(
    () => resolveCinemaPairConeItems(input.cinemaPair),
    [input.cinemaPair],
  );
  const authorityHandoverPairConeItems = useMemo(
    () => resolveAuthorityPairConeItems(input.authorityPair),
    [input.authorityPair],
  );
  return {
    sinrLiveCellPulseConeItems,
    triggeredIntraConeItems,
    sinrLiveCinemaHandoverPairConeItems,
    authorityHandoverPairConeItems,
  };
}
