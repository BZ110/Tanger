export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Stable, coordinate-based randomness: independent of chunk load order. */
export function randomAt(seed: number, x: number, z: number, salt = 0): number {
  let value =
    (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
