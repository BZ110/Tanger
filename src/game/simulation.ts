import type { AreaDefinition } from '../world/area-schema';
import { angleDelta, approach, lerp } from '../core/math';
import type { Vec3 } from '../core/math';
import { combatConfig as tuning, tutorialSteps } from '../content/tutorial';
import { CollisionWorld } from './collision';

export interface PlayerCommand {
  moveX: number;
  moveZ: number;
  yaw: number;
  attack: boolean;
  dash: boolean;
  sprint: boolean;
}
export type CombatEvent = {
  kind: 'attack' | 'hit' | 'dash' | 'evade' | 'damage' | 'step';
  combo: number;
};
export interface GameSnapshot {
  readonly player: {
    readonly position: Vec3;
    readonly heading: number;
    readonly speed: number;
    readonly attackProgress: number;
    readonly combo: number;
    readonly dashing: boolean;
    readonly health: number;
  };
  readonly target: {
    readonly position: Vec3;
    readonly windup: number;
    readonly flash: number;
    readonly hits: number;
  };
  readonly marker: Vec3;
  readonly tutorial: {
    readonly step: number;
    readonly progress: number;
    readonly goal: number;
    readonly title: string;
    readonly instruction: string;
  };
  readonly timeScale: number;
  readonly elapsed: number;
  readonly dashReady: number;
}

function anchor(area: AreaDefinition, id: string): Vec3 {
  for (const sector of area.sectors) {
    const entry = sector.anchors.find((candidate) => candidate.id === id);
    if (entry) {
      const [x, y, z] = entry.position;
      return { x, y, z };
    }
  }
  throw new Error(`Missing tutorial anchor: ${id}`);
}

/** Authoritative local simulation. No rendering objects, browser globals, or saves. */
export class GameSimulation {
  private readonly collision: CollisionWorld;
  private readonly spawn: Vec3;
  readonly marker: Vec3;
  readonly targetPosition: Vec3;
  readonly position: Vec3;
  private previous: Vec3;
  private heading = Math.PI;
  private velocity = { x: 0, z: 0 };
  private dashDirection = { x: 0, z: -1 };
  private dashThreatened = false;
  private dashRemaining = 0;
  private dashCooldown = 0;
  private attackTime = -1;
  private struck = false;
  private combo = 0;
  private bufferedAttack = false;
  private bufferRemaining = 0;
  private freeze = 0;
  private slowdown = 0;
  private targetFlash = 0;
  private targetClock = 1;
  private targetWindup = 0;
  private health = tuning.playerMaxHealth as number;
  private hits = 0;
  private step = 0;
  private progress = 0;
  private elapsed = 0;
  private timeScale = 1;
  private events: CombatEvent[] = [];
  private impactSlowdown = true;

  constructor(area: AreaDefinition) {
    this.collision = new CollisionWorld(area);
    this.spawn = anchor(area, 'player-spawn');
    this.marker = anchor(area, 'movement-marker');
    this.targetPosition = anchor(area, 'training-target');
    this.position = { ...this.spawn };
    this.previous = { ...this.position };
  }

