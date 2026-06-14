// background.js — Service worker (Manifest V3, type: module)
// Responsabilités : extraction vidéo, filtre éthique, appel IA (local/commercial),
// gating abonnement Stripe. Aucune clé secrète ici — uniquement clés publiables/API user.

import { DEFAULT_SETTINGS, PROVIDERS, ETHICAL_FILTERS, STRIPE } from './config.js';
import { cleanPost } from './clean.js';

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------
async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(null);
  // Initialise uniquement les clés manquantes (ne pas écraser l'existant).
  const patch = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[k] === undefined) patch[k] = v;
  }
  if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
});

// ---------------------------------------------------------------------------
// Filtre éthique
// ---------------------------------------------------------------------------
// Retourne { blocked: boolean, category?: string, term?: string }
export function runEthicalFilter(meta) {
  const haystack = [meta.title, meta.channel, meta.description]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();

  for (const [category, terms] of Object.entries(ETHICAL_FILTERS)) {
    for (const term of terms) {
      // Frontière de mot pour éviter faux positifs ("bet" dans "alphabet").
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu');
      if (re.test(haystack)) {
        return { blocked: true, category, term };
      }
    }
  }
  return { blocked: false };
}

const CATEGORY_LABELS = {
  gambling: "jeux d'argent",
  alcohol: 'alcool',
  music: 'musique',
  vulgar: 'contenu vulgaire'
};

// ---------------------------------------------------------------------------
// Extraction des métadonnées YouTube (injectée dans l'onglet actif)
// ---------------------------------------------------------------------------
function scrapeYouTube() {
  const pick = (sel, attr) => {
    const el = document.querySelector(sel);
    if (!el) return '';
    return (attr ? el.getAttribute(attr) : el.textContent || '').trim();
  };

  const title =
    pick('meta[name="title"]', 'content') ||
    pick('h1.ytd-watch-metadata') ||
    document.title.replace(/ - YouTube$/, '');

  const channel =
    pick('ytd-channel-name #text a') ||
    pick('span[itemprop="author"] link[itemprop="name"]', 'content') ||
    pick('#owner #channel-name');

  const description =
    pick('meta[name="description"]', 'content') ||
    pick('#description-inline-expander') ||
    pick('ytd-text-inline-expander');

  // Durée de la vidéo, en secondes — plusieurs sources, la plus fiable d'abord.
  let durationSeconds = null;
  // 1) Élément <video> chargé (le plus fiable).
  const vid = document.querySelector('video');
  if (vid && isFinite(vid.duration) && vid.duration > 0) {
    durationSeconds = Math.round(vid.duration);
  }
  // 2) Balise meta ISO-8601 (PT#H#M#S).
  if (!durationSeconds) {
    const iso = pick('meta[itemprop="duration"]', 'content');
    const m = iso && iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) durationSeconds = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }
  // 3) Texte du lecteur "12:34" (fallback visuel).
  if (!durationSeconds) {
    const t = pick('.ytp-time-duration');
    if (t && /\d+:\d+/.test(t)) {
      const parts = t.split(':').map(Number);
      durationSeconds = parts.reduce((acc, n) => acc * 60 + n, 0);
    }
  }

  return {
    url: location.href,
    isWatchPage: location.pathname === '/watch',
    title,
    channel,
    description: (description || '').slice(0, 4000),
    durationSeconds: durationSeconds || null
  };
}

async function extractActiveVideo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('NO_TAB');
  if (!/^https:\/\/www\.youtube\.com\//.test(tab.url || '')) throw new Error('NOT_YOUTUBE');

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scrapeYouTube
  });
  const meta = res?.result;
  if (!meta || !meta.isWatchPage) throw new Error('NOT_WATCH_PAGE');
  if (!meta.title) throw new Error('NO_METADATA');
  return meta;
}

