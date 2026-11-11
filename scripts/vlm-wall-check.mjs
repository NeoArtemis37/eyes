// VLM check of the final TV wall screenshot via z-ai-web-dev-sdk
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const b64 = fs.readFileSync('/home/z/my-project/download/task10-tvwall-final.png').toString('base64');

async function main() {
  const zai = await ZAI.create();
  const res = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          {
            type: 'text',
            text: 'Décris ce mur vidéo : combien de tuiles, quels noms de chaînes et badges (DIRECT 24/7 / REPLAY / HORS ANTENNE / CONNEXION), les stats du header, présence d un chip SON, y a-t-il des problèmes de layout (texte qui se chevauche, éléments coupés) ? Les tuiles affichent-elles des lecteurs vidéo ou des placeholders ?',
          },
        ],
      },
    ],
  });
  console.log(res.choices?.[0]?.message?.content);
}


main().catch(e => console.error('VLM ERROR:', e.message));
