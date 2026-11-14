# Hijab Match

Phone-first web app: the user photographs each hijab once to build a closet, photographs an outfit, taps up to 3 pieces, and gets their hijabs ranked 3, 2 or 1 stars with a reason for each. Live at https://shanzayc.github.io/hijab-match/.

## Stack and layout

Plain JavaScript modules, HTML and CSS. No framework, no build step, no package.json. Hosted on GitHub Pages: pushing to `main` deploys.

- `app.js`: screens, closet and match flow, dialogs
- `picker.js`: photo canvas, tap and drag picking, Fix lighting
- `zoom.js`: zoom view for picking small details
- `color.js`: sRGB to CIELAB, k-means dominant colour, CIEDE2000
- `match.js`: ranking rules and star cutoffs
- `names.js`: colour names
- `storage.js`: the closet as one JSON array in localStorage
- `privacy.html`, `terms.html`: standalone pages

## Commands

- Run locally: `python3 -m http.server 5174`, then open http://localhost:5174 (modules need HTTP, not file://)
- Tests: `node --test tests/*.test.mjs`

## Rules

**Privacy is core.** Everything runs in the browser, there are no accounts, and photos never leave the device. The closet lives in localStorage; outfit photos are never stored. Never add anything that uploads images or sends user data to a server. The only external requests are GitHub Pages and Google Fonts; if that changes, update privacy.html.

**Colour difference is CIEDE2000** (`deltaE2000` in color.js), not straight-line LAB distance (CIE76), which put navy closer to burgundy than to royal blue. It passes the 14 published Sharma, Wu and Dalal test pairs in tests/color.test.mjs. Don't replace or simplify it.

**Two ways to pick a colour; keep both.**
- Normal tap: a 10 px circle (or a dragged box) on the 400 px work copy. `dominantColour` runs k-means (k = 3) and returns the largest cluster, so shadows, folds and glare are ignored.
- Zoom view: a small circle on the 1600 px detail copy, returning the cluster nearest the tapped pixel, so a tiny detail like a dot in a pattern wins over its background.

**Fix lighting is a manual white balance.** The user taps something white; each colour channel is scaled so that spot becomes neutral, all three copies are rebuilt from the originals, and existing picks are re-read. Manual on purpose: automatic white balance assumes the photo averages to grey, which fails when a colourful outfit fills the frame.

**Ranking rules were tuned from real tests** (see DECISIONS.md and TESTING.md):
- A hijab can't be much more colourful (chroma) than the piece it matches (`MAX_LOUDER`), and loud hijabs lose points (`LOUD_CHROMA`).
- Neutrals, including dark ones like navy and brown, only score when they echo something in the outfit.
- Opposite colours are capped at 2 stars and need one of the two to be muted.
- "Pop of colour" points only when the whole outfit is neutral, and only for muted colours.
- Known open issue: black gets 2 stars with every outfit as a fallback (`scoreOutfitLevel`), too generous for colourful outfits.

**Tests.** tests/matching.test.mjs encodes the 9 outfits from round 1 of real testing (which hijabs I liked and rejected for each). Run the tests after any change to colour maths or ranking. Never change a test's expected result just to make it pass; tell me instead.

**Cache busting.** Before pushing a change to any app file, bump the version string (like `2026-11-06.2`) everywhere it appears: in index.html on style.css, in the import map and on app.js, and on style.css in privacy.html and terms.html. Phones then load the new files together instead of mixing in cached old ones.

**In the wash is half-built.** match.js skips hijabs with `inWash: true` and app.js has a message for it, but there's no toggle in the UI; every hijab is saved with `inWash: false`.

## Docs

- README.md: overview, screenshots, contact
- DECISIONS.md: reasoning behind the main choices
- TESTING.md: method, both test rounds, issues and fixes
- TEST-LOG.md: my raw test notes, kept in my own words

When a change affects a design decision or a test result, update the relevant doc.

## How to work here

- Before coding, write a short plan and wait for my OK on anything that changes ranking rules, colour maths, or what the user sees.
- Make small, reviewable changes and explain what you changed and why.
- If you're unsure how something works, read the code or ask me; don't guess.
- Commit straight to main, with no co-author lines.
