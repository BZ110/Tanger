# Blender Artist Tool Layer

Use this for refining existing characters. The source is edited in a persistent
Blender process, with small semantic tools and rendered feedback. There is no
arbitrary Python endpoint and no whole-character rebuilding behind a cheek tool.

## Start a session

```sh
npm run art:artist:serve -- art/characters/bebben/source-workflow.json
```

Keep that terminal running. In another terminal:

```sh
npm run art:artist -- bebben '{"role":"critic","action":"session.info"}'
npm run art:artist -- bebben '{"role":"critic","action":"view.set","args":{"name":"profile","mode":"FACE_SCULPT"}}'
npm run art:artist -- bebben '{"role":"critic","action":"render.view","args":{"id":"profile-observation-001"}}'
```

Requests can also be JSON files. Every observation ID is immutable; use a fresh
ID each time. Responses contain repository-relative PNG paths. **Open the image**
with the agent's image viewer before diagnosing or reviewing it.

Add `--ui` to the serve command to open the same tool layer inside native Blender.
Its HTTP handler runs through a main-thread Blender timer. The background variant
keeps a main-thread command loop; neither version edits `bpy` from a worker thread.
`--size=1536` raises preview resolution. Source geometry and texture density are
unlimited by this tool. Preview resolution is an observation choice, not an asset
budget. The local service listens only on loopback, with a per-session credential
stored in ignored `art/.build/artist/`. It provides no account or hosted service.

## Critic → artist → reviewer

The critic observes current renders and records **one to three** problems:

```json
{
  "role": "critic",
  "action": "critic.record",
  "args": {
    "problems": [
      {
        "region": "face.chin",
        "severity": "HIGH",
        "scale": "secondary",
        "problem": "Chin is recessed in profile.",
        "consequence": "Lower-face contour has no clear chin plane.",
        "correction": "Use a small bilateral forward stroke and inspect the transition."
      }
    ]
  }
}
```

It binds the most recent single-view observation, source digest, shader and source
texture digests. A restarted session needs a new observation. Roles are logical
API roles, not independent AI identities or additional agents. Critic calls cannot
edit; artist calls cannot approve; reviewer calls cannot edit geometry.

The artist receives that diagnosis and submits one to three operations:

```json
{
  "role": "artist",
  "action": "artist.edit",
  "args": {
    "id": "chin-study-001",
    "pass": "matcap",
    "operations": [
      {
        "tool": "sculpt.grab",
        "region": "face.chin",
        "args": { "space": "world", "displacement": [0, -0.003, 0] }
      },
      {
        "tool": "sculpt.relax",
        "region": "face.chin",
        "args": { "strength": 0.2, "iterations": 2 }
      }
    ]
  }
}
```

The response includes affected regions/vertices, the automatic after preview,
before/after PNGs, side-by-side, 50% overlay, absolute color difference and alpha
silhouette difference. It checkpoints the `.blend`, shader profile, semantic
bindings and **all external source textures**, both before and after. Render
materials and outline copies are transient; diagnostic shaders never replace the
source materials. A failing operation rolls the entire batch back.

The reviewer opens those images and checks other angles with
`render.contact_sheet`. It then decides:

```json
{
  "role": "reviewer",
  "action": "reviewer.decide",
  "args": {
    "id": "chin-study-001",
    "verdict": "BETTER",
    "decision": "accepted",
    "reason": "Explain the visible improvement and any remaining defects."
  }
}
```

Verdicts: `BETTER`, `WORSE`, `MIXED`. Decisions: `accepted`, `rejected`,
`partially accepted`. `WORSE` must be rejected; rejection automatically restores
the checkpoint. Mixed changes require rejection or partial acceptance. Partial
acceptance retains the batch as working source; it does not select a subset of
its operations. Reject and resubmit a smaller batch when only some operations
should survive. Another edit is blocked until review. There is no iteration cap.
Tertiary detail requires a current assessment with all relevant form categories
passing. Current batches stay at 1–3 operations at every scale.

## Tools and coordinates

`session.info` exposes the callable catalog, diagnostic passes, source objects,
semantic bindings, detail-density priorities and availability. Empty/covered
body regions are explicitly unavailable; a jacket seam is not anatomy. Author
bindings in `source/semantic-regions.json`: each name declares `objects`, either
a weighted `group`, a world-space `center`/`radius`, a `union`, or a whole isolated
component. Initial Bebben landmarks are defaults for Bebben, not a universal head.
Other characters must supply their own bindings. Named `artist/<region>` vertex
groups are available in Blender. Facial sides use anatomical L=positive X.

