/* v033 : mode CLASSIQUE — couloir infini (CHOIX d'Hugo et de son collègue : « faire le plus de mètres possible »).
 * Le couloir file vers -z. Il est construit par tronçons de CC.CONFIG.endless.chunkLen m devant la roquette (chaque
 * tronçon a son LevelBuilder : géométrie fusionnée par matériau, collisions, cibles, ennemis) et détruit derrière elle.
 * Tout dérive de la graine de la partie : même graine = même couloir.
 * - Tracé : ligne centrale en somme de sinus (virages continus) ; parois en polyligne (une boîte par corde, sans marche).
 * - Paliers de difficulté selon la distance : FACILE → MOYEN → DIFFICILE → IMPOSSIBLE (couloir plus étroit et plus
 *   sinueux, obstacles plus serrés, trous plus petits, chars ennemis de plus en plus précis).
 * - Zones de décor : ville, désert, neige, industrie, canyon, ville de nuit ; l'ambiance lumineuse glisse d'une zone à
 *   l'autre quand la roquette passe la frontière.
 * - Essence : frôler (points de STYLE) et détruire les cibles en route (dépôts de carburant, camions, chars) recharge.
 * - Pilote automatique (banc de test) : chaque tronçon ajoute ses points de passage à la route. */
(function () {
  const U = CC.U, V = THREE.Vector3, G = CC.Gen;
  const E = CC.Endless = {};
  const C = () => CC.CONFIG.endless;
  const DEG = 180 / Math.PI;

  // ---------- zones de décor ----------
  // wall(r) → matériau et teinte d'une paroi ; kind 'city' : immeubles (façades, toits équipés par le LevelBuilder)
  const ZONES = {
    city: { label: 'URBAN AREA', envs: ['day', 'overcast', 'dawn'], ground: 'asphalt', groundTint: '#ffffff', city: true,
      wall: (r) => ({ mat: { side: r.pick(['facade', 'facadePink', 'facadeTan']), top: 'concrete', bottom: 'concreteDark' }, tint: r.pick(['#ffffff', '#f2eee8', '#e8ecf0']) }),
      obstacle: 'concrete', obstacleTint: '#d8d4cc' },
    desert: { label: 'DESERT', envs: ['haze', 'day'], ground: 'sand', groundTint: '#ffffff',
      wall: (r) => ({ mat: { side: 'rock', top: 'sand' }, tint: r.pick(['#e8c896', '#dcb883', '#f0d2a0']) }),
      obstacle: 'rock', obstacleTint: '#d8b888' },
    snow: { label: 'SNOWY MOUNTAINS', envs: ['snow'], ground: 'white', groundTint: '#f4f8ff',
      wall: (r) => ({ mat: { side: 'rock', top: 'white' }, tint: r.pick(['#c8d0dc', '#b8c2d0', '#d8dee8']) }),
      obstacle: 'rock', obstacleTint: '#c8d0dc' },
    industry: { label: 'INDUSTRIAL AREA', envs: ['overcast', 'fog', 'dusk'], ground: 'concreteDark', groundTint: '#d8d4d0',
      wall: (r) => ({ mat: { side: r.pick(['corrugated', 'metal', 'brick']), top: 'concreteDark' }, tint: r.pick(['#c8ccd0', '#b8a898', '#a8b4b8']) }),
      obstacle: 'metal', obstacleTint: '#c8ccd4' },
    canyon: { label: 'CANYON', envs: ['dusk', 'day', 'haze'], ground: 'dirt', groundTint: '#c8a888',
      wall: (r) => ({ mat: { side: 'rock', top: 'dirt' }, tint: r.pick(['#c07858', '#b06848', '#c88a68']) }),
      obstacle: 'rock', obstacleTint: '#b87858' },
    night: { label: 'NIGHT CITY', envs: ['night', 'moonlit'], ground: 'asphalt', groundTint: '#b8b8c0', city: true,
      wall: (r) => ({ mat: { side: r.pick(['facadeDark', 'facade']), top: 'concreteDark', bottom: 'concreteDark' }, tint: r.pick(['#b8bcc8', '#a8acb8']) }),
      obstacle: 'metal', obstacleTint: '#9aa0b0' },
  };
  E.Zones = ZONES;

  // ---------- paramètres par palier (interpolés sur les 150 derniers mètres d'un palier : pas de marche) ----------
  function stageOf(d) { return U.clamp(Math.floor(Math.max(0, d) / C().stageLen), 0, 3); }
  function param(arr, d) {
    const L = C().stageLen, x = Math.max(0, d), i = Math.min(3, Math.floor(x / L));
    if (i >= 3) return arr[3];
    const f = x - i * L, k = U.clamp((f - (L - 150)) / 150, 0, 1), s = k * k * (3 - 2 * k);
    return arr[i] + (arr[i + 1] - arr[i]) * s;
  }

  /* Tracé du couloir d'une partie : x du centre et demi-largeur à la distance d (fonctions continues). */
  class Track {
    constructor(seed) {
      const r = G.stream(seed, 'track');
      this.p = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
      this.l = [r.between([170, 230]), r.between([75, 105]), r.between([48, 70])];
      this.seed = seed;
      // ordre des zones : la ville d'abord (lisible), puis les autres dans un ordre tiré de la graine, en boucle
      const rest = ['desert', 'snow', 'industry', 'canyon', 'night'];
      const rz = G.stream(seed, 'zones');
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rz() * (i + 1)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      this.zoneOrder = ['city'].concat(rest);
    }
    cx(d) {
      const a = param(C().bend, d), fade = U.clamp(d / 120, 0, 1);   // départ en ligne droite
      return fade * (a * Math.sin(d / this.l[0] + this.p[0]) + a * 0.35 * Math.sin(d / this.l[1] + this.p[1]) - a * Math.sin(this.p[0]) - a * 0.35 * Math.sin(this.p[1]));
    }
    slope(d) { return (this.cx(d + 1) - this.cx(d - 1)) / 2; }
    half(d) { return param(C().width, d) / 2 * (1 + 0.12 * Math.sin(d / this.l[2] + this.p[2])); }
    zoneIndex(d) { return Math.max(0, Math.floor(Math.max(0, d) / C().zoneLen)); }
    zoneId(d) { return this.zoneOrder[this.zoneIndex(d) % this.zoneOrder.length]; }
    // ambiance d'une zone (tirée de la graine : même partie = mêmes ambiances)
    env(zi) {
      if (!this._env) this._env = {};
      if (!this._env[zi]) {
        const Z = ZONES[this.zoneOrder[zi % this.zoneOrder.length]], r = G.stream(this.seed, 'env' + zi);
        const id = Z.envs[Math.floor(r() * Z.envs.length)];
        this._env[zi] = G.Envs.get(id).make(r);
        this._env[zi].clouds = false;
      }
      return this._env[zi];
    }
    // repère local du couloir en d : position monde d'un point (lx en travers, y au-dessus du sol), cap des objets en travers
    at(d, lx, y) {
      const s = this.slope(d), n = Math.sqrt(1 + s * s);
      return [this.cx(d) + lx / n, y, -d + lx * s / n];
    }
    yawAcross(d) { return -Math.atan(this.slope(d)) * DEG; }
  }
  E.Track = Track;

  /* ---------- fiche de niveau du mode CLASSIQUE ---------- */
  E.level = function (seed) {
    const cfg = C(), T = new Track(seed);
    const L = {
      id: 'endless', name: 'CLASSIC', hud: 'C', mode: 'endless', endless: true, seed, fuel: cfg.fuelMax,
      killY: -30, lookAhead: 16, terminalRange: 20, fireDelay: 0.35, impactVariant: 'orange',
      launcher: { type: 'shoulder', pos: [0, 12, 40], yaw: 0, pitch: 0 },
      menuView: { center: [0, 18, -60], radius: 12, height: 10 },
      env: T.env(0), track: T,
      aaThreat: cfg.threat[0], aaSalvo: false, aaMaxAlive: cfg.maxMissiles[0],
      route: [[0, 12, 40], [0, cfg.cruise, 0]],
      build(b) {   // zone de départ (derrière d = 0) : plate-forme du lanceur, mur du fond ; le reste arrive par tronçons
        b.box({ p: [0, 10.4, 40], s: [6, 0.6, 6], mat: 'hazard' });
        b.box({ p: [0, 5, 40], s: [1.2, 10, 1.2], mat: 'metal', tint: '#8a9098' });
        b.box({ p: [0, 40, 64], s: [120, 80, 4], mat: { side: 'facadeDark', top: 'concreteDark' }, tint: '#c8ccd4' });   // fond derrière le lanceur
      },
    };
    return L;
  };

  /* ---------- tronçon ---------- */
  function buildChunk(game, T, k) {
    const cfg = C(), d0 = k * cfg.chunkLen, d1 = d0 + cfg.chunkLen;
    const r = G.stream(T.seed, 'chunk' + k);
    r.pick = (a) => a[Math.floor(r() * a.length)];
    const world = game.world, nBoxes = world.boxes.length;
    const pseudo = { seed: (T.seed ^ (k * 7919)) >>> 0, env: { sky: { stars: true } }, routes: [] };   // pas de nuages par tronçon
    const b = new CC.LevelBuilder(game.scene, world, pseudo);
    const gates = [];                                   // points de passage { d, lx, y } (pilote automatique)
    const busy = [];                                    // tranches de d déjà occupées (cibles, obstacles)
    const free = (d, m) => d > d0 + 8 && d < d1 - 8 && busy.every((q) => Math.abs(q - d) > m);

    // sol (bande large centrée sur le couloir) et parois en polyligne
    const midD = (d0 + d1) / 2, Zg = ZONES[T.zoneId(Math.max(0, midD))];
    b.box({ p: [T.cx(midD), -1, -midD], s: [260, 2, cfg.chunkLen + 2], mat: Zg.ground, tint: Zg.groundTint, ground: true });
    for (const side of [-1, 1]) {
      let d = d0;
      while (d < d1 - 0.01) {
        const Z = ZONES[T.zoneId(Math.max(0, d))];
        const len = Math.min(d1 - d, Z.city ? r.between([12, 24]) : r.between([18, 30]));
        const e = d + len;
        const ax = T.cx(d) + side * T.half(d), az = -d, bx = T.cx(e) + side * T.half(e), bz = -e;
        const dx = bx - ax, dz = bz - az, cl = Math.hypot(dx, dz), psi = Math.atan2(dx, dz);
        let ox = Math.cos(psi), oz = -Math.sin(psi);                 // axe x local de la boîte = normale de la corde
        if (ox * side < 0) { ox = -ox; oz = -oz; }                   // vers l'extérieur du couloir
        const depth = Z.city ? r.between([14, 22]) : 26, h = cfg.ceiling + (Z.city ? r.between([6, 46]) : r.between([10, 30]));
        const w = Z.wall(r);
        b.box({ p: [(ax + bx) / 2 + ox * depth / 2, h / 2 - 0.5, (az + bz) / 2 + oz * depth / 2], s: [depth, h, cl + 0.5], r: [0, psi * DEG, 0], mat: w.mat, tint: w.tint });
        d = e;
      }
    }

    // cibles en route : on les place d'abord (les obstacles s'écartent)
    const st = stageOf(d0);
    const nextT = (from) => from + r.between(cfg.targetGap);
    if (T.nextTarget === undefined) T.nextTarget = 90;
    while (T.nextTarget < d1) {
      const d = T.nextTarget;
      if (d >= d0 && free(d, 30)) {
        const half = T.half(d), lx = (r() < 0.5 ? -1 : 1) * r.between([0, half * 0.4]);
        const type = st === 0 ? 'fuel' : r.pick(['fuel', 'fuel', 'truck']);
        const p = T.at(d, lx, 0);
        b.target(type, p, T.yawAcross(d) + (type === 'truck' ? 90 : 0), { unarmed: true });
        busy.push(d);
        const hy = type === 'fuel' ? 3.5 : 1.6;
        gates.push({ d: d - 48, lx: lx * 0.6, y: 9 }, { d: d - 18, lx, y: hy + 2 }, { d, lx, y: hy }, { d: d + 26, lx: lx * 0.5, y: 9 });
      }
      T.nextTarget = nextT(d);
    }

    // obstacles
    const gap = param(cfg.gap, d0);
    if (T.nextObstacle === undefined) T.nextObstacle = 150;
    while (T.nextObstacle < d1) {
      const d = T.nextObstacle;
      let used = 0;
      if (d >= d0 && free(d, 60)) used = obstacle(b, T, r, d, stageOf(d), gates);   // loin des cibles : une chose à la fois
      if (used) busy.push(d, d + used);
      T.nextObstacle = d + Math.max(used, 0) + gap * r.between([0.75, 1.3]);
    }

    // chars ennemis (paliers MOYEN et plus) : au pied des parois, tournés vers la roquette qui arrive. Leur modèle est
    // détaillé (≈ 1,7 ms chacun) : ils sont créés un par image après le tronçon (Run.update), bien avant d'être visibles.
    const tanks = [], nT = cfg.tanks[st];
    for (let i = 0; i < nT; i++) {
      const d = d0 + cfg.chunkLen * (i + r.between([0.2, 0.8])) / nT;
      if (!free(d, 14)) continue;
      const side = r() < 0.5 ? -1 : 1, lx = side * (T.half(d) - 4);
      const p = T.at(d, lx, 0);
      tanks.push({ pos: p, yaw: 180 - side * 20 });
      busy.push(d);
    }

    b.finish();
    const boxes = world.boxes.slice(nBoxes);
    // route du pilote automatique : points de croisière tous les 20 m, sauf près des passages obligés
    gates.sort((a, c) => a.d - c.d);
    const pts = [];
    for (let d = d0; d < d1; d += 20) if (gates.every((g) => Math.abs(g.d - d) > 30)) pts.push({ d, lx: 0, y: cfg.cruise });
    // (uniquement les points de ce tronçon, dans l'ordre : la route ne doit jamais revenir en arrière)
    const route = k < 0 ? [] : pts.concat(gates.filter((g) => g.d >= d0 && g.d < d1)).sort((a, c) => a.d - c.d).map((g) => T.at(g.d, g.lx, g.y));
    for (const t of b.targets) t.updateObb();
    return { k, builder: b, boxes, targets: b.targets, entities: b.entities, route, tanks };
  }

  /* Un obstacle à la distance d. Retourne la longueur de couloir occupée (0 = rien posé). */
  function obstacle(b, T, r, d, st, gates) {
    const cfg = C(), Z = ZONES[T.zoneId(d)], half = T.half(d), W = 2 * half + 6, yaw = T.yawAcross(d);
    const mat = Z.obstacle, tint = Z.obstacleTint, top = cfg.ceiling + 30;
    const across = (lx, y, w, h, th, m, tn, kind) => b.box({ p: T.at(d, lx, y), s: [w, h, th || 3], r: [0, yaw, 0], mat: m || mat, tint: tn || tint, kind });
    const stripe = (lx, y, w) => b.box({ p: T.at(d, lx, y), s: [w, 0.25, 3.2], r: [0, yaw, 0], mat: 'hazard', collide: false, shadow: false });
    const gate = (lx, y) => gates.push({ d: d - 45, lx, y }, { d: d - 25, lx, y }, { d: d - 10, lx, y }, { d, lx, y }, { d: d + 12, lx, y });
    const weights = [
      { beamLow: 2, beamHigh: 2, pillar: 3, glass: 2, bridge: 2, hole: 1 },
      { beamLow: 2, beamHigh: 2, pillar: 2, glass: 1, bridge: 1.5, hole: 2, laser: 1.5, slalom: 1.5 },
      { beamLow: 1.5, beamHigh: 1.5, pillar: 1.5, bridge: 1, hole: 3, laser: 2, slalom: 2, window: 2 },
      { beamLow: 1, beamHigh: 1, pillar: 1, hole: 3.5, laser: 2, slalom: 2.5, window: 2.5 },
    ][st];
    const type = r.weighted(weights);
    (T.log || (T.log = [])).push({ d: Math.round(d), type, st });   // journal (banc de test, débogage)
    if (type === 'beamLow') {                            // barrière basse : passer au-dessus
      const hb = r.between([9, 16]);
      across(0, hb / 2, W, hb); stripe(0, hb + 0.13, W);
      gate(0, Math.min(cfg.ceiling - 8, hb + 9));
    } else if (type === 'beamHigh') {                    // poutre haute : passer dessous
      const hb = r.between([12, 20]);
      across(0, hb + (top - hb) / 2, W, top - hb); stripe(0, hb - 0.13, W);
      gate(0, Math.max(5, hb * 0.5));
    } else if (type === 'pillar') {                      // un côté fermé
      const s = r() < 0.5 ? -1 : 1;
      across(s * half / 2, top / 2, half + 4, top, 5);
      gate(-s * (half / 2 + 1), cfg.cruise);
    } else if (type === 'glass') {                       // vitre géante : on la traverse (elle ralentit un peu)
      const s = T.at(d, 0, 14);
      b.glass(s, [2 * half + 1, 28, 0.3], [0, yaw, 0]);
      gate(0, cfg.cruise);
    } else if (type === 'bridge') {                      // passerelle : dessus ou dessous
      const yb = r.between([16, 26]);
      across(0, yb, W, 2.4, 8, 'concreteDark', '#c8c4bc');
      for (const e of [-1, 1]) b.box({ p: T.at(d + e * 3.8, 0, yb + 1.8), s: [W, 1.2, 0.3], r: [0, yaw, 0], mat: 'metal', tint: '#8a9098' });
      gate(0, r() < 0.5 ? Math.max(5, yb - 8) : Math.min(cfg.ceiling - 8, yb + 8));
    } else if (type === 'laser') {                       // laser en travers : au-dessus ou au-dessous
      const yl = r.between([9, 24]);
      b.laser(T.at(d, -half - 1, yl), T.at(d, half + 1, yl));
      gate(0, yl > 16 ? yl - 7 : yl + 8);
    } else if (type === 'hole' || type === 'window') {  // mur percé d'un trou / fenêtre entre deux poutres
      const S = param(cfg.hole, d);
      const hw = type === 'window' ? 2 * half : S, hh = S;
      const hx = type === 'window' ? 0 : r.between([-(half - hw / 2 - 2), half - hw / 2 - 2]);
      const hy = r.between([hh / 2 + 4, cfg.ceiling - hh / 2 - 8]);
      const lEdge = hx - hw / 2, rEdge = hx + hw / 2;
      if (type === 'hole') {
        across((-half - 3 + lEdge) / 2, top / 2, lEdge + half + 3, top);
        across((rEdge + half + 3) / 2, top / 2, half + 3 - rEdge, top);
      }
      across(hx, (hy - hh / 2) / 2, hw + 0.2, hy - hh / 2);
      across(hx, (hy + hh / 2 + top) / 2, hw + 0.2, top - hy - hh / 2);
      stripe(hx, hy - hh / 2 - 0.13, hw); stripe(hx, hy + hh / 2 + 0.13, hw);
      gate(hx, hy);
    } else if (type === 'slalom') {                      // deux piliers alternés : gauche puis droite
      const s = r() < 0.5 ? -1 : 1, d2 = d + 45;
      across(s * half / 2, top / 2, half + 4, top, 5);
      const yaw2 = T.yawAcross(d2), h2 = T.half(d2);
      b.box({ p: T.at(d2, -s * h2 / 2, top / 2), s: [h2 + 4, top, 5], r: [0, yaw2, 0], mat, tint });
      gates.push({ d: d - 40, lx: -s * (half / 2 + 1), y: cfg.cruise }, { d: d - 20, lx: -s * (half / 2 + 1), y: cfg.cruise }, { d, lx: -s * (half / 2 + 1), y: cfg.cruise },
        { d: d + 22, lx: 0, y: cfg.cruise }, { d: d2, lx: s * (h2 / 2 + 1), y: cfg.cruise }, { d: d2 + 12, lx: s * (h2 / 2 + 1), y: cfg.cruise });
      return 45;
    }
    return 1;
  }

  function disposeChunk(game, c) {
    for (const t of c.targets) if (t.clearWreck) t.clearWreck(game);
    const tset = new Set(c.targets), eset = new Set(c.entities);
    game.targets = game.targets.filter((t) => !tset.has(t));
    game.entities = game.entities.filter((e) => !eset.has(e));
    game.world.removeBoxes(c.boxes);
    c.builder.dispose();
  }

  /* ---------- état d'une partie : tronçons, distance, paliers, zones, essence ---------- */
  class Run {
    constructor(game, level) {
      this.game = game; this.level = level; this.T = level.track;
      this.chunks = new Map();
      this.dist = 0; this.stage = 0; this.zone = 0;
      this.fuelGain = 0; this.fuelGainT = 0; this.altT = 0;
      this.envFrom = null; this.envT = 1;
      this.pending = [];                                // chars à créer (un par image)
      this.ensure(-1);
    }
    // construit les tronçons jusqu'à `ahead` devant la tête, détruit ceux trop loin derrière
    ensure(kHead) {
      const cfg = C(), g = this.game;
      for (let k = Math.max(-1, kHead - cfg.behind); k <= kHead + cfg.ahead; k++) {
        if (this.chunks.has(k)) continue;
        const c = buildChunk(g, this.T, k);
        this.chunks.set(k, c);
        g.targets.push(...c.targets); g.entities.push(...c.entities);
        this.level.route.push(...c.route);
        for (const t of c.tanks) this.pending.push({ c, t });
        if (g.autopilot) for (const p of c.route) g.autopilot.route.push(new V().fromArray(p));
      }
      for (const [k, c] of this.chunks) if (k < kHead - cfg.behind) { disposeChunk(g, c); this.chunks.delete(k); }
    }
    update(dt) {
      const g = this.game, rk = g.rocket, cfg = C();
      if (rk.active) this.dist = Math.max(this.dist, -rk.pos.z);
      this.ensure(Math.floor(this.dist / cfg.chunkLen));
      const job = this.pending.shift();
      if (job && this.chunks.get(job.c.k) === job.c) {
        const e = job.c.builder.guard('tank', job.t.pos, job.t.yaw, {});   // s'ajoute aux listes du tronçon
        g.targets.push(e); g.entities.push(e);
      }
      // palier de difficulté
      const st = stageOf(this.dist);
      if (st !== this.stage) {
        this.stage = st;
        const D = G.Difficulties.get(G.difficultyIds()[st]);
        g.centerMsg = 'STAGE ' + D.label; g.centerMsgT = 2.2;
        g.audio.play('popup', null, 1.5);
      }
      const L = this.level;
      L.aaThreat = param(cfg.threat, this.dist); L.aaSalvo = st >= 2; L.aaMaxAlive = cfg.maxMissiles[st];
      // zone de décor : l'ambiance glisse en 3 s vers celle de la nouvelle zone
      const zi = this.T.zoneIndex(this.dist);
      if (zi !== this.zone) { this.envFrom = this.T.env(this.zone); this.zone = zi; this.envT = 0; g.centerMsg = ZONES[this.T.zoneId(this.dist)].label; g.centerMsgT = 2; }
      if (this.envT < 1) {
        this.envT = Math.min(1, this.envT + dt / 3);
        L.env = lerpEnv(this.envFrom, this.T.env(this.zone), this.envT);
        g.applyEnvironment(L.env);
      }
      if (this.fuelGainT > 0) this.fuelGainT -= dt;
      // plafond : au-dessus, alarme puis explosion (le couloir est le terrain de jeu)
      if (rk.active && g.state === 'FLIGHT') {
        this.altT = rk.pos.y > cfg.ceiling ? this.altT + dt : 0;
        if (this.altT > cfg.ceilingGrace) { this.altT = 0; g.onRocketCrash('altitude', rk.pos.clone(), null); }
      } else this.altT = 0;
    }
    addFuel(s) {
      const rk = this.game.rocket;
      if (!rk.active || s <= 0) return;
      const before = rk.fuel;
      rk.fuel = Math.min(rk.fuelMax, rk.fuel + s);
      const got = rk.fuel - before;
      if (got > 0.05) { this.fuelGain = (this.fuelGainT > 0 ? this.fuelGain : 0) + got; this.fuelGainT = 1.4; }
    }
    stageLabel() { const D = G.Difficulties.get(G.difficultyIds()[this.stage]); return D; }
    dispose() { for (const c of this.chunks.values()) disposeChunk(this.game, c); this.chunks.clear(); }
  }
  E.Run = Run;

  // ---------- interpolation d'ambiance (couleurs, nombres ; le reste bascule à mi-chemin) ----------
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function lerpEnv(a, b, t) {
    const out = {};
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
      const x = a[k], y = b[k];
      if (x === undefined || y === undefined) out[k] = t < 0.5 && x !== undefined ? x : y;
      else if (typeof x === 'number' && typeof y === 'number') out[k] = x + (y - x) * t;
      else if (typeof x === 'string' && typeof y === 'string' && x[0] === '#' && y[0] === '#') out[k] = '#' + _ca.set(x).lerp(_cb.set(y), t).getHexString();
      else if (Array.isArray(x) && Array.isArray(y)) out[k] = x.map((v, i) => v + ((y[i] !== undefined ? y[i] : v) - v) * t);
      else if (x && y && typeof x === 'object' && typeof y === 'object') out[k] = lerpEnv(x, y, t);
      else out[k] = t < 0.5 ? x : y;
    }
    return out;
  }
  E.lerpEnv = lerpEnv;
})();
