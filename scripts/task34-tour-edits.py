#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Task 34 — Réordonnancement du tour AutoTour :
   - suppression de l'étape VOLS (avion) de la démo
   - caméras 3 -> 5
   - exemple RECON robuste (adresse + shodan) via driveRecon à réessais
   - graphe à pays aléatoire (commande graphRandom + événement retour)
   - narration alignée sur le pitch (compartimentation, SOC, souveraineté)
Chaque remplacement est vérifié (exactement 1 occurrence) sinon échec net.
"""
import re
import sys

PATH = '/home/z/my-project/src/components/command-center/AutoTour.tsx'
src = open(PATH, encoding='utf-8').read()
orig = src
fails = []

def rep(name, old, new, count=1, regex=False):
    global src
    if regex:
        pat = re.compile(old, re.DOTALL)
        found = len(pat.findall(src))
        if found != count:
            fails.append(f'{name}: {found} occurrence(s) regex, attendu {count}')
            return
        src = pat.sub(lambda m: new, src, count=count)
    else:
        found = src.count(old)
        if found != count:
            fails.append(f'{name}: {found} occurrence(s) exactes, attendu {count}')
            return
        src = src.replace(old, new, count)

# ── R1 · helper waitGraphPick + nouveau texte DÉPART ─────────────────
rep('R1 depart', """        setStep({ idx: 1, label: 'DÉPART' });
        const tDepart = 'Bienvenue, opérateur. La guerre n’est plus seulement physique, ni purement numérique : elle est totale et hybride. Room tour autonome engagé — la console teste ses modules en direct : espace aérien, caméras du territoire, filaments réseau, fuites, RECON. Installez-vous.';""",
"""        // Pays tiré au hasard pour le graphe : NetworkLayout répond par
        // événement avec le pays choisi (nom + ISO + volume d'événements).
        const waitGraphPick = (capMs: number) =>
          new Promise<{ key: string; name: string; iso2: string; n: number } | null>((resolve) => {
            let done = false;
            const on = (e: Event) => {
              const d = (e as CustomEvent).detail as { key?: string } | undefined;
              if (!done && d?.key) {
                done = true;
                window.removeEventListener('horus:tour-graph-pick', on);
                resolve(d as { key: string; name: string; iso2: string; n: number });
              }
            };
            window.addEventListener('horus:tour-graph-pick', on);
            window.setTimeout(() => {
              if (!done) {
                done = true;
                window.removeEventListener('horus:tour-graph-pick', on);
                resolve(null);
              }
            }, capMs);
          });

        setStep({ idx: 1, label: 'DÉPART' });
        const tDepart = 'Bienvenue, opérateur. La guerre n’est plus seulement physique, ni purement numérique : elle est totale et hybride. Le vrai problème n’est pas l’absence d’outils, mais leur compartimentation. Room tour autonome engagé — une seule console croise tous les flux : caméras du territoire, monuments nationaux, filaments réseau, fuites de données, RECON OSINT, graphe de menace. Installez-vous.';""")

# ── R2 · suppression du bloc VOLS (commentaire -> commentaire CAMÉRAS) ─
rep('R2 vols supprimé', r"        // ── 2 · VOLS [^\n]*\n.*?        // ── 3 · CAMÉRAS [^\n]*\n",
"""        // ── 2 · CAMÉRAS ────────────────────────────────────────────
        // (La partie AVION a été retirée de la démo sur demande : le module
        // VOLS reste disponible en manuel depuis la console.)
