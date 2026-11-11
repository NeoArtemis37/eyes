#!/usr/bin/env node
/* Détecte les fichiers jamais importés (orphelins) dans src/. */
const fs = require('fs');
const path = require('path');
const ROOT = '/home/z/my-project/src';
const exts = new Set(['.ts', '.tsx']);

const all = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (exts.has(path.extname(name))) all.push(p);
  }
})(ROOT);

const contents = new Map();
for (const p of all) contents.set(p, fs.readFileSync(p, 'utf8'));

const entry = (p) => /\/app\/.*(page|layout|route|error|loading|template|not-found)\.tsx?$/.test(p);

const orphans = [];
for (const [p, src] of contents) {
  if (entry(p)) continue;
  const base = path.basename(p).replace(/\.(ts|tsx)$/, '');
  let imported = false;
  for (const [q, other] of contents) {
    if (q === p) continue;
    const re = new RegExp(`[/'"]${base}['"]`);
    if (re.test(other)) {
      imported = true;
      break;
    }
  }
  if (!imported) orphans.push(p);
}
console.log(orphans.sort().join('\n'));
console.log(`--- ${orphans.length} orphelins`);
