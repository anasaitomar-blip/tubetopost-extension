// options.js — Logique du tableau de bord

const DEFAULTS = {
  aiProvider: 'local',
  localUrl: 'http://localhost:11434',
  localModel: 'llama3.1:8b',
  lmstudioUrl: 'http://127.0.0.1:1234',
  lmstudioModel: 'local-model',
  openaiKey: '', openaiModel: 'gpt-4o-mini',
  anthropicKey: '', anthropicModel: 'claude-haiku-4-5-20251001',
  language: 'fr', tone: 'professional', hashtags: true,
  userEmail: '',
  subscriptionStatus: 'free', freeCredits: 3, freeCreditsInitial: 3
};

const $ = (id) => document.getElementById(id);

const PROVIDER_HINTS = {
  local: "Lancez Ollama localement. Aucune donnée ne quitte votre machine. Gratuit.",
  lmstudio: "LM Studio expose une API compatible OpenAI sur le port 1234. Gratuit.",
  openai: "Nécessite une clé API OpenAI et un abonnement TubeToPost Pro.",
  anthropic: "Nécessite une clé API Anthropic et un abonnement TubeToPost Pro."
};

// Champs texte simples (id -> clé settings).
const TEXT_FIELDS = [
  'localUrl', 'localModel', 'lmstudioUrl', 'lmstudioModel',
  'openaiKey', 'openaiModel', 'anthropicKey', 'anthropicModel'
];

function showProviderBlocks(provider) {
  document.querySelectorAll('.provider-block').forEach((el) => {
    el.classList.toggle('hidden', el.dataset.provider !== provider);
  });
  $('providerHint').textContent = PROVIDER_HINTS[provider] || '';
}

async function load() {
  const s = await chrome.storage.sync.get(DEFAULTS);

  $('aiProvider').value = s.aiProvider;
  for (const id of TEXT_FIELDS) $(id).value = s[id] ?? '';
  $('language').value = s.language;
  $('tone').value = s.tone;
  $('hashtags').checked = !!s.hashtags;
  $('userEmail').value = s.userEmail ?? '';

  showProviderBlocks(s.aiProvider);
  renderPlan(s);
}

function renderPlan(s) {
  const active = s.subscriptionStatus === 'active';
  $('planName').textContent = active ? 'Plan Pro — actif' : 'Plan gratuit';
  $('upgradeBtn').classList.toggle('hidden', active);
  $('manageBtn').classList.toggle('hidden', !active);
  const credits = Number(s.freeCredits) || 0;
  const initial = Number(s.freeCreditsInitial) || 3;
  $('usageInfo').textContent = active ? 'illimité (Pro)' : `${credits} / ${initial}`;
}

async function save() {
  const patch = {
    aiProvider: $('aiProvider').value,
    language: $('language').value,
    tone: $('tone').value,
    hashtags: $('hashtags').checked,
    userEmail: $('userEmail').value.trim().toLowerCase()
  };
  for (const id of TEXT_FIELDS) patch[id] = $(id).value.trim();

  await chrome.storage.sync.set(patch);

  const toast = $('savedToast');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 1800);
}

// --- Stripe ---
function openUpgrade() {
  // Checkout hébergé par le backend Render (jamais de clé secrète dans l'extension).
  chrome.tabs.create({ url: 'https://tubetopost-backend.onrender.com/upgrade' });
}
function openPortal() {
  // Portail client Stripe = désabonnement en un clic.
  chrome.tabs.create({ url: 'https://tubetopost-backend.onrender.com/account' });
}
async function refreshSub() {
  const btn = $('refreshSubBtn');
  const email = $('userEmail').value.trim().toLowerCase();
  if (!email) {
    $('userEmail').focus();
    flashHint("Renseignez d'abord l'email de votre abonnement.");
    return;
  }
  // Persiste l'email avant la vérification (le background le lit depuis le storage).
  await chrome.storage.sync.set({ userEmail: email });

  const prev = btn.textContent;
  btn.textContent = 'Vérification…';
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'REFRESH_SUBSCRIPTION' });
  const s = await chrome.storage.sync.get(DEFAULTS);
  renderPlan(s);
  btn.textContent = prev;
  btn.disabled = false;
  if (r && r.status === null) {
    flashHint(r.reason === 'NO_EMAIL'
      ? "Email manquant."
      : "Statut indisponible pour le moment. Réessayez dans un instant.");
  } else if (s.subscriptionStatus !== 'active') {
    flashHint('Aucun abonnement actif trouvé pour cet email.');
  }
}

// Petit message éphémère réutilisant le toast.
function flashHint(text) {
  const toast = $('savedToast');
  toast.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
    toast.textContent = 'Réglages enregistrés ✓';
  }, 2200);
}

// --- Wiring ---
document.addEventListener('DOMContentLoaded', () => {
  load();

  $('aiProvider').addEventListener('change', (e) => showProviderBlocks(e.target.value));
  $('saveBtn').addEventListener('click', save);
  $('upgradeBtn').addEventListener('click', openUpgrade);
  $('manageBtn').addEventListener('click', openPortal);
  $('refreshSubBtn').addEventListener('click', refreshSub);

  // Navigation latérale : surbrillance au scroll/clic.
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
    });
  });
});
