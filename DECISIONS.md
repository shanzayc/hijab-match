# Decisions

The main choices behind Hijab Match, and why I made them.

## 1. Measuring colour difference with CIEDE2000

**The question the app keeps asking:** how different do two colours look? For example, is this hijab the same colour as the top?

**The simple way** (the formula in my original plan, called CIE76) measures the straight-line distance between two colours. It's easy, but it doesn't match how people actually see colour. It's especially bad with blues.

**The example that convinced me:** with the simple formula, navy came out closer to burgundy than to royal blue. Anyone can see navy and royal blue are both blues. Blues are some of the most common hijab colours, so the app would have given wrong names and wrong matches.

**What I use instead:** CIEDE2000. It's the same idea with corrections added so it agrees with human eyes. It's the standard used for matching paint, fabric dye and printing. With it, navy comes out closest to royal blue, as it should.

**The trade-off:** it's about 50 lines of code instead of 1. It's also a little slower, but the app only does about 150 comparisons, so you can't notice it.

**How I know it works:** I tested my code against the official published test values for the formula. All 14 matched.

## 2. A zoom view for tiny details

**The problem:** a white dress with small blue dots. Even if you tap a dot perfectly, the app said "white". A normal tap reads a small circle of pixels and keeps the colour that fills most of it. The dot is smaller than that circle, so white wins.

**What I built:** a "Zoom in" button that opens the photo full screen at 1x to 4x. There, a tap does two things differently:
- It reads a much smaller spot, from a sharper copy of the photo (1600 px instead of 400 px), so tiny dots are still there.
- It keeps the colour right under your finger, not the most common one.

**Why not just make every tap precise?** For normal taps, "the most common colour" is what you want. It ignores shadows, folds and shiny spots. So normal taps stay forgiving, and zoom is for when you really mean one exact spot.

**How I know it works:** on a test photo of a white dress with blue dots, a normal tap on a dot gives white, and a zoomed tap on the same dot gives royal blue.

## 3. Tuning the matching rules from real tests

**The problem:** in my first real test (9 outfits, 15 hijabs), the top pick was always fine, but every hijab got at least 1 star for almost every outfit, and about 3 per outfit that I'd never wear got 2 or 3 stars. The app wasn't helping me choose. Details are in [TESTING.md](TESTING.md).

**What I learned from my notes:** the colour wheel isn't enough. A hijab that's much brighter than the outfit looks wrong even when the maths says the colours go together (neon orange with a burnt orange top). Neutrals, including dark ones like navy and brown, only work when they echo something in the outfit.

**What I changed:** a brightness limit on every colour-wheel rule, neutrals that must echo the outfit, opposite colours capped at 2 stars, and no "pop of colour" points unless the whole outfit is neutral.

**How I know it worked:** I turned my 9 outfits into automated tests. Rejected hijabs at 2 or 3 stars went from 21 to 3, liked hijabs below 2 stars from 3 to 0, and hijabs with stars per outfit from 15 to about 8. Since the rules were tuned on those same outfits, round 2 tests new ones.

## 4. Fixing colours from indoor lighting

**The problem:** photos taken under warm lamps shift every colour toward yellow and orange. My olive hijab was saved as cream, sage as sand, and a chartreuse drape read as camel, which then produced wrong matches.

**What I built:** a "Fix lighting" button. You tap something in the photo that should be white or light grey, like a wall or paper. The app measures how far off it is and rescales each colour channel so that spot becomes neutral, the same idea as a camera's white balance, then re-reads your picks.

**Why manual and not automatic:** automatic white balance guesses that the average of the photo is grey, which fails for exactly the photos this app sees: a colourful outfit filling the frame. One tap on something white is reliable.

**How I know it works:** on simulated lamp-lit photos, sage went from "khaki" to "sage", grey from "khaki" to "grey", navy from "black" to "navy", and a chartreuse drape from "yellow" to "chartreuse".
