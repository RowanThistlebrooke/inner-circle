# Connect any source

Turn any API or account into a tile on your board, in the real jade design,
tested before it lands. The dashboard is made OF your data - you connect a
source, and the board grows from what the data is.

- `PROMPT.md` (this file) - paste the block below to your mentor.
- `patreon.html` + `refresh-patreon.mjs` - the worked example (real income tile).
- `../looks/` - the parts bin every tile composes from (verbatim jade).
- `../build-your-own-tile/check-tile.mjs` - the gate.

---

## The formula

```
SOURCE      any API / OAuth (patreon, whoop, youtube, stripe, coinbase...)
  |  adapter   ~60 lines, runs on YOUR machine, the key never leaves .env.local
SHAPE       tiles/data/<source>.json  - the contract {hero, series, ...}
  |  host      hands the feed to the sealed tile (a tile never fetches)
TILE        composed from ../looks (verbatim jade), bound to the data
  |  gate      check-tile.mjs - the same floor every jade tile passes
BOARD       one registry line, reports its number into your equation
```

Look and data never touch: the tile renders whatever the feed carries; the
adapter fills the feed from any source. Mix any look with any source.

---

## The one prompt (paste this)

```
Build me a data tile for my board from a source I name.

SOURCE: <e.g. patreon / whoop / youtube / stripe>  (key in .env.local, or walk
        me through getting my own - it NEVER goes in the tile)
SHOW:   <the numbers I care about, e.g. monthly revenue, members, growth>
LOOK:   compose from github.com/rowanthistlebrooke/inner-circle looks/ -
        name the parts you want: air + card + hero + curve. Paste them
        VERBATIM. Never freehand a jade look from memory; that is the one way
        this goes wrong.

1) The adapter: automation/refresh-<source>.mjs - fetch with my key (key stays
   in .env.local), map to a shape, write tiles/data/<source>.json. Declare the
   shape in the tile's header comment. Facts only - never invent a number.

2) The tile: tiles/<source>.html, COMPOSED from looks/ (fonts + tokens first,
   then the looks you named, then only layout + data binding). Two layers: a
   compact poster on the grid, the full page on tap (page: true). ONE
   Vitality.report() with the headline number. Honest empty states.

3) Backtest: node check-tile.mjs tiles/<source>.html - fix until 0 errors.

4) Register { id, name, file, size:'m', page:true, data:'tiles/data/<source>.json' },
   run the adapter once, show me the tile with MY real data.

5) Offer the morning cloud cron so it refreshes with my laptop closed.
```

---

## The law (why this doesn't drift)

The looks come from jade by extraction, not memory - so the tile is pixel-true
by construction. If your mentor ever types a color, a font, or a card style
from its head instead of pasting a look, stop it: that is how a knockoff is
born. Paste the part. The pixels are already jade.

See `patreon.html` for a complete worked example: air + card + hero + curve,
bound to real Patreon revenue, gated green.
