// Diagnostic: replicate the server-side fetch of the CIRCL manifest exactly.
const UA = 'HORUS-Intel/0.3 (+https://github.com; feed aggregator; fair-use OSINT)';
const t0 = Date.now();
try {
  const r = await fetch('https://www.circl.lu/doc/misp/feed-osint/hashes.csv', {
    headers: { 'User-Agent': UA, Accept: 'text/plain, */*' },
    signal: AbortSignal.timeout(80_000),
    cache: 'no-store',
  });
  console.log('status', r.status, 'ct', r.headers.get('content-type'), 'len', r.headers.get('content-length'));
  const text = await r.text();
  console.log('took', ((Date.now() - t0) / 1000).toFixed(1), 's, body chars', text.length);
  console.log('first 160:', JSON.stringify(text.slice(0, 160)));
  const hashes = text.split('\n').map((l) => l.trim().split(',')[0] ?? '').filter((l) => /^[a-f0-9]{64}$/.test(l));
  console.log('matched hashes:', hashes.length);
} catch (e) {
  console.log('FAILED after', ((Date.now() - t0) / 1000).toFixed(1), 's:', e.message, e.cause?.message ?? '');
}
