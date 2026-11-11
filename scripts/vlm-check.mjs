import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const [,, file, question] = process.argv;
if (!file || !question) { console.error('usage: node vlm-check.mjs <file.png> <question>'); process.exit(1); }
const b64 = fs.readFileSync(file).toString('base64');
const zai = await ZAI.create();
const r = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: question }
  ]}]
});
console.log(r.choices?.[0]?.message?.content);
