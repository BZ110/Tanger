import { runBlender } from '../tools/art/blender-process';
runBlender('artist_smoke', [
  process.argv[2] ?? 'art/characters/bebben/source-workflow.json',
]);
