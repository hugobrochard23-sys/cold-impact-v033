/* Générateur de missions — validation, réparation, score de carte, signature (diversité).
 *
 * Validation (après génération, avant tout affichage) :
 *  - géométrie : structures qui se chevauchent, objets hors carte, véhicules (cibles, tanks) coincés dans une structure
 *    ou posés sur une pente, objets flottants ou enterrés ;
 *  - jeu : départ libre (œil du lanceur hors de tout obstacle, vue dégagée), chaque cible atteignable (couloir A*,
 *    puis vérification EXACTE de chaque segment de route contre les boîtes de collision avec la taille du missile),
 *    virages faisables, essence suffisante, tireurs pas trop près du lanceur, hélicoptères dégagés ;
 *  - cohérence : réseau routier connexe, cibles posées sur le sol, obstacles laissant un passage ;
 *  - lisibilité : aucun décor collé à la cible, cible visible depuis sa porte d'approche.
 * Les défauts mineurs sont réparés (objet retiré) ; un défaut grave rejette la carte (nouvel essai déterministe). */
(function () {
  const G = CC.Gen;
  const ROCKET_R = 0.55;                   // rayon de vérification exacte des routes (roquette 0,22 m + marge)

  G.validate = function (plan, nav) {
    const issues = plan.issues, P = plan.profile, bd = plan.bounds, L = plan.launcher.pos;
    const fatal = (layer, msg) => issues.push({ layer, msg, fatal: true });
    const warn = (layer, msg, fixed) => issues.push({ layer, msg, fixed: !!fixed });
    const idx = new G.SolidIndex(plan.solids);
    plan._index = idx;

    // ---------- géométrie ----------
    // chevauchement de structures (hors pièces d'une même mise en situation) : réparé en retirant la plus récente
    const structs = plan.items.filter((it) => { const d = G.Items.get(it.t); return d.layer === 'structure' && !it.launcher; });
    const sp = new G.Space(24);
    let removed = 0;
    for (const it of structs) {
      const o = G.Items.get(it.t).foot(it);
      const hit = sp.hit(o, -0.3);
      if (hit && !(it.setup && hit.ref.setup)) { removeItem(plan, it); removed++; continue; }
      sp.add(o, 'bld', it);
    }
    if (removed) warn('geometry', removed + ' overlapping structure(s) removed', true);
    // hors carte (marge : le décor peut déborder pour cadrer l'horizon)
    for (const it of plan.items) {
      if (it.removed) continue;
      const m = G.Items.get(it.t).layer === 'decor' ? 260 : 40;
      if (it.x < bd.x0 - m || it.x > bd.x1 + m || it.z < bd.z0 - m || it.z > bd.z1 + m) { removeItem(plan, it); warn('geometry', it.t + ' off the map, removed', true); }
    }
    // objets posés : ni flottants ni enfouis (structures au sol)
    for (const it of plan.items) {
      if (it.removed || it.x === undefined) continue;
      const d = G.Items.get(it.t);
      if (d.layer === 'obstacle' || it.t === 'cable' || it.t === 'laser') continue;
      const gr = G.groundRange(plan, d.foot(it));
      if (it.y0 > gr[0] + 0.6 && it.t !== 'tree' && it.t !== 'rock') { it.y0 = gr[0]; warn('consistency', it.t + ' put back on the ground', true); }
    }
    if (plan.items.some((it) => it.removed)) rebuildSolids(plan), plan._index = new G.SolidIndex(plan.solids);
    const index = plan._index;

    // véhicules (cibles, tanks, lance-missiles) : ni dans une structure, ni sur une pente
    const vehicles = plan.targets.filter((t) => !G.TargetKinds.get(t.kind).air).map((t) => ({ p: t.pos, s: G.TargetKinds.get(t.kind).size, what: 'target ' + t.i }))
      .concat(plan.guards.map((g) => ({ p: g.pos, s: [3.9, 2.9, 6.2], what: g.type })));
    for (const v of vehicles) {
      const rad = Math.max(v.s[0], v.s[2]) / 2 - 0.4;
      const d = index.dist(v.p[0], v.p[1] + v.s[1] / 2, v.p[2], rad + 1, (s) => s.kind === 'cable' || s.kind === 'hazard');
      if (d < rad * 0.55) fatal('geometry', v.what + ' stuck in a structure');
      const gr = G.groundRange(plan, G.obb(v.p[0], v.p[2], v.s[0], v.s[2], 0));
      if (gr[1] - gr[0] > 2) fatal('geometry', v.what + ' on a slope');
    }

    // ---------- jeu ----------
    // départ : œil du lanceur et 25 premiers mètres libres
    if (index.dist(L[0], L[1], L[2], 1.2) < 1.0) fatal('gameplay', 'launcher inside an obstacle');
    if (index.segHit(L, plan.start, 1.0)) fatal('gameplay', 'start blocked in front of the launcher');
    // tireurs trop près du lanceur (tir dès la sortie du tube)
    for (const g of plan.guards) if (Math.hypot(g.pos[0] - L[0], g.pos[2] - L[2]) < 140) fatal('gameplay', g.type + ' too close to the launcher');
    // routes : vérification exacte segment par segment (les cassables se traversent)
    plan.analysis.routeHits = 0;
    plan.routes.forEach((rt, k) => {
      const tg = plan.targets[k];
      for (let i = 1; i < rt.length; i++) {
        const last = i === rt.length - 1;
        const hit = index.segHit(rt[i - 1], rt[i], last ? 0.35 : ROCKET_R);
        // relief : hors de la dernière plongée (la cible est au sol), la route reste au-dessus du terrain avec la marge
        if (!hit && i < rt.length - 2 && !G.terrainClear(plan, rt[i - 1], rt[i], 1.2)) { fatal('gameplay', 'route to target ' + k + ' inside the terrain (segment ' + i + ')'); break; }
        if (hit) {
          // réparation : un petit objet (décor) sur la trajectoire est retiré ; une structure → carte rejetée
          const it = plan.items[hit.item];
          if (it && G.Items.get(it.t).layer === 'decor') { removeItem(plan, it); plan.analysis.routeHits++; continue; }
          fatal('gameplay', 'route to target ' + k + ' blocked by ' + (it ? it.t : hit.kind) + ' (segment ' + i + ')');
          break;
        }
      }
      // la cible est-elle visible depuis sa porte ? (lisibilité : on doit voir ce qu'on vise en arrivant)
      const lastApproach = tg.entry.length ? tg.entry[tg.entry.length - 1] : tg.gate;
      if (index.segHit(lastApproach, tg.pos, 0.1, (s) => G.passable(s))) fatal('readability', 'target ' + k + ' hidden from its entrance');
    });
    if (plan.items.some((it) => it.removed)) { rebuildSolids(plan); plan._index = new G.SolidIndex(plan.solids); }
    // virages : taux de virage demandé à 60 m/s pour chaque coin de route
    let worst = 0;
    for (const rt of plan.routes) worst = Math.max(worst, G.maxTurnRate(rt.slice(1), 60));   // sans le tir (visée libre au lanceur)
    plan.analysis.maxTurnRate = G.round(worst, 2);
    // La roquette tourne jusqu'à 5 rad/s (rayon 12 m à 60 m/s) ; en freinant (rétro-fusées, ≈ 30 m/s) elle prend un virage
    // de rayon 7 m. Au-delà (8,5 rad/s ramenés à 60 m/s) le virage est infaisable → rejet ; au-delà du profil de la
    // difficulté (×1,5 : FACILE 1,8 · MOYEN 2,6 · DIFFICILE 3,6 · IMPOSSIBLE 5 rad/s) → hors difficulté, nouvel essai.
    if (worst > 8.5) fatal('gameplay', 'turn too tight (' + worst.toFixed(2) + ' rad/s)');
    else if (worst > P.maxTurnRate * 1.5) warn('difficulty', 'turn tighter than the profile (' + worst.toFixed(2) + ' rad/s)');
    plan.analysis.turnOver = worst > P.maxTurnRate * 1.5;
    // essence : la plus longue route doit tenir dans le réservoir avec la marge du profil
    const need = Math.max(...plan.routes.map((rt) => G.polyLen(rt))) / 62;
    if (need > plan.fuel + CC.CONFIG.rocket.freeBoost) fatal('gameplay', 'essence insuffisante');
    // décor collé à la cible (lisibilité)
    for (const tg of plan.targets) {
      for (const it of plan.items) {
        if (it.removed || G.Items.get(it.t).layer !== 'decor' || it.x === undefined) continue;
        if (Math.hypot(it.x - tg.pos[0], it.z - tg.pos[2]) < 7) { removeItem(plan, it); warn('readability', it.t + ' removed near target ' + tg.i, true); }
      }
    }
    // ---------- cohérence ----------
    if (!roadsConnected(plan)) fatal('consistency', 'road network cut');
    if (plan.items.some((it) => it.removed)) { rebuildSolids(plan); plan._index = new G.SolidIndex(plan.solids); }
    plan.items = plan.items.filter((it) => !it.removed);
    plan.items.forEach((it, i) => { it.id = i; });
    rebuildSolids(plan);
  };

  function removeItem(plan, it) { it.removed = true; }
  function rebuildSolids(plan) {
    plan.solids = [];
    for (const it of plan.items) {
      if (it.removed) continue;
      for (const s of G.Items.get(it.t).solids(it)) { s.item = it.id; plan.solids.push(s); }
    }
  }

  // Réseau routier connexe : deux routes sont reliées si leurs rectangles se touchent
  function roadsConnected(plan) {
    const R = plan.roads;
    if (R.length < 2) return true;
    const seen = new Set([0]), stack = [0];
    while (stack.length) {
      const i = stack.pop();
      for (let j = 0; j < R.length; j++) if (!seen.has(j) && G.obbOverlap(R[i].obb, R[j].obb, 1.5)) { seen.add(j); stack.push(j); }
    }
    return seen.size === R.length;
  }

  // Taux de virage (rad/s) demandé par une polyligne à vitesse v : angle du coin / temps disponible pour tourner
  G.maxTurnRate = (route, v) => {
    // rééchantillonnage tous les 4 m, puis changement de cap sur une fenêtre de ±20 m : seuls les vrais virages comptent
    // (les petits zigzags de la grille, quelques mètres, sont absorbés par la marge de passage)
    const ds = 4, P = [route[0]];
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], L = G.dist3(a, b), n = Math.max(1, Math.round(L / ds));
      for (let k = 1; k <= n; k++) P.push([G.lerp(a[0], b[0], k / n), G.lerp(a[1], b[1], k / n), G.lerp(a[2], b[2], k / n)]);
    }
    const k = 5;
    let worst = 0;
    for (let i = k; i < P.length - k; i++) {
      const a = P[i - k], b = P[i], c = P[i + k];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      const lu = Math.hypot(...u), lw = Math.hypot(...w);
      if (lu < 1 || lw < 1) continue;
      const ang = Math.acos(G.clamp((u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw), -1, 1));
      worst = Math.max(worst, v * ang / ((lu + lw) / 2));
    }
    return worst;
  };

  // ---------------------------------------------------------------- score de carte
  /* mapScore : chaque composante est ramenée entre 0 et 1, puis combinée en difficultyScore (0-100).
   * Il sert à vérifier qu'une carte FACILE ressemble à une carte FACILE (plage de score par difficulté). */
  G.scoreMap = function (plan, nav) {
    const P = plan.profile, idx = new G.SolidIndex(plan.solids);
    // échantillons le long des routes (tous les 5 m)
    let n = 0, narrow = 0, clearSum = 0, exposure = 0, lenSum = 0, turnSum = 0, climb = 0;
    const range = CC.CONFIG.aa.range[0] + (CC.CONFIG.aa.range[1] - CC.CONFIG.aa.range[0]) * P.enemyReaction;
    for (const rt of plan.routes) {
      lenSum += G.polyLen(rt);
      for (let i = 1; i < rt.length; i++) {
        const a = rt[i - 1], b = rt[i], L = G.dist3(a, b);
        climb += Math.abs(b[1] - a[1]);
        if (i < rt.length - 1) {
          const c = rt[i + 1], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
          const lu = Math.hypot(...u), lw = Math.hypot(...w);
          if (lu > 0.5 && lw > 0.5) turnSum += Math.acos(G.clamp((u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw), -1, 1));
        }
        for (let s = 0; s < L; s += 5) {
          const k = s / L, p = [G.lerp(a[0], b[0], k), G.lerp(a[1], b[1], k), G.lerp(a[2], b[2], k)];
          const d = idx.dist(p[0], p[1], p[2], 20);
          clearSum += d; n++;
          if (d < 6) narrow++;
          if (nav) exposure += nav.dangerAtPoint(p) * 5 / 62;           // tireurs × secondes d'exposition
        }
      }
    }
    const nr = plan.routes.length || 1;
    // ouverture : part des cellules libres entre 0 et 25 m d'altitude dans les limites de la carte
    let free = 0, tot = 0;
    if (nav) {
      const bd = plan.bounds;
      for (let iz = 0; iz < nav.nz; iz += 2) for (let ix = 0; ix < nav.nx; ix += 2) {
        const x = nav.cx(ix), z = nav.cz(iz);
        if (x < bd.x0 || x > bd.x1 || z < bd.z0 || z > bd.z1) continue;
        for (let iy = 0; iy < nav.ny && nav.cy(iy) < 25; iy++) { tot++; if (!(nav.occ[nav.idx(ix, iy, iz)] & 1)) free++; }
      }
    }
    const area = ((plan.bounds.x1 - plan.bounds.x0) * (plan.bounds.z1 - plan.bounds.z0)) / 10000;
    const st = G.planStats(plan);
    const obstNear = plan.items.filter((it) => G.Items.get(it.t).layer === 'obstacle').length;
    const armedHelis = plan.helis.filter((h) => h.patrol).length;
    const shooters = plan.guards.reduce((a, g) => a + (g.type === 'sam' ? 1.5 : 1), 0) + plan.helis.length * 1.2 + plan.targets.filter((t) => t.type === 'tank' || t.type === 'heli').length * 0.6;
    const enclosed = plan.targets.filter((t) => t.enclosed).length / Math.max(1, plan.targets.length);
    const c01 = (v) => G.clamp(v, 0, 1);
    const S = {
      openness: G.round(tot ? free / tot : 1, 3),
      obstacleComplexity: G.round(c01((narrow / Math.max(1, n)) * 2.2 + obstNear / 40 + (1 - Math.min(1, (clearSum / Math.max(1, n)) / 18)) * 0.4), 3),
      traversalComplexity: G.round(c01((lenSum / nr) / 1300 * 0.45 + (turnSum / nr) / 9 * 0.25 + enclosed * 0.3 + Math.min(1, (plan.analysis.maxTurnRate || 0) / 3) * 0.15), 3),
      combatComplexity: G.round(c01(shooters / 26 + armedHelis * 0.04 + (P.salvo ? 0.08 : 0)), 3),
      enemyPressure: G.round(c01((exposure / nr) / 42 * (0.5 + 0.5 * P.enemyReaction) + P.enemyReaction * 0.18), 3),
      visualComplexity: G.round(c01((st.buildings + st.trees * 0.2 + st.items * 0.03) / area / 3), 3),
      fuelTightness: G.round(c01((2.1 - P.fuelMargin) / 1.0), 3),
    };
    S.difficultyScore = Math.round(100 * (0.2 * S.enemyPressure + 0.2 * S.combatComplexity + 0.18 * S.traversalComplexity + 0.16 * S.obstacleComplexity + 0.1 * (1 - S.openness) + 0.16 * S.fuelTightness));
    S.exposure = G.round(exposure / nr, 2); S.avgClearance = G.round(clearSum / Math.max(1, n), 2); S.narrowFraction = G.round(narrow / Math.max(1, n), 3);
    S.routeLength = Math.round(lenSum / nr);
    // couloirs distincts : le second couloir s'écarte-t-il vraiment du premier ?
    let distinct = 0;
    plan.altCorridors.forEach((alt, k) => {
      if (!alt) return;
      const main = plan.routes[k];
      let far = 0, cnt = 0;
      for (const p of G.densify(alt.map((q) => q), 10)) { cnt++; let d = Infinity; for (let i = 0; i < main.length - 1; i++) d = Math.min(d, G.segDist(p[0], p[2], [main[i][0], main[i][2]], [main[i + 1][0], main[i + 1][2]])); if (d > 25) far++; }
      if (cnt && far / cnt > 0.3) distinct++;
    });
    S.corridors = G.round(1 + distinct / nr, 2);
    plan.score = S;
    return S;
  };

  // ---------------------------------------------------------------- signature (diversité)
  /* Empreinte compacte d'une carte : densité de construction sur une grille normalisée 8 × 16 (hauteurs), nombres
   * d'objets, positions normalisées du départ et des cibles, famille et ambiance. */
  G.signature = function (plan) {
    const bd = plan.bounds, gx = 8, gz = 16, grid = new Float32Array(gx * gz);
    for (const s of plan.solids) {
      if (G.passable(s) || s.kind !== 'solid') continue;
      const u = (s.x - bd.x0) / (bd.x1 - bd.x0), v = (bd.z1 - s.z) / (bd.z1 - bd.z0);
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      grid[Math.floor(v * gz) * gx + Math.floor(u * gx)] += Math.min(80, s.y + s.h / 2) * s.w * s.d / 400;
    }
    let mx = 0; for (const v of grid) mx = Math.max(mx, v);
    for (let i = 0; i < grid.length; i++) grid[i] = mx ? grid[i] / mx : 0;
    // relief (montagne, collines, dunes) : la forme du terrain compte autant que les constructions
    if (plan.terrain && plan.terrain.H) for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
      const x = bd.x0 + (i + 0.5) / gx * (bd.x1 - bd.x0), z = bd.z1 - (j + 0.5) / gz * (bd.z1 - bd.z0);
      grid[j * gx + i] = 0.5 * grid[j * gx + i] + 0.5 * Math.min(1, G.heightAt(plan, x, z) / 80);
    }
    const nrm = (p) => [(p[0] - bd.x0) / (bd.x1 - bd.x0), (bd.z1 - p[2]) / (bd.z1 - bd.z0)];
    const st = plan.stats || G.planStats(plan);
    return {
      grid, biome: plan.biome.id, env: plan.env.id, start: nrm(plan.launcher.pos), targets: plan.targets.map((t) => nrm(t.pos)),
      counts: [st.buildings, st.trees, st.obstacles, st.tanks + st.sams, st.helis, st.targets, plan.roads.length],
    };
  };
  // Distance entre deux signatures (0 = identiques, ~1 = très différentes)
  G.signatureDistance = function (a, b) {
    let g = 0; for (let i = 0; i < a.grid.length; i++) g += Math.abs(a.grid[i] - b.grid[i]);
    g /= a.grid.length;
    let c = 0; for (let i = 0; i < a.counts.length; i++) c += Math.abs(a.counts[i] - b.counts[i]) / Math.max(4, a.counts[i], b.counts[i]);
    c /= a.counts.length;
    let t = 0;
    for (const p of a.targets) { let m = Infinity; for (const q of b.targets) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); t += Math.min(1, m / 0.3); }
    t /= Math.max(1, a.targets.length);
    const s = Math.min(1, Math.hypot(a.start[0] - b.start[0], a.start[1] - b.start[1]) / 0.3);
    const cat = (a.biome !== b.biome ? 0.6 : 0) + (a.env !== b.env ? 0.4 : 0);
    return G.round(0.4 * g * 3 + 0.2 * c + 0.2 * t + 0.05 * s + 0.15 * cat, 4);
  };
})();
