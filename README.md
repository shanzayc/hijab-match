# Hijab Match

Recommends which hijab from your own collection best matches an outfit photo. A phone-first web app that uses the camera, needs no account, and keeps every photo on the device.

**Status:** in progress (Day 4 of 7). Build a closet of your hijabs, photograph an outfit, tap up to 3 pieces, and get your hijabs ranked 3, 2 or 1 stars with a reason for each.

**Live app:** <https://shanzayc.github.io/hijab-match/>

## Why I built this

Growing up, I always wore a black hijab. It went with everything, but it was also a way to hide. I built Hijab Match for girls who want to wear more than black and feel confident doing it: it finds the hijab in your own closet that pulls an outfit together, and sometimes suggests a colour you wouldn't have tried.

## How it works

1. Photograph each hijab once and tap the fabric. The app reads its colour and suggests a name.
2. Photograph an outfit and tap up to 3 pieces. Zoom in to pick a tiny detail, like a dot in a pattern.
3. Every hijab is scored against the outfit with colour rules (same colour, lighter or darker shade, complementary, neighbouring, neutral) and grouped into 3, 2 or 1 stars, each with a reason.

Everything runs in the browser. There's no account, and photos never leave the phone. The reasoning behind the main technical choices is in [DECISIONS.md](DECISIONS.md).

## Run locally

The app uses JavaScript modules, so it needs to be served over HTTP rather than opened as a file:

```bash
python3 -m http.server 5174
```

Then open <http://localhost:5174>.

## Deploying

Pushing to `main` updates the live site through GitHub Pages. Before pushing a change, update the version string in `index.html` (it appears on `style.css`, in the import map and on `app.js`). Phones then load the whole new set of files together instead of mixing in cached old ones.
