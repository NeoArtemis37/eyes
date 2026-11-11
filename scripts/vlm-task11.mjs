// VLM check of the task11 cams-wall HLS screenshot via z-ai-web-dev-sdk
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const IMG = process.argv[2] || '/home/z/my-project/download/task11-cams-hls-wall.png';
const PROMPT = process.argv[3] ||
  'Décris ce mur vidéo de caméras IP : combien de tuiles, les noms/lieux des caméras visibles, les badges (FLUX HLS / YT LIVE / SON), les stats du header (X LIVE · X EN VIDÉO · X PAYS · X SOURCES). Les tuiles HLS affichent-elles une image vidéo de caméra de trafic (route, autoroute, scène réelle) ou un placeholder vide ? Y a-t-il des problèmes de layout (chevauchement, coupure) ?';

async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(IMG).toString('base64');
  const res = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });
  console.log(res.choices?.[0]?.message?.content);
}

main().catch(e => console.error('VLM ERROR:', e.message));
