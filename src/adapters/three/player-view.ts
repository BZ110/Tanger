import * as THREE from 'three';
import type { GameSnapshot } from '../../game/simulation';

/** Placeholder art lives in this adapter; replacing a model doesn't change gameplay. */
export class PlayerView {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];

  constructor() {
    const tunic = new THREE.MeshStandardMaterial({
      color: '#516e64',
      roughness: 1,
    });
    const cloth = new THREE.MeshStandardMaterial({
      color: '#b65b35',
      roughness: 1,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: '#e2c4a3',
      roughness: 1,
    });
    const boots = new THREE.MeshStandardMaterial({
      color: '#463f36',
      roughness: 1,
    });
    const hair = new THREE.MeshStandardMaterial({
      color: '#534238',
      roughness: 1,
    });
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.38, 0.7, 6),
      tunic,
    );
    torso.position.y = 0.92;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), skin);
    head.position.y = 1.52;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      hair,
    );
    cap.position.y = 1.57;
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.68, 0.12), cloth);
    cape.position.set(0, 0.97, -0.27);
    cape.rotation.x = -0.12;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.22), boots);
    pack.position.set(0, 1, -0.39);
    this.body.add(torso, head, cap, cape, pack);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.48, 0.19),
        boots,
      );
      leg.position.set(side * 0.14, 0.3, 0);
      this.legs.push(leg);
      this.root.add(leg);
    }
    this.root.add(this.body);
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
  }

  update(snapshot: GameSnapshot): void {
    const { player, elapsed } = snapshot;
    this.root.position.set(
      player.position.x,
      player.position.y,
      player.position.z,
    );
    this.root.rotation.y = player.heading;
    this.body.position.y = player.moving
      ? Math.sin(elapsed * 16) * 0.035
      : Math.sin(elapsed * 2) * 0.012;
    this.legs.forEach((leg, index) => {
      leg.rotation.x = player.moving
        ? Math.sin(elapsed * 12 + index * Math.PI) * 0.55
        : 0;
    });
  }
}
