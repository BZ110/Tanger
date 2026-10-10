# Character production instructions

Read [START_HERE.md](START_HERE.md), then the repository skill matching your task.
Use `.agents/skills/tanger-character-production/SKILL.md` for creation and
`.agents/skills/tanger-character-review/SKILL.md` for inspection and repair.

- The owner wants carefully authored, polished stylized anime characters. The
  current procedural game operator and pipeline fixture are below that standard.
- The workstation supports demanding modeling, high-resolution textures, renders,
  and concurrent processes. Do not simplify the art because of assumed machine
  limits. Keep source quality separate from editable browser delivery budgets.
- Create original designs. Study official imagery for broad principles, never
  reproduce a named character, extract game assets, or use an unlicensed base mesh.
- Work in a character's own directory. Keep editable `.blend` source, source
  textures, authoring scripts when used, a manifest, a brief, and honest review notes.
- Model actual surfaces and deformation topology. Primitives may be temporary
  blockouts; adding subdivision, neon, grain, or bloom does not finish them.
- Work through silhouette, face, hair, clothing, textures, rig, expressions,
  animation, export, and browser review. Inspect pictures after meaningful changes.
- Do not invent artistic approval. `stage: review` records a completed documented
  review; it does not imply the owner approved the character design.
- Keep test files and all caches under ignored `art/.build/` and `.tools/`.
  Curate durable evidence under `art/characters/<id>/review/` when delivering.
- Do not replace the game operator or run `assets:build` to regenerate it during
  character production. Integrating skinned characters is a separate runtime task.
- No README. New authoring Markdown is allowed in `art/` and `.agents/skills/`.
- Follow root Git/privacy instructions. Inspect Blender source for private paths,
  creator metadata, reference images, and packed inputs before publishing it.

Headless Blender can execute Python with `bpy`; it does not provide artistic
judgment. If the available tools cannot author a requested quality level, report
that limitation and the remaining specific work, without relabeling a blockout.
