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
Connect a source to my board and make it a tile. Interview me first, one
question at a time. Do everything yourself; my hands only touch a browser when
you say so. I might be a total beginner.

0) INTERVIEW (ask these before building anything):
   a) "What do you want on your board?" (e.g. Instagram followers, Patreon
      income, YouTube views, Stripe revenue, my WHOOP recovery)
   b) Work out the source yourself. Then check .env.local: if I already have a
      key/token for it, say so and skip to step 2.
   c) If I don't, say "I'll get you set up" and figure out the auth type
      YOURSELF (static key vs OAuth) - never make me know that word. Follow
      the AUTH GUIDE below for that source. Walk me through it, exact clicks,
      one at a time, and wait. Write the key into .env.local (gitignored,
      never committed, never in the tile).
   d) When it's set up, say plainly: "Now building your tile."

1) The adapter: automation/refresh-<source>.mjs - fetch with my key (key stays
   in .env.local), map to a shape, write tiles/data/<source>.json. Declare the
   shape in the tile's header comment. Facts only - never invent a number.

2) The tile: tiles/<source>.html, COMPOSED from github.com/rowanthistlebrooke/
   inner-circle looks/ - paste the parts VERBATIM (fonts + tokens first, then
   the looks you want: air, card, hero, curve), then only layout + data
   binding. NEVER freehand a jade look from memory; that is the one way this
   goes wrong. Two layers: a compact poster on the grid, the full page on tap
   (page: true). ONE Vitality.report() with the headline number. Honest empty
   states.

3) Backtest: node check-tile.mjs tiles/<source>.html - fix until 0 errors.
   A red result never lands on my board; you fix and re-run.

4) Register { id, name, file, size:'m', page:true, data:'tiles/data/<source>.json' },
   run the adapter once, show me the tile with MY real data.

5) Offer the morning cloud cron so it refreshes with my laptop closed.
```

---

## AUTH GUIDE (the mentor follows this per source)

The tile is always easy. Auth is the only real friction, and it varies. Easiest
first. The key ALWAYS lands in `.env.local`, never in the tile, never committed.

| source | how | time |
|--------|-----|------|
| **Finnhub** (stocks) | finnhub.io, free signup, copy the key | 2 min |
| **Oura** (readiness) | cloud.ouraring.com, Personal Access Token, create | 2 min |
| **CoinGecko** (crypto) | no key at all | 0 |
| **Patreon** (income) | patreon.com/portal, register client, copy Creator's Access Token | 3 min |
| **YouTube** (channel) | console.cloud.google.com, enable YouTube Data API v3, create API key | 5 min |
| **Stripe** (revenue) | dashboard.stripe.com, Developers, API keys, copy the restricted read key | 3 min |
| **WHOOP** (recovery) | own dev app + one OAuth handshake - see the vitals API.md | 10 min |
| **Instagram** (followers) | the hard one - a Meta app + a long-lived token. Honest: this is the Meta maze and it takes real patience. If I get stuck, that is what the help channel is for. |

Rules for every source: their OWN key (never a shared one - their quota, their
risk), the key stays in `.env.local`, and a source with no working data-API
(Apple Watch, TikTok DMs) is said plainly, not promised around.

---

## The law (why this doesn't drift)

The looks come from jade by extraction, not memory - so the tile is pixel-true
by construction. If your mentor ever types a color, a font, or a card style
from its head instead of pasting a look, stop it: that is how a knockoff is
born. Paste the part. The pixels are already jade.

See `patreon.html` for a complete worked example: air + card + hero + curve,
bound to real Patreon revenue, gated green.
