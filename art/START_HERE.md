# TANGER character workspace

The current milestone is the **Blender Artist Tool Layer**. Refine existing source
through observation, semantic selections, local actions, comparison and review.
Bebben is the working test character, with visible unresolved quality defects.
The procedural game operator and bent-strip fixture are not quality references.

## Setup

Run from the repository root with Node 22.12+ and Python 3.9+:

```sh
npm ci
npm run art:setup
npm run art:doctor
npm run art:artist:smoke
npm run art:artist:serve -- art/characters/bebben/source-workflow.json --ui
```

Portable setup pins official Blender **4.5.14 LTS**, verifies its SHA-256 and
installs inside ignored `.tools/`. macOS arm64 and Linux x64 are supported. Other
platforms can set `TANGER_BLENDER` to a Blender 4.5 executable. No global Blender,
Python or Git settings are changed. The workstation supports demanding authoring;
do not compromise source quality based on assumed compute or RAM limits.

Read [ARTIST_MODE.md](ARTIST_MODE.md) for the callable API, examples and constraints.
Read [Bebben's handoff](characters/bebben/handoff.md) before editing its source.
Use the production skill for modeling and the review skill for visual diagnosis.

## Source and review

Each character keeps `source/*.blend`, editable textures, semantic regions,
`source-workflow.json`, an anime shader profile, checkpoints, a brief, provenance,
visual evidence and artistic history. SOURCE is the artistic representation.
Runtime preparation is a separate later task; authoring has no browser budgets.

```sh
npm run art:new -- original-character
npm run art:source:migrate -- art/characters/original-character/character.json
npm run art:source:prepare -- art/characters/original-character/source-workflow.json
```

`art:new` scaffolds a brief/manifest, not a mesh. Create the initial Blender source
before migration preparation. Preparation is a one-time conversion of a legacy
EXPORT collection into SOURCE; it archives a legacy rig and clears its expressions.
It preserves a pre-migration checkpoint and refuses to overwrite that checkpoint.
Do not run preparation again on a production source. Other characters must author
their own semantic bindings; Bebben's landmark defaults are specific to Bebben.

Use persistent Artist Mode for refinement. The older `art:source:edit` subsystem
entry point is retired; it does not replace the guarded visual iteration loop.

```sh
npm run art:source:render -- art/characters/bebben/source-workflow.json face-study-001 standard
npm run art:source:assess -- art/characters/bebben/source-workflow.json art/characters/bebben/review/iterations/face-study-001/assessment.json
npm run art:source:advance -- art/characters/bebben/source-workflow.json
npm run art:source:validate -- art/characters/bebben/source-workflow.json
```

Rendering creates immutable evidence and a NOT_REVIEWED assessment template.
**Open the images and replace the template with actual judgments before assessing.**
Stages cannot be skipped. A failed face gate should stay failed. Geometry, shader
or paint changes invalidate current evidence. Accepted stage receipts/checkpoints
remain historical evidence, not a claim that later changes retained their quality.
Source validation never applies a triangle/material/texture delivery budget.
`art:source:gate -- <workflow> <action>` explains blockers. `art:source:schema` and
`art:source:check-schema` generate/check editor contracts. Review packs include
full, portrait, details, lookdev and deformation; static characters cannot produce
fake deformation evidence. Standard source review defaults to 1536px; set
`TANGER_REVIEW_SIZE` for a different observation resolution.

## Existing browser lab and technical pipeline

```sh
npm run art:smoke
npm run art:lab
npx playwright install chromium
npm run art:lab:build
npm run art:test:e2e
```

Open <http://127.0.0.1:5180/tools/art/lab/>. It imports a self-contained GLB by file
picker or drag/drop, with clip/morph controls, lighting, camera presets, wireframe,
skeleton and PNG capture. The technical fixture is available after smoke testing:
<http://127.0.0.1:5180/tools/art/lab/?asset=/art/.build/fixture/fixture.glb>.
It tests a two-joint skin, two NLA clips and a morph target; it is not a character.

`art:inspect -- <character.json>` inspects source topology, UVs and rig data.
`art:validate -- <character.json>` checks the delivery contract at its declared
stage. Draft manifests require no export. `art:render -- <character.json>` routes
migrated characters to source review; the older fixture renderer remains available.
`art:capture -- <manifest>` captures an existing exported asset in the browser.
`art:export` is blocked for production characters until all source visual gates
and an explicit derived delivery receipt exist. Automatic source-to-runtime
retopology/rig/morph/material transfer is deferred; `art:source:derive` refuses it.

The current milestone does not add animation, export Bebben, optimize its source
or integrate it into gameplay. Read [PIPELINE.md](PIPELINE.md), [QUALITY.md](QUALITY.md)
and [RUNTIME.md](RUNTIME.md) for the distinction between source work and later
production. [HANDOFF.md](HANDOFF.md) describes the next-agent workflow.
No accounts, uploads, gameplay saves or hosted services are required.
