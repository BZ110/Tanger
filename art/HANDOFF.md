# Task for the next character agent

Copy the task below into the next session and append the character direction you
want. If you have not chosen a character yet, let the agent first propose a small
original brief and silhouette/face study before full production.

> Work in the TANGER repository. Read root AGENTS.md, art/AGENTS.md,
> art/START_HERE.md, and .agents/skills/tanger-character-production/SKILL.md.
> Create one original polished stylized 3D anime character using the workspace's
> Blender pipeline. The current procedural operator is not the quality target.
> Establish the brief, silhouette and face first; iterate with actual rendered
> images. Then author hair, clothing, textures, deformation topology, a weighted
> rig, facial morphs and appropriate animation. Keep the editable source and
> provenance. Export a self-contained GLB, validate it, and inspect it in the
> browser character lab. Use the review skill before delivery. The workstation
> has ample compute/RAM; do not compromise source quality on assumed hardware
> limits. Do not replace the game operator or add gameplay during this task.
> Deliver the source, manifest, visual evidence, review notes, and specific
> remaining limitations. Do not claim owner approval or finished quality from a
> successful validator run. Character direction: [append my choices here].

## Agent continuation record

At a handoff, leave `art/characters/<id>/handoff.md` with the exact source/manifest,
latest reviewed images, completed passes, open defects, modeling decisions,
export warnings, and the next concrete step. Preserve the current `.blend` before
destructive edits. Record reproducible scripts alongside the source if used.
Another agent should be able to continue without decoding a chat transcript.

## Skill availability

Repository skills are stored under `.agents/skills/`. If an agent interface does
not automatically discover them, explicitly read the referenced `SKILL.md` files.
The skills use repository commands and documentation rather than tool names
specific to one model provider. A working agent needs file/shell access, Blender
Python execution, image inspection, and browser inspection or Playwright access.
An image-only generation tool cannot supply editable rigged character geometry.
