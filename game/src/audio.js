// Storm Runner — sound, made in code only: a WebAudio engine hum, a ring
// chime, a crate thump and a landing fanfare. No audio files, no network.
export class SoundBank {
  constructor() {
    this.context = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.muted = false;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.unlocked = true;
      this.startEngineLoop();
    } catch {
      this.context = null;
    }
  }

  startEngineLoop() {
    const ctx = this.context;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    // Wind: looped noise through a band-pass, louder with speed.
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    noise.start();
  }

  // Called every frame while flying: the hum follows throttle, the wind
  // follows airspeed.
  setFlightSound(throttle, speed, flying) {
    if (!this.context || this.muted) return;
    const time = this.context.currentTime;
    const target = flying ? 0.028 + throttle * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, time, 0.1);
    this.engineOsc.frequency.setTargetAtTime(46 + throttle * 44 + speed * 0.25, time, 0.1);
    this.windGain.gain.setTargetAtTime(flying ? Math.min(0.05, speed * 0.0006) : 0, time, 0.2);
  }

  blip(frequency, duration, type, volume, when = 0) {
    if (!this.context || this.muted) return;
    const ctx = this.context;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  ringChime() {
    this.blip(880, 0.35, 'sine', 0.16);
    this.blip(1318, 0.5, 'sine', 0.12, 0.07);
  }

  thump() {
    this.blip(70, 0.28, 'sine', 0.3);
    this.blip(48, 0.4, 'triangle', 0.2, 0.02);
  }

  click() {
    this.blip(1200, 0.06, 'square', 0.05);
  }

  fanfare() {
    [523, 659, 784, 1046].forEach((frequency, index) => {
      this.blip(frequency, 0.5, 'triangle', 0.14, index * 0.11);
    });
  }

  crashSound() {
    this.blip(110, 0.7, 'sawtooth', 0.2);
    this.blip(55, 0.9, 'sine', 0.28, 0.05);
  }
}
