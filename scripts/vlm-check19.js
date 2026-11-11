// VLM check · glm-5v-turbo sur les captures Task 19
const ZAI = require('z-ai-web-dev-sdk').default;
const fs = require('fs');

async function ask(file, prompt) {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(file).toString('base64');
  const res = await zai.chat.completions.createVision({
    model: 'glm-5v-turbo',
    messages: [
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        { type: 'text', text: prompt },
      ] },
    ],
  });
  return res.choices[0].message.content;
}

(async () => {
  const q = process.argv[2];
  const p = process.argv[3];
  try {
    const r = await ask(q, p);
    console.log('=== VLM ===');
    console.log(r);
  } catch (e) {
    console.error('ERR', String(e).slice(0, 300));
    process.exit(1);
  }
})();
