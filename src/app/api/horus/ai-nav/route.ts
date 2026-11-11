
import { NextRequest, NextResponse } from 'next/server';

import { normalizeCommand } from '@/lib/horus/cmd/normalize';
import { parseOrder, type ParsedOrder } from '@/lib/horus/cmd/parser';
import { geocodePlace, type GeoCandidate } from '@/lib/horus/cmd/geocode';
import { resolveTrack, selfLocate, describeTrack } from '@/lib/horus/cmd/resolve';

export const dynamic = 'force-dynamic';


type Action = Record<string, unknown> & { action: string };

export interface DisambiguationOption {
  index: number;
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  zoom: number;
  type: string;
  category: string;
  importance: number;
}

interface ApiResponse {
  actions: Action[];
  reply: string;
  source: 'regex' | 'llm' | 'none';
  normalized?: string;
  disambiguation?: { query: string; options: DisambiguationOption[] };
  track?: {
    requested: string;
    ip: string;
    resolvedFromDomain: boolean;
    rdns?: string;
    city?: string;
    region?: string;
    country?: string;
    isp?: string;
    asn?: string;
    ips?: string[];
    errors: string[];
  };
  geo?: {
    label: string;
    sublabel: string;
    type: string;
    category: string;
    importance: number;
    source: string;
    alternatives: number;
  };
}

function respond(body: Partial<ApiResponse> & { reply: string }): NextResponse {
  const payload: ApiResponse = {
    actions: body.actions ?? [],
    reply: body.reply,
    source: body.source ?? 'none',
    ...(body.normalized !== undefined ? { normalized: body.normalized } : {}),
    ...(body.disambiguation ? { disambiguation: body.disambiguation } : {}),
    ...(body.track ? { track: body.track } : {}),
    ...(body.geo ? { geo: body.geo } : {}),
  };
  return NextResponse.json(payload);
}


const REAL_PANELS_LIST = 'flights, vessels, cameras, cables, recon, news';

const SYSTEM_PROMPT = `You are the command router of a monitoring console (FR/EN orders).
Convert the operator's order into ONE OR MORE JSON actions.

STRICTLY allowed actions:
- {"action":"fly_to","place":"<name>"}                             map moves to a named place (coordinates resolved separately · NEVER invent lat/lng)
- {"action":"set_panel","panel":"<id>"}                            id ∈ {${REAL_PANELS_LIST}}
- {"action":"set_zoom","zoom":<1-20>}
- {"action":"zoom_relative","delta":<-3..3>}                       relative zoom change
- {"action":"set_map_style","style":"satellite|dark|streets"}      dark = dark-matter vector, streets = voyager vector
- {"action":"set_visual_mode","visual":"flir|nvg|crt|default"}    post-processing visual filter of the map surface
- {"action":"track_ip","ip":"<IPv4 or domain>"}                     geolocate a target (DNS resolution is automatic for domains)
- {"action":"reset_view"}
- {"action":"refresh_intel"}
- {"action":"sitrep"}

Rules:
- Reply ONLY with JSON: {"actions":[...],"reply":"<max 12 words, same language as the order>"}
- NEVER output coordinates. Use "place" for named locations.
- Only actions from the list above. No other action exists.
- If the order is not covered by these actions, reply {"actions":[],"reply":"<brief why>"}.`;

async function tryLlmParse(raw: string): Promise<{ actions: Action[]; reply: string } | null> {
  try {
    const mod = await import('z-ai-web-dev-sdk');
    const ZAI = (mod as { default?: unknown }).default ?? mod;
    const z = await (ZAI as { create: () => Promise<{ chat: { completions: { create: (p: unknown) => Promise<unknown> } } }> }).create();
    const completion = (await z.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: raw },
      ],
      temperature: 0,
      max_tokens: 300,
    })) as { choices?: Array<{ message?: { content?: string } }> };
    const text = completion.choices?.[0]?.message?.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { actions?: unknown; reply?: unknown };
    if (!Array.isArray(parsed.actions)) return null;
    const allowed = new Set([
      'fly_to', 'set_panel', 'set_zoom', 'zoom_relative', 'set_map_style',
      'set_visual_mode', 'track_ip', 'reset_view', 'refresh_intel', 'sitrep',
    ]);
    const actions = (parsed.actions as Action[]).filter(
      (a) => a && typeof a.action === 'string' && allowed.has(a.action)
    );
    return { actions, reply: typeof parsed.reply === 'string' ? parsed.reply : '' };
  } catch {
    return null;
  }
}


