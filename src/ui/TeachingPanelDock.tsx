import type { ReactNode } from 'react';
import { SidebarTabShell, type SidebarTabItem } from './SidebarTabShell';
import type { SixActsTeachingMode } from '../course/sixActs/teachingMode';

export interface TeachingLinkSnapshot {
  readonly ueId: string | null;
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly timeSec: number | null;
  readonly thetaDeg: number | null;
  readonly transmitGainLinear: number | null;
  readonly sinrDb: number | null;
  readonly throughputMbps: number | null;
  readonly systemPowerW: number | null;
  readonly energyEfficiencyBitsPerJoule: number | null;
}

interface TeachingPanelDockProps {
  readonly mode: SixActsTeachingMode;
  readonly onModeChange: (mode: SixActsTeachingMode) => void;
  readonly engineeringContent: ReactNode;
  readonly linkSnapshot: TeachingLinkSnapshot;
  readonly policyContent?: ReactNode;
  readonly platformContent?: ReactNode;
}

const MODE_TABS: readonly SidebarTabItem<SixActsTeachingMode>[] = [
  {
    key: 'engineering',
    label: 'ENGINEERING',
    description: '公式與研究控制',
  },
  {
    key: 'teaching',
    label: 'TEACHING',
    description: '六幕講解 dock',
  },
];

function formatValue(value: number | null, digits = 2, suffix = ''): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function formatId(value: string | null): string {
  return value === null ? '尚未附著' : value;
}

function TeachingSnapshot({ snapshot }: { readonly snapshot: TeachingLinkSnapshot }) {
  return (
    <dl className="leo-teaching-dock__snapshot" data-testid="teaching-link-snapshot">
      <div>
        <dt>UE</dt>
        <dd>{formatId(snapshot.ueId)}</dd>
      </div>
      <div>
        <dt>Serving</dt>
        <dd>{formatId(snapshot.servingSatelliteId)}</dd>
      </div>
      <div>
        <dt>Option</dt>
        <dd>{formatId(snapshot.candidateSatelliteId)}</dd>
      </div>
      <div>
        <dt>t</dt>
        <dd>{formatValue(snapshot.timeSec, 1, ' s')}</dd>
      </div>
      <div>
        <dt>θ off-axis</dt>
        <dd>{formatValue(snapshot.thetaDeg, 2, '°')}</dd>
      </div>
      <div>
        <dt>G<sup>T</sup>(θ<sub>u,s,v</sub>, θ<sub>3dB</sub>)</dt>
        <dd>{snapshot.transmitGainLinear === null || !Number.isFinite(snapshot.transmitGainLinear)
          ? '—'
          : snapshot.transmitGainLinear.toExponential(2)}</dd>
      </div>
      <div>
        <dt>γ</dt>
        <dd>{formatValue(snapshot.sinrDb, 2, ' dB')}</dd>
      </div>
      <div>
        <dt>R</dt>
        <dd>{formatValue(snapshot.throughputMbps, 2, ' Mbit/s')}</dd>
      </div>
      <div>
        <dt>Pᴺ</dt>
        <dd>{formatValue(snapshot.systemPowerW, 2, ' W')}</dd>
      </div>
      <div>
        <dt>η</dt>
        <dd>{formatValue(snapshot.energyEfficiencyBitsPerJoule, 2, ' bit/J')}</dd>
      </div>
    </dl>
  );
}

function TeachingContent({
  linkSnapshot,
  policyContent,
  platformContent,
}: {
  readonly linkSnapshot: TeachingLinkSnapshot;
  readonly policyContent?: ReactNode;
  readonly platformContent?: ReactNode;
}) {
  return (
    <div className="leo-teaching-dock" data-testid="teaching-panel-dock">
      <header className="leo-teaching-dock__header">
        <span className="leo-teaching-dock__eyebrow">SIX ACTS · P0</span>
        <h2>從角度到能源效率</h2>
        <p>同一個 live frame，拆成講師可以逐步說明的四個面板。</p>
      </header>

      <section className="leo-teaching-dock__section" data-testid="teaching-panel-inputs">
        <div className="leo-teaching-dock__section-heading">
          <span className="leo-teaching-dock__step">01</span>
          <div>
            <h3>INPUTS</h3>
            <p>目前選中的 UE、衛星與角度輸入。</p>
          </div>
        </div>
        <TeachingSnapshot snapshot={linkSnapshot} />
      </section>

      <section className="leo-teaching-dock__section" data-testid="teaching-panel-causal-chain">
        <div className="leo-teaching-dock__section-heading">
          <span className="leo-teaching-dock__step">02</span>
          <div>
            <h3>CAUSAL CHAIN</h3>
            <p>θ<sub>u,s,v</sub> 與 θ<sub>3dB</sub> 決定 G<sup>T</sup>，並沿同一條鏈影響 γ、R 與 η。</p>
          </div>
        </div>
        <div className="leo-teaching-dock__chain" aria-label="角度到能源效率的因果鏈">
          <span>θ</span>
          <b>→</b>
          <span>G<sup>T</sup>(θ<sub>u,s,v</sub>, θ<sub>3dB</sub>)</span>
          <b>→</b>
          <span>γ</span>
          <b>→</b>
          <span>R</span>
          <b>→</b>
          <span>η</span>
        </div>
        <p className="leo-teaching-dock__note">H、I、σ² 仍由同一個 canonical link frame 提供；dock 只做說明投影。</p>
      </section>

      <section className="leo-teaching-dock__section" data-testid="teaching-panel-policy">
        <div className="leo-teaching-dock__section-heading">
          <span className="leo-teaching-dock__step">03</span>
          <div>
            <h3>POLICY KNOBS</h3>
            <p>換手規則是決策層控制，不改寫 SINR 公式。</p>
          </div>
        </div>
        {policyContent ?? <p className="leo-teaching-dock__note">政策控制尚未在這條 lane 掛入。</p>}
      </section>

      <section className="leo-teaching-dock__section" data-testid="teaching-panel-platform">
        <div className="leo-teaching-dock__section-heading">
          <span className="leo-teaching-dock__step">04</span>
          <div>
            <h3>PLATFORM</h3>
            <p>把完整 run summary 交給 Act 6 的離線 mock 流程。</p>
          </div>
        </div>
        {platformContent ?? <p className="leo-teaching-dock__note">平台 payload 會在 run summary 接上後開啟。</p>}
      </section>
    </div>
  );
}

export function TeachingPanelDock({
  mode,
  onModeChange,
  engineeringContent,
  linkSnapshot,
  policyContent,
  platformContent,
}: TeachingPanelDockProps) {
  return (
    <SidebarTabShell
      label="SINR live panel mode"
      side="left"
      tabs={MODE_TABS}
      activeKey={mode}
      onChange={onModeChange}
    >
      {mode === 'teaching' ? (
        <TeachingContent
          linkSnapshot={linkSnapshot}
          policyContent={policyContent}
          platformContent={platformContent}
        />
      ) : (
        <section className="leo-engineering-dock" data-testid="engineering-panel-dock">
          {engineeringContent ?? <p className="leo-teaching-dock__note">Engineering controls unavailable.</p>}
        </section>
      )}
    </SidebarTabShell>
  );
}
