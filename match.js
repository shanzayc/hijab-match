// Rank the hijabs in a closet against the colours of an outfit.
//
// Every hijab is compared with every outfit piece using a set of colour
// rules. Each rule that applies gives a score out of 100; a hijab keeps
// its best score across all pieces, plus a small bonus when it also
// works with the other pieces. The score sets its star rating and the
// winning rule supplies the one-line reason.
//
// Colours are compared in LCh, a polar form of CIELAB:
//   L = lightness (0 black to 100 white)
//   C = chroma, how colourful it is (near 0 for black, white, grey)
//   h = hue angle on the colour wheel, in degrees
//
// The rules were tuned against real outfit tests (see TESTING.md). The
// main lessons: a hijab much louder than the outfit looks wrong even
// when the colour-wheel maths says it fits; and neutrals, including dark
// ones like navy and brown, only work when they echo something in the
// outfit.

import { deltaE2000 } from "./color.js";
import { suggestName } from "./names.js";

// Below this chroma a colour has no reliable hue (black, white, grey).
const NEUTRAL_CHROMA = 12;

// A hijab may be at most this much more colourful (chroma) than the
// piece it's matched to before it reads as clashing.
const MAX_LOUDER = 25;
// Above this chroma a hijab is loud (neon orange, royal blue) and loses
// points on every rule except an exact colour match.
const LOUD_CHROMA = 55;

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
// beige, cream, sand and nude. They have no reliable hue, so the
// colour-wheel rules skip them.
export function isNeutral(lab) {
  const { L, C, h } = toLch(lab);
  if (C < NEUTRAL_CHROMA) return true;
  return C < 24 && L >= 62 && h >= 50 && h <= 100;
}

// Dark, muted colours such as navy, charcoal and chocolate brown. Their
// hue is too faint to judge on the colour wheel, so they're treated like
// neutrals: good when they echo the outfit, otherwise left out.
function isDarkNeutral(lab) {
  const { L, C } = toLch(lab);
  return L < 30 && C < 25;
}

function isBlack(lab) {
  const { L, C } = toLch(lab);
  return L < 25 && C < NEUTRAL_CHROMA;
}

// Points lost for being loud. Exact matches are exempt.
function loudness(c) {
  return Math.max(0, c - LOUD_CHROMA) * 0.6;
}

