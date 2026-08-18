/**
 * Site content, loaded from the JSON files the studio edits.
 * Top-level await: the app module graph waits until content is here.
 */
async function load(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch {
    return fallback;
  }
}

export const config = await load('/data/site.json', {
  couple: { one: 'Dara', two: 'Leakhena' }, date: '—', place: '—', epigraph: '',
});

const rawChapters = await load('/data/chapters.json', []);
export const chapters = rawChapters.map((c, i) => ({
  ...c,
  index: String(i + 1).padStart(2, '0'),
  photos: Array.isArray(c.photos) ? c.photos : [],
}));

export const tracks = (await load('/data/tracks.json', [])).map((t) => ({
  note: '', src: null, ...t,
}));

/** Tiny markdown for chapter bodies: paragraphs, **bold**, *italic*. */
export function mdLite(text) {
  const esc = String(text || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')}</p>`)
    .join('');
}
