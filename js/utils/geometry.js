/**
 * geometry.js - snap, distance, hit tests (scaffold)
 */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function snap(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}