// Score one hijab against one outfit piece. Returns the best colour
// rule that applies as { score, reason }, or null when none does.
// strongColours = how many outfit pieces are strongly coloured; several
// usually means a print. Rules that depend on the whole outfit live in
// scoreOutfitLevel.
function scorePair(hijab, piece, strongColours) {
  const hj = toLch(hijab.lab);
  const pc = toLch(piece.lab);
  const name = piece.name;
  const dE = deltaE2000(hijab.lab, piece.lab);
  const hueless = (lab) => isNeutral(lab) || isDarkNeutral(lab);
  const onWheel = !hueless(hijab.lab) && !hueless(piece.lab);
  const gap = hueGap(hj.h, pc.h);
  const dL = hj.L - pc.L;
  const louder = hj.C - pc.C;
  const loud = loudness(hj.C);
  const candidates = [];

  // Tonal: practically the same colour.
  if (dE < 10) {
    candidates.push({ score: 100 - dE * 1.5, reason: `Matches the ${name} in your outfit` });
  }

  if (onWheel && louder <= MAX_LOUDER) {
    // Shades: same colour family, clearly lighter or darker.
    // A shade can be quieter than the original but not much brighter.
    if (gap <= 20 && Math.abs(dL) >= 15 && Math.abs(dL) <= 40 && louder <= 10) {
      candidates.push({
        score: 86 - gap * 0.5 - loud,
        reason: `A ${dL > 0 ? "lighter" : "darker"} shade of the ${name} in your outfit`,
      });
    }

    // Analogous: neighbours on the colour wheel. Two strong colours that
    // nearly match but don't (neon orange with a burnt orange top) are a
    // near-miss, which looks like a mistake rather than a choice. In a
    // busy print, picking up one of its colours loosely is fine.
    const nearMiss = dE >= 10 && gap < 15 && hj.C > 40 && pc.C > 40 && strongColours <= 1;
    if (gap <= 45 && !nearMiss) {
      candidates.push({ score: 70 - gap * 0.4 - loud, reason: `Sits next to the ${name} on the colour wheel` });
    }

    // Complementary: opposite sides of the wheel. A bold choice, so it's
    // capped at 2 stars, and only when one of the two colours is muted;
    // two strong opposites (teal and orange) clash.
    if (gap >= 150 && Math.min(hj.C, pc.C) < 40) {
      candidates.push({ score: 56 - (180 - gap) * 0.5 - loud, reason: `A bold contrast with the ${name} in your outfit` });
    }
  }

  // Soft pairing: two light, muted colours (nude with baby blue).
  if (!isNeutral(hijab.lab) && hj.L >= 60 && pc.L >= 60 && hj.C < 35 && pc.C < 35 && dE >= 10) {
    candidates.push({ score: 58, reason: `A soft colour that sits well with the ${name} in your outfit` });
  }

  // A neutral hijab that echoes this piece. Light neutrals echo a
  // close colour, a neutral of similar lightness (grey with grey jeans),
  // or, for warm neutrals, a muted piece in the same colour family
  // (taupe with a brown bag, sand with camel). Dark neutrals echo a close colour or a piece in the
  // same colour family (chocolate brown with a burnt orange top). Black
  // pieces don't count: they're small details as often as main pieces.
  if (!isBlack(hijab.lab) && !isBlack(piece.lab)) {
    const warm = hj.C >= 5; // taupe, sand and nude carry a little colour
    const lightEcho =
      isNeutral(hijab.lab) &&
      (dE < 15 ||
        (isNeutral(piece.lab) && Math.abs(dL) < 25) ||
        (warm && !hueless(piece.lab) && pc.C < 40 && gap <= 30));
    const darkEcho = isDarkNeutral(hijab.lab) && (dE < 15 || (!hueless(piece.lab) && gap <= 30));
    if (lightEcho || darkEcho) {
      candidates.push({ score: 62, reason: `A neutral that picks up the ${name} in your outfit` });
    }
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.score > best.score ? c : best));
}

// Rules that look at the outfit as a whole rather than one piece.
function scoreOutfitLevel(hijab, pieces) {
  const hj = toLch(hijab.lab);
  const candidates = [];

  // Black works with almost anything.
  if (isBlack(hijab.lab)) {
    candidates.push({ score: 62, reason: "Black works with almost anything" });
  }

  // An outfit that's all neutrals: a muted colour adds a soft pop of
  // colour. Loud colours are left out rather than offered as a stretch.
  const allNeutral = pieces.every((p) => isNeutral(p.lab) || isDarkNeutral(p.lab));
  if (allNeutral && !isNeutral(hijab.lab) && !isDarkNeutral(hijab.lab) && hj.C <= 40) {
    candidates.push({ score: 58, reason: "Adds a soft pop of colour to a neutral outfit" });
  }

  return candidates;
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
  const strongColours = pieces.filter((p) => toLch(p.lab).C > 40).length;

  return closet
    .filter((h) => !h.inWash)
    .map((hijab) => {
      const perPiece = pieces.map((p) => scorePair(hijab, p, strongColours)).filter(Boolean);
      const results = [...perPiece, ...scoreOutfitLevel(hijab, pieces)];
      if (results.length === 0) {
        return { hijab, score: 0, stars: 0, reason: "Doesn't go with these colours" };
      }
      results.sort((a, b) => b.score - a.score);
      const best = results[0];
      // Small bonus for also working well with other pieces.
      const others = perPiece.filter((r) => r !== best && r.score >= STAR_CUTOFFS[2]).length;
      const score = Math.min(100, best.score + 5 * others);
      return { hijab, score, stars: starsFor(score), reason: best.reason };
    })
    .sort((a, b) => b.score - a.score);
}