| Category         | Direct actions                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VIEW / CAMERA    | Named front, profile, both three-quarters, high/low three-quarter and back; orbit; frame region; screen projection/grab                                  |
| SELECT           | Region, grow/shrink by connected edges, invert within bound objects, protect region masks                                                                |
| SCULPT           | Grab, smooth/relax, clay, planar clay strips, inflate, crease, flatten, scrape, pinch                                                                    |
| MESH             | Move/scale/rotate, edge slide, loop subdivision/dissolution, merge/split, surface snap/projection, Subdivision/Multires, isolated-component voxel remesh |
| EYES             | Upper/lower arc, canthi, slant, depth, iris exposure through the opening, lash thickness                                                                 |
| CURVES           | Create/edit/move/add/remove points, radius/profile, convert a single curve                                                                               |
| HAIR             | Reshape one cage: root/tip displacement, curvature, width, depth, twist, taper, overlap/layer/importance metadata; screen grab                           |
| MATERIAL         | Apply source shader; set typed profile parameters, ramps, colors, normal influence, roughness, specular, rims, outlines and mask bindings                |
| PAINT            | UV strokes, erase, blur, smudge, fill, gradient, mirror with optional RG swap; region/material masking; create bound source masks                        |
| LIGHTING         | Preset/key azimuth/elevation/fill/rim; automated 0–180° sweep at 15° intervals                                                                           |
| STATE            | Checkpoint, restore, undo/redo, variant, save, reload                                                                                                    |
| RENDER / COMPARE | Single view/region, contact sheet, turntable frames, diagnostics, matching-render comparison and target paintover overlay                                |

Brush arguments: `center`, `radius` in meters, `strength`, `falloff` (`smooth`,
`linear`, `sharp`, `constant`), `iterations`, `displacement`/`amount`/`direction`,
`frontFaceOnly`, `symmetry`, `space`. A selected region supplies the starting mask;
brush radius further restricts it. Symmetry mirrors paired semantic selections
and lateral grab direction. Selection masks protect geometry. Topology-changing
actions refuse shape-key cages; transfer correspondence deliberately first.
These are direct cage/brush approximations, not Blender's complete native brush
engine or automatic production retopology. Surface projection and component
replacement support that later manual work.

Spaces: `world`, `object`, `surface` (tangent/bitangent/normal), `camera`,
`symmetry` (world basis plus mirrored selection), `bone` (requires `rig`, `bone`).
Brush centers are world coordinates except in object space; displacement/direction
uses the chosen basis. Screen edits are separate:

```json
{
  "tool": "camera.screen_grab",
  "region": "face.chin",
  "args": {
    "point": [298, 480],
    "delta": [-6, 0],
    "radius": 48,
    "depthBehavior": "visible",
    "frontFaceOnly": false
  }
}
```

Coordinates refer to the **current returned render**, origin top left. Radius is
pixels. Per-vertex projected depth converts pixels into camera-plane displacement.
`visible`/`front_surface` use scene ray occlusion with a 6 mm cage/evaluated-surface
tolerance; `all` includes back surfaces. This is proportional projected cage
editing, not perfect pixel-to-sculpt-surface correspondence. Named cameras are
persistent view definitions; set the named view before editing. Inspect the other
side after any visible-surface stroke.

Painting uses UV points/radius in 0–1 units, origin bottom left, and RGBA colors.
`selectedOnly` defaults true; `material` optionally constrains polygons. Selected
polygons form a UV mask; overlapping mirrored islands intentionally share pixels.
For face masks, channels R/G encode left/right directional thresholds. New masks
must live in this character's source/textures directory. Hair highlight, roughness
and specular masks drive source nodes; source color masters drive painted albedo.
Do not confuse a painted mask with mesh volume.

## Observation and history

Persistent modes: `FACE_SCULPT` (matcap, hair hidden), `FACE_FINAL` (source shader),
`SILHOUETTE`, `TOPOLOGY`, `HAIR_SCULPT` (hair color emphasis), `CLOTHING_SCULPT`
(muted body), `DEFORMATION` (neutral clay). Native viewports retain camera/shading
state. Source meshes remain editable. Render diagnostic passes include beauty,
clay, matcap, silhouette, wireframe, camera normals, depth, AO, flat albedo,
material IDs, shadow/specular/outline only and face/hair masks. Depth is a relative
portrait-depth display; AO uses Blender's AO node. Missing mask outputs show black
and must not be mistaken for a finished mask. Eye cornea/parallax settings remain
source design fields; the current Bebben lacks a production cornea/mouth cavity.

Comparisons refuse mismatched camera version, resolution, pose/view, lighting,
pass or exposure. Paintover comparison accepts an original/user-provided PNG of
exactly matching dimensions via `compare.paintover`; it returns overlays and
color difference. Its silhouette comparison uses alpha, so an opaque paintover
needs a separately supplied transparent silhouette to make that output useful.
No automatic geometry fit or artistic grading is inferred from an image.

History is `review/artist/history.json`. It records diagnosis, actual tool calls,
images, verdict, reason and checkpoints. `state.undo`/`redo` restore whole accepted
batches including paint/settings. `state.restore` takes a checkpoint JSON path.
Native mesh changes made outside the tool require saving and `state.reload` before
a fresh critique; unsaved changes are detected instead of silently overwritten.
If a pending review exists, resolve it before switching source files.

`example.save` stores an accepted BETTER cycle under `art/examples/<category>/<id>`
with before/after, diagnosis, operations and review reasons. The seated-lash example
is a local repair, not a premium head reference. `art/library/index.json` registers
original source components with provenance and explicit `working`/`reviewed`
quality. Import refuses working parts unless explicitly requested; no production
base-head/ear/hand library has been certified yet.

```sh
npm run art:artist:smoke
npm run art:artist -- bebben '{"role":"artist","action":"session.stop"}'
```

The smoke test works on an ignored copy. It proves locality, feedback, rejection,
undo/redo, paint restore, screen edits, individual hair editing, stale appearance
rejection, detail gating and diagnostic render behavior. It never awards an art
approval. See Bebben's handoff for the remaining visual work.
