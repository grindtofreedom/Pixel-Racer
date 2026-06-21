'use strict';

/**
 * On-screen touch controls for mobile (Telegram Mini App).
 * Layout: a LEFT (◀) button in the bottom-left, a RIGHT (▶) button in the
 * bottom-right, and a DRIFT button in the bottom-centre. Throttle is automatic
 * while playing on a touch device. Multi-touch is supported, so you can hold a
 * steer button and DRIFT at the same time.
 *
 * Mouse pointers are ignored so desktop play stays on the keyboard; only
 * coarse-pointer devices (or a real touch) enable this scheme.
 */
class TouchControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.active =
      !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    this.left = false;
    this.right = false;
    this.handbrake = false;

    this._touches = new Map(); // pointerId -> 'left' | 'right' | 'drift' | 'none'
    this._bind();
  }

  /** Button hit-circles, recomputed from the live canvas size. */
  layout() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const r = Utils.clamp(Math.min(W, H) * 0.11, 38, 92);
    const yb = H - r - 24;
    return {
      r,
      left: { x: r + 22, y: yb, r },
      right: { x: W - r - 22, y: yb, r },
      drift: { x: W / 2, y: H - r * 0.78 - 18, r: r * 0.82 },
    };
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _hit(p, b) {
    return Utils.dist(p.x, p.y, b.x, b.y) <= b.r;
  }

  _which(p) {
    const L = this.layout();
    if (this._hit(p, L.drift)) return 'drift';
    if (this._hit(p, L.left)) return 'left';
    if (this._hit(p, L.right)) return 'right';
    return 'none';
  }

  _refresh() {
    const vals = new Set(this._touches.values());
    this.left = vals.has('left');
    this.right = vals.has('right');
    this.handbrake = vals.has('drift');
  }

  _bind() {
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return; // desktop keeps using the keyboard
      this.active = true;
      this._touches.set(e.pointerId, this._which(this._pos(e)));
      this._refresh();
      if (c.setPointerCapture) {
        try { c.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    // Allow a finger to slide between buttons.
    c.addEventListener('pointermove', (e) => {
      if (!this._touches.has(e.pointerId)) return;
      this._touches.set(e.pointerId, this._which(this._pos(e)));
      this._refresh();
    });

    const end = (e) => {
      if (this._touches.delete(e.pointerId)) this._refresh();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  getControls() {
    let steer = 0;
    if (this.left) steer -= 1;
    if (this.right) steer += 1;
    return { throttle: this.active ? 1 : 0, steer, handbrake: this.handbrake };
  }

  // ---- Rendering -------------------------------------------------------

  _button(ctx, b, pressed, accent) {
    ctx.globalAlpha = pressed ? 0.92 : 0.46;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = pressed ? accent : 'rgba(20,24,34,0.6)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _arrow(ctx, cx, cy, size, dir) {
    // dir: -1 = left triangle, +1 = right triangle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (dir < 0) {
      ctx.moveTo(cx - size, cy);
      ctx.lineTo(cx + size * 0.7, cy - size);
      ctx.lineTo(cx + size * 0.7, cy + size);
    } else {
      ctx.moveTo(cx + size, cy);
      ctx.lineTo(cx - size * 0.7, cy - size);
      ctx.lineTo(cx - size * 0.7, cy + size);
    }
    ctx.closePath();
    ctx.fill();
  }

  render(ctx) {
    const L = this.layout();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this._button(ctx, L.left, this.left, '#ffd84a');
    this._arrow(ctx, L.left.x, L.left.y, L.r * 0.38, -1);

    this._button(ctx, L.right, this.right, '#ffd84a');
    this._arrow(ctx, L.right.x, L.right.y, L.r * 0.38, 1);

    this._button(ctx, L.drift, this.handbrake, '#ff5252');
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(L.drift.r * 0.42)}px "Courier New", monospace`;
    ctx.fillText('DRIFT', L.drift.x, L.drift.y);

    ctx.restore();
  }
}
