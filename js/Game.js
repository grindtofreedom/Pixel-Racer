'use strict';

/**
 * Top-level game controller: owns the world, the fixed-step update loop, the
 * race state machine (menu -> countdown -> racing -> finished), collision
 * resolution, position ranking and all rendering orchestration.
 */
class Game {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom; // { menu, finish, results, startBtn, restartBtn, title }

    this.totalLaps = 3;
    this.state = 'menu';
    this.mode = 1; // 1 = solo, 2 = split-screen co-op

    this.input = new Input();
    this.audio = new AudioManager();
    this.input.onFirstInput = () => this.audio.unlock();

    this.touch = new TouchControls(canvas);        // mobile swipe steering
    this.telegram = new TelegramBridge();           // Telegram Mini App SDK
    this._lastResult = null;

    this.track = new Track();
    this.camera1 = new Camera(canvas.width, canvas.height); // player 1 view
    this.camera2 = new Camera(canvas.width, canvas.height); // player 2 view
    this.hud = new HUD();
    this.minimap = new Minimap(this.track, 190);

    this.cars = [];
    this.humans = [];
    this.player = null;   // player 1 (drives audio + solo camera)
    this.player2 = null;  // player 2 (only in 2P mode)

    this.raceTime = 0;
    this.countdownTime = 0;
    this._lastCountInt = 99;

    this._buildField(this.mode);
    this.camera1.snapTo(this.player);
    this.camera2.snapTo(this.player);

    // Fixed-step accumulator for stable physics.
    this._acc = 0;
    this._step = 1 / 120;
    this._last = performance.now();

