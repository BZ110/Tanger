# TANGER character workspace

This is an authoring environment for original stylized 3D anime characters, with
high-resolution Blender sources and a browser review lab. It contains no newly
designed character. The next agent should make one character well, in small
inspectable passes.

## Start

Run commands from the repository root. Node 22.12+ and Python 3.9+ are required.

```sh
npm ci
npm run art:setup
npm run art:doctor
npm run art:smoke
npm run art:lab
```

Portable setup pins official **Blender 4.5.14 LTS**, verifies its SHA-256, and installs
inside ignored `.tools/`. It supports macOS arm64 and Linux x64. On other platforms,
install Blender 4.5 LTS and set `TANGER_BLENDER` to the executable. No global Blender,
Python, or Git configuration is changed. Setup requires `curl`; macOS also uses
`hdiutil` and `ditto`. The installed build and downloads stay local.

Open <http://127.0.0.1:5180/tools/art/lab/>. Load a local self-contained GLB with the
file picker or drag and drop. The pipeline fixture is available after smoke testing:

<http://127.0.0.1:5180/tools/art/lab/?asset=/art/.build/fixture/fixture.glb>

The fixture is a bent strip that exercises a two-joint skin, two NLA animations,
and a morph target, with an original embedded checker texture. It is deliberately
**not a character or quality reference**.
Smoke testing also renders source views into `art/.build/renders/pipeline-fixture/`.

## Start a character

```sh
npm run art:new -- first-character
npm run art:validate -- art/characters/first-character/character.json
```

This creates a brief, review notes, source directory, and draft manifest. No mesh
is generated and no design decisions are approved. Edit the brief and manifest
before modeling. Use [PIPELINE.md](PIPELINE.md) for the production sequence,
[QUALITY.md](QUALITY.md) for visual gates, and [RUNTIME.md](RUNTIME.md) for export
and engine boundaries. [HANDOFF.md](HANDOFF.md) contains a ready-to-use next-agent task.

## Commands

| Command                                    | Result                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `art:setup`                                | Download/check/install the pinned official Blender locally                        |
| `art:doctor`                               | Check Node, Three.js, and Blender availability                                    |
| `art:new -- <id>`                          | Create a draft directory; refuses to overwrite existing work                      |
| `art:inspect -- <manifest>`                | Report Blender topology, UVs, weights, morphs, and NLA tracks                     |
| `art:export -- <manifest>`                 | Export the `EXPORT` collection to embedded GLB and validate                       |
| `art:validate -- <manifest>`               | Check manifest, provenance files, GLB, rig contract, budgets, and review evidence |
| `art:render -- <manifest> [cycles\|eevee]` | Render source views, expressions, and midpoint animation poses                    |
| `art:capture -- <manifest>`                | Capture the exported model in the browser (start the lab first)                   |
| `art:lab`                                  | Serve the character lab separately from the game                                  |
| `art:lab:build` / `art:test:e2e`           | Build and test the isolated browser lab                                           |
| `art:smoke`                                | Generate/export/validate/render the technical fixture                             |
| `art:schema` / `art:schema:check`          | Generate/check the editor JSON Schema                                             |

Examples use `npm run` before each command. The renderer defaults to 1536px and
48 Cycles samples, preferring an available GPU. Raise `TANGER_RENDER_SIZE` and
`TANGER_RENDER_SAMPLES` for final evidence; `TANGER_RENDER_DEVICE=CPU` selects CPU.
There is no imposed limit on Blender source mesh density, texture size, or file size.

## What's ready, and what follows

Blender Python (`bpy`) is the modeling interface. A strict JSON manifest is the
asset contract, not a new modeling language. Blender can retain sculpting,
modifiers, materials, drivers, and control rigs; export contains portable data.

The lab loads skins, clips, morphs, and GLB materials; offers neutral/daylight/neon
lighting, camera presets, scrubbing, and PNG evidence. Toon audition is a basic
stepped-light preview. A production anime face shader, custom outlines, cloth
simulation, spring bones, and game `AnimationMixer` integration remain separate
work. See [RUNTIME.md](RUNTIME.md) before changing renderer behavior.

The lab is a local authoring tool. No accounts, asset uploads, saved preferences,
or hosted services are required. Public delivery is limited to intentionally
staged source and evidence. Exports/renders/caches are ignored by default; reviewed
runtime GLBs go to `public/assets/models/` only during an authorized integration.
