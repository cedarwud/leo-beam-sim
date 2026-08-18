import type {
  VisualLabFigureProfile,
  VisualLabTheme,
} from './visualLabPresentationContract';

export type VisualLabSemanticColorKey =
  | 'service'
  | 'candidate'
  | 'context'
  | 'energy'
  | 'error'
  | 'background'
  | 'surface'
  | 'ink'
  | 'line';

export interface VisualLabThemeTokens {
  readonly theme: VisualLabTheme;
  readonly surfaceMode: 'dark' | 'warm-light';
  readonly colors: Readonly<Record<VisualLabSemanticColorKey, string>>;
}

/**
 * Semantic tokens are presentation-only.  The light profile is a warm paper
 * surface for figures, not a mechanical inversion of the dark palette.
 */
export const VISUAL_LAB_THEME_TOKENS: Readonly<Record<VisualLabTheme, VisualLabThemeTokens>> = Object.freeze({
  dark: Object.freeze({
    theme: 'dark',
    surfaceMode: 'dark',
    colors: Object.freeze({
      service: '#ffd166',
      candidate: '#67b8f0',
      context: '#6f8791',
      energy: '#f2a36f',
      error: '#ff8a78',
      background: '#08131b',
      surface: '#10212b',
      ink: '#edf6f5',
      line: '#496875',
    }),
  }),
  light: Object.freeze({
    theme: 'light',
    surfaceMode: 'warm-light',
    colors: Object.freeze({
      service: '#9b650c',
      candidate: '#17628c',
      context: '#66747b',
      energy: '#a64f1d',
      error: '#a33f3f',
      background: '#f5efe4',
      surface: '#fffaf1',
      ink: '#24343c',
      line: '#b6a99a',
    }),
  }),
});

export function resolveVisualLabThemeProfile(
  profileOrTheme: VisualLabTheme | Pick<VisualLabFigureProfile, 'theme'>,
): VisualLabThemeTokens {
  const theme = typeof profileOrTheme === 'string' ? profileOrTheme : profileOrTheme.theme;
  return VISUAL_LAB_THEME_TOKENS[theme];
}
