# Refonte mobile-first de Cold Impact (v033-ux)

Refonte de l'expérience mobile du jeu v033, **sans toucher au gameplay**. Point de départ : la v033 telle quelle (menu CLASSIQUE /
DÉFI / BOUTIQUE, couloir infini, 9 niveaux, générateur de missions). Complète [MOBILE_AUDIT.md](MOBILE_AUDIT.md) (v030 : performances,
mémoire, qualité graphique) qui traitait surtout du rendu.

## 1. Audit de départ (v033)

| Sujet | Constat | Fichiers |
|---|---|---|
| Moteur | three.js r149, scripts classiques sans build ; boucle `requestAnimationFrame` plafonnée à 60 (jeu) / 20 images/s (menus) | `index.html`, `src/core/game.js` |
| Interface | **tout dessiné dans le canvas du HUD** ; clics testés contre une liste de rectangles refaite à chaque image | `src/ui/menu.js`, `shop.js`, `hud.js` |
| Navigation | écrans = états du jeu (`MENU`, `RESULTS`, pause) + une surcouche `ui.overlay` ; retour par **Échap** | `menu.js`, `game.js` (`onKey`) |
| Écrans | accueil, DÉFI, missions libres, boutique, pause, résultats (3 variantes), réglages, liste des touches, publicités | `menu.js`, `shop.js`, `ads.js` |
| Boutique | 21 lignes de 2 colonnes (~14 px de texte), pas de défilement ni d'aperçu ; toucher une carte possédée l'équipait aussitôt | `shop.js`, `src/entities/skins.js` |
| Monnaie | **aucune** depuis la v031 : un cosmétique = 2,29 € (lien Stripe) ou 1 minute de publicité | `config.js` (`shop`), `shop.js` |
| Cosmétiques | 20 apparences de roquette + STOCK (couleurs, dimensions, pièces rapportées), 3 raretés | `skins.js`, `models.js` |
| Entrées | souris (pointer lock) + clavier ; tactile : glisser / toucher / appui long / bords | `input.js`, `touch.js` |
| Haptics | déjà un module (`haptics.js`, Android + repli iPhone), 5 « types » d'impulsion, appelé au cas par cas | `haptics.js` |
| Audio | Web Audio synthétisé, `audio.play(nom)` ; un seul son d'interface (`ui`) | `audio.js` |
| Sauvegarde | `localStorage` `coldimpact.save` : records, étoiles, cosmétiques, réglages | `game.js` (`loadSave`, `writeSave`) |
| Résolutions | tactile : plein écran, portrait / paysage ; ordinateur : zone 16:9 centrée ; **aucune** gestion de l'encoche / barre d'accueil | `game.js` (`resize`) |

**Défauts trouvés** (ce qui dépendait encore du PC ou ne fonctionnait pas au doigt) :

1. Réglages ouverts **seulement par Tab**, liste des touches par **F1** : aucun accès depuis le menu d'accueil sur téléphone.
2. Boutons `< valeur >` de 10 px dans les réglages, inutilisables au doigt.
3. L'action d'un bouton partait à l'**appui** ; aucun état « enfoncé » ; impossible d'annuler en glissant hors du bouton.
4. Un clic **dans le vide** relançait la partie (écran de résultats) ou reprenait (pause) : déclenchement accidentel au doigt.
5. Un seul « BACK » dans la boutique ; DÉFI / missions : retour par un petit texte en bas.
6. Boutique : texte minuscule, cartes de 40 px, noms tronqués, pas d'aperçu, équipement involontaire.
7. Tutoriel : trois bulles de texte en vol, **tactile seulement**, sans consigne vérifiée ni moyen de le passer ou de le rejouer.
8. Langue mélangée (pause, réglages, résultats, publicités en anglais ; menu en français).
9. Jauge d'essence collée au bas de l'écran, sous la barre d'accueil des iPhone récents.
10. Mouvement de caméra / menus à 20 images/s : un appui sur un bouton n'avait aucune réaction visible fluide.

## 2. Ce qui a été fait

