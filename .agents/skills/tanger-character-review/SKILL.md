---
name: tanger-character-review
description: Review, diagnose, and repair an existing TANGER stylized 3D character delivery using Blender source, GLB validation, close-up views, expressions, and deformation evidence. Use for visual QA or export/rig defects. Do not use to invent a new character brief, build maps or UI, or certify art quality using file statistics alone.
---

# TANGER character review

Read root `AGENTS.md`, `art/AGENTS.md`, `art/QUALITY.md`, and `art/RUNTIME.md`.
Locate the character's brief, manifest, source, and previous review before editing.

## Inspect the actual result

- Run `art:validate` and `art:inspect`; examine the reports under `art/.build/reports/`.
  Record validator warnings, not just errors. Do not waive a broken export because
  the Blender screenshot looks good.
- Render the source with `art:render`; load the GLB in `art:lab` and capture browser
  views with `art:capture` or the PNG button. Compare front/3/4/profile/back and face.
- Inspect the full clips at slow and normal speed, expression values 0/0.5/1 and
  combinations, joint extremes, key-light rotation, neutral light and contrasting light.
- Check silhouette and readability at gameplay distance, portrait appearance,
  and topology/weights up close. Follow the concrete criteria in `art/QUALITY.md`.

## Diagnose and repair

Write each defect with an image or clip timestamp, its visible consequence, and
the source change needed. Prioritize face/profile, silhouette, deformation, and
material stability before tiny surface detail. Preserve a source checkpoint,
repair in Blender, re-export, and regenerate relevant evidence. Do not retouch
screenshots to hide problems in the model.

## Record the verdict

Keep curated evidence in `art/characters/<id>/review/` and observations in the
manifest's review notes. Set `pending`, `revise`, or `accepted` honestly and name
the actual reviewer. `review` stage needs at least six real evidence files, but
six images alone do not prove a complete rig or good animation. Keep owner design
approval separate from agent review. List shader, animation, dynamics, and runtime
limitations explicitly, then leave a continuation record using `art/HANDOFF.md`.