  update(command: PlayerCommand, realDt: number): void {
    Object.assign(this.previous, this.position);
    this.elapsed += realDt;
    this.dashCooldown = Math.max(0, this.dashCooldown - realDt);
    this.targetFlash = Math.max(0, this.targetFlash - realDt);
    this.freeze = Math.max(0, this.freeze - realDt);
    this.slowdown = Math.max(0, this.slowdown - realDt);
    this.bufferRemaining = Math.max(0, this.bufferRemaining - realDt);
    if (this.bufferRemaining === 0) this.bufferedAttack = false;
    this.timeScale =
      this.freeze > 0 ? 0 : this.slowdown > 0 ? tuning.slowScale : 1;
    const dt = realDt * this.timeScale;
    const length = Math.hypot(command.moveX, command.moveZ);
    const mx = command.moveX / Math.max(1, length),
      mz = command.moveZ / Math.max(1, length);
    const dx = mx * Math.cos(command.yaw) + mz * Math.sin(command.yaw);
    const dz = -mx * Math.sin(command.yaw) + mz * Math.cos(command.yaw);

    if (command.dash && this.dashCooldown === 0) {
      this.dashThreatened =
        this.targetWindup > 0 &&
        Math.hypot(
          this.position.x - this.targetPosition.x,
          this.position.z - this.targetPosition.z,
        ) < tuning.trainingReach;
      this.dashDirection =
        length > 0
          ? { x: dx, z: dz }
          : { x: Math.sin(this.heading), z: Math.cos(this.heading) };
      this.dashRemaining = tuning.dashDuration;
      this.dashCooldown = tuning.dashCooldown;
      this.attackTime = -1;
      this.bufferedAttack = false;
      this.events.push({ kind: 'dash', combo: this.combo });
      if (this.step === 2) this.advanceProgress();
    }
    if (command.attack && this.dashRemaining === 0) {
      if (this.attackTime < 0) this.beginAttack();
      else {
        this.bufferedAttack = true;
        this.bufferRemaining = 0.45;
      }
    }

    if (this.dashRemaining > 0) {
      // Dodge response uses real time, even while the world is hit-stopped.
      const dashDt = Math.min(realDt, this.dashRemaining);
      this.collision.move(
        this.position,
        this.dashDirection.x * tuning.dashSpeed * dashDt,
        this.dashDirection.z * tuning.dashSpeed * dashDt,
        tuning.playerRadius,
      );
      this.heading = Math.atan2(this.dashDirection.x, this.dashDirection.z);
      this.dashRemaining = Math.max(0, this.dashRemaining - realDt);
    } else {
      const speed =
        (command.sprint ? tuning.sprintSpeed : tuning.walkSpeed) *
        (this.attackTime >= 0 ? 0.25 : 1);
      this.velocity.x = approach(
        this.velocity.x,
        dx * speed,
        tuning.acceleration * dt,
      );
      this.velocity.z = approach(
        this.velocity.z,
        dz * speed,
        tuning.acceleration * dt,
      );
      this.collision.move(
        this.position,
        this.velocity.x * dt,
        this.velocity.z * dt,
        tuning.playerRadius,
      );
      if (length > 0 && this.attackTime < 0)
        this.heading +=
          angleDelta(this.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 18);
    }

    if (this.attackTime >= 0) {
      this.attackTime += dt;
      if (!this.struck && this.attackTime >= tuning.strikeAt) {
        this.struck = true;
        this.strike();
      }
      if (this.attackTime >= tuning.attackDuration) {
        this.attackTime = -1;
        if (this.bufferedAttack && this.bufferRemaining > 0) {
          this.bufferedAttack = false;
          this.beginAttack();
        }
      }
    }
    if (
      this.step === 0 &&
      Math.hypot(
        this.position.x - this.marker.x,
        this.position.z - this.marker.z,
      ) < 1.1
    )
      this.advanceProgress();
    if (this.step >= 3) this.updateTarget(dt);
  }

  private beginAttack(): void {
    this.attackTime = 0;
    this.struck = false;
    this.combo = (this.combo % 3) + 1;
    const dx = this.targetPosition.x - this.position.x,
      dz = this.targetPosition.z - this.position.z;
    if (Math.hypot(dx, dz) < 6) this.heading = Math.atan2(dx, dz);
    this.events.push({ kind: 'attack', combo: this.combo });
  }

  private strike(): void {
    const dx = this.targetPosition.x - this.position.x,
      dz = this.targetPosition.z - this.position.z;
    if (
      Math.hypot(dx, dz) > tuning.attackReach ||
      Math.abs(angleDelta(this.heading, Math.atan2(dx, dz))) > tuning.attackArc
    )
      return;
    this.hits++;
    this.targetFlash = 0.2;
    if (this.impactSlowdown) {
      this.freeze = tuning.impactFreeze;
      this.slowdown = tuning.impactFreeze + tuning.impactSlowdown;
    }
    this.events.push({ kind: 'hit', combo: this.combo });
    if (this.step === 1 || this.step === 4) this.advanceProgress();
  }

