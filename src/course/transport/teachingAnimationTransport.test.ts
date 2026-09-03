import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_TRANSPORT_AUTO_HIDE_DELAY_MS,
  DEFAULT_TRANSPORT_STEP_SECONDS,
  TEACHING_PLAYBACK_SPEEDS,
  clampCourseTime,
  formatCourseTime,
} from './teachingAnimationTransportModel';

const transportSource = readFileSync(new URL('./TeachingAnimationTransport.tsx', import.meta.url), 'utf8');
const transportStyles = readFileSync(new URL('./TeachingAnimationTransport.scss', import.meta.url), 'utf8');

// Speed constants
assert.deepEqual([...TEACHING_PLAYBACK_SPEEDS], [0.5, 1, 1.5, 2, 3, 4, 8]);
assert.equal(Object.isFrozen(TEACHING_PLAYBACK_SPEEDS), true);
assert.equal(DEFAULT_TRANSPORT_STEP_SECONDS, 5);
assert.equal(DEFAULT_TRANSPORT_AUTO_HIDE_DELAY_MS, 2500);

// Speed disclosure source contract
assert.match(transportSource, /<details[\s\S]*data-testid="transport-speeds"/);
assert.match(transportSource, /data-testid="transport-speed-current"/);
assert.match(transportSource, /aria-expanded=\{isSpeedMenuOpen\}/);
assert.match(transportSource, /hidden=\{!isSpeedMenuOpen\}/);
assert.match(transportSource, /tabIndex=\{isSpeedMenuOpen && isVisible \? 0 : -1\}/);
assert.match(transportSource, /aria-pressed=\{isSpeedActive\}/);
assert.equal(transportSource.includes('data-testid={`transport-speed-${speed}`}'), true);
assert.match(transportStyles, /grid-template-columns: repeat\(3, minmax\(44px, 1fr\)\)/);
assert.match(transportStyles, /\.teaching-transport__speed-trigger[\s\S]*min-height: 44px[\s\S]*font: 700 18px/);
assert.match(transportStyles, /\.teaching-transport__speed-btn[\s\S]*min-height: 44px[\s\S]*font: 700 18px/);
assert.match(transportStyles, /\.teaching-transport__speed-menu\[hidden\][\s\S]*pointer-events: none/);

// Time formatting
assert.equal(formatCourseTime(0), '00:00.0');
assert.equal(formatCourseTime(5), '00:05.0');
assert.equal(formatCourseTime(59), '00:59.0');
assert.equal(formatCourseTime(60), '01:00.0');
assert.equal(formatCourseTime(78), '01:18.0');
assert.equal(formatCourseTime(125), '02:05.0');
assert.equal(formatCourseTime(45.9), '00:45.9');
assert.equal(formatCourseTime(45.89999999999999), '00:45.9');
assert.equal(formatCourseTime(46), '00:46.0');
assert.equal(formatCourseTime(-5), '00:00');
assert.equal(formatCourseTime(Number.NaN), '00:00');
assert.equal(formatCourseTime(Number.POSITIVE_INFINITY), '00:00');

// Clamping
assert.equal(clampCourseTime(10, 78), 10);
assert.equal(clampCourseTime(-1, 78), 0);
assert.equal(clampCourseTime(90, 78), 78);
assert.equal(clampCourseTime(78, 78), 78);
assert.equal(clampCourseTime(0, 78), 0);

console.log('teachingAnimationTransportModel unit tests pass');
