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

## Verification

- Run npm run check, npm run build, npm run test:e2e, and validate changed area files.
- Use behavior tests for combat timing, dash/collision, tutorial progression, and menu flows.
- Inspect screenshots of the start screen and playable tutorial before delivery.
- Update docs/architecture.txt and asset provenance notes as implementation changes.
- No README. Markdown files stay ignored except this explicitly requested AGENTS.md.

## Git and privacy

- Author AND committer must be BZ110 <49293139+BZ110@users.noreply.github.com>.
- Verify both identities before any commit/push. Never publish a personal name,
  personal email address, machine hostname, home-directory path, or secrets.
- Preserve the repository-local Git identity; do not change global Git settings.
- Inspect staged files before publishing. Keep generated test artifacts ignored.
