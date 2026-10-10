# Bebben: Artist Tool Layer handoff

Current editable source: `source/bebben.blend` in this character directory.
Workflow: `source-workflow.json`. Source collection: `SOURCE`. Shader profile:
`source/anime-shader-profile.json`. Master images: `source/textures/`.
Manifest remains draft; this is working art, not an approved character delivery.

## Start here

Read `art/ARTIST_MODE.md`, then run from the repository root:

```sh
npm run art:artist:serve -- art/characters/bebben/source-workflow.json --ui
npm run art:artist -- bebben '{"role":"critic","action":"session.info"}'
```

Use fresh immutable observation/cycle IDs. The initializer `source/author_bebben.py`
is archived and refuses execution. Do not rebuild the character for a cheek edit.
Authored bindings in `source/semantic-regions.json` map this current Bebben source;
the named artist vertex groups are retained in the blend. Body areas hidden by clothing have unavailable bindings,
rather than fake anatomy made from garment seams. Other characters must author
`source/semantic-regions.json` for their own landmarks and topology.

## Current evidence and verdict

Full source pack: `review/iterations/artist-milestone-review/contact-sheet.png`.
Inspect `portrait-front.png`, both quarter portraits, `portrait-side.png`, above/
below, and `detail-eyes.png`. The eye close-up framing has been corrected. The
latest `assessment.json` is an actual agent review, bound to current source,
shader and texture signatures. **The global face stage is blocked.** Only the
earlier silhouette stage has an accepted historical receipt.

Local artistic history: `review/artist/history.json`. Demonstration cycles:

- `chin-profile-01`: screen-space stroke, rejected for an abrupt pointed bump;
  exact source checkpoint restored.
- `chin-profile-02`: smaller bilateral forward stroke plus relaxation, locally
  accepted as a modest correction; does not certify overall profile quality.
- `eye-corner-depth-01`: seated outer sclera/iris/lash patches, partially accepted.
  Far-eye white wedge improved; outer lash line then needed repair.
- `lash-seating-01`: only the outer lash ribbons moved forward, plus a restrained
  L lash thickness modifier; locally accepted. The corresponding solved example
  is `art/examples/face/seated-eye-lash-corner/`.
- `cheek-volume-01`: small bilateral cheek volume adjustment, partially accepted;
  initial matcap contrast was poor, so no global form approval was awarded.
- `source-lookdev-01`: dedicated SkinFace shader separates facial masks from ears,
  neck and hands; retained as working lookdev. A real 13-angle sweep is under
  `review/artist/observations/source-lookdev-01-sweep/`.

Each cycle retains before/after, overlay, difference, alpha silhouette comparison,
operations, critic diagnosis, reviewer reasons and source/paint/settings checkpoints.
Older matcap evidence uses artist camera version v1. Version v2 corrects camera-space
matcap lighting and records diagnostic exposure; compare only matching versions.
The source-review renderer uses its separately documented 85 mm v2 camera setup.

## Next concrete work

Start with the eye skin rim and socket transition. Current lashes are graphic
ribbons: the low angle lacks true skin thickness, and the corrected close-up shows
lower-lash clipping/short dark tabs. Select `face.upper_lid.L/R`, `face.lower_lid.L/R`,
canthi and socket masks; use existing cage editing or isolated local topology
replacement. Keep the seated eye patches; inspect front, profile, both quarters
and low/high views after 1–3 actions. Reject changes that clean one view by breaking
another. The iris is not the principal eyelid structure.

Next reconcile nose/mouth/chin profile, cheek-to-jaw planes and original ear
structure. The mouth is still an attached patch and the ear a simplified loop.
Use the hair-free v2 matcap/clay view to inspect forms. The initial tiny chin and
cheek corrections are working steps, not a reason to preserve weak topology.
Replace an isolated component if it fights the desired form.

Then design clump overlap/silhouette and upper-body garment masses. Hair clumps
are individually selectable, but the current repeated strips remain below target.
Skin/clothing shading is flat, hair highlights are uniform, and neutral materials
need more intentional painted design. Use UV mask tools and a light sweep; avoid
random detail noise. Exposed hands need anatomical plane/webbing work before a
later topology/rig phase.

Current source has no approved active deform rig, expressions, animation or
runtime derivative. The old rig is archived. Do not prioritize those, export,
optimization or gameplay integration in this milestone. No game operator was replaced.

## Verification and provenance

`art:artist:smoke` uses an ignored copy and tests locality, preview changes,
rejection/undo/redo, UV paint plus external texture restore, screen edits, one-lock
hair editing, appearance staleness, tertiary gating and all diagnostic passes.
The native GUI timer was also exercised through render/edit/reject/re-render.
Technical fixture export and the browser lab still pass their existing checks.
No technical result awards an artistic approval.

All source geometry/textures here are original TANGER work. No reference-game
assets or licensed third-party bases were imported. Library entries are explicitly
working components, not reviewed premium templates. Source/checkpoint publication
normalizes only known Blender pathname metadata; PNG File stamps are removed
without changing pixels. `source/privacy-normalization.json` records the blend
hash migration. Historical evidence digests were refreshed for metadata-only
normalization; no new visual approval was added. Originals used for that migration
remain in ignored local build storage.
