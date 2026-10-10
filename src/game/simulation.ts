import type { GameConfig } from '../content/game-config';
import { lerp } from '../core/math';
import { ChunkStream } from '../world/chunk-stream';
import { createPlayer, movePlayer } from './player';
import type { PlayerCommand, PlayerState } from './player';
import type { WorldChunk } from '../world/terrain';
import type { Vec3 } from '../core/math';

export interface GameSnapshot {
  readonly player: {
    readonly position: Vec3;
    readonly heading: number;
    readonly moving: boolean;
  };
  readonly chunks: ReadonlyMap<string, WorldChunk>;
  readonly elapsed: number;
}
export interface SavedGame {
  readonly seed: number;
  readonly player: { readonly x: number; readonly z: number };
}

export class GameSimulation {
  readonly player: PlayerState;
  readonly world: ChunkStream;
  private elapsed = 0;

  constructor(
    readonly config: GameConfig,
    saved?: SavedGame,
  ) {
    const spawn =
      saved?.seed === config.world.seed ? saved.player : config.player.spawn;
    this.player = createPlayer(spawn.x, spawn.z, config.world.seed);
    this.world = new ChunkStream(config.world);
    this.world.update(spawn.x, spawn.z);
  }

  update(command: PlayerCommand, dt: number): void {
    movePlayer(this.player, command, dt, this.config);
    this.world.update(this.player.position.x, this.player.position.z);
    this.elapsed += dt;
  }

  snapshot(alpha = 1): GameSnapshot {
    const { position, previousPosition, heading, moving } = this.player;
    return {
      player: {
        position: {
          x: lerp(previousPosition.x, position.x, alpha),
          y: lerp(previousPosition.y, position.y, alpha),
          z: lerp(previousPosition.z, position.z, alpha),
        },
        heading,
        moving,
      },
      chunks: this.world.chunks,
      elapsed: this.elapsed,
    };
  }

  save(): SavedGame {
    return {
      seed: this.config.world.seed,
      player: { x: this.player.position.x, z: this.player.position.z },
    };
  }

  reset(): void {
    const { spawn } = this.config.player;
    Object.assign(
      this.player,
      createPlayer(spawn.x, spawn.z, this.config.world.seed),
    );
    this.elapsed = 0;
    this.world.update(spawn.x, spawn.z);
  }
}
