#!/usr/bin/env node
/* Suppression conservatrice des lignes de commentaires dans src/.
   Règles :
   - retire les lignes ENTIÈRES de commentaires (double-slash, blocs slash-star, JSX)
   - préserve eslint-disable, @ts-*, <reference>
   - ne retire jamais à l'intérieur d'un template literal (suivi d'état backtick)
   - ne touche pas aux commentaires en fin de ligne (partagés avec du code)
   - .css : blocs pleine ligne uniquement */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/src';
const KEEP = [/eslint-disable/, /@ts-/, /<reference/];
const exts = new Set(['.ts', '.tsx', '.css']);

function strip(text, isCss) {
  const lines = text.split('\n');
  const out = [];
  let inBlock = false;
  let tplDepth = 0;
  for (const line of lines) {
    const t = line.trim();
    const startsComment = t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*');
    if (!inBlock && !isCss && !startsComment) {
      const backticks = (line.match(/`/g) || []).length;
      tplDepth = (tplDepth + backticks) % 2;
    }
    const guarded = KEEP.some((re) => re.test(t));
    if (inBlock) {
      if (t.includes('*/')) {
        inBlock = false;
        if (t.endsWith('*/') || t.endsWith('*/}')) out.push('');
      }
      continue;
    }
    if (tplDepth === 1 && !isCss) {
      out.push(line);
      continue;
    }
    if (guarded) {
      out.push(line);
      continue;
    }
    if (isCss) {
      if (t.startsWith('/*')) {
        if (t.includes('*/')) {
          if (t.endsWith('*/')) out.push('');
        } else inBlock = true;
        continue;
      }
      out.push(line);
      continue;
    }
    if (t.startsWith('//')) continue;
    if ((t.startsWith('{/*') || t.startsWith('/*')) && t.includes('*/')) {
      if (t.endsWith('*/') || t.endsWith('*/}')) continue;
    }
    if (t.startsWith('/*') || t.startsWith('{/*')) {
      inBlock = true;
      continue;
    }
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === '' && text.endsWith('\n')) out.pop();
  let res = out.join('\n');
  if (text.endsWith('\n') && !res.endsWith('\n')) res += '\n';
  res = res.replace(/\n{4,}/g, '\n\n\n');
  return res;
}

let touched = 0;
let removed = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (exts.has(path.extname(name))) {
      const src = fs.readFileSync(p, 'utf8');
      const isCss = path.extname(name) === '.css';
      const res = strip(src, isCss);
      if (res !== src) {
        const before = src.split('\n').length;
        const after = res.split('\n').length;
        removed += before - after;
        touched += 1;
        fs.writeFileSync(p, res);
      }
    }
  }
}
walk(ROOT);
console.log(`${touched} fichiers modifiés, ${removed} lignes de commentaires retirées`);
