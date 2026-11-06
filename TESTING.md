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

**Caveat:** these numbers come from the same 9 outfits the rules were tuned on, so they're optimistic. Round 2 (below) adds new outfits.

## Round 2 results (after tuning)

Same closet, same method, 8 outfits: 4 new ones the rules were never tuned on, and 4 repeats of round 1 photos for a before and after. I used Fix lighting on 6 of the 8.

| Measure | Round 1 | Round 2 | Round 2, new outfits only |
| --- | --- | --- | --- |
| Outfits tested | 9 | 8 | 4 |
| Top pick: My choice | 4 | 7 | 4 |
| Top pick: Would consider | 5 | 1 | 0 |
| Top pick: Wrong | 0 | 0 | 0 |
| **Pass rate (target 80%)** | 9 of 9 (100%) | **8 of 8 (100%)** | **4 of 4 (100%)** |
| My real choice got 2+ stars | 9 of 9 | 8 of 8 | 4 of 4 |
| **Hijabs I wouldn't wear in the results** | 23 at 2 to 3 stars (about 3 per outfit) | **7 at 2 stars (under 1 per outfit)** | 3 |
| Issues logged | 7 | 5 | |

In round 2 I counted the hijabs I wouldn't wear in the 2-star group; the 3-star picks were all ones I'd wear or consider.

**The main finding:** the app now narrows the closet down instead of approving everything. The top pick went from mostly "Would consider" to "My choice" for 7 of 8 outfits. On a busy black, green and beige dress it recommended only 3 of 15 hijabs, all good ones, and for a hot pink dress it marked 11 of 15 as not a match.

On the 4 repeated outfits, hijabs I wouldn't wear went from 13 to 4. The navy dress with the chartreuse drape, which the app misread in round 1, went from 4 to none with Fix lighting.

## Round 2 outfit tests

| # | Outfit | Lighting | Fix lighting | App's top pick (stars) | Verdict | My real choice (stars) | At 2 stars, I wouldn't wear |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Repeat of round 1 #1: black and red hoodie, grey sweatpants | Daylight | Yes | Dusty rose, nude (3) | Would consider | Black (2) | 3 of 5 |
| 2 | New: mustard yellow dress, small silver and pink details | Indoor | Yes | Light grey, taupe (3) | My choice | Taupe (3) | 2 (black, chocolate plum) |
| 3 | Repeat of round 1 #9: navy dress, chartreuse drape | Indoor | Yes | Sand, light grey, stone, navy, taupe (3) | My choice | Navy or sand (3) | 0 |
| 4 | Repeat of round 1 #7: hot pink dress | Indoor | Yes | Black, burgundy (3) | My choice | Black (3) | 1 (maroon) |
| 5 | Repeat of round 1 #5: burnt orange top, grey jeans | Indoor | Yes | Taupe, sand, terracotta, stone, black, nude (2) | My choice | Taupe (2) | 0 |
| 6 | New: black dress with dark green, light green and beige | Daylight | No | Black (3) | My choice | Black (3), would also wear sand and taupe | 0 |
| 7 | New: hot pink and mustard dress, orange and light pink details | Indoor | No | Nude, dusty rose, sand, terracotta, burgundy (3) | My choice | Nude or sand (3) | 1 (black) |
| 8 | New: all grey, silver details | Indoor | Yes | Light grey, stone/olive green (3) | My choice | Light grey (3) | 0 |

## Round 2 issues

| # | Outfit | What happened | What I expected |
| --- | --- | --- | --- |
| 8 | 2, 5, 7 | Black recommended with colourful outfits I wouldn't wear it with | Black ranked lower: it goes with a lot, but it isn't the best choice |
| 9 | 2 | Nude and dusty rose were only 2 stars | One of them in the top picks |
| 10 | 1 | Light grey was only 1 star, next to teal | Light grey higher; I wouldn't wear teal |
| 11 | 6 | Teal was not a match | Teal could have been a match |
| 12 | 8 | Navy was not a match for an all grey outfit | Navy as a match |

**What's next:** black gets 2 stars with every outfit as a safe fallback, which is too generous for colourful outfits (issue 8, three outfits). The fix would be to keep that only for outfits that contain black or are mostly neutral. Issues 9 to 12 are one-offs, so I'm watching for them to repeat before changing the rules.

**Caveat:** this is a small test (8 outfits, 4 of them new) judged only by me, so it shows the app works for my closet and taste, not for everyone.
