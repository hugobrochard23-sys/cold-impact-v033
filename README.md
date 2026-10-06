# COLD IMPACT

Jeu web 3D (HTML / WebGL) : on pilote un missile qui ne s'arrête jamais, on frôle les murs pour gagner du style et on fonce sur la
cible. Inspiré de la bande-annonce du jeu *Dumbfire*. Tous les assets (textures pixel-art, modèles, police, sons, musique) sont
**originaux** et générés par le code ; aucun fichier du jeu d'origine n'est utilisé.

> **Version v033-ux (branche `mobile-ux`)** : le jeu v033 (menu CLASSIQUE / DÉFI / BOUTIQUE, couloir infini, 9 niveaux, générateur de
> missions) **repensé mobile-first** : tutoriel interactif, navigation et boutons tactiles, vibrations centralisées, boutique refaite avec
> aperçus 3D, réglages au doigt, zones système (encoche, barre d'accueil). **Le gameplay n'a pas changé** (le pilote automatique
> refait les mêmes temps qu'en v033). Détail : [analysis/MOBILE_UX.md](analysis/MOBILE_UX.md).

## Technologies

- **three.js r149** (copie locale `assets/lib/three.min.js`) pour la 3D ; **JavaScript classique** (scripts chargés par `index.html`,
  pas de bundler, pas de build) : le jeu marche aussi en double-cliquant sur `index.html`.
- Interface dessinée dans un **canvas 2D** avec une police pixel originale (`src/ui/font.js`) ; deux boutons HTML (pause, passer le
  tutoriel) posés par-dessus le jeu.
- Son : **Web Audio** (sons et musique synthétisés). Vibrations : API **Vibration** du navigateur (Android).
- Sauvegarde : `localStorage` (clé `coldimpact.save`). Outils de test : Node.js, puppeteer-core, ffmpeg (facultatifs, `npm install`).

## Lancer le jeu

```bash
node tools/serve.js 8123      # puis ouvrir http://localhost:8123
```

Aucune dépendance pour jouer. Sur ordinateur, ajouter `#touch` à l'adresse (`http://localhost:8123/#touch`) pour simuler un
téléphone : commandes tactiles, interface plein écran, boutons tactiles. Pour tester une encoche / une barre d'accueil, dans la
console du navigateur : `document.documentElement.style.setProperty('--cc-safe-top', '47px')` (puis `--cc-safe-bottom`, `-left`,
`-right`) et redimensionner la fenêtre.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `node tools/serve.js 8123` | serveur statique local |
| `/?test=1&autopilot=1&level=1` | banc de test : le pilote automatique joue le niveau N (9 niveaux), sans interface |
| `/?test=1&autopilot=1&endless=<graine>` | idem pour le mode CLASSIQUE (`tools/endlessplay.js`) |
| `/?test=1&autopilot=1&gen=hard&seed=1234` | idem pour une mission générée |
| `/?mission=<graine>&diff=<difficulté>` | lien partageable d'une mission générée |
| `/?showfps` ou réglage AFFICHER LES FPS | compteur d'images par seconde |
| `node tools/gentest.js 100 all --determinism` | test du générateur de missions (400 cartes) |
| `npm run record -- vXXX` / `npm run compare -- vXXX` | enregistrement et comparaison à la vidéo de référence |

## Structure du projet

```text
index.html, style.css, game.js    point d'entrée, mise en page, démarrage
src/config.js                     TOUS les paramètres réglables (annotés)
src/core/                         game.js (boucle, états, sauvegarde, niveaux), quality.js (graphismes AUTO), util.js
src/input/                        input.js (souris/clavier/pointeur + pilote auto), touch.js (gestes en vol), haptics.js (vibrations)
src/ui/                           interface — voir ci-dessous
src/audio/audio.js                sons et musique synthétisés (dont les sons d'interface)
src/world/, src/entities/, src/physics/, src/rendering/, src/systems/   monde, niveaux, générateur, roquette, cibles, rendu
tools/, tests/, analysis/         outils de test, protocole, historique (VERSIONS.md) et rapports
```

Interface (`src/ui/`), de bas en haut :

| Fichier | Rôle |
|---|---|
| `widgets.js` | **kit tactile** : pointeur unique (souris / doigt), boutons à états (normal, survol, enfoncé, désactivé, verrouillé), onglets, interrupteurs, curseurs, listes défilantes, toasts, dialogue de confirmation, icônes, retour sensoriel (son + vibration) |
| `menu.js` | cœur `CC.UI`, menu d'accueil, DÉFI, missions libres |
| `endscreens.js` | pause et écrans de résultats (compteurs, étoiles animées) |
| `settings.js` | réglages et aide « COMMENT JOUER » |
| `shop.js`, `thumbs.js` | boutique, et aperçus 3D des cosmétiques (rendu du vrai modèle dans une cible de rendu) |
| `tutorial.js` | tutoriel : tableau `STEPS` à modifier pour changer les consignes |
| `dombuttons.js` | boutons HTML PAUSE / PASSER |
| `hud.js`, `font.js`, `ads.js` | affichage en vol, police pixel, publicités d'exemple |

## Mobile-first (v033-ux)

L'objectif : un jeu pensé pour le doigt, qui reste jouable à la souris sur ordinateur. Règles suivies par toute l'interface :

- **Aucune action essentielle ne dépend du clavier** : chaque écran a son bouton RETOUR / REPRENDRE (Échap, Tab, F1, R restent
  des raccourcis de confort sur ordinateur).
- **Zones tactiles ≥ 48 points**, texte lisible, bouton qui s'enfonce au toucher ; l'action part au **relâchement** (glisser hors du
  bouton annule) ; un toucher dans le vide ne déclenche plus rien.
- **Retour sensoriel centralisé** : `ui.feedback('tap' | 'back' | 'tab' | 'equip' | 'unlock' | 'denied' | …)` joue le son et la
  vibration assortis. Vibrations (`CC.Haptics`) : `light()` navigation, `medium()` récompense / équipement, `heavy()` achat,
  explosion, cible détruite ; `success()` et `error()` ; réglage OFF / LÉGÈRE / MOYENNE / FORTE dans RÉGLAGES.
- **Zones système** : l'interface et la jauge d'essence respectent l'encoche et la barre d'accueil (`env(safe-area-inset-*)`, lues
  par `Game.readSafe`).
- **Premier lancement** : tutoriel guidé sur le niveau CITY (tirer, diriger, boost, essence, virage au bord, cible), au ralenti
  tant que le geste demandé n'est pas fait ; bouton PASSER ; rejouable depuis RÉGLAGES ; enregistré (`settings.tutorialDone`).
- **Boutique** : grand aperçu 3D tournant du cosmétique choisi, onglets de rareté, grille défilante de grandes cartes (équipé,
  possédé, verrouillé + prix), boutons ÉQUIPER / ACHETER / PUB 1 MIN, confirmation avant paiement, célébration au déblocage.

### Ce qui reste à faire / à vérifier sur un vrai téléphone

Voir la section « Points restants » de [analysis/MOBILE_UX.md](analysis/MOBILE_UX.md) : vibrations réelles (Android / iPhone), son,
zones système réelles, fluidité sur un téléphone d'entrée de gamme, paiement Stripe (lien à renseigner), bouton retour du système.

## Reprendre le développement

1. Lire `analysis/VERSIONS.md` (historique, une entrée par version) et `analysis/MOBILE_UX.md` (audit et choix de la refonte mobile).
2. Tous les réglages de gameplay sont dans `src/config.js`. Pour ajouter un écran : une méthode `drawXxx(ctx, game, W, H)` sur
   `CC.UI.prototype` + une entrée dans `UI.draw()` (`menu.js`) ; ses boutons passent par `placeButton` / `hitRect` (`widgets.js`).
3. Avant chaque publication : jouer le menu, la boutique et une partie sur ordinateur **et** avec `#touch`, lancer le pilote
   automatique (`?test=1&autopilot=1&level=N`) et vérifier que les temps n'ont pas bougé (CITY : 14,90 s).
4. Le dépôt GitHub est la version de référence : `git pull` avant de modifier, un commit par changement, jamais de `git push --force`.

---

## Contrôles

| Touche | Action |
|---|---|
| W,A,S,D | piloter à 360° : W cabre, S pique, A gauche, D droite, par rapport à la roquette (loopings et vol sur le dos possibles ; Z,Q,S,D sur AZERTY et les flèches marchent aussi) |
| Espace (maintenue) | moteur : pousse tant qu'Espace est enfoncée, s'éteint dès qu'on la relâche ; consomme l'essence |
| Souris | viser aussi à la souris (facultatif) : la roquette suit le réticule |
| Clic gauche | tirer / réapparaître au lanceur |
| Clic droit (maintenu) | grappin : s'accroche au mur ou au disque visé, relâcher pour lâcher |
| Maj (maintenue) | rétro-fusées : freinage fort, le moteur principal s'éteint |
| R | recommencer |
| Échap | pause / menu |
| Tab | réglages (sensibilité, inversion Y, volumes, post-traitement, FPS) |
| F1 | liste des touches |
| H | masquer le HUD |

**Sur téléphone ou tablette (v024)** : plein écran, aucun bouton sauf la pause (et PASSER pendant le tutoriel). **Toucher** : tir (animation du tube) ou
réapparition. **Glisser** en vol : diriger ; doigt tenu dans la **bande gauche / droite** de l'écran : virage sans fin
(haut / bas : glissé seulement). **Appui long** (doigt immobile ≥ 0,4 s) : boost tant que le doigt reste posé (il peut alors
bouger). Boost relâché : pendant **0,6 s** (fine barre jaune sous l'essence), reposer le doigt relance le boost aussitôt.
Mini vibration à chaque toucher en partie. Au lanceur, la vue ne bouge pas. Pas de curseur. **Pause** : reprendre, son, musique, recommencer, niveau suivant, réglages, menu principal (avec confirmation) ; la vibration (OFF / LÉGÈRE / MOYENNE / FORTE), la sensibilité du glissé et les graphismes se règlent dans RÉGLAGES (engrenage du menu d'accueil). Vibrations : Android (API Vibration) ; iPhone : petits « tics » seulement jusqu'à
iOS 26.4 (Apple a bloqué la méthode à partir d'iOS 26.5, Safari n'ayant pas l'API Vibration).

Dans les menus, la boutique et les réglages, tout se fait **au doigt ou à la souris** : chaque écran a son bouton RETOUR (flèche en haut à gauche), les boutons s'enfoncent au toucher et valident au relâchement ; les touches Échap (retour / pause), Tab (réglages) et F1 (aide) ne sont que des raccourcis (v033-ux).

**Moteur et essence (v009, v010).** Au tir, la roquette a **0,5 s de poussée gratuite** (jauge bleue « FREE BOOST ») ;
ensuite elle ne pousse que si **Espace** est maintenue, et chaque seconde de poussée brûle 1 s d'essence (jauge orange en bas à gauche,
rouge sous 25 %). Réservoir vide : moteur coupé, la roquette plane puis tombe. Le réservoir est plein à chaque tir et sa taille
baisse avec la difficulté (la jauge est plus courte) :

| Niveau | CITY | BRICKWORKS | CANYON | CAVE | WOODS | CONSTRUCTION | NIGHT FOREST |
|---|---|---|---|---|---|---|---|
| Essence (s) | 23 | 20 | 18 | 16 | 14 | 12 | 11 |
| Réserve restante au pilote automatique (s) | 13,8 | 15,8 | 8,6 | 6,5 | 5,8 | 6,1 | 3,2 |

Missions générées (v032) : le réservoir est calculé pour la plus longue approche de la carte, avec une marge qui baisse
avec la difficulté (×1,9 FACILE → ×1,18 IMPOSSIBLE).
Réglages : `rocket.freeBoost`, `rocket.fuelDefault` dans `src/config.js`, `fuel` dans chaque fiche de niveau.

**Caméra de vol (v010).** La caméra suit la roquette mais pas la visée : elle se réaligne peu à peu derrière la trajectoire
(`camera.followLag`, plus petit = caméra plus libre). En pilotant, on voit donc la roquette tourner à l'écran ; le réticule
indique la direction visée.

**Missiles anti-aériens (v020, v021).** Les tanks et les hélicoptères tirent sur la roquette quand ils la voient (jamais à travers
un bâtiment), entre 45 m et 90 à 140 m, et seulement s'ils sont devant elle (jamais de tir dans le dos). NIGHT FOREST a 2 tanks
de garde (ils tirent et se détruisent, mais ne comptent pas dans l'objectif : la cible reste la maison). La menace monte de CITY (0) à NIGHT FOREST (1) ; missions générées : selon le profil de difficulté (≈ 0,25 → 1).
Avec elle : tirs plus rapprochés (5 s → 1,6 s), visée plus juste (erreur 6 m → 0,3 m), anticipation de la trajectoire,
missiles plus rapides (50 → 68 m/s). Ils restent moins maniables que la roquette (virage 0,5 → 1,1 rad/s contre 1,5 à 1,8)
et plus lents qu'elle à pleine poussée : on les sème en virant franchement, et ils explosent sur les murs.
« MISSILE! » clignote en rouge quand l'un d'eux approche (moins de 90 m), avec un bip répété et une vibration (v026) ;
« LOW FUEL » clignote sous 25 % d'essence (deux notes, vibration). Réglages : `aa` et `rocket.lowFuel` dans `src/config.js`.

**Traînées et boost (v026).** Une fine traînée part du bout de chaque aileron : blanche, jaune puis rouge pendant le boost ;
des filets d'air glissent du nez vers l'arrière pendant le boost ; la caméra zoome légèrement pendant le boost
(`camera.boostZoom`) et revient ensuite. Traînées effacées près de la caméra pour garder la vue dégagée (`trails`).

Un contact rasant avec le sol ou un toit fait **glisser** la roquette. Un choc de face la fait **exploser**.
Les vitres, les murs de briques fins et les caisses se brisent.

**Mobile (v030).** Menus tactiles plein écran à gros boutons, tutoriel des premiers vols, qualité graphique AUTO / HIGH /
MEDIUM / LOW (réglage GRAPHICS), 60 images/s au plus, pause et son coupé quand l'application passe en arrière-plan,
publicités d'exemple (bannière, interstitielle, récompensée — annonceurs fictifs, réglage SAMPLE ADS). Analyse et mesures :
[analysis/MOBILE_AUDIT.md](analysis/MOBILE_AUDIT.md).

**Refonte visuelle (v028).** Propulsion en couches attachée à la tuyère, fumée qui dérive, explosions en étapes, épaves
qui brûlent, chars et hélicoptères détaillés et animés (tourelle à inertie, recul, assiette de vol), façades sans fenêtre
coupée, toits équipés, forêts de conifères, son du réacteur en couches. Détails et mesures : [analysis/DESIGN_REFONTE.md](analysis/DESIGN_REFONTE.md).

## Modes de jeu (v033)

Le menu d'accueil n'a plus que **trois gros boutons** (façon *Block Blast*) : **CLASSIQUE**, **DÉFI**, **BOUTIQUE**.

### CLASSIQUE — couloir infini

Le but : **faire le plus de mètres possible**, en une seule vie. Le couloir (rue entre des immeubles, canyon, gorge
enneigée…) est **généré à l'infini** devant la roquette, par tronçons de 200 m construits en quelques millisecondes et
détruits derrière elle (`src/world/endless.js`). Chaque partie a sa propre graine : jamais deux fois le même couloir.

- **Score** : la distance, en haut de l'écran, avec le record dessous (« NOUVEAU RECORD » dès qu'il est battu).
- **Paliers de difficulté** tous les 800 m : FACILE → MOYEN → DIFFICILE → IMPOSSIBLE (couloir de 40 m → 18 m de large,
  virages plus serrés, obstacles plus rapprochés, trous plus petits, chars ennemis de plus en plus précis à partir de MOYEN).
- **Obstacles** : barrière basse (passer dessus), poutre haute (dessous), pilier (côté libre), vitre géante (on la
  traverse), passerelle, laser, mur percé d'un trou, slalom, fenêtre entre deux poutres.
- **Essence** : 14 s au départ, réservoir de 20 s. Elle se recharge en **frôlant** (chaque point de STYLE rapporte de
  l'essence : « +0,7 S » s'affiche au-dessus de la jauge) et en **détruisant les cibles en route** (dépôts de carburant,
  camions, chars : +4 s ; la roquette les traverse et continue). Réservoir vide : la roquette plane puis s'écrase.
- **Zones de décor** tous les 1 000 m : ville, puis désert, neige, zone industrielle, canyon et ville de nuit dans un ordre
  tiré au sort ; l'ambiance lumineuse glisse d'une zone à l'autre.
- **Plafond** à 48 m : au-dessus, l'alarme « ALTITUDE! DESCENDS » clignote, puis explosion après 1,5 s.
- **Fin de partie** : distance, record, palier atteint, cause (MUR, MISSILE, LASER, TROP HAUT, PANNE SECHE), STYLE ;
  REJOUER relance aussitôt un nouveau couloir.

Réglages : `CC.CONFIG.endless` dans `src/config.js`. Banc de test : `?test=1&autopilot=1&endless=<graine>`, et
`tools/endlessplay.js` (le pilote automatique joue N parties et donne distance, cause du crash, obstacle en cause).

### DÉFI — cartes numérotées, étoiles et trophées

Quatre onglets **FACILE, MOYEN, DIFFICILE, IMPOSSIBLE** de **20 cartes numérotées** chacun (générées par le générateur de
missions à partir d'une graine fixe : les mêmes pour tous les joueurs), plus l'onglet **NIVEAUX** (les 9 niveaux d'origine).

- La carte suivante s'ouvre quand la précédente est terminée.
- **1 à 3 étoiles** au temps : 3 étoiles sous le temps de référence de la carte, 2 sous 1,5 fois ce temps, 1 étoile sinon
  (carte terminée). L'écran de fin donne le temps à battre pour l'étoile suivante.
- **Trophées** par difficulté : BRONZE à 10 étoiles, ARGENT à 20, OR à 40 (sur 60).
- Le bouton **MISSIONS LIBRES** ouvre l'ancien générateur (mission du jour, graine au choix, dernières missions).

Réglages : `CC.CONFIG.challenge`. Étalonnage : sur un vol propre, le pilote automatique met 75 à 82 % du temps de référence.

## Niveaux

Les 9 niveaux d'origine sont dans **DÉFI → NIVEAUX** (v033).

Chaque niveau reconstruit une séquence de la vidéo, avec l'interface (HUD) qu'il a dans la vidéo.

| # | Niveau | Séquence | HUD | Mode | Cible |
|---|---|---|---|---|---|
| 1 | CITY | 0,0–15,4 s | A (STYLE, THRUST:45, COOLDOWN) | style | hélicoptère noir |
| 2 | BRICKWORKS | 15,4–23,6 s | B (TARGETS n/4, SCORE) | 4 cibles | 4 chars |
| 3 | CANYON | 23,6–36,0 s | C (STYLE, TIME:∞, SPEED) | style | char dans la fosse |
| 4 | CAVE | 36,0–48,2 s | C | style | camion sur plateforme |
| 5 | WOODS | 48,2–64,5 s | B (SCORE) | score | char dans la maison |
| 6 | CONSTRUCTION | 64,5–79,3 s | C (sans SPEED) | style | hélicoptère camouflé |
| 7 | NIGHT FOREST | 79,3–89,1 s | B (SCORE) | score | maison |
| 8 | TRENCH RUN | création (v023, façon Star Wars) | C | style | hélicoptère qui s'enfuit dans une tranchée de 20 m, 19 obstacles, 9 tourelles |
| 9 | NIGHT CANYON | création (v023) | C | style | hélicoptère qui s'enfuit dans un canyon de nuit, convoi de 5 tanks en salves |
| 10 | MISSIONS | générateur (v032) | C | cibles | carte générée : 2 à 4 cibles selon la difficulté |

**Progression (v023)** : un niveau ne s'ouvre qu'une fois le précédent terminé (MISSIONS toujours libre) ; le menu pause
propose NEXT LEVEL quand le suivant est ouvert. Niveaux 1 et 3 : flèches vertes le long du chemin ; niveau 2 (v027) et suivants : repère rouge
permanent sur la cible. Salves anti-aériennes (2 missiles rapprochés, tirs groupés) sur les 3 derniers niveaux et les missions
DIFFICILE / IMPOSSIBLE ; les missiles ennemis accélèrent après le tir (on les voit partir). Essence réduite d'environ 15 %.

### Générateur de missions (v032 ; v033 : DÉFI → MISSIONS LIBRES)

Le bouton MISSIONS LIBRES de l'écran DÉFI ouvre le **GÉNÉRATEUR DE MISSIONS** : on choisit **FACILE, MOYEN, DIFFICILE ou IMPOSSIBLE**,
l'écran « GÉNÉRATION... » s'affiche, et une carte entière est **construite à la volée** (≈ 0,1 à 0,4 s sur ordinateur)
à partir d'une **graine** : même graine + même difficulté = même carte pour tout le monde. Rien n'est stocké à part la
graine, la difficulté, le temps (dernières missions, record par graine, record de la carte du jour).

- **8 familles de cartes** : zone urbaine, industrielle, militaire, rurale, montagneuse (vallées, arches, ponts, neige),
  désertique (dunes, avant-postes, puits de pétrole), portuaire (quais, grues, conteneurs, mer), mixte (plusieurs
  familles en bandes) ; **9 ambiances** (jour, couvert, brume de chaleur, aube, crépuscule, nuit, clair de lune,
  brouillard, neige).
- **Cibles variées** et toujours marquées en rouge : char, camion, hélicoptère (sur un toit ou en patrouille), maison,
  station radar, dépôt de carburant, poste de commandement — à découvert, derrière des murs, dans un hangar, sous un
  filet, au fond d'une cour ou d'une ruelle. Il faut parfois contourner pour s'aligner sur l'entrée.
- **Défenses** placées sur les vraies trajectoires d'approche (lignes de vue calculées) : tanks, lance-missiles (nouveaux,
  tourelle qui suit la roquette), hélicoptères en patrouille. Tirs croisés en IMPOSSIBLE, défenses espacées en FACILE.
- **Mission du jour** (même carte pour tous à une date donnée, DIFFICILE), **graine au choix** (un nombre ou un mot),
  **dernières missions** rejouables, graine affichée en pause et à l'écran de résultats (**NOUVELLE MISSION** enchaîne
  une autre carte de même difficulté). Lien partageable : `?mission=83927451&diff=hard`.
- Chaque carte est **validée avant d'être montrée** (aucune superposition, départ libre, chaque cible atteignable par
  une trajectoire vérifiée, virages faisables, essence suffisante, difficulté conforme) ; sinon une autre est tirée,
  toujours de façon déterministe.

| Difficulté | Cibles | Défenses | Missiles ennemis simultanés | Cibles protégées | Marge de passage | Réserve d'essence |
|---|---|---|---|---|---|---|
| FACILE | 2 (visent sans tirer) | 1–2 tanks | 2 | à découvert | 3,6 m | ×1,9 |
| MOYEN | 3 (visent sans tirer) | 2–4 tanks, 1 hélicoptère | 3 | murs, filets | 2,8 m | ×1,6 |
| DIFFICILE | 3–4 | 4–6 tanks, 1 lance-missiles, 1–2 hélicoptères, salves | 4 | hangars, cours, ruelles | 2,2 m | ×1,35 |
| IMPOSSIBLE | 4 | 7–9 tanks, 2–3 lance-missiles, 2–3 hélicoptères rapides, salves | 7 | entrées étroites, à contourner | 1,7 m | ×1,18 |

Détails, architecture, tests et résultats : [analysis/GENERATOR.md](analysis/GENERATOR.md). Touche **G** en mission : vue
de débogage (plan, danger, lignes de vue, score, temps de génération). Banc de test : `?test=1&autopilot=1&gen=hard&seed=1234`
(les missions produisent aussi leurs routes de pilote automatique, donc `tools/record.js` et `tools/genplay.js` les jouent).

### Boutique de cosmétiques (ROCKET SHOP)

Le menu principal ouvre une boutique : 20 apparences de roquette (plus la roquette d'origine, offerte). **Depuis la v031,
on ne gagne plus d'argent en jouant** : chaque cosmétique se débloque **en payant 2,29 €** (tous au même prix) **ou en
regardant une minute de publicité en entier** (4 annonces de 15 s ; fermer avant la fin ne débloque rien).

**Présentation (v033-ux).** Un grand aperçu 3D tournant du cosmétique choisi (nom, rareté, état : ÉQUIPÉE / POSSÉDÉE / À DÉBLOQUER), des onglets
TOUS / COMMUN / RARE / ULTRA, puis une grille de grandes cartes qui défile (coche jaune = équipée, verte = possédée, cadenas = à
débloquer + prix). Toucher une carte la **choisit** (aperçu immédiat, rien n'est acheté ni équipé) ; l'action se fait avec les boutons
de l'aperçu : ÉQUIPER, ou ACHETER (confirmation, puis lien Stripe) / PUB 1 MIN. Un déblocage lance une célébration (confettis, fanfare,
vibration forte) et équipe le cosmétique. Les catégories sont une liste (`TABS` dans `src/ui/shop.js`) : seules les apparences de roquette
existent aujourd'hui, d'autres (flammes, thèmes…) s'ajouteront en ajoutant une entrée et sa liste de fiches.

| Catégorie | Fiches |
|---|---|
| STOCK (offerte) | la roquette d'origine |
| COMMUN (7) | LE GAMIN, MONSIEUR BEDON, FUSEE V, MINUTEMEC, HACHETTE VOLANTE, CROQUETTE, BAGUETTE |
| RARE (8) | TRIDENTIN, POISSON VOLANT, GARDIEN DE PAIX, TITANITE, SATANETTE, GROSSE BERTHE, CROISSANT, CHATON |
| ULTRA RARE (5) | TSARINI, MAMAN DES BOMBES, BOMBE H, COLIS EXPRESS, CAILLOU |

**Paiement (Stripe).** Le bouton BUY ouvre le lien de paiement Stripe réglé dans `CC.CONFIG.shop.stripeLink`
(`src/config.js`, vide pour l'instant : le bouton affiche alors « PAYMENT LINK NOT SET YET »). Le jeu y ajoute
`client_reference_id` et `utm_content` = identifiant du cosmétique. Dans le Dashboard Stripe, régler le lien sur
**Après le paiement → Rediriger vers** : `https://hugobrochard23-sys.github.io/cold-impact.project/?paid=1&session_id={CHECKOUT_SESSION_ID}`.
Stripe recopie `utm_content` dans cette adresse : au retour, le jeu débloque et équipe le cosmétique, affiche un
remerciement et nettoie l'adresse. Limite : sans serveur, le paiement n'est pas vérifié auprès de Stripe (recopier
l'adresse de retour suffirait à débloquer) — à renforcer par une vérification de `session_id` côté serveur.
**Google Play** : dans une application Android publiée sur le Play Store, vendre un contenu numérique par un lien externe
n'est permis que dans les programmes de Google (facturation alternative / offres externes, avec frais) ; sinon il faut la
facturation Google Play.

Les noms s'inspirent librement de gros engins historiques sans en reprendre un seul ; cinq fiches sont des fantaisies
(baguette, croissant, chaton, colis, caillou). Un cosmétique change les couleurs, les proportions du corps et du nez,
le nombre d'ailerons, des pièces rapportées et la couleur de flamme.

> La police du HUD ne contient que l'ASCII (tout autre caractère s'affiche « ? ») : les fiches sont donc écrites sans
> accent, avec un tiret simple au lieu d'un tiret long, et les prix s'affichent en « EUR » au lieu de « € ».

## Architecture

```text
cold-impact/
├── index.html            point d'entrée (scripts classiques : marche en file://)
├── style.css             zone 16:9 centrée, HUD superposé
├── game.js               démarrage (et affichage des erreurs)
├── src/
│   ├── config.js         TOUS les paramètres réglables (GAME_CONFIG), annotés MESURÉ / ESTIMATION / CHOIX
│   ├── core/             util.js (maths, aléatoire à graine, formats 0:08,27 et 1.315), game.js (boucle, machine à états, banc de test)
│   ├── physics/          collision.js (boîtes orientées, terrain, tunnel ; balayage de sphère, distances, rayons)
│   ├── entities/         rocket.js (modèle de vol + capacités), targets.js (cibles, IA, destructibles, lasers),
│   │                     models.js, skins.js (fiches des 20 cosmétiques + STOCK)
│   ├── systems/          camera.js (1re personne → poursuite), style.js (combos et messages de style)
│   ├── rendering/        textures.js (pixel-art procédural), particles.js (voxels instanciés), postfx.js (vignette, aberration, tramage, bloom)
│   ├── world/            builder.js (géométrie fusionnée, murs percés, terrains, tunnel),
│   │                     levels/ (9 niveaux + generated.js : fiche d'une mission générée),
│   │                     endless.js (v033 : mode CLASSIQUE, couloir infini par tronçons),
│   │                     gen/ (v032 : générateur de missions — graine, profils, biomes, disposition, gabarits,
│   │                     mission, navigation, validation, construction ; voir analysis/GENERATOR.md)
│   ├── input/            input.js (souris/clavier/pointeur + pilote automatique de test), touch.js (gestes), haptics.js (vibrations)
│   ├── ui/               font.js (police pixel), hud.js (3 variantes), widgets.js (kit tactile), menu.js, endscreens.js, settings.js,
│   │                     shop.js + thumbs.js (boutique), tutorial.js, dombuttons.js, ads.js
│   └── audio/            audio.js (sons et musique synthétisés, Web Audio)
├── assets/lib/           three.min.js (r149)
├── tests/                PROTOCOLE.md, reference_measurements.json
├── tools/                serve.js, record.js (enregistrement automatique), compare.js (comparaison à la référence),
│                         calibrate_color.js (calibration hors ligne de la balance des ombres)
├── recordings/           (non versionné) vidéos et télémétrie produites par tools/record.js
└── analysis/             ANALYSE_REFERENCE.md, VERSIONS.md, iterations/vXXX/ (rapports, planches de comparaison)
```

Machine à états : `BOOT → MENU → AIM (1re personne) → FLIGHT → IMPACT | CRASHED → RESPAWN → … → RESULTS`,
plus PAUSE et les surcouches de l'interface (`ui.overlay` : settings, help, defi, missions, shop, ad…) avec une pile de navigation (`ui.open` / `ui.back`).

## Systèmes principaux et paramètres

Tout se règle dans `src/config.js`. Paramètres clés :

| Paramètre | Valeur | Origine |
|---|---|---|
| `rocket.ejectSpeed` | 31 m/s | MESURÉ (compteur SPEED après le tir) |
| `rocket.ignitionDelay` | 0,28 s | MESURÉ (le compteur SPEED passe 31→35 entre 0,23 et 0,33 s) |
| `rocket.thrust` | 50 m/s² (55 en v006) | MESURÉ (courbe SPEED du canyon : 31→55 m/s en 0,6 s) puis CHOIX v007 : la vitesse passait pour trop élevée ; le HUD affiche toujours « THRUST:45 » comme la vidéo |
| `rocket.dragK` | 0,0100 (0,0086 en v006) | MESURÉ (plafond ≈ 80 m/s en palier, 87 en piqué) puis CHOIX v007 : plafond ≈ 71 m/s |
| `rocket.maxTurnRate` / `steerGain` / `grip` | 3,5 rad/s / 9 / 11 (3 / 7,5 / 9 en v006) | ESTIMATION, relevées en v007 : roquette plus maniable (traînée induite 0,085 → 0,070, glissade tolérée jusqu'à 27°) |
| `economy.*` | solde de départ 5 €, 60 + 0,05/pt + 1 € record | CHOIX v007 (boutique) |
| `physics.gravity` | 5,715 m/s² | CHOIX d'Hugo (v016) : moyenne Terre (9,81) / Lune (1,62), roquette seulement ; les G affichés restent en G terrestres |
| `abilities.retro.decel` | 25 m/s² (+ traînée) ; le moteur principal s'éteint pendant le freinage | MESURÉ (75→27 m/s en 1,75 s), OBSERVÉ |
| `camera.distance` / `height` | 1,85 m / 0,52 m | MESURÉ indirectement (nez à 55 %, tuyère à 67,8 % de la hauteur) |
| `camera.crosshairY` | 0,402 | MESURÉ |
| `camera.fovV` | 70° | ESTIMATION |
| `hud.*` | positions et tailles | MESURÉES (boîtes englobantes du texte) |
| `style.coldImpactBase` / `bombSmashPerMs` | 100 / 7,5 | MESURÉ (x2,9 → +290 ; 67 m/s → +504) |

## Protocole de test et comparaison

Voir [tests/PROTOCOLE.md](tests/PROTOCOLE.md). En résumé :

```bash
npm install            # une fois : puppeteer-core, ffmpeg, pngjs (outils de test uniquement)
npm run record -- v002 # joue les 7 niveaux en pilote automatique, enregistre recordings/v002*.mp4
npm run compare -- v002
```

`compare` aligne chaque niveau sur l'instant du tir et produit, dans `analysis/iterations/v002/` :

- les planches original │ clone │ différence ;
- les écarts de l'interface (en pixels) ;
- le cadrage de la roquette ;
- la similarité des couleurs ;
- la courbe de vitesse ;
- les timings (allumage, éjection, impact).

## Différences connues

Voir le dernier rapport dans `analysis/iterations/` et [analysis/VERSIONS.md](analysis/VERSIONS.md). Limites de fond :

- **Géométrie des niveaux :** la vidéo ne montre que des fragments. Le reste est une ESTIMATION, donc les décors ne coïncident pas pixel à pixel.
- **Trajectoires du joueur :** inconnues. Le pilote automatique suit des routes estimées d'après la vidéo.
- **Audio :** la vidéo est muette, le son est entièrement une création.
- **Non montré dans la vidéo :** crash, menus, écran de résultats, collisions avec câbles, lasers et missiles. Choix de conception documentés.

## Prochaines améliorations

Voir la section « NEXT CORRECTIONS » du dernier rapport d'itération.
