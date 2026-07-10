import type { ReplayArm } from './ReplayArmToggle';

// P3 slice-2 C(+D) · honesty-disclosure panel for the modqn-replay-proof lane.
//
// Pays down the one-page consolidation OPEN OBLIGATION: the recorded proof lane
// must DISCLOSE what it is and is not, so a committee cannot misread the demo. The
// text here is TRUTH (frontend-change-contract Rule#6 — comments/copy must not
// lie); it is copied from the producer manifest's honestyGuard / catfish / decouple
// fields and the project's locked win-axis framing. Display-only, no truth touched.
//
// slice-2 D (provenance section) extends this same panel with the manifest-driven
// producer provenance + server self-check readout — kept in one component so the
// lane grows one honesty/source surface, not two (SDD §5 note; flag/component
// budget, contract Rule#5).

interface DisclosureLine {
  readonly key: string;
  readonly lead: string;
  readonly body: string;
}

// The 5 BINDING disclosure lines (SDD §5-C). Verbatim intent; do not soften.
const DISCLOSURE_LINES: readonly DisclosureLine[] = [
  {
    key: 'selected-vs-served',
    lead: 'selectedActionIndex = argmax-anchor, NOT served.',
    body:
      'It is the basic-mode (argmax) counterfactual anchor, not the policy’s served choice. '
      + 'Served truth = servingBeamId + auctionAudit.',
  },
  {
    key: 'catfish-inert',
    lead: 'Catfish is present-but-inert.',
    body:
      'The challenger flag is on but total_intervention_ratio = 0 (operative flags off), identical '
      + 'across all 4 arms — say “inert”, never “no catfish”. The flip is coordinated '
      + 'auction decode, not catfish.',
  },
  {
    key: 'win-axis',
    lead: 'Win axis = coverage / served (0.26 → 0.997) + EE, NOT Jain.',
    body:
      'Jain is diagnostic-only: it rewards equal-misery collapse (b1 Jain 0.988 yet 74 starved), so '
      + 'it is not the win axis.',
  },
  {
    key: 'decode-counterfactual',
    lead: 'Decode-time counterfactual, NOT retrained.',
    body:
      'Same per-user valuations, different allocator (argmax vs coordinated auction). No arm was '
      + 're-trained to produce the flip.',
  },
  {
    key: 'readiness-only',
    lead: 'READINESS_ONLY.',
    body:
      'Numbers + prereg framing only — no win / verdict / catfish-credit claim. Win framing = '
      + 'coverage / fairness / EE, not raw scalar.',
  },
];

// slice-2 D · the fields of the producer manifest.json this panel surfaces. Read
// read-only through the /modqn-bundles sceneOnly route (staged beside each scene
// window by build-h2-scene-payload.mjs). Partial — only the display fields.
export interface ReplayArmManifest {
  readonly arm?: string;
  readonly armWhy?: string;
  readonly decodeKind?: string;
  readonly trainedWeights?: string;
  readonly producerHead?: string;
  readonly producerRepo?: string;
  readonly eeDefinition?: string;
  readonly decouple?: string;
  readonly rowCount?: number;
  readonly slotCount?: number;
  readonly READINESS_ONLY?: string;
  readonly selfChecks?: {
    readonly dense_q_proof_green_masked_argmax_eq_selected?: boolean;
    readonly auction_redecode_reproduces_serving_and_audit?: boolean | string;
    readonly argmax_vs_served_differ_count?: number;
    readonly served_frac_mean?: number;
    readonly coverage_min?: number;
    readonly fairness_jain_mean?: number;
  };
}

export interface HonestyProvenancePanelProps {
  readonly arm: ReplayArm;
  /** Producer manifest for the current arm, or null when not staged (fail-soft). */
  readonly manifest?: ReplayArmManifest | null;
}

