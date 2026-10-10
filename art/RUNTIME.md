# Export and runtime contract

## Portable character data

`character.json` is versioned and validated using Zod, with a generated editor
schema at `art/schemas/character.schema.json`. All paths are relative to the
repository root. It declares source/export locations, scale, material roles,
named joint/clip/expression requirements, provenance, review evidence, and
editable delivery budgets. Unknown fields are rejected; extend the schema and
tests deliberately when adding capabilities.

Use one embedded GLB 2.0 file with PNG/JPEG images for review. External resource
URLs, Draco, meshopt, and KTX2 are outside the current decoder setup. This is a
baseline for reproducible import, not a permanent ban on compressed delivery.
Keep the source texture files editable and pack portable copies in the GLB.
Blender source is Z-up; the exporter converts to glTF's right-handed Y-up meters.
Face Blender -Y to face +Z in the lab. Keep feet at zero, deliberate object scale,
and document attachment/socket names if added.

Semantic animation keys map to actual glTF clip names. Morph names are exported
through `mesh.extras.targetNames`; the lab binds the same name across meshes.
The contract allows different original rigs; the defaults are starter bindings.
Names alone do not prove clip duration, root motion, weighting, or artistic quality.
Inspect whole clips and bone/world movement explicitly during review.

The current inspector validates glTF with the official Khronos validator, checks
embedded resources, surface normals, geometry/texture budgets, material names,
and declared rig/morph/clip presence. It reports UV omissions and validator
warnings for inspection. Source inspection reports UV maps, modifier types,
boundary/non-manifold edges, and vertices without deform weights. Clothing seams
and intentionally open surfaces can legitimately have boundaries; counts are
diagnostics, not an automatic art verdict.

## Shading boundary

GLB stores supported material parameters and textures, not arbitrary Blender node
graphs. Shader to RGB is an EEVEE-specific authoring technique. An anime face SDF,
authored normals, hair shadow treatment, eye highlights, rim masks, outlines, and
shadow ramps require coordinated art and runtime work. Store editable masks in
the character's source tree and specify channels in its brief; introduce a typed
shader profile when implementing them. Do not quietly pack different meanings
into the same texture channel across characters.

The lab's **authored materials** mode uses imported glTF materials. **Toon
audition** substitutes Three.js `MeshToonMaterial` with a nearest-filtered ramp;
it is useful for shape/light checks but has no face SDF or custom outline pass.
Clay, wireframe, and skeleton views are diagnostics. The lab does not claim to
reproduce ZZZ, Genshin, or their rendering pipelines.

## Existing game boundary

The current game uses `src/adapters/three/operator-view.ts` with a rigid object
hierarchy and procedural rotations. It does **not** yet drive a production
skinned character with an animation mixer. `AssetLibrary` uses `GLTFLoader` and
`SkeletonUtils.clone`, but this does not automatically implement combat blending,
facial animation, motion warping, or dynamics.

When integration is authorized, add a skinned view adapter that consumes the
manifest bindings, blends clips, drives morphs, respects slowed simulation time,
and keeps movement/collision in the existing pure simulation. Ensure authored
character materials bypass generic procedural surface finishing. Implement
resource ownership and dispose geometry/material/texture/mixer state. Keep asset
selection in data and preserve the area parser.

`scripts/build-assets.ts` owns legacy procedural tutorial assets. Do not run it
to generate or replace production character assets. A reviewed GLB can later be
copied into `public/assets/models/` with an updated area/asset manifest and
provenance. Export folders remain ignored until that deliberate integration.

## Primary sources

- [Blender 4.5 LTS](https://www.blender.org/download/LTS/) and
  [official releases/checksums](https://download.blender.org/release/Blender4.5/).
  The installed build pins an official LTS release for reproducibility.
- [Blender glTF exporter manual](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
  and [Python API](https://docs.blender.org/api/4.5/): supported material/animation
  export and scripting. The included export arguments were checked against the
  installed 4.5.14 operator and exercised by the fixture.
- [Shader to RGB](https://docs.blender.org/manual/en/4.5/render/shader_nodes/converter/shader_to_rgb.html):
  EEVEE source shading does not imply a portable runtime shader.
- [Three.js MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html),
  [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html), and
  [SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html): browser preview building blocks.
- [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator): format,
  resource, accessor, animation, and image checks; it cannot judge character art.
- [Arc System Works' public GDC art talk](https://www.arcsystemworks.com/guilty-gear-xrds-art-style-the-x-factor-between-2d-and-3d-talk-from-gdc-2015-is-now-available-online/):
  a developer's discussion of intentional stylized 3D art. Use as an educational
  reference, not evidence of HoYoverse's proprietary implementation.
- [ZZZ official character/demo reference](https://zenless.hoyoverse.com/en-us/main):
  viewing reference for design and motion, never an asset source.

The workflow and review criteria above are TANGER production decisions, not
claims about the internals or budgets of reference games.

## Source representation introduced by Artist Mode

Production sources now use `SOURCE`, a separate source-workflow contract and a
Blender EEVEE anime shader profile. The nodes support editable toon thresholds,
palettes, directional R/G face masks in a head-relative basis, hair highlight
masks, painted source albedo, roughness/specular masks, rims, material response
and transient inverted-hull outlines. Their actual quality is judged in images;
these are original TANGER techniques, not claims about reference-game internals.

A production export must use a separate `deliverySource` and RUNTIME collection,
with current reviewed source evidence and a derivation receipt. Final export is
blocked until every global stage passes. Automatic source-to-runtime retopology,
rig remapping, morph correspondence and material baking are deferred; the derive
command refuses to create an incomplete substitute. The technical fixture alone
bypasses artistic gates because it is explicitly test data. The game, lab and
legacy runtime shader remain unchanged by this milestone.
