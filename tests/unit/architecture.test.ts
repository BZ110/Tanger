import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

const root = resolve('src');
const allowed: Record<string, readonly string[]> = {
  core: ['core'],
  content: ['content'],
  world: ['world', 'core', 'content'],
  game: ['game', 'world', 'core', 'content'],
  application: ['application', 'game', 'core', 'content'],
  adapters: ['adapters', 'application', 'game', 'world', 'core', 'content'],
};
const browserGlobals = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'requestAnimationFrame',
  'HTMLElement',
  'HTMLCanvasElement',
  'AbortController',
]);

test('module dependencies point inward and pure code stays platform-independent', () => {
  const errors: string[] = [];
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.ts'),
  );
  for (const file of files) {
    if (file === 'main.ts') continue;
    const layer = file.split('/')[0]!;
    const path = resolve(root, file);
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        if (!specifier.startsWith('.')) {
          if (
            layer !== 'adapters' ||
            !file.startsWith('adapters/three/') ||
            specifier !== 'three'
          )
            errors.push(`${file}: external dependency ${specifier}`);
        } else {
          const target = relative(
            root,
            resolve(dirname(path), specifier),
          ).split('/');
          if (!allowed[layer]?.includes(target[0]!))
            errors.push(`${file}: forbidden dependency ${specifier}`);
          if (
            layer === 'adapters' &&
            target[0] === 'adapters' &&
            target[1] !== file.split('/')[1]
          )
            errors.push(`${file}: cross-adapter dependency ${specifier}`);
        }
      }
      if (
        layer !== 'adapters' &&
        ts.isIdentifier(node) &&
        browserGlobals.has(node.text)
      )
        errors.push(`${file}: browser dependency ${node.text}`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(errors).toEqual([]);
});
