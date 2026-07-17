#!/usr/bin/env node
/**
 * WHOOP → the vitals feed. Two modes, run from the board repo root:
 *
 *   node automation/refresh-vitals-whoop.mjs --connect   once: the OAuth handshake
 *   node automation/refresh-vitals-whoop.mjs             daily: pull + write the feed
 *
 * Needs their OWN developer app (developer.whoop.com - scopes read:recovery
 * read:sleep read:cycles offline, redirect http://localhost:8787/callback) and
 * these in .env.local:
 *
 *   WHOOP_CLIENT_ID=...
 *   WHOOP_CLIENT_SECRET=...
 *   WHOOP_REFRESH_TOKEN=...   (written by --connect, then kept fresh by every run)
 *
 * THE GOTCHA THIS FILE EXISTS TO SURVIVE: WHOOP rotates the refresh token on
 * every use. Each run persists the new one back into .env.local; lose it and
 * the handshake has to be redone. This is also why WHOOP belongs on their
 * machine, not in GitHub Actions - a workflow cannot quietly update its own
 * secret, so a cloud-run token dies on the second morning.
 *
 * Mapping: recovery_score → recovery, hrv_rmssd_milli → hrv,
 * resting_heart_rate → rhr, sleep_performance_percentage → sleep_perf, sleep
 * span → sleep_hours, cycle strain → strain. Missing stays null, never faked.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'

const FEED_PATH = 'tiles/data/vitals.json'
const REDIRECT = 'http://localhost:8787/callback'
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const API = 'https://api.prod.whoop.com/developer/v1'

function envRead() {
  const out = {}
  if (existsSync('.env.local')) {
    for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = l.match(/^([A-Z_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim()
    }
  }
  for (const k of ['WHOOP_CLIENT_ID', 'WHOOP_CLIENT_SECRET', 'WHOOP_REFRESH_TOKEN']) {
    if (process.env[k]) out[k] = process.env[k].trim()
  }
  return out
}
function envWrite(key, value) {
  let lines = existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []
  const at = lines.findIndex(l => l.startsWith(key + '='))
  if (at >= 0) lines[at] = key + '=' + value
  else lines.push(key + '=' + value)
  writeFileSync('.env.local', lines.join('\n').replace(/\n*$/, '\n'))
}

const env = envRead()
if (!env.WHOOP_CLIENT_ID || !env.WHOOP_CLIENT_SECRET) {
  console.error('Missing WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET in .env.local.')
  console.error('Make your own app at developer.whoop.com (scopes: read:recovery read:sleep read:cycles offline,')
  console.error('redirect ' + REDIRECT + '), then rerun.')
  process.exit(1)
}

async function tokenExchange(params) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.assign({
      client_id: env.WHOOP_CLIENT_ID, client_secret: env.WHOOP_CLIENT_SECRET,
    }, params)).toString(),
  })
  if (!r.ok) { console.error('Token exchange failed (' + r.status + '): ' + (await r.text()).slice(0, 200)); process.exit(1) }
  return r.json()
}

// ── --connect: one browser consent, catch the callback locally, store tokens
if (process.argv.includes('--connect')) {
  const state = Math.random().toString(36).slice(2)
  const url = AUTH_URL + '?' + new URLSearchParams({
    client_id: env.WHOOP_CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code',
    scope: 'read:recovery read:sleep read:cycles offline', state,
  })
  console.log('\nOpen this in your browser and approve:\n\n  ' + url + '\n')
  const code = await new Promise(resolve => {
    const srv = createServer((req, res) => {
      const u = new URL(req.url, 'http://localhost:8787')
      if (u.pathname !== '/callback') { res.end(); return }
      res.end('Connected. You can close this tab.')
      srv.close()
      resolve(u.searchParams.get('code'))
    })
    srv.listen(8787)
  })
  if (!code) { console.error('No code came back.'); process.exit(1) }
  const tok = await tokenExchange({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT })
  envWrite('WHOOP_REFRESH_TOKEN', tok.refresh_token)
  console.log('Connected. Refresh token stored in .env.local. Now run the script with no flags, daily.')
  process.exit(0)
}

// ── daily: refresh (and PERSIST the rotated token), pull, map, merge, write
if (!env.WHOOP_REFRESH_TOKEN) {
  console.error('No WHOOP_REFRESH_TOKEN yet. Run: node automation/refresh-vitals-whoop.mjs --connect')
  process.exit(1)
}
const tok = await tokenExchange({ grant_type: 'refresh_token', refresh_token: env.WHOOP_REFRESH_TOKEN, scope: 'offline' })
envWrite('WHOOP_REFRESH_TOKEN', tok.refresh_token) // rotation survived
const H = { Authorization: 'Bearer ' + tok.access_token }

async function page(path) {
  const r = await fetch(API + path, { headers: H })
  if (!r.ok) return null
  return r.json()
}
const start = new Date(Date.now() - 30 * 86400e3).toISOString()
const [recovery, sleeps, cycles] = await Promise.all([
  page('/recovery?limit=25&start=' + start),
  page('/activity/sleep?limit=25&start=' + start),
  page('/cycle?limit=25&start=' + start),
])

const byDate = {}
const day = d => (byDate[d] = byDate[d] || { date: d, recovery: null, sleep_perf: null, hrv: null, rhr: null, sleep_hours: null, strain: null })
const dateOf = ts => ts ? String(ts).slice(0, 10) : null

for (const r of recovery?.records ?? []) {
  const d = dateOf(r.created_at); if (!d || !r.score) continue
  const dd = day(d)
  if (isFinite(r.score.recovery_score)) dd.recovery = Math.round(r.score.recovery_score)
  if (isFinite(r.score.hrv_rmssd_milli)) dd.hrv = Math.round(r.score.hrv_rmssd_milli)
  if (isFinite(r.score.resting_heart_rate)) dd.rhr = Math.round(r.score.resting_heart_rate)
}
for (const s of sleeps?.records ?? []) {
  if (s.nap) continue // naps are not the night
  const d = dateOf(s.end); if (!d || !s.score) continue
  const dd = day(d)
  if (isFinite(s.score.sleep_performance_percentage)) dd.sleep_perf = Math.round(s.score.sleep_performance_percentage)
  const span = (Date.parse(s.end) - Date.parse(s.start)) / 3600e3
  if (isFinite(span) && span > 0) dd.sleep_hours = Math.round(Math.min(24, span) * 10) / 10
}
for (const c of cycles?.records ?? []) {
  const d = dateOf(c.start); if (!d || !c.score) continue
  if (isFinite(c.score.strain)) day(d).strain = Math.round(c.score.strain * 10) / 10
}

const fresh = Object.values(byDate)
if (!fresh.length) { console.log('WHOOP returned no days in the window. Nothing written.'); process.exit(0) }

const feed = existsSync(FEED_PATH) ? JSON.parse(readFileSync(FEED_PATH, 'utf8')) : {}
const merged = {}
for (const r of Array.isArray(feed.days) ? feed.days : []) if (r && r.date) merged[r.date] = r
for (const r of fresh) merged[r.date] = r

feed.provider = 'whoop'
feed.days = Object.keys(merged).sort().reverse().map(d => merged[d])
feed.updated = new Date().toISOString()
writeFileSync(FEED_PATH, JSON.stringify(feed, null, 2) + '\n')
console.log('Wrote ' + FEED_PATH + ': ' + fresh.length + ' days from WHOOP, ' + feed.days.length + ' total.')
console.log('Next: commit and push, and the live board has your body on it.')
