#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// check-concept-frontmatter
//
// Every concept page's YAML frontmatter must PARSE and must carry the four
// fields the consuming registry treats as required.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────
//
// Measured in production 2026-08-26: `https://xema.dev/system/concepts` served
// an EMPTY list, and had for as long as the offending commit was live. Cause:
//
//   Concept frontmatter invalid in 'xema-os/concepts/agent':
//     YAML parse error: Nested mappings are not allowed in compact mappings
//     summary: The unified actor primitive: identity, prompt, …
//
// An unquoted YAML scalar containing `: ` is a nested mapping, not a string.
// One document, one missing pair of quotes.
//
// The blast radius is what makes this worth a gate. `ConceptRegistryService`
// loads ALL concepts and projects them as one `XemaObject` set; a single
// unparseable file throws `ConceptFrontmatterInvalidError`, the whole
// projection publish fails, and `object-registry-api` — an in-memory cache
// with no durable store — therefore holds ZERO concepts. Every concept
// disappears from the product because of one file, and the page still returns
// 200, so nothing external looks broken.
//
// The fail-fast is CORRECT and is not what this changes: a half-published
// concept set would be worse than none. What was missing is that the failure
// happened at RUNTIME, in a service log, in a different repository from the
// content that caused it. This moves it to the commit that introduces it.
//
// ── SCOPE ─────────────────────────────────────────────────────────────────
//
// The concept tree only. Other content under `content/` is rendered as pages
// and has no frontmatter contract to hold it to — asserting one there would
// be inventing a rule rather than enforcing an existing one.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONCEPT_ROOT = join(ROOT, 'content', 'xema-os', 'concepts');

/**
 * Value-identical to `REQUIRED_FRONTMATTER_FIELDS` in the consuming
 * `concept-registry.service.ts`. Stated here rather than imported because this
 * gate must run from a bare checkout of THIS repository, which does not depend
 * on the service that owns that constant.
 */
const REQUIRED_FIELDS = ['slug', 'title', 'summary', 'stability'];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

function conceptFiles() {
  if (!existsSync(CONCEPT_ROOT)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith('.md')) out.push(abs);
    }
  };
  walk(CONCEPT_ROOT);
  return out.sort();
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  const files = conceptFiles();

  // An empty scan must never read as a pass: a moved content tree would
  // otherwise silently retire this gate while the failure it prevents stays
  // exactly as reachable.
  if (files.length === 0) {
    console.error(
      `❌ check-concept-frontmatter: found ZERO concept pages under ` +
        `${relative(ROOT, CONCEPT_ROOT)}. This run asserted nothing. Fix the path — ` +
        'an empty scan is a failure, not a pass.',
    );
    process.exit(1);
  }

  const findings = [];
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const match = FRONTMATTER.exec(readFileSync(abs, 'utf8'));
    if (!match) {
      findings.push({ rel, reason: 'no YAML frontmatter block' });
      continue;
    }
    let parsed;
    try {
      parsed = yaml.load(match[1]);
    } catch (error) {
      findings.push({ rel, reason: `YAML parse error: ${error.message.split('\n')[0]}` });
      continue;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      findings.push({ rel, reason: 'frontmatter is not a mapping' });
      continue;
    }
    const missing = REQUIRED_FIELDS.filter(
      (f) => parsed[f] === undefined || parsed[f] === null || parsed[f] === '',
    );
    if (missing.length > 0) {
      findings.push({ rel, reason: `missing required field(s): ${missing.join(', ')}` });
    }
  }

  if (findings.length > 0) {
    console.error(
      `❌ check-concept-frontmatter: ${findings.length} of ${files.length} concept page(s) ` +
        'would break the concept projection. The registry loads every concept as ONE set, ' +
        'so a single bad file empties the concept list product-wide — and the page still ' +
        'returns 200, so nothing outside the service log looks wrong.\n',
    );
    for (const { rel, reason } of findings) {
      console.error(`  ${rel}\n    ${reason}\n`);
    }
    console.error(
      '  Most common cause: an unquoted value containing `: `. YAML reads that as a nested\n' +
        '  mapping. Wrap the value in double quotes.\n',
    );
    process.exit(1);
  }

  console.log(
    `✓ check-concept-frontmatter: ${files.length} concept page(s) parse and carry ` +
      `${REQUIRED_FIELDS.join(', ')}.`,
  );
}

function selfTest() {
  const cases = [
    { name: 'a quoted colon value is fine', fm: 'slug: a\ntitle: A\nsummary: "x: y"\nstability: stable', expect: 'ok' },
    { name: 'an UNQUOTED colon value is a finding', fm: 'slug: a\ntitle: A\nsummary: x: y\nstability: stable', expect: 'parse' },
    { name: 'a missing required field is a finding', fm: 'slug: a\ntitle: A\nstability: stable', expect: 'missing' },
    { name: 'an empty required field is a finding', fm: 'slug: a\ntitle: A\nsummary: ""\nstability: stable', expect: 'missing' },
    { name: 'a complete mapping passes', fm: 'slug: a\ntitle: A\nsummary: s\nstability: stable', expect: 'ok' },
  ];
  let failed = 0;
  for (const c of cases) {
    let got = 'ok';
    let parsed;
    try {
      parsed = yaml.load(c.fm);
    } catch {
      got = 'parse';
    }
    if (got === 'ok') {
      const missing = REQUIRED_FIELDS.filter(
        (f) => parsed[f] === undefined || parsed[f] === null || parsed[f] === '',
      );
      if (missing.length > 0) got = 'missing';
    }
    const ok = got === c.expect;
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${c.name} → ${got} (expected ${c.expect})`);
  }
  if (failed > 0) {
    console.error(`❌ self-test: ${failed} case(s) failed.`);
    process.exit(1);
  }
  console.log(`✓ self-test: ${cases.length}/${cases.length}`);
}

main();
