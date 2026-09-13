import { StrictMode, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

import { SixActsLauncher } from './course/nav/SixActsLauncher';
import { isSixActsLightCaptureMode } from './course/nav/lightCapture';
import { resolveLegacyRouteRetirement } from './app/legacyRouteRetirement';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const container = root;
const retiredRouteTarget = resolveLegacyRouteRetirement(
  window.location.pathname,
  window.location.search,
  window.location.hash,
);
if (retiredRouteTarget !== null) {
  window.history.replaceState(window.history.state, '', retiredRouteTarget);
}
const query = new URLSearchParams(window.location.search);

const isC120Route = window.location.pathname === '/course/c120'
  || query.get('course') === 'c120';
const isC90Route = window.location.pathname === '/course/c90'
  || query.get('course') === 'c90';
// The six-acts teaching line. Act 2 is a linear five-station lecture surface,
// deliberately NOT a gated course shell (see tleJourneyStations.ts).
const isSixActsIndexRoute = window.location.pathname === '/course/six-acts';
const isTleJourneyRoute = window.location.pathname === '/course/tle-journey';
const isBeamLayoutExperimentRoute = window.location.pathname === '/course/beam-layout-lab'
  || window.location.pathname === '/course/energy-lab';
const isFrequencyReuseExperimentRoute = window.location.pathname === '/course/frequency-reuse-lab'
  || window.location.pathname === '/course/energy-evidence';
const isCanonicalExperimentRoute = isBeamLayoutExperimentRoute || isFrequencyReuseExperimentRoute;
const isHomepageAuthorityBrowserGate = import.meta.env.DEV
  && query.get('browserGate') === 'homepage-authority';
// Compatibility routes for the pre-canonical Walker shell. The homepage and the
// explicit alias deliberately fall through to App, where the route selects
// the legacy presentation layer; keeping them out of the canonical development
// query avoids an accidental second simulator runtime on an old bookmark.
const isHomepageRoute = window.location.pathname === '/';
const isBeamColorsRoute = window.location.pathname === '/beam-colors';
const isLegacyWalkerRoute = isHomepageRoute
  || window.location.pathname === '/legacy';
// /walker is a working sandbox: a decoupled copy of the Walker shell (never
// the live App.tsx, which is still being tuned) used to graft the
// /simulator-style left sidebar in for comparison while "/" gets reskinned to
// match it. See src/AppWalkerSandbox.tsx.
const isWalkerSidebarSandboxRoute = window.location.pathname === '/walker';
// The canonical simulator query remains an explicit development surface for
// non-public paths. The public /simulator pathname is reserved for the unified
// Visual Lab surface below.
const isCanonicalSimulatorDevelopmentRoute = window.location.pathname !== '/simulator'
  && !isLegacyWalkerRoute
  && query.get('simulator') === 'canonical';
// The original 2D/3D teaching prototypes and the global constellation view
// remain available under explicit standalone locators. Other historical
// scientific aliases continue to resolve to the unified Visual Lab surface.
const isStandaloneScientificExplain3DRoute = window.location.pathname === '/prototype/scientific-explain-legacy-3d';
const isStandaloneScientificExplain2DRoute = window.location.pathname === '/prototype/scientific-explain-legacy-2d'
  || window.location.pathname === '/prototype/scientific-explain-2d';
const isStandaloneGlobalConstellationRoute = window.location.pathname === '/prototype/global-constellation';
const isVisualFirstGoldenFlowRoute = window.location.pathname === '/prototype/visual-first-golden-flow'
  || window.location.pathname === '/course/off-axis-lab'
  || window.location.pathname === '/course/handover-theater';
const isUnifiedVisualLabRoute = window.location.pathname === '/simulator'
  || window.location.pathname === '/visual-lab'
  || window.location.pathname === '/explain'
  || window.location.pathname === '/prototype/scientific-explain'
  || window.location.pathname === '/prototype/scientific-explain-3d'
  // Keep the existing direct prototype locator available while it shares the
  // same runtime as the public aliases.
  || window.location.pathname === '/prototype/visual-lab-g0';
/**
 * Every successful route render goes through here.
 *
 * The six-acts routes carry their own nav strip. Other standalone surfaces get
 * the corner launcher, while the homepage relies on its visible top-band entry.
 * Mounted at the router rather than inside a route component
 * because five different root components serve "the app" (App,
 * UnifiedVisualLabPrototype, AppWalkerSandbox and the two standalone
 * prototypes) — putting the entry inside one of them left the other four with
 * no way into the teaching line, which is the bug this replaces. A new route
 * added later gets the launcher for free.
 */
const isSixActsSurface = isSixActsIndexRoute
  || isTleJourneyRoute
  || isCanonicalExperimentRoute
  || isStandaloneGlobalConstellationRoute
  || isVisualFirstGoldenFlowRoute;
const isSixActsTeachingStage = query.get('teaching') === '1'
  || query.get('preset') === 'handover';

function Shell({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      container.dataset.leoAppReady = 'true';
    });
    return () => {
      window.cancelAnimationFrame(frame);
      delete container.dataset.leoAppReady;
    };
  }, []);

  return (
    <StrictMode>
      {children}
      {isHomepageRoute || isBeamColorsRoute || isSixActsSurface || isSixActsTeachingStage ? null : <SixActsLauncher />}
    </StrictMode>
  );
}

