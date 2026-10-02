// Rank the hijabs in a closet against the colours of an outfit.
//
// Every hijab is compared with every outfit piece using five colour
// rules. Each rule that applies gives a score out of 100; a hijab keeps
// its best score across all pieces, plus a small bonus when it also
// works with the other pieces. The score sets its star rating and the
// winning rule supplies the one-line reason.
//
// Colours are compared in LCh, a polar form of CIELAB:
//   L = lightness (0 black to 100 white)
//   C = chroma, how colourful it is (near 0 for black, white, grey)
//   h = hue angle on the colour wheel, in degrees

import { deltaE2000 } from "./color.js";
import { suggestName } from "./names.js";

// Below this chroma a colour has no reliable hue (black, white, grey).
const NEUTRAL_CHROMA = 12;

// Star cut-offs, to be tuned on Day 5 with real photos.
export const STAR_CUTOFFS = { 3: 75, 2: 55, 1: 35 };

function toLch([L, a, b]) {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

// Smallest angle between two hues, 0 to 180.
function hueGap(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

// Neutrals: black, white, greys, plus soft light neutrals such as
// beige, cream and sand. They have no reliable hue, so the colour-wheel
// rules skip them, and they go with almost anything.
export function isNeutral(lab) {
  const { L, C, h } = toLch(lab);
  if (C < NEUTRAL_CHROMA) return true;
  return C < 24 && L >= 62 && h >= 50 && h <= 100;
}

// Dark, muted colours such as navy, charcoal and chocolate brown. They
// do have a hue, so the colour-wheel rules still use it, but they also
// act like neutrals and go with most colours.
function isDarkNeutral(lab) {
  const { L, C } = toLch(lab);
  return L < 25 && C < 25;
}

// Score one hijab against one outfit piece. Returns the best rule that
// applies as { score, reason }, or null when none does.
function scorePair(hijab, piece) {
  const hj = toLch(hijab.lab);
  const pc = toLch(piece.lab);
  const name = piece.name;
  const dE = deltaE2000(hijab.lab, piece.lab);
  const hijabNeutral = isNeutral(hijab.lab);
  const pieceNeutral = isNeutral(piece.lab);
  const bothColourful = !hijabNeutral && !pieceNeutral;
  const gap = hueGap(hj.h, pc.h);
  const dL = hj.L - pc.L;
  const candidates = [];

  // Tonal: practically the same colour.
  if (dE < 10) {
    candidates.push({ score: 100 - dE * 1.5, reason: `Matches the ${name} in your outfit` });
  }

  // Shades: same colour family, clearly lighter or darker.
  if (bothColourful && gap <= 20 && Math.abs(dL) >= 15 && Math.abs(dL) <= 40) {
    candidates.push({
      score: 86 - gap * 0.5,
      reason: `A ${dL > 0 ? "lighter" : "darker"} shade of the ${name} in your outfit`,
    });
  }

  // Complementary: opposite sides of the colour wheel.
  if (bothColourful && gap >= 150) {
    candidates.push({ score: 80 - (180 - gap) * 0.5, reason: `Complements the ${name} in your outfit` });
  }

  // Analogous: neighbours on the colour wheel.
  if (bothColourful && gap <= 45) {
    candidates.push({ score: 72 - gap * 0.4, reason: `Sits next to the ${name} on the colour wheel` });
  }

  // Neutral hijab: safe with almost anything.
  if (hijabNeutral) {
    candidates.push({ score: 62, reason: "A neutral, works with anything" });
  } else if (isDarkNeutral(hijab.lab)) {
    candidates.push({ score: 58, reason: "A dark neutral, goes with most colours" });
  }

  // Neutral outfit piece: any colourful hijab adds a pop of colour.
  if (pieceNeutral && !hijabNeutral) {
    candidates.push({ score: 45, reason: `Adds colour to the ${name} in your outfit` });
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.score > best.score ? c : best));
}

export function starsFor(score) {
  if (score >= STAR_CUTOFFS[3]) return 3;
  if (score >= STAR_CUTOFFS[2]) return 2;
  if (score >= STAR_CUTOFFS[1]) return 1;
  return 0;
}

// closet: saved hijabs ({ id, name, lab, ... }).
// outfitLabs: the LAB colours of 1 to 3 outfit pieces.
// Returns every hijab not in the wash, best first:
//   [{ hijab, score, stars, reason }]
export function rankCloset(closet, outfitLabs) {
  const pieces = outfitLabs.map((lab) => ({ lab, name: suggestName(lab) }));

  return closet
    .filter((h) => !h.inWash)
    .map((hijab) => {
      const results = pieces.map((p) => scorePair(hijab, p)).filter(Boolean);
      if (results.length === 0) {
        return { hijab, score: 0, stars: 0, reason: "Doesn't go with these colours" };
      }
      results.sort((a, b) => b.score - a.score);
      const [best, ...rest] = results;
      // Small bonus for also working well with the other pieces.
      const bonus = 5 * rest.filter((r) => r.score >= STAR_CUTOFFS[2]).length;
      const score = Math.min(100, best.score + bonus);
      return { hijab, score, stars: starsFor(score), reason: best.reason };
    })
    .sort((a, b) => b.score - a.score);
}
