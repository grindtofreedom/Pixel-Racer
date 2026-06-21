'use strict';

/**
 * Base car: arcade drift physics + lap/progress tracking + collision body.
 * Subclasses (PlayerCar, AICar) only supply control values each frame via
 * `getControls()`. Movement, traction, walls and ranking live here so all
 * cars behave consistently.
 */
class Car {
  constructor(track, palette, name) {
    this.track = track;
    this.name = name;
    this.sprite = SpriteFactory.createCar(palette);
    this.spriteLen = this.sprite.width;
    this.spriteWid = this.sprite.height;

    // Pose & motion.
    this.x = 0;
    this.y = 0;
    this.angle = 0;       // heading, radians (0 = +x)
    this.vx = 0;          // world-space velocity
    this.vy = 0;
    this.radius = 16;     // collision circle radius

    // Tuning constants (pixels & seconds).
    this.enginePower = 1050;
    this.reversePower = 520;
    this.brakePower = 1600;
    this.maxSpeed = 540;
    this.maxReverse = 170;
    this.turnSpeed = 3.3;       // rad/s at speed
    this.gripNormal = 0.0008;   // lateral velocity retained per second (low => grippy)
    this.gripDrift = 0.45;      // higher => more slide
    this.rollDrag = 0.6;        // forward rolling resistance factor/second
    this.offRoadDrag = 6.5;     // extra drag on grass

    // Derived per-frame state (for FX / audio / AI).
    this.speed = 0;
    this.drifting = false;
    this.driftAmount = 0;
    this.onRoad = true;

    // Race progress.
    this.lap = 0;
    this.nextCheckpoint = 1;     // index of the next waypoint gate to hit
    this.finished = false;
    this.finishTime = 0;
    this.rank = 1;
    this.progress = 0;           // monotonically increasing race progress metric

    this.skidMarks = [];         // recent positions while drifting (for FX)
  }

  placeAt(pose) {
    this.x = pose.x;
    this.y = pose.y;
    this.angle = pose.angle;
    this.vx = 0;
    this.vy = 0;
  }

  /** Overridden by subclasses. Returns {throttle, steer, handbrake}. */
  getControls() {
    return { throttle: 0, steer: 0, handbrake: false };
  }

  update(dt, totalLaps) {
    const ctrl = this.getControls();

    const fwdX = Math.cos(this.angle);
    const fwdY = Math.sin(this.angle);
    const rightX = -fwdY;
    const rightY = fwdX;

    // Decompose velocity into forward / lateral components.
    let vForward = this.vx * fwdX + this.vy * fwdY;
    let vLateral = this.vx * rightX + this.vy * rightY;

    // Engine / brake / reverse.
    if (ctrl.throttle > 0) {
      vForward += this.enginePower * ctrl.throttle * dt;
    } else if (ctrl.throttle < 0) {
      if (vForward > 5) {
        vForward -= this.brakePower * dt;      // braking
      } else {
        vForward += this.reversePower * ctrl.throttle * dt; // reverse
      }
    }

    // Clamp speed.
    vForward = Utils.clamp(vForward, -this.maxReverse, this.maxSpeed);

    // Rolling resistance.
    vForward *= Utils.damp(Math.exp(-this.rollDrag), dt);

    // Off-road penalty.
    this.onRoad = this.track.isOnRoad(this.x, this.y);
    if (!this.onRoad) {
      vForward *= Utils.damp(Math.exp(-this.offRoadDrag), dt);
    }

    // Steering: scales with speed and reverses when going backwards.
    const speedFactor = Utils.clamp(Math.abs(vForward) / 130, 0, 1);
    const dir = vForward >= 0 ? 1 : -1;
    const driftBonus = ctrl.handbrake ? 1.35 : 1;
    this.angle += ctrl.steer * this.turnSpeed * speedFactor * dir * driftBonus * dt;

    // Lateral grip — handbrake (or off-road) reduces grip to allow sliding.
    let grip = ctrl.handbrake ? this.gripDrift : this.gripNormal;
    if (!this.onRoad) grip = Math.max(grip, 0.25);
    vLateral *= Utils.damp(grip, dt);

    // Recompose world velocity.
    const newFwdX = Math.cos(this.angle);
    const newFwdY = Math.sin(this.angle);
    const newRightX = -newFwdY;
    const newRightY = newFwdX;
    this.vx = newFwdX * vForward + newRightX * vLateral;
    this.vy = newFwdY * vForward + newRightY * vLateral;

    // Integrate position.
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Derived state.
    this.speed = Math.hypot(this.vx, this.vy);
    this.driftAmount = Utils.clamp(Math.abs(vLateral) / 160, 0, 1);
    this.drifting = this.driftAmount > 0.25 && this.speed > 80;

    this._handleWalls();
    this._updateProgress(dt, totalLaps);
    this._recordSkid();
  }

  /** Bounce off the solid wall that surrounds the road. */
  _handleWalls() {
    const near = this.track.nearestOnCenterline(this.x, this.y);
    const limit = this.track.wallHalf - this.radius;
    if (near.dist > limit) {
      // Normal pointing from wall back toward the road centre.
      let nx = (near.cx - this.x);
      let ny = (near.cy - this.y);
      const nlen = Math.hypot(nx, ny) || 1;
      nx /= nlen;
      ny /= nlen;

      const push = near.dist - limit;
      this.x += nx * push;
      this.y += ny * push;

      // Reflect velocity along the wall normal and lose energy.
      const vn = this.vx * nx + this.vy * ny;
      if (vn < 0) {
        this.vx -= 1.6 * vn * nx;
        this.vy -= 1.6 * vn * ny;
        this.vx *= 0.45;
        this.vy *= 0.45;
        this._hitWall = Math.hypot(this.vx, this.vy) > 60;
      }
    }
  }

  _updateProgress(dt, totalLaps) {
    if (this.finished) return;
    const target = this.track.wp(this.nextCheckpoint);
    const d = Utils.dist(this.x, this.y, target.x, target.y);
    const gate = 170;
    if (d < gate) {
      this.nextCheckpoint++;
      if (this.nextCheckpoint > this.track.count) {
        this.nextCheckpoint = 1;
        this.lap++;
        this.justLapped = true;
        if (this.lap >= totalLaps) {
          this.finished = true;
        }
      }
    }

    // Progress metric for ranking: laps, then checkpoints, then closeness.
    const distToNext = Utils.dist(this.x, this.y, target.x, target.y);
    this.progress =
      this.lap * 100000 + this.nextCheckpoint * 1000 - distToNext;
  }

  _recordSkid() {
    if (this.drifting && this.onRoad) {
      this.skidMarks.push({ x: this.x, y: this.y, a: this.angle, life: 1 });
    }
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].life -= 0.012;
      if (this.skidMarks[i].life <= 0) this.skidMarks.splice(i, 1);
    }
    if (this.skidMarks.length > 220) this.skidMarks.splice(0, this.skidMarks.length - 220);
  }

  // ---- Rendering -------------------------------------------------------

  renderSkid(ctx) {
    for (const s of this.skidMarks) {
      ctx.save();
      ctx.globalAlpha = s.life * 0.35;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillStyle = '#101012';
      ctx.fillRect(-6, -7, 4, 4);
      ctx.fillRect(-6, 3, 4, 4);
      ctx.restore();
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Soft shadow.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(2, 4, this.spriteLen / 2, this.spriteWid / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.rotate(this.angle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sprite, -this.spriteLen / 2, -this.spriteWid / 2);
    ctx.restore();
  }
}
