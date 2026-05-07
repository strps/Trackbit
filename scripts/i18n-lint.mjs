#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const BUNDLE_ROOTS = [
  join(repoRoot, 'apps/frontend/src/i18n/locales'),
  join(repoRoot, 'apps/backend/src/i18n/locales'),
];

const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['es'];

let errorCount = 0;
let warnCount = 0;

const fmt = {
  err: (msg) => `\x1b[31m${msg}\x1b[0m`,
  warn: (msg) => `\x1b[33m${msg}\x1b[0m`,
  ok: (msg) => `\x1b[32m${msg}\x1b[0m`,
  dim: (msg) => `\x1b[2m${msg}\x1b[0m`,
};

function loadBundle(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkRoot(root) {
  const sourceDir = join(root, SOURCE_LOCALE);
  const namespaces = readdirSync(sourceDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

  console.log(fmt.dim(`\n→ ${relative(repoRoot, root)}`));

  for (const ns of namespaces) {
    const sourcePath = join(sourceDir, `${ns}.json`);
    const source = loadBundle(sourcePath);
    const sourceKeys = new Set(Object.keys(source));

    for (const target of TARGET_LOCALES) {
      const targetPath = join(root, target, `${ns}.json`);
      const rel = relative(repoRoot, targetPath);
      let bundle;
      try {
        bundle = loadBundle(targetPath);
      } catch {
        console.log(fmt.err(`  ✗ ${rel} — file missing or unreadable`));
        errorCount++;
        continue;
      }
      const targetKeys = new Set(Object.keys(bundle));

      const missing = [...sourceKeys].filter((k) => !targetKeys.has(k));
      const extra = [...targetKeys].filter((k) => !sourceKeys.has(k));
      const untranslated = [...sourceKeys].filter(
        (k) =>
          targetKeys.has(k) &&
          (bundle[k] === '' || bundle[k] === source[k]),
      );

      if (!missing.length && !extra.length && !untranslated.length) {
        console.log(fmt.ok(`  ✓ ${rel}`));
        continue;
      }

      console.log(`  ${rel}`);
      if (missing.length) {
        errorCount += missing.length;
        console.log(fmt.err(`    missing in ${target} (${missing.length}):`));
        for (const k of missing) console.log(fmt.err(`      - ${k}`));
      }
      if (extra.length) {
        warnCount += extra.length;
        console.log(fmt.warn(`    extra in ${target} (${extra.length}):`));
        for (const k of extra) console.log(fmt.warn(`      + ${k}`));
      }
      if (untranslated.length) {
        warnCount += untranslated.length;
        console.log(
          fmt.warn(`    likely untranslated in ${target} (${untranslated.length}):`),
        );
        for (const k of untranslated) console.log(fmt.warn(`      = ${k}`));
      }
    }
  }
}

for (const root of BUNDLE_ROOTS) checkRoot(root);

console.log('');
if (errorCount === 0) {
  console.log(fmt.ok(`All bundles in sync.${warnCount ? ` (${warnCount} warning${warnCount === 1 ? '' : 's'})` : ''}`));
  process.exit(0);
} else {
  console.log(
    fmt.err(`${errorCount} missing key${errorCount === 1 ? '' : 's'}`) +
      (warnCount ? `, ${warnCount} warning${warnCount === 1 ? '' : 's'}` : ''),
  );
  process.exit(1);
}
