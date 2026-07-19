#!/usr/bin/env node
/**
 * Patreon → the feed. Facts only, key stays home.
 * Shape written to tiles/data/patreon.json:
 *   { hero: { mrr, active }, series: [{date, joins, mrr_added}], updated }
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

function env(k) {
  if (process.env[k]) return process.env[k].trim()
  const f = existsSync('.env.local') ? '.env.local' : '/Users/rowantest/Desktop/my dashboard/.env.local'
  const line = readFileSync(f, 'utf8').split('\n').find(l => l.startsWith(k + '='))
  return line ? line.split('=').slice(1).join('=').trim() : null
}
const T = env('PATREON_ACCESS_TOKEN')
if (!T) { console.error('no PATREON_ACCESS_TOKEN'); process.exit(1) }

const H = { headers: { Authorization: 'Bearer ' + T } }
const camp = await fetch('https://www.patreon.com/api/oauth2/v2/campaigns?fields%5Bcampaign%5D=patron_count', H).then(r => r.json())
const cid = camp.data[0].id
const url = `https://www.patreon.com/api/oauth2/v2/campaigns/${cid}/members?fields%5Bmember%5D=full_name,patron_status,currently_entitled_amount_cents,pledge_relationship_start&page%5Bcount%5D=200`
const mem = await fetch(url, H).then(r => r.json())

const active = mem.data.map(m => m.attributes).filter(a => a.patron_status === 'active_patron')
const mrr = active.reduce((s, a) => s + (a.currently_entitled_amount_cents || 0), 0) / 100

// joins by day, last 45 days
const byDay = {}
for (const a of active) {
  const d = (a.pledge_relationship_start || '').slice(0, 10)
  if (!d) continue
  byDay[d] = byDay[d] || { joins: 0, mrr_added: 0 }
  byDay[d].joins++
  byDay[d].mrr_added += (a.currently_entitled_amount_cents || 0) / 100
}
const series = Object.keys(byDay).sort().map(d => ({ date: d, ...byDay[d] }))

// by tier: how many pay each amount
const tierMap = {}
for (const a of active) {
  const amt = ((a.currently_entitled_amount_cents || 0) / 100).toFixed(2)
  tierMap[amt] = (tierMap[amt] || 0) + 1
}
const tiers = Object.keys(tierMap).map(Number).sort((a, b) => b - a)
  .map(amt => ({ amount: amt, count: tierMap[amt.toFixed(2)] }))

// most recent joins, name + date + amount
const recent = active
  .filter(a => a.pledge_relationship_start)
  .sort((a, b) => b.pledge_relationship_start.localeCompare(a.pledge_relationship_start))
  .slice(0, 8)
  .map(a => ({ date: a.pledge_relationship_start.slice(0, 10), name: a.full_name || 'someone',
               amount: (a.currently_entitled_amount_cents || 0) / 100 }))

mkdirSync('tiles/data', { recursive: true })
writeFileSync('tiles/data/patreon.json', JSON.stringify({
  hero: { mrr: Math.round(mrr * 100) / 100, active: active.length },
  series, tiers, recent, updated: new Date().toISOString(),
}, null, 2) + '\n')
console.log(`patreon.json: $${mrr.toFixed(2)}/mo, ${active.length} active, ${series.length} join-days`)
