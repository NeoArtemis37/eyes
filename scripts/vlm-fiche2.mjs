import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/darknyx-final-fiche.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Panneau RECON (droite) ouvert sur la fiche d'un groupe. Réponds en 3 points TRÈS courts : 1) L'en-tête RECON TOOLKIT s'affiche-t-il maintenant entièrement sans être écrasé par le bouton ✕ ? 2) L'adresse .onion se coupe-t-elle proprement avec des points de suspension (sans chevauchement) ? 3) Y a-t-il un VRAI chevauchement de texte quelque part dans le panneau ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