function disambiguationPayload(query: string, candidates: GeoCandidate[]): ApiResponse['disambiguation'] {
  return {
    query,
    options: candidates.slice(0, 4).map((c, i) => ({
      index: i + 1,
      label: c.label,
      sublabel: c.sublabel,
      lat: c.lat,
      lng: c.lng,
      zoom: c.zoom,
      type: c.type,
      category: c.category,
      importance: Math.round(c.importance * 100) / 100,
    })),
  };
}

const HELP_HINT = `Ordres : « va à <lieu> » · « zoom 14 » · « rapproche » · « track <ip|domaine> » · « où suis-je » · « mode satellite/dark/rues » · « module <vols|caméras|…> » · « reset » · « sitrep » · « help »`;


export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; voice?: boolean };
    const rawInput = (body.text ?? '').trim();
    if (!rawInput) return respond({ reply: 'Ordre vide' });

    const norm = normalizeCommand(rawInput, Boolean(body.voice));

    let order: ParsedOrder | null = parseOrder(norm.text, { voice: Boolean(body.voice) });
    let source: 'regex' | 'llm' = 'regex';

    let llmExtra: Action[] = [];
    if (!order || order.confidence < 0.8) {
      const llm = await Promise.race([
        tryLlmParse(norm.text),
        new Promise<null>((r) => {
          setTimeout(() => r(null), 7000);
        }),
      ]);
      if (llm && llm.actions.length > 0) {
        source = 'llm';
        const primary = llm.actions[0];
        if (primary.action === 'fly_to' && typeof primary.place === 'string') {
          order = {
            intent: 'fly_to',
            target: primary.place,
            params: {},
            confidence: 0.7,
            language: /[\u00e0-\u00ff]/.test(rawInput) ? 'fr' : 'en',
            reply: llm.reply || `Cap sur ${primary.place}`,
          };
          llmExtra = llm.actions.filter((a) => a.action !== 'fly_to');
        } else {
          return respond({ actions: llm.actions, reply: llm.reply, normalized: norm.text, source });
        }
      } else if (!order) {
        return respond({ reply: `Ordre non reconnu · ${HELP_HINT}`, normalized: norm.text, source: 'none' });
      }
    }

    switch (order.intent) {
      case 'help':
        return respond({ reply: 'help', normalized: norm.text });
      case 'clear':
        return respond({ reply: 'clear', normalized: norm.text });
      case 'sitrep':
        return respond({ actions: [{ action: 'sitrep' }], reply: order.reply, normalized: norm.text, source });
      case 'refresh_intel':
        return respond({ actions: [{ action: 'refresh_intel' }], reply: order.reply, normalized: norm.text, source });
      case 'reset_view':
        return respond({ actions: [{ action: 'reset_view' }], reply: order.reply, normalized: norm.text, source });
      case 'set_zoom':
        return respond({
          actions: [{ action: 'set_zoom', zoom: order.params.zoom }],
          reply: order.reply, normalized: norm.text, source,
        });
      case 'zoom_relative':
        return respond({
          actions: [{ action: 'zoom_relative', delta: order.params.delta }],
          reply: order.reply, normalized: norm.text, source,
        });
      case 'set_map_style':
        return respond({
          actions: [{ action: 'set_map_style', style: order.params.style }],
          reply: order.reply, normalized: norm.text, source,
        });
      case 'set_visual_mode':
        return respond({
          actions: [{ action: 'set_visual_mode', visual: order.params.visual }],
          reply: order.reply, normalized: norm.text, source,
        });
      case 'set_panel':
        return respond({
          actions: [{ action: 'set_panel', panel: order.params.panel ?? '' }],
          reply: order.reply, normalized: norm.text, source,
        });
      case 'self_locate': {
        const self = await selfLocate();
        if (!self) return respond({ reply: 'Position du nœud indisponible', normalized: norm.text, source });
        return respond({
          actions: [{ action: 'fly_to', lat: self.lat, lng: self.lng, zoom: 10 }, ...llmExtra],
          reply: `Nœud serveur : ${self.ip} · ${[self.city, self.region, self.country].filter(Boolean).join(', ')} (${self.isp})`,
          normalized: norm.text,
          source,
        });
      }
      case 'track_target': {
        if (order.entityKind === 'coords' && order.params.lat != null && order.params.lng != null) {
          return respond({
            actions: [{ action: 'fly_to', lat: order.params.lat, lng: order.params.lng, zoom: 12 }],
            reply: order.reply, normalized: norm.text, source,
          });
        }
        const t = await resolveTrack(order.target ?? '');
        if (!t.intel) {
          return respond({
            reply: `${t.errors.join(' · ') || 'Cible introuvable'} · ${HELP_HINT}`,
            normalized: norm.text,
            source,
          });
        }
        return respond({
          actions: [
            {
              action: 'track_ip',
              ip: t.ip,
              meta: {
                requested: t.requested,
                resolvedFromDomain: t.resolvedFromDomain,
                rdns: t.rdns,
                city: t.intel.city,
                region: t.intel.region,
                country: t.intel.country,
                isp: t.intel.isp,
                asn: t.intel.asn,
                ips: t.dns?.ips ?? [],
              },
            },
            ...llmExtra,
          ],
          reply: describeTrack(t),
          track: {
            requested: t.requested,
            ip: t.ip,
            resolvedFromDomain: t.resolvedFromDomain,
            rdns: t.rdns,
            city: t.intel.city,
            region: t.intel.region,
            country: t.intel.country,
            isp: t.intel.isp,
            asn: t.intel.asn,
            ips: t.dns?.ips ?? [],
            errors: t.errors,
          },
          normalized: norm.text,
          source,
        });
      }
      case 'fly_to':
      case 'bare_place': {
        if (order.params.lat != null && order.params.lng != null) {
          return respond({
            actions: [
              { action: 'fly_to', lat: order.params.lat, lng: order.params.lng, zoom: order.params.zoom ?? 12 },
              ...llmExtra,
            ],
            reply: order.reply, normalized: norm.text, source,
          });
        }
        const place = (order.target ?? '').trim();
        if (!place) return respond({ reply: HELP_HINT, normalized: norm.text, source });

        const GEO_TIMEOUT = Symbol('geo-timeout');
        const geoOrTmo = await Promise.race([
          geocodePlace(place, 4),
          new Promise<typeof GEO_TIMEOUT>((r) => {
            setTimeout(() => r(GEO_TIMEOUT), 11000);
          }),
        ]);
        if (geoOrTmo === GEO_TIMEOUT) {
          return respond({
            reply: `Géocodage trop lent pour « ${place} » · réessayez dans un instant`,
            normalized: norm.text,
            source,
          });
        }
        const geo = geoOrTmo;
        if (geo.candidates.length === 0) {
          return respond({
            reply: `Lieu introuvable : « ${place} » · vérifiez l'orthographe ou précisez le pays`,
            normalized: norm.text,
            source,
          });
        }
        if (geo.ambiguous) {
          return respond({
            reply: `${geo.candidates.length} correspondances pour « ${geo.candidates[0].label} » · tapez 1-${Math.min(4, geo.candidates.length)} ou cliquez :`,
            disambiguation: disambiguationPayload(place, geo.candidates),
            normalized: norm.text,
            source,
          });
        }
        const c = geo.candidates[0];
        return respond({
          actions: [{ action: 'fly_to', lat: c.lat, lng: c.lng, zoom: c.zoom }, ...llmExtra],
          reply: `${c.label}${c.sublabel ? ` (${c.sublabel})` : ''} · ${c.category}/${c.type} · zoom ${c.zoom}`,
          geo: {
            label: c.label,
            sublabel: c.sublabel,
            type: c.type,
            category: c.category,
            importance: Math.round(c.importance * 100) / 100,
            source: c.source,
            alternatives: geo.candidates.length - 1,
          },
          normalized: norm.text,
          source,
        });
      }
      default:
        return respond({ reply: HELP_HINT, normalized: norm.text, source });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}
