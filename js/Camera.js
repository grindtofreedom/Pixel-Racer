'use strict';

/**
 * A smoothing camera that follows a target in world space and exposes the
 * visible world rectangle (used for culling and background fill).
 */
class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0; // world coord at the centre of the view
    this.y = 0;
    this.zoom = 1;
  }

  resize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  snapTo(target) {
    this.x = target.x;
    this.y = target.y;
  }

  follow(target, dt) {
    const t = 1 - Utils.damp(0.0025, dt); // smoothing factor
    this.x = Utils.lerp(this.x, target.x, t);
    this.y = Utils.lerp(this.y, target.y, t);
  }

  /** Apply the camera transform to a context (call inside save/restore). */
  apply(ctx) {
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** The visible world rectangle, padded a little for safety. */
  getView() {
    const w = this.viewW / this.zoom;
    const h = this.viewH / this.zoom;
    const pad = 80;
    return {
      x: this.x - w / 2 - pad,
      y: this.y - h / 2 - pad,
      w: w + pad * 2,
      h: h + pad * 2,
    };
  }
}
