import { spawn } from 'node:child_process';
import { readFile, mkdir, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { z } from 'zod';
import { blender } from '../tools/art/blender-process';
import { sourceWorkflowSchema } from '../tools/art/quality-schema';

export const artistRequestSchema = z.strictObject({
  role: z.enum(['critic', 'artist', 'reviewer']),
  action: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  args: z.record(z.string(), z.unknown()).default({}),
});
const descriptorSchema = z.strictObject({
  schemaVersion: z.literal(1),
  port: z.number().int().min(1).max(65535),
  token: z.string().min(32),
  workflow: z.string(),
});

export async function callArtist(session: string, input: unknown) {
  if (!/^[a-z0-9-]+$/.test(session)) throw new Error('Invalid session name');
  const request = artistRequestSchema.parse(input);
  const descriptor = descriptorSchema.parse(
    JSON.parse(await readFile(`art/.build/artist/${session}.json`, 'utf8')),
  );
  const response = await fetch(`http://127.0.0.1:${descriptor.port}/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${descriptor.token}`,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  if (!response.ok) throw new Error(`Artist session HTTP ${response.status}`);
  const result = (await response.json()) as {
    ok: boolean;
    error?: string;
    result: unknown;
  };
  if (!result.ok) throw new Error(result.error ?? 'Artist tool failed');
  return result.result;
}

async function main() {
  const [command, target, ...args] = process.argv.slice(2);
  if (command === 'serve') {
    if (!target)
      throw new Error(
        'Usage: art:artist:serve -- <source-workflow.json> [--ui] [--size=768]',
      );
    const workflowPath = relative(process.cwd(), resolve(target)).replaceAll(
      '\\',
      '/',
    );
    if (workflowPath.startsWith('../'))
      throw new Error('Workflow must be in the repository');
    const workflow = sourceWorkflowSchema.parse(
      JSON.parse(await readFile(workflowPath, 'utf8')),
    );
    const name = workflow.character;
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid session name');
    const descriptor = `art/.build/artist/${name}.json`;
    await mkdir('art/.build/artist', { recursive: true });
    try {
      await access(descriptor);
      await callArtist(name, { role: 'critic', action: 'session.info' });
      throw new Error(`Session ${name} already running`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already running'))
        throw error;
    }
    const size = Number(
      args.find((a) => a.startsWith('--size='))?.slice(7) ?? 768,
    );
    if (!Number.isInteger(size) || size < 64)
      throw new Error('Preview size must be an integer >= 64');
    const child = spawn(
      blender(),
      [
        ...(args.includes('--ui') ? [] : ['--background']),
        '--factory-startup',
        '--python-exit-code',
        '1',
        '--python',
        'tools/art/blender/artist_server.py',
        '--',
        workflowPath,
        descriptor,
        '--size',
        String(size),
      ],
      { stdio: 'inherit' },
    );
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    child.on('error', (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  } else if (command === 'call') {
    if (!target || !args[0])
      throw new Error(
        'Usage: art:artist -- <session> <request.json or inline JSON>',
      );
    const text = args[0].startsWith('{')
      ? args[0]
      : await readFile(args[0], 'utf8');
    console.log(
      JSON.stringify(await callArtist(target, JSON.parse(text)), null, 2),
    );
  } else throw new Error('Expected serve or call');
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/art-artist.ts')
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
