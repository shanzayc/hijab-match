// Colour conversion and dominant-colour extraction.
//
// Colours are compared in CIELAB rather than RGB because distance in
// LAB roughly matches how different two colours look to a person.
// L is lightness (0 to 100), a runs green to red, b runs blue to yellow.

// D65 white point, the standard for sRGB screens and photos.
const WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };

// Pixels brighter than this are treated as glare and ignored.
// Dark pixels are kept so black hijabs still work.
const GLARE_L = 97;

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

function labF(t) {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

function labFInverse(t) {
  return t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
}

export function rgbToLab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / WHITE.x;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / WHITE.y;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / WHITE.z;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const x = labFInverse(fx) * WHITE.x;
  const y = labFInverse(fy) * WHITE.y;
  const z = labFInverse(fz) * WHITE.z;

  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

export function labToHex(lab) {
  return "#" + labToRgb(lab).map((c) => c.toString(16).padStart(2, "0")).join("");
}

function distanceSq(p, q) {
  return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
}

// Find the dominant colour of a set of RGBA pixels (a Uint8ClampedArray
// as returned by getImageData). Runs k-means with k = 3 in LAB space and
// returns the centre of the largest cluster, so a few shadow or
// highlight pixels don't pull the result away from the fabric colour.
//
// With `centre` (the LAB colour of the exact pixel tapped), it returns
// the cluster closest to that colour instead. Zoomed-in picks use this:
// there the person is pointing at one small detail, such as a dot in a
// pattern, which may not be the most common colour in the sample.
export function dominantColour(rgba, { k = 3, iterations = 10, centre = null } = {}) {
  const all = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // skip transparent pixels
    all.push(rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]));
  }
  if (all.length === 0) return null;

  // Drop glare, unless the whole selection is that bright (a white hijab
  // in strong light), in which case glare is the colour.
  const lit = all.filter((p) => p[0] <= GLARE_L);
  const points = lit.length > 0 ? lit : all;

  if (points.length <= k) return centre ?? mean(points);

  // Seed the centres at evenly spaced lightness ranks. Unlike random
  // seeding, this gives the same answer every time for the same pixels.
  const byLightness = [...points].sort((p, q) => p[0] - q[0]);
  let centres = Array.from({ length: k }, (_, i) =>
    byLightness[Math.floor(((i + 0.5) / k) * byLightness.length)]
  );

  const assignment = new Int32Array(points.length);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = distanceSq(points[i], centres[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignment[i] !== best || iter === 0) changed = true;
      assignment[i] = best;
    }

    const next = Array.from({ length: k }, () => [0, 0, 0, 0]); // L, a, b, count
    for (let i = 0; i < points.length; i++) {
      const s = next[assignment[i]];
      s[0] += points[i][0];
      s[1] += points[i][1];
      s[2] += points[i][2];
      s[3]++;
    }
    // An empty cluster keeps its old centre.
    centres = next.map((s, c) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centres[c]));
    if (!changed) break;
  }

  if (centre) {
    let nearest = 0;
    for (let c = 1; c < k; c++) {
      if (distanceSq(centres[c], centre) < distanceSq(centres[nearest], centre)) nearest = c;
    }
    return centres[nearest];
  }

  const counts = new Array(k).fill(0);
  for (const c of assignment) counts[c]++;
  const largest = counts.indexOf(Math.max(...counts));
  return centres[largest];
}

function mean(points) {
  const sum = [0, 0, 0];
  for (const p of points) {
    sum[0] += p[0];
    sum[1] += p[1];
    sum[2] += p[2];
  }
  return sum.map((v) => v / points.length);
}

// CIEDE2000 colour difference: how different two LAB colours look.
// Below about 2 most people can't tell them apart. It corrects the
// simpler straight-line LAB distance, which overstates differences in
// saturated colours and handles blues poorly.
// Formula from Sharma, Wu and Dalal (2005).
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp /= 2;
    else hbarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;

  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
}
