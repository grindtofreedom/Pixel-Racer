'use strict';

/** The human-controlled car: reads live controls from the Input manager. */
class PlayerCar extends Car {
  constructor(track, palette, name, input, scheme = 'single') {
    super(track, palette, name);
    this.input = input;
    this.scheme = scheme; // 'single' | 'p1' | 'p2'
    this.touch = null;     // optional TouchControls (solo mobile only)
    this.isPlayer = true;
    this.controlsEnabled = false; // toggled on after the countdown
  }

  getControls() {
    if (!this.controlsEnabled || this.finished) {
      return { throttle: 0, steer: 0, handbrake: false };
    }

    const kb = this.input.getControls(this.scheme);

    // Merge touch input (solo): keyboard wins when a key is actually pressed,
    // otherwise the on-screen swipe wheel / DRIFT button drives the car.
    if (this.scheme === 'single' && this.touch && this.touch.active) {
      const t = this.touch.getControls();
      return {
        throttle: kb.throttle !== 0 ? kb.throttle : t.throttle,
        steer: kb.steer !== 0 ? kb.steer : t.steer,
        handbrake: kb.handbrake || t.handbrake,
      };
    }
    return kb;
  }
}
