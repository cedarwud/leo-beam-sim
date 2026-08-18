import { useState } from 'react';
import { type ScientificExplanationArtifactRouteState } from './route/scientificExplanationArtifactLoader';
import { useScientificExplanationRun } from './route/useScientificExplanationRun';
import { AngleResponseDemoStage } from './scene/AngleResponseDemoStage';
import './ScientificExplanationRoute.scss';

export function ScientificExplanationSurface({
  state,
  onRetry,
}: {
  readonly state: ScientificExplanationArtifactRouteState;
  readonly onRetry: () => void;
}) {
  if (state.status === 'pending') {
    return (
      <main
        className="scientific-explain scientific-explain--angle scientific-explain--loading"
        data-evidence-state="pending"
        lang="zh-Hant"
        aria-busy="true"
      >
        <span className="scientific-explain__loading-status" role="status">載入預計算場景</span>
      </main>
    );
  }

  if (state.status === 'available') {
    return (
      <main className="scientific-explain scientific-explain--angle" data-evidence-state="available" lang="zh-Hant">
        <AngleResponseDemoStage
          state={state}
          onBack={() => {
            if (typeof window === 'undefined') return;
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.assign('/');
            }
          }}
        />
      </main>
    );
  }

  return (
    <main className="scientific-explain scientific-explain--refused" data-evidence-state="refused" lang="zh-Hant">
      <section className="explain-refusal" role="alert" aria-live="assertive">
        <strong>這筆資料沒有通過核對，因此不顯示舊值或替代結果。</strong>
        <p>{state.reason}</p>
        <button className="explain-primary-action" type="button" onClick={onRetry}>重新載入</button>
      </section>
    </main>
  );
}

export function ScientificExplanationRoute() {
  const [retryKey, setRetryKey] = useState(0);
  const state = useScientificExplanationRun(retryKey);
  return <ScientificExplanationSurface state={state} onRetry={() => setRetryKey(value => value + 1)} />;
}
