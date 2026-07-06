import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene.ts';
const ARM = process.argv[2];
const art: any = JSON.parse(readFileSync(join(ARM, 'visual-showcase-v1.json'), 'utf8'));
let frames = 0, minUe = 1e9, maxUe = 0, servingOk = 0, ueTot = 0;
let keys0 = '';
for (let i = 0; i < art.timeline.length; i++) {
  const f: any = showcaseArtifactToScene(art, i); // throws if malformed
  frames++;
  const ues = f.ues ?? [];
  if (i === 0 && ues[0]) keys0 = Object.keys(ues[0]).sort().join(',');
  minUe = Math.min(minUe, ues.length); maxUe = Math.max(maxUe, ues.length); ueTot += ues.length;
  for (const u of ues) if (u.servingBeamId != null) servingOk++;
}
const name = ARM.split('/').pop();
console.log(`${name}: frames=${frames} ues/frame=[${minUe}..${maxUe}] servingBeamId=${servingOk}/${ueTot}  ue-keys=${keys0}`);
if (frames !== art.timeline.length || maxUe > 100 || servingOk !== ueTot) { console.log('  FAIL'); process.exitCode = 1; }
else console.log('  PASS');
