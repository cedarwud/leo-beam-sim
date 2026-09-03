import type { CSSProperties } from 'react';

import { useLocale } from '../../i18n';
import {
  HOMEPAGE_SATELLITE_COLOR_COUNT,
  HOMEPAGE_SATELLITE_HUE_FAMILIES,
  HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS,
  homepageSatelliteColorForBeam,
} from '../../homepage/controller/homepageSatelliteVisualIdentity';
import { txBi } from '../signal-tuning/labels';

type HomepageHueFamily = (typeof HOMEPAGE_SATELLITE_HUE_FAMILIES)[number];

const FAMILY_ZH_NAMES: Readonly<Record<HomepageHueFamily['name'], string>> = {
  gold: '金色',
  blue: '藍色',
  green: '綠色',
  cyan: '青色',
  teal: '藍綠色',
  orange: '橙色',
};

const REFERENCE_BEAM_ID = 0;

function colorForFamily(
  familyIndex: number,
  isServing: boolean,
  shadeIndex: number,
) {
  const satelliteId = HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS[familyIndex];
  if (satelliteId === undefined) throw new Error(`missing homepage palette reference ${familyIndex}`);
  return homepageSatelliteColorForBeam(satelliteId, REFERENCE_BEAM_ID, {
    isServing,
    // The catalogue makes the four EE shade buckets explicit without creating
    // a live metric or another colour authority.
    eeNormalized: (shadeIndex + 0.5) / 4,
  });
}

function familyLabel(family: HomepageHueFamily, isEnglish: boolean): string {
  return isEnglish ? family.name[0]!.toUpperCase() + family.name.slice(1) : `${FAMILY_ZH_NAMES[family.name]} · ${family.name}`;
}

