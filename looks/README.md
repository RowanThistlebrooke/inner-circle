# looks - the jade parts bin

Every design piece harvested verbatim from the real Vitality (jade) source with
the same extraction that made the finance and vitals tiles pixel-correct. A data
tile COMPOSES from these; it never imitates them. That is the law: the pixels
come from jade, so no one (not even the AI) can drift them from memory.

| part | what it is | needs |
|------|-----------|-------|
| `fonts.html` | the real type stack (Instrument Serif, Inter, JetBrains Mono) + vars | paste in `<head>` |
| `tokens.css` | jade's palette + type/ease tokens the looks resolve against | first `<style>` |
| `air.css` + `air.html` | the atmosphere: aurora, mountains, drift particles, grain | tokens |
| `card.css` | jade's real card (fill, border, radius) | tokens |
| `hero.css` | the serif hero number recipe | fonts + tokens |
| `curve.html` | peak's energy-curve gradients + glow (the LOOK; you draw the path) | - |

## How a tile composes

1. `<head>`: paste `fonts.html`.
2. First `<style>`: paste `tokens.css`, then whichever looks you want
   (`air.css`, `card.css`, `hero.css`).
3. After `<body>`: paste `air.html` for the backdrop; put `curve.html`'s `<defs>`
   inside your chart `<svg>`.
4. Bind YOUR data to the slots. Zero eyeballing - the look is already jade.
5. `node check-tile.mjs your-tile.html` - must pass before it lands.

The prompt names looks instead of describing them:
`LOOK: air + card + hero + curve`.