function ProvenanceSection({ manifest }: { manifest: ReplayArmManifest | null | undefined }) {
  if (!manifest) {
    return (
      <div className="leo-honesty-panel__provenance">
        <span className="leo-honesty-panel__prov-title">來源 · Provenance</span>
        <p className="leo-honesty-panel__prov-missing">
          Producer manifest not staged for this window (provenance excerpt unavailable — re-stage via
          build-h2-scene-payload.mjs).
        </p>
      </div>
    );
  }
  const sc = manifest.selfChecks;
  const rows = manifest.rowCount ?? 0;
  const argmaxEqSelected = sc?.dense_q_proof_green_masked_argmax_eq_selected === true;
  const auctionRedecode = sc?.auction_redecode_reproduces_serving_and_audit;
  return (
    <div className="leo-honesty-panel__provenance">
      <span className="leo-honesty-panel__prov-title">來源 · Provenance (producer manifest)</span>
      <div className="leo-honesty-panel__prov-grid">
        {manifest.arm ? (
          <>
            <span className="leo-honesty-panel__prov-key">arm</span>
            <span className="leo-honesty-panel__prov-val">{manifest.arm} — {manifest.armWhy}</span>
          </>
        ) : null}
        {manifest.decodeKind ? (
          <>
            <span className="leo-honesty-panel__prov-key">decode</span>
            <span className="leo-honesty-panel__prov-val">{manifest.decodeKind}</span>
          </>
        ) : null}
        {manifest.trainedWeights ? (
          <>
            <span className="leo-honesty-panel__prov-key">weights</span>
            <span className="leo-honesty-panel__prov-val">{manifest.trainedWeights}</span>
          </>
        ) : null}
        {manifest.producerHead ? (
          <>
            <span className="leo-honesty-panel__prov-key">producer</span>
            <span className="leo-honesty-panel__prov-val">
              {manifest.producerRepo ?? 'modqn-paper-reproduction'} @ {manifest.producerHead}
            </span>
          </>
        ) : null}
        {manifest.eeDefinition ? (
          <>
            <span className="leo-honesty-panel__prov-key">EE def</span>
            <span className="leo-honesty-panel__prov-val">{manifest.eeDefinition}</span>
          </>
        ) : null}
        {manifest.decouple ? (
          <>
            <span className="leo-honesty-panel__prov-key">decouple</span>
            <span className="leo-honesty-panel__prov-val">{manifest.decouple}</span>
          </>
        ) : null}
      </div>
      {sc ? (
        <p className="leo-honesty-panel__selfcheck" data-testid="provenance-selfcheck">
          <strong>Server self-check (static):</strong>{' '}
          {argmaxEqSelected
            ? `✓ dense-Q proof — masked-argmax == selectedActionIndex on all ${rows} rows`
            : '⚠ dense-Q argmax==selected NOT confirmed'}
          {auctionRedecode === true
            ? ' · ✓ auction re-decode reproduces serving + audit'
            : auctionRedecode === 'n/a'
              ? ' · auction re-decode n/a (argmax arm)'
              : auctionRedecode === undefined
                ? ''
                // fail LOUD: a failed producer self-check must never render as
                // silence (2026-07-10 truth-audit — honesty surfaces fail visibly).
                : ` · ⚠ auction re-decode self-check NOT passing (manifest: ${String(auctionRedecode)})`}
          . Producer-computed, not yet re-run in-browser (that is slice-3).
        </p>
      ) : null}
      {manifest.READINESS_ONLY ? (
        <p className="leo-honesty-panel__prov-missing">READINESS_ONLY — {manifest.READINESS_ONLY}</p>
      ) : null}
    </div>
  );
}

export function HonestyProvenancePanel({ arm, manifest }: HonestyProvenancePanelProps) {
  return (
    <section
      className="leo-honesty-panel"
      data-testid="honesty-provenance-panel"
      data-arm={arm}
      aria-label="Honesty disclosure and provenance"
    >
      <header className="leo-honesty-panel__header">誠實揭露 · Honesty disclosure</header>
      <ol className="leo-honesty-panel__list">
        {DISCLOSURE_LINES.map(line => (
          <li key={line.key} className="leo-honesty-panel__item">
            <span className="leo-honesty-panel__lead">{line.lead}</span>{' '}
            <span className="leo-honesty-panel__body">{line.body}</span>
          </li>
        ))}
      </ol>
      <ProvenanceSection manifest={manifest} />
    </section>
  );
}
