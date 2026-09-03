import { useMemo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import './fixture.css';

type FixtureCase = 'valid' | 'bad-overlap' | 'bad-unmarked' | 'bad-ancestor-hidden' | 'bad-allowed-decoration-oversize' | 'bad-allowed-decoration-shadow';

function fixtureCase(): FixtureCase {
  const value = new URLSearchParams(window.location.search).get('case');
  return value === 'bad-overlap' || value === 'bad-unmarked' || value === 'bad-ancestor-hidden' || value === 'bad-allowed-decoration-oversize' || value === 'bad-allowed-decoration-shadow'
    ? value
    : 'valid';
}

function telemetryFor(kind: FixtureCase): Readonly<Record<string, string>> {
  return Object.freeze({
    'data-camera-pose': '0,7.35,11.65',
    'data-camera-target': '0,2.55,0',
    'data-camera-focus': 'service',
    'data-camera-speed': '0.65',
    'data-visibility': 'scene-only',
    'data-chrome': 'hidden',
    'data-primary-cue-id': 'beam-axis',
    'data-subject-bounds': 'x=50%;y=46%;safe=16-84/14-78',
    'data-truth-source': 'fixture:accepted-frame-001',
    'data-fixture-case': kind,
  });
}

function VisualContractFixture(): ReactElement {
  const kind = useMemo(fixtureCase, []);
  const [beat, setBeat] = useState(0);
  const telemetry = telemetryFor(kind);
  const isBadOverlap = kind === 'bad-overlap';
  const isBadUnmarked = kind === 'bad-unmarked';
  const isBadAncestorHidden = kind === 'bad-ancestor-hidden';
  const isBadAllowedDecorationOversize = kind === 'bad-allowed-decoration-oversize';
  const isBadAllowedDecorationShadow = kind === 'bad-allowed-decoration-shadow';

  return <main className="fixture-page" data-fixture-case={kind}>
    <section className={`contract-stage${isBadAncestorHidden ? ' ancestor-hidden-stage' : ''}`} data-stage aria-labelledby="fixture-title">
      <h1 id="fixture-title" className="sr-only">Visual teaching scene contract fixture</h1>
      <div className="scene-constellation" data-contract-role="scene-context" data-contract-surface="scene-context" aria-hidden="true">
        <span className="star star--one" data-contract-decorative="scene-star" />
        <span className="star star--two" data-contract-decorative="scene-star" />
        <span className="star star--three" data-contract-decorative="scene-star" />
        <span className="orbit orbit--outer" data-contract-decorative="scene-orbit" />
        <span className="orbit orbit--inner" data-contract-decorative="scene-orbit" />
        {isBadAllowedDecorationOversize ? <span className="expanded-allowed-star" data-contract-decorative="scene-star" aria-hidden="true" /> : null}
        {isBadAllowedDecorationShadow ? <span className="shadow-allowed-star" data-contract-decorative="scene-star" aria-hidden="true" /> : null}
        {isBadUnmarked ? <>
          {/* These are nested inside a registered role but deliberately omit
              both the surface and decorative registrations. */}
          <div className="nested-unmarked-fullscreen" aria-hidden="true" />
          <div className="nested-unmarked-sidebar" aria-hidden="true" />
          <div className="nested-unmarked-hidden-cue">nested inactive cue</div>
        </> : null}
      </div>

      <div className="subject" data-contract-role="subject" data-contract-surface="subject" data-subject data-non-color-encoding="shape+label" data-subject-shape="orbiting-ue" aria-label="Representative UE subject">
        <span className="subject-ring" data-contract-decorative="subject-ring" aria-hidden="true" />
        <span className="subject-dot" data-contract-decorative="subject-dot" aria-hidden="true" />
        <strong>UE</strong>
      </div>

      <div className="primary-cue" data-contract-role="primary-cue" data-contract-surface="primary-cue" data-primary-cue data-opaque-surface data-non-color-encoding="line+label">
        <span className="cue-line" data-contract-decorative="primary-cue-line" aria-hidden="true" />
        <span>Beam axis</span>
      </div>

      <div className="beat-control-wrap" data-contract-role="beat-control" data-contract-surface="beat-control">
        <button
          type="button"
          className="beat-control"
          data-contract-decorative="beat-control-button"
          data-beat-control
          data-opaque-surface
          aria-describedby="beat-status"
          onClick={() => setBeat(value => (value + 1) % 3)}
        >Advance beat <span aria-hidden="true">{beat + 1}/3</span>
        </button>
        <span id="beat-status" className="sr-only" role="status">Beat {beat + 1} of 3</span>
      </div>

      <div className="subtitle-bar" data-contract-role="subtitle" data-contract-surface="subtitle" data-subtitle-bar data-opaque-surface aria-live="polite">
        <span data-contract-decorative="subtitle-line" data-subtitle-line>Move the beam axis—not elevation.</span>
        <span data-contract-decorative="subtitle-line" data-subtitle-line>Two vertices reveal the angle.</span>
      </div>

      <output className="telemetry" data-contract-role="telemetry" data-contract-surface="telemetry" data-telemetry aria-label="Scene telemetry" {...telemetry}>
        camera {telemetry['data-camera-pose']} · focus {telemetry['data-camera-focus']} · source {telemetry['data-truth-source']}
      </output>

      {isBadOverlap ? <>
        <div className="bad-overlay bad-overlay--a" data-opaque-overlay data-opaque-surface data-overlay-shape="red-a" aria-hidden="true" />
        <div className="bad-overlay bad-overlay--b" data-opaque-overlay data-opaque-surface data-overlay-shape="red-b" aria-hidden="true" />
        <div className="inactive-cue" data-inactive-cue data-cue="candidate" aria-hidden="true">candidate</div>
        <div className="inactive-cue" data-inactive-cue data-cue="ttt" aria-hidden="true">TTT</div>
        <div className="inactive-cue" data-inactive-cue data-cue="trace" aria-hidden="true">trace</div>
        <div className="inactive-cue" data-inactive-cue data-cue="commit" aria-hidden="true">commit</div>
        <div className="inactive-cue" data-inactive-cue data-cue="receipt" aria-hidden="true">receipt</div>
      </> : null}
      {isBadUnmarked ? <>
        {/* Deliberately omit contract data markers. The browser census must
            still reject these painted surfaces and the mounted hidden cue. */}
        <div className="unmarked-fullscreen" aria-hidden="true" />
        <div className="unmarked-sidebar" aria-hidden="true" />
        <div className="unmarked-hidden-cue">inactive handover candidate</div>
      </> : null}
    </section>
  </main>;
}

const root = document.getElementById('root');
if (root === null) throw new Error('visual contract fixture root is missing');
createRoot(root).render(<VisualContractFixture />);
