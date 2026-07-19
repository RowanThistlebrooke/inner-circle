#!/usr/bin/env node
/**
 * check-tile - the backtest. Run it on any tile HTML before it touches a board:
 *
 *   node check-tile.mjs my-tile.html
 *
 * A faithful port of Vitality's own gate (mcp/src/tiles/lintTile.ts, lint-v3):
 * the same ~20 hard-floor rules every native Vitality tile must pass, plus the
 * quality warnings. ERRORS mean the tile is not safe/native and must be fixed
 * before install. WARNINGS are taste nudges - they never block.
 *
 * Pure and offline: it reads the HTML string and checks it. No network, no keys.
 * This is what makes a user-generated tile trustworthy: it passes the exact same
 * gate the finance and vitals tiles passed.
 */
import { readFileSync } from 'node:fs'

export const LINT_RULESET_VERSION = 'lint-v3'

const LAYOUT_PROPS = [
  'width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding',
  'box-shadow', 'backdrop-filter', 'inset', 'gap', 'font-size', 'line-height',
  'flex-basis', 'aspect-ratio', 'block-size', 'inline-size',
  'min-width', 'max-width', 'min-height', 'max-height',
  'grid-template-columns', 'grid-template-rows',
]

function extractKeyframes(css) {
  const out = []
  const re = /@keyframes\b/gi
  let m
  while ((m = re.exec(css))) {
    const open = css.indexOf('{', m.index)
    if (open < 0) continue
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') { depth--; if (depth === 0) { out.push(css.slice(open, i + 1)); break } }
    }
  }
  return out
}

function matchedBlocks(s, opener) {
  const ranges = []
  const re = new RegExp(opener.source, opener.flags.includes('g') ? opener.flags : opener.flags + 'g')
  let m
  while ((m = re.exec(s))) {
    const open = s.indexOf('{', m.index)
    if (open < 0) continue
    let depth = 0
    for (let i = open; i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') { depth--; if (depth === 0) { ranges.push([open, i]); break } }
    }
  }
  return ranges
}

function firstCallArgs(s, fromIdx) {
  const open = s.indexOf('(', fromIdx)
  if (open < 0) return ''
  let depth = 0, quote = ''
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0) return s.slice(open + 1, i) }
  }
  return s.slice(open + 1)
}

