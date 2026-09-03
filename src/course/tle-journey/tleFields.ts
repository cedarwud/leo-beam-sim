/**
 * Act 2 station 2 — the 69 columns of a TLE, decoded field by field.
 *
 * The teaching point is that a satellite's whole future position comes out of
 * two 69-character lines, and that one wrong digit is caught by the last one.
 * So the columns are data here, not prose: the highlighter, the explanation
 * cards and the checksum demo all read the same table.
 *
 * Column numbers are the standard 1-indexed inclusive ranges from the TLE
 * format, converted to slice bounds at the edge.
 */

export const TLE_LINE_LENGTH = 69;

export type TleLineNumber = 1 | 2;

export interface TleFieldSpec {
  readonly id: string;
  readonly line: TleLineNumber;
  /** 1-indexed inclusive TLE columns, as the format documents them. */
  readonly startColumn: number;
  readonly endColumn: number;
  readonly labelZhHant: string;
  readonly explainZhHant: string;
  /** Fields the lecture actually stops on; the rest are shown but not narrated. */
  readonly narrated: boolean;
}

export const TLE_FIELDS: readonly TleFieldSpec[] = Object.freeze([
  Object.freeze({ id: 'l1-line', line: 1 as const, startColumn: 1, endColumn: 1, labelZhHant: '行號', explainZhHant: '此為第一行。TLE 包含兩行軌道元素，另加一行名稱。', narrated: false }),
  Object.freeze({ id: 'l1-catalog', line: 1 as const, startColumn: 3, endColumn: 7, labelZhHant: 'NORAD 編號', explainZhHant: '該衛星在美國太空監視網目錄中的識別編號，作為跨資料源的識別鍵。', narrated: true }),
  Object.freeze({ id: 'l1-classification', line: 1 as const, startColumn: 8, endColumn: 8, labelZhHant: '資料分類', explainZhHant: 'U 表示公開資料。', narrated: false }),
  Object.freeze({ id: 'l1-intl', line: 1 as const, startColumn: 10, endColumn: 17, labelZhHant: '國際標識', explainZhHant: '發射年份＋當年第幾次發射＋同批第幾個物件。', narrated: false }),
  Object.freeze({ id: 'l1-epoch', line: 1 as const, startColumn: 19, endColumn: 32, labelZhHant: 'Epoch（觀測時刻）', explainZhHant: '該數值定義軌道元素的參考時刻。前兩位為年份，後續為該年的日序（含小數）；距離參考時刻越遠，推算誤差通常越大。', narrated: true }),
  Object.freeze({ id: 'l1-ndot', line: 1 as const, startColumn: 34, endColumn: 43, labelZhHant: '平均運動一階導數／2', explainZhHant: '表示平均運動的變化率，可反映大氣阻力造成的軌道衰減。', narrated: false }),
  Object.freeze({ id: 'l1-nddot', line: 1 as const, startColumn: 45, endColumn: 52, labelZhHant: '二階導數／6', explainZhHant: '多數資料接近 0；SGP4 對此欄位的使用有限。', narrated: false }),
  Object.freeze({ id: 'l1-bstar', line: 1 as const, startColumn: 54, endColumn: 61, labelZhHant: 'B* 阻力項', explainZhHant: '表示大氣阻力對軌道的影響程度；欄位採用隱含小數點格式。', narrated: false }),
  Object.freeze({ id: 'l1-ephem', line: 1 as const, startColumn: 63, endColumn: 63, labelZhHant: '星曆型別', explainZhHant: '公開資料一律是 0。', narrated: false }),
  Object.freeze({ id: 'l1-setnum', line: 1 as const, startColumn: 65, endColumn: 68, labelZhHant: '元素集編號', explainZhHant: '該衛星軌道元素資料的發布序號。', narrated: false }),
  Object.freeze({ id: 'l1-checksum', line: 1 as const, startColumn: 69, endColumn: 69, labelZhHant: '檢核碼', explainZhHant: '取前 68 個字元的數字總和（負號計為 1）的個位數。任一欄位改變都可能使檢核失敗。', narrated: true }),

  Object.freeze({ id: 'l2-line', line: 2 as const, startColumn: 1, endColumn: 1, labelZhHant: '行號', explainZhHant: '第二行。', narrated: false }),
  Object.freeze({ id: 'l2-catalog', line: 2 as const, startColumn: 3, endColumn: 7, labelZhHant: 'NORAD 編號', explainZhHant: '須與第一行一致，否則兩行不屬於同一衛星。', narrated: false }),
  Object.freeze({ id: 'l2-inclination', line: 2 as const, startColumn: 9, endColumn: 16, labelZhHant: '傾角 i', explainZhHant: '軌道面和赤道的夾角。87.9° 幾乎垂直——這就是「極軌」，它會飛過南北極。53° 就不會。', narrated: true }),
  Object.freeze({ id: 'l2-raan', line: 2 as const, startColumn: 18, endColumn: 25, labelZhHant: '升交點赤經 Ω', explainZhHant: '描述軌道平面在慣性空間中的方向；傾角相同而 Ω 不同，代表不同軌道平面。', narrated: false }),
  Object.freeze({ id: 'l2-ecc', line: 2 as const, startColumn: 27, endColumn: 33, labelZhHant: '離心率 e', explainZhHant: '前導 0 省略；0.0001578 表示軌道接近圓形。', narrated: false }),
  Object.freeze({ id: 'l2-argp', line: 2 as const, startColumn: 35, endColumn: 42, labelZhHant: '近地點幅角 ω', explainZhHant: '表示橢圓軌道近地點在軌道平面中的位置；圓軌道時其辨識度較低。', narrated: false }),
  Object.freeze({ id: 'l2-anomaly', line: 2 as const, startColumn: 44, endColumn: 51, labelZhHant: '平近點角 M', explainZhHant: '表示 epoch 時刻衛星在軌道上的相位位置。', narrated: false }),
  Object.freeze({ id: 'l2-meanmotion', line: 2 as const, startColumn: 53, endColumn: 63, labelZhHant: '平均運動 n', explainZhHant: '表示每日公轉圈數；以 1440 分鐘除以此值可得到軌道週期。', narrated: true }),
  Object.freeze({ id: 'l2-revnum', line: 2 as const, startColumn: 64, endColumn: 68, labelZhHant: '繞行圈數', explainZhHant: '表示自發射至 epoch 時刻的累積公轉圈數。', narrated: false }),
  Object.freeze({ id: 'l2-checksum', line: 2 as const, startColumn: 69, endColumn: 69, labelZhHant: '檢核碼', explainZhHant: '和第一行同樣的規則。', narrated: false }),
]);

