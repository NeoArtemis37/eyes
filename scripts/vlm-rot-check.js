const ZAI = require('z-ai-web-dev-sdk').default || require('z-ai-web-dev-sdk');
const fs = require('fs');
async function check(file, prompt) {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(file).toString('base64');
  const r = await zai.chat.completions.createVision({
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  console.log('===', file.split('/').pop(), '===');
  console.log(r.choices[0].message.content);
}
(async () => {
  await check('/home/z/my-project/download/rot17-carte-b.png',
    'Décris cette capture de dashboard: (1) voit-on un globe terrestre 3D rond avec des continents? Lesquels sont visibles au centre? (2) la carte semble-t-elle nette et fonctionnelle (marqueurs, panneaux)? (3) cite le texte du bandeau supérieur. Reponds en francais, 3 lignes max.');
  await check('/home/z/my-project/download/rot17-reseau-b.png',
    'Décris cette capture: (1) voit-on un globe terrestre sombre avec des arcs colorés animés? Quels continents/arcs sont visibles? (2) les panneaux latéraux (FILTRES, DARK WEB) sont-ils lisibles sans chevauchement? (3) y a-t-il des artefacts visuels? Reponds en francais, 3 lignes max.');
})().catch(e => { console.error('VLM_FAIL', e.message); process.exit(1); });
