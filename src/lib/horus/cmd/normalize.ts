


const NUMBER_WORDS: Record<string, string> = {
  zero: '0', deux: '2', trois: '3', quatre: '4',
  cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10',
  onze: '11', douze: '12', treize: '13', quatorze: '14', quinze: '15',
  seize: '16', vingt: '20', trente: '30', quarante: '40', cinquante: '50',
  soixante: '60', septante: '70', huitante: '80', nonante: '90',
};
const EN_NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
  fifteen: '15', sixteen: '16',
};
const ARTICLE_WORDS = new Set(['un', 'une']);


const FILLER_WORDS = [
  'euh', 'heu', 'hum', 'err', 'euhh', 'ben', 'bah', 'stp',
  'please', "s'il te plait", "s'il vous plait",
  'commande', 'command', 'ordre',
];


export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function fold(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

function normalizePunctuation(s: string): string {
  return s
    .replace(/[’‘‛`]/g, "'")
    .replace(/[«»"]/g, ' ')
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retire les mots-outils vocaux (« euh va à euh Tokyo » → « va à Tokyo »). */
export function removeFillerWords(s: string): string {
  let out = s;
  for (const w of FILLER_WORDS) {
    const re = new RegExp(`(^|\\s)${w}(\\s|$)`, 'gi');
    out = out.replace(re, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// IP dictées · le morceau critique de la robustesse vocale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconstitue les IPv4 dictées.
 *   « huit point huit point huit point huit » → 8.8.8.8
 *   « huit . huit . huit . huit »             → 8.8.8.8
 * Fonctionne aussi en anglais (« eight dot eight… »).
 * Les mots-nombres isolés hors séquence pointée ne sont PAS convertis
 * (pour ne pas casser « affiche deux caméras »).
 */
export function reconstituteSpokenIPs(s: string): string {
  // Mot-nombre FR ou EN (les accents sont repliés avant matching).
  const num = '(?:zero|zéro|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|one|two|three|four|five|seven|eight|nine)';
  const sep = '(?:\\s*(?:point|dot)\\s*)';
  const ipPattern = new RegExp(`\\b(${num}${sep}${num}${sep}${num}(?:${sep}${num})?)\\b`, 'gi');

  const wordToDigit = (w: string): string => {
    const key = fold(w);
    if (key in NUMBER_WORDS) return NUMBER_WORDS[key];
    if (key in EN_NUMBER_WORDS) return EN_NUMBER_WORDS[key];
    if (ARTICLE_WORDS.has(key)) return '1';
    return w;
  };

  // La chaîne a déjà ses accents repliés par l'appelant via `fold`-interne :
  // on replie localement pour le matching sans altérer la sortie.
  let out = s;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    ipPattern.lastIndex = 0;
    const m = ipPattern.exec(out);
    if (!m) break;
    const seq = m[1];
    const parts = seq
      .split(new RegExp(sep, 'i'))
      .map((p) => p.trim())
      .filter(Boolean)
      .map(wordToDigit)
      .map((d) => String(parseInt(d, 10)));
    if (parts.length < 3) break;
    const rebuilt = parts.join('.');
    out = out.slice(0, m.index) + rebuilt + out.slice(m.index + m[0].length);
  }

  // Séquences déjà chiffrées mais parlées : « 8 point 8 point 8 point 8 »
  out = out.replace(
    /\b(\d{1,3})\s*(?:point|dot)\s*(\d{1,3})\s*(?:point|dot)\s*(\d{1,3})\s*(?:point|dot)\s*(\d{1,3})\b/gi,
    '$1.$2.$3.$4'
  );

  return out;
}

/**
 * Convertit les mots-nombres ISOLÉS en chiffres quand ils suivent un
 * indice numérique fort (zoom / niveau / port) :
 *   « mets le zoom sur quatorze » → « mets le zoom sur 14 »
 */
export function convertSpokenNumbersAfterCues(s: string): string {
  // Le groupe « gap » (préposition optionnelle) est restitué tel quel
  // pour ne jamais manger un « sur » dans « zoom sur Tokyo ».
  const re = new RegExp('(zoom|niveau|level|port|couche|layer)(\\s+(?:sur|on|at|à|a|=|:)?\\s*)([a-zA-Zéèêàûôîïç]+)', 'gi');
  return s.replace(re, (_m, cueWord: string, gap: string, w: string) => {
    const key = fold(w);
    if (ARTICLE_WORDS.has(key)) return `${cueWord}${gap}${w}`;
    const digit = NUMBER_WORDS[key] ?? EN_NUMBER_WORDS[key];
    return digit ? `${cueWord}${gap}${digit}` : `${cueWord}${gap}${w}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Correctifs ASR français usuels
// ─────────────────────────────────────────────────────────────────────────────

/** « va a paris » → « va à paris » (l'ASR français omet souvent l'accent). */
function fixSpokenPrepositions(s: string): string {
  return s
    .replace(/\b(va|vas-y|allez|rends-toi|rendons-nous|allons|vais)\s+a\s+/gi, '$1 à ')
    .replace(/\b(a)\s+(tokyo|paris|lyon|marseille|londres|new york|rome|madrid|berlin)\b/gi, (m, a, city) =>
      `à ${city}`.replace(/^à/, 'à')
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedCommand {
  /** Texte canonique (espaces gérés, apostrophes normées). */
  text: string;
  /** Version foldée : minuscule SANS accents · à utiliser pour les regex. */
  folded: string;
  /** Une IPv4 dictée a été reconstituée. */
  hadSpokenIP: boolean;
}

/**
 * Normalise un ordre pour le parseur. `voice = true` active les couches
 * de correction spécifiques à la dictée (mots-outils, prépositions).
 */
export function normalizeCommand(input: string, voice = false): NormalizedCommand {
  let text = normalizePunctuation(input ?? '');
  if (voice) {
    text = removeFillerWords(text);
  }
  text = reconstituteSpokenIPs(text);
  text = convertSpokenNumbersAfterCues(text);
  if (voice) {
    text = fixSpokenPrepositions(text);
  }
  text = text.replace(/\s+/g, ' ').trim();
  return {
    text,
    folded: fold(text),
    hadSpokenIP: /(?:\d{1,3}\.){3}\d{1,3}/.test(text) && !/(?:\d{1,3}\.){3}\d{1,3}/.test(input ?? ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validateurs d'entités
// ─────────────────────────────────────────────────────────────────────────────

/** IPv4 strictement valide (octets 0-255). */
export function isValidIPv4(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) return false;
  return m.slice(1).every((o) => {
    const n = parseInt(o, 10);
    return n >= 0 && n <= 255;
  });
}

/** Nom de domaine plausible (FQDN) · utilisé pour la résolution DNS. */
export function isValidDomain(s: string): boolean {
  const t = s.trim().replace(/^\w+:\/\//, '').replace(/\/.*$/, '');
  return (
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(t) &&
    /\.[a-z]{2,}$/i.test(t) &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(t)
  );
}

/** Coordonnées décimales « 48.85, 2.35 » ou « 48.85 2.35 ». */
export function parseCoordinates(s: string): { lat: number; lng: number } | null {
  const m = /(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)/.exec(s.trim());
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null; // « 0, 0 » = bruit
  return { lat, lng };
}
