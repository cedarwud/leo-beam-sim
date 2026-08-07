#!/usr/bin/env node
// Pure-logic tests for the help-popover inline formula scanner.
//
// The repo has no jsdom / RTL / jest / vitest (package.json carries tsx plus
// hand-rolled `node --import tsx/esm <script>` validators only), and CONTRACT
// §0.6 forbids adding one. So this exercises the pure `string -> tokens` half,
// which is exactly why the module is split that way: `renderInlineFormula` is a
// thin, boring map from those tokens onto <sub>/<sup>.
//
// The catalog fixtures below are VERBATIM COPIES of values in
// `src/i18n/strings.ts`, deliberately not imported: this file asserts that the
// renderer handles the copy that exists today, and should not start failing
// (or silently stop testing anything) because a copy editor reworded a string.
//
// Run: `node --import tsx/esm src/ui/common/inlineFormula.test.tsx`
import { renderToStaticMarkup } from 'react-dom/server';
import {
  flattenInlineFormula,
  formatInlineFormulaTokens,
  parseInlineFormula,
  renderInlineFormula,
  type InlineFormulaToken,
} from './inlineFormula';

let passed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failures.push(label);
    console.error(`  [FAIL] ${label}${detail ? `\n         ${detail}` : ''}`);
  }
}

/** `formatInlineFormulaTokens` shorthand: `[_x]` = subscript, `[^x]` = superscript. */
function fmt(input: string): string {
  return formatInlineFormulaTokens(parseInlineFormula(input));
}

function expectFormat(label: string, input: string, expected: string): void {
  const actual = fmt(input);
  check(label, actual === expected, `input    ${JSON.stringify(input)}\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`);
}

/** Nothing may be eaten: flattened text === input minus the consumed markers. */
function expectNoCharLoss(label: string, input: string): void {
  const tokens = parseInlineFormula(input);
  const flat = flattenInlineFormula(tokens);
  const stripped = input.replace(/[_^{}]/g, '');
  // Markers that were NOT consumed survive into the flattened text, so compare
  // both sides with every marker removed. Any other character loss shows up.
  const flatStripped = flat.replace(/[_^{}]/g, '');
  check(label, flatStripped === stripped, `input  ${JSON.stringify(input)}\n         flat   ${JSON.stringify(flatStripped)}\n         want   ${JSON.stringify(stripped)}`);
}

function countScripts(tokens: readonly InlineFormulaToken[]): number {
  let n = 0;
  for (const token of tokens) {
    if (token.kind !== 'text') n += 1 + countScripts(token.children);
  }
  return n;
}

// =====================================================================
console.log('\n--- 1. basic subscript / superscript forms ---');
// =====================================================================
expectFormat('bare subscript', 'P_RF', 'P[_RF]');
expectFormat('bare superscript', 'G^T', 'G[^T]');
expectFormat('single-letter subscript', 'P_t', 'P[_t]');
expectFormat('lowercase superscript', 'I^a + I^b', 'I[^a] + I[^b]');
expectFormat('greek base', 'η_PA', 'η[_PA]');
expectFormat('long word subscript', 'P_circuit', 'P[_circuit]');
expectFormat('digit-run base', '2^n', '2[^n]');
expectFormat('numeric subscript', 'N_0', 'N[_0]');
expectFormat('alphanumeric run', 'G_t2', 'G[_t2]');

// =====================================================================
console.log('\n--- 2. brace groups (the L_cl,NLoS rule) ---');
// =====================================================================
expectFormat('brace group keeps commas together', 'L_{cl,NLoS}', 'L[_cl,NLoS]');
expectFormat('brace group superscript', 'G^{max}', 'G[^max]');
expectFormat('brace group with comma + dot', 'G_{t,max}', 'G[_t,max]');
expectFormat('brace group with spaces', 'X_{a b}', 'X[_a b]');
// DOCUMENTED RULE: an UNBRACED run stops at the comma. In prose a comma is a
// clause separator far more often than part of a subscript, so eating past it
// would mangle sentences. Authors write L_{cl,NLoS} when they mean the pair.
expectFormat('unbraced comma stops the run', 'L_cl,NLoS', 'L[_cl],NLoS');
expectFormat('unbraced run stops at a full stop', 'P_total.', 'P[_total].');
expectFormat('unbraced run stops at a paren', 'P_total(t)', 'P[_total](t)');
expectFormat('unbraced run stops at CJK', 'P_total，單位', 'P[_total]，單位');

