'use strict';

/**
 * The race circuit. The track is a closed loop defined by a centreline of
 * waypoints. The road is rendered as a thick stroked path; off-road and wall
 * tests are derived from the distance to the nearest centreline segment.
 * Waypoints double as ordered checkpoints for the lap system.
 */
class Track {
  constructor() {
    // Hand-authored closed circuit (world coordinates, in pixels).
    this.waypoints = [
      { x: 600, y: 1750 },
      { x: 600, y: 700 },
      { x: 900, y: 420 },
      { x: 1450, y: 520 },
      { x: 1650, y: 950 },
      { x: 1950, y: 480 },
      { x: 2550, y: 560 },
      { x: 2750, y: 1150 },
      { x: 2450, y: 1550 },
      { x: 2700, y: 1950 },
      { x: 1950, y: 2150 },
      { x: 1350, y: 1950 },
      { x: 1150, y: 1500 },
      { x: 800, y: 1950 },
    ];

    this.roadHalf = 110;   // half road width (drivable)
    this.wallHalf = 150;   // beyond this is a solid wall that bounces cars
    this.worldW = 3300;
    this.worldH = 2500;

    this.roadTile = SpriteFactory.createRoadTile(64);
    this.grassTile = SpriteFactory.createGrassTile(64);
    this._roadPattern = null;
    this._grassPattern = null;

    // Start/finish line sits on the segment between waypoint 0 and 1.
    this.startIndex = 0;
  }

  get count() {
    return this.waypoints.length;
  }

  wp(i) {
    const n = this.waypoints.length;
    return this.waypoints[((i % n) + n) % n];
  }

  /**
   * Closest point on the whole centreline to (x,y).
   * Returns { dist, cx, cy, segIndex }.
   */
  nearestOnCenterline(x, y) {
    let best = { dist: Infinity, cx: x, cy: y, segIndex: 0 };
    const n = this.waypoints.length;
    for (let i = 0; i < n; i++) {
      const a = this.wp(i);
      const b = this.wp(i + 1);
      const r = Utils.pointSegment(x, y, a.x, a.y, b.x, b.y);
      if (r.dist < best.dist) {
        best = { dist: r.dist, cx: r.cx, cy: r.cy, segIndex: i };
      }
    }
    return best;
  }

  isOnRoad(x, y) {
    return this.nearestOnCenterline(x, y).dist <= this.roadHalf;
  }

  /** Spawn pose for grid slot `index` (staggered behind the start line). */
  getStartPose(index) {
    const a = this.wp(this.startIndex);
    const b = this.wp(this.startIndex + 1);
    const dirX = b.x - a.x;
    const dirY = b.y - a.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const fx = dirX / len;
    const fy = dirY / len;
    const px = -fy; // perpendicular (right of forward)
    const py = fx;

    const row = Math.floor(index / 2);
    const col = index % 2 === 0 ? -1 : 1;
    const back = 70 + row * 80;
    const side = col * 45;

    return {
      x: a.x + fx * (90 + back * 0) - fx * back + px * side,
      y: a.y + fy * (90) - fy * back + py * side,
      angle: Math.atan2(fy, fx),
    };
  }

  // ---- Rendering -------------------------------------------------------

  _ensurePatterns(ctx) {
    if (!this._roadPattern) this._roadPattern = ctx.createPattern(this.roadTile, 'repeat');
    if (!this._grassPattern) this._grassPattern = ctx.createPattern(this.grassTile, 'repeat');
  }

  _strokePath(ctx, width) {
    ctx.beginPath();
    const first = this.wp(0);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i <= this.waypoints.length; i++) {
      const p = this.wp(i);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /** Draw the world (grass background + road). `view` is the visible world rect. */
  render(ctx, view) {
    this._ensurePatterns(ctx);

    // Grass background filling the visible area.
    ctx.fillStyle = this._grassPattern;
    ctx.fillRect(view.x, view.y, view.w, view.h);

    // Wall border (dark) — slightly wider than road.
    ctx.strokeStyle = '#1d1d22';
    this._strokePath(ctx, this.wallHalf * 2);

    // Road surface.
    ctx.strokeStyle = this._roadPattern;
    this._strokePath(ctx, this.roadHalf * 2);

    // Painted edge lines.
    ctx.strokeStyle = '#d8d8e0';
    this._strokePath(ctx, this.roadHalf * 2);
    ctx.strokeStyle = this._roadPattern;
    this._strokePath(ctx, this.roadHalf * 2 - 8);

    // Dashed centre line.
    ctx.save();
    ctx.setLineDash([26, 30]);
    ctx.strokeStyle = 'rgba(240,220,90,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const first = this.wp(0);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i <= this.waypoints.length; i++) {
      const p = this.wp(i);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    this._renderStartLine(ctx);
  }

  _renderStartLine(ctx) {
    const a = this.wp(this.startIndex);
    const b = this.wp(this.startIndex + 1);
    const dirX = b.x - a.x;
    const dirY = b.y - a.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const fx = dirX / len;
    const fy = dirY / len;
    const px = -fy;
    const py = fx;

    const cx = a.x + fx * 90;
    const cy = a.y + fy * 90;
    const half = this.roadHalf;
    const tiles = 8;
    const tw = (half * 2) / tiles;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(fy, fx));
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < tiles; i++) {
        ctx.fillStyle = (i + row) % 2 === 0 ? '#f4f4f4' : '#202020';
        ctx.fillRect(row * 14 - 14, -half + i * tw, 14, tw);
      }
    }
    ctx.restore();
  }
}
