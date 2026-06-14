// config.js — Central configuration (ES module, imported by background.js)
// =====================================================================
// SWITCH IA : change AI_PROVIDER_DEFAULT pour basculer local <-> commercial.
// La valeur réelle vient des réglages utilisateur (options.html) ;
// ceci n'est que le défaut au premier lancement.

export const DEFAULT_SETTINGS = {
  // 'local'   -> Ollama  (RTX 5060 Ti, 100% gratuit, localhost:11434)
  // 'lmstudio'-> LM Studio (API OpenAI-compatible, 127.0.0.1:1234)
  // 'openai'  -> API commerciale OpenAI
  // 'anthropic'-> API commerciale Anthropic (Claude)
  aiProvider: 'local',

  // --- Local : Ollama ---
  localUrl: 'http://localhost:11434',
  localModel: 'llama3.1:8b',

  // --- Local : LM Studio (OpenAI-compatible) ---
  lmstudioUrl: 'http://127.0.0.1:1234',
  lmstudioModel: 'local-model',

  // --- Commercial : OpenAI ---
  openaiKey: '',
  openaiModel: 'gpt-4o-mini',

  // --- Commercial : Anthropic ---
  anthropicKey: '',
  anthropicModel: 'claude-haiku-4-5-20251001',

  // --- Génération ---
  language: 'fr',          // 'fr' | 'en'
  tone: 'professional',    // 'professional' | 'inspirational' | 'educational'
  hashtags: true,

  // --- Abonnement (Stripe) ---
  subscriptionStatus: 'free', // 'free' | 'active'
  userEmail: '',              // email de l'abonné (relie l'extension au statut Stripe)

  // Essais gratuits : 3 crédits offerts à l'installation. 1 crédit = 1 post généré.
  // Le mode local (Ollama/LM Studio) NE consomme PAS de crédit (illimité).
  freeCredits: 3,
  freeCreditsInitial: 3
};

// Fournisseurs d'IA — abstraction unique. Ajouter un provider = 1 entrée.
// Chacun expose: buildRequest(settings, messages) -> {url, init}
//                parse(json) -> string
export const PROVIDERS = {
  local: {
    label: 'Ollama (local, gratuit)',
    isLocal: true,
    needsKey: false,
    buildRequest(s, messages) {
      return {
        url: `${s.localUrl.replace(/\/$/, '')}/api/chat`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: s.localModel, messages, stream: false,
            // Contexte large (entrée + sortie longue) et budget de génération suffisant.
            options: { num_ctx: 8192, num_predict: 1024, temperature: 0.7 }
          })
        }
      };
    },
    parse: (j) => j?.message?.content ?? ''
  },

  lmstudio: {
    label: 'LM Studio (local, gratuit)',
    isLocal: true,
    needsKey: false,
    buildRequest(s, messages) {
      return {
        url: `${s.lmstudioUrl.replace(/\/$/, '')}/v1/chat/completions`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: s.lmstudioModel, messages, temperature: 0.7, max_tokens: 2048, stream: false })
        }
      };
    },
    parse: (j) => j?.choices?.[0]?.message?.content ?? ''
  },

  openai: {
    label: 'OpenAI (commercial)',
    isLocal: false,
    needsKey: true,
    buildRequest(s, messages) {
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s.openaiKey}`
          },
          body: JSON.stringify({ model: s.openaiModel, messages, temperature: 0.7 })
        }
      };
    },
    parse: (j) => j?.choices?.[0]?.message?.content ?? ''
  },

  anthropic: {
    label: 'Anthropic / Claude (commercial)',
    isLocal: false,
    needsKey: true,
    buildRequest(s, messages) {
      // Anthropic API attend system séparé du tableau messages.
      const system = messages.find((m) => m.role === 'system')?.content ?? '';
      const turns = messages.filter((m) => m.role !== 'system');
      return {
        url: 'https://api.anthropic.com/v1/messages',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': s.anthropicKey,
            'anthropic-version': '2023-06-01',
            // Requis pour appeler l'API depuis un navigateur / extension :
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: s.anthropicModel,
            max_tokens: 2048,
            system,
            messages: turns
          })
        }
      };
    },
    parse: (j) => j?.content?.[0]?.text ?? ''
  }
};

// Stripe — abonnement transparent 15€/mois, sans frais cachés, résiliable en 1 clic.
const BACKEND_URL = 'https://tubetopost-backend.onrender.com';
export const STRIPE = {
  priceEur: 15,
  priceId: 'price_1TiGbfQfwGpnUACeJWqybF37', // ID du prix Stripe (live)
  // Pages + endpoints hébergés par le backend Render (jamais de clé secrète ici).
  upgradeUrl: `${BACKEND_URL}/upgrade`,                        // page d'abonnement
  accountUrl: `${BACKEND_URL}/account`,                        // page gestion / désabo
  checkoutUrl: `${BACKEND_URL}/api/checkout`,                  // crée la session Checkout
  portalUrl: `${BACKEND_URL}/api/portal`,                      // portail client = désabo 1 clic
  statusUrl: `${BACKEND_URL}/api/subscription-status`          // vérifie l'état (?email=)
};

// Filtre éthique — catégories bloquées : jeux d'argent, alcool, musique, vulgaire.
// Mots-clés FR + EN. Tout en minuscules, comparaison insensible à la casse.
export const ETHICAL_FILTERS = {
  gambling: [
    'casino', 'poker', 'roulette', 'blackjack', 'paris sportif', 'paris sportifs',
    'pari sportif', 'betting', 'bet', 'gamble', 'gambling', 'jackpot', 'slots',
    'machine à sous', 'machines à sous', 'loterie', 'lottery', 'bookmaker',
    'cote', 'cotes', 'pronostic', 'pronostics', 'winamax', 'betclic', 'unibet',
    'crypto casino', 'mise', 'parier'
  ],
  alcohol: [
    'alcool', 'alcohol', 'biere', 'bière', 'beer', 'vin', 'wine', 'whisky',
    'whiskey', 'vodka', 'rhum', 'rum', 'cocktail', 'cocktails', 'tequila',
    'champagne', 'spiritueux', 'liqueur', 'apéro', 'apero', 'bourré', 'bourre',
    'ivre', 'drunk', 'shots', 'open bar', 'dégustation alcool', 'brewery',
    'brasserie', 'gin', 'cognac'
  ],
  music: [
    'official music video', 'official video', 'lyrics', 'lyric video',
    'clip officiel', 'audio officiel', 'official audio', 'ft.', 'feat.',
    'featuring', 'vevo', '- topic', 'prod by', 'prod.', 'remix', 'cover song',
    'full album', 'mixtape', 'beat', 'instrumental', 'son officiel'
  ],
  vulgar: [
    'porn', 'porno', 'pornographie', 'xxx', 'nsfw', 'onlyfans', 'sexe explicite',
    'nude', 'nudes', 'fuck', 'shit', 'bitch', 'salope', 'pute', 'enculé',
    'enculer', 'connard', 'putain de', 'nique', 'niquer', 'bdsm', 'hentai'
  ]
};
