# Historique des versions

Chaque version est enregistrée par `tools/record.js` (recordings/vXXX*.mp4, télémétrie .json) et comparée à la référence
par `tools/compare.js` (analysis/iterations/vXXX/). Les anciennes vidéos sont conservées.

## v001 — première version complète

**Changements :** construction complète du jeu à partir de l'analyse :
- les 7 niveaux ;
- le modèle de vol (poussée, traînée, gravité, adhérence, virages) ;
- les capacités : moteur on/off, rétro-fusées, grappin, glissade ;
- les cibles et l'IA (char à tourelle, soldat lance-missile, hélicoptères) ;
- les objets destructibles (vitres, briques, caisses) et les lasers ;
- le système de style et ses messages ;
- le HUD en 3 variantes, les menus ;
- le post-traitement (vignette, aberration chromatique, tramage, bloom) ;
- les sons et la musique synthétisés ;
- le pilote automatique, la télémétrie, l'enregistrement et la comparaison automatiques.

Corrections faites pendant le développement, avant l'enregistrement v001 (étalonnage sur les premières images) :

| Problème | Correction | Raison |
|---|---|---|
| Flamme géante masquant tout l'écran | cubes 0,08→0,25 m, durée de vie 0,09–0,15 s, dégradé jaune→rouge plus rapide | comparaison visuelle avec la séq. 7 |
| Roquette minuscule à l'écran | caméra 4,3 m → 1,85 m derrière, hauteur 1,35 → 0,52 m | calcul d'après la position MESURÉE du nez (55 %) et de la tuyère (67,8 %) |
| Roquette colorée par sa propre flamme | lumière du moteur reculée de 1,6 m | la roquette est gris clair sur la vidéo |
| Rétro-fusées inefficaces moteur allumé | les rétro-fusées coupent le moteur principal, décélération 25 m/s² | OBSERVÉ séq. 4 (flamme principale éteinte), MESURÉ 75→27 m/s |
| G affichés trop élevés (10,9 G) | échelle d'affichage 0,55 → 0,26 | plage observée 3,9–4,7 G |

**Résultat du test :** voir [iterations/v001/RAPPORT_v001.md](iterations/v001/RAPPORT_v001.md).

## v002 — convergence gameplay / caméra / timing

**Raison :** priorités du rapport v001 (gameplay, puis physique, caméra, timing, couleurs).

| Problème (v001) | Correction v002 | Priorité |
|---|---|---|
| Cibles atteintes 1,5 à 3,3 fois trop vite | Les 7 niveaux sont allongés et complétés (détail ci-dessous) | 1 – gameplay / 4 – timing |
| Le pilote automatique ne coupe jamais le moteur | Actions `engineOff` et `retro` placées aux endroits observés (bâtiment, grotte, forêt, trémie) | 1 / 2 |
| Guidage final visant une autre cible | Le guidage terminal ne vise que la cible de la route | 1 |
| Missile ennemi toujours au but | Visée imprécise (décalage 5–8 m), virage 0,8 rad/s | 1 (OBSERVÉ : il frôle sans toucher) |
| Allumage trop tardif (0,7 s) | `ignitionDelay` 0,28 s, d'après le compteur SPEED du canyon | 2 – physique |
| Caméra qui traîne : roquette 17 % trop haute et cachée | Décalage fixe par rapport à la roquette ; seul le décalage est lissé | 3 – caméra |
| Couleurs | Soleil neutre (ville, chantier), briques moins saturées et plus claires, canyon assombri, grotte éclaircie, forêt moins verte | 8 – rendu |
| Fumée du tir masquant l'écran, lanceur contre la caméra | Cubes 0,3–0,7 m placés plus loin, 130 étincelles ; lanceur avancé de 0,5 m | 6 / 8 |
| Chrono du HUD A trop large | Taille et largeur de cellule propres à cet élément | 7 – interface |

Détail des niveaux allongés :

| Niveau | Changements |
|---|---|
| Ville | rue de 200 m, puits de 210 m de profondeur |
| Briques | bâtiment de 240 m : slalom de portes à l'étage, trémie, rez-de-chaussée, ruelle |
| Canyon | tunnel de 190 m, vallée allongée de 130 m |
| Grotte | tunnel d'environ 820 m |
| Forêt | parcours d'environ 750 m, 4 maisons |
| Chantier | toit de 300 m, cage d'escalier de 140 m |
| Forêt de nuit | maison à 630 m |

Durée jusqu'à la cible (pilote automatique, mesurée avant enregistrement) :

| Niveau | v001 | v002 | Référence |
|---|---|---|---|
| Ville | 9,2 | 12,9 | 14,4 |
| Briques | 2,0 | 6,4 | 8,0 |
| Canyon | 8,4 | 11,0 | 13,0 |
| Grotte | 8,7 | 15,8 | 15,6 |
| Forêt | 4,8 | 16,5 | 15,95 |
| Chantier | 5,2 | 11,2 | 14,7 |
| Forêt de nuit | 5,2 | 10,8 | > 8,9 |

**Résultat du test :** voir [iterations/v002/RAPPORT_v002.md](iterations/v002/RAPPORT_v002.md).

**Résultat du test v002 :** 7/7 niveaux, 10/10 cibles, 0 crash. L'écart moyen d'impact passe de 7,2 s à 1,6 s. La tuyère est à 1–14 px de la position mesurée (60–108 px en v001).

## v003 — physique, couleurs, structure forêt/chantier, police

**Raison :** rapport v002 (montée en vitesse trop lente, couleurs, structure des niveaux 5 et 6).

| Problème (v002) | Correction v003 | Priorité |
|---|---|---|
| Montée 31→55 m/s en 0,9 s au lieu de 0,6 s | Poussée 55 m/s², traînée 0,0086 : 40 m/s² à 40 m/s, plafond ≈ 80 m/s. « THRUST:45 » reste affiché | 2 – physique |
| Forêt : trop de forêt sombre, pas de grand toit en planches | Piles de planches et murets autour de la maison 1 ; grange de 110 m au toit survolé au ras | 1 – gameplay / 5 – proportions |
| Chantier : impact 3,5 s trop tôt, cage étroite | Toit de 400 m (slalom prolongé), cage de 16 m aux volées de 5 m, planée moteur coupé sur le toit | 1 / 4 |
| Couleurs L2, L3, L4, L5, L6, L7 | Éclairages recalés sur les moyennes RVB mesurées ; pas de disque solaire au canyon ; paroi de la grotte plus claire | 8 – rendu |
| Flamme trop large et trop jaune | Cubes 0,12–0,17 m, vie 0,08–0,13 s, dégradé plus rouge | 8 |
| Chrono B trop large, virgule | Chrono B : px 0,00312 H, largeur de cellule 1,1 ; virgule descendante | 7 – interface |
| « X2,3+230 » | Espace avant les points | 7 |
| Vitesse 0 au premier instant de la télémétrie | Vitesse initialisée au tir | outil |
| Timings L1–L4 | Hélicoptère de la ville et char n°1 éloignés ; coupures moteur du canyon et de la grotte ajustées | 4 – timing |

