import type { Object3D } from 'three';
import type { GameSnapshot } from '../../game/simulation';

export class OperatorView {
  private readonly joints = new Map<string, Object3D>();
  constructor(readonly root: Object3D) {
    for (const name of [
      'pelvis',
      'torso',
      'arm_left',
      'arm_right',
      'forearm_left',
      'forearm_right',
      'leg_left',
      'leg_right',
      'shin_left',
      'shin_right',
    ]) {
      const joint = root.getObjectByName(name);
      if (!joint) throw new Error(`Operator rig is missing ${name}`);
      this.joints.set(name, joint);
    }
  }
  update(snapshot: GameSnapshot): void {
    const { player, elapsed } = snapshot;
    this.root.position.set(
      player.position.x,
      player.position.y,
      player.position.z,
    );
    this.root.rotation.y = player.heading;
    const speed = Math.min(1, player.speed / 4.7);
    const walk = Math.sin(elapsed * 11) * speed;
    const attack =
      player.attackProgress < 0 ? 0 : Math.sin(player.attackProgress * Math.PI);
    const joint = (name: string) => this.joints.get(name)!;
    joint('pelvis').position.y = 0.89 + Math.abs(walk) * 0.025;
    joint('torso').rotation.x = player.dashing ? -0.28 : attack * -0.12;
    joint('torso').rotation.y = attack * (player.combo === 2 ? -0.65 : 0.4);
    for (const [side, phase] of [
      ['left', 1],
      ['right', -1],
    ] as const) {
      joint(`leg_${side}`).rotation.x = walk * 0.5 * phase;
      joint(`shin_${side}`).rotation.x = Math.max(0, -walk * phase) * 0.55;
      joint(`arm_${side}`).rotation.x =
        -walk * 0.35 * phase - attack * (side === 'right' ? 1.9 : 0.7);
      joint(`arm_${side}`).rotation.z =
        (side === 'left' ? 0.12 : -0.12) +
        attack * (side === 'left' ? 0.15 : -0.4);
      joint(`forearm_${side}`).rotation.x =
        -0.1 - attack * (side === 'right' ? 0.6 : 1);
    }
  }
}
