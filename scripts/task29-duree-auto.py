# Durée du MODE AUTO avec les textes enrichis du pitch (Task 29)
# holdFor = max(2400, 150 + len*23 + 1600 + extra)
# holdForAtLeast = max(min, 150 + len*23 + 1600)

def hold(text, extra=0):
    return max(2400, 150 + int(len(text) * 23) + 1600 + extra)

def hold_at_least(text, floor):
    return max(floor, 150 + int(len(text) * 23) + 1600)

t_depart = "Bienvenue, opérateur. La guerre n’est plus seulement physique, ni purement numérique : elle est totale et hybride. Room tour autonome engagé — la console teste ses modules en direct : espace aérien, caméras du territoire, filaments réseau, fuites, RECON. Installez-vous."
t_vols = "Chaque avion émet sa position ADS-B en direct : tracking et surveillance dynamique de l'espace aérien. La fiche s'ouvre avec l'inspection 3D de l'appareil — silhouette en rotation sous les projecteurs, cap et vitesse réels."
t_cams = "Réseau de caméras : 5 flux HLS en direct. Des réseaux de vision par ordinateur — CNN — scrutent chaque point névralgique : aéroports, gares, marchés, espaces publics. Six secondes pleines de regard par flux."
t_cam_unit = "localisation inconnue — flux 1/5 : le cône vert trace l'angle de vue réel ; le CNN y traque le filtrage des entrées et tout comportement suspect. Six secondes en direct."
m1 = "Zoom terminé sur Agadez, Niger : le minaret de banco de près de 30 mètres, le plus haut du monde dans sa matière. La fiche photo complète est à droite — époque, matériau, statut UNESCO."
m2 = "Deuxième arrêt, Djenné, Mali : le plus grand édifice en banco au monde, rebâti en 1907. Regardez les torons de palmier : échafaudage permanent pour la fête annuelle du crépissage."
m3 = "Troisième arrêt, Bobo-Dioulasso, Burkina Faso : chef-d'œuvre soudano-sahélien de 1893. Façades à torons, corniches de paille : une silhouette bien distincte des deux précédentes."
t_res = "Chaque arc du globe est une attaque réelle, captée en direct. Le moteur de corrélation multicouche, propulsé par l'intelligence artificielle, croise les flux les plus complexes. FILTRES à gauche, THREAT FEED à droite — à l'écran, une fiche d'infrastructure réelle."
t_f1 = "Premier filtre : C2 — threat hunting : ne restent sur le globe que les serveurs de commande et contrôle des malwares."
t_f2 = "Deuxième filtre : MALWARE — la console bascule en une fraction de seconde : deux familles suffisent à cerner une campagne avant qu'elle ne devienne une crise nationale."
b1 = "Burkina Faso, la plus récente : juillet 2026 — le rançongiciel Deadlock publie comptabilité, salaires et contrats bancaires de West African Resources. Une menace germinante devenue crise nationale."
b2 = "Mali, la plus récente : février 2023 — la BOA Mali subit une extorsion, dix millions de dollars exigés ; ministères, ambassades et ONG parmi les comptes visés."
b3 = "Niger, la plus récente : de 2022 à 2024, les pertes liées aux cyberattaques bondissent de 70 % à 400 % — l'État riposte en créant son CNAC."
t_recon = "RECON : l'OSINT engage le ciblage — ici 10 Downing Street, Londres. Nominatim géolocalise l'adresse en quelques secondes, la carte pose son marqueur, la photo confirme la cible. L'interception avant la crise."
t_graph = "Le graphe du Royaume-Uni relie attaquants et infrastructures dans une cartographie unifiée : chaque couleur est une famille de menaces, chaque nœud une cible réelle. Dix secondes pour lire la menace en formation."
finale = "Nous n'offrons pas de la surveillance : nous donnons la supériorité informationnelle. Un État est souverain lorsqu'il contrôle son espace numérique et physique."

N_CAMS, PICK_FL, PICK_CA = 5, 400, 800
WARP, WARP_Q = 420, 312

def total(live_ms):
    seg = {}
    seg['1  Départ'] = hold(t_depart)
    seg['2  Vols 3D'] = WARP + PICK_FL + hold(t_vols)
    seg['3  Caméras (5 x 6 s)'] = WARP + PICK_CA + hold(t_cams) + N_CAMS * (WARP_Q + live_ms + 6000)
    seg['4-6  Monuments x3'] = 1600 + 3 * 2400 + hold(m1, 800) + hold(m2, 800) + hold(m3, 800)
    seg['7  Transition'] = 1700
    seg['8  Réseau'] = hold(t_res)
    seg['9  Filtres x2'] = hold(t_f1) + hold(t_f2)
    seg['10-12  Fuites x3 (5 s min)'] = hold_at_least(b1, 5000) + hold_at_least(b2, 5000) + hold_at_least(b3, 5000)
    seg['13  Recon'] = hold(t_recon)
    seg['14  Graphe UK (10 s min)'] = hold_at_least(t_graph, 10000)
    seg['15  Fin (citation + veille 5 s)'] = 1900 + 150 + int(len(finale) * 23) + 1700 + 5000 + 900
    return seg

for label, lw in [('flux VITE (~1,2 s)', 1200),
                  ('flux NORMAL (~2,5 s)', 2500),
                  ('flux LENT (~6 s, labo)', 6000)]:
    seg = total(lw)
    s = sum(seg.values())
    print(f"\n=== {label} ===")
    for k, v in seg.items():
        print(f"  {k:<30} {v/1000:6.1f} s")
    m, sec = divmod(round(s / 1000), 60)
    print(f"  {'TOTAL':<30} {m} min {sec:02d} s")
