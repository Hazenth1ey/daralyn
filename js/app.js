/**
 * App shell: hash router + top navigation. Views swap inside #view while the
 * player at the bottom (and the audio engine behind it) never unmounts.
 */
import { renderHome } from './views/home.js';
import { renderStory } from './views/story.js';
import { renderStudio } from './views/studio.js';
import { mountPlayer } from './ui/player.js';
import { config } from '../data/config.js';
import { logoSVG } from './ui/logo.js';

const routes = {
  home: renderHome,
  story: renderStory,
  studio: renderStudio,
};

const view = document.getElementById('view');
const nav = document.getElementById('nav');

function current() {
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  return routes[name] ? name : 'home';
}

function navigate(name) {
  location.hash = name === 'home' ? '' : `/${name}`;
}

function render() {
  const name = current();
  document.body.dataset.view = name;
  view.classList.remove('view-in');
  routes[name](view, { navigate });
  requestAnimationFrame(() => view.classList.add('view-in'));
  nav.querySelectorAll('a').forEach((a) =>
    a.classList.toggle('is-active', a.dataset.route === name));
  view.scrollTop = 0;
  window.scrollTo(0, 0);
}

nav.innerHTML = `
  <a href="#" data-route="home" class="nav-brand" aria-label="Home">${logoSVG({ size: 40, className: 'nav-logo' })}</a>
  <div class="nav-links">
    <a href="#/story" data-route="story">Retrospective</a>
    <a href="#/studio" data-route="studio">Studio</a>
  </div>`;

window.addEventListener('hashchange', render);
mountPlayer(document.getElementById('player-root'));
render();
