/* COLD IMPACT — paramètres centralisés.
 * Chaque valeur porte son origine : MESURÉ (vidéo), ESTIMATION (déduit), CHOIX (décision de conception).
 * Voir analysis/ANALYSE_REFERENCE.md pour les mesures. */
window.CC = {};
CC.Levels = [];        // rempli par src/world/levels/*.js, dans l'ordre de chargement

CC.CONFIG = {
  version: 'v033-ux',

  render: {
    aspect: 16 / 9,              // MESURÉ : zone de jeu 1132x637
    maxPixelRatio: 1.5,
    shadows: true,
    launchFx: 0.16,              // CHOIX v024 : durée (s) du renflement qui parcourt le tube au tir
    shadowMapSize: 2048,
    shadowRange: 70,             // demi-taille de la zone d'ombre autour de la roquette (m)
  },

  physics: {
    fixedDt: 1 / 240,
    gravity: 5.715,              // CHOIX d'Hugo (v013, gardé en v016) : moyenne Terre (9,81) / Lune (1,62) ; ne s'applique qu'à la roquette
  },

  rocket: {
    radius: 0.22,                // ESTIMATION (collision)
    length: 1.25,                // ESTIMATION
    ejectSpeed: 31,              // MESURÉ : SPEED 31 pendant 0,3 s après le tir
    ignitionDelay: 0.28,         // MESURÉ : le compteur SPEED passe 31→35 entre 0,23 et 0,33 s (séq. 3) ; la flamme n'est visible qu'à 0,63 s (séq. 7, masquée par la fumée)
    thrust: 50,                  // MESURÉ (v003) puis CHOIX v007 : 55 → 50 (la vitesse de pointe était un peu trop élevée)
    thrustHud: 45,               // valeur affichée par le HUD A ("THRUST:45", OBSERVÉ)
    dragK: 0.0100,               // MESURÉ (v003) puis CHOIX v007 : 0,0086 → 0,0100 (vitesse de pointe 80 → 71 m/s)
    inducedDrag: 0.070,          // ESTIMATION : perte de vitesse en virage serré (v007 : 0,085 → 0,070, virage moins coûteux)
    steerGain: 22.0,             // réponse du nez à la visée (v007 : 7,5 → 9 ; v019 : 9 → 22, maniabilité : le nez colle au doigt)
    maxTurnRate: 5.0,            // rad/s (v007 : 3,0 → 3,5 ; v019 : 3,5 → 5)
    grip: 24.0,                  // alignement de la vitesse sur le nez (1/s) (v007 : 9 → 11 ; v019 : 11 → 24, la trajectoire suit le nez sans retard)
    gripEngineOff: 9.0,          // v007 : 3,5 → 4,6 ; v019 : 4,6 → 9 (moteur coupé, la roquette reste pilotable)
    slideMaxAngleDeg: 27,        // CHOIX : contact rasant → glissade, sinon crash (v007 : 24 → 27, plus tolérant)
    slideFriction: 5.0,          // m/s² de perte en glissade
    breakSpeedFactor: 0.88,      // perte de vitesse en traversant vitre/mur de briques (ESTIMATION)
    gDisplayScale: 0.26,         // ESTIMATION : ramène les G affichés dans la plage observée (3,9 à 4,7 G)
    // Moteur à la demande (CHOIX v009) : G maintenue = poussée, relâchée = moteur coupé.
    // Après l'allumage, freeBoost secondes de poussée automatique et gratuite ; ensuite chaque seconde de poussée
    // consomme 1 s d'essence. Réservoir par niveau (`fuel` dans la fiche du niveau), plein à chaque tir.
    freeBoost: 0.5,              // v010 : 3 → 0,5 s
    fuelDefault: 12,             // s de poussée si le niveau ne précise pas `fuel`
    lowFuel: 0.25,               // v026 : alerte « LOW FUEL » (texte, deux notes, vibration) sous 25 % du réservoir
    fuelBarMax: 24,              // réservoir qui remplit toute la largeur de la jauge : un petit réservoir donne une jauge plus courte
  },

  abilities: {
    gaugeRegen: 0.10,            // ESTIMATION : recharge par seconde
    gaugeHideDelay: 1.6,         // MESURÉ : la jauge disparaît ≈ 1,5 s après usage
    retro: { decel: 25, drain: 0.62 },   // MESURÉ : 75→27 m/s en 1,75 s (≈ −27 m/s² moyen, traînée comprise), jauge vidée en ≈ 1,6 s
    grapple: {
      range: 80, assistAngleDeg: 30, useCost: 0.12, drainPerSec: 0.16,
      reelSpeed: 4, maxTime: 3.0, shootSpeed: 320, releaseBoost: 1.02,
    },
  },

  camera: {
    fovV: 70,                    // ESTIMATION
    distance: 1.85,              // MESURÉ (indirect) : nez à 55 % et tuyère à 67,8 % de la hauteur ⇒ ≈ 1,5 longueur de roquette
    height: 0.52,                // MESURÉ (indirect), même calcul
    crosshairY: 0.402,           // MESURÉ : réticule à 40,2 % de la hauteur
    followLag: 2.0,              // CHOIX v010, revu v019 : 2e étage du lissage (1/s) ; la caméra suit la tête de la roquette (plus petit = plus doux)
    noseLag: 3,                  // CHOIX v019 : 1er étage du lissage (1/s) : filtre les à-coups du joystick avant la caméra
    offsetLag: 7,                // lissage du décalage caméra (1/s) : dérive de la roquette à l'écran quand la visée tourne (ESTIMATION)
    rollFromYawRate: 0,          // v019 : 0,16 → 0 (Hugo) : l'horizon ne penche plus en virage
    rollLag: 5,
    boostZoom: 0.88,             // CHOIX v026 (Hugo) : pendant le boost, angle de vue × 0,88 (léger zoom avant)
    zoomIn: 3, zoomOut: 2,       // 1/s : vitesse du zoom au boost, puis du retour quand le boost s'arrête
    launchBlend: 0.45,           // MESURÉ : la caméra rattrape la roquette en ≈ 0,5 s
    near: 0.05, far: 1400,
    eyeHeight: 1.6,
  },

  input: {
    sensitivity: 0.0021, invertY: false, maxPitchDeg: 88, autoLevel: 1.5,
    // CHOIX v022 (Hugo) : commandes tactiles sans bouton (src/input/touch.js), remplacent le joystick de v017-v021
    touch: {
      dragGain: 2.2,             // rad de visée pour un glissé de la largeur (ou hauteur, la plus petite) de l'écran
      tapMaxMs: 250, tapMaxMove: 12,   // un toucher court (ms) et presque immobile (px) = tap
      longPressMs: 400,          // v026 : 500 → 400 ms (Hugo) ; v024 : appui long (doigt immobile) qui déclenche le boost, maintenu tant que le doigt est posé
      reboostMs: 600,            // v029 : 1000 → 600 ms (Hugo) ; v026 : après un boost, fenêtre (ms) où reposer le doigt relance le boost sans appui long
      edgeBand: 0.22,            // v024 : bande latérale (fraction de la largeur) où le doigt fait tourner sans fin
      edgeTurnRate: 1.8,         // v024 : virage (rad/s) quand le doigt est tout au bord
      pixelRatio: 1,             // fluidité : rendu à 1 pixel par point d'écran (au lieu de 1,5)
      shadowMapSize: 1024,       // fluidité : ombres 1024 au lieu de 2048
      fovMinH: 62,               // debout : angle de vue horizontal minimal (°), la vue verticale s'élargit en conséquence
    },
  },   // maxPitchDeg : au lanceur seulement (v011) ; autoLevel : remise à plat de l'horizon en vol (1/s)

  style: {
    proximityDist: 4.0,          // ESTIMATION : distance "PROXIMITY FLIGHT"
    proximityRate: 11,           // points/s de base
    groundSkimDist: 2.2,
    groundSkimRate: 16,
    comboGrowth: 0.10,           // multiplicateur +0,1/s (MESURÉ : x1,1 après ~1 s)
    endGrace: 0.35,              // s hors zone avant de finaliser
    coldImpactDist: 1.2,         // ESTIMATION
    coldImpactBase: 100,         // MESURÉ : x2,9 → +290 ; x1,4 → +142
    coldImpactCooldown: 0.6,
    manoeuvreG: 3.6,             // ESTIMATION : seuil de G affiché
    manoeuvreMinTime: 0.35,
    manoeuvrePointsPerG: 80,     // ESTIMATION : ≈ 80 × (G − 2,95)
    bombSmashPerMs: 7.5,         // MESURÉ : 67 m/s → +504
    speedBonusPerSec: 100,
    popupHold: 1.9,              // MESURÉ : 1,3 à 2,6 s
    popupFade: 0.32,
    popupRise: 0.07,             // fraction de hauteur d'écran
  },

  hud: {
    // Positions MESURÉES en fraction de la zone de jeu (voir ANALYSE §8). px = taille d'un pixel de police en fraction de H.
    cellAspect: 1.2,
    advance: 7,
    binds:   { A: { x: 0.0141, y: 0.0236, px: 0.00177, pitch: 0.0298 }, C: { x: 0.0124, y: 0.0204, px: 0.00150, pitch: 0.0259 } },
    timer:   { y: 0.0700, px: 0.00322, A: { px: 0.00276, cw: 1.22 }, B: { px: 0.00312, cw: 1.1 } },   // MESURÉ : A 101×12 px, B 103×14 px (+ virgule descendante)
    style:   { A: { y: 0.1170, px: 0.00444 }, C: { y: 0.1240, px: 0.00400 } },
    targets: { y: 0.1300, px: 0.00300 },
    topRight:{ x: 0.8260, y: 0.0700, px: 0.00330 },
    cooldown:{ x: 0.8216, y: 0.1270, px: 0.00300 },
    score:   { x: 0.8570, y: 0.0675, px: 0.00330 },
    time:    { x: 0.8270, y: 0.0690, px: 0.00380 },
    speed:   { x: 0.8198, y: 0.9090, px: 0.00380 },
    gauge:   { x0: 0.4150, x1: 0.5870, y0: 0.8950, y1: 0.9120 },
    fuel:    { x0: 0.0300, w: 0.2200, y0: 0.9000, y1: 0.9180, labelY: 0.8600, px: 0.00300 },   // CHOIX v009 : jauge d'essence en bas à gauche
    crosshair: { x: 0.5, y: 0.402, size: 0.0110 },
    guideArrowLevels: 3, guideArrowStep: 45,   // CHOIX v023 : flèches vertes sur les 3 premiers niveaux, une tous les 45 m (v027 : sauf niveau 2, `guide: false`)
    popups:  { cx: 0.785, jitter: 0.045, y0: 0.52, pitch: 0.029, yMin: 0.37, px: 0.00315, skew: -0.26 },
    center:  { y: 0.575, px: 0.00300 },
    colors: {
      white: '#f4f4f4', outline: '#1a1a1a', yellow: '#fdfd02', orange: '#ff7c1f', red: '#ff3b2e',
      green: '#56ff5a', blue: '#4ab0ff', grey: '#8a8a8a', crosshair: 'rgba(215,215,215,0.85)',
    },
  },

  // Traînées de la roquette (CHOIX v026, Hugo) : src/rendering/trails.js
  trails: {
    life: 0.45,                  // s : durée de vie d'un point de traînée des ailerons
    minStep: 0.35, minDt: 0.05,  // un point tous les 0,35 m (ou 0,05 s)
    maxPoints: 40,
    alpha: 0.5,                  // opacité de la traînée blanche (sans boost) : discrète mais visible sur les murs clairs
    alphaBoost: 0.75,            // opacité de la traînée jaune/rouge pendant le boost
    width: 0.004, widthBoost: 0.007,   // épaisseur en fraction de la hauteur d'écran (≈ 3 et 5 px sur un écran de 800 px)
    camFadeNear: 0.7, camFadeFar: 1.8,   // m : invisible à moins de 0,7 m de la caméra, pleine à 1,8 m (la vue reste dégagée)
    boostIn: 8, boostOut: 4,     // 1/s : apparition / disparition des filets d'air
    streaks: 16,                 // filets d'air au nez pendant le boost
    airSpeed: 3.2,               // parcours par seconde (1 = de la pointe jusqu'à airTravel m derrière)
    airTravel: 1.3,              // m : longueur parcourue par un filet avant de s'effacer
    airLen: 0.35,                // m : longueur d'un filet
    airR0: 0.05, airSpread: 0.22,   // m, m/m : écart à l'axe à la pointe, puis évasement (cône autour du nez)
    airAlpha: 0.7, airWidth: 0.0035,
  },

  postfx: {
    enabled: true,
    vignette: 0.55, vignetteRadius: 0.78, vignetteSoftness: 0.55,
    chromatic: 0.0045,
    halftone: 0.35, halftoneCell: 3.0,
    bloomThreshold: 0.72, bloomStrength: 0.55,
    grain: 0.025,
    lift: '#000000',             // relèvement des ombres : valeurs par niveau calibrées par tools/calibrate_color.js (v006)
    saturation: 1.0,
  },

  // Boutique de cosmétiques (CHOIX v007). Montants en centimes d'euro, pour éviter les arrondis flottants.
  // v031 (Hugo) : plus d'argent gagné en jouant ; chaque cosmétique se débloque en payant (lien de paiement Stripe) ou en
  // regardant une minute de publicité en entier. Au retour du paiement, Stripe renvoie vers le jeu (réglage du lien dans le
  // Dashboard : redirection vers l'adresse du jeu + « ?paid=1&session_id={CHECKOUT_SESSION_ID} ») en y ajoutant
  // utm_content = identifiant du cosmétique ; le jeu le débloque et l'équipe (src/ui/shop.js).
  shop: {
    priceCents: 229,             // prix unique de tous les cosmétiques (2,29 €)
    stripeLink: '',              // lien de paiement Stripe, ex. 'https://buy.stripe.com/xxxx' — À RENSEIGNER
    adSeconds: 60,               // ou une minute de publicité, sans pouvoir la passer
    adSegment: 15,               // la minute est faite de 4 annonces de 15 s qui s'enchaînent
  },

  // Missiles anti-aériens des tanks et hélicoptères (CHOIX v020, Hugo). Chaque paire [début, fin] est interpolée selon la
  // menace du niveau : 0 (CITY) → 1 (NIGHT FOREST) ; missions générées (v032) : enemyReaction du profil de difficulté
  // (src/world/gen/profiles.js), aaByDifficulty n'est plus qu'un secours. Toujours moins maniables que la roquette.
  aa: {
    range: [90, 140],            // m : portée de tir (le tireur doit voir la roquette : pas à travers un bâtiment)
    frontCos: 0.26,              // cos 75° : le tireur doit être devant la roquette (jamais de tir dans le dos)
    minRange: 45,                // m : trop près, il ne tire plus (sinon la cible visée tire à bout portant pendant l'approche finale)
    firstDelay: [1.5, 0.6],      // s : temps de réaction après avoir repéré la roquette
    cooldown: [5.0, 1.6],        // s : délai entre deux tirs d'un même tireur
    miss: [6, 0.3],              // m : erreur de visée, courbe en (1 − menace)^missCurve : ≈ 4 m à 0,17 · 2,4 m à 0,33 · 1,3 m à 0,5 · 0,7 m à 0,67
    missCurve: 2.5,
    lead: [0, 0.6],              // anticipation de la trajectoire de la roquette (0 = vise où elle est)
    turn: [0.5, 1.1],            // rad/s : virage du missile, toujours sous celui du joueur (joystick 1,5 rad/s, clavier 1,8) : on peut le semer
    speed: [50, 68],             // m/s, juste sous la vitesse de pointe de la roquette (≈ 71 m/s) : à pleine poussée on le distance
    life: 5,                     // s avant autodestruction
    boostStart: 0.35, boostTime: 1.2,   // v023 : départ à 35 % de la vitesse, pleine vitesse en 1,2 s (temps de réaction)
    maxAlive: 3,                 // missiles ennemis en vol en même temps, au plus
    // salves (v023, 3 derniers niveaux + AUTOMAP difficile) : salvoCount tirs espacés de salvoGap s, puis
    // repos = cooldown × salvoRest ; un tireur à moins de volleyJoin s de sa recharge se joint au tir d'un autre
    salvoCount: 2, salvoGap: 0.45, salvoRest: 1.5, volleyJoin: 1.2, maxAliveSalvo: 5,   // 3 par salve : injouable au canyon (v023)
    fuse: 1.6,                   // m : détonation de proximité
    warnDist: 90,                // m : avertissement « MISSILE! » à l'écran (v026 : + bip répété et vibration)
    warnBeep: 0.45,              // v026 : s entre deux bips tant qu'un missile est à moins de warnDist
  },
  aaByDifficulty: { easy: 0.3, medium: 0.6, hard: 0.95 },

  // v033 : mode CLASSIQUE — couloir infini (src/world/endless.js). Score = mètres parcourus, une seule vie.
  // La difficulté monte par paliers de distance (FACILE → MOYEN → DIFFICILE → IMPOSSIBLE) ; les décors changent par zone.
  endless: {
    chunkLen: 200,               // m : longueur d'un tronçon construit d'un coup
    ahead: 3,                    // tronçons prêts devant la roquette (le brouillard cache le bout)
    behind: 1,                   // tronçons gardés derrière avant d'être détruits
    stageLen: 800,               // m par palier de difficulté (le 4e palier, IMPOSSIBLE, ne finit jamais)
    zoneLen: 1000,               // m par décor (ville, désert, neige, industrie, canyon…)
    width: [40, 30, 23, 18],     // m : largeur du couloir par palier
    gap: [85, 70, 58, 48],       // m : espacement moyen des obstacles par palier
    hole: [15, 12, 10, 8.5],     // m : côté du trou des murs percés par palier
    bend: [8, 13, 18, 22],       // m : amplitude des virages du couloir par palier
    ceiling: 48,                 // m : altitude au-dessus de laquelle l'alarme ALTITUDE! se déclenche
    ceilingGrace: 1.5,           // s au-dessus du plafond avant l'explosion
    cruise: 14,                  // m : altitude de vol du pilote automatique (banc de test)
    fuelStart: 14,               // s d'essence au départ
    fuelMax: 20,                 // s : taille du réservoir (les recharges ne dépassent pas)
    fuelPerStyle: 0.0035,        // s d'essence gagnées par point de STYLE (COLD IMPACT X2 = 200 pts → +0,7 s)
    fuelTarget: 4,               // s d'essence par cible détruite en route (dépôt de carburant, camion, char)
    targetGap: [200, 300],       // m entre deux cibles à détruire
    threat: [0.2, 0.45, 0.75, 1],        // menace des tirs ennemis par palier (bornes de CC.CONFIG.aa)
    tanks: [0, 1, 2, 3],         // chars ennemis par tronçon et par palier
    maxMissiles: [2, 2, 3, 4],   // missiles ennemis en vol en même temps, par palier
  },

  // v033 : mode DÉFI — série fixe de cartes générées par difficulté, 1 à 3 étoiles au temps, trophées par difficulté.
  challenge: {
    maps: 20,                    // cartes par difficulté (identiques pour tous les joueurs)
    star3: 1.0,                  // 3 étoiles : temps ≤ temps de référence de la carte × star3
    star2: 1.5,                  // 2 étoiles : temps ≤ référence × star2 ; sinon 1 étoile (carte terminée)
    trophies: [10, 20, 40],      // étoiles d'une difficulté pour les trophées BRONZE, ARGENT, OR (sur 60)
  },

  audio: { master: 0.7, music: 0.28, sfx: 0.9 },

  // v030 : niveaux de qualité graphique (src/core/quality.js) — réglage GRAPHICS : AUTO / HIGH / MEDIUM / LOW
  quality: {
    tiers: {
      high:   { pixelRatio: 1.5,  shadowMap: 2048, shadows: true,  msaa: 4, bloom: true,  particles: 1 },
      medium: { pixelRatio: 1,    shadowMap: 1024, shadows: true,  msaa: 0, bloom: true,  particles: 0.9 },
      low:    { pixelRatio: 0.75, shadowMap: 512,  shadows: false, msaa: 0, bloom: false, particles: 0.55 },
    },
    autoDownFps: 42,             // AUTO : sous 42 images/s en vol pendant autoWindow s → niveau inférieur
    autoWindow: 3,
    maxFpsTouch: 60,             // écrans à 120 Hz : le jeu n'en calcule que 60 (batterie, chauffe)
    pausedFps: 20,               // menus et pause : 20 images/s suffisent
  },

  // v030 : publicités d'EXEMPLE (src/ui/ads.js) — annonceurs fictifs, aucune régie ; le joueur peut les couper
  ads: {
    enabled: true,
    interstitialEvery: 3,        // une interstitielle au plus tous les 3 niveaux terminés…
    minGap: 90,                  // … et jamais moins de 90 s après la précédente
    skipAfter: 5,                // s avant de pouvoir fermer l'interstitielle
    interstitialTime: 15,        // s : fermeture automatique
    rewardTime: 8,               // s à regarder pour la récompense (gain du niveau doublé)
    bannerCycle: 8,              // s : rotation des annonceurs de la bannière du menu
  },

  test: { fps: 30 },
};
