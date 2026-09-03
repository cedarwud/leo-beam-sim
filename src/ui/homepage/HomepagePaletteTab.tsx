/**
 * Presentational catalogue for the homepage satellite identity palette.
 *
 * The tab owns no runtime state, clock, decision, snapshot, or route wiring.
 * Its swatches are resolved through the homepage controller's existing visual
 * identity API so the catalog cannot quietly grow a second colour system.
 */

import type { CSSProperties } from 'react';

import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import {
  HOMEPAGE_SATELLITE_COLOR_COUNT,
  HOMEPAGE_SATELLITE_HUE_FAMILIES,
  HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS,
  homepageSatelliteColorForBeam,
  type HomepageSatelliteVisualColor,
} from '../../homepage/controller/homepageSatelliteVisualIdentity';
import { txBi } from '../signal-tuning/labels';

type HomepagePaletteFamily = (typeof HOMEPAGE_SATELLITE_HUE_FAMILIES)[number];
type HomepagePaletteFamilyName = HomepagePaletteFamily['name'];
type ShadeRole = 'primary' | 'context';

/**
 * The identity API currently accepts a satellite ID rather than a direct
 * palette-family token. These IDs are lookup-only UI fixtures: they never
 * enter a scene, rail, decision, snapshot, or join key.
 */
const FAMILY_ZH_NAMES: Readonly<Record<HomepagePaletteFamilyName, string>> = {
  gold: '金色',
  blue: '藍色',
  green: '綠色',
  cyan: '青色',
  teal: '藍綠色',
  orange: '橙色',
};

interface PaletteFamilySwatches {
  readonly family: HomepagePaletteFamily;
  readonly primary: HomepageSatelliteVisualColor;
  readonly context: HomepageSatelliteVisualColor;
}

function buildPaletteFamilySwatches(): readonly PaletteFamilySwatches[] {
  return Object.freeze(HOMEPAGE_SATELLITE_HUE_FAMILIES.map((family, paletteIndex) => {
    const satelliteId = HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS[paletteIndex];
    if (satelliteId === undefined) {
      throw new Error(`homepage palette reference missing for family ${family.name}`);
    }
    const primary = homepageSatelliteColorForBeam(satelliteId, 0, { isServing: true });
    const context = homepageSatelliteColorForBeam(satelliteId, 0, { isServing: false });
    if (primary.paletteName !== family.name || context.paletteName !== family.name) {
      throw new Error(`homepage palette reference resolved to the wrong family for ${family.name}`);
    }
    return Object.freeze({
      family,
      // Beam 0 is a deterministic visual token; no live EE value is invented
      // for this reference catalog.
      primary,
      context,
    });
  }));
}

const PALETTE_FAMILY_SWATCHES = buildPaletteFamilySwatches();

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function familyLabel(family: HomepagePaletteFamily, isEnglish: boolean): string {
  const englishName = titleCase(family.name);
  return isEnglish ? englishName : `${FAMILY_ZH_NAMES[family.name]} · ${englishName}`;
}

function ShadeSwatch({
  color,
  role,
  isEnglish,
}: {
  readonly color: HomepageSatelliteVisualColor;
  readonly role: ShadeRole;
  readonly isEnglish: boolean;
}) {
  const primary = role === 'primary';
  const label = primary
    ? (isEnglish ? 'Primary' : '主要')
    : (isEnglish ? 'Context' : '背景');
  const hint = primary
    ? (isEnglish ? 'serving beam · vivid' : '服務波束 · 鮮明')
    : (isEnglish ? 'other beam · pale' : '其他波束 · 淡色');

  return (
    <div
      role="group"
      aria-label={`${label}; ${hint}`}
      data-testid="homepage-palette-swatch"
      data-shade-role={role}
      data-shade-index={String(color.shadeIndex)}
      data-color-token={color.color}
      style={styles.swatch}
    >
      <span
        aria-hidden="true"
        style={{
          ...styles.swatchChip,
          backgroundColor: color.color,
          borderColor: color.baseColor,
          boxShadow: `inset 0 0 0 2px ${color.emissiveColor}`,
        }}
      />
      <span style={styles.swatchCopy}>
        <strong style={styles.swatchLabel}>{label}</strong>
        <small style={styles.swatchHint}>{hint}</small>
      </span>
    </div>
  );
}