// =====================================================================
console.log('\n--- 3. chained sub + sup on one base ---');
// =====================================================================
expectFormat('X_a^b yields both', 'X_a^b', 'X[_a][^b]');
expectFormat('X^b_a yields both', 'X^b_a', 'X[^b][_a]');
expectFormat('chained with braces', 'X_{i,j}^{max}', 'X[_i,j][^max]');
expectFormat('a repeated kind is not chained twice', 'X_a_b', 'X[_a]_b');

// =====================================================================
console.log('\n--- 4. the 10^(P_tx/10) decision ---');
// =====================================================================
// DOCUMENTED RULE: `^(` is NOT raised. Raising a parenthesised exponent needs a
// second script level for `tx` (~10px in a 16px body), and a long raised run
// cannot wrap inside the 320px panel. The inner `P_tx` IS still typeset,
// because that part is unambiguous.
expectFormat('parenthesised exponent stays literal', '10^(P_tx/10)', '10^(P[_tx]/10)');
expectFormat('braced exponent is honoured instead', '10^{P/10}', '10[^P/10]');

// =====================================================================
console.log('\n--- 5. false-positive guards ---');
// =====================================================================
// The decisive rule: a base must be a single letter (or digit run) that is NOT
// itself preceded by a letter/digit/underscore. Every snake_case identifier
// fails it; every real symbol in the catalog passes it.
expectFormat('SCREAMING_SNAKE constant untouched', 'UI_TOKENS', 'UI_TOKENS');
expectFormat('multi-part constant untouched', 'MODQN_H2_SCENE', 'MODQN_H2_SCENE');
expectFormat('snake_case identifier untouched', 'data_source', 'data_source');
expectFormat('three-part snake_case untouched', 'foo_bar_baz', 'foo_bar_baz');
expectFormat('leading double underscore untouched', '__resetHelpPopoverStoreForTests', '__resetHelpPopoverStoreForTests');
// The base test reads the raw input, not the already-emitted text buffer, so a
// preceding script cannot "reset" it: the run swallows `RFx`, and the second
// `_` is then rejected because `x` is preceded by the letter `F`. Had the test
// looked at the buffer (empty right after a script) it would have wrongly
// treated `x` as a fresh single-letter base and produced `x` + <sub>y</sub>.
expectFormat('a script cannot re-base mid-identifier', 'P_RFx_y', 'P[_RFx]_y');
expectFormat('a script cannot re-base mid-identifier (2)', 'P_ab_c', 'P[_ab]_c');
expectFormat('CJK before the underscore does not trigger', '總功率_值', '總功率_值');
expectFormat('CJK after the underscore does not trigger', 'P_功率', 'P_功率');
expectFormat('CJK prose with an underscore survives', '這是中文句子_不要動它', '這是中文句子_不要動它');
expectFormat('a symbol embedded in CJK still converts', '總功率P_total是這個', '總功率P[_total]是這個');
expectFormat('file name untouched', 'my_file_name.txt', 'my_file_name.txt');
expectFormat('caret between words untouched', 'a^^b', 'a^^b');
expectFormat('over-long bare run untouched', 'X_abcdefghijklmnop', 'X_abcdefghijklmnop');

