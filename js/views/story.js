/**
 * The retrospective: the wedding day as scroll-stopped chapters.
 * Each chapter cues its own track as it enters the viewport, so the
 * soundtrack follows the reader through the day.
 */
import { chapters } from '../../data/chapters.js';
import { config } from '../../data/config.js';
import { engine } from '../audio/engine.js';

function photoCell(p) {
  const span = p.span ? ` cell-${p.span}` : '';
  const img = p.src
    ? `<img src="${p.src}" alt="${p.caption || ''}" loading="lazy">`
    : `<div class="cell-empty" aria-hidden="true"><span>◦</span></div>`;
  return `
    <figure class="cell${span}">
      ${img}
      ${p.caption ? `<figcaption>${p.caption}</figcaption>` : ''}
    </figure>`;
}

export function renderStory(mount) {
  mount.innerHTML = `
    <section class="story">
      <header class="story-head">
        <p class="story-over">${config.date} · ${config.place}</p>
        <h2>The Day, In Order</h2>
        <p class="story-lede">Scroll slowly. The music knows where you are.</p>
      </header>

      <nav class="story-rail" aria-label="Chapters">
        ${chapters.map((c) => `
          <a href="#ch-${c.id}" class="rail-dot" data-ch="${c.id}" title="${c.title}">
            <span>${c.index}</span>
          </a>`).join('')}
      </nav>

      ${chapters.map((c) => `
        <article class="chapter" id="ch-${c.id}" data-ch="${c.id}">
          <div class="ch-text">
            <p class="ch-index">${c.index} — ${c.time}</p>
            <h3 class="ch-title">${c.title}</h3>
            <p class="ch-line">${c.line}</p>
            <p class="ch-body">${c.body}</p>
          </div>
          <div class="ch-photos">
            ${c.photos.map(photoCell).join('')}
          </div>
        </article>`).join('')}

      <footer class="story-end">
        <p>— and then it was the rest of our lives —</p>
      </footer>
    </section>`;

  /* Reveal + music cue on chapter entry. */
  const rail = mount.querySelectorAll('.rail-dot');
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const ch = entry.target.dataset.ch;
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        engine.cueChapter(ch);
        rail.forEach((d) => d.classList.toggle('is-active', d.dataset.ch === ch));
      }
    }
  }, { threshold: 0.45 });
  mount.querySelectorAll('.chapter').forEach((el) => io.observe(el));

  /* Tilt-on-hover for photo cells — small, physical, never on touch. */
  if (matchMedia('(hover:hover)').matches) {
    mount.querySelectorAll('.cell').forEach((cell) => {
      cell.addEventListener('pointermove', (e) => {
        const r = cell.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        cell.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      cell.addEventListener('pointerleave', () => { cell.style.transform = ''; });
    });
  }
}
