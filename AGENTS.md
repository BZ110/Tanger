# TANGER project instructions

## Product direction

- The in-game name is **TANGER**, always uppercase. The repository is Tanger.
- Build iteratively. The current scope is a deliberately dry training tutorial,
  not a complete world, story, roster, or monetization system.
- Visual direction: polished original cyberpunk environments and characters,
  detailed materials and smooth silhouettes. Avoid faceted low-poly placeholder art.
- References: Genshin-like exploration and ZZZ-like responsive action. Research
  publicly documented behavior; never claim access to proprietary implementations.
- Create original assets or use explicitly licensed assets with recorded provenance.
  Never extract models, textures, animation, sound, UI, or locations from reference games.
- The intended long-term model is community-hosted servers, like Minecraft. Do not
  assume centrally managed accounts, mandatory cloud saves, or a global competitive
  authority. This tutorial is local; server networking is not implemented yet.
- Keep settings and gameplay state in memory for now. Do not add persistence unless asked.

## Architecture

- Keep core math/timing and gameplay rules independent of DOM, Three.js, and audio.
- Put authored gameplay definitions in content/, simulation in game/, area data in
  world/, orchestration/ports in application/, and concrete platform work in adapters/.
- Load area manifests and GLB assets as data. Do not hardcode maps in renderer constructors.
- Combat pacing must distinguish real time from slowed simulation time. Input and
  pause controls remain responsive during impact freezes and slowdown.
- Tune tutorial steps, combat timings, damage, and spawn anchors in content definitions.
- Own and release listeners, animation loops, GPU resources, and audio resources.
- Keep area validation for useful errors and reliable loading. Do not add anti-cheat
  or centralized data-integrity infrastructure merely because gameplay has state.
- Do not delegate to additional agents unless the user explicitly requests it.

## Character authoring

- For anime character work, read art/AGENTS.md and art/START_HERE.md. Use the
  production/review skills in .agents/skills/ for their respective tasks.
- The workstation has ample resources. Do not lower authoring quality based on
  assumed compute/RAM limits. Browser delivery budgets remain separately editable.
- Refine existing characters through art/ARTIST_MODE.md: persistent Blender,
  semantic local edits, 1–3 operations, visual comparison and role-separated review.
  Restore worse work. Logical critic/artist/reviewer roles do not authorize agents.
- Keep Blender source, textures, rig, manifest, provenance, and visible review
  evidence. Technical validation is not an artistic approval.
- The current procedural operator is a legacy placeholder. Work in the separate
  character lab until game integration is authorized; do not overwrite it with
  scripts/build-assets.ts during production character work.

## Verification

- Run npm run check, npm run build, npm run test:e2e, and validate changed area files.
- Use behavior tests for combat timing, dash/collision, tutorial progression, and menu flows.
- Inspect screenshots of the start screen and playable tutorial before delivery.
- Update docs/architecture.txt and asset provenance notes as implementation changes.
- No README. Markdown is allowed for AGENTS.md, art/ instructions/briefs/reviews,
  and repository skills in .agents/skills/. Other Markdown remains ignored.
- For authoring tool changes, also build the lab, test capture/import behavior,
  and run art:smoke after changes to the Blender pipeline.

## Git and privacy

- Author AND committer must be BZ110 <49293139+BZ110@users.noreply.github.com>.
- Verify both identities before any commit/push. Never publish a personal name,
  personal email address, machine hostname, home-directory path, or secrets.
- Preserve the repository-local Git identity; do not change global Git settings.
- Inspect staged files before publishing. Keep generated test artifacts ignored.
