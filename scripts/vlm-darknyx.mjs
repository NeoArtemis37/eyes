import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const zai = await ZAI.create();
async function check(img, prompt) {
  const b64 = fs.readFileSync(img).toString('base64');
  const r = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      { type: 'text', text: prompt }
    ]}]
  });
  console.log('===', img.split('/').pop(), '===');
  console.log(r.choices?.[0]?.message?.content);
}
await check('/home/z/my-project/download/darknyx-recon-fiche.png',
  "Capture d'un panneau tool RECON mode DARK WEB. Réponds en 4 points courts : 1) Le panneau à droite affiche-t-il la fiche d'un groupe rançongiciel (nom N0n, victimes) ? 2) Voit-on une adresse .onion avec badge UP et des TTPs MITRE (Initial Access, Execution…) ? 3) Y a-t-il des chevauchements de texte ou éléments coupés ? 4) L'esthétique sombre avec accents magenta paraît-elle lisible et pro ?");
await check('/home/z/my-project/download/darknyx-phishing-email.png',
  "Capture d'un analyseur d'emails suspects. Réponds en 3 points courts : 1) Voit-on un verdict PHISHING PROBABLE avec score 100 ? 2) Les signaux (Reply-To différent, domaine jetable, IP littérale, .exe) sont-ils lisibles ? 3) Layout : chevauchements ou coupures ?");
