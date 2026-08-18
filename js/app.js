/**
 * App shell: hash router, header, theme toggle, ambient starfield.
 * The music capsule in the corner (and the engine behind it) never
 * unmounts, so the soundtrack survives every navigation.
 *
 * Public routes: home, story. The office (#/office) exists but is not
 * linked anywhere — it is the couple's back room.
 */
import { renderHome } from './views/home.js';
import { renderStory } from './views/story.js';
import { mountPlayer } from './ui/player.js';
import { startAmbient } from './ui/ambient.js';
import { logoSVG } from './ui/logo.js';
import { config } from './data.js';

const routes = { home: renderHome, story: renderStory };

const view = document.getElementById('view');
const head = document.getElementById('site-head');

function current() {
  const name = location.hash.replace(/^#\/?/, '');
  return name && routes[name] ? name : 'home';
}

function navigate(name) {
  location.hash = name === 'home' ? '' : `/${name}`;
}

function render() {
  const name = current();
  document.body.dataset.view = name;
  head.style.display = name === 'home' ? 'none' : ''; // the portal is bare
  view.classList.remove('view-in');
  routes[name](view, { navigate });
  requestAnimationFrame(() => view.classList.add('view-in'));
  head.querySelectorAll('.nav a').forEach((a) =>
    a.classList.toggle('is-active', a.dataset.route === name));
  window.scrollTo(0, 0);
}

head.innerHTML = `
  <a href="#" class="mark" aria-label="Home">
    ${logoSVG({ size: 38 })}
    <span>${config.couple.one.toLowerCase()} &amp; ${config.couple.two.toLowerCase()}</span>
  </a>
  <nav class="nav">
    <a href="#/story" data-route="story">retrospective</a>
  </nav>`;

/* day / night */
const themeBtn = document.getElementById('theme-toggle');
themeBtn.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('dl-theme', next); } catch {}
});

window.addEventListener('hashchange', render);
startAmbient(document.getElementById('ambient'));
mountPlayer(document.getElementById('player-root'));
render();
