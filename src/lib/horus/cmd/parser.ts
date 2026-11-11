

import { fold, isValidDomain, isValidIPv4, parseCoordinates } from './normalize';


export type Intent =
  | 'help'
  | 'clear'
  | 'sitrep'
  | 'refresh_intel'
  | 'reset_view'
  | 'self_locate'
  | 'track_target'
  | 'zoom_relative'
  | 'set_zoom'
  | 'set_map_style'
  | 'set_visual_mode'
  | 'set_panel'
  | 'fly_to'
  | 'bare_place';

export interface ParsedOrder {
  intent: Intent;
  target?: string;
  entityKind?: 'ip' | 'domain' | 'coords';
  params: {
    zoom?: number;
    lat?: number;
    lng?: number;
    delta?: number;
    style?: 'satellite' | 'dark' | 'streets';
    visual?: 'flir' | 'nvg' | 'crt' | 'default';
    panel?: string;
  };
  confidence: number;
  language: 'fr' | 'en';
  reply: string;
}

const REAL_PANELS: Array<{ re: RegExp; id: string; label: string }> = [
  [/\b(flights?|planes?|avions?|vols?|adsb?|trafic aerien|aeriens?)\b/, 'flights', 'VOLS'],
  [/\b(vessels?|ships?|boats?|maritime|bateaux?|navires?|naval)\b/, 'vessels', 'NAVIRES'],
  [/\b(cameras?|camera|cctv|webcams?|surveillance)\b/, 'cameras', 'CAMÉRAS'],
  [/\b(cables?|submarine|sous-marins?|sousmarins?)\b/, 'cables', 'CÂBLES'],
  [/\b(recon|reconnaissance|intel hote|ipgeo)\b/, 'recon', 'RECON'],
  [/\b(news?|actualites?|nouvelles?|gdelt|presse)\b/, 'news', 'NEWS'],
].map(([re, id, label]) => ({ re: re as RegExp, id: id as string, label: label as string }));


function extractIPv4(t: string): string | null {
  const m = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/.exec(t);
  if (!m) return null;
  return isValidIPv4(m[1]) ? m[1] : null;
}

