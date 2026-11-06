// Matching tests built from real-world testing (Round 1, see TESTING.md).
//
// The closet is 15 real hijabs, recorded as the colours the app read
// (two of those readings are known to be off: an olive read as cream,
// and a chocolate plum read too purple). Outfit colours are close
// approximations of the photos. For each outfit, "liked" and
// "rejected" come from the tester's own notes.

import test from "node:test";
import assert from "node:assert/strict";
import { rgbToLab } from "../color.js";
import { rankCloset } from "../match.js";

const lab = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
};

const CLOSET = [
  ["chocolate plum", "#5e2a3c"], ["teal", "#1f7b7b"], ["light grey", "#c6c6c6"], ["olive (read as cream)", "#ece0c4"],
  ["navy", "#1f2a44"], ["taupe", "#8a7b6a"], ["nude", "#d4ae96"], ["dusty rose", "#c98f9b"], ["black", "#1a1a1a"],
  ["chocolate brown", "#4b3226"], ["burgundy", "#6e2233"], ["sand", "#c8b089"], ["orange", "#f07a28"],
  ["royal blue", "#2b50c8"], ["terracotta", "#c06a4b"],
].map(([name, hex], i) => ({ id: String(i), name, hex, lab: lab(hex) }));

const OLIVE = "olive (read as cream)";
const OUTFITS = [
  { n: 1, pieces: ["#1a1a1a", "#b8202c", "#8f8f8f"], liked: ["black", "light grey"], rejected: ["orange", "teal", "royal blue"] },
  { n: 2, pieces: ["#4a3226", "#1a1a1a", "#6b4a32"], liked: ["black", "chocolate brown", "taupe", "terracotta"], rejected: ["teal", "orange"] },
  { n: 3, pieces: ["#b5b5b5", "#c8c8c8", "#1a1a1a"], liked: ["light grey", OLIVE, "dusty rose", "burgundy"], rejected: ["orange"] },
  { n: 4, pieces: ["#22304f", "#8fa9c9", "#6e2233"], liked: ["navy", "burgundy"], rejected: ["royal blue", "sand", "chocolate brown", "orange"] },
  { n: 5, pieces: ["#c4571f", "#8a8a8a"], liked: ["chocolate brown", "taupe"], rejected: ["orange", "teal", "royal blue"] },
  { n: 6, pieces: ["#2f6fd8", "#ee7f2e", "#3dbfb4"], liked: ["terracotta", "royal blue"], rejected: [] },
  { n: 7, pieces: ["#e0428a", "#1a1a1a"], liked: ["black", "burgundy"], rejected: [OLIVE, "light grey", "chocolate plum", "navy", "chocolate brown", "orange", "teal", "royal blue", "taupe"] },
  { n: 8, pieces: ["#a8c8e8", "#c8b089"], liked: ["nude", "dusty rose", OLIVE, "taupe"], rejected: ["chocolate brown", "orange", "burgundy"] },
  // The drape was chartreuse but was read as camel under indoor light.
  { n: 9, pieces: ["#1f2a44", "#c0c0c0", "#b6875a"], liked: ["navy", "taupe", "sand"], rejected: ["chocolate brown", "royal blue", "terracotta", "orange", "burgundy", "teal"] },
];

function run(outfit) {
  const ranked = rankCloset(CLOSET, outfit.pieces.map(lab));
  const stars = Object.fromEntries(ranked.map((r) => [r.hijab.name, r.stars]));
  return { ranked, stars };
}

test("the top pick is never a hijab the tester rejected", () => {
  for (const o of OUTFITS) {
    const { ranked } = run(o);
    assert.ok(!o.rejected.includes(ranked[0].hijab.name), `outfit ${o.n}: top pick ${ranked[0].hijab.name}`);
  }
});

test("every hijab the tester liked gets at least 2 stars", () => {
  for (const o of OUTFITS) {
    const { stars } = run(o);
    for (const h of o.liked) assert.ok(stars[h] >= 2, `outfit ${o.n}: ${h} got ${stars[h]}`);
  }
});

test("rejected hijabs rarely reach 2 or 3 stars (was 21 of 31 before tuning)", () => {
  let count = 0;
  for (const o of OUTFITS) {
    const { stars } = run(o);
    count += o.rejected.filter((h) => stars[h] >= 2).length;
  }
  // The 3 that remain are all caused by colours the app misread, not by
  // the ranking (see the next test).
  assert.ok(count <= 3, `${count} rejected hijabs at 2-3 stars`);
});

test("with the drape's true colour, outfit 9 has no rejected hijab at 2+ stars", () => {
  const o = { ...OUTFITS[8], pieces: ["#1f2a44", "#c0c0c0", "#a9b836"] };
  const { stars } = run(o);
  assert.deepEqual(o.rejected.filter((h) => stars[h] >= 2), []);
});

test("the list is selective: on average under 9 of 15 hijabs get stars (was 15)", () => {
  const total = OUTFITS.reduce((sum, o) => sum + run(o).ranked.filter((r) => r.stars > 0).length, 0);
  assert.ok(total / OUTFITS.length < 9, `average ${(total / OUTFITS.length).toFixed(1)}`);
});

test("general cases still hold", () => {
  const top = (pieces) => run({ pieces }).ranked[0];
  assert.equal(top(["#22304f"]).hijab.name, "navy", "navy top -> navy hijab");
  assert.equal(top(["#151515"]).hijab.name, "black", "all black -> black hijab");
  const greyOutfit = run({ pieces: ["#9a9a9a", "#d0d0d0"] }).stars;
  assert.equal(greyOutfit.orange, 0, "a loud colour isn't offered with an all-grey outfit");
  assert.ok(greyOutfit["dusty rose"] >= 2, "a soft colour is offered with an all-grey outfit");
  const inWash = rankCloset([{ ...CLOSET[4], inWash: true }], [lab("#22304f")]);
  assert.equal(inWash.length, 0, "hijabs in the wash are skipped");
});
