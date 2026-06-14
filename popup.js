// popup.js — Logique de l'interface (pas de module : script classique)

const $ = (id) => document.getElementById(id);

const views = {
  idle: $('idleView'),
  loading: $('loadingView'),
  result: $('resultView'),
  error: $('errorView')
};

function show(view) {
  for (const v of Object.values(views)) v.classList.add('hidden');
  views[view].classList.remove('hidden');
}

// --- Réglages / pills d'état ---
async function refreshStatus() {
  const resp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (!resp?.ok) return;
  const s = resp.settings;

  const providerPill = $('providerPill');
  const providerLabel = $('providerLabel');
  const isLocal = s.aiProvider === 'local' || s.aiProvider === 'lmstudio';
  providerPill.classList.remove('pill-muted', 'pill-local', 'pill-cloud');
  if (isLocal) {
    providerPill.classList.add('pill-local');
    providerLabel.textContent = 'Mode local';
  } else {
    providerPill.classList.add('pill-cloud');
    providerLabel.textContent = s.aiProvider === 'openai' ? 'OpenAI' : 'Claude';
  }

  updatePlanPill({
    subscriptionStatus: s.subscriptionStatus,
    freeCredits: s.freeCredits,
    isLocal
  });
}

// Met à jour la pastille de plan (Pro / N essais restants).
function updatePlanPill({ subscriptionStatus, freeCredits, isLocal }) {
  const planPill = $('planPill');
  planPill.classList.remove('pill-muted', 'pill-pro');
  if (subscriptionStatus === 'active') {
    planPill.classList.add('pill-pro');
    planPill.textContent = 'Pro';
  } else if (isLocal) {
    planPill.classList.add('pill-muted');
    planPill.textContent = 'Local · illimité';
  } else {
    const n = Number(freeCredits) || 0;
    planPill.classList.add('pill-muted');
    planPill.textContent = `${n} essai${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`;
  }
}

// --- Génération ---
let lastMeta = null;

async function generate() {
  show('loading');
  $('loadingText').textContent = 'Analyse de la vidéo…';

  // Petit délai cosmétique du texte d'étape.
  const step = setTimeout(() => {
    $('loadingText').textContent = "Rédaction du post par l'IA…";
  }, 900);

  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: 'GENERATE_POST' });
  } catch (e) {
    clearTimeout(step);
    return showError({ message: "Le service en arrière-plan n'a pas répondu. Recharge l'extension." });
  }
  clearTimeout(step);

  if (!resp) return showError({ message: 'Aucune réponse du service.' });

  if (resp.ok) {
    lastMeta = resp.meta;
    $('postOutput').value = resp.post;
    const m = resp.meta || {};
    // Affiche la durée détectée + le mode d'adaptation choisi.
    const badge = m.durationLabel ? `⏱ ${m.durationLabel} · ${m.mode} (${m.modeWords} mots) — ` : '';
    $('resultTitle').textContent = badge + (m.title || 'Post généré');
    // Met à jour le compteur d'essais après une génération réussie.
    if (resp.credits && resp.credits.remaining !== null && resp.credits.remaining !== undefined) {
      updatePlanPill({ subscriptionStatus: 'free', freeCredits: resp.credits.remaining, isLocal: false });
    } else {
      refreshStatus();
    }
    show('result');
    return;
  }

  showError(resp);
}

function showError(resp) {
  const box = $('alertBox');
  box.classList.toggle('is-blocked', resp.code === 'BLOCKED');
  $('errorMessage').textContent = resp.message || 'Une erreur est survenue.';

  // Lien upgrade visible uniquement si quota dépassé.
  const upgrade = $('upgradeLink');
  upgrade.classList.toggle('hidden', resp.code !== 'QUOTA_EXCEEDED');

  show('error');
}

// --- Copier ---
async function copyPost() {
  const text = $('postOutput').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const label = $('copyLabel');
    const prev = label.textContent;
    label.textContent = 'Copié ✓';
    setTimeout(() => { label.textContent = prev; }, 1500);
  } catch {
    // Fallback : sélection manuelle.
    $('postOutput').select();
    document.execCommand('copy');
  }
}

// --- Stripe Checkout (ouvre la page hébergée par le backend) ---
function openCheckout() {
  // Page d'abonnement hébergée par le backend Render.
  chrome.tabs.create({ url: 'https://tubetopost-backend.onrender.com/upgrade' });
}

// --- Wiring ---
document.addEventListener('DOMContentLoaded', () => {
  refreshStatus();

  $('generateBtn').addEventListener('click', generate);
  $('regenBtn').addEventListener('click', generate);
  $('retryBtn').addEventListener('click', generate);
  $('copyBtn').addEventListener('click', copyPost);
  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('upgradeLink').addEventListener('click', (e) => { e.preventDefault(); openCheckout(); });
  $('upgradeFooter').addEventListener('click', (e) => { e.preventDefault(); openCheckout(); });
});
