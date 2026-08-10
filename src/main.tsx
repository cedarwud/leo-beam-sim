import { StrictMode, useState, type CSSProperties } from 'react';
import ReactDOM from 'react-dom/client';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

const container = root;

const isC120Route = window.location.pathname === '/course/c120'
  || new URLSearchParams(window.location.search).get('course') === 'c120';
const isC90Route = window.location.pathname === '/course/c90'
  || new URLSearchParams(window.location.search).get('course') === 'c90';
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
  if (isC120Route) {
    const { C120CourseRoute } = await import('./course/c120/C120CourseRoute');
    ReactDOM.createRoot(container).render(
      <StrictMode>
        <C120CourseRoute />
      </StrictMode>
    );
    return;
  }

  if (isC90Route) {
    const { C90CourseRoute } = await import('./course/C90CourseRoute');
    ReactDOM.createRoot(container).render(
      <StrictMode>
        <C90CourseRoute />
      </StrictMode>
    );
    return;
  }

  await import('./styles/main.scss');
  const { App } = await import('./App');
  ReactDOM.createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
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
