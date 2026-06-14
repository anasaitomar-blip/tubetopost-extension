// test.mjs — Validation sans navigateur : config, filtre éthique, providers, PNG.
import { DEFAULT_SETTINGS, PROVIDERS, ETHICAL_FILTERS, STRIPE } from './config.js';
import { cleanPost } from './clean.js';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

// Réplique exacte de la logique de filtre de background.js (mêmes regex).
function runEthicalFilter(meta) {
  const haystack = [meta.title, meta.channel, meta.description].filter(Boolean).join(' \n ').toLowerCase();
  for (const [category, terms] of Object.entries(ETHICAL_FILTERS)) {
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'iu');
      if (re.test(haystack)) return { blocked: true, category, term };
    }
  }
  return { blocked: false };
}

console.log('— Filtre éthique —');
const blockedCases = [
  ['Stratégie au casino de Las Vegas', 'gambling'],
  ['Meilleur pari sportif du week-end', 'gambling'],
  ['Dégustation de whisky écossais', 'alcohol'],
  ['Recette de cocktail maison', 'alcohol'],
  ['Drake - Official Music Video', 'music'],
  ['Nouveau clip officiel 2026', 'music'],
  ['Compilation NSFW', 'vulgar']
];
for (const [title, cat] of blockedCases) {
  const r = runEthicalFilter({ title });
  ok(r.blocked && r.category === cat, `"${title}" -> attendu ${cat}, reçu ${r.category || 'rien'}`);
}

console.log('— Faux positifs (doit passer) —');
const allowedCases = [
  'Apprendre le React en 2026',
  'Productivité : 5 méthodes de deep work',
  'Construire un SaaS avec Next.js',
  'Histoire de l alphabet latin',       // contient "bet" -> ne doit PAS matcher
  'Analyse marketing B2B'
];
for (const title of allowedCases) {
  const r = runEthicalFilter({ title });
  ok(!r.blocked, `"${title}" bloqué à tort (${r.category})`);
}

console.log('— Providers : buildRequest —');
const msgs = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }];
for (const [name, p] of Object.entries(PROVIDERS)) {
  const s = { ...DEFAULT_SETTINGS, aiProvider: name, openaiKey: 'sk-x', anthropicKey: 'sk-ant-x' };
  const { url, init } = p.buildRequest(s, msgs);
  ok(/^https?:\/\//.test(url), `${name}: URL invalide (${url})`);
  ok(init.method === 'POST', `${name}: méthode != POST`);
  ok(typeof init.body === 'string' && JSON.parse(init.body), `${name}: body JSON invalide`);
  ok(typeof p.parse === 'function', `${name}: parse manquant`);
}
// Anthropic doit séparer system du tableau messages.
{
  const { init } = PROVIDERS.anthropic.buildRequest({ ...DEFAULT_SETTINGS, anthropicKey: 'k' }, msgs);
  const body = JSON.parse(init.body);
  ok(body.system === 'sys', 'anthropic: system non séparé');
  ok(body.messages.length === 1 && body.messages[0].role === 'user', 'anthropic: messages mal filtrés');
  ok(init.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'anthropic: header navigateur manquant');
}
// parse() extrait bien le texte de chaque format.
ok(PROVIDERS.local.parse({ message: { content: 'A' } }) === 'A', 'local.parse');
ok(PROVIDERS.openai.parse({ choices: [{ message: { content: 'B' } }] }) === 'B', 'openai.parse');
ok(PROVIDERS.anthropic.parse({ content: [{ text: 'C' }] }) === 'C', 'anthropic.parse');

console.log('— Stripe config —');
ok(STRIPE.priceEur === 15, 'prix != 15€');
ok(STRIPE.checkoutUrl.startsWith('https://'), 'checkoutUrl non https');
ok(STRIPE.portalUrl.startsWith('https://'), 'portalUrl (désabo) manquant');

console.log('— Icônes PNG —');
for (const sz of [16, 32, 48, 128]) {
  const f = `./icons/icon${sz}.png`;
  const b = fs.readFileSync(f);
  const sigOK = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20); // IHDR width/height
  ok(sigOK, `${f}: signature PNG invalide`);
  ok(w === sz && h === sz, `${f}: dimensions ${w}x${h} != ${sz}`);
}

console.log('— Crédits gratuits (gating) —');
// Réplique exacte de checkAccess() de background.js.
function checkAccess(s) {
  const provider = PROVIDERS[s.aiProvider];
  if (provider?.isLocal) return { allowed: true, unlimited: true };
  if (s.subscriptionStatus === 'active') return { allowed: true, unlimited: true };
  const credits = Number(s.freeCredits) || 0;
  if (credits > 0) return { allowed: true, remaining: credits };
  return { allowed: false, reason: 'QUOTA_EXCEEDED' };
}
ok(DEFAULT_SETTINGS.freeCredits === 3, 'crédits initiaux != 3');
// Local : illimité même à 0 crédit.
ok(checkAccess({ aiProvider: 'local', freeCredits: 0, subscriptionStatus: 'free' }).unlimited === true, 'local doit être illimité');
ok(checkAccess({ aiProvider: 'lmstudio', freeCredits: 0, subscriptionStatus: 'free' }).unlimited === true, 'lmstudio doit être illimité');
// Pro : illimité.
ok(checkAccess({ aiProvider: 'openai', freeCredits: 0, subscriptionStatus: 'active' }).unlimited === true, 'pro doit être illimité');
// Gratuit cloud : autorisé tant que crédits > 0, bloqué à 0.
ok(checkAccess({ aiProvider: 'openai', freeCredits: 3, subscriptionStatus: 'free' }).remaining === 3, 'cloud 3 crédits -> remaining 3');
ok(checkAccess({ aiProvider: 'anthropic', freeCredits: 1, subscriptionStatus: 'free' }).allowed === true, 'cloud 1 crédit -> autorisé');
const blocked = checkAccess({ aiProvider: 'openai', freeCredits: 0, subscriptionStatus: 'free' });
ok(blocked.allowed === false && blocked.reason === 'QUOTA_EXCEEDED', 'cloud 0 crédit -> bloqué QUOTA_EXCEEDED');

