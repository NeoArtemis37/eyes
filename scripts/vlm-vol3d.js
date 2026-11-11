const ZAI = require('z-ai-web-dev-sdk').default;
const fs = require('fs');
async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync('/home/z/my-project/download/auto20-vol3d-run6.png').toString('base64');
  const r = await zai.chat.completions.createVision({
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        { type: 'text', text: "Capture d'une fiche d'inspection de vol. Vérifie précisément: (1) un avion 3D rendu en WebGL est-il visible au centre (fuselage, ailes, empennage, moteurs, feux)? (2) les éléments HUD: chip 'VUE 3D', télémétrie FL/vitesse/cap en bas? (3) l'avion a-t-il l'air 3D volumétrique (perspective, éclairage) plutôt qu'un dessin plat? Décris ce que tu vois en 4-5 phrases." },
      ],
    }],
  });
  console.log(r.choices?.[0]?.message?.content ?? '(vide)');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
