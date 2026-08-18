import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeTextFileAtomically } from './writeTextFileAtomically';

const directory = await mkdtemp(join(tmpdir(), 'leo-first-frame-atomic-'));
try {
  const targetPath = join(directory, 'artifact.json');
  await writeFile(targetPath, '{"version":1}\n', 'utf8');
  await writeTextFileAtomically(targetPath, '{"version":2}\n');

  assert.equal(await readFile(targetPath, 'utf8'), '{"version":2}\n');
  assert.deepEqual(await readdir(directory), ['artifact.json']);
  console.log('First-frame artifact publication is atomic and leaves no temporary file.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
