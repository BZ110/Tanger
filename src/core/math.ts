export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
export function approach(
  value: number,
  target: number,
  maxDelta: number,
): number {
  return value + clamp(target - value, -maxDelta, maxDelta);
}
export function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
