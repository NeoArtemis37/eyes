# Calcul exact de la durée du MODE AUTO (AutoTour.tsx, 15 étapes)
# Formules répliquées du code :
#   holdFor(text, extra)      = max(2600, 150 + len*33 + 2000 + extra)
#   holdForAtLeast(text, min) = max(min, 150 + len*33 + 2000)
#   warpCut(700) attend 420 ms ; warpCut(520) attend 312 ms
#   caméra : warp quick 312 + attente affichage réel (variable) + 10000 ms de regard (live)
#   fin : 2200 + frappe FINALE + 1900 + 5000 veille + 1100 extinction

def hold(text, extra=0):
    return max(2600, 150 + int(len(text) * 33) + 2000 + extra)

def hold_at_least(text, floor):
    return max(floor, 150 + int(len(text) * 33) + 2000)

t_depart = "Bienvenue, opérateur. Room tour autonome engagé : la console teste ses propres modules, en direct — inspection 3D des vols, réseau de caméras, monuments du Sahel, filaments réseau, fuites, RECON. Installez-vous."
t_vols = "Chaque avion émet sa position ADS-B en direct. En voici un suivi à l'instant : la fiche s'ouvre avec l'inspection 3D de l'appareil — silhouette en rotation sous les projecteurs, cap et vitesse réels."
t_cams = "Le réseau de caméras publiques : 5 flux HLS en ligne, pays différents. Chaque bulle attend que l'image s'affiche réellement, puis dix secondes pleines pour la regarder vivre."
m1 = "Zoom terminé sur Agadez, Niger : le minaret de banco de près de 30 mètres, le plus haut du monde dans sa matière. La fiche photo complète est à droite — époque, matériau, statut UNESCO."
m2 = "Deuxième arrêt, Djenné, Mali : le plus grand édifice en banco au monde, rebâti en 1907. Regardez les torons de palmier : échafaudage permanent pour la fête annuelle du crépissage."
m3 = "Troisième arrêt, Bobo-Dioulasso, Burkina Faso : chef-d'œuvre soudano-sahélien de 1893. Façades à torons, corniches de paille : une silhouette bien distincte des deux précédentes."
t_res = "Chaque arc du globe est une attaque réelle, captée en direct. Les flèches désignent les commandes : FILTRES à gauche, THREAT FEED à droite. Exemple à l'écran : cette infrastructure, fiche réelle."
t_f1 = "Premier filtre : C2 — ne restent sur le globe que les serveurs de commande et contrôle des malwares."
t_f2 = "Deuxième filtre : MALWARE — la console bascule de famille en une fraction de seconde. Deux filtres suffisent à cerner une campagne."
b1 = "Burkina Faso, fuite la plus récente : juillet 2026, le rançongiciel Deadlock publie les données internes de West African Resources — comptabilité, salaires, contrats bancaires. Sept secondes pour lire la fiche pays."
b2 = "Mali, la plus récente : février 2023, la BOA Mali subit une extorsion — dix millions de dollars exigés pour effacer les données des clients. Ministères, ambassades, hôtels et ONG figurent parmi les comptes visés."
b3 = "Niger, la plus récente : entre 2022 et 2024, les pertes financières liées aux cyberattaques bondissent de 70 % à 400 %. En réponse, l'État crée son Centre National de Cybersécurité, le CNAC."
t_recon = "RECON : on cherche une adresse — ici 10 Downing Street, Londres. Nominatim la géolocalise en quelques secondes et la carte pose son marqueur. La photo confirme la cible."
t_graph = "Et le graphe du Royaume-Uni relie attaquants et infrastructures : chaque couleur est une famille de menaces, chaque nœud une cible réelle. Dix secondes pour l'explorer des yeux."
finale = "« Un État est souverain lorsqu'il contrôle son espace numérique et physique. »"

N_CAMS = 5
PICK_FLIGHT_MS = 400    # 1er poll : les vols ADS-B sont déjà chargés
PICK_CAMS_MS = 800      # 2 polls : les cams HLS arrivent en flux continu
WARP = 420
WARP_QUICK = 312

def total(live_wait_ms):
    seg = {}
    seg['1  DÉPART'] = hold(t_depart)
    seg['2  VOLS 3D'] = WARP + PICK_FLIGHT_MS + hold(t_vols)
    seg['3  CAMÉRAS (5 × 10 s)'] = WARP + PICK_CAMS_MS + hold(t_cams) \
        + N_CAMS * (WARP_QUICK + live_wait_ms + 10000)
    seg['4-6  MONUMENTS ×3'] = 2000 + 3 * 2900 + hold(m1, 1200) + hold(m2, 1200) + hold(m3, 1200)
    seg['7  TRANSITION'] = 2000
    seg['8  RÉSEAU'] = hold(t_res)
    seg['9  FILTRES ×2'] = hold(t_f1) + hold(t_f2)
    seg['10-12  FUITES ×3 (7 s min)'] = hold_at_least(b1, 7000) + hold_at_least(b2, 7000) + hold_at_least(b3, 7000)
    seg['13  RECON'] = hold(t_recon)
    seg['14  GRAPHE UK (10 s min)'] = hold_at_least(t_graph, 10000)
    seg['15  FIN (citation + veille 5 s)'] = 2200 + 150 + int(len(finale) * 33) + 1900 + 5000 + 1100
    return seg

for label, lw in [('flux affiché VITE (~1,5 s)', 1500),
                  ('flux affiché NORMALEMENT (~2,5 s)', 2500),
                  ('flux affiché LENTEMENT (~6 s, labo)', 6000)]:
    seg = total(lw)
    s = sum(seg.values())
    print(f"\n=== SCÉNARIO : {label} ===")
    for k, v in seg.items():
        print(f"  {k:<34} {v/1000:6.1f} s")
    m, sec = divmod(round(s / 1000), 60)
    print(f"  {'TOTAL':<34} {m} min {sec:02d} s")