// =====================================================================
console.log('\n--- 6. Unicode that is already correct is never reprocessed ---');
// =====================================================================
const unicodeSamples = [
  'σ² ＝ N₀·B',
  'R ＝ (B ÷ K)·log₂(1+SINR)',
  'ΣJ ＝ Σ P_total(t)·Δt',
  '分母 I^a + I^b + σ² 是同一時刻的同頻干擾功率與熱雜訊功率之和。',
];
expectFormat('σ² / N₀ have no markers, pass straight through', 'σ² ＝ N₀·B', 'σ² ＝ N₀·B');
expectFormat('log₂ Shannon form passes straight through', 'R ＝ (B ÷ K)·log₂(1+SINR)', 'R ＝ (B ÷ K)·log₂(1+SINR)');
check(
  'no Unicode sub/sup character is ever consumed as markup',
  unicodeSamples.every((s) => {
    const flat = flattenInlineFormula(parseInlineFormula(s));
    return ['²', '₀', '₂'].every((glyph) => (s.split(glyph).length) === (flat.split(glyph).length));
  }),
);
check(
  'a marker-free string is returned as one untouched text token',
  (() => {
    const t = parseInlineFormula('σ² ＝ N₀·B');
    return t.length === 1 && t[0].kind === 'text' && t[0].text === 'σ² ＝ N₀·B';
  })(),
);

// =====================================================================
console.log('\n--- 7. edge cases must not throw or drop characters ---');
// =====================================================================
const edgeCases = [
  '',
  '_',
  '^',
  '__',
  '^^',
  'P_',
  'P^',
  'P_ ',
  '_P',
  '^P',
  'P_{',
  'P_{}',
  'P_{unclosed',
  'P_}',
  '{P_a}',
  'P_{a{b}c}',
  '   ',
  '1',
  '10^',
  '^_^',
  'P__RF',
  'P_^',
  'P^_',
  '。_。',
];
let edgeOk = true;
const edgeDetail: string[] = [];
for (const input of edgeCases) {
  try {
    const tokens = parseInlineFormula(input);
    const flat = flattenInlineFormula(tokens);
    const lhs = flat.replace(/[_^{}]/g, '');
    const rhs = input.replace(/[_^{}]/g, '');
    if (lhs !== rhs) {
      edgeOk = false;
      edgeDetail.push(`${JSON.stringify(input)} -> ${JSON.stringify(flat)}`);
    }
  } catch (error) {
    edgeOk = false;
    edgeDetail.push(`${JSON.stringify(input)} THREW ${String(error)}`);
  }
}
check('every edge case parses without throwing and without losing characters', edgeOk, edgeDetail.join('\n         '));
expectFormat('trailing underscore stays literal', 'P_', 'P_');
expectFormat('lone underscore stays literal', '_', '_');
expectFormat('empty brace group stays literal', 'P_{}', 'P_{}');
expectFormat('unclosed brace group stays literal', 'P_{unclosed', 'P_{unclosed');
expectFormat('nested brace group stays literal', 'P_{a{b}c}', 'P_{a{b}c}');
check('empty string yields no tokens', parseInlineFormula('').length === 0);

// =====================================================================
console.log('\n--- 8. nesting is depth-capped ---');
// =====================================================================
expectFormat('one level of nesting inside braces', 'X_{a_b}', 'X[_a[_b]]');
check(
  'nesting stops at two levels (no third <sub>)',
  countScripts(parseInlineFormula('X_{a_{b_c}}')) === 2,
  `tokens: ${fmt('X_{a_{b_c}}')}`,
);

// =====================================================================
console.log('\n--- 9. REAL catalog strings (verbatim from src/i18n/strings.ts) ---');
// =====================================================================
interface Fixture {
  readonly key: string;
  readonly input: string;
  readonly expected: string;
}