function ColorRow({
  family,
  isServing,
  isEnglish,
}: {
  readonly family: HomepageHueFamily;
  readonly isServing: boolean;
  readonly isEnglish: boolean;
}) {
  const role = isServing ? 'serving' : 'context';
  const label = isServing
    ? (isEnglish ? 'Serving / primary' : '服務 / 主要')
    : (isEnglish ? 'Other beams / context' : '其他波束 / 背景');
  return (
    <div
      role="group"
      aria-label={`${familyLabel(family, isEnglish)} ${label}`}
      data-testid="homepage-beam-colors-row"
      data-shade-role={role}
      style={styles.row}
    >
      <span style={styles.rowLabel}>{label}</span>
      <div style={styles.swatches}>
        {Array.from({ length: 4 }, (_, shadeIndex) => {
          const color = colorForFamily(
            HOMEPAGE_SATELLITE_HUE_FAMILIES.indexOf(family),
            isServing,
            shadeIndex,
          );
          return (
            <div
              key={`${role}-${shadeIndex}`}
              data-testid="homepage-beam-color-swatch"
              data-family-name={family.name}
              data-shade-role={role}
              data-shade-index={String(color.shadeIndex)}
              data-color-token={color.color}
              style={styles.swatch}
              title={`${family.name} · ${role} · EE shade ${shadeIndex + 1}/4`}
            >
              <span aria-hidden="true" style={{ ...styles.chip, backgroundColor: color.color, borderColor: color.baseColor }} />
              <span style={styles.swatchText}>{shadeIndex + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HomepageBeamColorsPage() {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string): string => txBi(t, isEnglish, key, zh, en);

  return (
    <main
      lang={isEnglish ? 'en' : 'zh-Hant'}
      data-testid="homepage-beam-colors-page"
      data-family-count={String(HOMEPAGE_SATELLITE_COLOR_COUNT)}
      style={styles.page}
    >
      <header style={styles.header}>
        <a href="/" style={styles.backLink}>{say('homepage.palette.back', '← 回到首頁', '← Back to homepage')}</a>
        <p style={styles.eyebrow}>HOMEPAGE · BEAM IDENTITY</p>
        <h1 style={styles.title}>{say('homepage.palette.pageTitle', '波束色彩表', 'Beam colour catalogue')}</h1>
        <p style={styles.description}>
          {say(
            'homepage.palette.pageDescription',
            '六組色相；同一顆衛星的所有波束只在同一色系內依 EE 改變深淺。',
            'Six hue families; every beam of one satellite stays in that hue family and changes shade only with EE.',
          )}
        </p>
      </header>
      <div style={styles.legend}>
        <span><i style={{ ...styles.legendDot, background: '#76ead7' }} />{say('homepage.palette.serving', '服務波束', 'Serving beam')}</span>
        <span><i style={{ ...styles.legendDot, background: '#6f9fbd' }} />{say('homepage.palette.context', '其他波束', 'Other beams')}</span>
        <span style={styles.legendNote}>{say('homepage.palette.eeShades', '左→右：EE 低→高', 'Left → right: low → high EE')}</span>
      </div>
      <section aria-label={say('homepage.palette.familyList', '六組色彩家族', 'Six hue families')} style={styles.familyGrid}>
        {HOMEPAGE_SATELLITE_HUE_FAMILIES.map(family => (
          <article
            key={family.name}
            data-testid="homepage-beam-color-family"
            data-family-name={family.name}
            data-hue-degrees={String(family.hueDegrees)}
            style={styles.family}
          >
            <div style={styles.familyHeader}>
              <span style={{ ...styles.familyDot, backgroundColor: colorForFamily(HOMEPAGE_SATELLITE_HUE_FAMILIES.indexOf(family), true, 1).baseColor }} />
              <h2 style={styles.familyTitle}>{familyLabel(family, isEnglish)}</h2>
              <span style={styles.hue}>{family.hueDegrees}°</span>
            </div>
            <ColorRow family={family} isServing isEnglish={isEnglish} />
            <ColorRow family={family} isServing={false} isEnglish={isEnglish} />
          </article>
        ))}
      </section>
    </main>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  page: {
    boxSizing: 'border-box',
    minHeight: '100vh',
    padding: 'clamp(20px, 4vw, 56px)',
    color: '#f1fbff',
    background: '#020b12',
    fontFamily: 'inherit',
  },
  header: { display: 'grid', gap: '8px', maxWidth: '920px', margin: '0 auto 24px' },
  backLink: { color: '#76ead7', fontWeight: 700, textDecoration: 'none' },
  eyebrow: { margin: 0, color: 'rgba(157, 202, 218, .68)', fontSize: '12px', fontWeight: 700, letterSpacing: '.1em' },
  title: { margin: 0, fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 },
  description: { margin: 0, maxWidth: '760px', color: 'rgba(229, 244, 251, .78)', fontSize: '17px', lineHeight: 1.5 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '12px 20px', maxWidth: '920px', margin: '0 auto 18px', padding: '12px 14px', border: '1px solid rgba(218, 244, 255, .16)', borderRadius: '10px', background: '#06131b', color: '#dbeef4', fontSize: '14px' },
  legendDot: { display: 'inline-block', width: '10px', height: '10px', marginRight: '6px', borderRadius: '50%' },
  legendNote: { color: 'rgba(229, 244, 251, .62)' },
  familyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px', maxWidth: '920px', margin: '0 auto' },
  family: { display: 'grid', gap: '12px', padding: '16px', border: '1px solid rgba(218, 244, 255, .16)', borderRadius: '12px', background: '#06131b' },
  familyHeader: { display: 'flex', alignItems: 'center', gap: '9px' },
  familyDot: { width: '14px', height: '14px', borderRadius: '50%' },
  familyTitle: { margin: 0, fontSize: '20px' },
  hue: { marginInlineStart: 'auto', color: 'rgba(229, 244, 251, .58)', fontVariantNumeric: 'tabular-nums' },
  row: { display: 'grid', gridTemplateColumns: '132px minmax(0, 1fr)', alignItems: 'center', gap: '10px' },
  rowLabel: { color: 'rgba(229, 244, 251, .76)', fontSize: '13px', lineHeight: 1.25 },
  swatches: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' },
  swatch: { display: 'grid', justifyItems: 'center', gap: '3px', padding: '5px', border: '1px solid rgba(218, 244, 255, .12)', borderRadius: '7px', background: 'rgba(7, 25, 34, .86)' },
  chip: { width: '100%', height: '20px', border: '1px solid', borderRadius: '4px' },
  swatchText: { color: 'rgba(229, 244, 251, .56)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' },
};
