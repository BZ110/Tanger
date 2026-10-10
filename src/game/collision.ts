import type { Vec3 } from '../core/math';
import type { AreaDefinition } from '../world/area-schema';
import { clamp } from '../core/math';

interface Wall {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}
export class CollisionWorld {
  private readonly walls: Wall[] = [];
  constructor(area: AreaDefinition) {
    for (const sector of area.sectors)
      for (const collider of sector.colliders) {
        if (collider.shape.kind !== 'box')
          throw new Error(
            'This tutorial controller currently supports box colliders only',
          );
        const [qx, qy, qz, qw] = collider.rotation;
        if (qx !== 0 || qy !== 0 || qz !== 0 || Math.abs(qw) !== 1)
          throw new Error(
            'This tutorial controller requires axis-aligned box colliders',
          );
        const [x, y, z] = collider.position;
        const [hx, hy, hz] = collider.shape.halfExtents;
        // Floor/ceiling volumes do not obstruct grounded horizontal movement.
        if (y + hy <= 0.01 || y - hy >= 2.2) continue;
        this.walls.push({
          minX: x - hx,
          maxX: x + hx,
          minZ: z - hz,
          maxZ: z + hz,
        });
      }
  }

  move(position: Vec3, dx: number, dz: number, radius: number): void {
    // Substeps prevent a fast dash from tunneling through a thin wall.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.5)));
    for (let i = 0; i < steps; i++) {
      position.x += dx / steps;
      this.resolve(position, radius);
      position.z += dz / steps;
      this.resolve(position, radius);
    }
  }

  private resolve(position: Vec3, radius: number): void {
    for (const wall of this.walls) {
      const nearX = clamp(position.x, wall.minX, wall.maxX);
      const nearZ = clamp(position.z, wall.minZ, wall.maxZ);
      const dx = position.x - nearX,
        dz = position.z - nearZ;
      const distance = Math.hypot(dx, dz);
      if (distance >= radius) continue;
      if (distance > 0.00001) {
        const correction = (radius - distance) / distance;
        position.x += dx * correction;
        position.z += dz * correction;
      } else {
        const choices = [
          {
            distance: position.x - wall.minX,
            x: wall.minX - radius,
            z: position.z,
          },
          {
            distance: wall.maxX - position.x,
            x: wall.maxX + radius,
            z: position.z,
          },
          {
            distance: position.z - wall.minZ,
            x: position.x,
            z: wall.minZ - radius,
          },
          {
            distance: wall.maxZ - position.z,
            x: position.x,
            z: wall.maxZ + radius,
          },
        ].sort((a, b) => a.distance - b.distance);
        const nearest = choices[0]!;
        position.x = nearest.x;
        position.z = nearest.z;
      }
    }
  }
}
