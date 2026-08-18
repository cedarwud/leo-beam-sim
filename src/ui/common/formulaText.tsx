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
  return <span data-formula-symbol="p-dl-pre-satellite-cap" aria-label="P superscript r subscript s comma v">P<sup>r</sup><sub>s,v</sub></span>;
}

export function PostSatelliteCapDownlinkPower(): ReactNode {
  return <span data-formula-symbol="p-dl-post-satellite-cap" aria-label="P superscript o subscript s comma v">P<sup>o</sup><sub>s,v</sub></span>;
}

/** Formula vocabulary that may appear inside localized prose. */
const FORMULA_IDENTIFIER_RE = /P_DL_tilde|P_DL_pre_sat|P_beam,max|P_sat,max|gamma_req|theta_3dB|eta_PA|eta_max|P_event|P_RFC|P_BB|P_PA|P_sys|p_req|EE_eval|EE_inst|R_min_req|R_min|B_beam|B_sys|K_FR|T_sys|T_ant|T_ref|I_intra|I_inter|P_t|U_s,v|U_b|R_u|SINR_u/g;

function renderFormulaIdentifier(identifier: string): ReactNode {
  switch (identifier) {
    case 'P_DL_tilde': return <PostSatelliteCapDownlinkPower />;
    case 'P_DL_pre_sat': return <PreSatelliteCapDownlinkPower />;
    case 'P_beam,max': return <>beam RF cap</>;
    case 'P_sat,max': return <>satellite RF cap</>;
    case 'gamma_req': return <>γ<sup>r</sup></>;
    case 'theta_3dB': return <>beamwidth</>;
    case 'eta_PA': return <>η<sub>s,v</sub></>;
    case 'eta_max': return <>η<sub>0</sub></>;
    case 'P_event': return <>event energy</>;
    case 'P_RFC': return <>P<sup>c</sup></>;
    case 'P_BB': return <>P<sup>d</sup></>;
    case 'P_PA': return <>P<sup>p</sup><sub>s,v</sub></>;
    case 'P_sys': return <>P<sup>N</sup></>;
    case 'p_req': return <><i>p</i><sup>r</sup><sub>u,s,v</sub></>;
    case 'EE_eval': return <>η<sup>e</sup></>;
    case 'EE_inst': return <>η<sup>e</sup></>;
    case 'R_min_req': return <>R<sup>m</sup></>;
    case 'R_min': return <>R<sup>m</sup></>;
    case 'B_beam': return <>B<sup>w</sup></>;
    case 'B_sys': return <>system bandwidth</>;
    case 'K_FR': return <>reuse groups</>;
    case 'T_sys': return <>system temperature</>;
    case 'T_ant': return <>antenna temperature</>;
    case 'T_ref': return <>reference temperature</>;
    case 'I_intra': return <>I<sup>a</sup></>;
    case 'I_inter': return <>I<sup>b</sup></>;
    case 'P_t': return <>P<sup>o</sup><sub>s,v</sub></>;
    case 'U_s,v': return <>U<sub>s,v</sub></>;
    case 'U_b': return <>U<sub>b</sub></>;
    case 'R_u': return <>R<sub>u,s,v</sub></>;
    case 'SINR_u': return <>γ<sub>u,s,v</sub></>;
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
