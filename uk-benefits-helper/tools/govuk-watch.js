// Watches the official GOV.UK pages our rules are based on.
//
// Uses the public GOV.UK Content API (https://www.gov.uk/api/content/<path>),
// which is the supported, machine-readable way to read GOV.UK - no scraping of
// HTML. For each page we record `public_updated_at` and a hash of the body.
// If either changes, the page is reported so a person can review the rules.
//
//   npm run watch-govuk               report changes (exit 1 if any)
//   npm run watch-govuk -- --accept   record current state as reviewed
//
// Scotland (mygov.scot) and Northern Ireland (nidirect) pages are not covered
// yet - see docs/ROADMAP.md.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SOURCES = new URL('./govuk-sources.json', import.meta.url);
const SNAPSHOT = new URL('./govuk-snapshot.json', import.meta.url);
const API = 'https://www.gov.uk/api/content';
const accept = process.argv.includes('--accept');

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function bodyText(item) {
  const d = item.details || {};
  const parts = [d.body, ...(d.parts || []).map((p) => p.body), ...(d.documents || [])];
  return JSON.stringify(parts.filter(Boolean));
}

async function fetchPage(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const item = await res.json();
  return { title: item.title, updated: item.public_updated_at, hash: sha(bodyText(item)) };
}

const { pages } = JSON.parse(await readFile(SOURCES, 'utf8'));
let snapshot = {};
try { snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8')); } catch { /* first run */ }

const changed = [];
const failed = [];
const next = { ...snapshot };

for (const path of pages) {
  try {
    const now = await fetchPage(path);
    const before = snapshot[path];
    if (!before) changed.push({ path, why: 'not reviewed yet', ...now });
    else if (before.updated !== now.updated || before.hash !== now.hash) changed.push({ path, why: `updated ${now.updated}`, ...now });
    next[path] = { ...now, reviewedAt: accept ? new Date().toISOString() : before?.reviewedAt };
  } catch (err) {
    failed.push({ path, error: err.message });
  }
}

for (const c of changed) console.log(`CHANGED  ${c.path}  (${c.why})  - ${c.title}`);
for (const f of failed) console.log(`FAILED   ${f.path}  ${f.error}`);
if (!changed.length && !failed.length) console.log(`All ${pages.length} pages unchanged since last review.`);

if (accept) {
  await writeFile(SNAPSHOT, JSON.stringify(next, null, 2) + '\n');
  console.log(`Recorded ${Object.keys(next).length} pages as reviewed.`);
} else if (changed.length || failed.length) {
  process.exitCode = 1;
}