export interface TleDecodedField extends TleFieldSpec {
  /** The raw characters, exactly as they sit in the line. */
  readonly raw: string;
}

export function decodeTleFields(line: string, lineNumber: TleLineNumber): readonly TleDecodedField[] {
  return TLE_FIELDS
    .filter(field => field.line === lineNumber)
    .map(field => Object.freeze({
      ...field,
      raw: line.slice(field.startColumn - 1, field.endColumn),
    }));
}

/** Which field covers a column, so a hover can name what it is touching. */
export function tleFieldAtColumn(
  columnIndex: number,
  lineNumber: TleLineNumber,
): TleFieldSpec | null {
  const column = columnIndex + 1;
  return TLE_FIELDS.find(field =>
    field.line === lineNumber
    && column >= field.startColumn
    && column <= field.endColumn) ?? null;
}

/* -- checksum -------------------------------------------------------------- */

export interface TleChecksumResult {
  readonly expected: number;
  readonly actual: number;
  readonly valid: boolean;
}

/** Digits sum, a minus sign counts as 1, everything else as 0; take mod 10. */
export function tleChecksum(line: string): TleChecksumResult {
  let sum = 0;
  for (const character of line.slice(0, TLE_LINE_LENGTH - 1)) {
    if (character >= '0' && character <= '9') sum += Number(character);
    else if (character === '-') sum += 1;
  }
  const expected = sum % 10;
  const actual = Number(line[TLE_LINE_LENGTH - 1]);
  return Object.freeze({
    expected,
    actual,
    valid: Number.isFinite(actual) && expected === actual,
  });
}

/* -- derived quantities ---------------------------------------------------- */

export interface TleDerivedFacts {
  readonly meanMotionRevPerDay: number;
  readonly orbitalPeriodMin: number;
  readonly inclinationDeg: number;
  readonly epochUtc: string;
  readonly epochYear: number;
  readonly epochDayOfYear: number;
}

/**
 * The two numbers the lecture derives on screen.
 *
 * Period comes straight from mean motion: 1440 minutes in a day divided by
 * revolutions per day. That single division is the whole "13 圈/天 → 109 分鐘"
 * moment, so it is computed rather than written down.
 */
