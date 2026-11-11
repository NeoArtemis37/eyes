import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/darknyx-recon-fiche.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Zoome sur le panneau RECON à droite. Décris précisément : 1) la ligne d'en-tête RECON TOOLKIT : quels éléments sont tronqués et pourquoi (largeur ?) ; 2) la ligne de l'adresse .onion : comment s'affiche le texte (tronqué ? superposé ? dans quelle couleur) ; 3) y a-t-il un VRAI chevauchement de pixels (deux textes l'un sur l'autre) ou seulement des textes coupés par le bord ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
