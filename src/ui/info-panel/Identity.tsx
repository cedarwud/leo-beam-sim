import type { GlyphKind } from '../../contracts/glyphTypes';
import { glyphSymbolForKind } from '../../viz/glyphs';

function InlineSatelliteGlyph({ glyph }: { glyph: GlyphKind }) {
  return (
    <span
      data-testid="info-panel-satellite-glyph"
      data-satellite-glyph={glyph}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        marginRight: 5,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontFeatureSettings: '"liga" 0',
        textRendering: 'geometricPrecision',
        lineHeight: 1,
      }}
    >
      {glyphSymbolForKind(glyph)}
    </span>
  );
}
export function PanelBeamIdentity({
  identity,
  glyph,
}: {
  identity: string;
  glyph: GlyphKind | null;
}) {
  return (
    <>
      {glyph && <InlineSatelliteGlyph glyph={glyph} />}
      <span>{identity}</span>
    </>
  );
}
