// Debug the Node fetch vs curl difference for YouTube /channel/UC.../live
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const cid = 'UCEXGDNclvmg6RW0vipJYsTQ';

async function test(name, init) {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${cid}/live`, init);
    const html = await res.text();
    const idx = html.indexOf('ytInitialPlayerResponse');
    const seg = idx >= 0 ? html.slice(idx, idx + 3000) : html.slice(0, 3000);
    const vid = seg.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    console.log(
      `${name}: status=${res.status} len=${html.length} finalURL=${res.url.slice(0, 80)} playerIdx=${idx} videoId=${vid ? vid[1] : 'NONE'}`
    );
    if (!vid) {
      // dump hints
      const title = html.match(/<title>([^<]{0,90})/);
      console.log(`   title=${title ? title[1] : 'none'} consent=${html.includes('consent.youtube')} botcheck=${html.includes('Sign in to confirm')}`);
      console.log('   head:', html.slice(0, 200).replace(/\n/g, ' '));
    }
  } catch (e) {
    console.log(`${name}: FETCH ERROR ${e.message}`);
  }
}

(async () => {
  await test('plain-node-fetch', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8' },
    redirect: 'follow',
  });
  await test('minimal', { headers: { 'User-Agent': UA } });
  await test('full-browser-headers', {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
  });
})();
