/**
 * The global starfield behind every page. Slow drift, gentle twinkle,
 * and a faint audio-reactive breath when the music plays.
 */
import { engine } from '../audio/engine.js';

export function startAmbient(canvas) {
  const ctx = canvas.getContext('2d');
  const N = 110;
  const stars = Array.from({ length: N }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.3 + Math.random() * 1.4,
    vx: (Math.random() - 0.5) * 0.00008,
    vy: (Math.random() - 0.5) * 0.00005,
    tw: Math.random() * Math.PI * 2,
    warm: Math.random() < 0.18, // a few violet ones among the periwinkle
  }));

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      glow: cs.getPropertyValue('--glow').trim() || '#9db0d8',
      warm: cs.getPropertyValue('--glow-warm').trim() || '#c9a9c8',
    };
  }

  function frame(t) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && canvas.width !== w * devicePixelRatio) {
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { glow, warm } = colors();
    const spec = engine.spectrum();
    let energy = 0;
    if (spec.length && engine.playing) {
      for (let i = 4; i < 40; i++) energy += spec[i];
      energy /= 36 * 255;
    }

    for (const s of stars) {
      s.x = (s.x + s.vx + 1) % 1;
      s.y = (s.y + s.vy + 1) % 1;
      const a = 0.22 + 0.5 * Math.abs(Math.sin(t * 0.00035 + s.tw)) + energy * 0.45;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r + energy * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = s.warm ? warm : glow;
      ctx.globalAlpha = Math.min(1, a) * 0.75;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
