/**
 * Landing view: names, date, a slow constellation of light, and the door
 * into the retrospective. Clicking "begin" is also the user gesture that
 * unlocks audio.
 */
import { config } from '../../data/config.js';
import { engine } from '../audio/engine.js';

export function renderHome(mount, { navigate }) {
  mount.innerHTML = `
    <section class="home">
      <canvas class="home-stars" aria-hidden="true"></canvas>
      <div class="home-inner">
        <p class="home-over">a retrospective</p>
        <h1 class="home-names">
          <span>${config.couple.one}</span>
          <span class="amp">&amp;</span>
          <span>${config.couple.two}</span>
        </h1>
        <p class="home-meta">${config.date} · ${config.place}</p>
        <p class="home-epigraph">${config.epigraph}</p>
        <div class="home-actions">
          <button class="btn btn-primary" data-go="story">Begin the day</button>
          <button class="btn btn-ghost" data-go="studio">Enter the studio</button>
        </div>
        <p class="home-hint">headphones recommended</p>
      </div>
    </section>`;

  mount.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      engine.play(engine.index); // user gesture → audio unlocked
      navigate(b.dataset.go);
    }));

  /* Slow drifting particle field, tinted by the current track's glow. */
  const canvas = mount.querySelector('.home-stars');
  const ctx = canvas.getContext('2d');
  const N = 90;
  const pts = Array.from({ length: N }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.4 + Math.random() * 1.6,
    vx: (Math.random() - 0.5) * 0.00012,
    vy: (Math.random() - 0.5) * 0.00008,
    tw: Math.random() * Math.PI * 2,
  }));
  let raf;
  function draw(t) {
    if (!canvas.isConnected) return cancelAnimationFrame(raf);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * devicePixelRatio) {
      canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const glow = getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() || '#e2492b';

    // audio-reactive shimmer
    const spec = engine.spectrum();
    let energy = 0;
    if (spec.length) { for (let i = 4; i < 40; i++) energy += spec[i]; energy /= 36 * 255; }

    for (const p of pts) {
      p.x = (p.x + p.vx + 1) % 1;
      p.y = (p.y + p.vy + 1) % 1;
      const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.0004 + p.tw)) + energy * 0.5;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.r + energy * 2, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.globalAlpha = Math.min(1, a) * 0.7;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
}