export function HomepagePaletteTab() {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string): string => txBi(t, isEnglish, key, zh, en);

  return (
    <section
      className="leo-homepage-palette-tab"
      aria-label={say('homepage.palette.ariaLabel', '首頁衛星色彩家族', 'Homepage satellite colour families')}
      data-testid="homepage-palette-tab"
      data-family-count={String(HOMEPAGE_SATELLITE_COLOR_COUNT)}
      style={styles.root}
    >
      <header style={styles.header}>
        <p style={styles.eyebrow}>HOMEPAGE · IDENTITY</p>
        <h2 style={styles.title} data-testid="homepage-palette-title">
          {say('homepage.palette.title', '衛星色彩家族', 'Satellite colour families')}
        </h2>
        <p style={styles.description}>
          {say(
            'homepage.palette.description',
            '同一顆衛星沿用同一個色相家族；角色只改變明暗與飽和度。',
            'A satellite keeps one hue family; role changes only the shade and intensity.',
          )}
        </p>
      </header>

      <div
        role="group"
        aria-label={say('homepage.palette.shadeKey', '色票角色說明', 'Shade roles')}
        data-testid="homepage-palette-shade-key"
        style={styles.legend}
      >
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, backgroundColor: UI_TOKENS.color.semantic.serving.accent }} aria-hidden="true" />
          <span>
            <strong>{say('homepage.palette.primary', '主要 · 服務波束', 'Primary · serving beam')}</strong>
            <small style={styles.legendHint}>{say('homepage.palette.primaryHint', '鮮明色票', 'vivid shade')}</small>
          </span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, backgroundColor: UI_TOKENS.color.text.muted }} aria-hidden="true" />
          <span>
            <strong>{say('homepage.palette.context', '背景 · 其他波束', 'Context · other beam')}</strong>
            <small style={styles.legendHint}>{say('homepage.palette.contextHint', '淡色票', 'pale shade')}</small>
          </span>
        </div>
      </div>

      <ul
        aria-label={say('homepage.palette.familyList', '六組色彩家族', 'Six hue families')}
        data-testid="homepage-palette-family-list"
        style={styles.familyList}
      >
        {PALETTE_FAMILY_SWATCHES.map(({ family, primary, context }) => (
          <li
            key={family.name}
            data-testid="homepage-palette-family"
            data-palette-index={String(primary.paletteIndex)}
            data-family-name={family.name}
            data-hue-degrees={String(family.hueDegrees)}
            style={styles.family}
          >
            <div style={styles.familyHeader}>
              <span
                aria-hidden="true"
                style={{ ...styles.familyMarker, backgroundColor: primary.baseColor }}
              />
              <h3 style={styles.familyName}>{familyLabel(family, isEnglish)}</h3>
              <span style={styles.hueLabel}>{family.hueDegrees}°</span>
            </div>
            <div
              role="group"
              aria-label={`${familyLabel(family, isEnglish)} ${isEnglish ? 'shade relationship' : '明暗關係'}`}
              style={styles.shadeRow}
            >
              <ShadeSwatch color={primary} role="primary" isEnglish={isEnglish} />
              <span aria-hidden="true" style={styles.arrow}>→</span>
              <ShadeSwatch color={context} role="context" isEnglish={isEnglish} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  root: {
    boxSizing: 'border-box',
    display: 'grid',
    gap: '16px',
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    alignContent: 'start',
    padding: '16px',
    color: UI_TOKENS.color.text.primary,
    backgroundColor: '#06131b',
    fontFamily: 'inherit',
  },
  header: { display: 'grid', gap: '4px', minWidth: 0 },
  eyebrow: {
    margin: 0,
    color: UI_TOKENS.color.text.muted,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    lineHeight: 1.25,
  },
  title: {
    margin: 0,
    color: UI_TOKENS.color.text.primary,
    fontSize: '24px',
    lineHeight: 1.15,
  },
  description: {
    margin: 0,
    color: UI_TOKENS.color.text.secondary,
    fontSize: '14px',
    lineHeight: 1.45,
  },
  legend: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
    padding: '10px',
    border: `1px solid ${UI_TOKENS.color.border.soft}`,
    borderRadius: UI_TOKENS.radius.md,
    backgroundColor: UI_TOKENS.color.surface.cardFaint,
  },
  legendItem: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr)',
    alignItems: 'start',
    gap: '8px',
    minWidth: 0,
    color: UI_TOKENS.color.text.label,
    fontSize: '14px',
    lineHeight: 1.3,
  },
  legendDot: { width: '10px', height: '10px', marginTop: '3px', borderRadius: '50%' },
  legendHint: { display: 'block', color: UI_TOKENS.color.text.faint, fontSize: '13px' },
  familyList: {
    display: 'grid',
    gap: '10px',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  family: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
    padding: '12px',
    border: `1px solid ${UI_TOKENS.color.border.soft}`,
    borderRadius: UI_TOKENS.radius.md,
    backgroundColor: UI_TOKENS.color.surface.cardSubtle,
  },
  familyHeader: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  familyMarker: { flex: '0 0 auto', width: '12px', height: '12px', borderRadius: '50%' },
  familyName: {
    minWidth: 0,
    margin: 0,
    color: UI_TOKENS.color.text.primary,
    fontSize: '17px',
    fontWeight: 700,
    lineHeight: 1.25,
  },
  hueLabel: {
    flex: '0 0 auto',
    marginInlineStart: 'auto',
    color: UI_TOKENS.color.text.faint,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
  },
  shadeRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 18px minmax(0, 1fr)',
    alignItems: 'stretch',
    gap: '6px',
    minWidth: 0,
  },
  swatch: {
    display: 'grid',
    gridTemplateColumns: '26px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    padding: '8px',
    border: `1px solid ${UI_TOKENS.color.border.subtle}`,
    borderRadius: UI_TOKENS.radius.sm,
    backgroundColor: UI_TOKENS.color.surface.cardFaint,
  },
  swatchChip: { width: '24px', height: '24px', border: '1px solid', borderRadius: UI_TOKENS.radius.sm },
  swatchCopy: { display: 'grid', gap: '2px', minWidth: 0 },
  swatchLabel: { color: UI_TOKENS.color.text.primary, fontSize: '14px', lineHeight: 1.2 },
  swatchHint: { color: UI_TOKENS.color.text.faint, fontSize: '13px', lineHeight: 1.2 },
  arrow: {
    alignSelf: 'center',
    color: UI_TOKENS.color.text.faint,
    fontSize: '18px',
    textAlign: 'center',
  },
};