| Système | Réalisation | Fichiers |
|---|---|---|
| **Kit tactile** | pointeur unique souris + doigt ; appui → bouton enfoncé, action au **relâchement** (glisser dehors annule) ; états normal / survol / enfoncé / désactivé / verrouillé ; zone ≥ 48 points ; défilement au doigt avec inertie et à la molette ; curseurs, interrupteurs, choix multiples, onglets ; toasts ; dialogue de confirmation | `src/ui/widgets.js` |
| **Navigation** | bouton RETOUR (flèche, haut gauche) sur chaque écran, pile de navigation (`ui.open` / `ui.back`), plus aucun clic dans le vide ; Échap / Tab / F1 gardés comme raccourcis | `menu.js`, `widgets.js`, `game.js` |
| **Haptics** | API centralisée `CC.Haptics` : `light` / `medium` / `heavy` + `success` / `error`, réglage OFF / LÉGÈRE / MOYENNE / FORTE, sans erreur si non supporté ; `ui.feedback()` associe son + vibration | `haptics.js`, `widgets.js`, `audio.js` |
| **Tutoriel** | premier vol guidé sur CITY : tirer → diriger → boost → essence → virage au bord → cible ; ralenti tant que le geste n'est pas fait ; PASSER ; rejouable ; enregistré ; données dans un tableau `STEPS` | `tutorial.js`, `dombuttons.js`, `game.js`, `hud.js` |
| **Pause / résultats** | gros boutons, REPRENDRE mis en avant, quitter avec confirmation ; compteurs animés, étoiles qui apparaissent une à une (son + vibration), record qui pulse | `endscreens.js` |
| **Réglages / aide** | liste défilante : sons (curseurs), vibrations, sensibilité (glissé tactile ou souris), inversion, graphismes, effets, FPS, pubs, COMMENT JOUER, REVOIR LE TUTORIEL ; accessibles par l'engrenage du menu et la pause | `settings.js` |
| **Boutique** | aperçu 3D tournant (vrai modèle rendu dans une cible), onglets de rareté, grille défilante de grandes cartes (équipée / possédée / cadenas + prix), ÉQUIPER / ACHETER / PUB 1 MIN, confirmation avant paiement, célébration au déblocage (confettis, fanfare, vibration forte) | `shop.js`, `thumbs.js` |
| **Zones système** | marges de l'encoche et de la barre d'accueil lues par une sonde CSS et appliquées à l'interface, à la jauge d'essence, aux boutons HTML | `style.css`, `game.js` (`readSafe`), `hud.js` |
| **Fluidité de l'interface** | 60 images/s tant que l'interface s'anime (appui, défilement, aperçu), 20 sinon | `game.js`, `widgets.js` (`needFrames`) |
| **Langue** | interface d'abord unifiée en français, puis **entièrement en anglais** (v033-ux3) ; le HUD de vol garde ses libellés d'arcade (MISSILE!, LOW FUEL…) | partout |

Choix volontaires :

- **L'interface reste dessinée dans le canvas** (pas de réécriture en HTML) : même police pixel, même rendu sur tous les
  appareils, aucun changement d'architecture. Seuls PAUSE et PASSER sont de vrais boutons HTML, parce qu'en vol tout toucher sur
  le canvas sert à piloter.
- **Pas d'économie nouvelle** : la boutique garde « 2,29 € ou 1 minute de publicité ». Les cosmétiques n'ont aucun effet de gameplay.
- **Catégories de boutique** : les apparences de roquette sont le seul système de cosmétiques du jeu ; les onglets filtrent par rareté.
  La liste `TABS` de `shop.js` est faite pour recevoir d'autres catégories (flammes, thèmes…) le jour où elles existeront.
