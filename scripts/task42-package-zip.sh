#!/bin/bash
# Task 42 — Zip final du projet HORUS / AES CERT v0.4.0
# Inclut : src, public, db, prisma, tests, docs (NOUVEAU), mini-services (sans
#          node_modules), scripts CODE uniquement, configs racine + .env + worklog.
# Exclut : node_modules, .next, .git, tool-results, upload, download, artefacts.
set -e
cd /home/z/my-project
ZIP=download/horus-aes-cert-v0.4.0.zip
LIST=scripts/ziplist.txt
rm -f "$ZIP" "$LIST"

# ── arborescences complètes ──
find src public db prisma tests docs -type f >> "$LIST" 2>/dev/null || true

# ── mini-services sans node_modules ──
find mini-services -type f -not -path "*/node_modules/*" >> "$LIST"

# ── scripts : uniquement les fichiers de code (outils dev/vérif) ──
find scripts -maxdepth 1 -type f \( \
  -name "*.sh" -o -name "*.py" -o -name "*.mjs" \
  -o -name "*.js" -o -name "*.cjs" -o -name "*.ts" \
\) >> "$LIST"

# ── fichiers racine utiles au fonctionnement ──
for f in package.json bun.lock tsconfig.json tailwind.config.ts \
         postcss.config.mjs next.config.ts eslint.config.mjs \
         components.json Caddyfile .env .gitignore worklog.md README.md; do
  [ -f "$f" ] && echo "$f" >> "$LIST"
done

# ── empaquetage ──
sort -u "$LIST" -o "$LIST"
zip -q "$ZIP" -@ < "$LIST"
rm -f "$LIST"

echo "=== ZIP CRÉÉ ==="
ls -lh "$ZIP"
echo "--- vérif intégrité ---"
unzip -t "$ZIP" | tail -1
echo "--- nouveaux fichiers présents ---"
unzip -l "$ZIP" | rg "NetHealth|docs/|README.md" || true
echo "--- fichiers : $(unzip -l "$ZIP" | tail -1) ---"