  private updateTarget(dt: number): void {
    if (this.targetWindup > 0) {
      this.targetWindup = Math.max(0, this.targetWindup - dt);
      if (this.targetWindup === 0) {
        const distance = Math.hypot(
          this.position.x - this.targetPosition.x,
          this.position.z - this.targetPosition.z,
        );
        if (distance < tuning.trainingReach) {
          if (this.dashRemaining > 0) {
            this.events.push({ kind: 'evade', combo: this.combo });
            if (this.impactSlowdown) this.slowdown = 0.22;
            if (this.step === 3) this.advanceProgress();
          } else {
            this.health = Math.max(0, this.health - tuning.targetDamage);
            this.events.push({ kind: 'damage', combo: this.combo });
            if (this.health === 0) {
              this.health = tuning.playerMaxHealth;
              Object.assign(this.position, this.spawn);
              Object.assign(this.previous, this.spawn);
            }
          }
        } else if (
          this.dashRemaining > 0 &&
          this.dashThreatened &&
          this.step === 3 &&
          distance < tuning.trainingReach + 3.5
        ) {
          this.events.push({ kind: 'evade', combo: this.combo });
          this.advanceProgress();
        }
        this.targetClock = tuning.trainingRecovery;
      }
    } else {
      this.targetClock -= dt;
      if (this.targetClock <= 0) this.targetWindup = tuning.trainingWindup;
    }
  }

  private advanceProgress(): void {
    this.progress++;
    if (
      this.progress >= tutorialSteps[this.step]!.goal &&
      this.step < tutorialSteps.length - 1
    ) {
      this.step++;
      this.progress = 0;
      this.targetClock = 1;
      this.targetWindup = 0;
      this.events.push({ kind: 'step', combo: this.combo });
    }
  }

  snapshot(alpha = 1): GameSnapshot {
    const tutorial = tutorialSteps[this.step]!;
    return {
      player: {
        position: {
          x: lerp(this.previous.x, this.position.x, alpha),
          y: this.position.y,
          z: lerp(this.previous.z, this.position.z, alpha),
        },
        heading: this.heading,
        speed:
          this.dashRemaining > 0
            ? tuning.dashSpeed
            : Math.hypot(this.velocity.x, this.velocity.z),
        attackProgress:
          this.attackTime < 0 ? -1 : this.attackTime / tuning.attackDuration,
        combo: this.combo,
        dashing: this.dashRemaining > 0,
        health: this.health,
      },
      target: {
        position: this.targetPosition,
        windup: this.targetWindup / tuning.trainingWindup,
        flash: this.targetFlash / 0.2,
        hits: this.hits,
      },
      marker: this.marker,
      tutorial: {
        step: this.step,
        progress: this.progress,
        goal: tutorial.goal,
        title: tutorial.title,
        instruction: tutorial.instruction,
      },
      elapsed: this.elapsed,
      timeScale: this.timeScale,
      dashReady: 1 - this.dashCooldown / tuning.dashCooldown,
    };
  }

  takeEvents(): readonly CombatEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
  setImpactSlowdown(enabled: boolean): void {
    this.impactSlowdown = enabled;
    if (!enabled) this.freeze = this.slowdown = 0;
  }
  reset(): void {
    Object.assign(this.position, this.spawn);
    Object.assign(this.previous, this.spawn);
    this.velocity = { x: 0, z: 0 };
    this.heading = Math.PI;
    this.dashRemaining =
      this.dashCooldown =
      this.freeze =
      this.slowdown =
      this.targetFlash =
      this.targetWindup =
        0;
    this.attackTime = -1;
    this.dashThreatened = false;
    this.bufferedAttack = false;
    this.bufferRemaining = 0;
    this.combo = this.hits = this.step = this.progress = this.elapsed = 0;
    this.health = tuning.playerMaxHealth;
    this.targetClock = 1;
    this.timeScale = 1;
    this.events = [];
  }
}