- **Identité d'un bouton = son rang d'enregistrement dans l'image**, pas sa position : un bouton qui glisse pendant l'animation
  d'ouverture d'un écran reste touchable (un défaut trouvé au test : un appui pendant l'animation était perdu).

## 3. Vérifications effectuées

Navigateur intégré (Chromium), page servie par `node tools/serve.js`, mode `#touch`, tailles 360×640, 390×844, 768×1024 (portrait),
844×390 (paysage) et fenêtre « ordinateur » 16:9. Entrées : vrais clics et molette du navigateur, événements `PointerEvent` /
`TouchEvent` synthétiques pour les enchaînements. Console : aucune erreur.

| Parcours | Résultat |
|---|---|
| Premier lancement (sauvegarde vide) | le tutoriel démarre seul ; PASSER → menu, `tutorialDone` enregistré ; après rechargement il ne revient pas |
| Tutoriel complet | tirer → diriger → boost → essence (3,4 s) → bord vérifiés étape par étape ; fin (`finishLevel` appelé à la cible) → menu + annonce ; crash → « OUPS » puis reprise à la première consigne |
| Rejouer le tutoriel | RÉGLAGES → REVOIR LE TUTORIEL → il redémarre |
| Menu → CLASSIQUE → pause (bouton HTML) → REPRENDRE / RÉGLAGES / MENU PRINCIPAL (confirmation RESTER / QUITTER) | fonctionne, y compris un appui pendant l'animation d'ouverture |
| Crash CLASSIQUE → résultats → REJOUER / MENU | fonctionne (distance qui monte, record) ; niveau fixe : résultats → REJOUER / NIVEAU SUIVANT / MENU |
| DÉFI : carte verrouillée (annonce + vibration d'erreur), carte 1 (lance la mission), onglets, retour | fonctionne |
| Boutique : choisir une carte, ACHETER → confirmation → « paiement pas encore actif » (lien Stripe vide), PUB 1 MIN → publicité → récompense → déblocage + équipement + célébration → SUPER !, ÉQUIPER une autre roquette, onglet RARE, retour | fonctionne ; l'équipement et les possessions sont enregistrés (`localStorage`) |
| Réglages : curseur son (valeur enregistrée), choix de vibration (impulsion émise), molette, aide | fonctionne |
| Vibrations | `navigator.vibrate` remplacé par un espion : impulsion légère sur un onglet, motif d'erreur sur un bouton verrouillé, motif `unlock` (trois coups montants) au déblocage, impulsion au tir tactile (`touchstart` / `touchend` réels) |
| Clavier (ordinateur) | Échap (retour de boutique / réglages / aide, pause, reprise), Tab, F1 |
| Redimensionnement à chaud (768×1024 → 390×844) | canevas recalculé, écran ouvert conservé |
| Zones système simulées (haut 47, bas 34 ; côtés 47 / bas 21) | interface, jauge d'essence, boutons HTML et carte du tutoriel décalés |
| **Gameplay inchangé** | pilote automatique : les 9 niveaux donnent **exactement** les mêmes temps et STYLE que la v033 d'origine (CITY 14,90 s / 847 … NIGHT CANYON 12,97 s / 2213) ; CLASSIQUE graines 5000 et 12919 : mêmes distances et causes (3736 MUR, 2228 MUR) |

## 4. Points restants

À tester sur un **vrai téléphone** (impossible depuis ici) :

1. **Vibrations réelles** : Android (API Vibration) à valider au toucher ; iPhone : Safari n'a pas l'API, le repli « interrupteur
   invisible » est bloqué par Apple à partir d'iOS 26.5 (voir `haptics.js`) → sur un iPhone à jour, rien ne vibrera.
2. **Son** (les nouveaux sons d'interface sont synthétisés, mais je n'ai pas pu les écouter) et volume relatif.
3. **Zones système réelles** (encoche, Dynamic Island, barre d'accueil, coins arrondis) : simulées seulement.
4. **Fluidité** sur un Android d'entrée de gamme (aperçus 3D de la boutique : ~30 rendus de 192 px au premier affichage, étalés
   2 par image ; les 24 images du plateau tournant ne sont gardées que pour le cosmétique choisi).
5. **Gestes** : confort du virage au bord, de l'appui long, de la taille des boutons au pouce.
6. **Paiement Stripe** : `CC.CONFIG.shop.stripeLink` est vide, donc ACHETER affiche « paiement pas encore actif » ; le parcours complet
   (redirection, retour, célébration) n'a pas pu être testé. La publicité est un exemple factice.

À faire plus tard :

- **Bouton retour du système** (Android / geste retour iOS) : il quitte encore la page au lieu de revenir en arrière dans le jeu
  (ajouter une entrée `history.pushState` par écran ouvert et appeler `ui.back()` sur `popstate`).
- Catégories de boutique autres que les roquettes (aucun système correspondant dans le jeu).
- Touche Échap en jeu sur ordinateur : le navigateur impose la sortie du verrouillage de la souris, donc le bouton PAUSE HTML
  n'est cliquable que lorsque le curseur est libre.
- Tests automatisés de l'interface (aujourd'hui : parcours manuels scriptés).
