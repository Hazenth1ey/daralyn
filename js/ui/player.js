/**
 * The music toggle: a capsule in the bottom-right corner. Closed, it is a
 * quiet circle. On hover (or a tap) it springs open to reveal the track
 * list button, previous/next, the current title drifting past, and the
 * knob — a play glyph that becomes equalizer bars while the music runs.
 */
import { engine } from '../audio/engine.js';

export function mountPlayer(root) {
  root.innerHTML = `
    <div class="sk-list" id="sk-list" role="listbox" aria-label="Soundtrack"></div>
    <div class="skiper-toggle" id="skiper" aria-label="Music">
      <span class="sk-reveal">
        <button class="sk-mini" data-act="list" aria-label="Track list" title="soundtrack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 6h16M4 12h16M4 18h10"/>
          </svg>
        </button>
        <button class="sk-mini" data-act="prev" aria-label="Previous track">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 5v14L8 12l9-7zM6 5h1.8v14H6z"/></svg>
        </button>
        <button class="sk-mini" data-act="next" aria-label="Next track">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l9-7-9-7zm9.2 0H18v14h-1.8z"/></svg>
        </button>
        <span class="sk-title-wrap"><span class="sk-ticker"><span class="sk-title"></span></span></span>
      </span>
      <button class="sk-knob" data-act="toggle" aria-pressed="false" aria-label="Play or pause the soundtrack">
        <svg class="sk-play" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5-13-7.5z"/></svg>
        <span class="sk-eq" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </div>`;

  const capsule = root.querySelector('#skiper');
  const list = root.querySelector('#sk-list');
  const knob = root.querySelector('.sk-knob');
  const ticker = root.querySelector('.sk-ticker');

  /* the soundtrack list */
  list.innerHTML = engine.tracks.map((t, i) => `
    <button class="sk-li" data-i="${i}" role="option">
      <span class="sk-li-mark">${String(i + 1).padStart(2, '0')}</span>
      <span class="sk-li-title">${t.title} — ${t.artist}</span>
    </button>`).join('');

  list.addEventListener('click', (e) => {
    const li = e.target.closest('.sk-li');
    if (li) engine.play(Number(li.dataset.i));
  });

  capsule.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) {
      // a tap on the closed capsule (touch) opens it instead of playing
      if (!capsule.matches(':hover') && !capsule.classList.contains('is-open')) {
        capsule.classList.add('is-open');
      }
      return;
    }
    const act = btn.dataset.act;
    if (act === 'toggle') engine.toggle();
    if (act === 'next') engine.next();
    if (act === 'prev') engine.prev();
    if (act === 'list') list.classList.toggle('is-open');
  });

  // close the list / capsule when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      list.classList.remove('is-open');
      capsule.classList.remove('is-open');
    }
  });

  /* state sync */
  const sync = () => {
    const t = engine.track;
    capsule.classList.toggle('is-playing', engine.playing);
    knob.setAttribute('aria-pressed', String(engine.playing));

    // rebuild the ticker: one copy, then measure; loop a second copy if long
    ticker.innerHTML = `<span class="sk-title">${t.title}</span>`;
    ticker.classList.remove('is-scrolling');
    requestAnimationFrame(() => {
      const wrap = root.querySelector('.sk-title-wrap');
      const first = ticker.querySelector('.sk-title');
      if (first && wrap && first.scrollWidth > wrap.clientWidth) {
        const copy = first.cloneNode(true);
        ticker.appendChild(copy);
        const loop = first.scrollWidth;
        ticker.style.setProperty('--sk-loop', `-${loop}px`);
        ticker.style.setProperty('--sk-dur', `${Math.max(6, loop / 18)}s`);
        ticker.classList.add('is-scrolling');
      }
    });

    list.querySelectorAll('.sk-li').forEach((li, i) => {
      const current = i === engine.index;
      li.classList.toggle('is-current', current);
      li.querySelector('.sk-li-mark').innerHTML = current && engine.playing
        ? '<span class="sk-li-dot"></span>'
        : String(i + 1).padStart(2, '0');
    });

    document.documentElement.style.setProperty('--glow', engine.glow);
  };
  engine.addEventListener('track', sync);
  engine.addEventListener('state', sync);
  sync();
}
