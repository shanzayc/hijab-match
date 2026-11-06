# Testing

How I checked that Hijab Match gives useful recommendations, what the testing found, and what changed because of it.

## Method

I added my 15 real hijabs to the app, then tested 9 outfit photos from my camera roll (plain, patterned, neutral and colourful, in daylight and indoor light). For each outfit I decided which hijab I'd actually wear **before** looking at the app's results, then judged the app's top pick:

- **My choice:** the hijab I'd have picked, or just as good
- **Would consider:** not my first pick, but I'd wear it
- **Wrong:** I wouldn't wear it with this outfit

The success target, set before testing: the top pick passes (My choice or Would consider) for at least 80% of outfits. I also wrote down every hijab in the results that I wouldn't wear.

## Round 1 results (before tuning)

| Measure | Round 1 |
| --- | --- |
| Outfits tested | 9 |
| Top pick: My choice | 4 |
| Top pick: Would consider | 5 |
| Top pick: Wrong | 0 |
| **Pass rate (target 80%)** | **9 of 9 (100%)** |
| My real choice got 2+ stars | 9 of 9 |
| **Hijabs at 2 to 3 stars I wouldn't wear** | **23 across 8 outfits** (about 3 per outfit) |
| Hijabs whose saved colour looked wrong | 1 wrong (olive read as cream), 3 close |
| Issues logged | 7 |

**The main finding:** the top pick worked every time, but the target measured the wrong thing. Below the top pick, every one of my 15 hijabs got at least 1 star for almost every outfit, and about 3 per outfit that I'd never wear got 2 or 3 stars. The app only confirmed the obvious, which isn't useful.

## Outfit tests

| # | Outfit | Lighting | App's top pick (stars) | Verdict | My real choice (stars) | At 2 to 3 stars, I wouldn't wear |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Black and red hoodie, grey sweatpants | Daylight | Light grey (3) | Would consider | Black (3) | 2 (orange, teal) |
| 2 | Dark brown coat, black pants, brown bag | Indoor | Black (3) | My choice | Black (3) | 2 (teal, orange) |
| 3 | Light grey jeans, light grey sweater, black shirt | Indoor | Olive green (3) | Would consider | Light grey (2) | 1 (orange) |
| 4 | Navy top, light blue jeans, burgundy shirt | Daylight | Navy (3) | My choice | Navy or burgundy (3) | 4 (royal blue, sand, chocolate brown, orange) |
| 5 | Burnt orange top, grey jeans | Indoor | Chocolate brown (3) | Would consider | Taupe (2) | 2 (orange, teal) |
| 6 | Patterned top: bright blue, orange, turquoise | Daylight | Terracotta (3) | Would consider | Royal blue (2) | Not noted |
| 7 | Hot pink dress, black details | Indoor | Black (3) | My choice | Black or burgundy (3) | 5 (olive green, light grey, chocolate plum, navy, brown) |
| 8 | Baby blue dress, beige and gold details | Indoor | Olive green (3) | Would consider | Nude (3) | 3 (chocolate brown, orange, burgundy) |
| 9 | Navy dress, silver details, chartreuse drape | Indoor | Navy (3) | My choice | Navy (3) | 4 (brown, royal blue, terracotta, orange) |

## Issues found

| # | Outfit | Type | What happened |
| --- | --- | --- | --- |
| 1 | 2 | Ranking | Neon orange recommended |
| 2 | Several | Hard to use | Zoom: hard to tap the exact spot, the circles were tiny |
| 3 | Several | Ranking | All 15 hijabs were at least 1-star options, too generous |
| 4 | Several | Hard to use | Scrolling and zooming was difficult |
| 5 | n/a | Colour reading | Olive green hijab read as cream (likely indoor light) |
| 6 | n/a | Hard to use | In the zoom view, you couldn't remove a wrong pick without leaving it |
| 7 | 9 | Colour reading | Chartreuse drape read as camel, so the reason "matches the camel in your outfit" was wrong |

## What changed

The patterns behind the bad suggestions, and the fix for each:

| Pattern in my notes | Fix |
| --- | --- |
| Bright hijabs (neon orange, royal blue) suggested with muted outfits | A hijab can't be much more colourful than the piece it matches, and very bright hijabs lose points |
| "Adds colour to the grey/black in your outfit" put every hijab on the list | Only for outfits that are all neutral, and only for softer colours |
| Teal "complements" a brown coat; teal and orange suggested together | Dark muted colours (brown, navy) are treated as neutrals; opposite colours are capped at 2 stars and need one of them to be muted |
| Royal blue called a "shade" of navy | A shade can be darker or lighter, but not much brighter |
| Neon orange with a burnt orange top | Two strong colours that nearly match look like a mistake; skipped for solid outfits (fine within a busy print) |
| Light neutrals and navy/brown suggested with a hot pink dress | Neutrals only score well when they echo something in the outfit (grey with grey jeans, taupe with a brown bag) |
| Olive read as cream, chartreuse as camel | New **Fix lighting** button: tap something white in the photo to correct the colours |
| Tiny zoom circles; couldn't undo in zoom | Bigger marks in the zoom view; tap a mark again to remove it |

## Effect on the same 9 outfits

My 9 outfits are now automated tests (`tests/matching.test.mjs`), so every change is checked against what I actually said.

| Measure | Before tuning | After tuning |
| --- | --- | --- |
| Top pick not a hijab I rejected | 9 of 9 | 9 of 9 |
| Hijabs I rejected that got 2 to 3 stars | 21 of 31 | 3 of 31 |
| Hijabs I rejected that got any stars | 31 of 31 | 6 of 31 |
| Hijabs I liked that got under 2 stars | 3 of 25 | 0 of 25 |
| Hijabs with stars, per outfit | 15 of 15 | 8.4 of 15 |

The 3 rejected hijabs still at 2 or 3 stars are all caused by colours the app read wrong (the chartreuse drape read as camel, and a chocolate plum hijab saved too purple), which is what Fix lighting addresses. With the drape's true colour, outfit 9 has none.

**Caveat:** these numbers come from the same 9 outfits the rules were tuned on, so they're optimistic. Round 2 (below) uses new outfits.

## Round 2

To do: re-take the olive and sage hijabs in daylight, then test new outfits, especially colourful ones, with the same method.
