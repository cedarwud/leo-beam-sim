/**
 * Homepage display labels for the SINR-live link-budget identity.
 *
 * Re-exports the canonical rail presentation identity formatters from
 * `src/appearance/candidateRailPresentation`. Downstream controllers and views
 * consume these symbols without owning the rail presentation decision.
 */
export {
  decodeRailBeamCell,
  formatHomepageBeamLabel,
  formatHomepageCellLabel,
  formatHomepageBeamCellLabel,
  formatRailEndpointLabel,
} from '../../appearance/candidateRailPresentation';

