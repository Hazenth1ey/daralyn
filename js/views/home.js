/**
 * The portal. The whole screen is the door: one press starts the music
 * and opens the retrospective.
 */
import { config } from '../../data/config.js';
import { engine } from '../audio/engine.js';
import { logoSVG } from '../ui/logo.js';

export function renderHome(mount, { navigate }) {
  mount.innerHTML = `
    <section class="portal">
      <button class="splash" data-go="story" aria-label="Enter the retrospective">
        ${logoSVG({ size: 156, className: 'home-logo' })}
        <p class="eyebrow">a retrospective</p>
        <h1 class="title">${config.couple.one}<span class="amp">&amp;</span>${config.couple.two}</h1>
        <p class="subtitle">${config.date} · ${config.place}</p>
        <p class="splash-epigraph">${config.epigraph}</p>
        <p class="splash-enter">enter the day</p>
      </button>
    </section>`;

  mount.querySelector('.splash').addEventListener('click', () => {
    engine.play(engine.index); // the user gesture that unlocks audio
    navigate('story');
  });
}
