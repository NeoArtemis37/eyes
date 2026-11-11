// Vérification visuelle VLM des captures du MODE AUTO (glm-5v-turbo)
const ZAI = require('z-ai-web-dev-sdk').default;
const fs = require('fs');

const CHECKS = [
  ['auto20-seg-00-MODE_AUTO____MONUMENTS____MALI.png',
   'Capture d\'une carte satellite pendant une visite guidée. Vérifie: (1) une fiche ambre à droite avec le nom "Grande Mosquée de Djenné" et une description lisible? (2) une épingle/marqueur rouge clignotant sur la carte? (3) des bâtiments en relief 3D (vue inclinée)? Réponds en 3 points courts OUI/NON + détail.'],
  ['auto20-seg-03-MODE_AUTO____RSEAU____LES_FILAMENTS.png',
   'Vue sombre d\'un globe de menaces réseau avec des flèches indicatives cyan. Vérifie: (1) des étiquettes verre-gel avec flèches pointant des panneaux (FILTRES, THREAT FEED, DOCK)? (2) un bandeau "MODE AUTO" vert en haut? (3) des arcs rouges animés sur le globe? 3 points OUI/NON + détail.'],
  ['auto20-seg-04-MODE_AUTO____RSEAU____EXEMPLE.png',
   'Vérifie: (1) une fiche popup "THREAT ENDPOINT" ouverte (IP, type, sévérité)? (2) une flèche/étiquette "EXEMPLE CONCRET" pointant dessus? (3) le bandeau MODE AUTO vert? 3 points OUI/NON + détail.'],
  ['auto20-seg-07-MODE_AUTO____FUITES____BURKINA_FASO.png',
   'Vérifie: (1) un bandeau topline en haut du globe avec le drapeau Burkina Faso et une fuite (West African Resources / Deadlock)? (2) le globe centré sur l\'Afrique de l\'Ouest? (3) une carte descriptive en bas mentionnant Burkina Faso? 3 points OUI/NON + détail.'],
  ['auto20-seg-10-MODE_AUTO____RECON____ADRESSE.png',
   'Vérifie: (1) un dock RECON ouvert à droite avec des résultats de géocodage (10 Downing Street, coordonnées)? (2) une étiquette "OUTIL ADRESSE"? (3) le bandeau MODE AUTO? 3 points OUI/NON + détail.'],
  ['auto20-seg-11-MODE_AUTO____GRAPHE____ROYAUME-UNI.png',
   'Vérifie: (1) un graphe de force (nœuds colorés reliés) affiché en plein écran? (2) des nœuds de couleurs variées (rouge/vert/violet/ambre)? (3) une carte descriptive en bas expliquant le graphe du Royaume-Uni? 3 points OUI/NON + détail.'],
  ['auto20-seg-12-MODE_AUTO____PILOGUE.png',
   'Vérifie: (1) un écran sombre "en veille" avec le texte "CECI EST LA FIN DU VOYAGE"? (2) la citation "Un État est souverain lorsqu\'il contrôle son espace numérique et physique" lisible? 2 points OUI/NON + détail.'],
];

async function main() {
  const zai = await ZAI.create();
  for (const [file, prompt] of CHECKS) {
    const path = `/home/z/my-project/download/${file}`;
    try {
      const b64 = fs.readFileSync(path).toString('base64');
      const r = await zai.chat.completions.createVision({
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
            { type: 'text', text: prompt },
          ],
        }],
      });
      const txt = r.choices?.[0]?.message?.content ?? '(vide)';
      console.log(`\n=== ${file} ===\n${txt}`);
    } catch (e) {
      console.log(`\n=== ${file} === ERREUR: ${e.message}`);
    }
  }
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