const C120_BOOTSTRAP_CLAIM = 'SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED';

function C120BootstrapFailure({ message }: { readonly message: string }) {
  const [english, setEnglish] = useState(() => {
    try { return window.localStorage.getItem('leo-beam-sim.c120.locale.v1') === 'en'; } catch { return false; }
  });
  const buttonStyle: CSSProperties = {
    minHeight: '44px',
    padding: '.65rem 1rem',
    border: '1px solid #76ead7',
    borderRadius: '8px',
    color: '#052027',
    background: '#76ead7',
    font: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  };
  const chooseLanguage = (nextEnglish: boolean) => {
    setEnglish(nextEnglish);
    try { window.localStorage.setItem('leo-beam-sim.c120.locale.v1', nextEnglish ? 'en' : 'zh-Hant'); } catch { /* in-memory switch remains usable */ }
  };
  const text = (zhHant: string, en: string) => english ? en : zhHant;

  return (
    <main lang={english ? 'en' : 'zh-Hant'} style={{ minHeight: '100vh', padding: 'clamp(1rem, 4vw, 3rem)', color: '#edfafa', background: '#020912', font: '18px/1.6 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif' }}>
      <div role="group" aria-label={text('語言切換', 'Language switch')} style={{ display: 'flex', gap: '.5rem', marginBottom: '2rem' }}>
        <button type="button" style={buttonStyle} aria-pressed={!english} onClick={() => chooseLanguage(false)}>繁中</button>
        <button type="button" style={buttonStyle} aria-pressed={english} onClick={() => chooseLanguage(true)}>EN</button>
      </div>
      <p style={{ padding: '1rem', color: '#ffd78a', background: '#2a2110', border: '1px solid #9d6f19', overflowWrap: 'anywhere' }}>{C120_BOOTSTRAP_CLAIM}</p>
      <h1>{text('課程畫面目前無法啟動', 'The teaching surface could not start')}</h1>
      <p>{text('你的課程資料沒有被主動刪除。請先重新載入；若仍無法開始，可使用一致的備用模擬案例。', 'Your course data was not intentionally deleted. Reload first; if it still cannot start, use the coherent fallback fixture.')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
        <button type="button" style={buttonStyle} onClick={() => window.location.reload()}>{text('重新載入', 'Reload')}</button>
        <button type="button" style={buttonStyle} onClick={() => window.location.assign('/course/c120?source=fallback')}>{text('使用一致的備用案例', 'Use coherent fallback')}</button>
      </div>
      <details style={{ marginTop: '2rem' }}><summary>{text('教師診斷資訊', 'Instructor diagnostic')}</summary><p style={{ overflowWrap: 'anywhere' }}>{message}</p></details>
      <p style={{ marginTop: '2rem', padding: '1rem', color: '#ffd78a', background: '#2a2110', border: '1px solid #9d6f19', overflowWrap: 'anywhere' }}>{C120_BOOTSTRAP_CLAIM}</p>
    </main>
  );
}

async function bootstrap() {
  if (isSixActsLightCaptureMode()) {
    await import('./course/nav/SixActsLightCapture.scss');
  }

  if (isHomepageAuthorityBrowserGate) {
    const { CanonicalControlBrowserProbe } = await import('./ui/signal-tuning/CanonicalControlBrowserProbe');
    ReactDOM.createRoot(container).render(<Shell><CanonicalControlBrowserProbe /></Shell>);
    return;
  }

  if (isBeamColorsRoute) {
    await import('./styles/main.scss');
    const { HomepageBeamColorsPage } = await import('./ui/homepage/HomepageBeamColorsPage');
    ReactDOM.createRoot(container).render(<Shell><HomepageBeamColorsPage /></Shell>);
    return;
  }

  if (isC120Route) {
    const { C120CourseRoute } = await import('./course/c120/C120CourseRoute');
    ReactDOM.createRoot(container).render(
      <Shell>
        <C120CourseRoute />
      </Shell>
    );
    return;
  }

  if (isSixActsIndexRoute) {
    const { SixActsIndexRoute } = await import('./course/six-acts-index/SixActsIndexRoute');
    ReactDOM.createRoot(container).render(<Shell><SixActsIndexRoute /></Shell>);
    return;
  }

  if (isTleJourneyRoute) {
    const { TleJourneyRoute } = await import('./course/tle-journey/TleJourneyRoute');
    ReactDOM.createRoot(container).render(<Shell><TleJourneyRoute /></Shell>);
    return;
  }

  if (isBeamLayoutExperimentRoute) {
    if (window.location.pathname === '/course/beam-layout-lab') {
      const { ContactWindowLabRoute } = await import('./course/contact-window-labs/ContactWindowLabRoute');
      ReactDOM.createRoot(container).render(<Shell><ContactWindowLabRoute act={5} /></Shell>);
      return;
    }
    const { BeamLayoutExperimentRoute } = await import('./course/canonical-experiments/CanonicalExperimentRoute');
    ReactDOM.createRoot(container).render(<Shell><BeamLayoutExperimentRoute /></Shell>);
    return;
  }

  if (isFrequencyReuseExperimentRoute) {
    if (window.location.pathname === '/course/frequency-reuse-lab') {
      const { ContactWindowLabRoute } = await import('./course/contact-window-labs/ContactWindowLabRoute');
      ReactDOM.createRoot(container).render(<Shell><ContactWindowLabRoute act={6} /></Shell>);
      return;
    }
    const { FrequencyReuseExperimentRoute } = await import('./course/canonical-experiments/CanonicalExperimentRoute');
    ReactDOM.createRoot(container).render(<Shell><FrequencyReuseExperimentRoute /></Shell>);
    return;
  }

  if (isC90Route) {
    const { C90CourseRoute } = await import('./course/C90CourseRoute');
    ReactDOM.createRoot(container).render(
      <Shell>
        <C90CourseRoute />
      </Shell>
    );
    return;
  }

  if (isCanonicalSimulatorDevelopmentRoute) {
    const { SimulatorRoute } = await import('./simulator/SimulatorRoute');
    ReactDOM.createRoot(container).render(
      <Shell>
        <SimulatorRoute />
      </Shell>
    );
    return;
  }

  if (isStandaloneScientificExplain3DRoute) {
    const { ScientificExplain3DPrototype } = await import('./prototype/scientific-explain/ScientificExplain3DPrototype');
    ReactDOM.createRoot(container).render(
      <Shell>
        <ScientificExplain3DPrototype />
      </Shell>,
    );
    return;
  }

  if (isStandaloneScientificExplain2DRoute) {
    const { ScientificExplainPrototype } = await import('./prototype/scientific-explain/ScientificExplainPrototype');
    ReactDOM.createRoot(container).render(
      <Shell>
        <ScientificExplainPrototype />
      </Shell>,
    );
    return;
  }

  if (isStandaloneGlobalConstellationRoute) {
    const { GlobalConstellationPrototype } = await import('./prototype/global-constellation/GlobalConstellationPrototype');
    ReactDOM.createRoot(container).render(
      <Shell>
        <GlobalConstellationPrototype />
      </Shell>,
    );
    return;
  }

  if (isVisualFirstGoldenFlowRoute) {
    const { GoldenFlowPrototype } = await import('./prototype/golden-flow/GoldenFlowPrototype');
    ReactDOM.createRoot(container).render(
      <Shell>
        <GoldenFlowPrototype />
      </Shell>,
    );
    return;
  }

  if (isUnifiedVisualLabRoute) {
    const { UnifiedVisualLabPrototype } = await import('./prototype/visual-lab-g0/UnifiedVisualLabPrototype');
    ReactDOM.createRoot(container).render(
      <Shell>
        <UnifiedVisualLabPrototype />
      </Shell>
    );
    return;
  }

  if (isWalkerSidebarSandboxRoute) {
    await import('./styles/main.scss');
    const { AppWalkerSandbox } = await import('./AppWalkerSandbox');
    ReactDOM.createRoot(container).render(
      <Shell>
        <AppWalkerSandbox />
      </Shell>
    );
    return;
  }

  await import('./styles/main.scss');
  const { App } = await import('./App');
  ReactDOM.createRoot(container).render(
    <Shell>
      <App />
    </Shell>
  );
}

void bootstrap().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap failure';
  ReactDOM.createRoot(container).render(
    <StrictMode>
      {isC120Route
        ? <C120BootstrapFailure message={message}/>
        : <main style={{ minHeight: '100vh', padding: '2rem', color: '#ebf2f4', background: '#081114', fontFamily: 'system-ui, sans-serif' }}>
          <h1>The local teaching surface could not start.</h1>
          <p>Reload the current source.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
          <details><summary>Diagnostic</summary><p>{message}</p></details>
        </main>}
    </StrictMode>,
  );
});
