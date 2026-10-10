# Iterative character production

Read [ARTIST_MODE.md](ARTIST_MODE.md) before touching an existing character. The
current milestone is static source refinement. Export, animation, retopology for
browser budgets and game integration follow artistic quality; they are not the
current task.

## Establish source

Record a brief with fixed owner choices, original silhouette, proportion, face,
hair hierarchy, outfit construction and palette. Use public official references
for broad principles. Never extract game assets or commit unlicensed imagery.
Original/generated concept images need provenance and must be reconciled across
views; a generated turnaround is not reliable ground-truth geometry.

Keep a clean control cage, Subdivision/Multires, sculpt detail, master textures,
semantic vertex groups, editable hair/cloth components and source shader in SOURCE.
Scale is meters, feet at Z=0, facing -Y. There is no source density ceiling.
Project detail or retopologize deliberately when the forms are solved; preserve
UVs, shape-key correspondence and authored normals during topology replacement.
The tool supports local projection and isolated component replacement; it does
not claim to automatically produce production retopology.

## Observe and touch

Use a persistent Blender session, including the native GUI when useful. Inspect
front, both three-quarters, profile, high and low three-quarter with fixed cameras.
Switch between hair-free matcap/clay, silhouette, topology and source-shader views.
The critic records 1–3 visible high-impact issues. The artist performs 1–3 small
actions, gets automatic before/after feedback and checkpoints, and stops editing
until the reviewer accepts, rejects or partially accepts the batch. Reject worse
work and restore. No cap exists on the number of cycles.

Primary: silhouette, proportions, body gesture, major hair/garment masses.
Secondary: cheeks, jaw, lids, nose, mouth, clumps, collar/fold groups, hands/boots.
Tertiary: strands, lashes, seams, stitches and small material breakup. Do not
advance to tertiary work while primary/secondary gates remain blocked.

Face work solves cranium, brow/socket, actual upper/lower skin rims and corners,
cheeks, nose, integrated mouth, jaw, chin and ear structure. Judge the profile as
strictly as the front. Eye tools edit existing lids/openings; an iris disk is not
an eyelid. Hair tools deform individual source cages without replacing the entire
head. Art-direct root, tip, curvature, cross-section, taper, twist, overlap and
importance. Cloth starts from meaningful garment masses and fold hierarchy;
random seams or noise do not create construction.

## Paint and look development

Paint source masks and colors in small UV strokes with semantic/material masks.
Use dedicated face R/G directional threshold masks, independent hair highlight
masks and specular/roughness masks. Test head-relative facial shadows and outlines
under a full key-light sweep. Palette, ramps, normal influence, rims, anisotropy
and painted source albedo are adjustable through the shader tool. Source EEVEE
nodes and high-resolution sources do not imply portable GLB shader support.

Keep high density around face/eyes/front hair, upper-body focal elements and
exposed hands; medium density for major cloth/boots/back hair; lower density for
hidden construction. Detail density is an attention priority, not a polygon cap.

## Stage review and later work

`source-workflow.json` records ordered visual stages: silhouette, face, hair,
body, clothing, hands-footwear, lookdev, topology-textures, deformation,
expressions, animation, delivery. Advance requires current source/appearance
signatures, actual required views, passing relevant categories and a preserved
checkpoint. Agent scores are ordinal judgments backed by images, not automatic
measurements or owner approval. A local accepted edit does not pass a global stage.

Only after static source forms/lookdev pass should another authorized phase build
an authoring/deform rig, weights, correctives, expressions and full motion evidence.
Afterward derive a separate RUNTIME source deliberately, transfer rig/morph/material
relationships, validate and compare Blender against the browser lab. That derivation
pipeline is not implemented in this milestone; its command refuses automatic use.
The fixture export path continues to test portable skin/clip/morph behavior.

Keep source, textures, provenance, meaningful action history, before/after examples
and an exact next-action handoff. The original Bebben initializer is archived and
refuses execution; its checkpoints exist for recovery, not repetitive regeneration.
Never overwrite the procedural game operator during character production.
