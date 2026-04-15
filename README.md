# Tap Learn Universe

An educational game for children ages 3 and up. Two game modes — **Trace the Number** (number tracing) and **Drag the Letter** (alphabet letter matching) — build number recognition, letter recognition, and fine motor skills in a fun, colorful environment.

## How to Play

Open `index.html` in any modern web browser — no build step or server required. The game works best on a touch-screen device (phone or tablet) but also plays with a mouse on desktop. Use the mode bar at the top to switch between Numbers (123) and Alphabet (ABC).

## Game Modes

### Trace the Number

A large number appears on screen in bubble-letter style against a colorful candy-store background. Light gray dots mark the stroke of the number. A gold guide arrow floats just ahead of the player's position along each digit's path, showing the correct tracing direction. The child traces the number with their finger; dots pop away as they pass over them. When all dots are cleared, a celebration plays (confetti + sparkle sound) and the next number appears — starting at 1 and counting upward indefinitely.

### Drag the Letter

A pre-K classroom background displays a picture of a simple object (ant, bee, car, dog, etc.) alongside the object's word — with the first letter missing. A large green letter tile sits at the bottom of the screen. The child taps and holds the tile, then drags and drops it into the blank slot at the start of the word. A successful drop triggers confetti and a congratulatory message, then the next word appears. Words are shuffled each session for variety.

See [GAME_RULES.md](GAME_RULES.md) for full rules and mechanics.

## Technical Overview

| File | Purpose |
|---|---|
| `index.html` | Entry point, canvas element, font loading |
| `style.css` | Mobile-first full-screen layout, touch normalization |
| `js/game.js` | All game logic: state, rendering, input, animation |

**Rendering:** HTML5 Canvas 2D API, no external game libraries.

**Font:** [Fredoka One](https://fonts.google.com/specimen/Fredoka+One) (Google Fonts) — used for hint labels, word display, and celebration text.

**Digit drawing:** Each digit 0–9 is defined as a set of cubic-bezier centerline paths in a 100 × 140 unit coordinate space (`DIGIT_PATHS` in `js/game.js`). Paths are scaled to fit the screen and drawn as thick stroked lines (colored outline + white inner stroke), giving a clean single-stroke look sized for a child's finger.

**Dot placement:** Dots are sampled at even arc-length intervals directly along each digit's centerline paths, producing a single file of light gray dots the child traces through — no pixel sampling involved.

**Guide arrow:** A gold arrowhead tracks the tracing frontier for each digit independently, always floating just ahead of the first uncleared dot and pointing in the direction of travel — so multi-digit numbers (e.g. 10) always show a guide for every unfinished digit.

**Alphabet pictures:** 12 word-picture pairs (ANT, BEE, CAR, DOG, EGG, FISH, HAT, KEY, MOON, OWL, PIG, SUN) drawn procedurally on the Canvas — no image assets required.

**Backgrounds:** Two cached offscreen canvases — a candy-store scene for Numbers mode and a pre-K classroom for Alphabet mode — rebuilt on resize for crisp rendering at any device pixel ratio.

**Sound:** Sparkle effect plays on number/letter completion; a click plays when switching game modes. Both sounds are pre-unlocked on the first touch for iOS Safari compatibility.

**Input:** Unified touch/mouse handlers with `passive: false` to prevent scroll interference. Numbers mode uses `touchmove`/`mousemove` for tracing; Alphabet mode uses `touchstart`/`mousedown` + move + end for drag-and-drop.

## Browser Support

Any modern browser (Chrome 99+, Firefox 112+, Safari 15.4+). Requires `canvas.roundRect` and `document.fonts.ready`.

## Running Locally

```
open index.html
```

Or serve with any static file server:

```bash
npx serve .
```

## Planned Features

- Animated character / mascot
- Number name spoken aloud on display ("One!", "Two!", ...)
- Letter name / phonics sound spoken aloud
- More alphabet word-picture pairs (full A–Z coverage)
- Multiple themed color palettes
- Offline PWA support
