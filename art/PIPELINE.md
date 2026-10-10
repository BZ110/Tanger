# Production sequence

The target is a polished original anime character suited to TANGER's cyberpunk
world. Broad visual references are Genshin Impact, Zenless Zone Zero, and
Cyberpunk. These establish ambition, not a character recipe or proprietary
technique. Read [QUALITY.md](QUALITY.md) before starting.

## 1. Brief and original reference

Create one manifest with `art:new`. Record a concrete silhouette, proportions,
face shapes, hair masses, clothing construction, palette, and intended motion.
List what is fixed by the owner and what you are choosing for this task. Reference
boards should label observations (shape rhythm, value separation, eyelid style),
not request a clone. Use official public images as viewing references; do not
commit their images or turn them into textures. Original concept images can be
created using available image-generation tools; retain the prompt and provenance.
Do not treat a generated turnaround as reliable geometry: reconcile its views.

## 2. Silhouette and face pass

Model scale in meters, feet at Blender Z=0, facing Blender -Y. Default source
height is provisional; set the manifest to the actual design. Use an A-pose that
leaves shoulder, wrist, and hip deformation space. Build the head as a continuous
surface with purposeful cheek, chin, nose, mouth, and orbital shapes. Develop
eye openings, eyelids, lashes, iris geometry/paint, and brows. Check front, profile,
and 3/4 together; do not accept a good frontal image with a collapsed profile.

Render and inspect a gray silhouette and untextured face. Save a source checkpoint
before irreversible remeshing. A head made from smooth spheres with decals is
not an acceptable final face. Use subdivision as an authoring aid where useful;
retain or bake it deliberately into a separate game mesh, preserving shape keys.

## 3. Hair, clothing, and material structure

Author large, medium, and small hair clumps with designed contour and layering,
not a helmet or random spaghetti. Separate visible locks when their silhouette
or motion needs it. Model clothing as constructed surfaces: collar, seams, hems,
fold hierarchy, thickness, closures, and functional accessories. Resolve visible
body/clothing intersections; do not hide every problem in a frontal pose.

Retopologize where sculpted surfaces need deformation. Allocate loops at eyelids,
lips, shoulders, elbows, wrists, hips, knees, and fingers. Keep source and export
meshes distinct when needed. Primitives remain blockouts until properly shaped.

## 4. UVs and authored appearance

Plan UV islands around face resolution, hair flow, seams, and symmetry. Paint
color and shadow design intentionally, with separate eyes, skin, hair, cloth,
metal, and emissive roles. Paint working source textures at the resolution needed;
derive browser textures later. Keep layer sources or reproducible baking scripts.
Inspect mipmaps, seam bleed, alpha edges, and close-ups in the actual export.

Use standard glTF-compatible materials for the portable baseline. EEVEE toon
node setups or custom face masks can live in Blender, but they need an explicit
runtime implementation. `art:render -- <manifest> eevee` is available for EEVEE
source shaders. Neither arbitrary node graphs nor control rigs are encoded by
the manifest or automatically recreated by glTF.

## 5. Deformation rig and expressions

Build a deforming skeleton and a useful authoring control rig. Place shoulder/hip
joints for the designed proportions. Normalize weights; test elbows, shoulders,
twist, crouch, high steps, and extreme combat poses. Add correctives when needed.
Model complete eyelid closure over the eye, plausible jaw/mouth motion, and a
small expression set. The manifest lists actual required exported morph names;
its starter names are editable, not a universal rig standard.

Rig clothing/hair deliberately. Skinning alone is supported; dynamics need a
separate browser system. Bake constraints/drivers needed by export. Inspect
expressions at 0, 0.5, and 1, individually and in combinations. No eye popping,
floating eyelashes, inverted mouth cavity, collapsing joints, or detached cloth.

## 6. Animation and export

Author an idle, walk, run, dash, attack, and hit reaction as appropriate to the
current brief. These are deliverables for a playable character, not mandatory
story choreography. Character assets use in-place motion; simulation owns world
movement and combat speed. Preserve pose arcs, contacts, anticipation, impact,
and recovery. Sample full clips, not just a flattering midpoint.

Put every exported mesh, armature, and needed hierarchy object in the manifest's
`EXPORT` collection. Keep reference planes, lights, cameras, high-poly sources,
control objects, and unused alternatives outside. Use named NLA tracks matching
`rig.clips` values. Tracks on several objects with the same name form one exported
clip. Do not combine unrelated motions on one track; remove accidental actions.
The included exporter uses Blender 4.5's `NLA_TRACKS` mode with sampling, skinning,
morphs, UVs, normals, material export, and automatic Z-up to Y-up conversion.

```sh
npm run art:inspect -- art/characters/<id>/character.json
npm run art:export -- art/characters/<id>/character.json
npm run art:render -- art/characters/<id>/character.json
```

The exporter does not destructively apply the armature, triangulate the source,
or decimate the artist's work. Prepare the export mesh/collection deliberately.
Inspect the evaluated export, since GLB vertex/triangle counts can differ from
source counts after seams, modifiers, and material splitting.

## 7. Browser review and handoff

Start `art:lab`; load the resulting GLB. Compare materials, face, texture seams,
scale, rig motion, and expressions against Blender. Scrub the whole animation
and rotate the key light. Use camera views and browser captures, then review
wireframe and skeleton separately. Record actual deficiencies and repairs.

Stages: `draft` checks structure only; `model` adds source/export/provenance and
geometry checks; `rigged` adds declared joints/clips/expressions; `review` also
requires a named reviewer, accepted verdict, notes, and at least six evidence
files. These are technical gates; a weak mesh with valid names still needs repair.
Only advance when the corresponding work exists. Never pad the review with
duplicate images or claim owner approval without it.

Curate front/3/4/profile/back, face, and deformation evidence under the character's
`review/` directory. Include a motion clip or frame sequence for animation review.
Deliver the `.blend`, textures, manifest, concise review, provenance, and remaining
work. Keep rejected iterations local. Do not overwrite the tutorial operator.
