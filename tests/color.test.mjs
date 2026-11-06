// Colour conversion, CIEDE2000 and dominant-colour tests.
// Run all tests with: node --test tests/*.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { rgbToLab, labToRgb, labToHex, deltaE2000, dominantColour } from "../color.js";

const near = (got, want, tol) =>
  got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= tol, `${got} vs ${want}`));

test("sRGB to CIELAB matches reference values (D65)", () => {
  near(rgbToLab(255, 255, 255), [100, 0, 0], 0.01);
  near(rgbToLab(0, 0, 0), [0, 0, 0], 0.01);
  near(rgbToLab(255, 0, 0), [53.24, 80.09, 67.2], 0.05);
  near(rgbToLab(0, 255, 0), [87.73, -86.18, 83.18], 0.05);
  near(rgbToLab(0, 0, 255), [32.3, 79.19, -107.86], 0.05);
  near(rgbToLab(128, 128, 128), [53.59, 0, 0], 0.05);
});

test("LAB round trip loses nothing", () => {
  let worst = 0;
  for (let r = 0; r < 256; r += 17)
    for (let g = 0; g < 256; g += 17)
      for (let b = 0; b < 256; b += 17) {
        const back = labToRgb(rgbToLab(r, g, b));
        worst = Math.max(worst, Math.abs(back[0] - r), Math.abs(back[1] - g), Math.abs(back[2] - b));
      }
  assert.ok(worst <= 1, `worst channel error ${worst}`);
  assert.equal(labToHex(rgbToLab(201, 143, 155)), "#c98f9b");
});

// Pairs from Sharma, Wu and Dalal (2005), the published CIEDE2000 test data.
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [61, -5, 29], 22.8977],
  [[50, 2.5, 0], [56, -27, -3], 31.903],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
  [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
];

test("CIEDE2000 matches all 14 published reference pairs", () => {
  for (const [p, q, want] of SHARMA) {
    assert.ok(Math.abs(deltaE2000(p, q) - want) < 1e-4, `${p} / ${q}`);
    assert.ok(Math.abs(deltaE2000(q, p) - want) < 1e-4, "symmetric");
  }
  assert.equal(deltaE2000([50, 10, 10], [50, 10, 10]), 0);
});

const px = (list) => {
  const a = new Uint8ClampedArray(list.length * 4);
  list.forEach((c, i) => a.set([...c, 255], i * 4));
  return a;
};
const fill = (c, n) => Array.from({ length: n }, () => c);

test("dominant colour ignores shadows and glare", () => {
  const sample = px([...fill([201, 143, 155], 300), ...fill([110, 70, 80], 72), ...fill([252, 252, 252], 28)]);
  assert.ok(deltaE2000(dominantColour(sample), rgbToLab(201, 143, 155)) < 1);
  assert.equal(labToHex(dominantColour(px([...fill([18, 18, 20], 200), ...fill([60, 60, 64], 40)]))), "#121214");
  assert.equal(dominantColour(new Uint8ClampedArray(0)), null);
});

test("a precise pick keeps the tapped colour, not the most common one", () => {
  const sample = px([...fill([245, 245, 242], 70), ...fill([40, 80, 200], 30)]);
  assert.equal(labToHex(dominantColour(sample)), "#f5f5f2");
  assert.equal(labToHex(dominantColour(sample, { centre: rgbToLab(40, 80, 200) })), "#2850c8");
});
