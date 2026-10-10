# Task for the next character artist

> Work in TANGER. Read root AGENTS.md, art/AGENTS.md, art/START_HERE.md,
> art/ARTIST_MODE.md and the repository production/review skills. Continue the
> current Bebben source using the persistent Blender Artist Tool Layer. Inspect
> its handoff and actual images first. Use critic → artist → reviewer cycles:
> diagnose 1–3 high-impact problems, select semantic regions, perform 1–3 local
> actions, open the returned previews/comparisons, accept or restore, repeat.
> Judge front/profile/both three-quarters/high/low views. Start with facial volume,
> profile, skin eyelid rims, cheek/jaw/chin continuity and ears; then hair overlap,
> upper-body clothing and shader design. The owner has ample workstation resources.
> Do not regenerate the whole character, add arbitrary tertiary noise, export,
> animate, optimize or integrate it into the game during this milestone. Preserve
> editable source, textures, checkpoints, provenance and honest artistic history.
> A locally accepted correction is not a premium-quality or owner approval.

## Continuation record

Each character keeps `handoff.md` with exact source/workflow paths, current image
IDs, accepted/rejected/partial cycles, remaining global blockers, material/modeling
decisions and the next concrete action. Durable history is `review/artist/history.json`;
checkpoints include source geometry and external paint/settings. Solved examples
include before/after and reasons; library parts carry provenance and a quality
label. Do not turn a working component into a reviewed asset by renaming it.

## Agent capabilities

Repository skills live under `.agents/skills/`. Explicitly read them when skill
discovery is unavailable. The artist needs shell/file access, Blender, the JSON
artist API and a real image viewer. Calls work across agent providers and require
no custom `bpy` code for ordinary region edits. Image generation can supply an
original concept/paintover, not editable character geometry. Logical roles can
use the same agent; this repository does not authorize spawning additional agents.
