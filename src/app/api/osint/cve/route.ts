
import { fetchJson, isValidCve, errorResponse } from '@/lib/sb-fetch';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cveRaw = url.searchParams.get('cve')?.trim() || '';
  if (!cveRaw) return errorResponse('Missing ?cve=', 400);
  if (!isValidCve(cveRaw)) return errorResponse('Invalid CVE format (expected CVE-YYYY-NNNN+)', 400);

  const cveId = cveRaw.toUpperCase();

  const mitre = await fetchJson<any>(`https://cveawg.mitre.org/api/cve/${encodeURIComponent(cveId)}`, { timeout: 9000 });
  if (mitre?.cveMetadata) {
    const meta = mitre.cveMetadata;
    let desc = '';
    const cna = (mitre.containers || {}).cna || {};
    for (const block of cna.descriptions || []) {
      if (block.lang === 'en') { desc = block.value || desc; break; }
    }
    const metrics = cna.metrics || [];
    let cvss: any = null;
    if (metrics.length > 0) {
      const m = metrics[0];
      cvss = m.cvssV3_1 || m.cvssV3_0 || m.cvssV2 || null;
    }
    const references = (cna.references || []).slice(0, 8).map((r: any) => ({ url: r.url, source: r.source || '' }));
    const weak = (cna.weaknesses || []).flatMap((w: any) => (w.description || []).map((d: any) => d.value)).filter(Boolean);
    return Response.json({
      id: meta.cveId || cveId,
      state: meta.state,
      published: meta.datePublished,
      updated: meta.dateUpdated,
      description: desc || 'No description available.',
      cvss: cvss ? { version: cvss.version, baseScore: cvss.baseScore, baseSeverity: cvss.baseSeverity, vectorString: cvss.vectorString } : null,
      cwe: weak,
      references,
      source: 'MITRE CVE Program (cveawg)',
      timestamp: Date.now(),
    });
  }

  const circl = await fetchJson<any>(`https://cve.circl.lu/api/cve/${encodeURIComponent(cveId)}`, { timeout: 8000 });
  if (circl && !circl.message) {
    return Response.json({
      id: circl.id || cveId,
      description: circl.summary || 'No description available.',
      cvss: circl.cvss ? (circl.cvss.endsWith('-') ? null : parseFloat(circl.cvss)) : null,
      references: (circl.references || []).slice(0, 5),
      source: 'CIRCL CVE API (fallback)',
      timestamp: Date.now(),
    });
  }

  return errorResponse('CVE not found', 404);
}
