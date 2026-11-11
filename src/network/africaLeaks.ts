

import { CENTROID } from "./breaches";
import { clamp, type BreachItem } from "./types";

export type AfricaLeak = {
  id: string;
  org: string;
  country?: string;
  sector: string;
  date: string;
  records: number;
  actor: string;
  severity: number;
  summary: string;
  source: string;
  dataClasses: string[];
};

export const AFRICA_LEAKS: AfricaLeak[] = [
  {
    id: "af-sn-biometrie-2026",
    org: "Base biométrique nationale (Sénégal)",
    country: "SN",
    sector: "Gouvernement · Biométrie",
    date: "2026-02",
    records: 20_000_000,
    actor: "Green Blood Group",
    severity: 95,
    summary:
      "Le groupe Green Blood Group s'empare de la base biométrique nationale : données personnelles ET biométriques de la quasi-totalité des ~20 millions de résidents sénégalais exposées. Incident majeur ouest-africain, symbole du risque souverain des registres d'identité centralisés.",
    source: "Dark Reading (fév. 2026)",
    dataClasses: ["Données biométriques", "Identités", "NIN"],
  },
  {
    id: "af-ke-ecitizen-2025",
    org: "eCitizen · portail services publics (Kenya)",
    country: "KE",
    sector: "Gouvernement · Services publics",
    date: "2025-01",
    records: 2_000_000,
    actor: "non identifié",
    severity: 88,
    summary:
      "Une faille du portail eCitizen (passeports, permis, impôts…) expose les données d'environ 2 millions d'entreprises kenyanes. Le portail concentre plus de 5 000 services publics · dépendance unique au cœur de l'État.",
    source: "Nation Africa (janv. 2025)",
    dataClasses: ["Données d'entreprises", "Identités", "Identifiants de compte"],
  },
  {
    id: "af-ke-ecitizen-2023",
    org: "eCitizen · cyberattaque (Kenya)",
    country: "KE",
    sector: "Gouvernement · Services publics",
    date: "2023-07",
    records: 0,
    actor: "Anonymous Sudan (revendiqué)",
    severity: 80,
    summary:
      "Attaque par déni de service distribué revendiquée : le portail eCitizen et plus de 5 000 services publics kenyan restent indisponibles pendant plusieurs jours. Rupture de continuité d'État sans exfiltration confirmée.",
    source: "BBC News (juil. 2023)",
    dataClasses: ["Disponibilité des services publics"],
  },
  {
    id: "af-ke-kura-2024",
    org: "KURA · Kenya Urban Roads Authority",
    country: "KE",
    sector: "Infrastructure critique · Transport",
    date: "2024",
    records: 0,
    actor: "non identifié",
    severity: 78,
    summary:
      "Intrusion dans l'autorité kenyane des routes urbaines, citée comme attaque d'infrastructure critique par le rapport INTERPOL d'évaluation de la cybermenace africaine 2025.",
    source: "INTERPOL Africa Cyberthreat Assessment (2025)",
    dataClasses: ["Données internes", "Projets infrastructurels"],
  },
  {
    id: "af-ng-nbs-2024",
    org: "National Bureau of Statistics (Nigéria)",
    country: "NG",
    sector: "Gouvernement · Statistiques",
    date: "2024",
    records: 0,
    actor: "non identifié",
    severity: 76,
    summary:
      "Piratage de la base du bureau national des statistiques nigérian, cité par INTERPOL parmi les attaques de bases de données gouvernementales de l'année en Afrique.",
    source: "INTERPOL Africa Cyberthreat Assessment (2025)",
    dataClasses: ["Données statistiques", "Données internes"],
  },
  {
    id: "af-ng-darkweb-80m-2024",
    org: "Dossiers de citoyens nigérians (dark web)",
    country: "NG",
    sector: "Multi-secteurs · Identités",
    date: "2024",
    records: 80_000_000,
    actor: "revendeurs dark web",
    severity: 92,
    summary:
      "Environ 80 millions d'enregistrements de données personnelles nigérianes (téléphones, e-mails, identités) en circulation sur le dark web · alimentant fraude téléphonique, hameçonnage et compromission de comptes (BEC).",
    source: "Arise TV / rapports 2024",
    dataClasses: ["Numéros de téléphone", "E-mails", "Identités", "NIN/BVN"],
  },
  {
    id: "af-ng-100naira-2024",
    org: "Marché noir des données nigérianes",
    country: "NG",
    sector: "Multi-secteurs · Finance",
    date: "2024-06",
    records: 0,
    actor: "sites non autorisés",
    severity: 85,
    summary:
      "Des sites non autorisés vendent l'accès à des données personnelles et financières de citoyens nigérians pour environ 100 nairas (~0,06 €) par dossier : vérification de solvabilité, BVN, identités · économie souterraine de la donnée.",
    source: "Paradigm HQ (juin 2024)",
    dataClasses: ["Données financières", "BVN", "Identités"],
  },
  {
    id: "af-za-experian-2020",
    org: "Experian Afrique du Sud",
    country: "ZA",
    sector: "Banque · Courtage de crédit",
    date: "2020-08",
    records: 24_000_000,
    actor: "hameçonnage ciblé",
    severity: 90,
    summary:
      "Un hameçonnage ciblé dérobe les données d'environ 24 millions de Sud-Africains et 793 000 entreprises auprès du courtier de crédit Experian SA : numéros d'identité, données de crédit, contacts.",
    source: "SABRIC / presse 2020",
    dataClasses: ["Numéros d'identité", "Données de crédit", "Contacts"],
  },
  {
    id: "af-za-transunion-2022",
    org: "TransUnion Afrique du Sud",
    country: "ZA",
    sector: "Banque · Courtage de crédit",
    date: "2022-03",
    records: 3_000_000,
    actor: "N4ughtysec (revendiqué)",
    severity: 80,
    summary:
      "Un acteur revendiquant le groupe N4ughtysec obtient les données d'environ 3 millions de consommateurs sud-africains via un compte non protégé par MFA · référence de l'incident lié à l'absence de double authentification.",
    source: "MyBroadband / SABC (2022)",
    dataClasses: ["Numéros d'identité", "Données de crédit", "E-mails"],
  },
  {
    id: "af-za-postbank-2022",
    org: "Postbank Afrique du Sud",
    country: "ZA",
    sector: "Banque · Services postaux",
    date: "2022-10",
    records: 12_000_000,
    actor: "compromission de clés carte",
    severity: 88,
    summary:
      "Après compromission des clés de production de cartes, Postbank doit renouveler environ 12 millions de cartes : des millions de retraités et bénéficiaires sociaux restent privés de paiements pendant des semaines. Coût du renouvellement ~1 milliard ZAR.",
    source: "presse sud-africaine (2022)",
    dataClasses: ["Données de cartes", "Comptes bancaires"],
  },
  {
    id: "af-za-masterdeeds-2017",
    org: "Master Deeds · registre foncier (Afrique du Sud)",
    country: "ZA",
    sector: "Gouvernement · Immobilier",
    date: "2017-10",
    records: 60_000_000,
    actor: "agrégation exposée",
    severity: 90,
    summary:
      "Le registre cadastral Master Deeds est exposé et agrégé : environ 60 millions d'enregistrements · identités de propriétaires, adresses, numéros d'identité, pour l'essentiel des citoyens sud-africains, vivants ou décédés.",
    source: "iAfrikan / presse (2017-2018)",
    dataClasses: ["Propriétés", "Numéros d'identité", "Adresses"],
  },
  {
    id: "af-za-saa-2025",
    org: "South African Airways",
    country: "ZA",
    sector: "Transport aérien",
    date: "2025-05",
    records: 0,
    actor: "non identifié",
    severity: 74,
    summary:
      "South African Airways apparaît au tableau des grandes violations de données de mai 2025 (rapport IT Governance) · premier transporteur national du continent parmi les victimes du mois.",
    source: "IT Governance / GRC Solutions (mai 2025)",
    dataClasses: ["Données internes"],
  },
  {
    id: "af-ke-multibillion-2023",
    org: "Fuite multi-agences revendiquée (Kenya)",
    country: "KE",
    sector: "Gouvernement · Multi-agences",
    date: "2023",
    records: 1_200_000_000,
    actor: "revendication non confirmée",
    severity: 70,
    summary:
      "Une fuite revendiquant 1,2 milliard d'enregistrements issus de plates-formes et agences kényanes circule ; l'ampleur exacte reste à confirmer, mais elle illustre l'accumulation de risque des registres publics interconnectés.",
    source: "Nation Africa (2023-2024)",
    dataClasses: ["Enregistrements agrégés"],
  },
  {
    id: "af-ml-dgi-lockbit-2022",
    org: "Administration malienne · données des contribuables",
    country: "ML",
    sector: "Gouvernement · Fiscalité",
    date: "2022-06",
    records: 312_000,
    actor: "Lockbit (extorsion)",
    severity: 82,
    summary:
      "Des pirates informatiques liés à la franchise d'extorsion Lockbit s'emparent en juin 2022 des données de plus de 312 000 contribuables maliens. L'incident, révélé par Jeune Afrique, touche l'administration fiscale au cœur de la souveraineté financière de l'État.",
    source: "Jeune Afrique / Osiris.sn (août 2022)",
    dataClasses: ["Données fiscales", "Identités des contribuables"],
  },
  {
    id: "af-ml-boa-2023",
    org: "BOA Mali · Bank of Africa",
    country: "ML",
    sector: "Banque",
    date: "2023-02",
    records: 0,
    actor: "hackers non identifiés (extorsion)",
    severity: 84,
    summary:
      "La BOA Mali est victime d'une cyberattaque : les attaquants exigent 10 millions de dollars (plus de 6 milliards FCFA) pour effacer les données personnelles des clients. Parmi les comptes visés : ministères (Finances, Mines, Justice), ambassades, hôtels, ONG et des centaines de partenaires institutionnels.",
    source: "MaliWeb / Le Wagadu (févr. 2023)",
    dataClasses: ["Données bancaires", "Données personnelles de clients"],
  },
  {
    id: "af-bf-waf-deadlock-2026",
    org: "West African Resources · mines d'or (Burkina Faso)",
    country: "BF",
    sector: "Mines · Infrastructure critique",
    date: "2026-07",
    records: 0,
    actor: "Deadlock (rançongiciel)",
    severity: 76,
    summary:
      "Le groupe Deadlock publie sur son site de fuite les données internes de West African Resources, société aurifère opérant deux projets miniers majeurs au Burkina Faso : dossiers comptables, salaires du personnel, contrats bancaires et budgets. Le volume exact n'est pas divulgué publiquement.",
    source: "Cyber Daily (juil. 2026)",
    dataClasses: ["Comptabilité", "Salaires", "Contrats bancaires", "Budgets"],
  },
  {
    id: "af-ne-cybermontee-2024",
    org: "Montée en charge des cyberattaques (Niger)",
    country: "NE",
    sector: "Gouvernement · Cyberdéfense",
    date: "2024-12",
    records: 0,
    actor: "cybercriminalité multiple",
    severity: 72,
    summary:
      "Entre 2022 et 2024, les pertes financières liées aux cyberattaques au Niger bondissent de 70 % à 400 % selon les données officielles relayées par Africa24. En réponse, l'État crée son Centre National de Cybersécurité (CNAC, oct. 2025) et Niamey accueille la Déclaration africaine sur la cybersécurité et la protection des données personnelles (juil. 2025).",
    source: "Africa24 TV / Agence Ecofin (2025)",
    dataClasses: ["Pertes financières documentées", "Données publiques visées"],
  },
  {
    id: "af-regional-moab-2024",
    org: "« Mother of All Breaches » · agrégat panafricain",
    country: undefined,
    sector: "Régional · Agrégats de comptes",
    date: "2024-01",
    records: 26_000_000_000,
    actor: "agrégation de fuites antérieures",
    severity: 84,
    summary:
      "La plus grande compilation de comptes divulgués jamais recensée (26 milliards d'enregistrements, ~12 To) inclut des millions de comptes d'utilisateurs africains issus de plates-formes mondiales · la longue traîne des fuites touche le continent sans discrimination.",
    source: "Cybernews (janv. 2024)",
    dataClasses: ["Identifiants", "E-mails", "Mots de passe"],
  },
];


