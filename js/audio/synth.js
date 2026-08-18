/**
 * A small generative ambient engine.
 *
 * Every track on this site can point at a real audio file. Until one exists,
 * this improvises in the right mood instead, so the player, the visualiser and
 * the studio mixer are all genuinely working from day one.
 *
 * Five layers, each on its own gain node, which is exactly what the studio
 * faders reach for: pad, keys, bass, air, rhythm.
 */

export const LAYERS = ['pad', 'keys', 'bass', 'air', 'rhythm'];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export const MOODS = {
  dawn: {
    root: 50, scale: [0, 2, 4, 7, 9], tempo: 62, tone: 1500, glow: '#e9c79c',
    levels: { pad: 0.55, keys: 0.45, bass: 0.3, air: 0.35, rhythm: 0 },
  },
  hymn: {
    root: 48, scale: [0, 4, 7, 11, 14], tempo: 56, tone: 1200, glow: '#d8ddf0',
    levels: { pad: 0.7, keys: 0.3, bass: 0.4, air: 0.25, rhythm: 0 },
  },
  still: {
    root: 45, scale: [0, 7, 12, 19], tempo: 44, tone: 900, glow: '#cfd6cf',
    levels: { pad: 0.6, keys: 0.18, bass: 0.35, air: 0.45, rhythm: 0 },
  },
  amber: {
    root: 53, scale: [0, 2, 5, 7, 9], tempo: 72, tone: 1800, glow: '#e2913f',
    levels: { pad: 0.5, keys: 0.5, bass: 0.28, air: 0.3, rhythm: 0.12 },
  },
  pulse: {
    root: 45, scale: [0, 3, 5, 7, 10], tempo: 112, tone: 2200, glow: '#e2492b',
    levels: { pad: 0.35, keys: 0.45, bass: 0.5, air: 0.15, rhythm: 0.6 },
  },
  ember: {
    root: 40, scale: [0, 3, 7, 10], tempo: 52, tone: 800, glow: '#b8543f',
    levels: { pad: 0.65, keys: 0.25, bass: 0.45, air: 0.4, rhythm: 0 },
  },
};

export const moodOf = (name) => MOODS[name] || MOODS.dawn;

function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < data.length; i++) {
    // Cheap pink-ish noise: white through a couple of one-pole lowpasses.
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099;
    b1 = 0.963 * b1 + white * 0.283;
    b2 = 0.57 * b2 + white * 1.0192;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
  }
  return buf;
}

export class GenerativeSynth {
  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.noise = noiseBuffer(ctx);
    this.running = false;
    this.timer = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.nodes = [];

    this.gains = {};
    for (const name of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.gains[name] = g;
    }
    this.setMood('dawn');
  }

  /** Swap the harmonic world. Levels follow unless the caller has pinned them. */
  setMood(name, { applyLevels = true } = {}) {
    this.mood = moodOf(name);
    this.moodName = name in MOODS ? name : 'dawn';
    if (applyLevels) {
      for (const layer of LAYERS) this.setLevel(layer, this.mood.levels[layer]);
    }
    if (this.running) { this.stopVoices(); this.startVoices(); }
  }

  setLevel(layer, value, ramp = 0.4) {
    const g = this.gains[layer];
    if (!g) return;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), t, ramp / 3);
  }

  getLevel(layer) {
    return this.gains[layer] ? this.gains[layer].gain.value : 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startVoices();
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.stopVoices();
  }

  /* ---- sustained layers: pad, bass, air ---- */

  startVoices() {
    const { ctx, mood } = this;
    const now = ctx.currentTime;

    // Pad: detuned saws through a slowly breathing lowpass.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = mood.tone;
    padFilter.Q.value = 0.7;
    padFilter.connect(this.gains.pad);

    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.04 + Math.random() * 0.05;
    lfoAmt.gain.value = mood.tone * 0.45;
    lfo.connect(lfoAmt).connect(padFilter.frequency);
    lfo.start(now);
    this.nodes.push(lfo);

    for (const interval of mood.scale.slice(0, 4)) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midi(mood.root + interval + 12);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.055, now, 3);
        osc.connect(g).connect(padFilter);
        osc.start(now);
        this.nodes.push(osc);
      }
    }

    // Bass: one sine, one octave down, gently wandering.
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = midi(mood.root - 12);
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0;
    bassGain.gain.setTargetAtTime(0.5, now, 2.5);
    bass.connect(bassGain).connect(this.gains.bass);
    bass.start(now);
    this.nodes.push(bass);

    const bassLfo = ctx.createOscillator();
    const bassLfoAmt = ctx.createGain();
    bassLfo.frequency.value = 0.07;
    bassLfoAmt.gain.value = 1.6;
    bassLfo.connect(bassLfoAmt).connect(bass.frequency);
    bassLfo.start(now);
    this.nodes.push(bassLfo);

    // Air: room tone. The sound of a big empty tent at 1am.
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 900;
    airFilter.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    airGain.gain.setTargetAtTime(0.5, now, 4);
    air.connect(airFilter).connect(airGain).connect(this.gains.air);
    air.start(now);
    this.nodes.push(air);

    const airLfo = ctx.createOscillator();
    const airLfoAmt = ctx.createGain();
    airLfo.frequency.value = 0.03;
    airLfoAmt.gain.value = 0.35;
    airLfo.connect(airLfoAmt).connect(airGain.gain);
    airLfo.start(now);
    this.nodes.push(airLfo);
  }

  stopVoices() {
    const t = this.ctx.currentTime;
    for (const node of this.nodes) {
      try { node.stop(t + 0.02); } catch { /* already stopped */ }
    }
    this.nodes = [];
  }

  /* ---- scheduled layers: keys, rhythm ---- */

  schedule() {
    const stepDur = 60 / this.mood.tempo / 4; // sixteenths
    while (this.nextStepTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += stepDur;
    }
  }

  playStep(step, when) {
    const { mood } = this;

    // Keys: sparse plucks, drifting octaves. Denser at the top of a bar.
    const chance = step % 4 === 0 ? 0.34 : 0.09;
    if (Math.random() < chance) {
      const note = mood.root + pick(mood.scale) + pick([12, 24, 24, 36]);
      this.pluck(midi(note), when, 1.6 + Math.random() * 1.8);
    }

    // Rhythm: a heartbeat rather than a drum kit.
    if (step % 8 === 0) this.thump(when);
    if (step % 4 === 2 && Math.random() < 0.7) this.tick(when);
  }

  pluck(freq, when, decay) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.22, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(g).connect(this.gains.keys);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }

  thump(when) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, when);
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.7, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    osc.connect(g).connect(this.gains.rhythm);
    osc.start(when);
    osc.stop(when + 0.4);
  }

  tick(when) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.12, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    src.connect(hp).connect(g).connect(this.gains.rhythm);
    src.start(when, Math.random());
    src.stop(when + 0.1);
  }
}
