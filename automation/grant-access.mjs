#!/usr/bin/env node
/**
 * The doorman - pay on Whop, get the repo, no human in the loop.
 *
 * Runs in GitHub Actions on a timer. Reads #github-access (members-only), and
 * for every message that is a bare GitHub username from someone holding the IC
 * role, invites that username to this repo and replies. Idempotent by design:
 * an existing collaborator or pending invite is skipped silently, and a message
 * the bot already replied to (by reply-reference) is never handled twice - so
 * re-runs never spam and never double-invite.
 *
 * Trust model: the IC role is the paid stamp (Whop grants it). The check is a
 * single-member fetch, which needs no privileged intent. A username is only
 * accepted in GitHub's own shape (letters/digits/hyphens, max 39) - anything
 * else in the channel is chatter and gets ignored, never errored at.
 *
 * Secrets (repo Settings - Secrets and variables - Actions):
 *   DISCORD_BOT_TOKEN  the rowan bot token
 *   GH_PAT             fine-grained token, THIS repo only, Administration: write
 */
const DISCORD = 'https://discord.com/api/v10'
const GUILD = '1499444572881817612'
const CHANNEL = '1528023179740709005'
const IC_ROLE = '1515299662171603095'
const OWNER = 'RowanThistlebrooke'
const REPO = 'inner-circle'

const DT = process.env.DISCORD_BOT_TOKEN
const GT = process.env.GH_PAT
if (!DT || !GT) { console.error('missing DISCORD_BOT_TOKEN or GH_PAT'); process.exit(1) }

const dHeaders = {
  Authorization: 'Bot ' + DT,
  'Content-Type': 'application/json',
  'User-Agent': 'DiscordBot (https://github.com/rowanthistlebrooke, 1.0)',
}
const gHeaders = {
  Authorization: 'Bearer ' + GT,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'inner-circle-doorman',
}

async function discord(method, path, body) {
  const r = await fetch(DISCORD + path, { method, headers: dHeaders, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) }
}
async function github(method, path, body) {
  const r = await fetch('https://api.github.com' + path, { method, headers: gHeaders, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) }
}

const USERNAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/

const { data: messages } = await discord('GET', `/channels/${CHANNEL}/messages?limit=50`)
if (!Array.isArray(messages)) { console.error('cannot read the channel:', messages); process.exit(1) }

// messages the bot already answered (it always replies with a reference)
const answered = new Set(
  messages.filter(m => m.author?.bot && m.message_reference?.message_id)
          .map(m => m.message_reference.message_id)
)

// pending invites, so a re-run before acceptance stays quiet
const { data: invites } = await github('GET', `/repos/${OWNER}/${REPO}/invitations`)
const pending = new Set((Array.isArray(invites) ? invites : []).map(i => i.invitee?.login?.toLowerCase()))

let acted = 0
for (const m of messages.reverse()) { // oldest first, so replies read in order
  if (m.author?.bot || answered.has(m.id)) continue
  const candidate = (m.content || '').trim().replace(/^@/, '')
  if (!USERNAME.test(candidate)) continue

  // the paid stamp: does the author hold IC right now?
  const { status: ms, data: member } = await discord('GET', `/guilds/${GUILD}/members/${m.author.id}`)
  if (ms !== 200 || !member?.roles?.includes(IC_ROLE)) {
    await discord('POST', `/channels/${CHANNEL}/messages`, {
      content: `<@${m.author.id}> I don't see the IC role on you yet. If you just paid, give Whop a minute to stamp you, then post the username again.`,
      message_reference: { message_id: m.id },
    })
    acted++
    continue
  }

  const login = candidate.toLowerCase()
  if (pending.has(login)) continue
  const { status: cs } = await github('GET', `/repos/${OWNER}/${REPO}/collaborators/${candidate}`)
  if (cs === 204) continue // already in - an earlier run handled them

  const { status: ps, data: pd } = await github('PUT', `/repos/${OWNER}/${REPO}/collaborators/${candidate}`, { permission: 'pull' })
  if (ps === 201 || ps === 204) {
    await discord('POST', `/channels/${CHANNEL}/messages`, {
      content: `<@${m.author.id}> invite sent to **${candidate}** - accept it at github.com/notifications and the repo is yours.`,
      message_reference: { message_id: m.id },
    })
  } else if (ps === 404) {
    await discord('POST', `/channels/${CHANNEL}/messages`, {
      content: `<@${m.author.id}> GitHub says **${candidate}** doesn't exist - check the spelling and post it again.`,
      message_reference: { message_id: m.id },
    })
  } else {
    console.error('invite failed', ps, pd)
  }
  acted++
}
console.log(`done - ${acted} message(s) handled, ${messages.length} scanned`)