export function africaDossierToBreaches(): BreachItem[] {
  return AFRICA_LEAKS.map((l) => {
    const centroid = l.country ? CENTROID[l.country] : undefined;
    const parts: string[] = [];
    if (l.records > 0) {
      parts.push(
        `≈ ${l.records.toLocaleString("fr-FR")} enregistrements exposés`
      );
    }
    parts.push(l.sector, `Acteur : ${l.actor}`);
    return {
      id: l.id,
      name: l.id,
      title: l.org,
      domain: undefined,
      breachDate: l.date,
      pwnCount: l.records,
      dataClasses: l.dataClasses,
      description: `${l.summary} · Documenté par : ${l.source}.${parts.length ? ` [${parts.join(" · ")}]` : ""}`,
      verified: true,
      sensitive: /biom|financ|carte|identit/i.test(l.dataClasses.join(" ")),
      malware: false,
      country: l.country,
      countryEvidence: "text",
      geo: centroid ? { lon: centroid[0], lat: centroid[1] } : undefined,
      isAfrica: true,
      severity: clamp(l.severity, 20, 95),
    } satisfies BreachItem;
  });
}

export type AfricaDossierStats = {
  incidents: number;
  countries: number;
  records: number;
  topCountries: { iso: string; name: string; count: number; records: number }[];
};

