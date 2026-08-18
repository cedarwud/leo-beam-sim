import { randomUUID } from 'node:crypto';
import { rename, unlink, writeFile } from 'node:fs/promises';

/**
 * Publish a generated text artifact without ever replacing the target with a
 * partially-written document.  The temporary file lives beside the target so
 * rename remains one filesystem operation.
 */
export async function writeTextFileAtomically(
  targetPath: string,
  contents: string,
): Promise<void> {
  const temporaryPath = `${targetPath}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, contents, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o644,
    });
    await rename(temporaryPath, targetPath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}
