import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE,
  VISUAL_LAB_GLOBAL_SCENE_COPY,
} from './VisualLabGlobalScene';

assert.equal(VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE, 14, 'global labels use the minimum readable size');
assert.match(VISUAL_LAB_GLOBAL_SCENE_COPY['zh-Hant'].provenance('Starlink', 12), /archived TLE · SGP4/);
assert.match(VISUAL_LAB_GLOBAL_SCENE_COPY.en.provenance('OneWeb', 12), /Global view · archived TLE · SGP4/);
assert.match(VISUAL_LAB_GLOBAL_SCENE_COPY['zh-Hant'].serving, /服務/);
assert.match(VISUAL_LAB_GLOBAL_SCENE_COPY.en.candidate, /Candidate/);

const source = readFileSync('src/prototype/visual-lab-g0/VisualLabGlobalScene.tsx', 'utf8');
const sceneSource = readFileSync('src/prototype/visual-lab-g0/VisualLabScene.tsx', 'utf8');
assert.doesNotMatch(source, /fontSize:\s*(?:9|10|11|12|13)\b/, 'global scene has no undersized inline labels');
assert.doesNotMatch(source, /ContextLabels/, 'context IDs are not permanently rendered as tiny labels');
assert.doesNotMatch(source, /EARTH \/ ARCHIVED TLE|ARCHIVED TLE \/ SGP4 UNAVAILABLE|LOADING ACCEPTED ARCHIVED-TLE RUN/, 'global visible copy is not engineering-style all caps');
assert.match(source, /className="vlab-global-provenance"/, 'provenance is not hidden by the legacy caption rule');
assert.match(sceneSource, /theme=\{theme\}/, 'global scene receives theme');
assert.match(sceneSource, /locale=\{locale\}/, 'global scene receives locale');

console.log('visual-lab global scene presentation passed');
