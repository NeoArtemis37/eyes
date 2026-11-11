import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/final-zoom1-bamako.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Capture d'une carte satellite. Réponds en 3 points courts : 1) Voit-on une ville au niveau rue (zoom serré) avec un marqueur rouge ? 2) Le label BAMAKO est-il visible ? 3) Y a-t-il des signes de carte figée, tuiles manquantes ou chevauchement ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
