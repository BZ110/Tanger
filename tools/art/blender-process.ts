import { spawnSync } from 'node:child_process';

export function blender(): string {
  for (const candidate of [
    process.env.TANGER_BLENDER,
    '.tools/blender/Blender.app/Contents/MacOS/Blender',
    '.tools/blender/blender-4.5.14-linux-x64/blender',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    'blender',
  ]) {
    if (
      candidate &&
      spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0
    )
      return candidate;
  }
  throw new Error('Blender unavailable. Run art:setup or set TANGER_BLENDER.');
}
export function runBlender(script: string, args: string[]) {
  const result = spawnSync(
    blender(),
    [
      '--background',
      '--factory-startup',
      '--python-exit-code',
      '1',
      '--python',
      `tools/art/blender/${script}.py`,
      '--',
      ...args,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Blender ${script} failed (${result.status ?? 'signal'}).`);
}
