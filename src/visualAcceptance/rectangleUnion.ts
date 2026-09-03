export interface AxisAlignedRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function rect(left: number, top: number, width: number, height: number): AxisAlignedRect {
  return {
    left,
    top,
    right: left + Math.max(0, width),
    bottom: top + Math.max(0, height),
  };
}

export function rectArea(value: AxisAlignedRect): number {
  const normalized = normalizeRect(value);
  return Math.max(0, normalized.right - normalized.left)
    * Math.max(0, normalized.bottom - normalized.top);
}

export function normalizeRect(value: AxisAlignedRect): AxisAlignedRect {
  return {
    left: Math.min(value.left, value.right),
    top: Math.min(value.top, value.bottom),
    right: Math.max(value.left, value.right),
    bottom: Math.max(value.top, value.bottom),
  };
}

/** Exact axis-aligned clipping. Returns null for an empty intersection. */
export function clipRect(value: AxisAlignedRect, boundary: AxisAlignedRect): AxisAlignedRect | null {
  const source = normalizeRect(value);
  const clip = normalizeRect(boundary);
  const clipped: AxisAlignedRect = {
    left: Math.max(source.left, clip.left),
    top: Math.max(source.top, clip.top),
    right: Math.min(source.right, clip.right),
    bottom: Math.min(source.bottom, clip.bottom),
  };
  return clipped.right <= clipped.left || clipped.bottom <= clipped.top ? null : clipped;
}

function sortedUnique(values: readonly number[]): readonly number[] {
  return [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);
}

function unionLength(intervals: readonly [number, number][]): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as const)
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  if (sorted.length === 0) return 0;
  let total = 0;
  let start = sorted[0][0];
  let end = sorted[0][1];
  for (const [nextStart, nextEnd] of sorted.slice(1)) {
    if (nextStart > end) {
      total += end - start;
      start = nextStart;
      end = nextEnd;
    } else {
      end = Math.max(end, nextEnd);
    }
  }
  return total + end - start;
}

/**
 * Exact union area for axis-aligned rectangles.
 *
 * The sweep partitions the x-axis at every rectangle edge and computes the
 * union length of active y-intervals in each slab. It never samples a grid and
 * never sums overlapping rectangle areas.
 */
export function rectangleUnionArea(values: readonly AxisAlignedRect[]): number {
  const rectangles = values
    .map(normalizeRect)
    .filter(value => rectArea(value) > 0);
  if (rectangles.length === 0) return 0;

  const xEdges = sortedUnique(rectangles.flatMap(value => [value.left, value.right]));
  let area = 0;
  for (let index = 0; index < xEdges.length - 1; index += 1) {
    const left = xEdges[index];
    const right = xEdges[index + 1];
    if (right <= left) continue;
    const active = rectangles.filter(value => value.left < right && value.right > left);
    area += (right - left) * unionLength(active.map(value => [value.top, value.bottom]));
  }
  return area;
}

export function rectangleUnionAreaClipped(
  values: readonly AxisAlignedRect[],
  boundary: AxisAlignedRect,
): number {
  return rectangleUnionArea(values
    .map(value => clipRect(value, boundary))
    .filter((value): value is AxisAlignedRect => value !== null));
}

export interface VisualContractGeometry {
  readonly stage: AxisAlignedRect;
  readonly viewport: AxisAlignedRect;
  readonly subjects: readonly AxisAlignedRect[];
  readonly opaqueOverlays: readonly AxisAlignedRect[];
}

export interface VisualContractGeometryMetrics {
  readonly stageCoverage: number;
  readonly unoccludedStage: number;
  readonly subjectOverlayIntersection: number;
}

export function measureVisualContractGeometry(input: VisualContractGeometry): VisualContractGeometryMetrics {
  const visibleStage = clipRect(input.stage, input.viewport);
  const stageArea = visibleStage === null ? 0 : rectArea(visibleStage);
  const viewportArea = rectArea(input.viewport);
  const subjectRegionArea = rectangleUnionArea(input.subjects);
  const subjectIntersections = input.opaqueOverlays.flatMap(overlay => input.subjects
    .map(subject => clipRect(overlay, subject))
    .filter((value): value is AxisAlignedRect => value !== null));
  const opaqueStageArea = visibleStage === null
    ? 0
    : rectangleUnionAreaClipped(input.opaqueOverlays, visibleStage);
  const opaqueSubjectArea = rectangleUnionArea(subjectIntersections);
  return {
    stageCoverage: viewportArea === 0 ? 0 : stageArea / viewportArea,
    unoccludedStage: stageArea === 0 ? 0 : Math.max(0, stageArea - opaqueStageArea) / stageArea,
    subjectOverlayIntersection: subjectRegionArea === 0 ? 1 : opaqueSubjectArea / subjectRegionArea,
  };
}
