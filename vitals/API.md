# Hooking a wearable API to the Vitals tile

For the mentor, walking a member through the wearable path. One idea carries
this whole file: **the tile never learns about any API.** Every wearable, no
matter the brand, gets mapped into the same six numbers per day and written
into `tiles/data/vitals.json`. The adapter script is the only thing that
changes per brand; the feed, the tile, the score are identical for everyone.

The six numbers, per day (every one optional - the engine re-balances):

```
recovery      0-100        the band's readiness/recovery score
sleep_perf    0-100        the band's sleep score
hrv           ms           heart-rate variability
rhr           bpm          resting heart rate
sleep_hours   hours        time actually asleep
strain        0-21         WHOOP's strain; leave null if the band has no equivalent
```

Rules that never bend: the token lives in `.env.local` (gitignored) or a
repo secret - never in a tile, never committed, never shared. If a metric
does not exist on their band, it stays null - never converted from something
that merely looks similar. A made-up mapping is a made-up number.

---

## Oura - the easy path (a static token, no OAuth)

1. They sign in at cloud.ouraring.com - Personal Access Tokens - Create a new
   token - copy it. That is the whole ceremony.
2. Write it into `.env.local`: `OURA_TOKEN=...`
3. Copy `automation/refresh-vitals-oura.mjs` into their board's `automation/`,
   run it from the board root. It writes the feed: readiness score → recovery,
   sleep score → sleep_perf, HRV and lowest heart rate from the sleep session,
   total sleep → hours. **Strain stays null** - Oura has no strain; the score
   engine re-balances around it, honestly.
4. Set `provider: "oura"` so the page credits the right band.

Cloud: the token is static, so it drops straight into a GitHub Actions secret
and the morning workflow can run it. Add a step to the existing
`refresh-finance.yml` or copy its shape.

## WHOOP - the OAuth path (more ceremony, same ending)

WHOOP has no static tokens; it wants a developer app + OAuth.

1. They create an app at developer.whoop.com (their own app - their client id
   and secret, never shared). Scopes: `read:recovery read:sleep read:cycles
   offline`. Redirect URL can be `http://localhost:8787/callback`.
2. One-time handshake: run `automation/refresh-vitals-whoop.mjs --connect`.
   It opens the consent page, catches the callback locally, and stores the
   refresh token in `.env.local` alongside the client id/secret.
3. Every run after: the script refreshes the token, pulls recovery
   (recovery score, HRV, RHR), sleep (performance, hours) and the day's cycle
   (strain), writes the feed, and **persists the rotated refresh token back to
   `.env.local`** - WHOOP rotates it on every use, and losing the new one
   means redoing the handshake.
4. Set `provider: "whoop"`.

Cloud, honestly: that token rotation fights GitHub Actions (a workflow cannot
quietly update its own secret). So WHOOP runs best on their machine - the
mentor runs it, or a local scheduler does. If they want fully-cloud vitals,
Oura's static token is the band that does it cleanly today. Say that plainly
instead of promising WHOOP-in-the-cloud and shipping a token that dies in a
week.

## Any other band - the pattern

Garmin, Fitbit, Apple Health via an export app, anything: find the endpoint
that returns daily readiness/sleep, get whatever token the vendor offers, and
write a 60-line adapter that ends in the same six numbers per day merged into
`tiles/data/vitals.json` (merge by date - never drop days the feed already
has). Copy either script as the skeleton; only the fetch and the mapping
change. If a number does not exist, it stays null. Then `provider` gets the
band's name and the page credits it.

---

## After any path

Run it once while they watch: the feed fills, the board refreshes, the ring
sweeps to a real score. Then wire the rhythm - local schedule or the morning
workflow - and remind them the tile shows its own amber band if the feed ever
goes quiet 2+ days. Staleness is never silent.
