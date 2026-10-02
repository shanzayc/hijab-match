// Suggest a name for a hijab from its colour.
//
// The list uses names people actually use when shopping for hijabs and
// scarves, not paint-chart names, so "dusty rose" rather than "puce".
// Each name has a typical shade; the suggestion is the name whose shade
// looks closest (smallest CIEDE2000 difference) to the picked colour.

import { rgbToLab, deltaE2000 } from "./color.js";

const NAMED = [
  // Neutrals
  ["black", "#1a1a1a"],
  ["charcoal", "#3a3f44"],
  ["dark grey", "#5a5a5a"],
  ["grey", "#8f8f8f"],
  ["light grey", "#c6c6c6"],
  ["white", "#f8f8f6"],
  ["ivory", "#f2eddc"],
  ["cream", "#ece0c4"],
  ["beige", "#d8c6a6"],
  ["sand", "#c8b089"],
  ["stone", "#a59c8e"],
  ["taupe", "#8a7b6a"],
  ["nude", "#d4ae96"],
  ["camel", "#b6875a"],
  ["mocha", "#7a5c4a"],
  ["brown", "#734a2c"],
  ["chocolate brown", "#4b3226"],

  // Pinks and reds
  ["blush pink", "#efcac4"],
  ["baby pink", "#f5c3d0"],
  ["dusty rose", "#c98f9b"],
  ["rose pink", "#e07c98"],
  ["hot pink", "#e0428a"],
  ["fuchsia", "#c0266f"],
  ["magenta", "#cc3aa8"],
  ["mauve", "#a67c8e"],
  ["old rose", "#a0636a"],
  ["peach", "#f5c1a1"],
  ["salmon", "#ee907c"],
  ["coral", "#f0736a"],
  ["red", "#c62230"],
  ["burgundy", "#6e2233"],
  ["maroon", "#5b1f1f"],

  // Oranges, yellows and earth tones
  ["terracotta", "#c06a4b"],
  ["rust", "#a4462b"],
  ["burnt orange", "#cb5a20"],
  ["orange", "#ee7f2e"],
  ["mustard", "#c9a228"],
  ["yellow", "#f2d43c"],
  ["butter yellow", "#f5e6a2"],

  // Greens
  ["mint", "#b7e2c8"],
  ["sage", "#a2b089"],
  ["pistachio", "#c3d69b"],
  ["lime green", "#9bc53d"],
  ["khaki", "#a89c6b"],
  ["olive", "#6b6a30"],
  ["army green", "#4b5320"],
  ["green", "#3b8a49"],
  ["emerald", "#1e7a52"],
  ["bottle green", "#104d33"],
  ["teal", "#1f7b7b"],
  ["turquoise", "#3dbfb4"],
  ["petrol blue", "#1d4e5f"],

  // Blues
  ["baby blue", "#a8c8e8"],
  ["sky blue", "#7fb8e1"],
  ["dusty blue", "#7b93ab"],
  ["denim blue", "#4f6d8f"],
  ["cobalt blue", "#1f4fae"],
  ["royal blue", "#2b50c8"],
  ["bright blue", "#3f72e0"],
  ["navy", "#1f2a44"],

  // Purples
  ["lavender", "#b9aad9"],
  ["lilac", "#c9a8d8"],
  ["violet", "#8c62c8"],
  ["purple", "#6b3fa0"],
  ["plum", "#6c2f58"],
  ["aubergine", "#3f1f3a"],
].map(([name, hex]) => ({ name, lab: hexToLab(hex) }));

function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function suggestName(lab) {
  let best = NAMED[0];
  let bestDiff = Infinity;
  for (const entry of NAMED) {
    const diff = deltaE2000(lab, entry.lab);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best.name;
}
