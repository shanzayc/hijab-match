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
export function dominantColour(rgba, { k = 3, iterations = 10 } = {}) {
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

  if (points.length <= k) return mean(points);

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
