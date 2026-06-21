'use strict';

/**
 * Keyboard input manager. Tracks raw key state and exposes a normalized
 * control surface (throttle / steer / handbrake) so cars stay decoupled
 * from the physical keys.
 */
class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.onFirstInput = null; // hook used to unlock audio on first interaction
    this._unlocked = false;

    window.addEventListener('keydown', (e) => {
      if (this._isGameKey(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (!this._unlocked) {
        this._unlocked = true;
        if (this.onFirstInput) this.onFirstInput();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Avoid keys getting "stuck" when the tab loses focus.
    window.addEventListener('blur', () => this.keys.clear());
  }

  _isGameKey(code) {
    return [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter',
      'ShiftLeft', 'ShiftRight',
    ].includes(code);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** True only on the frame the key transitions from up to down. */
  wasPressed(code) {
    return this.justPressed.has(code);
  }

  /**
   * Control values for a given scheme:
   *  - 'single' : WASD + Arrows together, handbrake = Space  (solo play)
   *  - 'p1'     : WASD, handbrake = Left Shift               (2P, left/top)
   *  - 'p2'     : Arrow keys, handbrake = Right Shift        (2P, right/bottom)
   */
  getControls(scheme = 'single') {
    let throttle = 0;
    let steer = 0;
    let handbrake = false;

    if (scheme === 'p1') {
      if (this.isDown('KeyW')) throttle += 1;
      if (this.isDown('KeyS')) throttle -= 1;
      if (this.isDown('KeyA')) steer -= 1;
      if (this.isDown('KeyD')) steer += 1;
      handbrake = this.isDown('ShiftLeft');
    } else if (scheme === 'p2') {
      if (this.isDown('ArrowUp')) throttle += 1;
      if (this.isDown('ArrowDown')) throttle -= 1;
      if (this.isDown('ArrowLeft')) steer -= 1;
      if (this.isDown('ArrowRight')) steer += 1;
      handbrake = this.isDown('ShiftRight');
    } else {
      if (this.isDown('ArrowUp') || this.isDown('KeyW')) throttle += 1;
      if (this.isDown('ArrowDown') || this.isDown('KeyS')) throttle -= 1;
      if (this.isDown('ArrowLeft') || this.isDown('KeyA')) steer -= 1;
      if (this.isDown('ArrowRight') || this.isDown('KeyD')) steer += 1;
      handbrake = this.isDown('Space');
    }

    return { throttle, steer, handbrake };
  }

  /** Must be called once per frame, after all systems have read input. */
  endFrame() {
    this.justPressed.clear();
  }
}
