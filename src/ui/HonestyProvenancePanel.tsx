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

export interface HonestyProvenancePanelProps {
  readonly arm: ReplayArm;
}

export function HonestyProvenancePanel({ arm }: HonestyProvenancePanelProps) {
  return (
    <section
      className="leo-honesty-panel"
      data-testid="honesty-provenance-panel"
      data-arm={arm}
      aria-label="Honesty disclosure"
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
    </section>
  );
}
