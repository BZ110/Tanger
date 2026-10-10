export interface GameConfig {
  readonly world: {
    readonly seed: number;
    readonly chunkSize: number;
    readonly radius: number;
    readonly segments: number;
  };
  readonly player: {
    readonly walkSpeed: number;
    readonly runSpeed: number;
    readonly spawn: { readonly x: number; readonly z: number };
  };
}

/** Tune content here; systems consume data instead of scattering magic numbers. */
export const gameConfig: GameConfig = {
  world: { seed: 74021, chunkSize: 32, radius: 2, segments: 16 },
  player: { walkSpeed: 4, runSpeed: 7.5, spawn: { x: 0, z: 8 } },
};
