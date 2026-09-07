import { HomepageCanonicalServingComparison } from './signal-tuning/HomepageCanonicalServingComparison';
import { HomepageRightRail } from './signal-tuning/HomepageRightRail';

interface HomepageCanonicalRightRailProps {
  homepageCanonicalAnalysis: import("./signal-tuning/useHomepageCanonicalAnalysis").HomepageCanonicalAnalysisState;
}

export function HomepageCanonicalRightRail({ homepageCanonicalAnalysis }: HomepageCanonicalRightRailProps) {
  return (
<HomepageRightRail
              analysis={homepageCanonicalAnalysis}
            >
              <HomepageCanonicalServingComparison frame={homepageCanonicalAnalysis.frame} />
            </HomepageRightRail>
  );
}
