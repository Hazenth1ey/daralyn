/**
 * The D&L monogram, redrawn as an inline SVG so it stays crisp at any size
 * and can be tinted for the dark theme. Mirrors the couple's logo: an open
 * ring, overlapping script initials, a leaf sprig climbing the right side,
 * and a small heart where the sprig meets the ring.
 */
export function logoSVG({ size = 200, className = '' } = {}) {
  return `
  <svg class="logo-mark ${className}" width="${size}" height="${size}" viewBox="0 0 200 200"
       fill="none" role="img" aria-label="Dara and Leakhena monogram">
    <!-- ring, broken where the sprig grows -->
    <path d="M 143 26
             A 84 84 0 1 0 176 128"
          stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    <!-- sprig stem -->
    <path d="M 128 30 C 158 42 178 74 179 112"
          stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <!-- leaves: pairs along the stem, drawn as petal shapes -->
    <g fill="currentColor">
      <path d="M133 26 C 140 12 152 6 162 6 C 158 18 148 27 136 29 Z"/>
      <path d="M147 36 C 158 26 170 24 179 27 C 172 38 160 43 149 41 Z"/>
      <path d="M161 51 C 174 45 186 47 193 53 C 184 61 171 62 162 56 Z"/>
      <path d="M170 69 C 184 66 195 71 200 79 C 190 84 177 82 170 74 Z"/>
      <path d="M176 91 C 189 91 198 98 201 107 C 190 109 179 104 175 96 Z"/>
    </g>
    <!-- heart at the sprig's foot -->
    <path d="M172 130 c -3 -4.5 -9 -3 -9 1.6 c 0 3.4 4.4 6.6 9 9.6 c 4.6 -3 9 -6.2 9 -9.6 c 0 -4.6 -6 -6.1 -9 -1.6 Z"
          fill="currentColor"/>
    <!-- script initials -->
    <text x="34" y="128" class="logo-d">D</text>
    <text x="82" y="158" class="logo-l">L</text>
  </svg>`;
}