Durées mesurées avant enregistrement (pilote automatique, s) :

| Niveau | v003 | Référence |
|---|---|---|
| Ville | 13,8 | 14,4 |
| Briques | 6,6 | 8,0 |
| Canyon | 12,4 | 13,0 |
| Grotte | 15,9 | 15,6 |
| Forêt | 16,1 | 16,0 |
| Chantier | 13,9 | 14,7 |
| Forêt de nuit | 11,8 | > 8,9 |

**Résultat du test :** voir [iterations/v003/RAPPORT_v003.md](iterations/v003/RAPPORT_v003.md).

**Résultat du test v003 :** 7/7 niveaux, 10/10 cibles, 0 crash. Écart moyen d'impact 0,65 s (v002 : 1,6 s). La similarité des couleurs progresse sur les 7 niveaux (grotte 88 %, forêt de nuit 82 %).

## v004 — interface HUD B, freinages, briques, couleurs

| Problème (v003) | Correction v004 | Priorité |
|---|---|---|
| Messages de style affichés au HUD B | Aucun message de style au HUD B (OBSERVÉ : absents des séquences 2, 5 et 7) | 7 – interface / comportement |
| Canyon : freinage jusqu'à 3 m/s (réf. ≈ 30) | Rétro-fusées limitées à 2 segments | 2 – physique |
| Grotte : freinage final trop tardif | Freinage avant la chambre, puis réaccélération | 2 / 4 |
| Briques deux fois trop petites | Répétition de texture 1,6 → 2,6 m | 5 – proportions |
| Sol bleu trop foncé | Cyan clair (#58b0d2) | 8 |
| Couleurs L2, L3, L5, L6, L7 | Éclairages recalés (saturation, teinte, luminosité) | 8 |
| Outil : zone de détection STYLE recoupant le chrono | Marge verticale 18 → 7 px | outil |

**Résultat du test :** voir [iterations/v004/RAPPORT_v004.md](iterations/v004/RAPPORT_v004.md).

**Résultat du test v004 :** 7/7 niveaux, 10/10 cibles, 0 crash. Écart de vitesse de la grotte 19,7 → 12,8 m/s. Plus de messages de style au HUD B. Les couleurs des niveaux sombres gardent des ombres trop profondes.

## v005 — balance des ombres, freinage du canyon

| Problème (v004) | Correction v005 | Priorité |
|---|---|---|
| Noirs trop profonds, manque de bleu (L2, L3, L5, L7) | Post-traitement : relèvement des ombres `lift` #0a0a10, saturation 0,86 (paramètres `postfx.lift` / `postfx.saturation`) | 8 – rendu |
| Canyon : freinage jusqu'à 3 m/s | Action du pilote automatique `retro` avec `hold` (durée limitée) : 1,1 s | 2 – physique / 4 – timing |

**Résultat du test :** voir [iterations/v005/RAPPORT_v005.md](iterations/v005/RAPPORT_v005.md).

**Résultat du test v005 :** 7/7 niveaux, 10/10 cibles, 0 crash. Les couleurs moyennes se rapprochent, mais les histogrammes régressent sur les niveaux 1, 2 et 4 (régression partielle, voir le rapport).

## v006 — balance des ombres calibrée par niveau

| Problème (v005) | Correction v006 | Priorité |
|---|---|---|
| Relèvement unique mal adapté à certains niveaux | `tools/calibrate_color.js` : recherche par grille hors ligne sur les images v004 (saturation × relèvement R/V/B). Valeurs appliquées par niveau dans `env.postfx` | 8 – rendu |

**Résultat du test :** voir [iterations/v006/RAPPORT_v006.md](iterations/v006/RAPPORT_v006.md).

**Résultat du test v006 :** 7/7 niveaux, 10/10 cibles, 0 crash, 0 erreur JavaScript. Similarité d'histogramme moyenne 71,4 % → 74,9 %, six niveaux sur sept en progrès (L6 : −0,2, à confirmer). L'écart de luminance diminue sur cinq niveaux, mais le contraste se dégrade sur L3, L4 et L5 : le relèvement ne touche que les noirs. Les écarts de timing, de cadrage et de vitesse sont inchangés depuis v005, v006 ne modifiant que le rendu.

## v007 — carte aléatoire, boutique de cosmétiques, vol assoupli

**Raison :** demandes hors vidéo, donc hors protocole de comparaison : une carte générée avec difficulté réglable,
une roquette un peu moins rapide et un peu plus maniable, une boutique pour changer l'apparence du missile.

| Changement | Détail |
|---|---|
| Carte aléatoire | `src/world/levels/generated.js`, 8e carte « AUTOMAP » : 3 difficultés (2/3/4 cibles, 520/720/940 m), tracé de rue sinueux, pâtés d'immeubles, portiques, passerelles basses, vitres, caisses, lasers (difficile), lampadaires, points d'accroche, ambiances jour / coucher de soleil / nuit étoilée. Graine tirée à chaque clic ; les routes du pilote automatique sont générées elles aussi, donc une carte aléatoire reste testable et enregistrable (`?test=1&gen=hard&seed=1234`). |
| Boutique | 20 cosmétiques + STOCK : données déclaratives `src/entities/skins.js`, modèle 3D paramétré `src/entities/models.js`, interface `src/ui/shop.js`. Prix 2,99 € / 4,99 € / 6,99 € (fictifs), solde gagné en jouant (5 € offerts, puis 60 centimes + 0,05 par point de STYLE + 1 € par record), achat et équipement immédiats, sauvegarde locale. |
| Vol assoupli | Poussée 55 → 50 m/s², traînée 0,0086 → 0,0100 (plafond ≈ 80 → 71 m/s), vitesse de rotation 3,0 → 3,5 rad/s, gain de visée 7,5 → 9, adhérence 9 → 11, traînée induite 0,085 → 0,070, glissade tolérée jusqu'à 27°. |

Mesures du banc de test (pilote automatique, 30 images/s), mêmes niveaux fixes que v006 pour mesurer le réglage du vol :

| Niveau | v006 : cibles / crashs / vitesse max | v007 : cibles / crashs / vitesse max |
|---|---|---|
| 1 CITY | 1 / 0 / 78,1 m/s | 1 / 1 / 69,7 m/s |
| 2 BRICKWORKS | 4 / 0 / 78,7 m/s | 4 / 0 / 69,9 m/s |
| 3 CANYON | 1 / 0 / 79,6 m/s | 1 / 0 / 70,6 m/s |
| 4 CAVE | 1 / 0 / 74,8 m/s | 1 / 0 / 67,4 m/s |
| 5 WOODS | 1 / 0 / 76,4 m/s | 1 / 0 / 68,6 m/s |
| 6 CONSTRUCTION | 1 / 0 / 72,8 m/s | 1 / 0 / 66,6 m/s |
| 7 NIGHT FOREST | 1 / 0 / 77,6 m/s | 1 / 0 / 69,4 m/s |

Cartes aléatoires, 5 graines × 3 difficultés (4242, 1, 777, 90210, 987654321) : **15/15 cartes terminées, 15/15 cibles
détruites, 0 crash, 0 erreur JavaScript**. Construction : 0,1 ms pour la fiche de niveau, 43 ms pour la géométrie et les
collisions (premier appel plus lent : compilation des shaders). Butin : 1,87 à 3,04 € par niveau réussi.

**Résultat du test v007 :** aucune vidéo enregistrée pour cette version (elle ne cherche pas à se rapprocher de la référence) :
les sept niveaux fixes restent terminés par le pilote automatique, à la même vitesse réduite de ~10 %. Une seule régression :
sur L1, le pilote automatique touche le bord du puits (0 → 1 crash) — sa route avait été réglée sur l'ancien taux de rotation,
la roquette plus agile dépasse maintenant le point de descente. Le reste est inchangé. Les cartes aléatoires passent les
15 essais du banc de test, et la boutique est vérifiée de bout en bout (achat, solde insuffisant, équipement, reconstruction
du modèle 3D et changement de couleur de flamme).

## v009 — pilotage clavier, moteur maintenu, essence

**Changements (CHOIX de conception, hors vidéo) :**
- pilotage W,A,S,D (Z,Q,S,D et flèches toujours acceptés, souris facultative) ;
- moteur à la demande : **G maintenue** = poussée, relâchée = moteur coupé (remplace Espace on/off) ;
- 3 s de poussée automatique et gratuite après l'allumage (`rocket.freeBoost`) ;
- essence par niveau (`fuel`), pleine à chaque tir, décroissante avec la difficulté (20 → 8 s ; AUTOMAP 12 / 13 / 15 s) ;
- jauge d'essence en bas à gauche, cadre proportionnel au réservoir ; le pilote automatique maintient G sauf sur les tronçons « moteur coupé ».

**Vérification :** le pilote automatique termine les 7 niveaux et les 3 difficultés AUTOMAP avec l'essence limitée
(réserve minimale : 2,7 s sur NIGHT FOREST). Aucun enregistrement vidéo ni comparaison `compare.js` refaits pour cette version.

## v010 — caméra de poursuite indépendante, boost 0,5 s

**Changements (CHOIX) :**
- en vol, la caméra suit la trajectoire de la roquette avec retard (`camera.followLag` = 2,2/s) au lieu de tourner avec la visée ;
  le réticule suit la direction visée projetée à l'écran ;
- poussée gratuite au lancement : 3 s → 0,5 s ; réservoirs relevés de 3 s pour garder les marges (23 → 11 s ; AUTOMAP 15 / 16 / 18 s) ;
- écran F1 : colonne des touches décalée (« RIGHT CLICK (HOLD) » chevauchait sa description).

**Vérification :** pilote automatique : 7 niveaux + 3 AUTOMAP terminés, réserve minimale 3,2 s (NIGHT FOREST).
Virage à droite maintenu 0,5 s : la tuyère se déplace de 50 % à 36 % de la largeur de l'écran puis revient vers le centre en ≈ 1,5 s.


## v011 — pilotage à 360°, moteur sur Espace

**Changements (CHOIX) :**
- visée = orientation complète (quaternion) au lieu de lacet + tangage bornés à ±88° : W,A,S,D et la souris tournent la roquette
  dans son propre repère → loopings, vol sur le dos ; l'horizon se remet à plat doucement quand on ne cabre / pique pas
  (`input.autoLevel`) ; au lanceur, visée inchangée (tangage borné, sans roulis) ;
- la caméra de poursuite prend pour « haut » celui de la visée (avec retard) : pas de retournement en haut d'un looping ;
- moteur : G → **Espace** maintenue.

**Vérification :** pilote automatique : 10 cartes terminées, chiffres identiques à v010. Espace + W maintenues 6 s sur AUTOMAP facile :
601° de rotation de la trajectoire, toujours en vol ; tuyère à l'écran sans saut (≤ 1,9 % de l'écran par image).
Limite : pendant un looping continu la queue de la roquette sort légèrement par le bas de l'écran (retard de la caméra, `camera.followLag`).

