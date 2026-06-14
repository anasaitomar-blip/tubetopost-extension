# TubeToPost — YouTube to LinkedIn AI Post Creator

Extension Chrome (Manifest V3) qui transforme une vidéo YouTube en post LinkedIn professionnel, honnête et prêt à publier.

## Installation (mode développeur)

1. `chrome://extensions`
2. Activer **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionner ce dossier
4. Épingler l'icône TubeToPost

## Tester gratuitement en LOCAL (RTX 5060 Ti)

### Option A — Ollama (recommandé)
```bash
# https://ollama.com
ollama pull llama3.1:8b
ollama serve              # écoute sur http://localhost:11434
```
Réglages → Moteur IA → **Ollama**. Rien ne quitte ta machine, illimité, gratuit.

> Ollama refuse par défaut les requêtes d'origine extension (CORS). Si l'appel échoue, lance avec :
> `OLLAMA_ORIGINS=chrome-extension://* ollama serve`

### Option B — LM Studio
Charge un modèle, démarre le serveur local (API OpenAI-compatible, port `1234`).
Réglages → Moteur IA → **LM Studio**.

## Basculer sur l'IA commerciale (clients)

Réglages → Moteur IA → **OpenAI** ou **Anthropic/Claude** → coller la clé API.
Le switch est unique : `aiProvider` dans les réglages (défaut dans `config.js`).
Les moteurs commerciaux sont réservés aux abonnés **Pro** (quota gratuit = 5 essais).

## Architecture

| Fichier | Rôle |
|---|---|
| `manifest.json` | MV3, permissions, SEO (titre + description riches en mots-clés) |
| `config.js` | Switch IA, abstraction `PROVIDERS`, filtre éthique, config Stripe |
| `background.js` | Service worker : extraction vidéo, filtre éthique, appel IA, gating abo |
| `popup.html/.css/.js` | Interface épurée (génération + copie) |
| `options.html/.css/.js` | Tableau de bord (moteur IA, style, abonnement) |
| `make-icons.js` | Génère les PNG d'icône (sans dépendance) |
| `test.mjs` | 49 tests : filtre, providers, PNG, manifest |

## Filtre éthique

`background.js` bloque, **avant** tout appel IA, les vidéos de : jeux d'argent,
alcool, musique, contenu vulgaire (mots-clés FR + EN, frontières de mots pour
éviter les faux positifs). Voir `ETHICAL_FILTERS` dans `config.js`.

## Stripe (15€/mois, sans frais cachés, désabo 1 clic)

L'extension n'embarque **aucune clé secrète**. Elle ouvre des pages hébergées par
ton backend :
- `checkoutUrl` → crée la session Stripe Checkout (`price` 15€/mois)
- `portalUrl` → portail client Stripe = **désabonnement en un clic**
- `statusUrl` → renvoie `{ active: true/false }`, synchronisé via `REFRESH_SUBSCRIPTION`

Remplace les `REPLACE_ME` dans `config.js` (`STRIPE`) et héberge les 3 endpoints.

## Tests

```bash
node test.mjs      # 49 pass attendus
node make-icons.js # régénère les icônes
```
