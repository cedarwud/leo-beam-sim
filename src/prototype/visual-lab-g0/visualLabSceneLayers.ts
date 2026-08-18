/** Presentation-only scene layers. They never change the accepted simulator frame. */
export type VisualLabSatelliteDisplayMode = 'pair' | 'multi';
export type VisualLabUeDisplayMode = 'representative' | 'multi';

export const DEFAULT_VISUAL_LAB_SATELLITE_DISPLAY_MODE: VisualLabSatelliteDisplayMode = 'multi';
export const DEFAULT_VISUAL_LAB_UE_DISPLAY_MODE: VisualLabUeDisplayMode = 'multi';
