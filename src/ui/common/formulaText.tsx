import type { ReactNode } from 'react';
import { renderInlineFormula } from './inlineFormula';

/**
 * Thesis-canonical downlink-power symbols.
 *
 * The producer exposes the intermediate beam-capped value separately from
 * the final value after the satellite cap.  Keep the distinction in the
 * rendered math instead of falling back to an ambiguous legacy post-cap
 * spelling.
 */
export function PreSatelliteCapDownlinkPower(): ReactNode {
  return <span data-formula-symbol="link-power" aria-label="p subscript u s v of t theta">p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</span>;
}

export function PostSatelliteCapDownlinkPower(): ReactNode {
  return <span data-formula-symbol="pa-input-power" aria-label="P superscript p subscript u s v of t theta">P<sup>p</sup><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</span>;
}

/** Formula vocabulary that may appear inside localized prose. */
const FORMULA_IDENTIFIER_RE = /P_DL_tilde|P_DL_pre_sat|P_beam,max|P_sat,max|gamma_req|theta_3dB|eta_PA|eta_max|P_event|P_RFC|P_BB|P_PA|P_sys|p_req|EE_eval|EE_inst|R_min_req|R_min|B_beam|B_sys|K_FR|T_sys|T_ant|T_ref|I_intra|I_inter|P_t|U_s,v|U_b|R_u|SINR_u/g;

function renderFormulaIdentifier(identifier: string): ReactNode {
  switch (identifier) {
    case 'P_DL_tilde': return <PostSatelliteCapDownlinkPower />;
    case 'P_DL_pre_sat': return <PreSatelliteCapDownlinkPower />;
    case 'P_beam,max':
    case 'P_sat,max': return <>P<sup>N</sup>(t, <strong>θ</strong>)</>;
    case 'gamma_req': return <>γ<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    case 'theta_3dB': return <>θ<sub>u,s,v</sub></>;
    case 'eta_PA':
    case 'eta_max': return <>ξ<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>;
    case 'P_event':
    case 'P_RFC':
    case 'P_BB': return <>P<sup>f</sup>(t)</>;
    case 'P_PA': return <PostSatelliteCapDownlinkPower />;
    case 'P_sys': return <>P<sup>N</sup>(t, <strong>θ</strong>)</>;
    case 'p_req':
    case 'P_t': return <PreSatelliteCapDownlinkPower />;
    case 'EE_eval':
    case 'EE_inst': return <>η<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    case 'R_min_req':
    case 'R_min': return <>R<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    case 'B_beam':
    case 'B_sys': return <>B<sup>w</sup></>;
    case 'K_FR': return <>I<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    case 'T_sys':
    case 'T_ant':
    case 'T_ref': return <>σ²</>;
    case 'I_intra':
    case 'I_inter': return <>I<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    case 'U_s,v':
    case 'U_b': return <>U<sub>s,v</sub>(t)</>;
    case 'R_u': return <>R<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    case 'SINR_u': return <>γ<sub>u,s,v</sub>(t, <strong>θ</strong>)</>;
    default: return identifier;
  }
}

/** Render formula prose without exposing raw snake-case identifiers. */
export function renderFormulaText(text: string | undefined): ReactNode {
  if (text === undefined || text.length === 0) return text;
  const pieces: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(FORMULA_IDENTIFIER_RE)) {
    const index = match.index ?? cursor;
    if (index > cursor) pieces.push(renderInlineFormula(text.slice(cursor, index)));
    pieces.push(renderFormulaIdentifier(match[0]));
    cursor = index + match[0].length;
  }
  if (cursor === 0) return renderInlineFormula(text);
  if (cursor < text.length) pieces.push(renderInlineFormula(text.slice(cursor)));
  return <>{pieces.map((piece, index) => <span key={index}>{piece}</span>)}</>;
}