""", regex=True)

# ── R3 · 5 caméras au lieu de 3 ─────────────────────────────────────
rep('R3 cams 5', """          // 3 flux (et non 5) : la présentation reste dynamique sans
          // dépasser sur le temps — chaque flux garde ses 6 s pleines.
          () => { const c = pickCameras(pointsRef.current, 3); return c.length > 0 ? c : null; },""",
"""          // 5 flux : la démo montre l'étendue du maillage territorial —
          // chaque flux garde ses 6 s pleines de regard.
          () => { const c = pickCameras(pointsRef.current, 5); return c.length > 0 ? c : null; },""")

# ── R4 · texte cams aligné pitch ────────────────────────────────────
rep('R4 tCams', """          ? `Réseau de caméras : ${cams.length} flux HLS en direct. Des réseaux de vision par ordinateur — CNN — scrutent chaque point névralgique : aéroports, gares, marchés, espaces publics. Six secondes pleines de regard par flux.`""",
"""          ? `Surveillance du territoire : ${cams.length} flux HLS en direct. Des réseaux de vision par ordinateur — CNN — scrutent chaque point névralgique : aéroports, frontières, marchés, espaces publics. Détection immédiate, réponse rapide : nos infrastructures vitales restent sanctuarisées. Six secondes de regard par flux.`""")

# ── R5 · renumérotation CAMÉRAS 3 -> 2 ──────────────────────────────
rep('R5 idx cams', "setStep({ idx: 3, label: 'CAMÉRAS' });", "setStep({ idx: 2, label: 'CAMÉRAS' });")

# ── R6 · renumérotation MONUMENTS 4 -> 3 ────────────────────────────
rep('R6a idx mon', "setStep({ idx: 4, label: 'MONUMENTS' });", "setStep({ idx: 3, label: 'MONUMENTS' });")
rep('R6b idx mon loop', "setStep({ idx: 4 + m, label: `MONUMENT · ${M.isoName}` });", "setStep({ idx: 3 + m, label: `MONUMENT · ${M.isoName}` });")

# ── R7 · inter monuments : angle souveraineté ────────────────────────
rep('R7 inter mon', "sub: 'Géospatialisation du territoire · angle drone 3D',",
    "sub: 'Angle drone 3D · souveraineté sur le territoire',")

# ── R8 · TRANSITION 7 -> 6 + fusion des flux ────────────────────────
rep('R8a idx trans', "setStep({ idx: 7, label: 'TRANSITION' });", "setStep({ idx: 6, label: 'TRANSITION' });")
rep('R8b sub trans', "sub: 'Threat hunting · intercepter les menaces germinantes',",
    "sub: 'Fusion de tous les flux · la compartimentation est finie',")

# ── R9 · RÉSEAU 8 -> 7 + ingestion massive ──────────────────────────
rep('R9a idx res', "setStep({ idx: 8, label: 'RÉSEAU' });", "setStep({ idx: 7, label: 'RÉSEAU' });")
rep('R9b tRes', r"const tRes = 'Chaque arc du globe est une attaque réelle, captée en direct\. Le moteur de corrélation multicouche, propulsé par l\\'intelligence artificielle, croise les flux les plus complexes\. À droite, le THREAT FEED : chaque ligne est un événement réel\. Au centre, la fiche d\\'une infrastructure attaquée\.';",
"""const tRes = 'Chaque arc du globe est une attaque réelle, captée en direct. La console ingère un volume massif de données et croise l\\'ensemble des flux du territoire : plus de vision morcelée, une seule image. À droite, le THREAT FEED — chaque ligne est un événement réel. Au centre, la fiche d\\'une infrastructure attaquée.';""", regex=True)

# ── R10 · FILTRES 9 -> 8 + SOC / désamorcer ─────────────────────────
rep('R10a idx filtres', "setStep({ idx: 9, label: 'FILTRES' });", "setStep({ idx: 8, label: 'FILTRES' });")
rep('R10b tF1', "const tF1 = 'Premier filtre : C2 — threat hunting : ne restent sur le globe que les serveurs de commande et contrôle des malwares.';",
    "const tF1 = 'Premier filtre : C2 — l\\'arme des analystes SOC et threat hunters : ne restent sur le globe que les serveurs de commande et contrôle des malwares.';")
rep('R10c tF2', "const tF2 = 'Deuxième filtre : MALWARE — la console bascule en une fraction de seconde : deux familles suffisent à cerner une campagne avant qu\\'elle ne devienne une crise nationale.';",
    "const tF2 = 'Deuxième filtre : MALWARE — la console bascule en une fraction de seconde : deux familles suffisent à désamorcer une campagne avant qu\\'elle ne devienne une crise nationale.';")

# ── R11 · FUITES 10+b -> 9+b ─────────────────────────────────────────
rep('R11 idx fuites', "setStep({ idx: 10 + b, label: `FUITES · ${B.name.toUpperCase()}` });",
    "setStep({ idx: 9 + b, label: `FUITES · ${B.name.toUpperCase()}` });")
rep('R11b com fuites', "── 10-12 · FUITES", "── 9-11 · FUITES")

# ── R12 · RECON : deux exemples réels (adresse + shodan) ────────────
rep('R12 recon', r"        // ── 13 · RECON [^\n]*\n        setStep\(\{ idx: 13, label: 'RECON' \}\);\n        net\(\{ cmd: 'recon', open: true, mode: 'ciblage' \}\);\n        const tRecon = 'RECON : l\\'OSINT engage le ciblage — ici 10 Downing Street, Londres\. Nominatim géolocalise l\\'adresse en quelques secondes, la carte pose son marqueur, la photo confirme la cible\. L\\'interception avant la crise\.';\n        setCard\(\{\n          icon: <Search className=\"w-4 h-4\" />,\n          title: 'RECON · géolocalisation d\\'adresse',\n          body: tRecon,\n          photo: '/place/downing\.jpg',\n        \}\);\n        setArrows\(\[\n          \{\n            sel: '\[data-tour=\"net-recon\"\]',\n            side: 'left',\n            title: 'OUTIL ADRESSE',\n            body: 'Nominatim/OpenStreetMap renvoie coordonnées \+ contexte\.',\n          \},\n        \]\);\n        driveReconAdresse\('10 Downing Street, London'\);\n        await holdFor\(tRecon\);\n        setArrows\(\[\]\);\n        net\(\{ cmd: 'recon', open: false \}\);",
"""        // ── 12 · RECON · exemple n°1 : ciblage d'adresse en direct ──
        // L'exemple doit APPARAÎTRE pendant la démo : driveRecon réessaie
        // jusqu'à ce que le dock soit réellement monté dans le DOM
        // (l'ancienne version abandonnait silencieusement).
        setStep({ idx: 12, label: 'RECON · CIBLAGE' });
        net({ cmd: 'recon', open: true, mode: 'ciblage' });
        const tRecon = 'RECON, le dock OSINT des cellules stratégiques : dix-huit outils — SHODAN, DNS, WHOIS, CVE, sanctions, e-mails compromis, adresses… Exemple en direct : 10 Downing Street, Londres. Nominatim renvoie coordonnées et contexte en quelques secondes — la cible est qualifiée avant tout engagement.';
        setCard({
          icon: <Search className="w-4 h-4" />,
          title: 'RECON · ciblage d’adresse',
          body: tRecon,
          photo: '/place/downing.jpg',
        });
        setArrows([
          {
            sel: '[data-tour="net-recon"]',
            side: 'left',
            title: 'RECON · TOOLKIT',
            body: '18 outils OSINT · l’adresse se géolocalise en direct.',
          },
        ]);
        driveRecon('adresse', '10 Downing Street, London');
        await holdFor(tRecon);
        chk();

        // ── 13 · RECON · exemple n°2 : exposition d'infrastructure ──
        setStep({ idx: 13, label: 'RECON · SHODAN' });
        const tShodan = 'Deuxième exemple : SHODAN interroge l’exposition d’une infrastructure en une requête — ports ouverts, services, hostnames. Ici 8.8.8.8, le DNS public de Google : deux ports exposés, risque faible. La même mécanique qualifie n’importe quelle adresse hostile.';
        setCard({
          icon: <Scan className="w-4 h-4" />,
          title: 'RECON · exposition d’infrastructure',
          body: tShodan,
        });
        driveRecon('shodan', '8.8.8.8');
        await holdFor(tShodan);
        chk();
        setArrows([]);
        net({ cmd: 'recon', open: false });""", regex=True)

# ── R13 · GRAPHE : pays aléatoire ───────────────────────────────────
rep('R13 graph', r"        // ── 14 · GRAPHE [^\n]*\n        // Pleine scène pour le graphe : aucune box latérale ouverte\.\n        setStep\(\{ idx: 14, label: 'GRAPHE' \}\);\n        net\(\{ cmd: 'panels', p: \{ filtres: false, feed: false, talkers: false, darkweb: false \} \}\);\n        net\(\{ cmd: 'country', c: 'united kingdom' \}\);\n        net\(\{ cmd: 'view', v: 'graph' \}\);\n        const tGraph = 'Le graphe du Royaume-Uni relie attaquants et infrastructures dans une cartographie unifiée : chaque couleur est une famille de menaces, chaque nœud une cible réelle\. Dix secondes pour lire la menace en formation\.';\n        setCard\(\{\n          icon: <BarChart3 className=\"w-4 h-4\" />,\n          title: 'Graphe du Royaume-Uni',\n          body: tGraph,\n        \}\);\n        await holdForAtLeast\(tGraph, 10000\);",
"""        // ── 14 · GRAPHE · un théâtre tiré au hasard à chaque démo ──
        // Pleine scène pour le graphe : aucune box latérale ouverte.
        setStep({ idx: 14, label: 'GRAPHE' });
        net({ cmd: 'panels', p: { filtres: false, feed: false, talkers: false, darkweb: false } });
        // Le pays est tiré au hasard parmi les plus observés du flux :
        // chaque présentation montre un théâtre différent.
        const pickP = waitGraphPick(2500);
        net({ cmd: 'graphRandom' });
        const pick = await pickP;
        const gKey = pick?.key ?? GRAPH_FALLBACKS[Math.floor(Math.random() * GRAPH_FALLBACKS.length)];
        const gName = FR_COUNTRY[gKey] ?? `de ${pick?.name ?? gKey}`;
        const gFlag = flagOf(pick?.iso2 ?? '');
        if (!pick) {
          net({ cmd: 'country', c: gKey });
          net({ cmd: 'view', v: 'graph' });
        }
        const tGraph = `Le graphe ${gName} — un théâtre tiré au hasard à chaque présentation — relie attaquants et infrastructures dans une cartographie unifiée : chaque couleur est une famille de menaces, chaque nœud une cible réelle. Dix secondes pour lire la menace en formation.`;
        setCard({
          icon: <BarChart3 className="w-4 h-4" />,
          title: `Graphe ${gName} ${gFlag}`,
          body: tGraph,
        });
        await holdForAtLeast(tGraph, 10000);""", regex=True)

if fails:
    print('ÉCHECS :')
    for f in fails:
        print(' -', f)
    sys.exit(1)

open(PATH, 'w', encoding='utf-8').write(src)
print('OK — toutes les modifications appliquées.')
print('Longueur :', len(orig), '->', len(src))
