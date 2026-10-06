/* Générateur de missions — profils de difficulté.
 * La difficulté n'est pas une seule variable : chaque niveau fixe un profil de onze paramètres (0 = minimum, 1 = maximum,
 * `distance` en mètres), chacun légèrement varié par carte (`jitter`) pour que deux cartes DIFFICILE ne se ressemblent pas.
 * Les nombres (cibles, tanks, hélicoptères, défenses) découlent des densités ; aucun dégât ni vitesse n'est « gonflé » :
 * la menace des tirs reste dans les bornes jouables de CC.CONFIG.aa (virage et vitesse des missiles < roquette). */
(function () {
  const G = CC.Gen;

  // Ajouter une difficulté = une entrée de plus (ordre = rang d'affichage).
  const D = (id, o) => G.Difficulties.add(id, o);
  D('easy', {
    order: 0, label: 'EASY', color: '#56ff5a', blurb: 'WIDE OPEN SPACES - FEW DEFENSES',
    base: {
      obstacleDensity: 0.12, buildingDensity: 0.35, tankDensity: 0.12, helicopterDensity: 0.1, defenseDensity: 0.0,
      targetProtection: 0.08, availableSpace: 0.95, routeComplexity: 0.12, distance: 430, enemyReaction: 0.25, environmentalComplexity: 0.12,
    },
    targets: [2, 2], tanks: [1, 2], helis: [0, 1], sams: [0, 0],
    fuelMargin: 1.9, clearance: 3.6, maxTurnRate: 1.2, launcherEye: [24, 30], salvo: false, heliSpeed: [0, 5], maxMissiles: 2,
    scoreBand: [0, 28],
  });
  D('medium', {
    order: 1, label: 'MEDIUM', color: '#fdfd02', blurb: 'MORE TANKS - CHOOSE YOUR LINE',
    base: {
      obstacleDensity: 0.4, buildingDensity: 0.55, tankDensity: 0.4, helicopterDensity: 0.35, defenseDensity: 0.15,
      targetProtection: 0.35, availableSpace: 0.72, routeComplexity: 0.38, distance: 600, enemyReaction: 0.55, environmentalComplexity: 0.35,
    },
    targets: [3, 3], tanks: [2, 4], helis: [1, 1], sams: [0, 0],
    fuelMargin: 1.6, clearance: 2.8, maxTurnRate: 1.75, launcherEye: [19, 25], salvo: false, heliSpeed: [4, 10], maxMissiles: 3,
    scoreBand: [24, 50],
  });
  D('hard', {
    order: 2, label: 'HARD', color: '#ff7c1f', blurb: 'CROSSFIRE - TIGHT PASSAGES',
    base: {
      obstacleDensity: 0.7, buildingDensity: 0.78, tankDensity: 0.7, helicopterDensity: 0.65, defenseDensity: 0.5,
      targetProtection: 0.68, availableSpace: 0.52, routeComplexity: 0.65, distance: 760, enemyReaction: 0.85, environmentalComplexity: 0.6,
    },
    targets: [3, 4], tanks: [4, 6], helis: [1, 2], sams: [1, 1],
    fuelMargin: 1.35, clearance: 2.2, maxTurnRate: 2.4, launcherEye: [15, 21], salvo: true, heliSpeed: [8, 16], maxMissiles: 4,
    scoreBand: [44, 70],
  });
  D('impossible', {
    order: 3, label: 'IMPOSSIBLE', color: '#ff3b2e', blurb: 'SATURATED - NO MARGIN FOR ERROR',
    base: {
      obstacleDensity: 0.95, buildingDensity: 0.95, tankDensity: 0.95, helicopterDensity: 0.95, defenseDensity: 0.95,
      targetProtection: 0.95, availableSpace: 0.34, routeComplexity: 0.9, distance: 900, enemyReaction: 1.0, environmentalComplexity: 0.85,
    },
    targets: [4, 4], tanks: [7, 9], helis: [2, 3], sams: [2, 3],
    fuelMargin: 1.18, clearance: 1.7, maxTurnRate: 3.3, launcherEye: [11, 17], salvo: true, heliSpeed: [14, 24], maxMissiles: 7,
    scoreBand: [66, 100],
  });

  G.difficultyIds = () => G.Difficulties.all().sort((a, b) => a.order - b.order).map((d) => d.id);

  /* Profil d'une carte : base de la difficulté, variée de ±jitter, puis ajustée par le biome (un désert est plus ouvert,
   * une ville plus dense…). Les bornes restent dans [0, 1] ; la distance varie de ±10 %. */
  G.makeProfile = (diffId, biome, r, relax) => {
    const D = G.Difficulties.get(diffId) || G.Difficulties.get('easy');
    const p = {};
    for (const [k, v] of Object.entries(D.base)) {
      if (k === 'distance') p[k] = Math.round(r.jitter(v, 0.1));
      else p[k] = G.clamp(v + (r() * 2 - 1) * 0.08, 0, 1);
    }
    // correction (après plusieurs essais refusés) : on desserre la carte — moins dense, plus d'espace, trajets plus simples
    if (relax) for (const k of ['obstacleDensity', 'buildingDensity', 'routeComplexity']) p[k] *= 1 - 0.3 * relax;
    if (relax) p.availableSpace = G.clamp(p.availableSpace + 0.2 * relax, 0, 1);
    const mod = (biome && biome.profileMod) || {};
    for (const [k, f] of Object.entries(mod)) if (p[k] !== undefined) p[k] = k === 'distance' ? Math.round(p[k] * f) : G.clamp(p[k] * f, 0, 1);
    // nombres entiers tirés dans la fourchette de la difficulté, placés selon la densité correspondante
    const pick = (ab, dens) => Math.round(ab[0] + (ab[1] - ab[0]) * G.clamp(dens + (r() - 0.5) * 0.35, 0, 1));
    p.targetCount = pick(D.targets, p.targetProtection);
    p.tankCount = pick(D.tanks, p.tankDensity);
    p.heliCount = pick(D.helis, p.helicopterDensity);
    p.samCount = pick(D.sams, p.defenseDensity);
    p.fuelMargin = D.fuelMargin; p.clearance = D.clearance; p.maxTurnRate = D.maxTurnRate; p.salvo = D.salvo;
    p.launcherEye = r.between(D.launcherEye); p.heliSpeed = D.heliSpeed; p.maxMissiles = D.maxMissiles;
    // FACILE / MOYEN : les cibles visent mais ne tirent pas (seules les défenses tirent) ; DIFFICILE / IMPOSSIBLE : elles tirent
    p.armedTargets = D.order >= 2;
    p.difficulty = D.id;
    return p;
  };
})();
