import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/darknyx-final-v2.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Vue THREAT INTEL avec panneau RECON DARK WEB ouvert à droite. Réponds en 3 points TRÈS courts : 1) Le panneau montre-t-il la fiche du groupe N0n avec son adresse .onion UP et les TTPs MITRE de façon lisible ? 2) Le bandeau rouge du haut s'arrête-t-il proprement avant le panneau ? 3) Note globale /10 pour la lisibilité et l'aspect professionnel." }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
