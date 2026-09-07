export interface HomepageIntraCellAnchorCandidate {
  readonly kind: 'intra' | 'inter';
  readonly fromCellId: number | null;
}

export interface HomepageIntraPresentationCandidate {
  readonly kind: 'intra' | 'inter';
  readonly from: { readonly cellId: number };
}

export interface HomepageIntraCellAnchorPlacement {
  readonly worldX: number;
  readonly worldZ: number;
}

export interface HomepageIntraCellAnchorWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HomepageIntraCellAnchorInput {
  readonly presentedHandoverPairCandidate?: HomepageIntraCellAnchorCandidate | null;
  readonly handoverPresentationCandidate?: HomepageIntraPresentationCandidate | null;
  readonly recentPrimaryHandoverEvent?: HomepageIntraCellAnchorCandidate | null;
  readonly manualHandoverEvent?: HomepageIntraCellAnchorCandidate | null;
  readonly displayHeroCellId?: number | null;
  readonly placementByCellId: ReadonlyMap<number, HomepageIntraCellAnchorPlacement>;
  readonly fallback: HomepageIntraCellAnchorWorldPoint;
}

/** Resolve the shared geographic anchor for an intra-satellite presentation. */
export function resolveHomepageIntraCellAnchor(
  input: HomepageIntraCellAnchorInput,
): HomepageIntraCellAnchorWorldPoint {
  let sourceCellId: number | null = input.displayHeroCellId ?? null;
  if (input.presentedHandoverPairCandidate?.kind === 'intra') {
    sourceCellId = input.presentedHandoverPairCandidate.fromCellId;
  } else if (input.handoverPresentationCandidate?.kind === 'intra') {
    sourceCellId = input.handoverPresentationCandidate.from.cellId;
  } else if (input.recentPrimaryHandoverEvent?.kind === 'intra') {
    sourceCellId = input.recentPrimaryHandoverEvent.fromCellId;
  } else if (input.manualHandoverEvent?.kind === 'intra') {
    sourceCellId = input.manualHandoverEvent.fromCellId;
  }

  const placement = sourceCellId === null
    ? undefined
    : input.placementByCellId.get(sourceCellId);
  return placement === undefined
    ? input.fallback
    : Object.freeze({ x: placement.worldX, y: 0, z: placement.worldZ });
}
