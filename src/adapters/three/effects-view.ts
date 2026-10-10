import * as T from 'three';
import type { GameSnapshot } from '../../game/simulation';

/** Pooled gameplay indicators, not environment geometry. */
export class EffectsView {
  readonly root = new T.Group();
  private readonly marker: T.Mesh;
  private readonly threat: T.Mesh;
  private readonly slash: T.Mesh;
  private readonly impact: T.Mesh;
  private readonly ghosts: T.Mesh[] = [];
  private impactTime = 0;

  constructor() {
    this.marker = new T.Mesh(
      new T.RingGeometry(0.82, 0.92, 64),
      new T.MeshBasicMaterial({
        color: '#72dae2',
        transparent: true,
        opacity: 0.9,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.threat = new T.Mesh(
      new T.RingGeometry(2.55, 2.65, 64),
      new T.MeshBasicMaterial({
        color: '#ef5645',
        transparent: true,
        opacity: 0.6,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    this.threat.rotation.x = -Math.PI / 2;
    this.slash = new T.Mesh(
      new T.TorusGeometry(0.95, 0.022, 8, 40, Math.PI * 1.2),
      new T.MeshBasicMaterial({
        color: '#a3edf0',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.impact = new T.Mesh(
      new T.SphereGeometry(0.17, 16, 12),
      new T.MeshBasicMaterial({
        color: '#fff3d3',
        transparent: true,
        depthWrite: false,
      }),
    );
    for (let i = 0; i < 5; i++) {
      const ghost = new T.Mesh(
        new T.CapsuleGeometry(0.18, 0.7, 4, 12),
        new T.MeshBasicMaterial({
          color: '#63cbd8',
          transparent: true,
          opacity: 0.1 * (1 - i / 5),
          depthWrite: false,
        }),
      );
      this.ghosts.push(ghost);
      this.root.add(ghost);
    }
    this.root.add(this.marker, this.threat, this.slash, this.impact);
  }
  hit(): void {
    this.impactTime = 0.16;
  }
  update(snapshot: GameSnapshot, dt: number): void {
    const { player, target, marker, elapsed } = snapshot;
    this.marker.position.set(marker.x, 0.06, marker.z);
    this.marker.visible = snapshot.tutorial.step === 0;
    this.marker.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.04);
    this.threat.position.set(target.position.x, 0.055, target.position.z);
    this.threat.visible = target.windup > 0;
    this.threat.scale.setScalar(0.5 + (1 - target.windup) * 0.5);
    this.slash.visible =
      player.attackProgress > 0.24 && player.attackProgress < 0.65;
    this.slash.position.set(
      player.position.x + Math.sin(player.heading) * 0.5,
      player.position.y + 1.15,
      player.position.z + Math.cos(player.heading) * 0.5,
    );
    this.slash.rotation.set(
      0.4,
      player.heading,
      player.attackProgress * Math.PI * 3,
    );
    this.impactTime = Math.max(0, this.impactTime - dt);
    this.impact.visible = this.impactTime > 0;
    this.impact.position.set(target.position.x, 1.4, target.position.z + 0.3);
    this.impact.scale.setScalar(1 + (0.16 - this.impactTime) * 12);
    this.ghosts.forEach((ghost, index) => {
      ghost.visible = player.dashing;
      ghost.position.set(
        player.position.x - Math.sin(player.heading) * index * 0.35,
        1,
        player.position.z - Math.cos(player.heading) * index * 0.35,
      );
    });
  }
}
