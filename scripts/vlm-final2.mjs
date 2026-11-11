import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
const b64 = fs.readFileSync('/home/z/my-project/download/final-zoom2-camera.png').toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: "Carte satellite centrée sur Paris après un clic caméra. Réponds en 3 points courts : 1) Voit-on Paris zoomé (niveau rue/ville) et le focus caméra Eiffel Tower dans une bande/strip en bas ? 2) Un marqueur ou une bulle caméra est-il visible ? 3) La carte est-elle nette et fluide (pas de tuiles manquantes/figées) ?" }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
