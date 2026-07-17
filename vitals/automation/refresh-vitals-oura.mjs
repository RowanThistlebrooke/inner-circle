#!/usr/bin/env node
/**
 * Oura → the vitals feed. Run from the board repo root:
 *
 *   node automation/refresh-vitals-oura.mjs
 *
 * Pulls the last 30 days of readiness, sleep and sleep sessions from Oura's
 * v2 API with a static Personal Access Token (OURA_TOKEN in .env.local or the
 * environment) and merges them into tiles/data/vitals.json - by date, never
 * dropping days the feed already has.
 *
 * The mapping, and its one honest hole: readiness score → recovery, sleep
 * score → sleep_perf, session HRV → hrv, session lowest HR → rhr, total
 * sleep → sleep_hours. STRAIN STAYS NULL - Oura has no strain, and the score
 * engine re-balances around a missing metric. Converting Oura's activity
 * score into fake strain would be a made-up number wearing a real one's name.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FEED_PATH = 'tiles/data/vitals.json'

function tokenFromEnv() {
  if (process.env.OURA_TOKEN) return process.env.OURA_TOKEN.trim()
  if (!existsSync('.env.local')) return null
  const line = readFileSync('.env.local', 'utf8').split('\n').find(l => l.trim().startsWith('OURA_TOKEN='))
  return line ? line.split('=').slice(1).join('=').trim() : null
}
const TOKEN = tokenFromEnv()
if (!TOKEN) {
  console.error('No OURA_TOKEN found. cloud.ouraring.com -> Personal Access Tokens -> create,')
  console.error('then put OURA_TOKEN=... in .env.local (gitignored).')
  process.exit(1)
}

async function get(path) {
  const r = await fetch('https://api.ouraring.com/v2/usercollection/' + path, {
    headers: { Authorization: 'Bearer ' + TOKEN },
  })
  if (r.status === 401) { console.error('Oura said the token is invalid. Make a fresh one.'); process.exit(1) }
  if (!r.ok) return null
  return r.json()
}

const iso = d => d.toISOString().slice(0, 10)
const end = new Date()
const start = new Date(Date.now() - 30 * 86400e3)
const range = 'start_date=' + iso(start) + '&end_date=' + iso(end)

const [readiness, sleepDaily, sessions] = await Promise.all([
  get('daily_readiness?' + range),
  get('daily_sleep?' + range),
  get('sleep?' + range),
])

const byDate = {}
const day = d => (byDate[d] = byDate[d] || { date: d, recovery: null, sleep_perf: null, hrv: null, rhr: null, sleep_hours: null, strain: null })

for (const r of readiness?.data ?? []) {
  if (r.day && isFinite(r.score)) day(r.day).recovery = r.score
}
for (const s of sleepDaily?.data ?? []) {
  if (s.day && isFinite(s.score)) day(s.day).sleep_perf = s.score
}
for (const s of sessions?.data ?? []) {
  if (!s.day) continue
  const d = day(s.day)
  if (isFinite(s.average_hrv)) d.hrv = Math.round(s.average_hrv)
  if (isFinite(s.lowest_heart_rate)) d.rhr = Math.round(s.lowest_heart_rate)
  if (isFinite(s.total_sleep_duration)) d.sleep_hours = Math.round((s.total_sleep_duration / 3600) * 10) / 10
}

const fresh = Object.values(byDate)
if (!fresh.length) { console.log('Oura returned no days in the window. Nothing written.'); process.exit(0) }

const feed = existsSync(FEED_PATH) ? JSON.parse(readFileSync(FEED_PATH, 'utf8')) : {}
const merged = {}
for (const r of Array.isArray(feed.days) ? feed.days : []) if (r && r.date) merged[r.date] = r
for (const r of fresh) merged[r.date] = r // fresh readings win their date

feed.provider = 'oura'
feed.days = Object.keys(merged).sort().reverse().map(d => merged[d])
feed.updated = new Date().toISOString()
writeFileSync(FEED_PATH, JSON.stringify(feed, null, 2) + '\n')
console.log('Wrote ' + FEED_PATH + ': ' + fresh.length + ' days from Oura, ' + feed.days.length + ' total.')
console.log('Next: commit and push, and the live board has your body on it.')
