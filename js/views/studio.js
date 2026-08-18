/**
 * The Studio: the day as a mixing desk.
 *
 * Five faders control the five layers of the generative score in real time,
 * a large visualiser breathes with the mix, and guests can leave a note on
 * the wall (persisted locally for now).
 */
import { config } from '../../data/config.js';
import { engine } from '../audio/engine.js';

const LAYER_LABELS = {
  pad: 'Strings',
  keys: 'Keys',
  bass: 'Low End',
  air: 'Room',
  rhythm: 'Heartbeat',
};

const NOTES_KEY = 'daralyn-studio-notes';

export function renderStudio(mount) {
  const layers = engine.layers;

  mount.innerHTML = `
    <section class="studio">
      <header class="studio-head">
        <p class="story-over">the studio</p>
        <h2>Remix the Day</h2>
        <p class="story-lede">${config.studioNote}</p>
      </header>

      <div class="studio-desk">
        <canvas class="studio-vis" aria-hidden="true"></canvas>

        <div class="desk-panel">
          <div class="faders">
            ${layers.map((l) => `
              <label class="fader" data-layer="${l}">
                <span class="fader-meter"><i></i></span>
                <input type="range" min="0" max="1" step="0.01"
                       value="${engine.layerLevel(l).toFixed(2)}"
                       aria-label="${LAYER_LABELS[l]} level">
                <span class="fader-name">${LAYER_LABELS[l]}</span>
              </label>`).join('')}
          </div>
          <div class="desk-side">
            <button class="btn btn-ghost btn-sm" data-act="reset">Reset mix</button>
            <button class="btn btn-ghost btn-sm" data-act="playpause">Play / Pause</button>
            <p class="desk-tip">Faders shape the generative score live. Skip tracks in the player below to change the mood entirely.</p>
          </div>
        </div>
      </div>

      <div class="studio-wall">
        <h3>The Wall</h3>
        <p class="wall-lede">Leave something for the two of us to find later.</p>
        <form class="wall-form">
          <input type="text" name="who" placeholder="who are you?" maxlength="40" autocomplete="off">
          <textarea name="msg" placeholder="say the thing you didn't get to say at the reception…" maxlength="280" required></textarea>
          <button class="btn btn-primary btn-sm" type="submit">Pin it</button>
        </form>
        <div class="wall-notes"></div>
      </div>
    </section>`;

  /* Faders */
  mount.querySelectorAll('.fader input').forEach((input) => {
    const layer = input.closest('.fader').dataset.layer;
    input.addEventListener('input', () => engine.setLayerLevel(layer, Number(input.value)));
  });

  mount.querySelector('[data-act="reset"]').addEventListener('click', () => {
    engine.resetLayers();
    syncFaders();
  });
  mount.querySelector('[data-act="playpause"]').addEventListener('click', () => {
    engine.ensureContext();
    engine.toggle();
  });

  function syncFaders() {
    mount.querySelectorAll('.fader').forEach((f) => {
      f.querySelector('input').value = engine.layerLevel(f.dataset.layer).toFixed(2);
    });
  }
  engine.addEventListener('track', syncFaders);

  /* Visualiser: radial spectrum, a slow bloom around a core. */
  const canvas = mount.querySelector('.studio-vis');
  const ctx = canvas.getContext('2d');
  let raf;
  function draw(t) {
    if (!canvas.isConnected) return cancelAnimationFrame(raf);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && canvas.width !== w * devicePixelRatio) {
      canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const base = Math.min(w, h) * 0.16;
    const glow = getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() || '#6f9fc0';
    const spec = engine.spectrum();
    const N = 140;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.00006);
    for (let i = 0; i < N; i++) {
      const v = spec.length ? spec[(i / N * spec.length * 0.5) | 0] / 255 : 0.06;
      const a = (i / N) * Math.PI * 2;
      const r0 = base, r1 = base + 4 + v * Math.min(w, h) * 0.24;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.strokeStyle = glow;
      ctx.globalAlpha = 0.14 + v * 0.75;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();

    // core
    let energy = 0;
    if (spec.length) { for (let i = 2; i < 32; i++) energy += spec[i]; energy /= 30 * 255; }
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * (1 + energy));
    grad.addColorStop(0, glow);
    grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.5 + energy * 0.5;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, base * (1 + energy), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // layer meters, driven by actual gain values
    mount.querySelectorAll('.fader').forEach((f) => {
      const level = engine.layerLevel(f.dataset.layer);
      f.querySelector('.fader-meter i').style.height = `${Math.round(level * 100)}%`;
    });

    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);

  /* The Wall — localStorage-backed guest notes. */
  const wall = mount.querySelector('.wall-notes');
  const load = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch { return []; } };
  const save = (notes) => localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

  function renderNotes() {
    const notes = load();
    wall.innerHTML = notes.length
      ? notes.map((n, i) => `
          <div class="note" style="--tilt:${((i * 7919) % 7) - 3}deg">
            <p>${escapeHtml(n.msg)}</p>
            <span>— ${escapeHtml(n.who || 'someone who was there')}</span>
          </div>`).join('')
      : '<p class="wall-empty">Nothing pinned yet. Be the first.</p>';
  }

  mount.querySelector('.wall-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const msg = String(data.get('msg') || '').trim();
    if (!msg) return;
    const notes = load();
    notes.unshift({ who: String(data.get('who') || '').trim(), msg, at: Date.now() });
    save(notes.slice(0, 60));
    e.target.reset();
    renderNotes();
  });

  renderNotes();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
