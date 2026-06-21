'use strict';

/**
 * AI opponent: steers toward a look-ahead point on the centreline, eases the
 * throttle through sharp corners, and taps the handbrake on hairpins so it
 * drifts a little like the player. Each opponent gets slight skill jitter so
 * the field spreads out instead of moving as one block.
 */
class AICar extends Car {
  constructor(track, palette, name, skill = 1) {
    super(track, palette, name);
    this.isPlayer = false;
    this.controlsEnabled = false;

    // Skill 0..1 nudges top speed and cornering confidence.
    this.skill = skill;
    this.maxSpeed *= 0.9 + skill * 0.16;
    this.turnSpeed *= 0.96 + skill * 0.08;
    this.aimJitter = Utils.randRange(-30, 30); // small line variation
    this._stuckTimer = 0;
  }

  getControls() {
    if (!this.controlsEnabled || this.finished) {
      return { throttle: 0, steer: 0, handbrake: false };
    }

    const track = this.track;

    // Aim at a point a little beyond the next checkpoint for a smooth line.
    const aimWp = track.wp(this.nextCheckpoint);
    const afterWp = track.wp(this.nextCheckpoint + 1);

    // Bias the aim toward the inside using a perpendicular offset.
    const segdx = afterWp.x - aimWp.x;
    const segdy = afterWp.y - aimWp.y;
    const slen = Math.hypot(segdx, segdy) || 1;
    const perpX = -segdy / slen;
    const perpY = segdx / slen;
    const targetX = aimWp.x + perpX * this.aimJitter;
    const targetY = aimWp.y + perpY * this.aimJitter;

    // Desired heading vs current heading.
    const desired = Math.atan2(targetY - this.y, targetX - this.x);
    const delta = Utils.angleDelta(this.angle, desired);

    let steer = Utils.clamp(delta * 2.4, -1, 1);

    // Throttle eases off when a hard turn is required or off-road.
    const turnSharpness = Math.min(Math.abs(delta), 1.4) / 1.4;
    let throttle = 1 - turnSharpness * 0.55;
    if (!this.onRoad) throttle *= 0.6;
    throttle = Utils.clamp(throttle, 0.35, 1);

    // Drift through the sharpest corners when carrying speed.
    const handbrake = Math.abs(delta) > 0.9 && this.speed > 260;

    // Anti-stuck: if barely moving for a while, reverse and re-orient.
    if (this.speed < 30) {
      this._stuckTimer += 1 / 60;
    } else {
      this._stuckTimer = 0;
    }
    if (this._stuckTimer > 1.2) {
      return { throttle: -1, steer: -steer, handbrake: false };
    }

    return { throttle, steer, handbrake };
  }
}
