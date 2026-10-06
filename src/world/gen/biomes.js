/* Générateur de missions — ambiances et familles de cartes (biomes).
 * Les ambiances reprennent les réglages des niveaux existants (ciel, brouillard, lumières, post-traitement : même direction
 * artistique) ; le soleil change de direction d'une carte à l'autre. Un biome décrit : disposition (grille, organique,
 * vallée), sol, relief, gabarits de zones et leurs poids, obstacles, décor, cibles, lanceur, ambiances. */
(function () {
  const G = CC.Gen;

  // ---------- ambiances ----------
  // `dark` : ambiance sombre (compte dans la complexité environnementale) ; `vis` : visibilité (0 = brouillard épais)
  const E = (id, o) => G.Envs.add(id, o);
  E('day', { label: 'DAY', dark: 0, vis: 1, skyline: '#e6ebf0', make: (r) => ({
    sky: { top: '#8db4da', horizon: '#f1f3f5', bottom: '#cdd1d6', sunColor: '#ffffff', sunSize: 700 },
    fog: { color: '#e6e6e8', near: 160, far: r.between([820, 1000]) },
    hemi: { sky: '#e8eef6', ground: '#8d8a8e', intensity: 0.66 }, ambient: { color: '#ffffff', intensity: 0.24 },
    sun: { color: '#ffffff', intensity: 0.74, dir: sunDir(r, [0.55, 0.85]) },
    postfx: { vignette: 0.6, vignetteColor: '#43201f', halftone: 0.45, lift: '#100000', saturation: 0.85 },
  }) });
  E('overcast', { label: 'OVERCAST', dark: 0.15, vis: 0.8, skyline: '#c9ccd0', make: (r) => ({
    sky: { top: '#9aa3ad', horizon: '#d6d9dc', bottom: '#b9bcc0', sunColor: '#d8dce0', sunSize: 90 },
    fog: { color: '#c6c9cd', near: 110, far: r.between([600, 760]) },
    hemi: { sky: '#dfe3e8', ground: '#7d7b7e', intensity: 0.78 }, ambient: { color: '#ffffff', intensity: 0.3 },
    sun: { color: '#eef0f4', intensity: 0.42, dir: sunDir(r, [0.7, 0.95]) },
    postfx: { vignette: 0.55, vignetteColor: '#262a2e', halftone: 0.4, lift: '#080808', saturation: 0.72 },
  }) });
  E('haze', { label: 'HEAT HAZE', dark: 0.05, vis: 0.85, skyline: '#e8d8bc', make: (r) => ({
    sky: { top: '#9cb6cc', horizon: '#f2e4c8', bottom: '#d8c8a8', sunColor: '#fff4d8', sunSize: 500 },
    fog: { color: '#e8d8bc', near: 140, far: r.between([640, 820]) },
    hemi: { sky: '#f4ecd8', ground: '#a08868', intensity: 0.7 }, ambient: { color: '#fff4e0', intensity: 0.22 },
    sun: { color: '#fff2d6', intensity: 0.82, dir: sunDir(r, [0.7, 0.95]) },
    postfx: { vignette: 0.6, vignetteColor: '#4a2a14', halftone: 0.45, lift: '#140800', saturation: 0.9 },
  }) });
  E('dawn', { label: 'DAWN', dark: 0.3, vis: 0.8, skyline: '#8a7a88', make: (r) => ({
    sky: { top: '#3a4a6e', horizon: '#e8a888', bottom: '#5a4a58', sunColor: '#ffc8a0', sunSize: 600 },
    fog: { color: '#a08898', near: 110, far: r.between([560, 720]) },
    hemi: { sky: '#c8b8d0', ground: '#4a3a40', intensity: 0.62 }, ambient: { color: '#ffe0d0', intensity: 0.22 },
    sun: { color: '#ffc090', intensity: 0.62, dir: sunDir(r, [0.12, 0.25]) },
    postfx: { vignette: 0.55, vignetteColor: '#2a1420', halftone: 0.4, lift: '#0a0410', saturation: 0.9 },
  }) });
  E('dusk', { label: 'DUSK', dark: 0.45, vis: 0.7, skyline: '#3a2418', make: (r) => ({
    sky: { top: '#140a08', horizon: '#b04a1c', bottom: '#2a120a', sunColor: '#301006', sunSize: 900 },
    fog: { color: '#2a241c', near: 90, far: r.between([560, 700]) },
    hemi: { sky: '#9a9078', ground: '#101a0e', intensity: 0.45 }, ambient: { color: '#ffffff', intensity: 0.18 },
    sun: { color: '#ffa860', intensity: 0.58, dir: sunDir(r, [0.15, 0.28]) },
    postfx: { vignette: 0.55, vignetteColor: '#1a0806', halftone: 0.35, lift: '#040004', saturation: 0.8 },
  }) });
  E('night', { label: 'NIGHT', dark: 0.85, vis: 0.5, skyline: '#0c1210', make: (r) => ({
    sky: { top: '#000000', horizon: '#04070a', bottom: '#000000', stars: true },
    fog: { color: '#020403', near: 70, far: r.between([430, 520]) },
    hemi: { sky: '#788e78', ground: '#1a201a', intensity: 1.0 }, ambient: { color: '#ffffff', intensity: 0.26 },
    sun: { color: '#a8c0ff', intensity: 0.45, dir: sunDir(r, [0.55, 0.8]) },
    postfx: { vignette: 0.5, vignetteColor: '#000000', chromatic: 0.0075, halftone: 0.3, lift: '#100810', saturation: 1.08 },
  }) });
  E('moonlit', { label: 'MOONLIT', dark: 0.75, vis: 0.55, skyline: '#101828', make: (r) => ({
    sky: { top: '#000000', horizon: '#0a1020', bottom: '#000000', stars: true },
    fog: { color: '#0a1020', near: 90, far: r.between([460, 560]) },
    hemi: { sky: '#9fb3d8', ground: '#2a3040', intensity: 1.3 }, ambient: { color: '#ffffff', intensity: 0.32 },
    sun: { color: '#c8d6ff', intensity: 0.8, dir: sunDir(r, [0.6, 0.85]) },
    postfx: { vignette: 0.6, vignetteColor: '#000000', chromatic: 0.007, halftone: 0.3, lift: '#080a14', saturation: 0.85 },
  }) });
  E('fog', { label: 'FOG', dark: 0.4, vis: 0.3, skyline: '#9ea4a8', make: (r) => ({
    sky: { top: '#a8aeb2', horizon: '#c4c8ca', bottom: '#b0b4b6', sunColor: '#d0d4d8', sunSize: 60 },
    fog: { color: '#b8bcbe', near: 45, far: r.between([380, 440]) },
    hemi: { sky: '#e0e4e8', ground: '#707070', intensity: 0.8 }, ambient: { color: '#ffffff', intensity: 0.3 },
    sun: { color: '#e8ecf0', intensity: 0.36, dir: sunDir(r, [0.7, 0.95]) },
    postfx: { vignette: 0.55, vignetteColor: '#202428', halftone: 0.35, lift: '#060606', saturation: 0.65 },
  }) });
  E('snow', { label: 'SNOW', dark: 0.1, vis: 0.85, skyline: '#dfe6ee', make: (r) => ({
    sky: { top: '#86a8cc', horizon: '#eef2f6', bottom: '#dde4ea', sunColor: '#ffffff', sunSize: 800 },
    fog: { color: '#e4eaf0', near: 150, far: r.between([700, 900]) },
    hemi: { sky: '#eef4fa', ground: '#9aa4b0', intensity: 0.72 }, ambient: { color: '#ffffff', intensity: 0.26 },
    sun: { color: '#ffffff', intensity: 0.7, dir: sunDir(r, [0.35, 0.6]) },
    postfx: { vignette: 0.55, vignetteColor: '#1a2230', halftone: 0.4, lift: '#04060a', saturation: 0.8 },
  }) });

  // Direction du soleil : azimut libre, hauteur dans la plage donnée (sinus de l'élévation)
  function sunDir(r, el) {
    const a = r() * Math.PI * 2, y = r.between(el), h = Math.sqrt(Math.max(0, 1 - y * y));
    return [G.round(Math.cos(a) * h, 3), G.round(y, 3), G.round(Math.sin(a) * h, 3)];
  }

  /* Choix de l'ambiance : poids du biome, pondérés par la complexité environnementale (les ambiances sombres ou
   * brumeuses deviennent plus probables quand elle monte, sans jamais devenir illisibles : brouillard ≥ 380 m). */
  G.pickEnv = (biome, profile, r) => {
    const ec = profile.environmentalComplexity, w = {};
    for (const [id, base] of Object.entries(biome.envs)) {
      const e = G.Envs.get(id);
      const hard = e.dark * 0.7 + (1 - e.vis) * 0.6;           // 0 (plein jour) → ~1 (nuit, brouillard)
      w[id] = base * Math.max(0.05, 1 - Math.abs(hard - ec) * 1.6);
    }
    const id = r.weighted(w), e = G.Envs.get(id);
    return { id, label: e.label, dark: e.dark, vis: e.vis, skyline: e.skyline, def: e.make(r) };
  };

  // ---------- biomes ----------
  const B = (id, o) => G.Biomes.add(id, o);
  const FAC = ['facade', 'facadePink', 'facadeTan', 'facade', 'brick', 'concrete'];
  B('urban', {
    label: 'URBAN AREA', layout: 'grid', terrain: 'flat', ground: 'asphalt', groundTint: '#ffffff', road: 'asphalt', sidewalk: 'concrete',
    block: { w: [55, 95], l: [48, 86] }, mainWidth: [16, 34],
    zones: { cityBlock: 5, towerBlock: 3, lowrise: 2.5, park: 1.1, plaza: 1, parking: 1, construction: 0.8 },
    edge: 'lowrise', facades: FAC,
    obstacles: { gantry: 2, skybridge: 2.2, glass: 1.4, laser: 0.6, crates: 1, cable: 0.8 },
    targets: { truck: 3, heli: 2, command: 1.2, fuel: 0.6 },
    launcher: 'rooftop', envs: { day: 3, overcast: 2, dawn: 1.2, dusk: 2, night: 2, fog: 1 },
    profileMod: { buildingDensity: 1.1, availableSpace: 0.92 },
  });
  B('industrial', {
    label: 'INDUSTRIAL AREA', layout: 'grid', terrain: 'flat', ground: 'concreteDark', groundTint: '#d8d4d0', road: 'asphalt', sidewalk: 'concreteDark',
    block: { w: [90, 150], l: [80, 130] }, mainWidth: [18, 36],
    zones: { warehouseYard: 4, factory: 3, tankFarm: 2, containerYard: 2, lot: 1.4 },
    edge: 'lot', facades: ['concrete', 'concreteWarm', 'brick', 'facadeDark'],
    obstacles: { piperack: 3, gantry: 1, cable: 1.6, crates: 1.5, towerCrane: 0.8 },
    targets: { fuel: 3, truck: 2, radar: 0.6, command: 0.8 },
    launcher: 'rooftop', envs: { day: 2, overcast: 2.5, haze: 1, dusk: 2, night: 1.6, fog: 1.2 },
    profileMod: { availableSpace: 1.05 },
  });
  B('military', {
    label: 'MILITARY AREA', layout: 'grid', terrain: 'hills', hillAmp: [6, 14], ground: 'dirt', groundTint: '#c8c0b0', road: 'concreteDark', sidewalk: null,
    block: { w: [70, 115], l: [65, 105] }, mainWidth: [18, 32],
    zones: { barracks: 3, hangarRow: 3, motorPool: 2.2, helipad: 1.4, bunkerField: 1.6, radarSite: 1, fuelDump: 1, training: 1.2, depot: 2 },
    edge: 'training', facades: ['concreteDark', 'concrete', 'facadeDark'],
    obstacles: { laser: 1.6, gantry: 1, cable: 1, crates: 0.6, watchtower: 1.2 },
    targets: { tank: 3, radar: 2, command: 2, heli: 1.4, truck: 1 },
    launcher: 'tower', envs: { day: 2, overcast: 2, dusk: 2, night: 2, moonlit: 1, fog: 1.2 },
    profileMod: { tankDensity: 1.1, defenseDensity: 1.15 },
  });
  B('rural', {
    label: 'RURAL AREA', layout: 'organic', terrain: 'hills', hillAmp: [5, 16], ground: 'grass', groundTint: '#b8c0a0', road: 'dirt', sidewalk: null,
    clusters: { farmstead: 4, hamlet: 3, orchard: 1.4, forestPatch: 3, fieldBarn: 2 }, clusterSize: [45, 110],
    facades: ['brick', 'houseWall', 'cream'],
    obstacles: { powerline: 3, treeLine: 2, cable: 0.6 },
    targets: { house: 3, truck: 2, tank: 1.4, heli: 1 },
    launcher: 'tower', envs: { day: 3, overcast: 2, dawn: 1.4, dusk: 1.6, moonlit: 1.2, fog: 1.2 },
    profileMod: { buildingDensity: 0.7, availableSpace: 1.1 },
  });
  B('mountain', {
    label: 'MOUNTAIN AREA', layout: 'valley', terrain: 'mountain', ground: 'rock', groundTint: '#ffffff', road: 'dirt', sidewalk: null,
    clusters: { outpost: 3, alpineVillage: 2, minehead: 2, radarSite: 2, forestPatch: 3 }, clusterSize: [40, 80],
    facades: ['concrete', 'houseWall', 'brick'],
    obstacles: { rockArch: 3, pillar: 2, cable: 2, bridge: 1.6 },
    targets: { radar: 3, tank: 2, truck: 2, command: 1.4, heli: 1 },
    launcher: 'ledge', envs: { snow: 2.2, day: 2, overcast: 2, dusk: 1, moonlit: 1.4, fog: 1 },
    profileMod: { availableSpace: 0.9, routeComplexity: 1.15, buildingDensity: 0.6 },
  });
  B('desert', {
    label: 'DESERT AREA', layout: 'organic', terrain: 'dunes', hillAmp: [3, 9], ground: 'sand', groundTint: '#ffffff', road: 'dirt', sidewalk: null,
    clusters: { outpost: 3, oilField: 3, ruins: 2, camp: 2, rockOutcrop: 2, airstrip: 1 }, clusterSize: [50, 120],
    facades: ['cream', 'concreteWarm', 'concrete'],
    obstacles: { powerline: 1.5, rockArch: 1, cable: 0.4 },
    targets: { tank: 3, truck: 2, radar: 2, fuel: 2, command: 1 },
    launcher: 'tower', envs: { haze: 3, day: 2, dawn: 1.5, dusk: 2, night: 1, moonlit: 1 },
    profileMod: { buildingDensity: 0.5, availableSpace: 1.2 },
  });
  B('port', {
    label: 'HARBOR AREA', layout: 'grid', terrain: 'coast', ground: 'concrete', groundTint: '#d0ccc8', road: 'asphalt', sidewalk: 'concreteDark',
    block: { w: [80, 130], l: [70, 120] }, mainWidth: [18, 34],
    zones: { containerYard: 4, warehouseQuay: 3, craneQuay: 3, tankFarm: 2, lot: 1 },
    edge: 'containerYard', facades: ['concrete', 'concreteWarm', 'facadeDark', 'brick'],
    obstacles: { piperack: 1, cable: 1.2, gantry: 1, crates: 1.2, towerCrane: 1 },
    targets: { fuel: 3, truck: 2, heli: 1.4, command: 0.6 },
    launcher: 'rooftop', envs: { day: 2, overcast: 2.5, fog: 2, dusk: 2, night: 1.4, dawn: 1 },
  });
  B('mixed', {
    label: 'MIXED AREA', layout: 'grid', terrain: 'flat', ground: 'asphalt', groundTint: '#f0ece8', road: 'asphalt', sidewalk: 'concrete',
    block: { w: [60, 120], l: [55, 105] }, mainWidth: [16, 34],
    mix: ['urban', 'industrial', 'military', 'port'],          // bandes successives de sous-biomes (2 ou 3)
    facades: FAC, obstacles: { gantry: 1.4, skybridge: 1, piperack: 1.2, laser: 0.8, cable: 1, crates: 1 },
    targets: { truck: 2, fuel: 2, tank: 2, command: 1.4, heli: 1.4, radar: 1 },
    launcher: 'rooftop', envs: { day: 2, overcast: 2, dusk: 2, night: 1.6, dawn: 1, fog: 1 },
  });
})();
