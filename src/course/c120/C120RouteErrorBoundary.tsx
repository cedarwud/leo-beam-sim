import { Component, type ContextType, type ErrorInfo, type ReactNode } from 'react';

import { C120_CLAIM_BOUNDARY } from './contract';
import { C120LocaleContext } from './i18n';

interface C120RouteErrorBoundaryProps {
  readonly children: ReactNode;
}

interface C120RouteErrorBoundaryState {
  readonly failed: boolean;
  readonly message: string;
}

export class C120RouteErrorBoundary extends Component<C120RouteErrorBoundaryProps, C120RouteErrorBoundaryState> {
  static contextType = C120LocaleContext;
  declare context: ContextType<typeof C120LocaleContext>;

  state: C120RouteErrorBoundaryState = { failed: false, message: '' };

  static getDerivedStateFromError(error: unknown): C120RouteErrorBoundaryState {
    return {
      failed: true,
      message: error instanceof Error ? error.message : 'Unknown local rendering failure',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('C-120 route failed closed', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { locale, setLocale, text } = this.context;
    return (
      <main className="c120-route c120-failure-screen" lang={locale} aria-labelledby="c120-failure-title">
        <p className="c120-claim-bar">{C120_CLAIM_BOUNDARY}</p>
        <section>
          <div className="c120-language-switch" role="group" aria-label={text('語言切換', 'Language switch')}>
            <button type="button" lang="zh-Hant" aria-pressed={locale === 'zh-Hant'} onClick={() => setLocale('zh-Hant')}>繁中</button>
            <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
          </div>
          <p className="c120-kicker">{text('C-120 安全復原畫面', 'C-120 RECOVERY SCREEN')}</p>
          <h1 id="c120-failure-title">{text('課程畫面已安全停止', 'The teaching surface stopped safely')}</h1>
          <p>{text('系統沒有主動刪除你已保存的進度。請先重新載入；若仍無法開始，可切換整套課程到一致的備用模擬案例。', 'Your saved progress was not intentionally deleted. Reload first; if the course still cannot start, switch the whole course to the coherent fallback fixture.')}</p>
          <div className="c120-button-row">
            <button type="button" onClick={() => window.location.reload()}>{text('重新載入目前資料', 'Reload this source')}</button>
            <button type="button" onClick={() => window.location.assign('/course/c120?source=fallback')}>{text('使用一致的備用案例', 'Use coherent fallback')}</button>
          </div>
          <details><summary>{text('教師診斷資訊', 'Instructor diagnostic')}</summary><p>{this.state.message}</p></details>
        </section>
        <p className="c120-claim-bar">{C120_CLAIM_BOUNDARY}</p>
      </main>
    );
  }
}
