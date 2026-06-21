'use strict';

/**
 * Small collection of math / geometry helpers shared across the game.
 * Kept dependency-free so every module can rely on it.
 */
const Utils = {
  clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /** Frame-rate independent decay factor: how much of a value survives after dt seconds. */
  damp(retainPerSecond, dt) {
    return Math.pow(retainPerSecond, dt);
  },

  dist(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  },

  dist2(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
  },

  /** Shortest signed difference between two angles, result in (-PI, PI]. */
  angleDelta(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  /** Distance from point P to segment AB, plus the closest point and the projection factor t. */
  pointSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby || 1e-6;
    let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
    t = Utils.clamp(t, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return { dist: Utils.dist(px, py, cx, cy), cx, cy, t };
  },

  randRange(min, max) {
    return min + Math.random() * (max - min);
  },

  formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds * 1000) % 1000);
    return (
      String(m).padStart(2, '0') +
      ':' +
      String(s).padStart(2, '0') +
      '.' +
      String(ms).padStart(3, '0')
    );
  },

  ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
};
