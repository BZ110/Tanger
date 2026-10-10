---
name: tanger-character-production
description: Author or improve original polished stylized 3D anime character models for TANGER. Use for character briefs, facial topology, hair, clothing, painted textures, Blender rigs, expressions, animation, and GLB character export. Do not use for environment maps, UI, generic Blender help, or merely inspecting an existing character delivery.
---

# TANGER character production

Read root `AGENTS.md`, `art/AGENTS.md`, and `art/START_HERE.md`. Run all commands
from the repository root. Read `art/PIPELINE.md` and `art/QUALITY.md` before modeling;
read `art/RUNTIME.md` before rig/export/shader work.

## Establish the work

Inspect the existing character directory before changing it. Run `art:doctor`;
use `art:setup` if Blender is missing. For a new character, run
`npm run art:new -- <id>` and turn its draft brief into concrete original decisions.
Use Blender Python (`bpy`) or the Blender UI when available. Do not substitute a
pile of primitives or a rendered image for an editable character mesh.

The workstation supports demanding authoring. Keep source quality high and treat
manifest delivery budgets as editable browser targets. Do not use the procedural
operator or pipeline fixture as visual references.

## Iterate by evidence

1. Establish silhouette and face in front/profile/3/4; render and inspect them.
2. Develop eyelids/eyes, hair forms, clothing construction, UVs and painted materials.
3. Retopologize deformation areas; rig, weight, add expressions, and test extremes.
4. Author in-place clips with named NLA tracks; bind exported names in the manifest.
5. Inspect source, export, validate, and compare Blender against the browser lab.

Use `art:inspect`, `art:export`, `art:render`, and `art:capture` as documented in
`art/START_HERE.md`. Keep checkpoints before destructive changes and retain source
textures/scripts. Research only public primary references and record provenance
for any licensed input; never extract another game's assets.

## Deliver

Use the `tanger-character-review` skill for the review pass. Fix visible defects
before advancing stages. Keep honest review/evidence and a continuation record
following `art/HANDOFF.md`. Do not claim that validator success establishes art
quality or owner approval. Do not integrate into gameplay unless that task is
authorized. Report concrete limitations when the available modeling tools cannot
reach the requested quality; leave usable source rather than disguising a blockout.
