import { memo, useEffect, useMemo, useRef, type JSX } from 'react';
import {
  findCrossedBoundaries,
  resolvePulseEdgeIds,
} from './flowchartAnimation';
import { buildDashboardSeriesModel } from './seriesModel';
import {
  FLOWCHART_EDGES,
  FLOWCHART_NODES,
  flowchartEdgeId,
  getFlowchartNodeById,
  resolveFlowchartEdgeBindings,
  type FlowchartEdge,
  type FlowchartEdgeBinding,
  type FlowchartNode,
} from './flowchartModel';

type VisualShowcaseArtifact = NonNullable<Parameters<typeof buildDashboardSeriesModel>[0]>;

export interface FlowchartTimeRef {
  readonly current: number;
}

export interface AlgorithmFlowchartProps {
  readonly artifact: VisualShowcaseArtifact | null;
  readonly currentTimeSecRef?: FlowchartTimeRef | null;
}

const NODE_WIDTH = 42;
const NODE_HEIGHT = 13;
// Bottom feedback bus y for the reward->qnet return path (viewBox 0 0 360 42).
const FEEDBACK_BUS_Y = 40;
const PULSE_MS = 600;
const ACTIVE_EDGE_CLASS = 'leo-algorithm-flowchart__edge--active';

interface Point {
  readonly x: number;
  readonly y: number;
}

function rightAnchor(node: FlowchartNode): Point {
  return { x: node.x + NODE_WIDTH / 2, y: node.y };
}

function leftAnchor(node: FlowchartNode): Point {
  return { x: node.x - NODE_WIDTH / 2, y: node.y };
}

function topAnchor(node: FlowchartNode): Point {
  return { x: node.x, y: node.y - NODE_HEIGHT / 2 };
}

function bottomAnchor(node: FlowchartNode): Point {
  return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
}

function pathFromPoints(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (first === undefined) return '';
  return [
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
    ...rest.map(point => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
  ].join(' ');
}

function edgePath(edge: FlowchartEdge): string {
  const from = getFlowchartNodeById(edge.from);
  const to = getFlowchartNodeById(edge.to);

  // serving -> reward: straight drop to the reward node directly below.
  if (edge.from === 'serving' && edge.to === 'reward') {
    return pathFromPoints([bottomAnchor(from), topAnchor(to)]);
  }

  // reward -> qnet: the RL feedback bus along the bottom of the strip.
  if (edge.from === 'reward' && edge.to === 'qnet') {
    const start = bottomAnchor(from);
    const end = bottomAnchor(to);
    return pathFromPoints([
      start,
      { x: start.x, y: FEEDBACK_BUS_Y },
      { x: end.x, y: FEEDBACK_BUS_Y },
      end,
    ]);
  }

  // Spine edges: simple left-to-right hops between adjacent nodes.
  return pathFromPoints([rightAnchor(from), leftAnchor(to)]);
}

function bindingByEdgeId(
  bindings: readonly FlowchartEdgeBinding[],
): ReadonlyMap<string, FlowchartEdgeBinding> {
  return new Map(bindings.map(binding => [binding.edgeId, binding]));
}

function AlgorithmFlowchartComponent({
  artifact,
  currentTimeSecRef = null,
}: AlgorithmFlowchartProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const edgeElementsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const model = useMemo(() => buildDashboardSeriesModel(artifact), [artifact]);
  const bindings = useMemo(() => resolveFlowchartEdgeBindings(model), [model]);
  const bindingMap = useMemo(() => bindingByEdgeId(bindings), [bindings]);
  const events = artifact?.events ?? model.handover.events;
  const decisionFrames = model.selectedAction.decisionFrames;

  useEffect(() => {
    const svg = svgRef.current;
    if (artifact === null || currentTimeSecRef === null || svg === null) return undefined;

    let frameId = 0;
    let prevSec: number | null = null;
    const activeUntilMs = new Map<string, number>();

    const clearActiveEdges = () => {
      activeUntilMs.clear();
      for (const path of edgeElementsRef.current.values()) {
        path.classList.remove(ACTIVE_EDGE_CLASS);
      }
    };

    const tick = (nowMs: number) => {
      const curSec = currentTimeSecRef.current;
      if (!Number.isFinite(curSec)) {
        prevSec = null;
      } else if (prevSec === null) {
        prevSec = curSec;
      } else {
        const crossed = findCrossedBoundaries(prevSec, curSec, events, decisionFrames);
        const pulseIds = resolvePulseEdgeIds(crossed, bindings);
        const activeExpiresAtMs = nowMs + PULSE_MS;

        for (const edgeId of pulseIds) {
          const path = edgeElementsRef.current.get(edgeId);
          if (path === undefined) continue;
          path.classList.add(ACTIVE_EDGE_CLASS);
          activeUntilMs.set(edgeId, activeExpiresAtMs);
        }

        for (const [edgeId, expiresAtMs] of activeUntilMs) {
          if (expiresAtMs > nowMs) continue;
          const path = edgeElementsRef.current.get(edgeId);
          path?.classList.remove(ACTIVE_EDGE_CLASS);
          activeUntilMs.delete(edgeId);
        }

        prevSec = curSec;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      clearActiveEdges();
    };
  }, [artifact, bindings, currentTimeSecRef, decisionFrames, events]);

  return (
    <svg
      ref={svgRef}
      className="leo-algorithm-flowchart"
      data-testid="algorithm-flowchart"
      data-pulse-driver="raf"
      role="img"
      aria-label="MODQN decision pipeline"
      viewBox="0 0 360 42"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="leo-algorithm-flowchart-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="leo-algorithm-flowchart__arrow" />
        </marker>
      </defs>

      <g className="leo-algorithm-flowchart__edges">
        {FLOWCHART_EDGES.map(edge => {
          const edgeId = flowchartEdgeId(edge);
          const binding = bindingMap.get(edgeId);
          if (binding === undefined) {
            throw new Error(`Missing flowchart edge binding: ${edgeId}`);
          }
          const idle = !binding.animatable;
          return (
            <path
              key={edgeId}
              ref={element => {
                if (element === null) {
                  edgeElementsRef.current.delete(edgeId);
                } else {
                  edgeElementsRef.current.set(edgeId, element);
                }
              }}
              className={
                idle
                  ? 'leo-algorithm-flowchart__edge leo-algorithm-flowchart__edge--idle'
                  : 'leo-algorithm-flowchart__edge leo-algorithm-flowchart__edge--static'
              }
              d={edgePath(edge)}
              fill="none"
              markerEnd="url(#leo-algorithm-flowchart-arrow)"
              data-testid="algorithm-flowchart-edge"
              data-edge-id={edgeId}
              data-source-channel={binding.sourceChannel}
              data-source-status={binding.status}
              data-animatable={String(binding.animatable)}
            />
          );
        })}
      </g>

      <g className="leo-algorithm-flowchart__nodes">
        {FLOWCHART_NODES.map(node => (
          <g
            key={node.id}
            className="leo-algorithm-flowchart__node"
            data-testid="algorithm-flowchart-node"
            data-node-id={node.id}
            transform={`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`}
          >
            <title>{node.title}</title>
            <rect
              x={(-NODE_WIDTH / 2).toFixed(2)}
              y={(-NODE_HEIGHT / 2).toFixed(2)}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx="2.5"
            />
            <text textAnchor="middle" dominantBaseline="middle">
              {node.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export const AlgorithmFlowchart = memo(AlgorithmFlowchartComponent);
