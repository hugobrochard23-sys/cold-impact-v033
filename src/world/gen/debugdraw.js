/* Générateur de missions — dessin de débogage (vue de dessus d'un plan).
 * En jeu : touche G (ou ?gendebug=1) → carte à gauche de l'écran : zones, routes, structures, obstacles, départ, cibles
 * (et leurs portes d'approche), tanks et lance-missiles (portée de tir), hélicoptères (patrouilles), trajectoires du
 * pilote automatique, danger (tireurs qui voient chaque zone à ~20 m d'altitude), lignes de vue en direct depuis la
 * roquette, et fiche : graine, difficulté, score, nombres d'objets, temps de génération et de construction.
 * Outil : tools/genviewer.html dessine des dizaines de plans côte à côte avec la même fonction. */
(function () {
  const G = CC.Gen;
  const ZONE_COL = (id) => { const h = (G.hashStr(id || '-') % 360); return 'hsla(' + h + ',55%,55%,'; };

  G.drawPlan = function (ctx, plan, o) {
    const bd = plan.bounds, pad = 4;
    const s = Math.min((o.w - 2 * pad) / (bd.x1 - bd.x0), (o.h - 2 * pad) / (bd.z1 - bd.z0));
    const ox = o.x + (o.w - (bd.x1 - bd.x0) * s) / 2, oy = o.y + (o.h - (bd.z1 - bd.z0) * s) / 2;
    const X = (x) => ox + (x - bd.x0) * s, Y = (z) => oy + (z - bd.z0) * s;
    const poly = (ob, fill, stroke) => {
      ctx.beginPath();
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = G.local(ob, a * ob.hw, b * ob.hd); ctx.lineTo(X(p[0]), Y(p[1])); }
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,14,0.92)'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
    ctx.lineWidth = 1;
    // relief (courbes grossières) et mer
    if (plan.terrain && plan.terrain.H) {
      const T = plan.terrain, step = Math.max(1, Math.round(8 / (T.step * s)));
      for (let iz = 0; iz < T.n; iz += step) for (let ix = 0; ix < T.n; ix += step) {
        const h = T.H[iz * T.n + ix]; if (h < 3) continue;
        ctx.fillStyle = 'rgba(120,100,80,' + Math.min(0.5, h / 160).toFixed(3) + ')';
        ctx.fillRect(X(T.x0 + ix * T.step), Y(T.z0 + iz * T.step), T.step * s * step + 1, T.step * s * step + 1);
      }
    }
    if (plan.coast) { const c = plan.coast; ctx.fillStyle = 'rgba(40,80,120,0.6)'; ctx.fillRect(c.side > 0 ? X(c.x) : o.x, o.y, c.side > 0 ? o.w : X(c.x) - o.x, o.h); for (const p of plan.piers) poly(p.obb, 'rgba(90,90,90,0.9)'); }
    // danger à ~20 m (champ précalculé de la navigation)
    const nav = plan.nav;
    if (o.danger !== false && nav && nav.dg) {
      const g = nav.dg, jy = Math.min(g.gy - 1, Math.floor((20 - nav.y0) / (nav.ch * 2))), cs = nav.cs * 2;
      for (let jz = 0; jz < g.gz; jz++) for (let jx = 0; jx < g.gx; jx++) {
        const v = g.d[(jy * g.gz + jz) * g.gx + jx]; if (!v) continue;
        ctx.fillStyle = 'rgba(255,40,20,' + Math.min(0.55, v * 0.18).toFixed(3) + ')';
        ctx.fillRect(X(nav.x0 + jx * cs), Y(nav.z0 + jz * cs), cs * s + 0.5, cs * s + 0.5);
      }
    }
    for (const rd of plan.roads) poly(rd.obb, 'rgba(90,90,96,0.9)');
    for (const pc of plan.parcels) poly(pc.obb, null, ZONE_COL(pc.zone) + '0.8)');
    // structures (plus claires quand elles sont hautes) et obstacles
    for (const sd of plan.solids) {
      if (sd.kind === 'cable' || sd.kind === 'hazard') continue;
      const it = plan.items[sd.item], layer = it ? G.Items.get(it.t).layer : 'structure';
      const top = sd.y + sd.h / 2, k = Math.min(1, top / 60);
      const fill = layer === 'obstacle' ? 'rgba(255,150,40,0.85)' : layer === 'decor' ? 'rgba(70,120,70,0.7)' : 'rgb(' + Math.round(90 + 150 * k) + ',' + Math.round(90 + 150 * k) + ',' + Math.round(100 + 150 * k) + ')';
      poly(G.obb(sd.x, sd.z, sd.w, sd.d, sd.yaw), fill);
    }
    for (const it of plan.items) if (it.t === 'cable' || it.t === 'laser') { ctx.strokeStyle = it.t === 'laser' ? '#ff2a1a' : '#ffb040'; ctx.beginPath(); ctx.moveTo(X(it.a[0]), Y(it.a[2])); ctx.lineTo(X(it.b[0]), Y(it.b[2])); ctx.stroke(); }
    // couloirs : route du pilote automatique (jaune) et second couloir (cyan pointillé)
    const line = (pts, col, dash, w) => { if (!pts) return; ctx.setLineDash(dash || []); ctx.lineWidth = w || 1.5; ctx.strokeStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[2])) : ctx.moveTo(X(p[0]), Y(p[2])))); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; };
    if (o.routes !== false) { for (const a of plan.altCorridors) line(a, 'rgba(90,220,255,0.7)', [4, 3]); plan.routes.forEach((rt, k) => line(rt, k === o.activeRoute ? '#ffff40' : 'rgba(255,240,60,0.75)', null, k === o.activeRoute ? 2.5 : 1.5)); }
    // défenses : portée de tir
    const A = CC.CONFIG.aa, range = A.range[0] + (A.range[1] - A.range[0]) * plan.profile.enemyReaction;
    for (const g of plan.guards) {
      ctx.strokeStyle = g.type === 'sam' ? 'rgba(255,60,220,0.45)' : 'rgba(255,140,40,0.35)'; ctx.beginPath(); ctx.arc(X(g.pos[0]), Y(g.pos[2]), range * s, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = g.type === 'sam' ? '#ff40d0' : '#ff8a28'; ctx.fillRect(X(g.pos[0]) - 3, Y(g.pos[2]) - 3, 6, 6);
    }
    for (const h of plan.helis) {
      if (h.patrol) line(h.patrol.concat([h.patrol[0]]), 'rgba(80,200,255,0.9)');
      ctx.fillStyle = '#50c8ff'; ctx.beginPath(); ctx.arc(X(h.pos[0]), Y(h.pos[2]), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // cibles : carré rouge, porte d'approche et allée
    for (const t of plan.targets) {
      line([t.approach, t.navGoal, t.gate, ...t.entry, t.pos], 'rgba(255,90,90,0.9)', [2, 2]);
      if (t.patrol) line(t.patrol.concat([t.patrol[0]]), 'rgba(255,80,80,0.9)');
      ctx.fillStyle = '#ff2a2a'; ctx.fillRect(X(t.pos[0]) - 4, Y(t.pos[2]) - 4, 8, 8);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px monospace'; ctx.fillText(String(t.i + 1) + (t.enclosed ? '*' : ''), X(t.pos[0]) + 5, Y(t.pos[2]) - 4);
    }
    const L = plan.launcher.pos;
    ctx.fillStyle = '#56ff5a'; ctx.beginPath(); ctx.moveTo(X(L[0]), Y(L[2]) - 6); ctx.lineTo(X(L[0]) - 5, Y(L[2]) + 4); ctx.lineTo(X(L[0]) + 5, Y(L[2]) + 4); ctx.fill();
    // roquette et lignes de vue en direct (monde réel du jeu)
    if (o.rocket) {
      const rp = o.rocket;
      for (const sh of o.shooters || []) {
        ctx.strokeStyle = sh.los ? 'rgba(255,40,40,0.95)' : 'rgba(160,160,160,0.35)'; ctx.beginPath(); ctx.moveTo(X(rp.x), Y(rp.z)); ctx.lineTo(X(sh.x), Y(sh.z)); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(X(rp.x), Y(rp.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return { X, Y, s };
  };

  // Superposition en jeu : carte + fiche de la mission
  G.drawDebugOverlay = function (ctx, game, W, H, ui) {
    const plan = game.level.plan, T = -(ui.offsetY || 0), HH = ui.fullH || H;
    const w = Math.min(W * 0.36, HH * 0.55), h = HH * 0.62, x = 8, y = T + HH * 0.18;
    if (w < 60 || h < 60) return;
    const rk = game.rocket, V = THREE.Vector3;
    let shooters = null, rocket = null;
    if (rk && rk.active) {
      rocket = { x: rk.pos.x, z: rk.pos.z };
      shooters = [];
      const A = CC.CONFIG.aa, range = A.range[0] + (A.range[1] - A.range[0]) * game.aaThreat(), dir = new V();
      for (const t of game.targets) {
        if (!t.alive || !['tank', 'sam', 'heli', 'heliCamo'].includes(t.type)) continue;
        const c = t.obb.c, d = dir.subVectors(rk.pos, c), len = d.length();
        if (len > range * 1.3) continue;
        d.divideScalar(len);
        shooters.push({ x: c.x, z: c.z, los: len < range && !game.world.blocked(c, d, len - 1, (bx) => bx.kind === 'solid' || bx.kind === 'brick') });
      }
    }
    G.drawPlan(ctx, plan, { x, y, w, h, rocket, shooters, activeRoute: game.targetsDone });
    const S = plan.score, st = plan.stats, m = game.mission || {};
    const lines = [
      'SEED ' + plan.seed + '  ' + plan.difficulty.toUpperCase() + '  TRY ' + (plan.attempt + 1),
      plan.biome.label + '  ' + plan.env.label,
      'SCORE ' + S.difficultyScore + '  [' + G.Difficulties.get(plan.difficulty).scoreBand + ']',
      'PRESSURE ' + S.enemyPressure + '  COMBAT ' + S.combatComplexity,
      'PATH ' + S.traversalComplexity + '  OBST ' + S.obstacleComplexity + '  OPEN ' + S.openness,
      'BLD ' + st.buildings + ' TREES ' + st.trees + ' OBST ' + st.obstacles + ' ITEMS ' + st.items,
      'TANKS ' + st.tanks + ' SAM ' + st.sams + ' HELI ' + st.helis + ' TARGETS ' + st.targets,
      'ROUTE ' + S.routeLength + ' M  EXPOSURE ' + S.exposure + '  CORRIDORS ' + S.corridors,
      'FUEL ' + plan.fuel + ' S  MAX TURN ' + plan.analysis.maxTurnRate,
      'GEN ' + (m.genMs !== undefined ? m.genMs : plan.timings.total) + ' MS  BUILD ' + (m.buildMs !== undefined ? m.buildMs : '-') + ' MS',
    ];
    const px = Math.max(1, Math.min(HH * 0.0021, w / 230));
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x, y + h + 4, w, lines.length * px * 10 + 8);
    lines.forEach((l, i) => CC.Font.draw(ctx, l, x + 4, y + h + 8 + i * px * 10, px, '#e8e8e8', {}));
  };
})();
