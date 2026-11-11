// VLM check du MUR MONDE (worldcams) via z-ai-web-dev-sdk
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const img = process.argv[2] ?? '/home/z/my-project/download/world-wall-open.png';
const prompt = process.argv[3] ?? `Décris ce mur vidéo de surveillance en mode MONDE : combien de tuiles, que voit-on sur les images (des vraies photos de lieux ?), quels badges/labels sont visibles (noms de lieux, heures locales, soleil/lune, drapeaux), les stats du header, la barre de filtres (recherche, catégories, pays), y a-t-il des problèmes de layout (chevauchements, coupures, éléments vides) ?`;

const b64 = fs.readFileSync(img).toString('base64');

async function main() {
  const zai = await ZAI.create();
  const res = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  console.log(res.choices?.[0]?.message?.content);
}

main().catch(e => console.error('VLM ERROR:', e.message));
