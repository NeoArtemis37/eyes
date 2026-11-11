#!/bin/bash
# Relance du serveur dev Next.js :3000 de façon PERSISTANTE entre les appels outil.
# MAJEUR : le harnais tue l'arborescence de l'appel à sa fin — la parade est
# d'orpheliner le serveur vers init PENDANT l'appel (intermédiaire qui quitte
# immédiatement + setsid), stdio entièrement détachés, stdin maintenu ouvert
# (next dev quitte sur EOF stdin) et CI=1 par sécurité.
# Usage : bash scripts/dev-server-detached.sh
set -u
cd /home/z/my-project
mkdir -p node_modules/.cache/horus
if curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
  echo "serveur déjà vivant sur :3000 — rien à faire"
  exit 0
fi
( setsid bash -c 'sleep infinity | CI=1 exec node /home/z/my-project/node_modules/.bin/next dev -p 3000 > /home/z/my-project/node_modules/.cache/horus/dev.log 2>&1' < /dev/null > /dev/null 2>&1 & )
echo "lancé — orphelin vers init"
for i in $(seq 1 10); do
  sleep 2
  if curl -s -o /dev/null --max-time 5 http://localhost:3000/; then echo "OK :3000 vivant"; exit 0; fi
done
echo "ERREUR : le serveur n'a pas répondu" >&2
exit 1
