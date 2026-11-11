const ZAI = require('z-ai-web-dev-sdk').default || require('z-ai-web-dev-sdk');
const fs = require('fs');
async function check(file, prompt) {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(file).toString('base64');
  const r = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      { type: 'text', text: prompt },
    ]}],
  });
  console.log('===', file.split('/').pop(), '===');
  console.log(r.choices[0].message.content);
}
(async () => {
  await check('/home/z/my-project/download/refonte-flux-sev.png',
    'Capture d\'un dashboard cyber. Regarde la colonne THREAT FEED a droite: (1) chaque ligne a-t-elle un petit liseré vertical colore a gauche et un numero de severite colore avec halo? (2) cite les couleurs distinctes que tu vois sur les lignes et les chips (noms de couleurs). (3) la lisibilite est-elle bonne, sans chevauchement? 3 lignes max, en francais.');
  await check('/home/z/my-project/download/refonte-flux-live.png',
    'Capture d\'un globe terrestre sombre de dashboard cyber: (1) quelles couleurs d\'arcs et de points vois-tu sur le globe? (2) le bandeau rouge MENACES CRITIQUES est-il propre? (3) les panneaux (FILTRES, DARK WEB, THREAT FEED) sont-ils harmonieux et lisibles? 3 lignes max, en francais.');
})().catch(e => { console.error('VLM_FAIL', e.message); process.exit(1); });
