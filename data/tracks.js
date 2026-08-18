// The playlist behind the retrospective.
//
// `src` may be:
//   - a path to a real audio file, e.g. 'media/audio/first-dance.mp3'
//   - null, in which case the built-in synth improvises a bed in that mood,
//     so the site is fully playable before any real audio exists.
//
// `mood` drives both the synth fallback and the colour of the visualiser.
// `chapter` links a track to a chapter on the retrospective, so scrolling
// the story cues the music that belongs to it.
export const tracks = [
  {
    id: 'first-light',
    title: 'First Light',
    artist: 'The morning of',
    chapter: 'morning',
    mood: 'dawn',
    src: null,
    note: 'Curtains open. Someone is already crying and nothing has happened yet.',
  },
  {
    id: 'the-walk',
    title: 'The Walk',
    artist: 'Processional',
    chapter: 'ceremony',
    mood: 'hymn',
    src: null,
    note: 'Twenty-two steps. We have both been told the length of this aisle and neither of us believed it.',
  },
  {
    id: 'vows',
    title: 'Say It Out Loud',
    artist: 'Vows',
    chapter: 'vows',
    mood: 'still',
    src: null,
    note: 'The part where the room goes quiet enough to hear the air conditioning.',
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour',
    artist: 'Between',
    chapter: 'golden',
    mood: 'amber',
    src: null,
    note: 'Stolen twenty minutes. The photographer walking backwards the whole time.',
  },
  {
    id: 'the-floor',
    title: 'The Floor',
    artist: 'Reception',
    chapter: 'reception',
    mood: 'pulse',
    src: null,
    note: 'Your uncle. The sound system. History was made.',
  },
  {
    id: 'last-dance',
    title: 'Last Dance',
    artist: 'Closing',
    chapter: 'last',
    mood: 'ember',
    src: null,
    note: 'Everyone else has gone to find their shoes.',
  },
];