// ---------------------------------------------------------------------------
// Adaptation dynamique de la longueur selon la durée de la vidéo.
// 3 modes stricts : < 3 min, 3-15 min, > 15 min. Durée inconnue -> standard.
// ---------------------------------------------------------------------------
function durationMode(seconds) {
  const FLASH = {
    key: 'flash', name: 'Astuce flash', words: '100-150',
    lines: [
      'LONGUEUR (vidéo courte < 3 min — format "Astuce flash"):',
      '- Post COURT et percutant: 100 à 150 mots. Zéro remplissage.',
      '',
      'STRUCTURE (sans aucun sous-titre):',
      '- Accroche: 1 ligne qui claque.',
      '- Cœur: 1 seule astuce / idée clé, expliquée simplement en 2-3 phrases. Droit au but.',
      "- Clôture: 1 ligne d'action ou une question."
    ]
  };
  const STANDARD = {
    key: 'standard', name: 'Standard', words: '200-250',
    lines: [
      'LONGUEUR (vidéo moyenne 3-15 min — format standard à valeur):',
      '- Post structuré: 200 à 250 mots.',
      '',
      'PROFONDEUR:',
      '- Donne 2 à 4 enseignements concrets tirés de la vidéo, avec un minimum de détail utile.',
      '- Si des étapes sont mentionnées, liste les principales avec une courte explication.',
      '',
      'STRUCTURE (sans aucun sous-titre):',
      '- Accroche: 1 ligne percutante.',
      '- Développement: 2 à 3 blocs aérés, séparés par des sauts de ligne.',
      '- Clôture: 2 lignes max (question / appel à réagir).'
    ]
  };
  const RAPPORT = {
    key: 'rapport', name: "Rapport d'expert", words: '350-500',
    lines: [
      'LONGUEUR (vidéo longue > 15 min — format "Rapport d\'expert"):',
      '- Post LONG, dense et ultra-détaillé: 350 à 500 mots.',
      '',
      'PROFONDEUR (maximale):',
      '- Ne survole pas. Extrais le MAXIMUM de détails techniques, méthodologies, exemples et cas concrets.',
      "- Si le créateur donne des étapes (Étape 1, 2, 3...), liste-les TOUTES avec une explication pour chacune. N'en omets aucune.",
      '',
      'STRUCTURE (sans aucun sous-titre):',
      '- Accroche: 1 ligne percutante.',
      '- Développement: 3 grandes parties distinctes et approfondies, séparées par des sauts de ligne.',
      '- Clôture: 2 lignes max (question / appel à réagir).'
    ]
  };
  if (seconds == null) return { ...STANDARD, name: 'Standard (durée inconnue)' };
  if (seconds < 180) return FLASH;
  if (seconds <= 900) return STANDARD;
  return RAPPORT;
}

