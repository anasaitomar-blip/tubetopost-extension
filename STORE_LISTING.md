# Chrome Web Store — Checklist de publication TubeToPost

Tout ce qu'il faut pour soumettre l'extension. Coche au fur et à mesure.

---

## 1. Compte développeur
- [ ] Compte Chrome Web Store Developer (frais uniques **5 $**) — https://chrome.google.com/webstore/devconsole

## 2. Paquet de l'extension
- [ ] ZIP du dossier de l'extension (sans `node_modules`, `backend/`, `.git`, `test.mjs`, `make-icons.js`)
  - Contenu requis : `manifest.json`, `background.js`, `config.js`, `clean.js`,
    `popup.html/css/js`, `options.html/css/js`, `icons/`
- [ ] `manifest.json` : version incrémentée à chaque mise à jour

## 3. Icônes (déjà générées dans `icons/`)
| Taille | Usage | Statut |
|---|---|---|
| 16×16 | favicon barre d'outils | ✅ `icon16.png` |
| 32×32 | Windows | ✅ `icon32.png` |
| 48×48 | page extensions | ✅ `icon48.png` |
| 128×128 | **Store + installation (obligatoire)** | ✅ `icon128.png` |

> Les icônes actuelles sont fonctionnelles (carré violet + play). Pour un rendu
> Store premium, envisager une version travaillée par un designer (optionnel).

## 4. Captures d'écran (obligatoire : au moins 1)
- [ ] **1 à 5 captures**, format **1280×800** (recommandé) ou 640×400, PNG ou JPEG
- Idées de captures à préparer :
  1. Le popup épuré sur une vidéo YouTube + post généré
  2. Le badge durée/mode/transcription (⏱ · Rapport · 📝)
  3. Le tableau de bord Options (moteur IA local/cloud)
  4. Le filtrage éthique en action (message de blocage)
  5. L'abonnement transparent 15€/mois (page upgrade)

## 5. Visuels promotionnels (optionnels mais recommandés pour le classement)
| Visuel | Taille | Obligatoire |
|---|---|---|
| Petite tuile promo | **440×280** PNG/JPEG | non (mais conseillé) |
| Tuile marquee | **1400×560** PNG/JPEG | non |

## 6. Textes de la fiche (SEO)

**Titre** (max ~45 car.) :
```
TubeToPost - YouTube to LinkedIn AI Post Creator
```

**Résumé court** (max 132 car.) :
```
Convertissez une vidéo YouTube en post LinkedIn pro avec l'IA. Résumé IA, transcription vidéo en texte, créateur de contenu.
```

**Description détaillée** (riche en mots-clés recherchés) :
```
TubeToPost transforme n'importe quelle vidéo YouTube en post LinkedIn professionnel,
prêt à publier, en un clic — grâce à l'intelligence artificielle.

★ CE QUE FAIT TUBETOPOST
- Convertir une vidéo en texte : extraction automatique du titre, de la description
  et de la transcription (sous-titres) de la vidéo.
- Résumé IA : l'IA synthétise les idées clés et rédige un post LinkedIn percutant.
- Créateur de contenu : longueur adaptée à la durée de la vidéo (astuce flash,
  post standard, ou rapport d'expert détaillé).
- 100% honnête : reformulation et synthèse, jamais de copier-coller. Respect du
  droit d'auteur.

★ IA LOCALE OU CLOUD, AU CHOIX
- Mode local gratuit (Ollama / LM Studio) : vos données ne quittent pas votre PC.
- Mode commercial (OpenAI / Claude) pour les abonnés Pro.

★ ÉTHIQUE INTÉGRÉE
Filtrage automatique : pas de génération pour les contenus de jeux d'argent,
d'alcool, de musique ou vulgaires.

★ TARIF TRANSPARENT
3 essais gratuits, puis 15€/mois sans frais cachés. Désabonnement en un clic.

Mots-clés : convertir vidéo en texte, résumé IA, créateur de contenu LinkedIn,
YouTube to LinkedIn, transcription vidéo, AI post generator, personal branding.
```

- [ ] Catégorie : **Productivity** (Productivité)
- [ ] Langue principale : Français (ajouter Anglais si fiche traduite)

## 7. Confidentialité & conformité (section obligatoire du Dev Console)
- [ ] **URL de politique de confidentialité** : `https://tubetopost-backend.onrender.com/privacy`
      (route ajoutée au backend — voir `backend/server.js`)
- [ ] **Objectif unique (single purpose)** :
  ```
  Générer un brouillon de post LinkedIn à partir de la vidéo YouTube ouverte par l'utilisateur.
  ```
- [ ] **Justification des permissions** (à coller dans le formulaire) :

| Permission | Justification |
|---|---|
| `activeTab` | Lire la vidéo YouTube uniquement quand l'utilisateur clique sur « Générer ». |
| `scripting` | Injecter le script d'extraction (titre, description, durée, sous-titres) sur la page YouTube active. |
| `storage` | Sauvegarder les réglages de l'utilisateur (fournisseur IA, modèle, langue, clé API, statut). |
| `host: youtube.com` | Lire le contenu de la vidéo à convertir. |
| `host: localhost:11434 / 127.0.0.1:1234` | Envoyer le contenu au serveur d'IA local (Ollama/LM Studio) de l'utilisateur. |
| `host: api.openai.com / api.anthropic.com` | Envoyer le contenu à l'IA commerciale choisie par l'utilisateur (mode Pro). |
| `host: tubetopost-backend.onrender.com` | Vérifier le statut d'abonnement et ouvrir le paiement Stripe. |

- [ ] **Déclaration d'usage des données** (Data usage) :
  - Données collectées : email (pour l'abonnement). Contenu de la page web traité
    mais non stocké.
  - [x] Pas de vente de données à des tiers
  - [x] Pas d'usage hors fonctionnalité principale
  - [x] Pas de crédit/évaluation de solvabilité

## 8. Avant de soumettre
- [ ] Tester l'extension en local (chargée non empaquetée) — OK
- [ ] Politique de confidentialité accessible publiquement (route `/privacy`)
- [ ] Remplacer `contact@tubetopost.com` par une adresse réelle dans `PRIVACY.md`
- [ ] Vérifier que `config.js` ne contient **aucune** clé secrète (OK : seulement URL backend + priceId public)
- [ ] Captures + icône 128 prêtes

## 9. Délai
Revue Google : généralement **quelques heures à quelques jours**. Les extensions
qui demandent des permissions larges ou manquent de justification sont rejetées —
nos justifications ci-dessus sont prêtes.