export function deriveTleFacts(line1: string, line2: string): TleDerivedFacts {
  const meanMotionRevPerDay = Number(line2.slice(52, 63));
  const inclinationDeg = Number(line2.slice(8, 16));
  const epochRaw = line1.slice(18, 32);
  const twoDigitYear = Number(epochRaw.slice(0, 2));
  const epochDayOfYear = Number(epochRaw.slice(2));
  const epochYear = twoDigitYear < 57 ? 2000 + twoDigitYear : 1900 + twoDigitYear;

  if (!Number.isFinite(meanMotionRevPerDay) || meanMotionRevPerDay <= 0) {
    throw new RangeError('TLE line 2 carries no usable mean motion');
  }
  if (!Number.isFinite(epochDayOfYear) || epochDayOfYear <= 0) {
    throw new RangeError('TLE line 1 carries no usable epoch');
  }

  const yearStartMs = Date.UTC(epochYear, 0, 1);
  const epochMs = yearStartMs + (epochDayOfYear - 1) * 86_400_000;

  return Object.freeze({
    meanMotionRevPerDay,
    orbitalPeriodMin: 1440 / meanMotionRevPerDay,
    inclinationDeg,
    epochUtc: new Date(epochMs).toISOString(),
    epochYear,
    epochDayOfYear,
  });
}

export interface TleColumnWalkSubtitle {
  readonly fieldId: string;
  readonly labelZhHant: string;
  readonly lineColumnZhHant: string;
  readonly rawValue: string;
  readonly keyPointZhHant: string;
}

type TleColumnWalkKeyPoint = (
  facts: TleDerivedFacts,
  rawValue: string,
) => string;

/**
 * The five narrated fields share one source of truth with the scanner.  The
 * helper keeps the bottom caption tied to selectedFieldId in both autoplay
 * and paused/manual modes, while retaining the derived values in the copy.
 */
const TLE_COLUMN_WALK_KEY_POINTS: Readonly<Record<string, TleColumnWalkKeyPoint>> = Object.freeze({
  'l1-epoch': (facts, rawValue) =>
    `它是這組軌道元素的時間基準；${rawValue} 表示 ${facts.epochYear} 年第 ${facts.epochDayOfYear.toFixed(8)} 日。SGP4 以此刻為起點推進到指定時刻，距離 Epoch 越遠，資料適用性與推算誤差越需要另外評估。`,
  'l1-checksum': (_facts, rawValue) =>
    `它是第一行前 68 欄的快速完整性檢查：數字相加、負號計 1，再取 mod 10，結果為 ${rawValue}。失敗時系統 fail-closed，不載入這筆資料；通過 checksum 仍須再通過完整 TLE 格式、欄位一致性與軌道傳播檢查。`,
  'l2-inclination': (facts, rawValue) =>
    `它定義軌道面相對赤道面的傾斜，本筆為 ${facts.inclinationDeg.toFixed(4)}°（原始欄位 ${rawValue}）；這會限制地面軌跡可達的緯度範圍，並影響後續 SGP4 狀態與地面觀測幾何。`,
  'l2-meanmotion': (facts, rawValue) =>
    `它是平均每日公轉圈數；SGP4 以此決定軌道的時間尺度。本筆週期為 1440 ÷ ${rawValue} = ${facts.orbitalPeriodMin.toFixed(1)} 分鐘，後續一圈地固軌跡與地面通過時序都以此為基礎。`,
  'l2-checksum': (_facts, rawValue) =>
    `它是第二行前 68 欄的快速完整性檢查：數字相加、負號計 1，再取 mod 10，結果為 ${rawValue}。失敗時系統 fail-closed，不把資料送進 SGP4；通過 checksum 仍須再通過完整 TLE 格式、兩行一致性與軌道傳播檢查。`,
});

export function getTleColumnWalkSubtitle(
  fieldId: string,
  line1: string,
  line2: string,
  facts: TleDerivedFacts,
): TleColumnWalkSubtitle {
  const field = TLE_FIELDS.find(candidate => candidate.id === fieldId)
    ?? TLE_FIELDS.find(candidate => candidate.id === 'l2-meanmotion')!;
  const sourceLine = field.line === 1 ? line1 : line2;
  const rawValue = sourceLine.slice(field.startColumn - 1, field.endColumn).trim();
  const keyPoint = TLE_COLUMN_WALK_KEY_POINTS[field.id]?.(facts, rawValue) ?? field.explainZhHant;
  const columnRange = field.startColumn === field.endColumn
    ? `${field.startColumn}`
    : `${field.startColumn}–${field.endColumn}`;

  return Object.freeze({
    fieldId: field.id,
    labelZhHant: field.labelZhHant,
    lineColumnZhHant: `第 ${field.line} 行 · 第 ${columnRange} 欄`,
    rawValue,
    keyPointZhHant: keyPoint,
  });
}