function formatDuration(seconds) {
  if (seconds == null) return 'inconnue';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------------------------------------------------------------------------
// Construction du prompt — honnête, professionnel, sans fabrication
// ---------------------------------------------------------------------------
function buildMessages(meta, settings, mode) {
  const lang = settings.language === 'en' ? 'English' : 'French';
  const toneMap = {
    professional: 'professionnel, percutant et crédible',
    inspirational: 'inspirant et motivant',
    educational: 'pédagogique et clair'
  };
  const tone = toneMap[settings.tone] || toneMap.professional;

  const system = [
    'Tu es un expert en personal branding LinkedIn.',
    `Rédige en ${lang}.`,
    `Ton: ${tone}.`,
    'Règles strictes:',
    "- 100% honnête: n'invente jamais de chiffres, citations ou faits absents des métadonnées fournies.",
    "- Si une information manque, reste général plutôt que d'inventer.",
    '- ANTI-PLAGIAT (impératif, droit d\'auteur): interdiction stricte de copier-coller, de recopier mot pour mot ou de paraphraser de près les phrases du titre, de la description ou de la transcription de la vidéo.',
    "- Tu dois REFORMULER, SYNTHÉTISER et ADAPTER les idées. Le post est une CRÉATION ORIGINALE et unique, pas une répétition des propos du youtubeur.",
    '- Réutilise les concepts et les enseignements, jamais les formulations d\'origine. Aucune phrase du contenu source ne doit apparaître telle quelle.',
    "- Une citation littérale n'est tolérée que si elle est explicitement marquée entre guillemets ET attribuée à l'auteur ; sinon, reformule entièrement.",
    '- Pas de clickbait trompeur, pas de promesses exagérées.',
    '',
    `MODE imposé selon la durée de la vidéo (${mode.name}, cible ${mode.words} mots) — respecte STRICTEMENT la fourchette de mots:`,
    ...mode.lines,
    '- INTERDIT: tout sous-titre académique ou bateau ("Comprenez ceci", "Familiarisez-vous", "Testez vos connaissances", "Introduction", "Conclusion", "Partie 1"...). Aucun titre de section, jamais.',
    '',
    'RYTHME & LISIBILITÉ:',
    '- Paragraphes courts: 3 lignes maximum, très aérés. Une idée par paragraphe.',
    '- Pour les listes d\'éléments majeurs ou les étapes: puces épurées avec des tirets (-), pour un post ultra-scannable.',
    '',
    'TON & LANGAGE:',
    '- Moins formel, orienté partage d\'expérience et expertise terrain (comme un pro qui raconte ce qu\'il a appris).',
    '- Langage actif et direct. Évite les tournures passives et les formules creuses ("il est essentiel de", "il convient de", "n\'hésitez pas à").',
    '- Phrases courtes, percutantes, concrètes.',
    settings.hashtags
      ? '- Termine par 3 à 5 hashtags pertinents.'
      : '- Aucun hashtag.',
    '- Ne mentionne pas que le texte est généré par IA.'
  ].join('\n');

  const user = [
    'Crée un post LinkedIn à partir de cette vidéo YouTube.',
    `Titre: ${meta.title}`,
    meta.channel ? `Chaîne: ${meta.channel}` : '',
    `Durée de la vidéo: ${formatDuration(meta.durationSeconds)} -> mode "${mode.name}" (${mode.words} mots).`,
    meta.description ? `Description:\n${meta.description}` : '',
    `Lien: ${meta.url}`
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

// ---------------------------------------------------------------------------
// Appel IA générique (avec timeout)
// ---------------------------------------------------------------------------
async function callAI(settings, messages) {
  const provider = PROVIDERS[settings.aiProvider];
  if (!provider) throw new Error('UNKNOWN_PROVIDER');
  if (provider.needsKey) {
    const key = settings.aiProvider === 'openai' ? settings.openaiKey : settings.anthropicKey;
    if (!key) throw new Error('MISSING_API_KEY');
  }

  const { url, init } = provider.buildRequest(settings, messages);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  let resp;
  try {
    resp = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('TIMEOUT');
    // Échec réseau le plus courant en local = serveur IA éteint.
    if (provider.isLocal) throw new Error('LOCAL_SERVER_OFFLINE');
    throw new Error('NETWORK_ERROR');
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`API_ERROR_${resp.status}: ${body.slice(0, 200)}`);
  }

  const json = await resp.json();
  const text = provider.parse(json)?.trim();
  if (!text) throw new Error('EMPTY_RESPONSE');
  return text;
}

// ---------------------------------------------------------------------------
// Gating abonnement
// ---------------------------------------------------------------------------
function checkAccess(settings) {
  const provider = PROVIDERS[settings.aiProvider];
  // Local = toujours gratuit et illimité (test sur ta machine, aucune barrière).
  if (provider?.isLocal) return { allowed: true, unlimited: true };
  // Pro (abonné Stripe) = illimité.
  if (settings.subscriptionStatus === 'active') return { allowed: true, unlimited: true };
  // Sinon : crédits d'essai gratuits.
  const credits = Number(settings.freeCredits) || 0;
  if (credits > 0) return { allowed: true, remaining: credits };
  return { allowed: false, reason: 'QUOTA_EXCEEDED' };
}

// ---------------------------------------------------------------------------
// Vérification statut Stripe (via backend)
// ---------------------------------------------------------------------------
async function refreshSubscription() {
  const settings = await getSettings();
  const email = (settings.userEmail || '').trim().toLowerCase();
  // Sans email, impossible d'identifier l'abonné côté Stripe.
  if (!email) return { status: null, reason: 'NO_EMAIL' };
  try {
    const url = `${STRIPE.statusUrl}?email=${encodeURIComponent(email)}`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) return { status: null, reason: 'HTTP_' + resp.status };
    const j = await resp.json();
    const status = j?.active ? 'active' : 'free';
    await chrome.storage.sync.set({ subscriptionStatus: status });
    return { status };
  } catch {
    return { status: null, reason: 'NETWORK' };
  }
}

// ---------------------------------------------------------------------------
// Orchestration : générer un post
// ---------------------------------------------------------------------------
async function generatePost() {
  const settings = await getSettings();

  const access = checkAccess(settings);
  if (!access.allowed) {
    return { ok: false, code: 'QUOTA_EXCEEDED',
      message: 'Vos 3 essais gratuits sont épuisés. Passez à TubeToPost Pro (15€/mois) pour des posts illimités — ou utilisez le mode local gratuit.' };
  }

  let meta;
  try {
    meta = await extractActiveVideo();
  } catch (e) {
    const map = {
      NOT_YOUTUBE: "Ouvre une vidéo YouTube pour générer un post.",
      NOT_WATCH_PAGE: "Va sur une page de vidéo YouTube (URL /watch).",
      NO_METADATA: "Impossible de lire les infos de la vidéo. Recharge la page.",
      NO_TAB: "Aucun onglet actif détecté."
    };
    return { ok: false, code: e.message, message: map[e.message] || 'Extraction impossible.' };
  }

  const filter = runEthicalFilter(meta);
  if (filter.blocked) {
    return {
      ok: false,
      code: 'BLOCKED',
      category: filter.category,
      message: `Cette vidéo concerne ${CATEGORY_LABELS[filter.category]} et ne peut pas être traitée. ` +
               `TubeToPost ne génère pas de contenu pour cette catégorie.`
    };
  }

  // Adapte la longueur du post à la durée de la vidéo.
  const mode = durationMode(meta.durationSeconds);

  let post;
  try {
    post = await callAI(settings, buildMessages(meta, settings, mode));
    // Nettoyage final : retire sous-titres, gras markdown, numérotations robotiques.
    post = cleanPost(post);
    if (!post) throw new Error('EMPTY_RESPONSE');
  } catch (e) {
    const code = e.message || 'AI_ERROR';
    const map = {
      LOCAL_SERVER_OFFLINE: "Serveur IA local injoignable. Démarre Ollama (ou LM Studio) puis réessaie.",
      MISSING_API_KEY: "Clé API manquante. Ajoute-la dans les options.",
      TIMEOUT: "L'IA a mis trop de temps à répondre. Réessaie.",
      NETWORK_ERROR: "Erreur réseau lors de l'appel à l'IA.",
      EMPTY_RESPONSE: "L'IA a renvoyé une réponse vide. Réessaie."
    };
    return { ok: false, code, message: map[code] || `Erreur IA: ${code}` };
  }

  // Déduit 1 crédit uniquement si: provider commercial ET pas abonné Pro.
  // Local et Pro = aucune déduction (illimité).
  const isLocal = !!PROVIDERS[settings.aiProvider]?.isLocal;
  const isPro = settings.subscriptionStatus === 'active';
  let remaining = null;
  if (!isLocal && !isPro) {
    remaining = Math.max(0, (Number(settings.freeCredits) || 0) - 1);
    await chrome.storage.sync.set({ freeCredits: remaining });
  }

  return {
    ok: true,
    post,
    meta: {
      title: meta.title,
      channel: meta.channel,
      durationSeconds: meta.durationSeconds,
      durationLabel: formatDuration(meta.durationSeconds),
      mode: mode.name,
      modeWords: mode.words
    },
    credits: { unlimited: isLocal || isPro, remaining }
  };
}

// ---------------------------------------------------------------------------
// Routeur de messages
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'GENERATE_POST':
          sendResponse(await generatePost());
          break;
        case 'GET_SETTINGS':
          sendResponse({ ok: true, settings: await getSettings() });
          break;
        case 'REFRESH_SUBSCRIPTION': {
          const r = await refreshSubscription();
          sendResponse({ ok: true, status: r.status, reason: r.reason });
          break;
        }
        case 'PING':
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, message: 'UNKNOWN_MESSAGE' });
      }
    } catch (e) {
      sendResponse({ ok: false, code: 'INTERNAL', message: String(e?.message || e) });
    }
  })();
  return true; // réponse asynchrone
});