    this._bindUI();
  }

  // ---- Setup -----------------------------------------------------------

  _buildField(mode) {
    const palettes = [
      { body: '#e63946', dark: '#7a1a22', light: '#ff8a93', glass: '#1b2b3a', dot: '#ff5d6c' },
      { body: '#4cc9f0', dark: '#1d6c87', light: '#b3ecff', glass: '#0e2630', dot: '#5fd2f5' },
      { body: '#e9c46a', dark: '#937527', light: '#fff0bf', glass: '#2a2410', dot: '#ffd96b' },
      { body: '#8e7dff', dark: '#3f3399', light: '#c9c0ff', glass: '#181433', dot: '#a99bff' },
      { body: '#f4a261', dark: '#9c5a25', light: '#ffd2a8', glass: '#2a1a0e', dot: '#ffb074' },
      { body: '#2a9d8f', dark: '#155249', light: '#7ee8db', glass: '#10242a', dot: '#46d6c5' },
    ];
    const aiNames = ['BLITZ', 'NOVA', 'VIPER', 'ECHO', 'RUSH'];

    this.cars = [];
    this.humans = [];

    // Player 1 (always present).
    this.player = new PlayerCar(
      this.track, palettes[0], 'P1', this.input, mode === 2 ? 'p1' : 'single'
    );
    this.player.dotColor = palettes[0].dot;
    this.player.touch = mode === 1 ? this.touch : null; // swipe steering = solo only
    this.cars.push(this.player);
    this.humans.push(this.player);

    let nextPal = 1;

    // Player 2 (split-screen only).
    if (mode === 2) {
      this.player2 = new PlayerCar(this.track, palettes[1], 'P2', this.input, 'p2');
      this.player2.dotColor = palettes[1].dot;
      this.cars.push(this.player2);
      this.humans.push(this.player2);
      nextPal = 2;
    } else {
      this.player2 = null;
    }

    // Fill the rest of the 6-car grid with AI.
    const aiCount = 6 - this.cars.length;
    for (let i = 0; i < aiCount; i++) {
      const pal = palettes[nextPal + i];
      const skill = Utils.clamp(0.55 + i * 0.08 + Utils.randRange(-0.05, 0.05), 0, 1);
      const ai = new AICar(this.track, pal, aiNames[i], skill);
      ai.dotColor = pal.dot;
      this.cars.push(ai);
    }

    this.minimap = new Minimap(this.track, mode === 2 ? 140 : 190);
    this._resetPositions();
  }

  _resetPositions() {
    this.cars.forEach((car, i) => {
      car.placeAt(this.track.getStartPose(i));
      car.lap = 0;
      car.nextCheckpoint = 1;
      car.finished = false;
      car.finishTime = 0;
      car._finishRecorded = false;
      car.progress = 0;
      car.skidMarks.length = 0;
      car.controlsEnabled = false;
    });
  }

  _bindUI() {
    this.dom.onePlayerBtn.addEventListener('click', () => this._startGame(1));
    this.dom.twoPlayerBtn.addEventListener('click', () => this._startGame(2));
    this.dom.restartBtn.addEventListener('click', () => this._restart());
    this.dom.menuBtn.addEventListener('click', () => this._toMenu());
    if (this.dom.tgSendBtn) {
      this.dom.tgSendBtn.addEventListener('click', () => {
        if (this._lastResult && this.telegram.reportResult(this._lastResult)) {
          this.dom.tgSendBtn.textContent = 'ОТПРАВЛЕНО ✓';
          this.dom.tgSendBtn.disabled = true;
        }
      });
    }
    // Keyboard shortcuts: Enter starts solo / restarts; "2" starts co-op.
    window.addEventListener('keydown', (e) => {
      if (this.state === 'menu') {
        if (e.code === 'Enter' || e.code === 'Digit1') this._startGame(1);
        else if (e.code === 'Digit2') this._startGame(2);
      } else if (this.state === 'finished') {
        if (e.code === 'Enter') this._restart();
      }
    });
  }

  // ---- State transitions ----------------------------------------------

  /** Build the requested field, then drop into the countdown. */
  _startGame(mode) {
    this.mode = mode;
    this._buildField(mode);
    this.camera1.snapTo(this.player);
    this.camera2.snapTo(this.player2 || this.player);
    this._startCountdown();
  }

  _startCountdown() {
    this.audio.unlock();
    this.dom.menu.classList.add('hidden');
    this.dom.finish.classList.add('hidden');
    this._resetPositions();
    this.raceTime = 0;
    this.countdownTime = 0;
    this._lastCountInt = 99;
    this.state = 'countdown';
    this.camera1.snapTo(this.player);
    this.camera2.snapTo(this.player2 || this.player);
  }

  _toMenu() {
    this.state = 'menu';
    this.dom.finish.classList.add('hidden');
    this.dom.menu.classList.remove('hidden');
  }

  _updateCameras(dt) {
    this.camera1.follow(this.player, dt);
    if (this.mode === 2 && this.player2) this.camera2.follow(this.player2, dt);
  }

  _beginRace() {
    this.state = 'racing';
    this.cars.forEach((c) => (c.controlsEnabled = true));
  }

  _finishRace() {
    this.state = 'finished';
    this._showResults();
  }

  _restart() {
    this.dom.finish.classList.add('hidden');
    this._startCountdown();
  }

  // ---- Main loop -------------------------------------------------------

  start() {
    const loop = (now) => {
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.1) dt = 0.1; // avoid huge steps after a tab switch
      this._update(dt);
      this._render();
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _update(dt) {
    if (this.state === 'countdown') {
      this.countdownTime += dt;
      const remaining = 3 - this.countdownTime;
      const intVal = Math.ceil(remaining);
      if (intVal !== this._lastCountInt && intVal >= 1 && intVal <= 3) {
        this.audio.countdownTick();
        this._lastCountInt = intVal;
      }
      if (this.countdownTime >= 3 && this._lastCountInt !== 0) {
        this._lastCountInt = 0;
        this.audio.countdownGo();
        this._beginRace();
      }
      // Cars idle during countdown; still follow camera smoothly.
      this._updateCameras(dt);
      return;
    }

    if (this.state === 'racing') {
      this.raceTime += dt;
      this._fixedUpdate(dt);
      this._resolveCarCollisions();
      this._rank();
      this._updateCameras(dt);

      // Engine audio tracks the player.
      this.audio.updateEngine(
        Utils.clamp(this.player.speed / this.player.maxSpeed, 0, 1),
        this.player.driftAmount
      );

      // Lap / crash sound hooks.
      this.cars.forEach((c) => {
        if (c.justLapped) {
          if (c.isPlayer) this.audio.lap();
          c.justLapped = false;
        }
        if (c._hitWall) {
          if (c.isPlayer) this.audio.crash();
          c._hitWall = false;
        }
      });

      // Record finish times the instant any car completes its laps.
      for (const c of this.cars) {
        if (c.finished && !c._finishRecorded) {
          c._finishRecorded = true;
          c.finishTime = this.raceTime;
        }
      }

      // The race ends once every human player has finished.
      if (this.humans.every((h) => h.finished)) {
        this._finishRace();
      }
      return;
    }

    if (this.state === 'finished') {
      // Let the AI keep rolling for ambience, but freeze ranking/time.
      this._fixedUpdate(dt);
      this._resolveCarCollisions();
      this._updateCameras(dt);
      this.audio.updateEngine(0.1, 0);
    }
  }

  _fixedUpdate(dt) {
    this._acc += dt;
    let guard = 0;
    while (this._acc >= this._step && guard < 8) {
      for (const car of this.cars) car.update(this._step, this.totalLaps);
      this._acc -= this._step;
      guard++;
    }
  }

  /** Circle-vs-circle separation + velocity exchange for car contact. */
  _resolveCarCollisions() {
    const n = this.cars.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const minDist = a.radius + b.radius;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d === 0) { d = 0.01; dx = 0.01; }
        if (d < minDist) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = minDist - d;

          // Separate.
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Exchange momentum along the normal.
          const avn = a.vx * nx + a.vy * ny;
          const bvn = b.vx * nx + b.vy * ny;
          const transfer = (bvn - avn) * 0.6;
          a.vx += nx * transfer;
          a.vy += ny * transfer;
          b.vx -= nx * transfer;
          b.vy -= ny * transfer;

          if (Math.abs(avn - bvn) > 140) {
            if (a.isPlayer || b.isPlayer) this.audio.crash();
          }
        }
      }
    }
  }

  /** Sort by race progress and assign ranks. */
  _rank() {
    const sorted = [...this.cars].sort((a, b) => {
      // Finished cars rank by finish time first.
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((car, i) => (car.rank = i + 1));
    this._standings = sorted;
  }

  _showResults() {
    this._rank();
    const rows = this._standings
      .map((car, i) => {
        const place = Utils.ordinal(i + 1);
        const you = car.isPlayer ? ' player' : '';
        const time = car.isPlayer
          ? Utils.formatTime(car.finishTime || this.raceTime)
          : '';
        return `<div class="result-row${you}">
          <span class="rp">${place}</span>
          <span class="rn">${car.name}</span>
          <span class="rt">${time}</span>
        </div>`;
      })
      .join('');

    if (this.mode === 2) {
      const winner = this.player.rank < this.player2.rank ? this.player : this.player2;
      const wPlace = this._standings.indexOf(winner) + 1;
      this.dom.title.textContent = `${winner.name} WINS! (${Utils.ordinal(wPlace)})`;
    } else {
      const placed = this._standings.findIndex((c) => c.isPlayer) + 1;
      this.dom.title.textContent =
        placed === 1 ? 'YOU WIN!' : `YOU FINISHED ${Utils.ordinal(placed)}`;
    }
    this.dom.results.innerHTML = rows;

    // Telegram: offer to send the player's result back to the bot.
    if (this.dom.tgSendBtn) {
      if (this.telegram.inTelegram) {
        const placed = this.player.rank;
        this._lastResult = {
          placed,
          place: Utils.ordinal(placed),
          time: Utils.formatTime(this.player.finishTime || this.raceTime),
          mode: this.mode,
          laps: this.totalLaps,
        };
        this.dom.tgSendBtn.classList.remove('hidden');
        this.dom.tgSendBtn.disabled = false;
        this.dom.tgSendBtn.textContent = 'ОТПРАВИТЬ РЕЗУЛЬТАТ';
      } else {
        this.dom.tgSendBtn.classList.add('hidden');
      }
    }

    this.dom.finish.classList.remove('hidden');
    this.audio.finish();
  }

  // ---- Rendering -------------------------------------------------------

  /** Visible viewports for the current mode (full screen, or top/bottom). */
  _viewports() {
    const W = this.canvas.width, H = this.canvas.height;
    if (this.mode === 2) {
      const top = Math.floor(H / 2);
      return [
        { rect: { x: 0, y: 0, w: W, h: top }, camera: this.camera1, car: this.player, label: 'P1' },
        { rect: { x: 0, y: top, w: W, h: H - top }, camera: this.camera2, car: this.player2, label: 'P2' },
      ];
    }
    return [{ rect: { x: 0, y: 0, w: W, h: H }, camera: this.camera1, car: this.player, label: null }];
  }

  /** Draw the world for one viewport, clipped and transformed by its camera. */
  _renderScene(camera, rect) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    ctx.fillStyle = '#1a3a1c';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    camera.viewW = rect.w;
    camera.viewH = rect.h;

    ctx.translate(rect.x, rect.y);
    camera.apply(ctx);

    const view = camera.getView();
    this.track.render(ctx, view);
    for (const car of this.cars) car.renderSkid(ctx);
    const drawOrder = [...this.cars].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const car of drawOrder) car.render(ctx);

    ctx.restore();
  }

  _render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const vps = this._viewports();
    const compact = this.mode === 2;
    // When on-screen buttons are showing, consolidate the HUD at the top so the
    // bottom corners stay clear for the ◀ / ▶ / DRIFT controls.
    const touchMode = this.mode === 1 && this.touch.active;

    for (const vp of vps) {
      this._renderScene(vp.camera, vp.rect);

      if (this.state === 'racing' || this.state === 'finished') {
        const car = vp.car;
        this.hud.render(ctx, {
          lap: car.lap,
          totalLaps: this.totalLaps,
          time: this.raceTime,
          position: car.rank,
          totalCars: this.cars.length,
          speed: car.speed,
          maxSpeed: car.maxSpeed,
        }, vp.rect, compact, vp.label, touchMode);
      }

      this.minimap.render(ctx, vp.rect, this.cars, vp.car);
    }

    // On-screen steering buttons (solo + touch device).
    if (
      this.mode === 1 &&
      this.touch.active &&
      (this.state === 'racing' || this.state === 'countdown')
    ) {
      this.touch.render(ctx);
    }

    // Split-screen divider.
    if (this.mode === 2) {
      const y = Math.floor(this.canvas.height / 2);
      ctx.fillStyle = '#0c0e14';
      ctx.fillRect(0, y - 3, this.canvas.width, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(0, y - 1, this.canvas.width, 2);
    }

    if (this.state === 'countdown') {
      const t = this.countdownTime;
      let value, phase;
      if (t < 3) {
        value = String(Math.ceil(3 - t));
        phase = 1 - (Math.ceil(3 - t) - (3 - t)); // 0..1 within the second
      } else {
        value = 'GO!';
        phase = Utils.clamp((t - 3) / 0.6, 0, 1);
      }
      const scale = 0.7 + Math.sin(Utils.clamp(phase, 0, 1) * Math.PI) * 0.5 + 0.3;
      this.hud.renderCountdown(ctx, value, Utils.clamp(scale, 0.7, 1.5));
    }
  }
}
