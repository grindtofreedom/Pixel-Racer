'use strict';

/**
 * Draws a small overview of the track plus every car as a coloured dot,
 * scaled to fit a fixed widget size in the top-right corner.
 */
class Minimap {
  constructor(track, size = 190) {
    this.track = track;
    this.size = size;
    this.pad = 16;

    // Fit the track bounds into the widget once up front.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of track.waypoints) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const m = 160; // include road width margin
    this.bounds = { minX: minX - m, minY: minY - m, maxX: maxX + m, maxY: maxY + m };
    const bw = this.bounds.maxX - this.bounds.minX;
    const bh = this.bounds.maxY - this.bounds.minY;
    this.scale = (size - this.pad * 2) / Math.max(bw, bh);
    this.offX = (size - bw * this.scale) / 2;
    this.offY = (size - bh * this.scale) / 2;
  }

  _toMap(x, y) {
    return {
      x: this.offX + (x - this.bounds.minX) * this.scale,
      y: this.offY + (y - this.bounds.minY) * this.scale,
    };
  }

  /**
   * Draw inside a viewport rect, top-right. `focusCar` (optional) is ringed
   * white so each split-screen player can spot their own car.
   */
  render(ctx, rect, cars, focusCar) {
    const x0 = rect.x + rect.w - this.size - 18;
    const y0 = rect.y + 18;

    ctx.save();
    ctx.translate(x0, y0);

    // Panel.
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, this.size, this.size);
    ctx.strokeRect(0, 0, this.size, this.size);

    // Track ribbon.
    ctx.beginPath();
    const first = this._toMap(this.track.wp(0).x, this.track.wp(0).y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i <= this.track.count; i++) {
      const p = this.track.wp(i);
      const m = this._toMap(p.x, p.y);
      ctx.lineTo(m.x, m.y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = Math.max(3, this.track.roadHalf * this.scale);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#2c2c34';
    ctx.lineWidth = Math.max(1, (this.track.roadHalf - 6) * this.scale);
    ctx.stroke();

    // Start line dot.
    const s = this._toMap(this.track.wp(0).x, this.track.wp(0).y);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);

    // Cars.
    for (const car of cars) {
      const m = this._toMap(car.x, car.y);
      const isFocus = car === focusCar;
      ctx.beginPath();
      ctx.arc(m.x, m.y, isFocus ? 4.5 : car.isPlayer ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = car.dotColor || '#ff5555';
      ctx.fill();
      if (isFocus) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
