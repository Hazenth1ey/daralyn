/**
 * The studio — the couple's back room. Not linked anywhere on the site;
 * reachable at /studio (or #/office), behind a passphrase.
 *
 * NOTE: the gate is client-side and keeps casual visitors out, nothing
 * more. Anyone who reads the source can pass it. Real security needs a
 * server (a small Cloudflare Worker) — ask when you want it.
 *
 * Inside: the mixing desk over the generative score, and the guest wall
 * with moderation (delete notes).
 */
import { config } from '../../data/config.js';
import { engine } from '../audio/engine.js';

const LAYER_LABELS = { pad: 'Strings', keys: 'Keys', bass: 'Low End', air: 'Room', rhythm: 'Heartbeat' };
const NOTES_KEY = 'daralyn-studio-notes';
const UNLOCK_KEY = 'dl-office-open';

export function renderOffice(mount) {
  if (sessionStorage.getItem(UNLOCK_KEY) !== '1') return renderGate(mount);
  renderDesk(mount);
}

function renderGate(mount) {
  mount.innerHTML = `
    <section class="office">
      <form class="gate">
        <p class="eyebrow">the studio</p>
        <p class="lede" style="font-size:1.2rem; margin-top:0.8rem;">this room is ours.</p>
        <input type="password" name="pass" placeholder="the word" autocomplete="off" autofocus>
        <p class="gate-err">that isn't it</p>
      </form>
    </section>`;

  const form = mount.querySelector('.gate');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = String(new FormData(form).get('pass') || '').trim().toLowerCase();
    if (val === config.officePass.toLowerCase()) {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      renderDesk(mount);
    } else {
      form.querySelector('.gate-err').classList.add('is-on');
      form.reset();
    }
  });
}

function renderDesk(mount) {
  const layers = engine.layers;
  mount.innerHTML = `
    <section class="office">
      <header class="office-head">
        <p class="eyebrow">the studio</p>
        <h2>Remix the Day</h2>
        <p class="story-lede">${config.studioNote}</p>
      </header>

      <div class="desk">
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
            <button class="btn" data-act="reset">reset mix</button>
            <button class="btn btn-primary" data-act="playpause">play / pause</button>
            <p class="desk-tip">Faders shape the generative score live. Change tracks with the capsule in the corner to change the mood entirely.</p>
          </div>
        </div>
      </div>

      <div class="office-wall">
        <h3>The Wall</h3>
        <p class="wall-lede">Notes guests left. Hover one to remove it.</p>
        <form class="wall-form">
          <input type="text" name="who" placeholder="who is this from?" maxlength="40" autocomplete="off">
          <textarea name="msg" placeholder="add one yourselves…" maxlength="280" required></textarea>
          <button class="btn" type="submit">pin it</button>
        </form>
        <div class="wall-notes"></div>
      </div>

      <a class="back" href="/#/story">back to the day</a>
    </section>`;

  /* faders */
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

  /* visualiser — radial spectrum bloom */
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
    const glow = getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() || '#9db0d8';
    const spec = engine.spectrum();
    const N = 140;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.00006);
    for (let i = 0; i < N; i++) {
      const v = spec.length ? spec[(i / N * spec.length * 0.5) | 0] / 255 : 0.06;
      const a = (i / N) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * base, Math.sin(a) * base);
      ctx.lineTo(Math.cos(a) * (base + 4 + v * Math.min(w, h) * 0.24), Math.sin(a) * (base + 4 + v * Math.min(w, h) * 0.24));
      ctx.strokeStyle = glow;
      ctx.globalAlpha = 0.14 + v * 0.75;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();

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

    mount.querySelectorAll('.fader').forEach((f) => {
      f.querySelector('.fader-meter i').style.height = `${Math.round(engine.layerLevel(f.dataset.layer) * 100)}%`;
    });
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);

  /* the wall, with moderation */
  const wall = mount.querySelector('.wall-notes');
  const load = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch { return []; } };
  const save = (notes) => localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

  function renderNotes() {
    const notes = load();
    wall.innerHTML = notes.length
      ? notes.map((n, i) => `
          <div class="note">
            <button class="note-del" data-i="${i}" aria-label="Delete note" title="remove">×</button>
            <p>${esc(n.msg)}</p>
            <span>— ${esc(n.who || 'someone who was there')}</span>
          </div>`).join('')
      : '<p class="wall-empty">Nothing pinned yet.</p>';
  }
  wall.addEventListener('click', (e) => {
    const del = e.target.closest('.note-del');
    if (!del) return;
    const notes = load();
    notes.splice(Number(del.dataset.i), 1);
    save(notes);
    renderNotes();
  });
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

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
