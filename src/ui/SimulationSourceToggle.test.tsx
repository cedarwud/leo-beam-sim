import assert from 'node:assert/strict';
import { Children, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SIMULATION_SOURCE_OPTIONS,
  SimulationSourceToggle,
} from './SimulationSourceToggle';
import type { SimulationSourceMode } from '../app/simulationSourceMode';

const walkerMarkup = renderToStaticMarkup(
  <SimulationSourceToggle value="walker" onChange={() => undefined} />,
);
const tleMarkup = renderToStaticMarkup(
  <SimulationSourceToggle value="archived-tle" onChange={() => undefined} />,
);

assert.match(walkerMarkup, /data-testid="simulation-source-toggle"/);
assert.match(walkerMarkup, /role="group"/);
assert.match(walkerMarkup, /aria-label="Simulation source"/);
assert.match(walkerMarkup, /data-testid="simulation-source-toggle-archived-tle"[\s\S]*aria-pressed="false"/);
assert.match(walkerMarkup, /data-testid="simulation-source-toggle-walker"[\s\S]*aria-pressed="true"/);
assert.match(tleMarkup, /data-testid="simulation-source-toggle-archived-tle"[\s\S]*aria-pressed="true"/);
assert.match(tleMarkup, /data-testid="simulation-source-toggle-walker"[\s\S]*aria-pressed="false"/);
assert.match(walkerMarkup, />TLE<\/span>/);
assert.match(walkerMarkup, />Walker<\/span>/);
assert.match(walkerMarkup, /archived TLE source/);
assert.match(walkerMarkup, /Walker source/);
assert.doesNotMatch(walkerMarkup, /<input\b/);
assert.doesNotMatch(walkerMarkup, /\sstyle=/);
assert.doesNotMatch(walkerMarkup, /SINR|handover|throughput|energy efficiency/i);

interface ElementWithChildren {
  readonly children?: ReactNode;
}

interface ButtonElementProps extends ElementWithChildren {
  readonly onClick: () => void;
  readonly 'data-testid': string;
}

function renderedButtons(
  value: SimulationSourceMode,
  onChange: (mode: SimulationSourceMode) => void,
): ReactElement<ButtonElementProps>[] {
  const root = SimulationSourceToggle({ value, onChange }) as ReactElement<ElementWithChildren>;
  const rootChildren = Children.toArray(root.props.children);
  const buttonGroup = rootChildren[1] as ReactElement<ElementWithChildren>;
  return Children.toArray(buttonGroup.props.children) as ReactElement<ButtonElementProps>[];
}

// SSR markup proves the accessible contract; invoking the native button props
// proves the reversible interaction contract without adding a browser-test
// dependency to this repository's node-based focused test suite.
const changes: SimulationSourceMode[] = [];
const buttons = renderedButtons('walker', mode => changes.push(mode));
const tleButton = buttons.find(
  button => button.props['data-testid'] === 'simulation-source-toggle-archived-tle',
);
assert.ok(tleButton, 'TLE button is present');
tleButton.props.onClick();
assert.deepEqual(changes, ['archived-tle']);

const reverseChanges: SimulationSourceMode[] = [];
const reverseButtons = renderedButtons('archived-tle', mode => reverseChanges.push(mode));
const walkerButton = reverseButtons.find(
  button => button.props['data-testid'] === 'simulation-source-toggle-walker',
);
assert.ok(walkerButton, 'Walker button is present');
walkerButton.props.onClick();
assert.deepEqual(reverseChanges, ['walker']);

assert.deepEqual(
  SIMULATION_SOURCE_OPTIONS.map(option => option.mode),
  ['archived-tle', 'walker'],
);

console.log('SimulationSourceToggle exposes two labelled native buttons and switches both ways.');
