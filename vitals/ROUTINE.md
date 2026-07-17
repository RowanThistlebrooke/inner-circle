# The Vitals routine — the one prompt

Inner Circle drop #2. The body on the board: a 0-100 score, plain-English
verdict, today's numbers, scrubbable history — fed by a wearable if they have
one, or by a 30-second daily check-in if they don't. The tile lives in THIS
repo (`vitals/vitals.html`): members only.

---

## The one prompt (paste this)

```
Run the vitals routine on my board. Do everything yourself; my hands only
touch a browser when you say so. One step at a time.

1) Install the vitals tile from the inner-circle repo
   (github.com/rowanthistlebrooke/inner-circle, vitals/vitals.html) into
   tiles/, and register it: { id: 'vitals', name: 'Vitals',
   file: 'tiles/vitals.html', size: 's', page: true,
   data: 'tiles/data/vitals.json' }.

2) Ask me ONE question: do I wear a tracker (WHOOP, Oura, anything)?

   IF YES - the wearable path:
   - If my tracker has a Claude connector, help me connect it, then pull my
     last 30 days of recovery, sleep, HRV, resting HR and strain, and write
     them into tiles/data/vitals.json (the feed shape is declared in the
     tile's header - read it, never guess).
   - If it has an API instead, follow vitals/API.md in this repo: Oura is a
     two-minute static token (adapter ships here, cloud-safe); WHOOP is your
     own developer app + one handshake (adapter ships here, runs on my
     machine because WHOOP rotates tokens). Any other band: map it into the
     same six numbers per day, per the guide. Token in .env.local, never
     committed.
   - Set provider to my tracker's name so the page credits it honestly.

   IF NO - the manual path:
   - Nothing to set up. Show me the tile's own check-in (tap the tile, then
     CHECK-IN): sleep, three taps, optional pulse-count and HRV. Tell me
     plainly: fill what I know, it scores the rest, and my score gets sharper
     after about three days when my personal baselines exist.
   - Set provider to 'manual' in the feed if a feed file exists; otherwise no
     feed file is needed at all.

3) Either path: my score lands in my ledger automatically (the tile reports
   it). Add vitals to my equation - ask me what my body is worth toward my
   goal and write it into lib/tiles/weights.ts.

4) The verdict is YOURS to write, never invented: when you refresh my vitals,
   read my recent days and write feed.verdict in plain words (one line, one
   emphasis word, tone 'accent' or 'amber' - amber is warm, never alarming).
   If you have not read my days, leave verdict out and the tile speaks in
   tiers on its own. Chips (feed.chips) same law: only from real data.

5) The rhythm: I say "refresh my vitals" and you pull the latest readings
   (wearable path) or just re-read what my check-ins wrote, then update the
   verdict and push. Be honest about staleness - the tile shows an amber band
   on its own when a wearable feed goes quiet 2+ days.
```

---

## The feed shape (also declared in the tile's header — that copy is law)

```json
{
  "provider": "whoop",
  "sleepTarget": 8,
  "days": [
    { "date": "2026-07-17", "recovery": 72, "sleep_perf": 82, "hrv": 134,
      "rhr": 45, "sleep_hours": 7.6, "strain": 17.0 }
  ],
  "verdict": { "text": "Solid, not spectacular. Train smart and keep the streak going.",
               "emphasis": "Solid", "lean": "steady", "tone": "accent" },
  "chips": [ { "label": "0 hard days", "qualifier": "on track", "dir": "good" } ],
  "updated": "2026-07-17T06:00:00Z"
}
```

Wearable days win their date; the member's own check-ins fill the dates the
band missed. Every field is optional — the engine re-balances around gaps and
never zero-penalises a missing reading.

## What the tile computes itself (no AI, no server)

The score engines are ported from the app verbatim: the 0-100 blend
(recovery .30, sleep performance .20, HRV vs baseline .15, RHR vs baseline
.15, sleep hours .10, strain balance .10, re-normalised over what exists),
personal baselines from their own trailing days, the manual check-in's
derivation of the WHOOP-style trio, tiers, pips, history. The mentor's only
judgement surface is the verdict and the chips.

## House law, applied here

Never invent a reading, a verdict, or a chip. The check-in's honesty note is
real: on the very first day HRV/RHR sit out of Recovery until ~3 days of
baseline exist. Amber for caution, never red. The wearable's token stays on
their machine. Sealed tiles never fetch.
