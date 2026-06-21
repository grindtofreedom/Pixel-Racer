'use strict';

/**
 * All sound is synthesized at runtime with the Web Audio API — no asset files.
 * A continuous engine oscillator is pitch-modulated by speed, and short
 * one-shot blips cover countdown / drift / crash / lap / finish events.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.master = null;
    this.engine = null;       // OscillatorNode
    this.engineGain = null;
    this.driftNoise = null;
    this.driftGain = null;
  }

  /** Lazily created on first user gesture to satisfy browser autoplay rules. */
  unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.enabled = true;
    this._buildEngine();
    this._buildDrift();
  }

  _buildEngine() {
    const ctx = this.ctx;
    this.engine = ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 55;

    const subOsc = ctx.createOscillator();
    subOsc.type = 'square';
    subOsc.frequency.value = 40;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;

    this.engine.connect(this.engineGain);
    subOsc.connect(this.engineGain);
    this.engineGain.connect(lp);
    lp.connect(this.master);

    this.engine.start();
    subOsc.start();
    this._subOsc = subOsc;
  }

  _buildDrift() {
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    this.driftNoise = ctx.createBufferSource();
    this.driftNoise.buffer = buffer;
    this.driftNoise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;

    this.driftGain = ctx.createGain();
    this.driftGain.gain.value = 0;

    this.driftNoise.connect(bp);
    bp.connect(this.driftGain);
    this.driftGain.connect(this.master);
    this.driftNoise.start();
  }

  /** Update the looping engine/drift sounds. speed01 and drift01 are 0..1. */
  updateEngine(speed01, drift01) {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const baseFreq = 55 + speed01 * 230;
    this.engine.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this._subOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.18, now, 0.08);
    this.driftGain.gain.setTargetAtTime(drift01 * 0.25, now, 0.05);
  }

  /** Generic short tone used for countdown / UI. */
  beep(freq = 440, duration = 0.12, type = 'square', volume = 0.4) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  countdownTick() { this.beep(523, 0.15, 'square', 0.35); }
  countdownGo() { this.beep(1046, 0.4, 'sawtooth', 0.45); }
  lap() { this.beep(880, 0.18, 'triangle', 0.4); }

  crash() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  }

  finish() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      setTimeout(() => this.beep(f, 0.22, 'triangle', 0.4), i * 140);
    });
  }
}
