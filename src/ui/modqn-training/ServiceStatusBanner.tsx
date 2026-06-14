import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { hasConfiguredTrainingService, readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { probeService } from '../../modqn/training-trigger/serviceClient';
import type { ServiceAvailability } from '../../modqn/training-trigger/types';

interface ServiceStatusBannerProps {
  readonly appMode: AppExperienceMode;
}

export function ServiceStatusBanner({ appMode }: ServiceStatusBannerProps): ReactElement | null {
  // Opt-in: only probe + warn when a training service URL is actually configured.
  // The demo ships no training backend, so probing the default :8765 just yields a
  // permanent red "unreachable" banner — noise, not a real status.
  const enabled = appMode === 'modqn-demo' && hasConfiguredTrainingService();
  const [availability, setAvailability] = useState<ServiceAvailability | null>(null);
  const [probeKey, setProbeKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    probeService({ baseUrl: readTrainingServiceBaseUrl() }).then(result => {
      if (!cancelled) setAvailability(result);
    });
    return () => { cancelled = true; };
  }, [enabled, probeKey]);

  const handleRetry = useCallback(() => {
    setAvailability(null);
    setProbeKey(key => key + 1);
  }, []);

  if (!enabled) return null;
  if (availability === null) return null;
  if (availability.reachable) return null;

  return (
    <div
      className="leo-service-status-banner leo-service-status-banner--unreachable"
      role="alert"
      data-testid="service-status-banner-unreachable"
    >
      <span className="leo-service-status-banner__message">
        Training backend unreachable — start it on the host with: <code>python -m modqn_training_service.api</code>
      </span>
      <button
        type="button"
        className="leo-service-status-banner__retry"
        onClick={handleRetry}
        data-testid="service-status-banner-retry"
      >
        Retry connection
      </button>
    </div>
  );
}
