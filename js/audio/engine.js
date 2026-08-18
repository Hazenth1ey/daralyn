/**
 * The one audio engine for the whole site.
 *
 * A single AudioContext lives across every view, so the music keeps playing
 * while you move between the retrospective and the studio. Each track plays
 * either from a real file (<audio> element piped in) or from the generative
 * synth when no file exists yet.
 */
import { GenerativeSynth, LAYERS, moodOf } from './synth.js';
import { tracks } from '../data.js';

const SYNTH_TRACK_LENGTH = 150; // seconds shown for generative tracks

class Engine extends EventTarget {
  constructor() {
    super();
    this.ctx = null;
    this.tracks = tracks;
    this.index = 0;
    this.playing = false;
    this.startedAt = 0;    // ctx.currentTime when the current synth track began
    this.pausedAt = 0;     // elapsed seconds at pause (synth tracks)
    this.volume = 0.8;
  }

  /** Lazily build the graph; browsers require a user gesture first. */
  ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    // Gentle glue so the synth never clips when faders are pushed.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;

    this.master.connect(comp).connect(this.analyser).connect(this.ctx.destination);

    this.synth = new GenerativeSynth(this.ctx);
    this.synth.out.connect(this.master);

    this.el = new Audio();
    this.el.crossOrigin = 'anonymous';
    this.el.addEventListener('ended', () => this.next());
    this.elSource = this.ctx.createMediaElementSource(this.el);
    this.elSource.connect(this.master);
  }

  get track() { return this.tracks[this.index]; }
  get isFileTrack() { return Boolean(this.track.src); }

  async play(index = this.index) {
    this.ensureContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const changed = index !== this.index || !this.playing;
    if (index !== this.index) this.pausedAt = 0;
    this.index = ((index % this.tracks.length) + this.tracks.length) % this.tracks.length;

    this.el.pause();
    this.synth.stop();

    if (this.isFileTrack) {
      if (this.el.src !== new URL(this.track.src, location.href).href) {
        this.el.src = this.track.src;
      }
      this.el.currentTime = this.pausedAt || 0;
      try { await this.el.play(); } catch (err) {
        // Missing/broken file: fall back to the synth for this track.
        console.warn(`Falling back to synth for "${this.track.title}":`, err.message);
        this.playSynth();
      }
    } else {
      this.playSynth();
    }

    this.playing = true;
    if (changed) this.emit('track');
    this.emit('state');
  }

  playSynth() {
    this.synth.setMood(this.track.mood);
    this.synth.start();
    this.startedAt = this.ctx.currentTime - this.pausedAt;
  }

  pause() {
    if (!this.ctx || !this.playing) return;
    this.pausedAt = this.position;
    this.el.pause();
    this.synth.stop();
    this.playing = false;
    this.emit('state');
  }

  toggle() { this.playing ? this.pause() : this.play(); }
  next() { this.pausedAt = 0; this.play(this.index + 1); }
  prev() { this.pausedAt = 0; this.play(this.index - 1); }

  /** Jump to the track that belongs to a chapter, if it isn't already on. */
  cueChapter(chapterId) {
    const i = this.tracks.findIndex((t) => t.chapter === chapterId);
    if (i === -1 || i === this.index) return;
    this.pausedAt = 0;
    if (this.playing) this.play(i);
    else { this.index = i; this.emit('track'); }
  }

  seek(fraction) {
    if (!this.ctx) return;
    const target = fraction * this.duration;
    if (this.isFileTrack && this.el.duration) {
      this.el.currentTime = target;
    } else {
      this.startedAt = this.ctx.currentTime - target;
    }
    this.pausedAt = target;
    this.emit('state');
  }

  get position() {
    if (!this.ctx) return 0;
    if (this.isFileTrack && this.el.duration) return this.el.currentTime;
    if (!this.playing) return this.pausedAt;
    const p = this.ctx.currentTime - this.startedAt;
    if (p >= SYNTH_TRACK_LENGTH) { queueMicrotask(() => this.next()); return SYNTH_TRACK_LENGTH; }
    return p;
  }

  get duration() {
    if (this.isFileTrack && this.el.duration) return this.el.duration;
    return SYNTH_TRACK_LENGTH;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    this.emit('state');
  }

  /* Studio hooks ---------------------------------------------------- */

  get layers() { return LAYERS; }
  layerLevel(name) { return this.synth ? this.synth.getLevel(name) : moodOf(this.track.mood).levels[name]; }
  setLayerLevel(name, v) { this.ensureContext(); this.synth.setLevel(name, v); }
  resetLayers() {
    const levels = moodOf(this.track.mood).levels;
    for (const l of LAYERS) this.setLayerLevel(l, levels[l]);
  }

  get glow() { return moodOf(this.track.mood).glow; }

  /** Frequency data for visualisers; empty array before first gesture. */
  spectrum() {
    if (!this.analyser) return new Uint8Array(0);
    if (!this._freq || this._freq.length !== this.analyser.frequencyBinCount) {
      this._freq = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.analyser.getByteFrequencyData(this._freq);
    return this._freq;
  }

  waveform() {
    if (!this.analyser) return new Uint8Array(0);
    if (!this._wave || this._wave.length !== this.analyser.fftSize) {
      this._wave = new Uint8Array(this.analyser.fftSize);
    }
    this.analyser.getByteTimeDomainData(this._wave);
    return this._wave;
  }

  emit(type) { this.dispatchEvent(new Event(type)); }
}

export const engine = new Engine();
