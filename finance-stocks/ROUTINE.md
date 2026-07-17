# The Finance routine — the one prompt

The vault version of the stocks episode. One paste sets up everything the video
showed, then runs it on a rhythm. The member pastes the block below into Claude
Code inside their dashboard folder. Their mentor does the rest.

---

## The one prompt (paste this)

```
Run the finance routine on my board. Do everything yourself; my hands only
touch a browser when you say so. One step at a time.

1) Make sure my board can receive it: update lib/tiles/host.js from
   github.com/rowanthistlebrooke/seed if mine is older, and install the finance
   tile from github.com/rowanthistlebrooke/ep-finance-stocks if I don't have it.

2) My own free key: walk me to finnhub.io, free signup, I copy one key. You
   write it into .env.local, make sure .gitignore covers it, and it never gets
   committed or shared.

3) Ask me what I own - tickers and how many shares, that's all - and write it
   into tiles/data/finance.json.

4) Run the refresh (automation/refresh-finance.mjs from the tile's repo), then
   apply THE FILTER LAW below to everything it pulled: rate every headline,
   write the why lines, the pick, and the health cards - only from what you
   actually read. Push, and show me my live page with real data on it.

5) Offer me the rhythm once: I can say "refresh my stocks" any time, or you
   schedule it daily if my machine supports scheduled tasks. Never promise a
   schedule you can't keep.
```

---

## THE FILTER LAW

This is the judgement half of the routine, written down so every member's
mentor filters exactly the way mine does. It runs after the script fetches raw
headlines. Show this card in the video when explaining the filter.

### The one test

> **Does this change anything about WHY you own it?**

If no, it never renders. Not rated lower - gone. The page's value is what it
refuses to show.

### Always dropped

- **Price-move stories.** "Stock rises 2% as market rallies." The page already
  shows the price; a story about the price is a mirror, not news.
- **Analyst target shuffles.** Someone's opinion changed, not the company.
- **Listicles and picks content.** "5 stocks to buy now" is content, not
  information.
- **Macro stories on single stocks.** Fed news is not Disney news.
- **Rumor without a filing.** If no company statement, filing, or regulator
  action sits under it, it waits until one does.

### What survives

Earnings and guidance. Dividend changes. CEO and leadership changes.
Acquisitions. Regulatory action. Structural demand shifts (cigarette volumes
falling IS Altria news). Major product launches or failures. Debt and credit
events. Anything that touches the reason the holding exists.

### The per-holding rule

Importance is not a property of the headline. It is the headline MEETING what
this person owns. "US market hits a fresh high" passes for VOO - a total-market
fund IS the market - and drops for a single stock as macro noise. Filter each
headline against each holding separately.

### The tone map

- **good** - confirms the reason they own it
- **watch** - real, worth tracking, no action implied
- **heads up** - touches the thesis. Amber, never red. Off target is warm,
  never alarming.

### Dedupe

One event, one card. Five outlets covering the same earnings report collapse
into the clearest single card. The ticker's card count should say how much
HAPPENED, not how much was written.

### The plain-words law

No jargon survives the filter. "Expensive," never "P/E 32x." The why line is
one sentence, written from what the article actually says, addressed to the
person holding it. If you have not read the piece, the item stays **watch**
with an honest unread note. An invented rating is a lie with a mint dot next
to it. Empty is always an honest state.

---

## The pick and the health cards (same law)

- **Today's pick**: one idea a day, chosen against what they own - diversify
  away from their concentration, never chase heat. Plain reason, "Research,
  not financial advice," and if you have not done the reading today, leave
  the EXAMPLE card. Never backfill a pick after the fact.
- **Health cards** (`health` in the feed): standpoint + five marks + what
  changed + long term, only from real reading of real filings or reporting.
  A holding you haven't read stays cardless and says so.

---

## The rhythm

The full routine = script (facts) + filter (judgement) + push. When the member
asks for a schedule, the honest options in order: daily scheduled task if their
machine supports it; otherwise "say 'refresh my stocks' and it runs." The
routine is idempotent - re-running a day replaces that day, never duplicates.
