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
| **Home** (`#/`) | Names, date, a drifting audio-reactive star field, and the door into the day. |
| **Retrospective** (`#/story`) | The wedding day as scroll-stopped chapters. As each chapter enters the viewport it *cues its own track* — the soundtrack follows the reader through the day. Photo cells tilt on hover; a rail on the right tracks where you are. |
| **Studio** (`#/studio`) | The day as a mixing desk: five faders (Strings / Keys / Low End / Room / Heartbeat) reshape the score live, a radial visualiser breathes with the mix, and guests can pin notes to The Wall. |

A **persistent music player** is docked at the bottom of every view —
transport, scrubber, live waveform, volume, and a slide-up track list.
One `AudioContext` lives across the whole site, so the music never cuts
when you change views.

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

Everything you'd want to edit lives in `data/`:

- **`data/config.js`** — names, date, place, epigraph.
- **`data/chapters.js`** — the chapters of the day: titles, times, text, and
  photos. Drop images into `media/photos/` and set each photo's `src`.
  Photos with `src: null` render as empty frames.
- **`data/tracks.js`** — the playlist. Drop audio into `media/audio/` and set
  each track's `src` to switch from the generative synth to the real song.
  `chapter` links a track to a chapter; `mood` picks the synth fallback and
  the accent colour.

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
