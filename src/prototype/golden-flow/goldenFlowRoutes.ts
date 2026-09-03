/**
 * Stable locators for the scene-first teaching surface.
 *
 * Course navigation imports these instead of reconstructing query strings so
 * the launcher, index, nav strip, and the scene agree on one public contract.
 */
export const GOLDEN_FLOW_ROUTE = '/prototype/visual-first-golden-flow' as const;
export const GOLDEN_FLOW_ACT_PARAM = 'act' as const;
export const GOLDEN_FLOW_ACT3_HREF = '/course/off-axis-lab' as const;
export const GOLDEN_FLOW_ACT4_HREF = '/course/handover-theater' as const;