## v012 — caméra fixe en orientation, pilotage selon les axes de l'écran

**Changements (CHOIX, à la demande d'Hugo) :**
- en vol, la caméra ne tourne plus : orientation figée au tir, translation seule à distance constante de la roquette
  (qui peut pointer vers la caméra) ; rapprochement sans rotation si un mur s'interpose ; plus de roulis en virage ;
- W,A,S,D / souris : rotations autour des axes fixes de l'écran (W/S : axe horizontal, looping complet ; A/D : axe vertical) ;
- supprimés : `camera.followLag`, `rollFromYawRate`, `rollLag`, `input.autoLevel` (devenus sans objet) ;
- télémétrie : pose de la caméra (`cam`) à chaque image.

**Vérification :** rotation de la caméra mesurée = 0° pendant un looping (5 s), un demi-tour (D) et un vol mixte (W+A) ;
distance caméra–roquette 1,92–1,93 m (0,95 m quand un mur s'interpose) ; la roquette se dirige vers la caméra dans les trois cas.
Pilote automatique : 10 cartes terminées, chiffres identiques à v011.

## v013 — pivot sur le centre, vol à inertie, gravité Terre / Lune

**Changements (CHOIX d'Hugo) :**
- la tête de la roquette suit directement la visée (pivot sur le centre, sans vitesse de rotation bornée) ;
- inertie : plus d'adhérence ni de traînée induite ; la trajectoire ne change que par la poussée (axe du nez), la gravité et l'air ;
- gravité 9,81 → 5,715 m/s² (moyenne Terre 9,81 / Lune 1,62), roquette seulement ; G affichés toujours en G terrestres ;
- plus de rotation continue sur l'axe long ; orientation du modèle prise sur la visée (pas de basculement des ailerons) ;
- pilote automatique : oriente la poussée pour corriger l'écart vitesse voulue / vitesse réelle, compense la gravité,
  ralentit avant les virages ; ignore les consignes « moteur coupé » / « rétro » de la vidéo (`test.apLegacyActions`) ;
- réservoirs redimensionnés (besoin mesuré + réserve v012) : 29 → 16 s ; AUTOMAP 18 / 19 / 23 s ; `fuelBarMax` 30.

**Vérification :** pivot D 0,5 s moteur coupé : cap de la trajectoire 0,0° → 0,0° (seule la tête bouge) ; puis 1 s de poussée
nez à droite : cap 0° → 38,8° ; gravité mesurée 5,72 m/s² (traînée retirée) ; ailerons immobiles entre deux images à 0,5 s d'écart.
Pilote automatique : 10 cartes terminées sans crash, réserve minimale 4,2 s (NIGHT FOREST).

## v014 — repère de trajectoire réelle

**Changement (CHOIX) :** cercle vert à trois branches (`hud.velocityMarker`) projeté dans la direction de la vitesse, en plus du
réticule « x » (direction de la tête). Masqué si la roquette file vers la caméra.

**Vérification :** tête pivotée à droite sans poussée : cercle dans l'axe de la rue, x à droite ; après 0,7 s de poussée :
le cercle s'est déplacé vers le x. Aucune erreur.

## v015 — retour au vol d'avant (loopings), gravité et cercle vert conservés

**Changements (à la demande d'Hugo) :** abandon du vol à inertie de v013 : `rocket.js`, `input.js`, `camera.js`, niveaux et
réglages de vol restaurés depuis v012 (trajectoire qui suit le nez, rotation continue sur l'axe long, pilote automatique
et réservoirs de v012). Conservés : gravité 5,715 m/s² (v013), G affichés en G terrestres, cercle vert de trajectoire (v014).

**Vérification :** pilote automatique : 10 cartes terminées sans crash, réserves identiques à v012 (minimum 3,2 s, NIGHT FOREST) ;
Espace + W 5 s : 497° de rotation de la trajectoire, toujours en vol ; rotation de la caméra 0° ; cercle vert affiché.

## v016 — retour à la v011, gravité Terre / Lune conservée

**Changements (à la demande d'Hugo) :** tout le code du jeu (`src/`, `index.html`, `style.css`, `game.js`) et le README restaurés
à l'identique de v011 : caméra qui suit la roquette avec retard (`camera.followLag`) et se met sur le dos avec elle, pilotage
dans le repère de la roquette, loopings. Abandonnés : caméra fixe (v012), vol à inertie (v013), cercle vert (v014).
Seule différence avec v011 : gravité 5,715 m/s² (moyenne Terre / Lune), G affichés maintenus en G terrestres.

**Vérification :** pilote automatique : 10 cartes terminées sans crash (réserve minimale 3,2 s) ; Espace + W 6 s : 601° de rotation,
toujours en vol, tuyère sans saut (≤ 1,6 % de l'écran par image) — mêmes valeurs que les mesures de v011.

## v017 — commandes tactiles et jeu en vertical (iPhone)

**Changements (à la demande d'Hugo) :** `src/input/touch.js` : joystick (visée, remplace souris / W,A,S,D), PROPULSION maintenue,
FEU, MENU, R ; actifs seulement sur écran tactile (ou `#touch`). Couché : vue 16:9, commandes par-dessus ; jauge d'essence
recentrée, SPEED sous TIME. Debout : vue pleine largeur au format 3:4 (`render.portraitHeight`), commandes dessous ;
textes du HUD rapportés à la largeur, textes de droite alignés au bord, annonces recentrées ; menus dessinés dans une bande
centrée (colonnes, titres et boutique redisposés : 2 colonnes). `CC.game` exposé pour le diagnostic.

**Vérification :** téléphone simulé (375×812 et 667×375, tactile) : FEU → vol, PROPULSION → moteur et essence qui baisse,
joystick → visée qui tourne, MENU → pause, FEU → reprise, R → recommence ; menu, difficulté, boutique, pause, résultats lisibles
sans débordement en vertical. Ordinateur : aucune commande tactile, pilote automatique 10 cartes sans crash.

## v018 — joystick moins sensible

**Changement (à la demande d'Hugo) :** `input.touch.rate` 2,4 → 1,5 rad/s à fond, `curve` 1,5 → 2 (plus fin près du centre).
Vitesse de rotation de la visée : 138 → 86 °/s à fond, 39 → 16 °/s à mi-course.

**Vérification :** téléphone simulé, joystick 0,5 s : 43° à fond (69° en v017), 8° à mi-course ; aucune erreur.

## v019 — caméra qui suit la tête, horizon à plat, roquette plus maniable

**Changements (à la demande d'Hugo) :**
- caméra : s'oriente vers la tête de la roquette (et non plus la trajectoire) par un double lissage (`noseLag` 3, `followLag` 2,0) ;
  plus d'inclinaison de l'horizon en virage (`rollFromYawRate` 0) ; le « haut » suit toujours la visée (loopings) ;
- maniabilité : `steerGain` 9 → 22, `maxTurnRate` 3,5 → 5, `grip` 11 → 24, `gripEngineOff` 4,6 → 9 ;
- pilote automatique : compensation du retard divisée par (grip / 11)² ; télémétrie : pose de la caméra (`cam`).

**Vérification (D maintenue 0,5 s, moteur allumé, AUTOMAP facile) :** retard de la trajectoire sur la visée 19,2° → 8,2° ;
horizon penché max 7,9° → 0° ; à-coup max de la caméra 174 → 92 °/s², rotation max 64 → 42 °/s.
Looping Espace + W : 508° en 5 s, tuyère sans saut (≤ 1,5 % / image). Pilote automatique : 10 cartes terminées.

## v020 — missiles anti-aériens des tanks et hélicoptères

**Changements (à la demande d'Hugo) :** tanks et hélicoptères (cibles) tirent des missiles guidés sur la roquette ; menace
0 → 1 selon le niveau (AUTOMAP : `aaByDifficulty`) qui règle cadence, précision (courbe `missCurve`), anticipation, vitesse
et virage (`CC.CONFIG.aa`) ; tir seulement en vue directe, entre `minRange` (45 m) et la portée ; au plus 3 en vol ;
détonation de proximité 1,6 m. Correction : la détonation des missiles ennemis (soldats compris) testait la distance
en fin d'image seulement et ratait les croisements rapides ; elle utilise maintenant la plus courte distance pendant l'image.
HUD : « MISSILE! » clignotant. Pilote automatique : esquive (virage franc) si un missile est sur trajectoire de collision.

**Vérification :** duels contrôlés (6 tirs par ligne, face et côté) : touché en volant droit 0/6 jusqu'à la menace 0,33,
3/6 de 0,5 à 0,83, 6/6 à 1 ; en virant tant que l'alerte clignote : 0/6 à la menace 1. Sans esquive, CONSTRUCTION :
8 tirs, 8 impacts. Avec l'esquive : 10 cartes + 2 graines AUTOMAP terminées, aucun impact, essence minimale 3,3 s.
Tireurs présents dans BRICKWORKS, CANYON, WOODS, CONSTRUCTION et AUTOMAP (CITY : menace 0, CAVE et NIGHT FOREST : aucun tireur).

## v021 — tanks de garde dans NIGHT FOREST, tirs seulement de face

**Changements (à la demande d'Hugo) :** `b.guard()` : ennemi qui tire et se détruit mais ne compte pas dans l'objectif ;
NIGHT FOREST : 2 tanks de garde en clairière (4 au bord du couloir : un tir toutes les 0,4 s, 27 impacts sur 27 tirs même
en esquivant). Les tireurs ne tirent plus que s'ils sont devant la roquette (`aa.frontCos`, 75°) : un tir dans le dos était
invisible (caméra tournée vers l'avant). Pilote automatique : ne coupe plus le moteur sous 40 m/s (planer à 18 m/s = cible
immobile). README : section « Travailler à plusieurs ».

**Vérification :** NIGHT FOREST sans esquive : 23 tirs, 23 impacts ; avec esquive : fini, 0 impact, essence minimale 2,7 s.
Pilote automatique : 10 cartes terminées sans impact.

## v022 — mobile : plein écran, sans bouton, glisser / toucher / double toucher

**Changements (à la demande d'Hugo) :** `src/input/touch.js` réécrit : glisser = diriger (2,2 rad pour la largeur de l'écran),
tap = tir / réapparition, double tap en vol = moteur allumé / éteint (bascule), gros bouton pause seul bouton. Plein écran
couché comme debout ; debout, angle de vue vertical élargi pour garder ≥ 57° à l'horizontale (`fovMinH`, plafond 100°).
Affichage tactile minimal (sans chrono, STYLE, THRUST, TIME, SPEED, annonces ; jauge d'essence sans texte sauf NO FUEL ;
aide « TAP TO FIRE / DOUBLE TAP: ENGINE » au lanceur, « TAP TO RESPAWN » après un crash). Menu pause (tous supports) :
SOUND et MUSIC ON/OFF. Fluidité : 1 pixel par point, ombres 1024. Police Google (Silkscreen) retirée (plus utilisée).

**Vérification (téléphone simulé 375×812 et 740×360) :** vue = écran entier ; glisser 100 px → visée 33,6° à droite ;
tap → tir ; tap simple en vol → rien ; double tap → moteur allumé, essence 22,97 → 21,97 en 1 s ; double tap → éteint ;
taps espacés de 500 ms → rien ; pause → menu, SOUND / MUSIC → 0 puis rétablis, RESUME ; crash → « TAP TO RESPAWN » → tap → lanceur.
Rendu (Mac) 2,9 → 2,4 ms / image, surface 563×1218 → 375×812. Ordinateur inchangé ; pilote automatique : 10 cartes, 0 impact.

## v023 — progression, flèches vertes, repères rouges permanents, nouveaux sons, SOUND / MUSIC réparés

**Changements (à la demande d'Hugo) :**
- progression : un niveau s'ouvre quand le précédent est terminé (`game.isUnlocked`) ; menu : niveaux verrouillés grisés
  « LOCKED » ; menu pause : NEXT LEVEL si le niveau suivant est ouvert ; AUTOMAP toujours libre ;
- niveaux 1 à 3 : flèches vertes 3D le long du parcours (`b.guideArrows`, une tous les 45 m), sans points rouges ;
  à partir du niveau 4 et sur AUTOMAP : repère rouge permanent sur la cible, même à l'écran ;
- sons : réacteur = souffle grave + sifflement + crépitement (plus de dent de scie) ; allumage « whoosh » ; tir pneumatique ;
  explosion : claquement, déflagration saturée, coup de grave, débris, queue qui roule ; limiteur en sortie ;
- correction : SOUND / MUSIC sur OFF n'étaient pas réappliqués au démarrage (le son revenait après un rechargement) et
  couper le son écrasait le volume par défaut.

**Vérification :** rendu audio hors ligne : crête max 0,56 (moteur + explosion, plus de saturation ; 1,18 avant le limiteur) ;
SOUND / MUSIC OFF → gains 0 après rechargement, rétablis à 0,9 / 0,28. CITY : 17 flèches. Pilote automatique : 10 cartes, 0 crash.

## v023 (suite) — 2 niveaux, cible qui s'enfuit, salves, missiles qui accélèrent, essence réduite

**Changements (à la demande d'Hugo) :**
- TRENCH RUN (tranchée façon Star Wars, 20 m × 32 m × 1,1 km, 19 obstacles : poutres, piliers, lasers ; 8 tourelles sur
  piédestal + tour au bout) et NIGHT CANYON (canyon de nuit sinueux, arches, crêtes, piliers ; convoi de 5 tanks) ;
  cible : hélicoptère qui s'enfuit (`opts.path`, 55 et 48 m/s), ne tire pas ; menu resserré (10 lignes) ;
- salves (`aa.salvoCount` 2, `salvoGap` 0,45 s, repos × 1,5, tir groupé si un autre tireur est à < 1,2 s de sa recharge) ;
- missiles anti-aériens : départ à 35 % de la vitesse, pleine vitesse en 1,2 s (un tir de face à 100 m était inévitable) ;
- menace répartie sur 9 niveaux (NIGHT FOREST 0,75 au lieu de 1) ;
- essence : 20 / 17 / 15 / 14 / 12 / 10 / 10 / 22 / 18 s ; AUTOMAP 13 / 14 / 17 s ;
- pilote automatique : esquive vers la direction la plus dégagée (gauche, droite, haut, bas) ; poursuite des cibles mobiles.

**Vérification (pilote automatique) :** 12 cartes terminées. TRENCH RUN : hélicoptère rattrapé au bout (z −1091), essence
3,4 s, 4 tentatives sans esquive. NIGHT CANYON : 10 tentatives en esquivant, impossible sans esquiver (28 impacts sur 28).
Réserves les plus serrées : NIGHT FOREST 1,9 s, AUTOMAP moyen 2,3 s. Progression : niveaux 1-2 terminés → 3 ouvert, 4+ verrouillés ;
NEXT LEVEL en pause au niveau 2, absent au niveau 3.

## v024 — mobile : appui long = boost, vibrations, virage sans fin sur les bords, tir animé

**Changements (à la demande d'Hugo) :** double toucher supprimé ; appui long ≥ 0,5 s (doigt immobile) = boost tant que le
doigt reste posé, avec vibration continue ; bande latérale (22 %) = virage continu jusqu'à 1,8 rad/s ; au lanceur, la vue ne
bouge plus (mobile) ; plus de curseur (mobile) ; vibration à chaque bouton et au tir ; réglage VIBRATION dans la pause
(`settings.vibration`, `src/input/haptics.js`) ; tir : renflement qui file dans le tube + recul (tous supports) ;
message central masqué pendant la pause.

**Vérification (téléphone simulé, vibrations interceptées) :** glissé au lanceur → 0° ; tap → tir + 40 ms ; doigt immobile
0,6 s → boost + motif 28/32 ms ; glissé pendant le boost → boost maintenu, visée 10° ; doigt levé → boost coupé + vibrate(0) ;
glissé immédiat → pas de boost ; bord droit 1 s → 56° à droite, centre → 0° ; VIBRATION : MEDIUM → HIGH → OFF → LOW → MEDIUM.
Ordinateur : visée au lanceur intacte, animation du tir ; pilote automatique : 12 cartes terminées.
Limite connue : iPhone — Safari n'a pas l'API Vibration ; repli par interrupteur invisible bloqué par Apple depuis iOS 26.5.

## v025 — le jeu s'appelle désormais COLD IMPACT

**Changements (à la demande d'Hugo) :** nom du jeu, du dépôt GitHub (`hugobrochard23-sys/cold-impact.project`) et des
dossiers ; « CLOSE CALL » remplacé partout (titre, menu, panneau publicitaire du niveau 1 — lettres un peu plus petites
pour que IMPACT tienne —, bonus de frôlement « COLD IMPACT! », réglages `style.coldImpact*`, anciens rapports de mesure).
Sauvegarde : nouvelle clé `coldimpact.save` ; l'ancienne clé est relue une fois si la nouvelle n'existe pas encore, pour
que personne ne perde sa progression (seule mention restante de l'ancien nom dans le code).

**Vérification :** titre de la page et du menu (ordinateur et téléphone 375×812) ; ancienne sauvegarde de test
(4 242 centimes, records niveaux 1-2, musique coupée) reprise à l'identique ; pilote automatique niveau 1 terminé
(14,9 s, STYLE 846) avec le bonus « COLD IMPACT! » ; panneau publicitaire rendu sans débordement.

## v026 — zoom au boost, traînées, filets d'air, alertes, relance du boost

**Changements (à la demande d'Hugo) :**
- caméra : angle de vue × 0,88 pendant le boost (zoom avant en ≈ 0,5 s), retour progressif ensuite (`camera.boostZoom`) ;
- traînées (`src/rendering/trails.js`, réglages `trails`) : un ruban fin par aileron, parti du bout de l'aileron, blanc,
  jaune puis rouge pendant le boost ; filets d'air qui naissent au nez et glissent vers l'arrière pendant le boost.
  Épaisseur constante à l'écran (≈ 3 px, 5 px en boost), effacés à moins de 0,7-1,8 m de la caméra ;
- mobile : mini vibration à chaque toucher en partie ; appui long pour le boost 0,5 → 0,4 s ; boost relâché → fenêtre
  d'1 s (fine barre jaune sous l'essence) où reposer le doigt relance le boost sans attendre ;
- alertes : « MISSILE! » plus grand, avec bip répété et vibration ; « LOW FUEL » clignotant sous 25 % (deux notes, vibration).

**Vérification :** banc de test : angle de vue 70° → 61,6° en boost, retour à 69-70° sans boost ; 4 traînées de 15 points ;
rendu vu de côté (4 traînées jaunes depuis les ailerons) et vue du joueur (traînées fines, vue dégagée).
Téléphone simulé (375×812, vibrations interceptées) : toucher → vibrate(8) ; boost absent à 0,3 s, présent à 0,46 s ;
relâché → fenêtre de 998 ms ; toucher à 0,3 s → boost immédiat ; toucher après 1,1 s → pas de boost (ni 0,2 s plus tard) ;
essence à 20 % → « LOW FUEL », deux notes et vibration une seule fois ; missile à 60 m → « MISSILE! », vibration, bip toutes
les 0,45 s. Pilote automatique : 9 niveaux + AUTOMAP difficile terminés, niveau 1 identique à v025 (14,9 s, STYLE 846).

## v027 — niveau 2 sans flèches vertes, plus de point rouge sur le nez

**Changements (à la demande d'Hugo) :**
- BRICKWORKS (niveau 2) : flèches vertes retirées (`guide: false` dans la fiche du niveau) ; à la place, les petits repères
  rouges des autres niveaux : carré rouge sur chaque tank visible, point rouge au bord de l'écran pour ceux hors champ ;
- fusée : le petit cube rouge au bout des nez pointus (fusée de base) est retiré ; les nez arrondis de la boutique gardent
  leur embout.

**Vérification :** flèches : CITY 17, BRICKWORKS 0, CANYON 16 ; niveau 2 : 4 repères rouges (ordinateur et téléphone
375×812), pilote automatique : 4/4 tanks, 22,6 s ; fusée de base vue de côté : nez gris, 0 pièce rouge ; 21 cosmétiques
construits sans erreur.

## v028 — refonte visuelle (design, effets, sons, animations, cohérence du monde)

**Changements (à la demande d'Hugo, validés sur la copie de test avant intégration) :** voir
[DESIGN_REFONTE.md](DESIGN_REFONTE.md) — particules translucides / additives, propulsion en couches, explosions en 9 étapes,
épaves, chars et hélicoptères détaillés et animés, décor (façades, vitrines, toits, conifères, rochers, nuages), matériaux,
réacteur en 5 couches sonores, repères des missiles ennemis. Gameplay inchangé : trajectoires de tir ennemi d'origine,
collisions des niveaux inchangées (les équipements de toit évitent tout toit survolé par un parcours).

**Vérification :** pilote automatique : 9 niveaux + AUTOMAP facile / moyen / difficile terminés, aucune erreur ; taux de
touche des tirs ennemis sur 32 cartes AUTOMAP 26 % contre 23 % en v027 (dans le bruit : 16–25 % selon les séries) ;
appels de dessin égaux ou inférieurs à v027 (TRENCH RUN 105 contre 140), temps par image égal ou inférieur.

## v029 — relance du boost en 0,6 s

**Changement (à la demande d'Hugo) :** fenêtre de relance du boost au doigt 1 s → 0,6 s (`input.touch.reboostMs`).
Vibrations dans l'application Android : le jeu appelle bien `navigator.vibrate` (elles marchent dans Chrome via GitHub Pages) ;
dans une application qui affiche le jeu par une WebView, Android ne vibre que si l'application déclare la permission
`android.permission.VIBRATE` dans son AndroidManifest.xml — correction à faire côté application.

## v030 — optimisation mobile, interface tactile, publicités d'exemple

**Changements (à la demande d'Hugo) :** rétro-analyse complète dans [MOBILE_AUDIT.md](MOBILE_AUDIT.md) —
objets de calcul réutilisés (physique, caméra, commandes, traînées, missiles : 70–214 → 6–13 objets créés par image),
qualité graphique AUTO / HIGH / MEDIUM / LOW (`src/core/quality.js`), 60 images/s au plus sur écran tactile et 20 en menu,
pause + son suspendu en arrière-plan, menus portrait plein écran à boutons encadrés ≥ 44 points, libellés sans touches
clavier sur mobile, tutoriel des 3 premiers vols, publicités d'exemple (`src/ui/ads.js` : bannière du menu, interstitielle
tous les 3 niveaux au plus, récompensée « CASH X2 »). Outil de mesure : `tools/alloc.html`.

**Vérification :** 9 niveaux au pilote automatique : temps et STYLE identiques à v029 au centième ; AUTOMAP 3 difficultés
terminées ; aucune erreur. Téléphone simulé : qualité MEDIUM choisie, menus / pause / résultats sans chevauchement,
publicités (délais, récompense unique, fermeture) ; ordinateur : HIGH, rendu d'origine.

## v031 — boutique : 2,29 € ou une minute de publicité par cosmétique

**Changements (à la demande d'Hugo) :** plus d'argent gagné en jouant (écran de résultats sans gain ni « CASH X2 », menu sans
solde) ; tous les cosmétiques au même prix (`shop.priceCents` = 229) ; fiche du cosmétique choisi avec deux gros boutons :
BUY 2,29 EUR (redirection vers le lien Stripe `shop.stripeLink`, à renseigner) et WATCH 1 MIN AD (4 annonces d'exemple de
15 s, sans pouvoir passer ; retour dans la boutique ensuite) ; retour de paiement `?paid=1&utm_content=<cosmétique>` →
cosmétique débloqué, équipé, remerciement, adresse nettoyée ; sélection au clic (plus au survol) ; bouton BACK tactile.
Permission VIBRATE Android : le projet de l'application n'est ni dans le dépôt ni sur le Mac — à ajouter dans son
AndroidManifest.xml.

**Vérification (téléphone simulé et ordinateur) :** achat sans lien → message ; lien renseigné → redirection vers
`<lien>?client_reference_id=bedon&utm_content=bedon&utm_source=coldimpact` ; minute de publicité regardée → cosmétique
débloqué et équipé, retour dans la boutique ; `?paid=1&utm_content=croissant` → CROISSANT débloqué, équipé, enregistré,
adresse nettoyée ; aucune erreur. Pilote automatique : voir ci-dessous (gameplay inchangé).

## v032 — générateur de missions procédural (quatre difficultés, graines, carte du jour)

**Changements (à la demande d'Hugo) :** la carte aléatoire AUTOMAP est remplacée par un **générateur de missions** complet
(`src/world/gen/`, architecture et règles : [GENERATOR.md](GENERATOR.md)) :
- graine → flux aléatoires déterministes par couche → profil de difficulté (11 paramètres variés par carte) → famille de
  carte (8 : urbaine, industrielle, militaire, rurale, montagneuse, désertique, portuaire, mixte) et ambiance (9) →
  disposition (grille, organique, vallée) → lanceur → cibles et mises en situation (à découvert, murs, hangar, filet, cour,
  ruelle, toit, en vol) → gabarits de zones (grammaire : îlots, tours, chantiers, entrepôts, usines, parcs à cuves et à
  conteneurs, compounds militaires, fermes, hameaux, forêts, avant-postes, puits de pétrole, quais à grues…) → obstacles de
  parcours → décor → navigation 3D (couloirs A*, alignement en goutte d'eau, arrondi des virages) → défenses placées sur
  les couloirs réels (lignes de vue) → hélicoptères en patrouille → validation (géométrie, jeu, cohérence, lisibilité ;
  réparation ou nouvel essai déterministe, carte « desserrée » après 5 refus) → score de carte (plage par difficulté) ;
- construction avec le système visuel existant (façades, toits équipés, vitrines, conifères, rochers, relief, nuages,
  cibles et ennemis détaillés) + 4 nouveaux modèles (station radar à antenne tournante, dépôt de carburant, poste de
  commandement, lance-missiles sol-air dont la rampe suit la roquette) et 4 textures (sable, eau, tôle, grillage) ;
- hélicoptères : patrouilles (orbite, circuit, points de passage) lissées, cap dans le sens du vol, face à la roquette
  quand elle approche ; tanks et lance-missiles : même IA de tourelle qu'avant ;
- menu **GÉNÉRATEUR DE MISSIONS** (FACILE / MOYEN / DIFFICILE / IMPOSSIBLE, mission du jour, graine au choix — nombre ou
  mot —, dernières missions), écran **GÉNÉRATION...**, brief de mission, graine en pause et aux résultats, **NOUVELLE
  MISSION**, lien partageable `?mission=<graine>&diff=<difficulté>` ; sauvegarde légère (30 dernières missions, record par
  graine, record de la carte du jour) ; accents É/È dans la police ;
- vue de débogage (touche **G**, `?gendebug=1`) ; outils `tools/gentest.js` (Node), `tools/genviewer.html`,
  `tools/genplay.js` ; plafond de missiles ennemis simultanés par difficulté (`aaMaxAlive`), cibles désarmées en
  FACILE / MOYEN (elles visent sans tirer), entrée finale sans défense en FACILE / MOYEN.

**Défauts trouvés en jouant et corrigés :** virages mesurés sur des zigzags de grille (fenêtre ±20 m) ; approches qui
arrivaient de travers sur la porte (allée d'approche réservée + manœuvre d'alignement au-dessus des toits) ; crashs du
pilote automatique sur le bord des filets de camouflage (descente plus douce vers les entrées basses, ralliement direct
seulement si la cible est visible) ; bases militaires vides (enceintes grillagées, miradors, dépôts) ; en MOYEN, char-cible
tirant de face pendant la plongée finale (0/3 au pilote automatique) ; arcs de virage qui traversaient le relief en
montagne (le relief est désormais testé par les vérifications exactes) ; générations de plusieurs secondes en montagne
(recherche bornée, champ de danger limité aux couloirs).

**Vérification :**
- `node tools/gentest.js 100 all --determinism` (400 cartes) : **0 erreur, 0 carte injouable, 400 dans la plage de
  difficulté**, 1,03 à 1,2 essai en moyenne, même graine = même carte (vérifié), aucune paire de cartes quasi identique
  (distance de signature, relief compris). Génération (Node, Mac) : moyenne 70 ms FACILE · 136 MOYEN · 293 DIFFICILE ·
  440 IMPOSSIBLE, pire cas 1,8 s. Scores : FACILE 13–25 · MOYEN 25–49 · DIFFICILE 46–70 · IMPOSSIBLE 67–85.
  Moyennes FACILE → IMPOSSIBLE : bâtiments 21 → 87, obstacles 4,5 → 69, tanks 1 → 9, lance-missiles 0 → 3,
  hélicoptères 0 → 2,5, approche 446 → 802 m, exposition aux tirs 1,5 → 26 tireurs·s.
- Pilote automatique sur 40 missions complètes (`tools/genplay.js`, graines 61000…) : **FACILE 10/10 et MOYEN 10/10 sans
  aucun crash** (1 tir par cible, 16 s et 29 s) ; DIFFICILE 10/10 (1,6 tir par cible, 34 missiles ennemis par mission) ;
  IMPOSSIBLE 8/10 (2,2 tirs par cible, 76 missiles ennemis) — les 2 missions ratées se terminent 4/4 sans aucun crash
  quand les ennemis ne tirent pas : difficulté de combat, pas de carte cassée. Génération + construction en jeu : 0,1 à
  0,3 s (première mission : jusqu'à 0,9 s, textures et shaders à créer).
- Les 9 niveaux fixes terminés au pilote automatique, sans crash, temps et STYLE inchangés (CITY 14,90 s, 847).
- Menus vérifiés sur ordinateur et téléphone simulé (375 × 812) : générateur, génération, brief, pause (graine,
  NOUVELLE MISSION), résultats (graine, record de la graine, NOUVELLE MISSION, MISSIONS) ; rendu des 8 familles de cartes.

## v033 — menu à trois boutons, mode CLASSIQUE infini, mode DÉFI à étoiles

**Changements (à la demande d'Hugo, d'après le message vocal de son collègue du 27/09/2026) :**
- **Menu d'accueil** à trois gros boutons, façon *Block Blast* : CLASSIQUE (record affiché), DÉFI (étoiles gagnées),
  BOUTIQUE ; les 9 niveaux passent dans DÉFI → NIVEAUX, le générateur dans DÉFI → MISSIONS LIBRES.
- **CLASSIQUE** (`src/world/endless.js`) : couloir généré à l'infini par tronçons de 200 m (un LevelBuilder par
  tronçon ; collisions retirées du monde quand il est détruit : `World.removeBoxes`), parois en polyligne sans marche,
  9 types d'obstacles, 4 paliers de difficulté tous les 800 m, 6 zones de décor avec transition d'ambiance, essence
  rechargée par le STYLE et par les cibles traversées, plafond à 48 m, une seule vie, score = mètres, record sauvegardé
  (`save.endless`), cause du crash à l'écran de fin. Chars ennemis créés un par image (modèle coûteux).
- **DÉFI** : 20 cartes par difficulté (`CC.Gen.challengeSeed`), 1 à 3 étoiles au temps (`CC.CONFIG.challenge`), carte
  suivante ouverte après la précédente, trophées BRONZE / ARGENT / OR à 10 / 20 / 40 étoiles (`save.challenge`), écran de
  fin avec étoiles, temps visé pour l'étoile suivante, CARTE SUIVANTE.
- HUD du CLASSIQUE : distance, record, palier, essence gagnée, alarme d'altitude. Outil `tools/endlessplay.js`.

**Vérification :**
- Pilote automatique sur 10 couloirs (graines 5000 + 7919·i) : 1 750 à 3 800 m (palier IMPOSSIBLE atteint 7 fois sur
  10), fins de partie surtout par missile au palier IMPOSSIBLE ; les défauts trouvés en jouant (slaloms trop serrés,
  points de passage trop tardifs, cibles et obstacles trop proches, sortie de carte à 4 000 m) sont corrigés.
- Construction d'un tronçon : 3 à 5 ms au pire sur le Mac une fois les chars étalés (9 ms avant), 5 tronçons en mémoire.
- DÉFI : 16 cartes au pilote automatique (4 par difficulté) : 14 terminées, 0,75 à 0,82 × le temps de référence sur un
  vol propre ; étoiles, carte suivante et trophées vérifiés.
- Les 9 niveaux fixes terminés au pilote automatique, temps et STYLE inchangés (CITY 14,90 s, 847).
- Menus vérifiés sur ordinateur et téléphone simulé (375 × 812) : accueil, DÉFI (onglets, grille, NIVEAUX), partie
  CLASSIQUE, résultats CLASSIQUE et DÉFI ; aucune erreur dans la console.

## v033-ux — refonte mobile-first (interface, tutoriel, boutique, vibrations), gameplay inchangé

**Changements (à la demande d'Hugo ; audit et choix complets : [MOBILE_UX.md](MOBILE_UX.md)) :**
- **Kit tactile** (`src/ui/widgets.js`) : pointeur unique souris + doigt, boutons à états (normal, survol, enfoncé, désactivé,
  verrouillé) qui valident au relâchement, zones ≥ 48 points, défilement avec inertie, curseurs, interrupteurs, onglets, toasts,
  dialogue de confirmation ; `ui.feedback()` = son + vibration assortis. L'interface (`menu.js`, `endscreens.js`, `settings.js`,
  `shop.js`) est réécrite dessus ; plus aucune action essentielle ne dépend du clavier (Échap / Tab / F1 restent des raccourcis).
- **Tutoriel interactif** (`tutorial.js`) : premier vol guidé sur CITY (tirer, diriger, boost, essence, virage au bord, cible),
  ralenti tant que le geste n'est pas fait, PASSER, rejouable depuis RÉGLAGES, enregistré ; remplace les trois bulles de la v030.
- **Boutique** : aperçu 3D tournant (`thumbs.js`), onglets de rareté, grille défilante de grandes cartes, ÉQUIPER / ACHETER /
  PUB 1 MIN, confirmation avant paiement, célébration au déblocage.
- **Réglages** accessibles au doigt (engrenage du menu, bouton de la pause) : sons, vibrations (OFF / LÉGÈRE / MOYENNE / FORTE),
  sensibilité, inversion, graphismes, aide « COMMENT JOUER ». Pause et résultats refaits (confirmation avant de quitter, compteurs
  et étoiles animés). Interface entièrement en français.
- **Haptics** centralisés (`haptics.js`) : `light` / `medium` / `heavy` / `success` / `error` / `unlock` ; vibration à l'explosion
  et à la destruction d'une cible. **Sons d'interface** : tap, retour, onglet, équipement, déblocage, refus, carillon.
- **Zones système** : marges de l'encoche et de la barre d'accueil (`#cc-safe`, `Game.readSafe`) appliquées à l'interface, à la
  jauge d'essence et aux boutons HTML ; boutons PAUSE / PASSER en vrais éléments HTML (`dombuttons.js`).

**Défauts corrigés :** réglages et aide inaccessibles sans clavier ; clic dans le vide qui relançait la partie ; boutons sans état
« enfoncé » ; boutique illisible au doigt et équipement involontaire ; appui perdu pendant l'animation d'ouverture d'un écran.

**Vérification :** parcours complets au navigateur (voir MOBILE_UX.md §3) ; pilote automatique : les 9 niveaux et deux couloirs
CLASSIQUE donnent exactement les mêmes résultats que la v033 d'origine (CITY 14,90 s / 847 … NIGHT CANYON 12,97 s / 2213 ;
couloirs 5000 → 3736 m MUR, 12919 → 2228 m MUR). **Non vérifié** : vibrations réelles, son, zones système réelles, paiement Stripe.

### v033-ux2 — boutique habillée (même direction artistique que le HUD)

Aucun changement de fonctionnement : seule la présentation de `src/ui/shop.js` (et un reflet sur les boutons pleins, `widgets.js`).
- **Fond** : dégradé nuit, trame de points, voile sombre sur les bords ; **barre de collection** (une case par cosmétique, à la
  couleur de sa rareté), compteur en pastille, titre en relief.
- **Aperçu** : scène éclairée (faisceau, sol, ombre, étincelles pour rare / ultra rare), crochets de visée dans les angles comme
  les repères de cibles, pastilles de rareté (+ étoiles) et d'état, nom avec ombre portée, description, étincelles à l'équipement.
- **Cartes** : roquette sur son socle avec halo de rareté, bandeau nom / prix, étoiles de rareté, pastille coche / cadenas,
  carte choisie légèrement soulevée avec crochets, ombre portée ; **onglets** avec compteur possédés / total.
- **Célébration** : rayons tournants à la couleur de rareté, étoiles de rareté, ombres de texte.

