import type { Vec3 } from '../core/math';
import type { GameConfig } from '../content/game-config';
import { terrainHeight } from '../world/terrain';

export interface PlayerCommand {
  readonly moveX: number;
  readonly moveZ: number;
  readonly sprint: boolean;
  readonly cameraYaw: number;
}
export interface PlayerState {
  position: Vec3;
  previousPosition: Vec3;
  heading: number;
  moving: boolean;
}

export function createPlayer(x: number, z: number, seed: number): PlayerState {
  const position = { x, y: terrainHeight(x, z, seed), z };
  return {
    position,
    previousPosition: { ...position },
    heading: Math.PI,
    moving: false,
  };
}

export function movePlayer(
  player: PlayerState,
  command: PlayerCommand,
  dt: number,
  config: GameConfig,
): void {
  Object.assign(player.previousPosition, player.position);
  const length = Math.hypot(command.moveX, command.moveZ);
  player.moving = length > 0;
  if (!player.moving) return;
  const normalization = Math.max(1, length);
  const x = command.moveX / normalization;
  const z = command.moveZ / normalization;
  const dx = x * Math.cos(command.cameraYaw) + z * Math.sin(command.cameraYaw);
  const dz = -x * Math.sin(command.cameraYaw) + z * Math.cos(command.cameraYaw);
  const speed = command.sprint
    ? config.player.runSpeed
    : config.player.walkSpeed;
  player.position.x += dx * speed * dt;
  player.position.z += dz * speed * dt;
  player.position.y = terrainHeight(
    player.position.x,
    player.position.z,
    config.world.seed,
  );
  player.heading = Math.atan2(dx, dz);
}
