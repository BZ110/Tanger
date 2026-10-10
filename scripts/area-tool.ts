import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { areaSchema } from '../src/world/area-schema';
import { MAX_AREA_TEXT_LENGTH, parseAreaJson } from '../src/world/parse-area';

const schemaPath = resolve('public/schemas/area.schema.json');
const schemaText =
  JSON.stringify(
    {
      ...z.toJSONSchema(areaSchema, { target: 'draft-2020-12', reused: 'ref' }),
      title: 'Tanger area manifest v1',
      description:
        'Area document structure. Use area:validate for reference, bounds, and quaternion checks.',
    },
    null,
    2,
  ) + '\n';
const [command, ...files] = process.argv.slice(2);

if (command === 'schema') {
  await writeFile(schemaPath, schemaText);
  console.log('Updated public/schemas/area.schema.json');
} else if (command === 'check-schema') {
  if ((await readFile(schemaPath, 'utf8')) !== schemaText) {
    console.error('Editor schema is out of date. Run npm run area:schema.');
    process.exitCode = 1;
  }
} else if (command === 'validate' && files.length) {
  for (const file of files) {
    try {
      if ((await stat(file)).size > MAX_AREA_TEXT_LENGTH)
        throw new Error('Area file exceeds 5 MiB');
      const result = parseAreaJson(await readFile(file, 'utf8'));
      if (result.ok)
        console.log(
          `${file}: valid (${result.area.sectors.length} sectors, ${result.area.assets.length} assets)`,
        );
      else {
        for (const issue of result.issues)
          console.error(`${file} ${issue.path}: ${issue.message}`);
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(
        `${file}: ${error instanceof Error ? error.message : 'Unable to read area file'}`,
      );
      process.exitCode = 1;
    }
  }
} else {
  console.error(
    'Usage: npm run area:validate -- <file.area.json> [more files]',
  );
  process.exitCode = 1;
}
