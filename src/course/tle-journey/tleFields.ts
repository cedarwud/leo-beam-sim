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
  Object.freeze({ id: 'l1-line', line: 1 as const, startColumn: 1, endColumn: 1, labelZhHant: '行號', explainZhHant: '這是第一行。TLE 一律兩行，加上名稱行就是三行。', narrated: false }),
  Object.freeze({ id: 'l1-catalog', line: 1 as const, startColumn: 3, endColumn: 7, labelZhHant: 'NORAD 編號', explainZhHant: '這顆衛星在美國太空監視網目錄裡的號碼，全世界通用的身分證。', narrated: true }),
  Object.freeze({ id: 'l1-classification', line: 1 as const, startColumn: 8, endColumn: 8, labelZhHant: '密級', explainZhHant: 'U = 公開。你能拿到這份資料就是因為它是 U。', narrated: false }),
  Object.freeze({ id: 'l1-intl', line: 1 as const, startColumn: 10, endColumn: 17, labelZhHant: '國際標識', explainZhHant: '發射年份＋當年第幾次發射＋同批第幾個物件。', narrated: false }),
  Object.freeze({ id: 'l1-epoch', line: 1 as const, startColumn: 19, endColumn: 32, labelZhHant: 'Epoch（觀測時刻）', explainZhHant: '這組數字描述的是「哪一瞬間」的軌道。前兩位是年、後面是當年的第幾天（含小數）。離這個時刻越遠，推算誤差越大。', narrated: true }),
  Object.freeze({ id: 'l1-ndot', line: 1 as const, startColumn: 34, endColumn: 43, labelZhHant: '平均運動一階導數／2', explainZhHant: '軌道衰減得多快。大氣把衛星往下拉，它就越飛越快。', narrated: false }),
  Object.freeze({ id: 'l1-nddot', line: 1 as const, startColumn: 45, endColumn: 52, labelZhHant: '二階導數／6', explainZhHant: '幾乎都是 0，SGP4 用得很少。', narrated: false }),
  Object.freeze({ id: 'l1-bstar', line: 1 as const, startColumn: 54, endColumn: 61, labelZhHant: 'B* 阻力項', explainZhHant: '衛星「多容易被大氣拖住」。隱含小數點，寫法很省字。', narrated: false }),
  Object.freeze({ id: 'l1-ephem', line: 1 as const, startColumn: 63, endColumn: 63, labelZhHant: '星曆型別', explainZhHant: '公開資料一律是 0。', narrated: false }),
  Object.freeze({ id: 'l1-setnum', line: 1 as const, startColumn: 65, endColumn: 68, labelZhHant: '元素集編號', explainZhHant: '這是第幾次發布這顆衛星的軌道。', narrated: false }),
  Object.freeze({ id: 'l1-checksum', line: 1 as const, startColumn: 69, endColumn: 69, labelZhHant: '檢核碼', explainZhHant: '前 68 個字元的數字總和（負號算 1）取個位數。改壞任何一位，這裡就對不上。', narrated: true }),

  Object.freeze({ id: 'l2-line', line: 2 as const, startColumn: 1, endColumn: 1, labelZhHant: '行號', explainZhHant: '第二行。', narrated: false }),
  Object.freeze({ id: 'l2-catalog', line: 2 as const, startColumn: 3, endColumn: 7, labelZhHant: 'NORAD 編號', explainZhHant: '必須和第一行一樣，否則兩行不是同一顆衛星。', narrated: false }),
  Object.freeze({ id: 'l2-inclination', line: 2 as const, startColumn: 9, endColumn: 16, labelZhHant: '傾角 i', explainZhHant: '軌道面和赤道的夾角。87.9° 幾乎垂直——這就是「極軌」，它會飛過南北極。53° 就不會。', narrated: true }),
  Object.freeze({ id: 'l2-raan', line: 2 as const, startColumn: 18, endColumn: 25, labelZhHant: '升交點赤經 Ω', explainZhHant: '軌道面在空間中「轉到哪個方向」。同一個傾角、不同 Ω，就是不同的軌道平面。', narrated: false }),
  Object.freeze({ id: 'l2-ecc', line: 2 as const, startColumn: 27, endColumn: 33, labelZhHant: '離心率 e', explainZhHant: '前面省略了「0.」。0.0001578 幾乎是完美的圓。', narrated: false }),
  Object.freeze({ id: 'l2-argp', line: 2 as const, startColumn: 35, endColumn: 42, labelZhHant: '近地點幅角 ω', explainZhHant: '橢圓最低點落在軌道的哪個位置。圓軌道時這個值意義不大。', narrated: false }),
  Object.freeze({ id: 'l2-anomaly', line: 2 as const, startColumn: 44, endColumn: 51, labelZhHant: '平近點角 M', explainZhHant: '在 epoch 那一刻，衛星跑到軌道上的哪裡。', narrated: false }),
  Object.freeze({ id: 'l2-meanmotion', line: 2 as const, startColumn: 53, endColumn: 63, labelZhHant: '平均運動 n', explainZhHant: '一天繞地球幾圈。把 1440 分鐘除以它，就得到週期。', narrated: true }),
  Object.freeze({ id: 'l2-revnum', line: 2 as const, startColumn: 64, endColumn: 68, labelZhHant: '繞行圈數', explainZhHant: '從發射到 epoch 為止總共繞了幾圈。', narrated: false }),
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
