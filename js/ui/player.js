/**
 * The persistent music player docked along the bottom of every view —
 * transport, scrubber, live waveform, and a slide-up track list.
 */
import { engine } from '../audio/engine.js';

const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function mountPlayer(root) {
  root.innerHTML = `
    <div class="player" data-open="false">
      <div class="player-tracklist" id="player-tracklist" aria-label="Track list"></div>
      <div class="player-bar">
        <button class="p-btn" data-act="list" aria-label="Track list" title="Track list">
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
        <button class="p-btn" data-act="prev" aria-label="Previous track">
          <svg viewBox="0 0 24 24"><path d="M17 5v14L8 12l9-7zM6 5h1.6v14H6z" fill="currentColor"/></svg>
        </button>
        <button class="p-btn p-play" data-act="toggle" aria-label="Play or pause">
          <svg class="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor"/></svg>
          <svg class="i-pause" viewBox="0 0 24 24"><path d="M6.5 4.5h3.6v15H6.5zm7.4 0h3.6v15h-3.6z" fill="currentColor"/></svg>
        </button>
        <button class="p-btn" data-act="next" aria-label="Next track">
          <svg viewBox="0 0 24 24"><path d="M7 5v14l9-7-9-7zm9.4 0H18v14h-1.6z" fill="currentColor"/></svg>
        </button>
        <div class="p-meta">
          <span class="p-title"></span>
          <span class="p-artist"></span>
        </div>
        <canvas class="p-wave" width="10" height="10" aria-hidden="true"></canvas>
        <div class="p-time"><span class="p-pos">0:00</span><span class="p-sep">/</span><span class="p-dur">0:00</span></div>
        <div class="p-scrub" role="slider" aria-label="Seek" tabindex="0">
          <div class="p-scrub-fill"></div>
        </div>
        <div class="p-vol" title="Volume">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/></svg>
          <input type="range" min="0" max="1" step="0.01" value="${engine.volume}" aria-label="Volume">
        </div>
      </div>
    </div>`;

  const el = (sel) => root.querySelector(sel);
  const player = el('.player');
  const list = el('#player-tracklist');
  const canvas = el('.p-wave');
  const cctx = canvas.getContext('2d');

  /* track list */
  list.innerHTML = engine.tracks.map((t, i) => `
    <button class="tl-row" data-i="${i}">
      <span class="tl-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="tl-t">${t.title}</span>
      <span class="tl-a">${t.artist}</span>
      <span class="tl-eq" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>`).join('');

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.tl-row');
    if (row) engine.play(Number(row.dataset.i));
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'toggle') engine.toggle();
    if (act === 'next') engine.next();
    if (act === 'prev') engine.prev();
    if (act === 'list') player.dataset.open = player.dataset.open === 'true' ? 'false' : 'true';
  });

  /* scrubber */
  const scrub = el('.p-scrub');
  const seekTo = (clientX) => {
    const r = scrub.getBoundingClientRect();
    engine.seek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };
  scrub.addEventListener('pointerdown', (e) => {
    scrub.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    const move = (ev) => seekTo(ev.clientX);
    const up = () => {
      scrub.removeEventListener('pointermove', move);
      scrub.removeEventListener('pointerup', up);
    };
    scrub.addEventListener('pointermove', move);
    scrub.addEventListener('pointerup', up);
  });
  scrub.addEventListener('keydown', (e) => {
    const step = 5 / engine.duration;
    if (e.key === 'ArrowRight') engine.seek(Math.min(1, engine.position / engine.duration + step));
    if (e.key === 'ArrowLeft') engine.seek(Math.max(0, engine.position / engine.duration - step));
  });

  el('.p-vol input').addEventListener('input', (e) => engine.setVolume(Number(e.target.value)));

  /* state sync */
  const sync = () => {
    player.dataset.playing = engine.playing;
    el('.p-title').textContent = engine.track.title;
    el('.p-artist').textContent = engine.track.artist;
    list.querySelectorAll('.tl-row').forEach((row, i) => {
      row.dataset.active = i === engine.index;
      row.dataset.playing = i === engine.index && engine.playing;
    });
    document.documentElement.style.setProperty('--glow', engine.glow);
  };
  engine.addEventListener('track', sync);
  engine.addEventListener('state', sync);
  sync();

  /* per-frame: waveform + clock + scrub fill */
  const pos = el('.p-pos'), dur = el('.p-dur'), fill = el('.p-scrub-fill');
  function frame() {
    pos.textContent = fmt(engine.position);
    dur.textContent = fmt(engine.duration);
    fill.style.width = `${(engine.position / engine.duration) * 100}%`;

    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && (canvas.width !== w * devicePixelRatio)) {
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
    }
    cctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    cctx.clearRect(0, 0, w, h);
    const data = engine.waveform();
    if (data.length) {
      cctx.beginPath();
      const n = 96;
      for (let i = 0; i < n; i++) {
        const v = data[(i / n * data.length) | 0] / 128 - 1;
        const x = (i / (n - 1)) * w;
        const y = h / 2 + v * (h / 2 - 1) * (engine.playing ? 1 : 0.15);
        i ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
      }
      cctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() || '#e2492b';
      cctx.lineWidth = 1.2;
      cctx.globalAlpha = 0.9;
      cctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
