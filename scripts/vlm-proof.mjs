import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/live-proof-1stzoom.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Carte satellite après clic sur une caméra Tokyo Shibuya. Réponds en 2 points courts : 1) Voit-on Tokyo zoomé niveau ville avec un marqueur/bulle caméra ? 2) La carte est-elle fluide et complète (pas de tuiles grises/figées) ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
