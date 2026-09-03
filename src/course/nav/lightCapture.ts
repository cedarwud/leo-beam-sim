import { SIX_ACTS_VISIBLE_ROUTES } from './sixActsRoutes';

export const SIX_ACTS_LIGHT_CAPTURE_THEME = 'light-capture' as const;

/**
 * The capture theme is deliberately a route concern.  A query string on an
 * unrelated simulator surface must never turn that surface into a light
 * theme, even though the app is a single-page runtime.
 */
export const SIX_ACTS_LIGHT_CAPTURE_PATHS: ReadonlySet<string> = new Set([
  '/course/six-acts',
  ...SIX_ACTS_VISIBLE_ROUTES.map(route => route.href),
]);

export function isSixActsLightCaptureLocation(pathname: string, search: string): boolean {
  return SIX_ACTS_LIGHT_CAPTURE_PATHS.has(pathname)
    && new URLSearchParams(search).get('theme') === SIX_ACTS_LIGHT_CAPTURE_THEME;
}

export function isSixActsLightCaptureMode(): boolean {
  return typeof window !== 'undefined'
    && isSixActsLightCaptureLocation(window.location.pathname, window.location.search);
}

/** Preserve the capture theme on the next internal teaching route. */
export function sixActsHref(href: string, enabled = isSixActsLightCaptureMode()): string {
  if (!enabled) return href;
  const url = new URL(href, 'http://six-acts.local');
  if (!SIX_ACTS_LIGHT_CAPTURE_PATHS.has(url.pathname)) return href;
  url.searchParams.set('theme', SIX_ACTS_LIGHT_CAPTURE_THEME);
  return `${url.pathname}${url.search}${url.hash}`;
}
