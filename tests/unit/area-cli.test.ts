import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { emptyDocument } from '../fixtures/area';

test('area validator accepts real JSON files and exits unsuccessfully for invalid files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tanger-area-test-'));
  try {
    const valid = join(directory, 'valid.area.json');
    const invalid = join(directory, 'invalid.area.json');
    writeFileSync(valid, JSON.stringify(emptyDocument()));
    writeFileSync(invalid, '{"version":99}');
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/area-tool.ts', 'validate', ...args],
        { encoding: 'utf8' },
      );
    const accepted = run(valid);
    expect(accepted.status).toBe(0);
    expect(accepted.stdout).toContain('valid (0 sectors, 0 assets)');
    const rejected = run(valid, invalid);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain('$.version');
    expect(run(join(directory, 'missing.area.json')).status).toBe(1);
    expect(run().status).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
