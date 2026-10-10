# Visual and deformation review

Quality is established by images and motion. File validity, triangle counts,
smooth shading, and the presence of a rig cannot establish it. The procedural
operator and technical fixture are excluded as quality references.

The owner has ample workstation resources. Author at the needed quality and
resolution, then make deliberate delivery variants. The starter GLB limits
(120k triangles, 12 materials, 160 joints, 4k texture edge, 80 MiB) are **editable
project starting points**, not measurements from another game, source limits,
or a reason to compromise a face. Measure actual browser behavior before tuning.

## Inspect at three scales

At gameplay distance, check silhouette, palette grouping, facial readability,
and whether the pose communicates the action. At portrait distance, inspect
eye shape, mouth, cheek/neck transitions, hair edge flow, and texture decisions.
At mesh distance, inspect topology, UV seams, normals, alpha edges, and weights.
All three matter; surface noise cannot replace large shape decisions.

| Area        | Acceptance evidence                                                     | Reasons to revise                                                                 |
| ----------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Design      | Original silhouette and coherent outfit construction in four views      | Recognizable copied character; random detail without hierarchy                    |
| Face        | Front/profile/3/4 close-ups, neutral and expression views               | Sphere-like head; recessed sticker eyes; flat profile; pinched mouth              |
| Eyes        | Upper/lower lids, iris readability, believable closure, stable lashes   | Popping eyes; blink gaps; clipping cornea; eyebrows attached to the wrong surface |
| Hair        | Layered locks with clear large/medium/small forms and stable highlights | Helmet cap; repeated tube strands; noisy contours; unstable alpha sorting         |
| Clothes     | Consistent thickness, seams, hems, fold hierarchy and fit               | Intersecting panels; inflated tubes; paper edges; floating accessories            |
| Topology    | Wireframe around eyelids/lips/joints; weighted deformation poses        | Pinching joints; disconnected patches; arbitrary over-tessellation                |
| Textures    | Authored detail, consistent color space, clean seams and mipmaps        | Accidental bake lighting; blurry face; harsh seam bleed; unlicensed imagery       |
| Shading     | Neutral/daylight/night and a full key-light rotation                    | Face becomes lumpy/dirty; outlines drown features; all surfaces look like plastic |
| Rig         | Shoulder lift, elbow/knee bend, crouch, twists, fists, extreme attack   | Weight collapse; exploding vertices; disconnected cloth; broken wrists            |
| Expressions | Individual 0/0.5/1 states and selected combinations                     | Mouth/eyelids invert; smiles distort eyeballs; asymmetry was accidental           |
| Motion      | Entire clips at normal and slow speed, with pose/contact evidence       | Sliding planted feet; unrelated torso/legs; no anticipation/recovery              |
| Export      | Blender vs browser comparison under documented conditions               | Missing UVs/skin/morphs; changed material/scale; bind-pose mismatch               |

## Minimum evidence

Capture front, 3/4, profile, back, face close-up, and a deformation pose. These six
images are only the technical minimum; include expression sheets and full-motion
evidence for a rigged final. Use at least neutral studio and one contrasting light
setup. Capture both source and browser output; their image tone may differ, but
geometry and authored relationships must survive.

The render helper estimates face framing from the named `head` bone or body
height; adjust the camera for unusual proportions. Midpoint renders do not prove
an entire clip is clean. Write observations with an image name and specific issue,
such as “profile.png: mouth projection reads flat” or “attack at 0.42s: left shoulder
collapses.” Then fix the source and regenerate evidence.

## Review outcome

Record `pending`, `revise`, or `accepted` with the actual reviewer's identifier.
Separate design decisions awaiting the owner from technical defects the agent can
fix autonomously. Do not use invented scores or statements such as “AAA achieved.”
An accepted agent review is still subject to the owner's taste. Report unfinished
face shading, secondary motion, or runtime integration candidly.

## Static source gates and local artistic review

Artist Mode accepts/rejects individual corrections, not entire characters. Current
Bebben has both accepted local repairs and blocked global face quality. The source
workflow requires ordered stages, immutable render evidence, checkpoint receipts,
current geometry and appearance signatures, and the required views. Scores 0–5
are explicitly authored ordinal review judgments, not metrics computed from
polygon counts. A PASS needs score ≥4 and no blocker; unreviewed work blocks.

Face-stage advance additionally requires explicit checks for profile volume,
eye shape, eyelid thickness, ear structure, cheek planes, jaw transition, chin
balance, mouth integration and nose style. Missing checks remain NOT_REVIEWED;
a high aggregate score cannot bypass a primitive ear or pasted-on mouth. Inspect
front, both three-quarters, profile, high/low and the eyelid close-up. Any flat
profile, circular surprised eyes, weak skin rims, primitive ears, featureless
cheeks, straight jaw, wrong chin balance, pasted mouth or incompatible nose blocks
that stage. These are image-backed human/agent judgments, not an automatic geometry
classifier. Do not fabricate them to satisfy a gate.

Use primary/secondary/tertiary reasoning. Tertiary tools are blocked until relevant
form categories pass a current review. Highest visual attention goes to face,
eyes, face-framing hair, upper-body focal details and exposed hands. Medium:
major garments, boots and back hair. Hidden construction receives lower attention.
Subdivision or many fine lines cannot replace deliberate form hierarchy.

Compare under matching lens/framing, lighting, diagnostic mode and exposure.
Record BETTER/WORSE/MIXED with specific visible reasons. Restore worse batches;
retain partial changes only with explicit follow-up defects. Do not mistake a
paintover difference image for an objective quality score. Check masks/materials
under a full light sweep before accepting lookdev. See ARTIST_MODE.md for direct
tools, coordinate conventions and their practical limits.