const CATALOG_FIXTURES: readonly Fixture[] = [
  {
    key: 'ZH param.maxTxPowerDbm.help',
    input: '衛星每道波束送出的訊號強度，以 dBm 表示。它決定 SINR 分子中的接收訊號功率；換算成瓦為 P_RF ＝ 10^(P_tx/10) ÷ 1000。',
    expected: '衛星每道波束送出的訊號強度，以 dBm 表示。它決定 SINR 分子中的接收訊號功率；換算成瓦為 P[_RF] ＝ 10^(P[_tx]/10) ÷ 1000。',
  },
  {
    key: 'ZH param.ueAntennaMaxGainDbi.help',
    input: '使用者裝置（手機／終端機）天線的接收增益 G^R，代表它把入射電波轉換成可用訊號功率的能力。',
    expected: '使用者裝置（手機／終端機）天線的接收增益 G[^R]，代表它把入射電波轉換成可用訊號功率的能力。',
  },
  {
    key: 'ZH param.paEfficiency.label',
    input: '功率放大器效率 η_PA',
    expected: '功率放大器效率 η[_PA]',
  },
  {
    key: 'ZH param.paEfficiency.effect',
    input: '效率越低，相同發射功率所需的輸入功率越大（P_PA ＝ P_RF ÷ η_PA），總功率上升、EE 下降；調高則相反，相同的訊號強度只需較少的電功率。',
    expected: '效率越低，相同發射功率所需的輸入功率越大（P[_PA] ＝ P[_RF] ÷ η[_PA]），總功率上升、EE 下降；調高則相反，相同的訊號強度只需較少的電功率。',
  },
  {
    key: 'ZH param.circuitPowerW.help',
    input: '功率放大器以外，衛星維持運作所需的固定電功率 P_circuit（處理器、冷卻與其他電路）。它與發射功率及傳輸量無關，直接加入總功率：P_total ＝ P_PA + P_circuit。',
    expected: '功率放大器以外，衛星維持運作所需的固定電功率 P[_circuit]（處理器、冷卻與其他電路）。它與發射功率及傳輸量無關，直接加入總功率：P[_total] ＝ P[_PA] + P[_circuit]。',
  },
  {
    key: 'ZH formula.sinr.symbolHelp',
    input: 'γ 即 SINR。分子 P_t · H · G^T · G^R 是發射功率經過通道衰減與收發天線增益之後，實際送達接收端的訊號功率；分母 I^a + I^b + σ² 是同一時刻的同頻干擾功率與熱雜訊功率之和。比值越大，訊號相對於干擾與雜訊越強。',
    expected: 'γ 即 SINR。分子 P[_t] · H · G[^T] · G[^R] 是發射功率經過通道衰減與收發天線增益之後，實際送達接收端的訊號功率；分母 I[^a] + I[^b] + σ² 是同一時刻的同頻干擾功率與熱雜訊功率之和。比值越大，訊號相對於干擾與雜訊越強。',
  },
  {
    key: 'ZH formula.energy.caption',
    input: '能量是功率對時間的累積：每個時間步消耗 P_total × Δt 焦耳，逐步加總即為累積耗能 ΣJ ＝ Σ P_total(t)·Δt。以相同方式累積各步送出的資料量，即得累積傳輸量 ΣMbit ＝ Σ R(t)·Δt。',
    expected: '能量是功率對時間的累積：每個時間步消耗 P[_total] × Δt 焦耳，逐步加總即為累積耗能 ΣJ ＝ Σ P[_total](t)·Δt。以相同方式累積各步送出的資料量，即得累積傳輸量 ΣMbit ＝ Σ R(t)·Δt。',
  },
  {
    key: 'ZH formula.power.caption',
    input: '發射功率先由 dBm 換算為瓦：P_RF ＝ 10^(P_tx/10) ÷ 1000。功率放大器每輸出 1 W 射頻功率需輸入 1/η_PA W 電功率，故 P_PA ＝ P_RF ÷ η_PA。再加上固定的電路功耗，即為此刻的系統總功率 P_total ＝ P_PA + P_circuit，單位為瓦（W）。',
    expected: '發射功率先由 dBm 換算為瓦：P[_RF] ＝ 10^(P[_tx]/10) ÷ 1000。功率放大器每輸出 1 W 射頻功率需輸入 1/η[_PA] W 電功率，故 P[_PA] ＝ P[_RF] ÷ η[_PA]。再加上固定的電路功耗，即為此刻的系統總功率 P[_total] ＝ P[_PA] + P[_circuit]，單位為瓦（W）。',
  },
  {
    key: 'ZH kpi.totalPower.help',
    input: '此刻衛星消耗的總電功率：P_total ＝ P_PA + P_circuit，單位為瓦（W）。將各時刻的 P_total 對時間累積，即得累積耗能。',
    expected: '此刻衛星消耗的總電功率：P[_total] ＝ P[_PA] + P[_circuit]，單位為瓦（W）。將各時刻的 P[_total] 對時間累積，即得累積耗能。',
  },
  {
    key: 'ZH kpi.cumulativeEnergy.help',
    input: '自模擬開始累積消耗的能量總量：ΣJ ＝ Σ P_total(t)·Δt，即各時間步的總功率乘上該步的時間長度後加總，單位為焦耳（J）。',
    expected: '自模擬開始累積消耗的能量總量：ΣJ ＝ Σ P[_total](t)·Δt，即各時間步的總功率乘上該步的時間長度後加總，單位為焦耳（J）。',
  },
  {
    key: 'ZH kpi.instantaneousEe.help',
    input: '此刻的吞吐量除以此刻的總功率：R ÷ P_total，單位 Mbit/J。它隨 SINR 與功率設定即時變動，用於觀察單一參數調整當下的效果。',
    expected: '此刻的吞吐量除以此刻的總功率：R ÷ P[_total]，單位 Mbit/J。它隨 SINR 與功率設定即時變動，用於觀察單一參數調整當下的效果。',
  },
  {
    key: 'EN param.maxTxPowerDbm.help',
    input: 'The signal strength each satellite beam transmits, in dBm. It sets the received signal power in the SINR numerator; in watts, P_RF = 10^(P_tx/10) ÷ 1000.',
    expected: 'The signal strength each satellite beam transmits, in dBm. It sets the received signal power in the SINR numerator; in watts, P[_RF] = 10^(P[_tx]/10) ÷ 1000.',
  },
  {
    key: 'EN param.paEfficiency.help',
    input: 'The efficiency η_PA with which the power amplifier converts input electrical power into RF output power, on a scale of 0 to 1. At η_PA = 0.4, each 1 W of RF output requires 2.5 W of input power; the remainder becomes heat.',
    expected: 'The efficiency η[_PA] with which the power amplifier converts input electrical power into RF output power, on a scale of 0 to 1. At η[_PA] = 0.4, each 1 W of RF output requires 2.5 W of input power; the remainder becomes heat.',
  },
  {
    key: 'EN formula.sinr.symbolHelp',
    input: 'γ is the SINR. The numerator P_t · H · G^T · G^R is the transmit power after channel loss and the transmit and receive antenna gains — the signal power that actually reaches the receiver. The denominator I^a + I^b + σ² is the co-channel interference power plus thermal noise power at that same instant. The larger the ratio, the stronger the signal relative to interference and noise.',
    expected: 'γ is the SINR. The numerator P[_t] · H · G[^T] · G[^R] is the transmit power after channel loss and the transmit and receive antenna gains — the signal power that actually reaches the receiver. The denominator I[^a] + I[^b] + σ² is the co-channel interference power plus thermal noise power at that same instant. The larger the ratio, the stronger the signal relative to interference and noise.',
  },
  {
    key: 'EN formula.ee.caption',
    input: 'Energy efficiency EE is a ratio: the numerator is the data delivered, the denominator is the energy consumed, in Mbit/J — how many megabits each joule of energy can carry. The larger the value, the less power the same data costs. Instantaneous EE takes R ÷ P_total at this moment; run EE takes ΣMbit ÷ ΣJ over the whole run.',
    expected: 'Energy efficiency EE is a ratio: the numerator is the data delivered, the denominator is the energy consumed, in Mbit/J — how many megabits each joule of energy can carry. The larger the value, the less power the same data costs. Instantaneous EE takes R ÷ P[_total] at this moment; run EE takes ΣMbit ÷ ΣJ over the whole run.',
  },
  {
    key: 'EN kpi.paInputPower.help',
    input: 'The input electrical power the amplifier requires to produce that RF output: P_PA = P_RF ÷ η_PA. The lower the efficiency, the more P_PA exceeds P_RF, and the difference becomes heat.',
    expected: 'The input electrical power the amplifier requires to produce that RF output: P[_PA] = P[_RF] ÷ η[_PA]. The lower the efficiency, the more P[_PA] exceeds P[_RF], and the difference becomes heat.',
  },
];

