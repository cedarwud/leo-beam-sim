import { useEffect, useRef, useState } from 'react';

interface MiniRewardCurveProps {
  readonly rewards: readonly number[];
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(query.matches);

    handleChange();
    if (query.addEventListener) {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    query.addListener?.(handleChange);
    return () => query.removeListener?.(handleChange);
  }, []);

  return prefersReducedMotion;
}

function formatLabel(value: number): string {
  return value.toFixed(2);
}

function normalizeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function drawRewardCurve(
  canvas: HTMLCanvasElement,
  rewards: readonly number[],
  shouldReduceMotion: boolean,
): void {
  const context = canvas.getContext('2d');
  if (context === null) return;

  const width = 200;
  const height = 40;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(Math.floor(width * dpr), 1);
  canvas.height = Math.max(Math.floor(height * dpr), 1);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const plotWidth = width - 2;
  const plotHeight = height - 2;
  context.clearRect(0, 0, width, height);
  context.fillStyle = 'rgba(3, 10, 17, 0.97)';
  context.fillRect(0, 0, width, height);

  if (rewards.length === 0) {
    context.fillStyle = 'rgba(229, 244, 251, 0.55)';
    context.font = '10px ui-monospace, Menlo, monospace';
    context.fillText('no reward data yet', 6, height - 6);
    return;
  }

  const values = rewards.map(value => normalizeNumber(value, 0));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const normalizedSpan = Math.max(maxValue - minValue, 0.001);

  const yMin = minValue - normalizedSpan * 0.08;
  const yMax = maxValue + normalizedSpan * 0.08;

  context.strokeStyle = 'rgba(129, 246, 188, 0.95)';
  context.lineWidth = 2;
  context.beginPath();
  values.forEach((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * plotWidth;
    const ratio = (value - yMin) / (yMax - yMin);
    const y = 1 + (1 - ratio) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.shadowColor = 'rgba(129, 246, 188, 0.25)';
  context.shadowBlur = shouldReduceMotion ? 0 : 4;
  context.stroke();
  context.shadowBlur = 0;

  const lastIndex = values.length - 1;
  const tailX = (lastIndex / Math.max(values.length - 1, 1)) * plotWidth;
  const tailRatio = (values[lastIndex] - yMin) / (yMax - yMin);
  const tailY = 1 + (1 - tailRatio) * plotHeight;
  context.fillStyle = 'rgba(129, 246, 188, 0.95)';
  context.beginPath();
  context.arc(tailX, tailY, 2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(229, 244, 251, 0.66)';
  context.font = '8px ui-monospace, Menlo, monospace';
  context.fillText(formatLabel(yMin), 4, height - 3);
  context.textAlign = 'right';
  context.fillText(formatLabel(yMax), width - 4, 10);
  context.textAlign = 'start';
}

export function MiniRewardCurve({
  rewards,
}: MiniRewardCurveProps) {
  const shouldReduceMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    drawRewardCurve(canvas, rewards, shouldReduceMotion);
  }, [rewards, shouldReduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="leo-modqn-mini-reward-curve"
      data-testid="modqn-mini-reward-curve"
      aria-hidden="true"
    />
  );
}