function extractDomain(t: string): string | null {
  const matches = t.match(/\b([a-z0-9]([a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+)\b/gi);
  if (!matches) return null;
  const candidates = matches
    .filter((d) => isValidDomain(d) && !isValidIPv4(d))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}


const LEADING_PREPOSITIONS =
  /^(?:a|à|au|aux|vers|sur|en|jusqu'a|jusqu'a|vers le|jusque|to|onto|into|at|in|near|onto)\s+/i;

function cleanPlace(raw: string): string {
  let p = raw.trim().replace(/^[!?:.,;]+/, '').replace(/[.!?,;]+$/, '').trim();
  for (let i = 0; i < 2; i++) {
    const next = p.replace(LEADING_PREPOSITIONS, '');
    if (next === p) break;
    p = next.trim();
  }
  return p;
}


export function parseOrder(input: string, opts: { voice?: boolean } = {}): ParsedOrder | null {
  const folded = fold(input).replace(/\s+/g, ' ').trim();
  if (!folded) return null;

  const isEn = /\b(the|to|show|zoom|track|open|refresh|reset|home|please|go)\b/.test(folded)
    && !/\b(va|le|la|les|des|montre|affiche|ouvre|cap|sur)\b/.test(folded);
  const lang: 'fr' | 'en' = isEn ? 'en' : 'fr';

  if (/^(help|aide|\?|commandes?)$/.test(folded)) {
    return { intent: 'help', params: {}, confidence: 1, language: lang, reply: 'Référence CMD affichée' };
  }
  if (/^(clear|cls|vide|nettoie)$/.test(folded)) {
    return { intent: 'clear', params: {}, confidence: 1, language: lang, reply: 'Journal nettoyé' };
  }
  if (/^(sitrep|rapport|briefing|brief|situation|etat des lieux|status|situation report)$/.test(folded)) {
    return { intent: 'sitrep', params: {}, confidence: 1, language: lang, reply: 'Génération du SITREP…' };
  }
  if (/^(reset|reset view|vue globale|vue initiale|home|global view|remise a zero|reset vue|monde entier|vue monde)$/.test(folded)) {
    return { intent: 'reset_view', params: {}, confidence: 1, language: lang, reply: 'Vue globale restaurée' };
  }
  if (/^(refresh|reload|actualise|actualiser|rafraichis|maj|mets a jour|recharge|update|update intel)$/.test(folded)) {
    return { intent: 'refresh_intel', params: {}, confidence: 1, language: lang, reply: 'Rafraîchissement des flux…' };
  }

  if (/\b(ou suis[- ]je|ou sommes[- ]nous|ma position|position du (serveur|noeud|node)|localise[- ]moi|geolocalise[- ]moi|where am i|my position|self)\b/.test(folded)) {
    return { intent: 'self_locate', params: {}, confidence: 0.95, language: lang, reply: 'Localisation du nœud…' };
  }

  const trackVerbs =
    /\b(track|trace|tracer|piste|localise|localiser|situe|geolocalise|geolocaliser|retrouve|resous|resolve|lookup|look up|analyse)\b/.test(folded)
    || /\b(ou est|ou se trouve|where is|position de|adresse de)\b/.test(folded);
  const ip = extractIPv4(folded);
  const domain = extractDomain(folded);
  const coords = parseCoordinates(folded.replace(/[^0-9.,\s-]/g, ' '));

  if (trackVerbs) {
    if (ip) {
      return { intent: 'track_target', target: ip, entityKind: 'ip', params: {}, confidence: 0.95, language: lang, reply: `Traçage IP ${ip}…` };
    }
    if (coords) {
      return {
        intent: 'track_target', target: `${coords.lat},${coords.lng}`, entityKind: 'coords',
        params: { lat: coords.lat, lng: coords.lng }, confidence: 0.9, language: lang,
        reply: `Cap sur ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      };
    }
    if (domain) {
      return {
        intent: 'track_target', target: domain, entityKind: 'domain',
        params: {}, confidence: 0.95, language: lang,
        reply: `Résolution ${domain} → IP → position…`,
      };
    }
    return null;
  }

  const relIn = /\b(zoom (in|avant|plus)|rapproche|rapprocher|more zoom|zoom plus|agrandis)\b/.test(folded);
  const relOut = /\b(zoom (out|arriere|arrière|moins)|dezoome|dézoome|eloigne|éloigne|zoom moins|reduce)\b/.test(folded);
  if ((relIn || relOut) && !/\b(sur|on|of|de)\s+\S/.test(folded.replace(/zoom (in|out)/g, ''))) {
    const big = /\b(beaucoup|beacoup|much|way|fort|fortement|vachement)\b/.test(folded);
    const small = /\b(un peu|peu|slightly|legerement|légèrement)\b/.test(folded);
    const delta = (relIn ? 1 : -1) * (big ? 3 : small ? 0.5 : 1.5);
    return {
      intent: 'zoom_relative', params: { delta },
      confidence: 0.95, language: lang,
      reply: relIn ? `Zoom +${delta}` : `Zoom ${delta}`,
    };
  }

  const zoomMatch =
    /\b(?:zoom|niveau|level|couche|layer)\s*(?:sur|on|at|à|a|=|:)?\s*(\d{1,2}(?:[.,]\d)?)\b/.exec(folded)
    || /\b(?:mets|set|met)\s+(?:le\s+)?(?:zoom|niveau)\s+(?:a|à|to|on)?\s*(\d{1,2}(?:[.,]\d)?)\b/.exec(folded);
  if (zoomMatch) {
    let z = parseFloat(zoomMatch[1].replace(',', '.'));
    if (Number.isFinite(z)) {
      z = Math.min(20, Math.max(1, Math.round(z * 10) / 10));
      return { intent: 'set_zoom', params: { zoom: z }, confidence: 0.95, language: lang, reply: `Zoom ${z}` };
    }
  }

  const visualWanted =
    /\b(mode |vision )?(flir|thermique|thermal|infrarouge)\b/.test(folded) ? 'flir'
    : /\b(mode |vision )?(nvg|nocturne|night ?vision)\b/.test(folded) ? 'nvg'
    : /\b(mode |vision )?(crt|retro)\b/.test(folded) ? 'crt'
    : /\b(mode (par )?(defaut|normal|standard)|vision normale|normal vision|reset visuel|stop flir|stop nvg)\b/.test(folded) ? 'default'
    : null;
  if (visualWanted) {
    const vLabel = { flir: 'FLIR (thermique)', nvg: 'NVG (vision nocturne)', crt: 'CRT (rétro)', default: 'par défaut' }[visualWanted];
    return { intent: 'set_visual_mode', params: { visual: visualWanted }, confidence: 0.95, language: lang, reply: `Mode visuel ${vLabel}` };
  }

  const styleWanted =
    /\b(satellite|sat|imagerie|image satellite)\b/.test(folded) ? 'satellite'
    : /\b(dark|sombre|nuit|night|dark matter|darkmatter)\b/.test(folded) ? 'dark'
    : /\b(streets?|street|rues|voyager|plan|vectoriel|vector|carte vectorielle|basemap)\b/.test(folded) ? 'streets'
    : null;
  const styleVerb =
    /\b(mode|style|basemap|fond de carte|passe|passes|passer|switch|change|mets|met|affiche|montre|active|use|utilise|set)\b/.test(folded);
  if (styleWanted && styleVerb) {
    const label = styleWanted === 'satellite' ? 'satellite' : styleWanted === 'dark' ? 'DARK vectoriel' : 'STREETS vectoriel';
    return { intent: 'set_map_style', params: { style: styleWanted }, confidence: 0.95, language: lang, reply: `Passage en mode ${label}` };
  }

  if (/\b(rafraichis|rafraichir|actualise|actualiser|recharge|mets a jour|maj|refresh|reload|update)\b/.test(folded)) {
    return { intent: 'refresh_intel', params: {}, confidence: 0.9, language: lang, reply: 'Rafraîchissement des flux…' };
  }
  if (/\b(sitrep|rapport|briefing|situation report|resume la situation|etat des lieux)\b/.test(folded)) {
    return { intent: 'sitrep', params: {}, confidence: 0.9, language: lang, reply: 'Génération du SITREP…' };
  }
  if (/\b(reset|vue globale|vue initiale|home|remise a zero|global view)\b/.test(folded)) {
    return { intent: 'reset_view', params: {}, confidence: 0.9, language: lang, reply: 'Vue globale restaurée' };
  }

  const panelVerb = /\b(open|show|affiche|afficher|montre|montrer|ouvre|ouvrir|module|panel|tab|onglet|vue|active)\b/.test(folded);
  if (panelVerb) {
    for (const p of REAL_PANELS) {
      if (p.re.test(folded)) {
        return { intent: 'set_panel', params: { panel: p.id }, confidence: 0.95, language: lang, reply: `Module ${p.label}` };
      }
    }
  }

  const accented = input.trim();
  const flyRe =
    /^(?:.*?\b)?(?:fly to|go to|go|head to|navigate to|show me|show|zoom in on|zoom on|zoom sur|zoom|focus on|center on|va\s+(?:à|a|au|aux|vers)|vas\s+(?:à|a|au|aux|vers)|vais\s+(?:à|a|au|aux|vers)|rend[s]?-toi\s+(?:à|a|au|aux|vers)|allons\s+(?:à|a|au|aux|vers)|allez\s+(?:à|a|au|aux|vers)|cap sur|cap|direction|balance sur|envoie[- ]moi sur|envoie sur|amen[de]?[- ]moi\s+(?:à|a|au|aux|vers)|amen[de]?\s+(?:à|a|au|aux|vers)|mets cap sur|montre[- ]moi|montre|affiche|afficher|centre sur|positionne[- ]toi\s+(?:sur|a|au|aux)|deploie[- ]toi\s+(?:sur|a|au|aux))\s+(.+)$/i;
  const fly = flyRe.exec(accented);
  if (fly) {
    const place = cleanPlace(fly[1]);
    if (place) {
      const coordsIn = parseCoordinates(place.replace(/[^0-9.,\s-]/g, ' '));
      if (coordsIn) {
        return {
          intent: 'fly_to', params: { lat: coordsIn.lat, lng: coordsIn.lng },
          confidence: 0.95, language: lang,
          reply: `Cap sur ${coordsIn.lat.toFixed(4)}, ${coordsIn.lng.toFixed(4)}`,
        };
      }
      return { intent: 'fly_to', target: place, params: {}, confidence: 0.9, language: lang, reply: `Cap sur ${place}` };
    }
  }

  const wordCount = folded.split(/\s+/).length;
  const actionWord =
    /\b(va|vas|vais|montre|affiche|ouvre|open|show|track|trace|zoom|mode|mets|met|passe|reset|sitrep|rapport|refresh|actualise|rafraichis|home|clear|aide|help|cap|balance|envoie|amen|suivant|precedent|suivante|precedente|stop|annule|close|ferme|ou|et|puis|ensuite|module|panel|onglet|news|vols?|navires?|cameras?|cables?|recon)\b/.test(folded);
  const looksLikeQuestion = /\?$/.test(accented) || /\b(comment|pourquoi|quoi|qui|quel|quelle|combien)\b/.test(folded);
  if (wordCount >= 1 && wordCount <= 6 && !actionWord && !looksLikeQuestion) {
    const coordsIn = parseCoordinates(folded.replace(/[^0-9.,\s-]/g, ' '));
    if (coordsIn) {
      return {
        intent: 'fly_to', params: { lat: coordsIn.lat, lng: coordsIn.lng },
        confidence: 0.85, language: lang,
        reply: `Cap sur ${coordsIn.lat.toFixed(4)}, ${coordsIn.lng.toFixed(4)}`,
      };
    }
    return { intent: 'bare_place', target: accented, params: {}, confidence: 0.6, language: lang, reply: `Recherche du lieu « ${accented} »…` };
  }

  return null;
}


export const EXECUTABLE_INTENTS = new Set([
  'fly_to', 'set_panel', 'set_map_style', 'track_ip', 'reset_view',
  'refresh_intel', 'sitrep', 'set_zoom', 'zoom_relative', 'self_locate',
]);