console.log('— Mode dynamique selon durée —');
// Réplique des seuils de durationMode() de background.js.
function modeFor(seconds) {
  if (seconds == null) return { key: 'standard', words: '200-250' };
  if (seconds < 180) return { key: 'flash', words: '100-150' };
  if (seconds <= 900) return { key: 'standard', words: '200-250' };
  return { key: 'rapport', words: '350-500' };
}
ok(modeFor(120).key === 'flash', '2 min -> flash');
ok(modeFor(179).key === 'flash', '2:59 -> flash');
ok(modeFor(180).key === 'standard', '3 min -> standard');
ok(modeFor(600).key === 'standard', '10 min -> standard');
ok(modeFor(900).key === 'standard', '15 min -> standard (borne)');
ok(modeFor(901).key === 'rapport', '15:01 -> rapport');
ok(modeFor(1800).key === 'rapport', '30 min -> rapport');
ok(modeFor(null).key === 'standard', 'durée inconnue -> standard');
ok(modeFor(120).words === '100-150', 'flash = 100-150 mots');
ok(modeFor(1800).words === '350-500', 'rapport = 350-500 mots');

console.log('— Post-traitement cleanPost —');
// Gras markdown retiré.
ok(!cleanPost('Voici un **mot** important').includes('**'), 'gras ** non retiré');
ok(cleanPost('Voici un **mot** important') === 'Voici un mot important', 'de-bold incorrect');
// Titre markdown retiré.
ok(cleanPost('## Mon titre\nTexte') === 'Mon titre\nTexte', 'titre markdown # non nettoyé');
// Sous-titre académique supprimé.
ok(cleanPost('Introduction\nLe vrai contenu.') === 'Le vrai contenu.', 'sous-titre Introduction non supprimé');
ok(cleanPost('Partie 1\nContenu') === 'Contenu', 'sous-titre Partie 1 non supprimé');
ok(cleanPost('**1. La build multi-stage**\nDétails ici.').startsWith('- La build multi-stage'), 'heading numéroté gras mal nettoyé');
// Numérotation robotique -> tiret.
ok(cleanPost('1. Premier\n2. Second') === '- Premier\n- Second', 'numérotation non convertie en tiret');
// Puces hétérogènes -> tiret.
ok(cleanPost('* item\n• autre') === '- item\n- autre', 'puces non uniformisées');
// Sauts de ligne multiples effondrés.
ok(cleanPost('A\n\n\n\nB') === 'A\n\nB', 'sauts de ligne multiples non effondrés');
// Une vraie phrase commençant par "Comprenez" mais longue n'est PAS supprimée.
ok(cleanPost('Comprenez bien que ce point change tout dans la pratique.').length > 0, 'phrase légitime supprimée à tort');
// Les hashtags de fin sont conservés.
ok(cleanPost('Super post.\n\n#IA #LinkedIn').includes('#IA #LinkedIn'), 'hashtags de fin perdus');
// Entrée vide gérée.
ok(cleanPost('') === '' && cleanPost(null) === '', 'entrée vide non gérée');

console.log('— Transcription : extraction JSON + parsing json3 —');
// Réplique de extractJSONObject() de scrapeYouTube.
function extractJSONObject(text, marker) {
  const i = text.indexOf(marker);
  if (i === -1) return null;
  const start = text.indexOf('{', i);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
  }
  return null;
}
// Objet équilibré extrait même avec accolades/quotes imbriquées et bruit après.
{
  const src = 'var ytInitialPlayerResponse = {"a":{"b":"}{"},"c":[1,2]};</script>JUNK{bad';
  const raw = extractJSONObject(src, 'ytInitialPlayerResponse');
  ok(raw !== null, 'extraction null');
  const obj = JSON.parse(raw);
  ok(obj.a.b === '}{' && obj.c.length === 2, 'JSON imbriqué mal extrait');
}
ok(extractJSONObject('rien ici', 'marqueur') === null, 'marqueur absent -> null');

// Parsing json3 -> texte transcription (réplique).
function parseJson3(data) {
  return (data.events || [])
    .flatMap((e) => e.segs || [])
    .map((s) => s.utf8 || '')
    .join('')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
{
  const data = { events: [
    { segs: [{ utf8: 'Bonjour' }, { utf8: ' à' }] },
    { segs: [{ utf8: ' tous\n' }] },
    { /* event sans segs */ },
    { segs: [{ utf8: 'voici   la   suite' }] }
  ] };
  ok(parseJson3(data) === 'Bonjour à tous voici la suite', 'parsing json3 incorrect');
}
ok(parseJson3({}) === '', 'json3 vide -> chaîne vide');

console.log('— manifest.json —');
const mf = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
ok(mf.manifest_version === 3, 'manifest_version != 3');
ok(mf.name.includes('YouTube') && mf.name.includes('LinkedIn'), 'titre SEO incomplet');
ok(mf.background.type === 'module', 'service worker pas en module');
ok(mf.host_permissions.some((h) => h.includes('11434')), 'host localhost Ollama manquant');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
