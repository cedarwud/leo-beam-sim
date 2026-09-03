import { useState } from 'react';
import { LocaleProvider } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { CanonicalEeTab } from './CanonicalEeTab';
import { PowerTab } from './PowerTab';
import { ThroughputTab } from './ThroughputTab';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

/**
 * Development-only browser-gate host.  The public homepage is intentionally
 * Walker-only, so its legacy Power / Throughput / EE pages are read-only.  This
 * route mounts the canonical input components in the same Vite app bundle so a
 * browser test can exercise their real React event handlers without reopening
 * the public TLE source switch.
 */
export function CanonicalControlBrowserProbe() {
  const [parameters, setParameters] = useState<SimulatorParameters>({ ...DEFAULT_SIMULATOR_PARAMETERS });
  const analysis = {
    parameters,
    setParameters,
  } as unknown as HomepageCanonicalAnalysisState;

  return (
    <LocaleProvider initialLocale="en">
      <main data-testid="homepage-authority-control-probe">
        <PowerTab parameters={parameters} onParametersChange={setParameters} />
        <ThroughputTab parameters={parameters} analysis={analysis} />
        <CanonicalEeTab analysis={analysis} />
        <output
          data-testid="homepage-authority-probe-state"
          data-beam-power-cap-w={parameters.beamPowerCapW}
          data-minimum-rate-bps={parameters.minimumRateBps}
          data-eta-max={parameters.etaMax}
        />
      </main>
    </LocaleProvider>
  );
}

