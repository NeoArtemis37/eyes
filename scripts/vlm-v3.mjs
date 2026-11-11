import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/darknyx-v3-fiche.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Vue d'ensemble du THREAT INTEL avec un panneau RECON ouvert à droite. Réponds en 4 points TRÈS courts : 1) Le panneau RECON à droite est-il opaque (voit-on du texte animé transparaître À TRAVERS son fond) ? 2) Le bandeau rouge MENACES CRITIQUES en haut s'arrête-t-il AVANT le panneau RECON (pas de superposition) ? 3) L'en-tête RECON TOOLKIT + compteur + bouton ✕ sont-ils lisibles sans écrasement ? 4) Globalement : chevauchements restants oui/non ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