check(`at least 10 real catalog fixtures (have ${CATALOG_FIXTURES.length})`, CATALOG_FIXTURES.length >= 10);
for (const fixture of CATALOG_FIXTURES) {
  expectFormat(fixture.key, fixture.input, fixture.expected);
  expectNoCharLoss(`${fixture.key} — no characters lost`, fixture.input);
}

console.log('\n--- catalog rendering, side by side ---');
for (const fixture of CATALOG_FIXTURES) {
  console.log(`\n  ${fixture.key}`);
  console.log(`    in : ${fixture.input}`);
  console.log(`    out: ${fmt(fixture.input)}`);
}

// =====================================================================
console.log('\n--- 10. React output: real <sub>/<sup> elements reach the DOM ---');
// =====================================================================
// The parser is the interesting half, but the whole point is the markup, so
// assert on that too. `react-dom/server` is already a project dependency (the
// scripts/validate-*.tsx gates render panels with it), so this adds nothing.
function markupOf(text: string | undefined): string {
  return renderToStaticMarkup(<>{renderInlineFormula(text)}</>);
}

check(
  'a subscript renders as a real <sub> element',
  markupOf('P_RF').includes('<sub') && markupOf('P_RF').includes('</sub>'),
  markupOf('P_RF'),
);
check(
  'a superscript renders as a real <sup> element',
  markupOf('G^T').includes('<sup') && markupOf('G^T').includes('</sup>'),
  markupOf('G^T'),
);
check(
  'the underscore is gone from the rendered markup',
  !markupOf('P_RF').includes('_'),
  markupOf('P_RF'),
);
check(
  'line-height:0 is set so a script cannot stretch the CJK line box',
  markupOf('P_RF').includes('line-height:0'),
  markupOf('P_RF'),
);
check(
  'sub is offset with bottom, sup with top (not vertical-align)',
  markupOf('P_RF').includes('bottom:-0.22em') && markupOf('G^T').includes('top:-0.42em'),
  `${markupOf('P_RF')} | ${markupOf('G^T')}`,
);
check(
  'marker-free prose renders with no wrapper element at all',
  markupOf('這是一段沒有公式的中文說明。') === '這是一段沒有公式的中文說明。',
  markupOf('這是一段沒有公式的中文說明。'),
);
check(
  'a rejected snake_case identifier renders with no wrapper element',
  markupOf('UI_TOKENS') === 'UI_TOKENS',
  markupOf('UI_TOKENS'),
);
check('undefined copy renders as nothing', markupOf(undefined) === '', markupOf(undefined));
check('empty copy renders as nothing', markupOf('') === '', markupOf(''));
check(
  'the rendered text content still reads correctly',
  markupOf('10^(P_tx/10)') === '10^(P<sub style="font-size:0.78em;line-height:0;position:relative;vertical-align:baseline;bottom:-0.22em">tx</sub>/10)',
  markupOf('10^(P_tx/10)'),
);

console.log('\n--- rendered markup samples ---');
for (const sample of ['P_RF', 'G^T', 'L_{cl,NLoS}', 'X_a^b', '10^(P_tx/10)', 'UI_TOKENS']) {
  console.log(`  ${JSON.stringify(sample)}\n    -> ${markupOf(sample)}`);
}

// =====================================================================
// summary
// =====================================================================
if (failures.length > 0) {
  throw new Error(`[inline-formula] ${passed} passed, ${failures.length} failed: ${failures.join('; ')}`);
}
console.log(`\n[inline-formula] ${passed} passed, 0 failed`);
