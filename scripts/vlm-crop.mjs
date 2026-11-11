import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/darknyx-head-crop.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Zoom sur le haut d'un panneau. Transcris EXACTEMENT, ligne par ligne, le texte que tu vois (y compris ce qui est coupé, marque-le [COUPÉ]). Y a-t-il des lettres superposées l'une sur l'autre sur une même ligne ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
