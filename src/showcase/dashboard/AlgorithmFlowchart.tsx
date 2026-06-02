import { useMemo, type JSX } from 'react';
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

export interface AlgorithmFlowchartProps {
  readonly artifact: VisualShowcaseArtifact | null;
}

const NODE_WIDTH = 17;
const NODE_HEIGHT = 9;

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

  if (edge.from === 'mask' && edge.to === 'select') {
    return pathFromPoints([bottomAnchor(from), topAnchor(to)]);
  }

  if (edge.from === 'select' && edge.to === 'serving') {
    return pathFromPoints([leftAnchor(from), rightAnchor(to)]);
  }

  if (edge.from === 'serving' && edge.to === 'handover') {
    const start = rightAnchor(from);
    const end = topAnchor(to);
    return pathFromPoints([start, { x: end.x, y: start.y }, end]);
  }

  if (edge.from === 'serving' && edge.to === 'reward') {
    const start = bottomAnchor(from);
    const end = rightAnchor(to);
    return pathFromPoints([start, { x: start.x, y: end.y }, end]);
  }

  if (edge.from === 'reward' && edge.to === 'qnet') {
    const start = topAnchor(from);
    const end = bottomAnchor(to);
    return pathFromPoints([start, { x: start.x, y: 38 }, { x: end.x, y: 38 }, end]);
  }

  return pathFromPoints([rightAnchor(from), leftAnchor(to)]);
}

function bindingByEdgeId(
  bindings: readonly FlowchartEdgeBinding[],
): ReadonlyMap<string, FlowchartEdgeBinding> {
  return new Map(bindings.map(binding => [binding.edgeId, binding]));
}

export function AlgorithmFlowchart({
  artifact,
}: AlgorithmFlowchartProps): JSX.Element {
  const model = useMemo(() => buildDashboardSeriesModel(artifact), [artifact]);
  const bindings = useMemo(() => resolveFlowchartEdgeBindings(model), [model]);
  const bindingMap = useMemo(() => bindingByEdgeId(bindings), [bindings]);

  return (
    <svg
      className="leo-algorithm-flowchart"
      data-testid="algorithm-flowchart"
      role="img"
      aria-label="Static MODQN decision pipeline"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="leo-algorithm-flowchart-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
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
              rx="1.7"
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
