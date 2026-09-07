interface ArchivedTleBoundaryNoteProps {
  homepageCanonicalAnalysis: import("./signal-tuning/useHomepageCanonicalAnalysis").HomepageCanonicalAnalysisState;
}

export function ArchivedTleBoundaryNote({ homepageCanonicalAnalysis }: ArchivedTleBoundaryNoteProps) {
  return (
<section
                  className="leo-replay-truth-summary leo-archived-tle-boundary-note"
                  data-testid="archived-tle-handover-policy-boundary"
                  aria-label="Archived TLE handover policy"
                >
                  <strong>Canonical archived-TLE handover</strong>
                  <span>
                    Fixed 3 dB / 30 s trace; Walker policy controls are not applicable.
                    {homepageCanonicalAnalysis.frame?.handover?.reason
                      ? ` Current trace: ${homepageCanonicalAnalysis.frame.handover.reason}`
                      : ' Trace unavailable until an accepted frame is published.'}
                  </span>
                </section>
  );
}
