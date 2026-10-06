/* Générateur de missions — chaîne complète.
 *   graine → profil → biome → ambiance → disposition → lanceur → cibles → zones → obstacles → décor
 *          → navigation (couloirs) → défenses → hélicoptères → routes finales → validation → score → carte
 * Une carte refusée (invalide, ou hors de la plage de difficulté) n'est jamais montrée : la graine est dérivée
 * (graine, essai 1, essai 2…) de façon déterministe, donc la même graine redonne toujours la même carte. */
(function () {
  const G = CC.Gen;

  class Plan {
    constructor(seed, diff) {
      this.seed = seed; this.difficulty = diff; this.version = G.VERSION;
      this.items = []; this.solids = []; this.roads = []; this.parcels = []; this.piers = [];
      this.targets = []; this.guards = []; this.helis = []; this.corridors = []; this.altCorridors = []; this.routes = [];
      this.issues = []; this.analysis = {}; this.timings = {};
      this.space = new G.Space(24);
    }
    add(it) {
      const def = G.Items.get(it.t);
      if (!def) throw new Error('type d\'objet inconnu : ' + it.t);
      if (it.yaw === undefined) it.yaw = 0;
      if (it.y0 === undefined) it.y0 = G.heightAt(this, it.x, it.z);
      it.id = this.items.length;
      this.items.push(it);
      for (const s of def.solids(it)) { s.item = it.id; this.solids.push(s); }
      return it;
    }
  }
  G.Plan = Plan;

  const MAX_ATTEMPTS = 10, RELAX_FROM = 5;                // à partir du 6e essai, carte « desserrée » (correction)

  /* Génère la carte d'une graine et d'une difficulté. opts : { biome (forcer une famille), keepNav (debug) } */
  G.generate = function (seed, diffId, opts) {
    opts = opts || {};
    seed = seed >>> 0;
    diffId = G.Difficulties.has(diffId) ? diffId : 'easy';
    const t0 = G.now();
    let best = null;
    const rejects = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const sub = attempt === 0 ? seed : G.mix(seed, 'retry' + attempt);
      let plan;
      try { plan = buildPlan(seed, sub, diffId, attempt, opts); } catch (e) {
        rejects.push({ attempt, reason: 'exception : ' + e.message });
        if (opts.throwErrors) throw e;
        continue;
      }
      if (plan.valid) { best = plan; break; }
      rejects.push(opts.debugRejects ? { attempt, reason: plan.rejectReason, plan } : { attempt, reason: plan.rejectReason });
      // meilleure carte « presque bonne » gardée en secours : jouable, score le plus proche de la plage
      if (plan.playable && (!best || plan.bandDist < best.bandDist)) best = plan;
    }
    if (!best) { const err = new Error('generation failed (seed ' + seed + ', ' + diffId + ') : ' + rejects.map((r) => r.reason).join(' | ')); err.rejects = rejects; throw err; }
    best.rejects = rejects;
    best.timings.total = G.round(G.now() - t0, 1);
    if (!opts.keepNav) best.nav = null;
    return best;
  };

  function buildPlan(seed, sub, diffId, attempt, opts) {
    const T = {}, tick = (k, t) => { T[k] = G.round(G.now() - t, 2); return G.now(); };
    let t = G.now();
    const plan = new Plan(seed, diffId);
    plan.attempt = attempt; plan.subSeed = sub;
    // biome et ambiance : tirés de la graine elle-même (pas de l'essai) — un nouvel essai garde la famille et l'ambiance
    const rb = G.stream(seed, 'biome');
    const biomeId = opts.biome && G.Biomes.has(opts.biome) ? opts.biome : rb.pick(G.Biomes.ids());
    plan.biome = G.Biomes.get(biomeId);
    plan.relax = attempt >= RELAX_FROM ? Math.min(1, (attempt - RELAX_FROM + 1) / 3) : 0;
    plan.profile = G.makeProfile(diffId, plan.biome, G.stream(sub, 'profile'), plan.relax);
    plan.env = G.pickEnv(plan.biome, G.makeProfile(diffId, plan.biome, G.stream(seed, 'profile')), G.stream(seed, 'env'));
    if (plan.biome.mix) {
      const mr = G.stream(sub, 'mix'), pool = mr.shuffle(plan.biome.mix.slice());
      plan.subBiomes = pool.slice(0, mr.int(2, 3)).map((id) => G.Biomes.get(id));
    }
    t = tick('profile', t);
    G.layout(plan, G.stream(sub, 'layout'));
    t = tick('layout', t);
    G.placeLauncher(plan, G.stream(sub, 'launcher'));
    G.placeTargets(plan, G.stream(sub, 'targets'));
    if (plan.targets.length < plan.profile.targetCount) return reject(plan, 'targets cannot be placed');
    t = tick('targets', t);
    fillZones(plan, G.stream(sub, 'zones'));
    t = tick('structures', t);
    G.placeObstacles(plan, G.stream(sub, 'obstacles'));
    t = tick('obstacles', t);
    G.placeDecor(plan, G.stream(sub, 'decor'));
    t = tick('decor', t);
    // --- navigation : couloirs d'approche de chaque cible ---
    const nav = new G.Nav(plan);
    plan.nav = nav;
    plan._index = new G.SolidIndex(plan.solids);           // vérifications exactes (manœuvres d'alignement)
    t = tick('navGrid', t);
    const L = plan.launcher.pos;
    plan.start = [L[0], L[1] + 1.5, L[2] - 22];
    for (const tg of plan.targets) {
      const path = nav.search(plan.start, tg.approach, { altRef: 40, avoid: approachSide(tg), maxExpand: 150000 });
      if (!path) return reject(plan, 'target ' + tg.i + ' inaccessible (' + tg.setup + ')');
      plan.corridors.push(leadIn(plan, nav, nav.smooth(path), tg));
    }
    // départ : le joueur oriente librement le lanceur ; la route part donc droit vers la suite de son premier couloir
    {
      const c0 = plan.corridors[0];
      let q = c0[c0.length - 1];
      for (const p of c0) if (Math.hypot(p[0] - L[0], p[2] - L[2]) > 60) { q = p; break; }
      const dx = q[0] - L[0], dy = q[1] - L[1], dz = q[2] - L[2], dl = Math.hypot(dx, dy, dz) || 1;
      const s2 = [G.round(L[0] + dx / dl * 22), G.round(L[1] + 1.5 + dy / dl * 22), G.round(L[2] + dz / dl * 22)];
      if (nav.freeAt(s2) && nav.clearSeg(L, s2)) plan.start = s2;
      plan.launcher.yaw = G.round(Math.atan2(-dx, -dz) * 180 / Math.PI, 1);
    }
    t = tick('corridors', t);
    G.placeDefenses(plan, nav, G.stream(sub, 'defenses'));
    G.placeHelis(plan, nav, G.stream(sub, 'helis'));
    t = tick('defenses', t);
    // --- routes finales : évitent le danger (pilote automatique = joueur prudent) ---
    const A = CC.CONFIG.aa, P = plan.profile;
    const range = A.range[0] + (A.range[1] - A.range[0]) * P.enemyReaction;
    const shooters = plan.guards.map((g) => ({ p: [g.pos[0], g.pos[1] + 3.5, g.pos[2]], w: g.type === 'sam' ? 1.5 : 1 }))
      .concat(plan.helis.map((h) => ({ p: h.pos, w: 1.1 })))
      .concat(plan.targets.filter((tg) => tg.type === 'tank' || tg.type === 'heli').map((tg) => ({ p: [tg.pos[0], tg.pos[1] + 3, tg.pos[2]], w: 0.8 })));
    nav.setShooters(shooters, range, A.minRange, plan.corridors);
    t = tick('danger', t);
    for (const tg of plan.targets) {
      const side = approachSide(tg);
      const path = nav.search(plan.start, tg.approach, { danger: 1.2, altRef: 40, avoid: side, eps: 3, maxExpand: 12000 });
      const main = path ? leadIn(plan, nav, nav.smooth(path), tg) : plan.corridors[tg.i];
      // second couloir, éloigné du premier : le joueur a-t-il un vrai choix ?
      // pénalité précalculée par colonne de la grille (distance au premier couloir < 30 m)
      const pen = new Float32Array(nav.nx * nav.nz);
      for (let i = 0; i < main.length - 1; i++) {
        const a = main[i], b = main[i + 1];
        const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - 30 - nav.x0) / nav.cs)), i1 = Math.min(nav.nx - 1, Math.floor((Math.max(a[0], b[0]) + 30 - nav.x0) / nav.cs));
        const k0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - 30 - nav.z0) / nav.cs)), k1 = Math.min(nav.nz - 1, Math.floor((Math.max(a[2], b[2]) + 30 - nav.z0) / nav.cs));
        for (let k = k0; k <= k1; k++) for (let j = i0; j <= i1; j++) {
          const d = G.segDist(nav.cx(j), nav.cz(k), [a[0], a[2]], [b[0], b[2]]);
          if (d < 30) pen[k * nav.nx + j] = Math.max(pen[k * nav.nx + j], (30 - d) * 0.05);
        }
      }
      const avoid = (x, z) => pen[Math.floor((z - nav.z0) / nav.cs) * nav.nx + Math.floor((x - nav.x0) / nav.cs)] + side(x, z);
      const alt = nav.search(plan.start, tg.approach, { avoid, altRef: 40, eps: 2.2, maxExpand: 6000 });
      plan.altCorridors.push(alt ? nav.smooth(alt) : null);
      plan.routes.push(buildRoute(plan, main, tg));
    }
    t = tick('routes', t);
    // pilote automatique : rétro-fusées brèves avant les virages très serrés (comme un joueur qui freine)
    plan.routeActions = plan.routes.map((rt) => {
      const acts = [];
      for (let i = 2; i < rt.length - 1; i++) if (G.maxTurnRate(rt.slice(i - 2, i + 2), 60) > 3.4) acts.push({ from: Math.max(1, i - 2), to: i, retro: true, hold: 0.3 });
      return acts;
    });
    // --- essence et temps de référence ---
    const lens = plan.routes.map((rt) => G.polyLen(rt));
    const longest = Math.max(...lens);
    plan.fuel = Math.min(CC.CONFIG.rocket.fuelBarMax, Math.max(9, Math.ceil(((longest / 62) - CC.CONFIG.rocket.freeBoost) * P.fuelMargin + 1)));
    plan.parTime = G.round(lens.reduce((a, b) => a + b, 0) / 58 + 2.5 * (lens.length - 1) + 2, 1);
    G.validate(plan, nav);
    t = tick('validate', t);
    G.scoreMap(plan, nav);
    t = tick('score', t);
    plan.timings = T;
    plan.stats = G.planStats(plan);
    const fatal = plan.issues.filter((i) => i.fatal);
    plan.playable = fatal.length === 0;
    const band = G.Difficulties.get(diffId).scoreBand, sc = plan.score.difficultyScore;
    plan.bandDist = sc < band[0] ? band[0] - sc : sc > band[1] ? sc - band[1] : 0;
    if (plan.analysis.turnOver) plan.bandDist += 5;       // virage plus serré que le profil ne l'autorise
    plan.valid = plan.playable && plan.bandDist === 0;
    if (!plan.playable) plan.rejectReason = fatal.map((i) => i.msg).join(' ; ');
    else if (!plan.valid) plan.rejectReason = plan.analysis.turnOver ? 'virage hors profil (' + plan.analysis.maxTurnRate + ' rad/s)' : 'score ' + sc + ' hors plage [' + band + ']';
    // nettoyage : références internes inutiles une fois la carte faite
    for (const tg of plan.targets) delete tg.parcel;
    return plan;
  }
  /* Arrondi des coins : chaque coin de la route devient un arc de cercle tangent aux deux segments, au rayon permis par
   * la difficulté (ou au plus grand rayon qui tient entre les coins voisins, jamais sous 15 m), s'il est dégagé.
   * Le dernier tronçon (porte → entrée → cible) et le tir ne sont pas arrondis. */
  function fillet(plan, pts, R, lastFree) {
    const idx = plan._index, nav = plan.nav, clr = Math.min(2, plan.profile.clearance);
    const clear = (a, b) => nav.clearSeg(a, b) || (!idx.segHit(a, b, clr) && G.terrainClear(plan, a, b, clr));
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (v) => Math.hypot(v[0], v[1], v[2]);
    const nrm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const angleAt = (i) => {
      if (i <= 0 || i >= pts.length - 1) return 0;
      const u = nrm(sub(pts[i], pts[i - 1])), w = nrm(sub(pts[i + 1], pts[i]));
      return Math.acos(G.clamp(u[0] * w[0] + u[1] * w[1] + u[2] * w[2], -1, 1));
    };
    const out = [pts[0], pts[1]];
    for (let i = 2; i < pts.length - 1; i++) {
      const p = pts[i], th = angleAt(i);
      if (th < 0.06 || i > lastFree) { out.push(p); continue; }
      const prev = out[out.length - 1], u = nrm(sub(p, prev)), w = nrm(sub(pts[i + 1], p));
      const lu = len(sub(p, prev)), lw = len(sub(pts[i + 1], p));
      const share = angleAt(i + 1) > 0.06 ? 0.5 : 0.95;
      const lAvail = Math.min(lu * 0.95, lw * share);
      let r = R, l = r * Math.tan(th / 2);
      if (l > lAvail) { r = lAvail / Math.tan(th / 2); l = lAvail; }
      if (r < 15) { out.push(p); continue; }
      const A = [p[0] - u[0] * l, p[1] - u[1] * l, p[2] - u[2] * l], Bp = [p[0] + w[0] * l, p[1] + w[1] * l, p[2] + w[2] * l];
      const bis = nrm([w[0] - u[0], w[1] - u[1], w[2] - u[2]]), dC = r / Math.cos(th / 2);
      const C = [p[0] + bis[0] * dC, p[1] + bis[1] * dC, p[2] + bis[2] * dC];
      const va = sub(A, C), vb = sub(Bp, C), n = Math.max(2, Math.ceil(th / 0.3));
      const arc = [];
      for (let k = 0; k <= n; k++) {                         // interpolation sphérique entre CA et CB
        const t = k / n, s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th);
        arc.push([C[0] + va[0] * s0 + vb[0] * s1, C[1] + va[1] * s0 + vb[1] * s1, C[2] + va[2] * s0 + vb[2] * s1]);
      }
      let ok = clear(prev, arc[0]);
      for (let k = 1; k <= n && ok; k++) ok = clear(arc[k - 1], arc[k]);
      if (!ok) { out.push(p); continue; }
      for (const q of arc) out.push(q.map((v) => G.round(v)));
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* Pénalité d'approche : l'arrivée sur la porte doit se faire du bon côté (celui de l'ouverture), sinon il faudrait un
   * demi-tour sur place. Les cellules situées derrière la cible (côté opposé à l'ouverture), près d'elle, coûtent cher :
   * le couloir contourne largement et s'aligne. */
  function approachSide(tg) {
    const dx = tg.dir[0], dz = tg.dir[1], px = tg.pos[0], pz = tg.pos[2];
    const lane = G.dist3(tg.approach, tg.pos), reach = lane + 50;
    return (x, z) => {
      const rx = x - px, rz = z - pz, d = Math.hypot(rx, rz);
      if (d > reach) return 0;
      const along = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);   // along > 0 : devant l'ouverture
      if (along > lane - 5 || lat < 7) return 0;                       // au-delà du point d'alignement, ou dans l'allée
      return 2.2 * (1 - d / reach);
    };
  }
  /* Manœuvre d'alignement (« goutte d'eau ») : si le couloir arrive sur le but d'approche trop de travers, sa fin est
   * remplacée par une tangente puis un arc de cercle au rayon de virage de la difficulté (60 m/s ÷ taux permis), qui
   * aboutit au but dans l'axe de la porte. Côté du cercle : le plus court des deux qui reste dégagé. */
  function leadIn(plan, nav, cor, tg) {
    const R = 60 / plan.profile.maxTurnRate, Q = tg.approach;
    const a = [-tg.dir[0], -tg.dir[1]];                            // cap final (vers la cible)
    if (cor.length < 2) return cor;
    // point de départ de la manœuvre : dernier sommet à plus de 2,2 R du but (horizontalement)
    let k = cor.length - 2;
    while (k > 0 && Math.hypot(cor[k][0] - Q[0], cor[k][2] - Q[2]) < 2.2 * R) k--;
    const P = cor[k];
    const u = [Q[0] - cor[cor.length - 2][0], Q[2] - cor[cor.length - 2][2]], lu = Math.hypot(u[0], u[1]);
    if (lu > 1 && (u[0] * a[0] + u[1] * a[1]) / lu > Math.cos(0.5)) return cor;   // déjà presque dans l'axe
    let best = null;
    const dbg = [];
    for (const boost of [0, 12, 28]) for (const side of [1, -1]) {
      if (best) break;
      const C = [Q[0] + side * a[1] * R, Q[2] - side * a[0] * R];     // centre du cercle tangent à l'axe en Q
      // sens de parcours tel que le cap en Q soit a
      const tq = Math.atan2(Q[2] - C[1], Q[0] - C[0]), sgn = (-Math.sin(tq) * a[0] + Math.cos(tq) * a[1]) > 0 ? 1 : -1;
      const dx = P[0] - C[0], dz = P[2] - C[1], d = Math.hypot(dx, dz);
      if (d < R * 1.05) { dbg.push('inside'); continue; }
      const phi = Math.atan2(dz, dx), al = Math.acos(R / d);
      let T = null, tt = 0;
      for (const cand of [phi + al, phi - al]) {
        const X = [C[0] + Math.cos(cand) * R, C[1] + Math.sin(cand) * R];
        const h = [-Math.sin(cand) * sgn, Math.cos(cand) * sgn], v = [X[0] - P[0], X[1] - P[2]], lv = Math.hypot(v[0], v[1]);
        if ((h[0] * v[0] + h[1] * v[1]) / lv > 0.98) { T = X; tt = cand; }
      }
      if (!T) { dbg.push('noT'); continue; }
      let dth = sgn > 0 ? tq - tt : tt - tq;
      while (dth < 0) dth += Math.PI * 2;
      const n = Math.max(1, Math.ceil(dth / 0.45)), L0 = Math.hypot(T[0] - P[0], T[1] - P[2]), total = L0 + dth * R;
      const pts = [];
      // altitude de l'arc : constante, au-dessus de tout ce qu'il survole (+ marge), relevée d'un cran à chaque essai
      const clr = plan.profile.clearance + nav.cs + 2;
      const arc = [];
      for (let i = 0; i < n; i++) { const th = tt + sgn * dth * i / n; arc.push([C[0] + Math.cos(th) * R, C[1] + Math.sin(th) * R]); }
      let y = Math.max(P[1], Q[1]);
      for (const [x, z] of arc) y = Math.max(y, nav.topAt(x, z) + clr);
      y += boost;
      for (const [x, z] of arc) pts.push([x, y, z]);
      pts.push([Q[0], Math.max(Q[1], y), Q[2]]);            // le point d'alignement est pris à l'altitude de l'arc ; l'allée descend ensuite
      let ok = true, prev = P;
      const exactR = Math.min(2, plan.profile.clearance);
      for (const q of pts) {
        if (!nav.clearSeg(prev, q) && (plan._index.segHit(prev, q, exactR) || !G.terrainClear(plan, prev, q, exactR))) { ok = false; dbg.push('blocked@' + q.map(Math.round)); break; }
        prev = q;
      }
      if (ok && (!best || total < best.total)) best = { total, pts };
    }
    if (G.debugLeadIn) G.debugLeadIn(tg, P, Q, R, best, dbg);
    if (!best) return cor;
    return cor.slice(0, k + 1).concat(best.pts.map((q) => q.map((v) => G.round(v))));
  }

  function reject(plan, msg) {
    plan.issues.push({ layer: 'gameplay', msg, fatal: true });
    plan.valid = false; plan.playable = false; plan.rejectReason = msg; plan.score = { difficultyScore: -1 }; plan.bandDist = 1e9;
    return plan;
  }

  /* Route du pilote automatique : lanceur → couloir → porte → entrée → cible (vérifiée exactement à la validation). */
  function buildRoute(plan, corridor, tg) {
    const L = plan.launcher.pos;
    // chaque tir est visé à part : le départ de cette route pointe vers la suite de son propre couloir
    let q = corridor[corridor.length - 1];
    for (const p of corridor) if (Math.hypot(p[0] - L[0], p[2] - L[2]) > 60) { q = p; break; }
    const dx = q[0] - L[0], dy = q[1] - L[1], dz = q[2] - L[2], dl = Math.hypot(dx, dy, dz) || 1;
    let start = [G.round(L[0] + dx / dl * 22), G.round(L[1] + 1.5 + dy / dl * 22), G.round(L[2] + dz / dl * 22)];
    if (!(plan.nav.freeAt(start) && plan.nav.clearSeg(L, start))) start = plan.start;
    const pts = [L.slice(), start];
    // couloir (départ et but exacts), puis porte, entrée, cible
    const A = tg.approach, end = corridor[corridor.length - 1];
    const app = Math.hypot(end[0] - A[0], end[2] - A[2]) < 1 && end[1] > A[1] ? end : A;   // alignement relevé par la manœuvre
    for (let i = 1; i < corridor.length - 1; i++) {
      const p = corridor[i];
      if (G.dist3(p, start) < 8 || Math.hypot(p[0] - L[0], p[2] - L[2]) < 30 || G.dist3(p, app) < 8) continue;
      pts.push(p.slice());
    }
    pts.push(app.slice(), tg.navGoal.slice(), tg.gate.slice());
    for (const e of tg.entry) pts.push(e.slice());
    pts.push(tg.pos.slice());
    const rounded = fillet(plan, pts, 60 / plan.profile.maxTurnRate, pts.length - 3 - tg.entry.length);
    // découpe des longs segments (le pilote automatique suit mieux des points rapprochés)
    const out = [rounded[0]];
    pts.length = 0; for (const p of rounded) pts.push(p);
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i], len = G.dist3(a, b);
      if (len < 2) continue;
      const n = Math.ceil(len / 40);
      for (let k = 1; k <= n; k++) out.push([G.round(G.lerp(a[0], b[0], k / n)), G.round(G.lerp(a[1], b[1], k / n)), G.round(G.lerp(a[2], b[2], k / n))]);
    }
    return out;
  }

  /* Remplissage des parcelles par les gabarits du biome (ville mixte : sous-biome selon la profondeur). */
  function fillZones(plan, r) {
    const P = plan.profile;
    for (const pc of plan.parcels) {
      let B = plan.biome;
      if (plan.subBiomes) { const k = Math.min(plan.subBiomes.length - 1, Math.floor(G.clamp(pc.depth, 0, 0.999) * plan.subBiomes.length)); B = plan.subBiomes[k]; }
      pc.biome = B;
      let zones = B.zones || B.clusters;
      if (pc.field) zones = { fields: 1 };
      else if (pc.pier) zones = { craneQuay: 2, containerYard: 1 };
      else if (pc.quay) zones = { craneQuay: 2, warehouseQuay: 2, containerYard: 1 };
      // espaces ouverts plus fréquents quand le profil laisse de la place (FACILE : grandes zones ouvertes)
      const openZones = ['plaza', 'park', 'lot', 'training', 'fields', 'rockOutcrop'];
      const w = {};
      for (const [id, v] of Object.entries(zones)) {
        const Tm = G.Templates.get(id);
        if (!Tm || !Tm.fits(pc)) continue;
        w[id] = v * (openZones.includes(id) ? 0.4 + 2.2 * P.availableSpace : 1);
      }
      if (pc.outer && B.edge && G.Templates.get(B.edge).fits(pc)) w[B.edge] = (w[B.edge] || 0) + 2;
      if (B.layout === 'grid' && !pc.pier && !pc.quay && r.chance(0.12 * P.availableSpace)) { for (const k of Object.keys(w)) if (!openZones.includes(k)) delete w[k]; if (!Object.keys(w).length) w.lot = 1; }
      if (!Object.keys(w).length) continue;
      const id = r.weighted(w);
      pc.zone = id;
      G.Templates.get(id).fill(plan, pc, r);
    }
  }

  /* Statistiques simples de la carte (debug, tests de diversité). */
  G.planStats = function (plan) {
    const c = {};
    for (const it of plan.items) c[it.t] = (c[it.t] || 0) + 1;
    return {
      items: plan.items.length, solids: plan.solids.length, buildings: (c.bld || 0) + (c.hangar || 0) + (c.skeleton || 0), trees: c.tree || 0,
      obstacles: plan.items.filter((it) => G.Items.get(it.t).layer === 'obstacle').length,
      tanks: plan.guards.filter((g) => g.type === 'tank').length, sams: plan.guards.filter((g) => g.type === 'sam').length,
      helis: plan.helis.length, targets: plan.targets.length, roads: plan.roads.length, parcels: plan.parcels.length, counts: c,
    };
  };
})();