export function lintTile(html) {
  const findings = []
  const add = (rule, severity, message, hint) => findings.push({ rule, severity, message, hint })
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(x => x[1]).join('\n')

  // Sealed structure + isolation
  const hasDoctype = /<!doctype\s+html/i.test(html)
  const hasHtml = /<html[\s>]/i.test(html)
  const hasInline = /<style[\s>]/i.test(html) || /<script[\s>]/i.test(html)
  if (!hasDoctype || !hasHtml || !hasInline)
    add('doc-structure', 'error', 'not a self-contained HTML document (needs <!doctype html>, <html>, and inline <style>/<script>)', 'Output one sealed HTML file.')
  if (/<script[^>]*\bsrc\s*=/i.test(html))
    add('sealed-external-script', 'error', 'an external <script src> was found; a tile must inline all JavaScript', 'Inline the script, no CDN.')
  if (/\bimport\s*\(\s*["'](?:https?:)?\/\//i.test(html) || /\bfrom\s+["'](?:https?:)?\/\//i.test(html))
    add('sealed-external-script', 'error', 'JavaScript loads code from an external URL (import/from); a tile inlines all JS', 'Inline everything.')
  if (/createElement\s*\(\s*["']script["']/i.test(html) || /document\.write\s*\(/i.test(html))
    add('sealed-dynamic-script', 'error', 'a script element is injected at runtime (createElement("script")/document.write); a sealed tile inlines all code', 'Never inject a script.')
  const linkRe = /<link\b[^>]*\bhref\s*=\s*["']?((?:https?:)?\/\/[^"'>\s]+)/gi
  let lm
  while ((lm = linkRe.exec(html))) {
    if (!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(lm[1]))
      add('sealed-external-resource', 'error', 'an external resource <link> was found (' + lm[1] + '); a tile loads no external CSS or assets', 'Inline all styles and assets.')
  }
  if (/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i.test(html))
    add('sealed-external-resource', 'error', 'a CSS @import of an external URL was found; a tile inlines all styles', 'Inline all styles.')
  if (/\bReactDOM\b|\bReact\.[A-Za-z]|from\s+["']react["']|\bVue\.[A-Za-z]|\bcreateApp\b|\bangular\b/i.test(html))
    add('sealed-framework', 'error', 'a framework reference (React, Vue, Angular) was found; tiles are vanilla JS only', 'Use plain DOM APIs.')
  {
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    if (/<[a-zA-Z][^>]*?\son(?:click|dblclick|mousedown|mouseup|mouseover|mouseout|mouseenter|mouseleave|mousemove|keydown|keyup|keypress|input|change|submit|reset|focus|blur|load|error|scroll|wheel|touchstart|touchend|touchmove|pointerdown|pointerup|pointermove|contextmenu|animationstart|animationend|transitionend|drag|drop|copy|paste|beforeunload)\s*=/i.test(markup))
      add('inline-event-handler', 'error', 'an inline event-handler attribute (onclick=, onerror=, ...) was found; a sealed tile wires handlers in its one audited <script>', 'Attach with addEventListener.')
  }
  {
    const tags = html.match(/<script\b[^>]*>|<\/script\s*>/gi) || []
    let depth = 0, stray = false
    for (const tag of tags) {
      if (/^<\//.test(tag)) { if (depth === 0) { stray = true; break } depth-- }
      else depth++
    }
    if (stray) add('script-stray-close', 'error', 'a </script> appears before its opening <script> (injected markup broke out of an element)', 'Escape any user text rendered into HTML.')
    else if (depth !== 0) add('script-unbalanced', 'error', 'unbalanced <script> tags (an opening tag is never closed)', 'Every <script> needs a matching </script>.')
  }

  // Date safety
  if (/toISOString\s*\(\s*\)\s*\.\s*(?:slice|split|substr|substring)/i.test(html))
    add('date-utc-drift', 'error', 'toISOString().slice/split builds a UTC date key that drifts a day; build the key from local getters', 'Use getFullYear/getMonth/getDate, zero-padded.')

  // Motion
  for (const kf of extractKeyframes(styleBlocks)) {
    const hit = LAYOUT_PROPS.filter(p => new RegExp('(^|[;{\\s])' + p + '(?:-[a-z]+)?\\s*:', 'i').test(kf))
    if (hit.length) { add('motion-keyframe-layout', 'error', 'a @keyframes animation animates layout/paint props (' + hit.join(', ') + '); animate only transform and opacity', 'Width becomes scaleX, position becomes translate.'); break }
  }
  for (const kf of extractKeyframes(styleBlocks)) {
    if (/filter\s*:[^;}]*\bblur\s*\(/i.test(kf)) { add('motion-keyframe-blur', 'error', 'a @keyframes animation animates filter: blur() (re-blurs the layer every frame)', 'Blur once, animate opacity.'); break }
  }
  const transRe = /transition(?:-property)?\s*:\s*([^;}]+)[;}]/gi
  let tm, transLayout = false
  while ((tm = transRe.exec(styleBlocks))) {
    const val = tm[1].toLowerCase()
    if (/(^|[\s,])all([\s,]|$)/.test(val) || LAYOUT_PROPS.some(p => new RegExp('(^|[\\s,])' + p + '(?:-[a-z]+)?([\\s,]|$)').test(val))) transLayout = true
  }
  if (transLayout) add('motion-transition-layout', 'warn', 'a transition animates a layout/paint property (or "all"); prefer transform and opacity', 'Transition transform and opacity only.')

  // Text hygiene (warnings)
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2300}-\u{23FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u.test(html))
    add('no-emoji', 'warn', 'an emoji or decorative glyph was found; the native Vitality voice draws glyphs as inline SVG', 'Use inline SVG glyphs.')
  if (/[—–]/.test(html))
    add('no-em-dash', 'warn', 'an em or en dash was found; the native Vitality voice uses commas, periods, or colons', 'Avoid em dashes.')
  if (/[✅✓✔✖✗✘❌]/u.test(html))
    add('no-unicode-check', 'warn', 'a unicode checkmark or cross glyph was found; draw these as inline SVG', 'Use an inline SVG glyph.')

  // State, storage, brand (warnings) + color-scheme (error)
  {
    const tryRanges = matchedBlocks(html, /\btry\b\s*\{/g)
    const inTry = idx => tryRanges.some(([a, b]) => idx > a && idx < b)
    const lsRe = /localStorage\s*\./g
    let sm
    while ((sm = lsRe.exec(html))) {
      if (!inTry(sm.index)) { add('storage-unwrapped', 'warn', 'localStorage is accessed outside a try/catch; a sealed iframe can throw or be cleared', 'Wrap in try/catch.'); break }
    }
  }
  if (/color-scheme\s*:\s*[^;}"']*\bdark\b/i.test(styleBlocks) || /<meta[^>]*\bname\s*=\s*["']color-scheme["'][^>]*\bcontent\s*=\s*["'][^"']*\bdark\b/i.test(html))
    add('color-scheme-dark', 'error', 'the tile declares a dark color-scheme; the host forces light, and a dark declaration paints an opaque white canvas behind the tile', 'Remove the color-scheme declaration.')
  const bodyMatch = styleBlocks.match(/body\s*\{([^}]*)\}/i)
  if (bodyMatch) {
    const bg = bodyMatch[1].match(/background(?:-color)?\s*:\s*([^;]+)/i)
    if (bg) { const v = bg[1].trim().toLowerCase(); if (!/transparent|none|rgba\([^)]*,\s*0\s*\)/.test(v)) add('body-not-transparent', 'warn', 'the tile body sets an opaque background; the host paints the page, the tile body stays transparent', 'Use background: transparent on body.') }
  }
  if (!/#6ee7b7/i.test(html) && !/var\(\s*--mint/i.test(html))
    add('brand-mint-missing', 'warn', 'no mint accent (#6EE7B7) found; the tile reads off-brand', 'Use mint #6EE7B7 as the accent.')
  if (!/::selection/i.test(html))
    add('selection-style-missing', 'warn', 'no ::selection styling; the OS blue highlight will show', 'Add a mint ::selection rule.')
  const hasMotion = /@keyframes/i.test(styleBlocks) || /transition\s*:/i.test(styleBlocks) || /animation\s*:/i.test(styleBlocks)
  if (hasMotion && !/prefers-reduced-motion/i.test(html))
    add('reduced-motion-missing', 'warn', 'the tile animates but has no prefers-reduced-motion block', 'Add a reduced-motion media query.')
  if (/\.select\s*\(\s*\)/.test(html))
    add('select-not-focus', 'warn', '.select() highlights the value as a blue block; focus the input instead', 'Use .focus(), not .select().')

  // Host bridge (warning)
  if (!/Vitality\s*\.\s*(?:save|load|report)\b/.test(html))
    add('bridge-missing', 'warn', 'no Vitality host bridge call found (Vitality.save/load/report); a tile with no bridge persists nothing', 'Call the bridge.')

  // Report contract
  const REPORT_KINDS = ['intake', 'count', 'duration', 'rating', 'measure', 'money', 'done']
  const reportCount = (html.match(/Vitality\.report\s*\(/g) || []).length
  if (reportCount > 1) add('report-multiple', 'warn', 'more than one Vitality.report() call; a tile reports at most one stream', 'Report a single number.')
  if (reportCount >= 1) {
    const args = firstCallArgs(html, html.search(/Vitality\.report\s*\(/))
    const missing = ['key', 'value', 'date', 'kind'].filter(k => !new RegExp('\\b' + k + '\\s*:').test(args))
    if (missing.length) add('report-shape', 'error', 'a Vitality.report() call is missing required fields (' + missing.join(', ') + '); a broken stream lands nothing', 'Report {key, label, value, date, kind}.')
    const kindLit = /\bkind\s*:\s*['"]([^'"]*)['"]/.exec(args)
    if (kindLit && !REPORT_KINDS.includes(kindLit[1])) add('report-kind-invalid', 'error', 'a Vitality.report() call uses a kind ("' + kindLit[1] + '") outside the fixed taxonomy', 'Use one of: ' + REPORT_KINDS.join(', ') + '.')
  }

  const errors = findings.filter(f => f.severity === 'error').length
  const warnings = findings.filter(f => f.severity === 'warn').length
  return { ok: errors === 0, errors, warnings, findings }
}

// CLI
const file = process.argv[2]
if (!file) { console.error('usage: node check-tile.mjs <tile.html>'); process.exit(2) }
const html = readFileSync(file, 'utf8')
const r = lintTile(html)
console.log(`\n  ${file}  (${LINT_RULESET_VERSION})\n`)
for (const f of r.findings) {
  const tag = f.severity === 'error' ? 'ERROR' : 'warn '
  console.log(`  [${tag}] ${f.rule}: ${f.message}`)
  if (f.hint) console.log(`          -> ${f.hint}`)
}
console.log(`\n  ${r.ok ? 'PASS' : 'FAIL'} - ${r.errors} error(s), ${r.warnings} warning(s)\n`)
process.exit(r.ok ? 0 : 1)
