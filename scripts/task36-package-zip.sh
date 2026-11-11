#!/bin/bash
# Task 36 (recréé en Task 41 après rollback du sandbox) — Zip final du code
# complet du projet AES CERT (HORUS).
# Inclut : src, public (dont public/maplibre : bundles worker v6 requis),
#          db, prisma, tests, mini-services (sans node_modules),
#          scripts CODE uniquement, configs racine + .env + worklog.
# Exclut : node_modules, .next, .git, tool-results, eyeofview (vieux
#          snapshot), upload, download (captures), artefacts binaires.
set -e
cd /home/z/my-project
ZIP=download/aes-cert-console-final.zip
LIST=scripts/ziplist.txt
rm -f "$ZIP" "$LIST"

# ── arborescences complètes ──
find src public db prisma tests -type f >> "$LIST" 2>/dev/null || true

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
         components.json Caddyfile .env .gitignore worklog.md; do
  [ -f "$f" ] && echo "$f" >> "$LIST"
done

# ── empaquetage ──
sort -u "$LIST" -o "$LIST"
zip -q "$ZIP" -@ < "$LIST"
rm -f "$LIST"

echo "=== ZIP CRÉÉ ==="
ls -lh "$ZIP"
echo "--- contenu (racine) ---"
unzip -l "$ZIP" | rg "src/|public/|db/|prisma/" -c || true
unzip -l "$ZIP" | head -6
echo "--- fichiers : $(unzip -l "$ZIP" | tail -1) ---"
echo "--- vérif intégrité ---"
unzip -t "$ZIP" | tail -1
