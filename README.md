# Dara & Leakhena — A Wedding Retrospective

An interactive retrospective of a wedding day, with its own soundtrack.
Dark, cinematic, and fully static — no build step, no dependencies.

## Run it

Any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(It must be served over http — ES modules don't load from `file://`.)

## What's inside

| View | What it does |
| --- | --- |
| **Portal** (`#/`) | The monogram over a starfield; the whole screen is the door into the day. |
| **Retrospective** (`#/story`) | The wedding day as scroll-stopped chapters. As each chapter enters the viewport it *cues its own track* — the soundtrack follows the reader through the day. A rail on the right tracks where you are. |
| **The Studio** (`/studio`) | The back office — a real CMS. Sign in with GitHub (via the shared OAuth worker); edit chapters in a rich editor, upload photos and audio, reorder the soundtrack, and update the site's names/date/epigraph. Every publish is a git commit that auto-deploys. |

The **music toggle is a capsule** in the bottom-right corner of every
view — closed, a quiet circle; open, it reveals the track list,
previous/next, the drifting title, and a knob that becomes equalizer
bars while playing. One `AudioContext` lives across the whole site, so
the music never cuts when you change views. A day/night toggle sits in
the top-right corner.

## The music

Every track can point at a real audio file. Until one exists, a built-in
generative synth improvises in that track's mood (six moods: dawn, hymn,
still, amber, pulse, ember), so the whole site is playable from day one.
Each mood also tints the site's accent colour — the interface literally
changes colour with the music. The palette is anchored to the couple's
dusty-blue monogram (`--brand` in `css/main.css`); the monogram itself is
redrawn as inline SVG in `js/ui/logo.js` with a self-hosted script font
(`media/fonts/`), so it stays crisp at any size on the dark theme.

## Making it yours

Use the Studio at `/studio` — or edit the JSON in `data/` directly:

- **`data/site.json`** — names, date, place, epigraph.
- **`data/chapters.json`** — the chapters of the day: titles, times, text
  (markdown-lite), and photos (`media/photos/`).
- **`data/tracks.json`** — the playlist. A track with `src: null` plays the
  generative synth in its `mood`; give it a file in `media/audio/` to play
  the real song. `chapter` links a track to a chapter.

## Layout

```
index.html
css/main.css          all styling
js/app.js             hash router + nav shell
js/audio/engine.js    the one audio engine (player + analyser + studio hooks)
js/audio/synth.js     generative ambient engine (5 layers, 6 moods)
js/ui/player.js       persistent bottom player
js/views/             home, story (retrospective), studio
data/                 ← edit these
media/                ← drop photos & audio here
```

## Notes

- Guest notes on The Wall are stored in `localStorage` for now — swap in a
  tiny backend later if notes should be shared between visitors.
- Respects `prefers-reduced-motion`.
