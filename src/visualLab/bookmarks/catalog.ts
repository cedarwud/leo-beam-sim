import rawArtifact from '../../../public/homepage-first-frame/visual-lab-bookmarks.json';

import { parseVisualLabBookmarksArtifact } from './visualLabBookmarks';
import type {
  VisualLabBookmark,
  VisualLabBookmarkConstellation,
  VisualLabBookmarksArtifact,
} from './types';

/**
 * Checked-in, source-measured bookmark catalog used by the route.
 *
 * Parsing happens at the module boundary so malformed provenance cannot turn
 * into an interactive preset. The generated artifact is deterministic and is
 * rechecked by its generator test.
 */
export const VISUAL_LAB_BOOKMARK_CATALOG: VisualLabBookmarksArtifact =
  parseVisualLabBookmarksArtifact(rawArtifact);

export function visualLabBookmarksForConstellation(
  constellation: VisualLabBookmarkConstellation,
): readonly VisualLabBookmark[] {
  return VISUAL_LAB_BOOKMARK_CATALOG.bookmarks
    .filter(bookmark => bookmark.constellation === constellation)
    .sort((left, right) => left.selectionRank - right.selectionRank);
}
