# Politique de confidentialité — TubeToPost

**Dernière mise à jour : 14 juin 2026**

TubeToPost (« l'extension ») transforme une vidéo YouTube en brouillon de post
LinkedIn à l'aide d'une IA. Cette politique explique quelles données sont traitées,
comment, et avec qui. Nous appliquons le principe de **minimisation** : on ne traite
que ce qui est nécessaire à la fonction, rien de plus.

## 1. Données traitées

**a) Contenu de la vidéo YouTube active**
Quand vous cliquez sur « Générer », l'extension lit, sur l'onglet YouTube actif :
le titre, le nom de la chaîne, la description, la durée et, si disponibles, les
sous-titres (transcription) de la vidéo. Ces données servent uniquement à produire
le post et ne sont **pas conservées** par l'extension après la génération.

**b) Réglages locaux**
Stockés dans le stockage de votre navigateur (`chrome.storage.sync`) :
fournisseur d'IA choisi, modèle, langue, ton, clé(s) API que vous saisissez,
email d'abonnement, statut d'abonnement, crédits d'essai restants. Ces données
**restent dans votre navigateur** (et se synchronisent via votre compte Chrome si
la synchronisation est activée). Elles ne sont transmises à aucun serveur de TubeToPost.

**c) Email d'abonnement**
Si vous souscrivez à l'offre Pro, votre email sert à associer votre abonnement
Stripe et à vérifier votre statut. Il n'est utilisé que pour cela.

## 2. À qui les données sont envoyées (sous-traitants)

- **Fournisseur d'IA que VOUS choisissez :**
  - *Mode local (Ollama / LM Studio)* : le contenu de la vidéo est envoyé à un
    serveur d'IA tournant **sur votre propre machine**. Rien ne quitte votre ordinateur.
  - *Mode commercial (OpenAI ou Anthropic)* : le contenu de la vidéo est envoyé à
    l'API du fournisseur que vous avez configuré, avec votre clé API, pour générer
    le texte. Voir leurs politiques respectives (OpenAI, Anthropic).
- **Stripe** : traitement des paiements et gestion de l'abonnement. Les données de
  carte bancaire sont saisies **directement chez Stripe** ; elles ne transitent
  jamais par l'extension ni par notre backend.
- **YouTube/Google** : l'extension lit la page YouTube déjà ouverte par vous.

Nous ne **vendons** ni ne **louons** aucune donnée. Aucune publicité, aucun pistage.

## 3. Notre backend

Le backend de TubeToPost sert uniquement à :
- créer une session de paiement Stripe,
- vérifier votre statut d'abonnement **en interrogeant Stripe en direct** (par email),
- recevoir les notifications d'abonnement de Stripe (webhook).

Le backend **ne stocke aucune base de données** d'utilisateurs : Stripe est la
source de vérité. Aucun contenu de vidéo n'est envoyé à notre backend.

## 4. Clés API

Les clés API que vous saisissez (OpenAI/Anthropic) sont stockées **localement**
dans votre navigateur et envoyées **uniquement** au fournisseur correspondant lors
d'une génération. Nous n'y avons jamais accès. Vous pouvez les supprimer à tout
moment dans les options de l'extension.

## 5. Conservation et suppression

- Contenu de vidéo : traité en mémoire le temps de la génération, non conservé.
- Réglages et clés : conservés dans votre navigateur jusqu'à ce que vous les
  effaciez (options de l'extension, ou désinstallation, ou effacement des données
  du site/extension).
- Données d'abonnement : gérées par Stripe selon leur politique. Résiliation en un
  clic depuis l'extension ou la page de compte ; vous pouvez aussi demander la
  suppression de votre compte client Stripe.

## 6. Sécurité

Communications chiffrées en HTTPS. Aucune clé secrète n'est embarquée dans
l'extension. Le moindre privilège est appliqué aux permissions et aux clés.

## 7. Enfants

TubeToPost n'est pas destiné aux personnes de moins de 16 ans.

## 8. Contenu bloqué (éthique)

L'extension refuse de générer du contenu pour certaines catégories (jeux d'argent,
alcool, musique, contenu vulgaire). Ce filtrage est effectué **localement**, sans
transmission de données supplémentaires.

## 9. Vos droits

Selon votre juridiction (RGPD, etc.), vous pouvez demander l'accès, la rectification
ou la suppression de vos données d'abonnement. Pour toute demande : **contact@tubetopost.com**
(à remplacer par votre adresse réelle).

## 10. Modifications

Cette politique peut évoluer. La date en haut indique la dernière mise à jour.

---

*TubeToPost — convertir une vidéo YouTube en post LinkedIn, de façon honnête et respectueuse de votre vie privée.*
