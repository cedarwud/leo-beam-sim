export const VISUAL_LAB_CLIP_WIDTH = 1280;
export const VISUAL_LAB_CLIP_HEIGHT = 720;

export interface VisualLabClipContainRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Return the largest source rectangle that fits inside a destination box
 * without changing the source aspect ratio.  The unused space is deliberate
 * letterbox space; the caller is responsible for painting its background.
 */
export function getVisualLabClipContainRect(
  sourceWidth: number,
  sourceHeight: number,
  destinationX: number,
  destinationY: number,
  destinationWidth: number,
  destinationHeight: number,
): VisualLabClipContainRect {
  if (!finitePositive(sourceWidth) || !finitePositive(sourceHeight)) {
    throw new RangeError('source canvas dimensions must be finite and positive');
  }
  if (
    !Number.isFinite(destinationX)
    || !Number.isFinite(destinationY)
    || !finitePositive(destinationWidth)
    || !finitePositive(destinationHeight)
  ) {
    throw new RangeError('destination box must have finite coordinates and positive dimensions');
  }

  const scale = Math.min(destinationWidth / sourceWidth, destinationHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: destinationX + (destinationWidth - width) / 2,
    y: destinationY + (destinationHeight - height) / 2,
    width,
    height,
  };
}

export interface VisualLabClipMetrics {
  readonly sinrDb: number | null;
  readonly systemPowerW: number | null;
  readonly totalThroughputBps: number | null;
  readonly instantaneousEeBitsPerJ: number | null;
}

export interface VisualLabClipFramePresentation {
  readonly locale: 'zh-Hant' | 'en';
  readonly theme: 'dark' | 'light';
  readonly title: string;
  readonly phase: string;
  readonly sourceLabel: string;
  readonly identityLabel: string;
  readonly metrics: VisualLabClipMetrics;
}

export interface DrawVisualLabClipFrameOptions {
  readonly outputCanvas: HTMLCanvasElement;
  readonly sourceCanvas: HTMLCanvasElement;
  readonly presentation: VisualLabClipFramePresentation;
  readonly elapsedMs: number;
  readonly durationMs: number;
}

function metricValue(value: number | null, divisor: number, digits: number, unit: string): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value / divisor).toFixed(digits)} ${unit}`;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

/**
 * Compose one readable 16:9 replay frame from the currently accepted WebGL
 * scene. Scientific values are caller-owned projections of that same frame;
 * this helper never computes or substitutes a metric.
 */
export function drawVisualLabClipFrame({
  outputCanvas,
  sourceCanvas,
  presentation,
  elapsedMs,
  durationMs,
}: DrawVisualLabClipFrameOptions): void {
  if (outputCanvas.width !== VISUAL_LAB_CLIP_WIDTH) outputCanvas.width = VISUAL_LAB_CLIP_WIDTH;
  if (outputCanvas.height !== VISUAL_LAB_CLIP_HEIGHT) outputCanvas.height = VISUAL_LAB_CLIP_HEIGHT;
  const context = outputCanvas.getContext('2d');
  if (context === null) throw new Error('2D replay compositor is unavailable');

  const light = presentation.theme === 'light';
  const background = light ? '#f4eee4' : '#07121a';
  const panel = light ? 'rgba(250, 247, 240, 0.94)' : 'rgba(7, 18, 26, 0.94)';
  const text = light ? '#20333b' : '#eef7f6';
  const muted = light ? '#5d6d71' : '#a7bbbc';
  const accent = '#f0b33f';
  const sceneTop = 82;
  const sceneHeight = 500;
  const footerTop = sceneTop + sceneHeight;

  context.clearRect(0, 0, VISUAL_LAB_CLIP_WIDTH, VISUAL_LAB_CLIP_HEIGHT);
  context.fillStyle = background;
  context.fillRect(0, 0, VISUAL_LAB_CLIP_WIDTH, VISUAL_LAB_CLIP_HEIGHT);
  const sceneRect = getVisualLabClipContainRect(
    sourceCanvas.width,
    sourceCanvas.height,
    0,
    sceneTop,
    VISUAL_LAB_CLIP_WIDTH,
    sceneHeight,
  );
  context.drawImage(sourceCanvas, sceneRect.x, sceneRect.y, sceneRect.width, sceneRect.height);

  context.fillStyle = panel;
  context.fillRect(0, 0, VISUAL_LAB_CLIP_WIDTH, sceneTop);
  context.fillRect(0, footerTop, VISUAL_LAB_CLIP_WIDTH, VISUAL_LAB_CLIP_HEIGHT - footerTop);

  context.textBaseline = 'alphabetic';
  context.fillStyle = text;
  context.font = '700 29px "Noto Sans TC", system-ui, sans-serif';
  context.fillText(presentation.title, 34, 42);
  context.fillStyle = muted;
  context.font = '500 16px "Noto Sans TC", system-ui, sans-serif';
  context.fillText(`${presentation.sourceLabel}  ·  ${presentation.identityLabel}`, 34, 68);

  context.font = '700 17px "Noto Sans TC", system-ui, sans-serif';
  const phaseWidth = Math.max(116, context.measureText(presentation.phase).width + 34);
  context.fillStyle = light ? '#f5d992' : '#5c4215';
  drawRoundedRect(context, VISUAL_LAB_CLIP_WIDTH - phaseWidth - 34, 22, phaseWidth, 40, 20);
  context.fillStyle = light ? '#664607' : '#ffe3a3';
  context.textAlign = 'center';
  context.fillText(presentation.phase, VISUAL_LAB_CLIP_WIDTH - phaseWidth / 2 - 34, 48);
  context.textAlign = 'left';

  const labels = presentation.locale === 'zh-Hant'
    ? ['SINR', '系統功率', '總吞吐量', '瞬時 EE']
    : ['SINR', 'System power', 'Total throughput', 'Instantaneous EE'];
  const values = [
    metricValue(presentation.metrics.sinrDb, 1, 2, 'dB'),
    metricValue(presentation.metrics.systemPowerW, 1, 2, 'W'),
    metricValue(presentation.metrics.totalThroughputBps, 1_000_000, 2, 'Mbit/s'),
    metricValue(presentation.metrics.instantaneousEeBitsPerJ, 1_000_000, 2, 'Mbit/J'),
  ];
  const cardGap = 14;
  const cardWidth = (VISUAL_LAB_CLIP_WIDTH - 68 - cardGap * 3) / 4;
  for (let index = 0; index < labels.length; index += 1) {
    const x = 34 + index * (cardWidth + cardGap);
    context.fillStyle = light ? 'rgba(224, 216, 202, 0.66)' : 'rgba(28, 48, 58, 0.78)';
    drawRoundedRect(context, x, footerTop + 18, cardWidth, 92, 12);
    context.fillStyle = muted;
    context.font = '600 15px "Noto Sans TC", system-ui, sans-serif';
    context.fillText(labels[index] ?? '', x + 18, footerTop + 47);
    context.fillStyle = text;
    context.font = '700 24px "Times New Roman", "Noto Sans TC", serif';
    context.fillText(values[index] ?? '—', x + 18, footerTop + 82);
  }

  const progress = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 0;
  context.fillStyle = light ? '#d2c8b7' : '#273d47';
  context.fillRect(34, VISUAL_LAB_CLIP_HEIGHT - 14, VISUAL_LAB_CLIP_WIDTH - 68, 4);
  context.fillStyle = accent;
  context.fillRect(34, VISUAL_LAB_CLIP_HEIGHT - 14, (VISUAL_LAB_CLIP_WIDTH - 68) * progress, 4);
}
