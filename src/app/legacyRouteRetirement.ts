export const RETIRED_INTRA_HANDOVER_TEACHING_PATH =
  '/prototype/intra-handover-teaching' as const;
export const CANONICAL_HANDOVER_TEACHING_PATH = '/' as const;
export const RETIRED_SURFACE_QUERY_KEY = 'retiredSurface' as const;
export const RETIRED_INTRA_HANDOVER_SURFACE_ID =
  'intra-handover-teaching' as const;

/**
 * Preserve old bookmarks without mounting the retired private SVG renderer.
 * The returned URL stays same-origin and points to the canonical R5/R6 shell.
 */
export function resolveLegacyRouteRetirement(
  pathname: string,
  search: string,
  hash: string,
): string | null {
  if (pathname !== RETIRED_INTRA_HANDOVER_TEACHING_PATH) return null;
  const params = new URLSearchParams(search);
  params.set(RETIRED_SURFACE_QUERY_KEY, RETIRED_INTRA_HANDOVER_SURFACE_ID);
  const query = params.toString();
  return `${CANONICAL_HANDOVER_TEACHING_PATH}${query.length > 0 ? `?${query}` : ''}${hash}`;
}
