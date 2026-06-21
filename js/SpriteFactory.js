'use strict';

/**
 * Procedurally draws all sprites onto small offscreen canvases at runtime.
 * Nothing is loaded from disk. Cars are drawn nose-pointing-right (+x) so a
 * car with heading angle 0 renders facing right with no extra offset.
 */
class SpriteFactory {
  /**
   * Build a top-down car sprite.
   * @param {object} palette {body, dark, light, glass}
   * @param {number} len  car length in px (along x)
   * @param {number} wid  car width in px (along y)
   */
  static createCar(palette, len = 30, wid = 18) {
    const c = document.createElement('canvas');
    c.width = len;
    c.height = wid;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const { body, dark, light, glass } = palette;

    // Tyres (drawn first so the body overlaps them slightly).
    g.fillStyle = '#0a0a0a';
    g.fillRect(4, 0, 5, 3);
    g.fillRect(4, wid - 3, 5, 3);
    g.fillRect(len - 9, 0, 5, 3);
    g.fillRect(len - 9, wid - 3, 5, 3);

    // Body base with a rounded-ish silhouette.
    g.fillStyle = body;
    g.fillRect(2, 3, len - 4, wid - 6);
    g.fillRect(4, 2, len - 8, wid - 4);
    g.fillRect(1, 5, len - 2, wid - 10);

    // Outline / shading.
    g.fillStyle = dark;
    g.fillRect(2, 3, len - 4, 1);
    g.fillRect(2, wid - 4, len - 4, 1);
    g.fillRect(len - 4, 3, 2, wid - 6); // rear bumper

    // Nose highlight.
    g.fillStyle = light;
    g.fillRect(len - 6, 5, 3, wid - 10);

    // Windshield + cockpit glass.
    g.fillStyle = glass;
    g.fillRect(len - 13, 4, 4, wid - 8);
    g.fillStyle = dark;
    g.fillRect(len - 14, 4, 1, wid - 8);

    // Racing stripe down the centre.
    g.fillStyle = light;
    g.fillRect(6, Math.floor(wid / 2) - 1, len - 18, 2);

    // Headlights.
    g.fillStyle = '#fff6c0';
    g.fillRect(len - 2, 5, 1, 2);
    g.fillRect(len - 2, wid - 7, 1, 2);

    return c;
  }

  /** A repeating grass/dirt tile to texture the off-track world. */
  static createGrassTile(size = 64) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#2f7d32';
    g.fillRect(0, 0, size, size);
    const shades = ['#2a7330', '#357f3a', '#26692c', '#3a8a40'];
    for (let i = 0; i < size * 3; i++) {
      g.fillStyle = shades[(Math.random() * shades.length) | 0];
      const x = (Math.random() * size) | 0;
      const y = (Math.random() * size) | 0;
      g.fillRect(x, y, 2, 2);
    }
    return c;
  }

  /** Asphalt tile for the road surface. */
  static createRoadTile(size = 64) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3a42';
    g.fillRect(0, 0, size, size);
    const shades = ['#36363d', '#3f3f47', '#333339', '#42424a'];
    for (let i = 0; i < size * 2; i++) {
      g.fillStyle = shades[(Math.random() * shades.length) | 0];
      const x = (Math.random() * size) | 0;
      const y = (Math.random() * size) | 0;
      g.fillRect(x, y, 2, 2);
    }
    return c;
  }
}
