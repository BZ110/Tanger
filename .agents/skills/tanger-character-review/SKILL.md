---
name: tanger-character-review
description: Inspect, diagnose and repair existing TANGER anime character sources using fixed Blender views and guarded artist-tool before/after reviews. Use for visual QA, face/profile/lid/hair/shader defects, or later authorized rig/export defects. Exclude new character invention, maps/UI and quality certification from file statistics.
---

# TANGER character review

Read root `AGENTS.md`, `art/AGENTS.md`, `art/QUALITY.md`, `art/ARTIST_MODE.md`,
the character brief, handoff and artistic history. Current work is static source
refinement; GLB/animation review follows a later authorized production milestone.

## Critic

Use `view.set`, `render.view`, `render.contact_sheet`, diagnostics and light sweeps.
**Open the returned images.** Inspect front, profile, both three-quarters, high/low
angles; compare matcap/clay without hair against the source shader. Select only
1–3 high-impact defects with semantic area, concrete visible problem, consequence,
severity, scale and correction. Record `critic.record`; never infer quality from
mesh density, a schema, a render filename or a successful export.

## Reviewer

After `artist.edit`, open before/after, side-by-side, overlay/difference and other
views. The artist role cannot approve. Record `reviewer.decide` with BETTER/WORSE/
MIXED, accepted/rejected/partially accepted and visual reasons. WORSE must restore.
Partial acceptance retains the whole batch as working source, so reject and
resubmit smaller batches if only some operations should survive. No blind follow-up
edits while a review is pending. Logical roles may share a model; do not spawn
additional agents under this repository's instructions.

Check facial profile volume, noncircular eye shape, actual skin lid thickness,
canthi, cheeks, nose/mouth/chin balance, ear structure, hair overlap and outfit
masses before tertiary detail. Use mask/specular/shadow diagnostics and full light
sweeps for materials. Record remaining defects even when a local change is better.

## Global assessment and handoff

Source renders create NOT_REVIEWED templates; replace them with honest image-backed
assessments. Ordered global stages, required views and source/appearance signatures
must pass before advance. A local accepted correction never approves a whole face,
character or owner design. Keep meaningful checkpoints/history and solved examples.
Leave exact source, reviewed images, accepted/rejected cycles and next action in
the handoff. Later authorized export work also needs real glTF validation, browser
captures, deformation/expressions and whole-clip evidence; see `art/RUNTIME.md`.
