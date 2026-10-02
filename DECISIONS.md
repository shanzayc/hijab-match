# Decisions

The main choices behind Hijab Match, and why I made them.

## 1. Measuring colour difference with CIEDE2000

**The question the app keeps asking:** how different do two colours look? For example, is this hijab the same colour as the top?

**The simple way** (the formula in my original plan, called CIE76) measures the straight-line distance between two colours. It's easy, but it doesn't match how people actually see colour. It's especially bad with blues.

**The example that convinced me:** with the simple formula, navy came out closer to burgundy than to royal blue. Anyone can see navy and royal blue are both blues. Blues are some of the most common hijab colours, so the app would have given wrong names and wrong matches.

**What I use instead:** CIEDE2000. It's the same idea with corrections added so it agrees with human eyes. It's the standard used for matching paint, fabric dye and printing. With it, navy comes out closest to royal blue, as it should.

**The trade-off:** it's about 50 lines of code instead of 1. It's also a little slower, but the app only does about 150 comparisons, so you can't notice it.

**How I know it works:** I tested my code against the official published test values for the formula. All 14 matched.