export const COUNTRY_NAME: Record<string, string> = {
  SN: "Sénégal",
  KE: "Kenya",
  NG: "Nigéria",
  ZA: "Afrique du Sud",
  GH: "Ghana",
  CM: "Cameroun",
  CI: "Côte d'Ivoire",
  ML: "Mali",
  ET: "Éthiopie",
  EG: "Égypte",
  TZ: "Tanzanie",
  UG: "Ouganda",
  MA: "Maroc",
  DZ: "Algérie",
  TN: "Tunisie",
  AO: "Angola",
  MZ: "Mozambique",
  ZM: "Zambie",
  ZW: "Zimbabwe",
  RW: "Rwanda",
  BF: "Burkina Faso",
  NE: "Niger",
  TD: "Tchad",
  BJ: "Bénin",
  TG: "Togo",
};

export function africaDossierStats(leaks: AfricaLeak[]): AfricaDossierStats {
  const byCountry = new Map<string, { count: number; records: number }>();
  let records = 0;
  for (const l of leaks) {
    records += l.records;
    if (!l.country) continue;
    const cur = byCountry.get(l.country) ?? { count: 0, records: 0 };
    cur.count += 1;
    cur.records += l.records;
    byCountry.set(l.country, cur);
  }
  const topCountries = [...byCountry.entries()]
    .map(([iso, v]) => ({ iso, name: COUNTRY_NAME[iso] ?? iso, ...v }))
    .sort((a, b) => b.records - a.records || b.count - a.count)
    .slice(0, 5);
  return {
    incidents: leaks.length,
    countries: byCountry.size,
    records,
    topCountries,
  };
}

export function fmtRecords(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mrd`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000)
    return `${(n / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return n.toLocaleString("fr-FR");
}
