'use strict';

/**
 * Screen-space HUD: lap counter, race timer, live position and a speedometer,
 * plus the big centred countdown / "GO!" text. Drawn after the world, in
 * screen coordinates (no camera transform).
 */
class HUD {
  constructor() {
    this.font = '"Courier New", monospace';
  }

  _panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Draw the HUD inside a viewport rect {x,y,w,h}. `compact` shrinks panels
   * for split-screen. An optional `label` (e.g. "P1") tags the viewport.
   */
  render(ctx, state, rect, compact = false, label = null, touchMode = false) {
    const { lap, totalLaps, time, position, totalCars, speed, maxSpeed } = state;
    const s = compact ? 0.74 : 1;
    const pad = 16;
    const L = rect.x + pad;
    const T = rect.y + pad;

    ctx.save();
    ctx.textBaseline = 'top';

    // Touch layout: a single compact strip across the top so the bottom corners
    // remain free for the on-screen steering buttons.
    if (touchMode) {
      this._renderTouchHud(ctx, state, rect, pad);
      ctx.restore();
      return;
    }

    // Lap + timer panel (top-left of the viewport).
    const pw = 230 * s, ph = 96 * s;
    this._panel(ctx, L, T, pw, ph);
    ctx.fillStyle = '#ffd84a';
    ctx.font = `bold ${Math.round(30 * s)}px ${this.font}`;
    ctx.fillText(`LAP ${Math.min(lap + 1, totalLaps)}/${totalLaps}`, L + 16, T + 12 * s);
    ctx.fillStyle = '#e8e8f0';
    ctx.font = `bold ${Math.round(26 * s)}px ${this.font}`;
    ctx.fillText(Utils.formatTime(time), L + 16, T + 52 * s);

    if (label) {
      ctx.fillStyle = '#7fd4ff';
      ctx.font = `bold ${Math.round(20 * s)}px ${this.font}`;
      ctx.textAlign = 'right';
      ctx.fillText(label, rect.x + rect.w - pad, T + 4);
      ctx.textAlign = 'left';
    }

    // Position panel (bottom-left of the viewport).
    const posW = 200 * s, posH = 100 * s;
    const py = rect.y + rect.h - posH - pad;
    this._panel(ctx, L, py, posW, posH);
    ctx.fillStyle = '#7fd4ff';
    ctx.font = `bold ${Math.round(20 * s)}px ${this.font}`;
    ctx.fillText('POSITION', L + 16, py + 12 * s);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(44 * s)}px ${this.font}`;
    ctx.fillText(`${position}/${totalCars}`, L + 16, py + 38 * s);

    // Speedometer (bottom-right of the viewport).
    this._renderSpeedo(ctx, speed, maxSpeed, rect, s);

    ctx.restore();
  }

  /**
   * Compact horizontal HUD for touch play: LAP, time, position and speed laid
   * out in one panel along the top-left, leaving the whole bottom of the screen
   * (and the top-right minimap) untouched.
   */
  _renderTouchHud(ctx, state, rect, pad) {
    const { lap, totalLaps, time, position, totalCars, speed, maxSpeed } = state;
    const L = rect.x + pad;
    const T = rect.y + pad;
    const w = 196, h = 116;
    this._panel(ctx, L, T, w, h);

    ctx.fillStyle = '#ffd84a';
    ctx.font = `bold 26px ${this.font}`;
    ctx.fillText(`LAP ${Math.min(lap + 1, totalLaps)}/${totalLaps}`, L + 14, T + 10);

    ctx.fillStyle = '#e8e8f0';
    ctx.font = `bold 24px ${this.font}`;
    ctx.fillText(Utils.formatTime(time), L + 14, T + 42);

    ctx.fillStyle = '#7fd4ff';
    ctx.font = `bold 16px ${this.font}`;
    ctx.fillText('POS', L + 14, T + 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${this.font}`;
    ctx.fillText(`${position}/${totalCars}`, L + 58, T + 76);

    const kmh = Math.round((speed / maxSpeed) * 240);
    ctx.fillStyle = '#9aa';
    ctx.font = `bold 16px ${this.font}`;
    ctx.fillText('km/h', L + w - 70, T + 80);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 24px ${this.font}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, L + w - 72, T + 76);
    ctx.textAlign = 'left';
  }

  _renderSpeedo(ctx, speed, maxSpeed, rect, s = 1) {
    const w = 200 * s, h = 70 * s;
    const x = rect.x + rect.w - w - 16;
    const y = rect.y + rect.h - h - 16;
    this._panel(ctx, x, y, w, h);

    ctx.fillStyle = '#9aa';
    ctx.font = `bold ${Math.round(14 * s)}px ${this.font}`;
    ctx.fillText('SPEED', x + 14, y + 8 * s);

    const kmh = Math.round((speed / maxSpeed) * 240);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(28 * s)}px ${this.font}`;
    ctx.fillText(`${kmh}`, x + 14, y + 26 * s);
    ctx.fillStyle = '#9aa';
    ctx.font = `bold ${Math.round(14 * s)}px ${this.font}`;
    ctx.fillText('km/h', x + 56 * s, y + 38 * s);

    // Bar.
    const bx = x + 108 * s, bw = 72 * s, bh = 12 * s, by = y + 34 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by, bw, bh);
    const frac = Utils.clamp(speed / maxSpeed, 0, 1);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#3fd56b');
    grad.addColorStop(0.6, '#ffd84a');
    grad.addColorStop(1, '#ff5252');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw * frac, bh);
  }

  /** Big centred countdown text. `value` is 3,2,1 or the string 'GO!'. */
  renderCountdown(ctx, value, scale) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = ctx.canvas.width / 2;
    const cy = ctx.canvas.height / 2 - 40;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.font = `bold 140px ${this.font}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = value === 'GO!' ? '#3fd56b' : '#ffd84a';
    ctx.strokeText(value, 0, 0);
    ctx.fillText(value, 0, 0);
    ctx.restore();
  }

  renderBanner(ctx, text) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold 38px ${this.font}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, ctx.canvas.height / 2 - 130, ctx.canvas.width, 70);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2 - 82);
    ctx.restore();
  }
}
