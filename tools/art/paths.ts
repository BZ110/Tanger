import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export function projectPath(root: string, path: string): string {
  const absolute = resolve(root, path);
  const relation = relative(root, absolute);
  if (relation.startsWith('..') || isAbsolute(relation))
    throw new Error('Path escapes the project');
  return absolute;
}

export async function existingProjectPath(
  root: string,
  path: string,
): Promise<string> {
  const actualRoot = await realpath(root);
  const actual = await realpath(projectPath(root, path));
  const relation = relative(actualRoot, actual);
  if (relation.startsWith('..') || isAbsolute(relation))
    throw new Error('Symlink escapes the project');
  return actual;
}
