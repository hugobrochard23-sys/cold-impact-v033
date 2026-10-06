/* Générateur de missions — COUCHES 4 et 5 : combat et jeu.
 *  - lanceur (toit, tour, rebord rocheux) : départ toujours dégagé ;
 *  - cibles : type selon le biome, mise en situation (à découvert, murs de protection, hangar, filet, cour, ruelle, toit,
 *    en vol) selon la protection du profil ; chaque mise en situation fournit sa « porte » (point d'approche) et son
 *    entrée exacte (vérifiée à la validation) ;
 *  - défenses (tanks, lance-missiles) placées sur les couloirs d'approche réels (lignes de vue calculées), espacées en
 *    FACILE, croisées sur plusieurs angles en IMPOSSIBLE ;
 *  - hélicoptères : zone de patrouille, points de passage, vitesse, altitude, sens — dégagés de tout bâtiment. */
(function () {
  const G = CC.Gen;

  // ---------- types de cible (modèle de jeu + encombrement + mises en situation possibles) ----------
  const K = (id, o) => G.TargetKinds.add(id, o);
  K('tank', { type: 'tank', size: [3.9, 2.9, 6.2], label: 'TANK', setups: { open: 1, revetment: 3, hangar: 2, canopy: 2, courtyard: 1 } });
  K('truck', { type: 'truck', size: [2.8, 2.9, 5], label: 'TRUCK', setups: { open: 1.5, canopy: 2, alley: 2, courtyard: 1.5, hangar: 1 } });
  K('heli', { type: 'heli', size: [3, 3.2, 12.5], air: true, label: 'HELICOPTER', setups: { rooftop: 2, airborne: 2, open: 1 } });
  K('house', { type: 'house', size: [6.4, 7, 8], label: 'HOUSE', setups: { open: 2, courtyard: 1 } });
  K('radar', { type: 'radar', size: [8, 9, 8], label: 'RADAR', setups: { open: 2, revetment: 2 } });
  K('fuel', { type: 'fuel', size: [12, 8, 12], label: 'FUEL DEPOT', setups: { open: 1.5, revetment: 2.5, courtyard: 1 } });
  K('command', { type: 'command', size: [10, 6, 10], label: 'COMMAND POST', setups: { open: 1, courtyard: 2, revetment: 2, canopy: 1 } });

  // ---------- mises en situation ----------
  // protection : 0 (à découvert) → 1 (très protégée) ; la difficulté choisit autour de sa valeur de targetProtection
  const S = (id, o) => G.Setups.add(id, o);
  const up = (p, dy) => [p[0], p[1] + dy, p[2]];
  // dir : direction (x, z) d'où l'on doit arriver (unitaire)
  S('open', {
    protection: 0.05, radius: 14,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), pos = [site.x, y + (K.air ? 3 : 0.1), site.z];
      return { pos, gate: [site.x + dir[0] * 26, y + 11, site.z + dir[1] * 26], entry: [] };
    },
  });
  S('revetment', {
    protection: 0.35, radius: 18,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), yaw = Math.atan2(dir[0], dir[1]);
      const w = K.size[0] + r.range(4, 7), d = K.size[2] + r.range(4, 6), h = G.clamp(K.size[1] * 0.85 + 1, 3, 5);
      plan.add({ t: 'revetment', x: site.x, z: site.z, yaw, y0: y, w, d, h, setup: true });
      return { pos: [site.x, y + 0.1, site.z], gate: [site.x + dir[0] * (d / 2 + 22), y + h + 5, site.z + dir[1] * (d / 2 + 22)], entry: [], cover: { w, d, h, yaw } };
    },
  });
  S('hangar', {
    protection: 0.8, radius: 26,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), yaw = Math.atan2(dir[0], dir[1]);
      const tight = plan.profile.targetProtection;
      const w = K.size[0] + G.lerp(18, 11, tight) + r.range(0, 3), d = K.size[2] + r.range(16, 22), h = r.range(8.5, 11);
      const doorW = Math.min(w - 2, K.size[0] + G.lerp(12, 6, tight)), doorH = Math.min(h - 1.5, G.lerp(8, 6.2, tight));
      plan.add({ t: 'hangar', x: site.x, z: site.z, yaw, y0: y, w, d, h, doorW, doorH, mat: r.pick(['metal', 'camo', 'concreteDark']), setup: true });
      const p = G.local(G.obb(site.x, site.z, w, d, yaw), 0, -d * 0.12), door = G.local(G.obb(site.x, site.z, w, d, yaw), 0, d / 2 + 1);
      return {
        pos: [p[0], y + 0.1, p[1]],
        gate: [door[0] + dir[0] * 30, y + doorH * 0.55, door[1] + dir[1] * 30],
        entry: [[door[0] + dir[0] * 8, y + doorH * 0.5, door[1] + dir[1] * 8], [door[0], y + doorH * 0.48, door[1]]],
        enclosed: true, door: { w: doorW, h: doorH },
      };
    },
  });
  S('canopy', {
    protection: 0.55, radius: 20,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), yaw = Math.atan2(dir[0], dir[1]);
      const w = K.size[0] + r.range(7, 10), d = K.size[2] + r.range(8, 12), h = Math.max(5.2, K.size[1] + 2) + r.range(0, 1.4);
      plan.add({ t: 'canopy', x: site.x, z: site.z, yaw, y0: y, w, d, h, setup: true });
      const mouth = G.local(G.obb(site.x, site.z, w, d, yaw), 0, d / 2 + 2);
      return { pos: [site.x, y + 0.1, site.z], gate: [mouth[0] + dir[0] * 26, y + h * 0.6, mouth[1] + dir[1] * 26], entry: [[mouth[0], y + h * 0.5, mouth[1]]], enclosed: true };
    },
  });
  S('courtyard', {
    protection: 0.6, radius: 30,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), yaw = Math.atan2(dir[0], dir[1]);
      const inner = G.lerp(34, 22, plan.profile.targetProtection) + r.range(0, 6), th = r.range(9, 13);
      const H = G.lerp(14, 42, plan.profile.buildingDensity) * r.range(0.85, 1.15);
      const o = G.obb(site.x, site.z, inner + 2 * th, inner + 2 * th, yaw), gap = r.range(9, 13);
      const mat = { side: r.pick((plan.biome.facades || ['facade'])), top: 'concreteDark' };
      const put = (lx, lz, w, d) => { const p = G.local(o, lx, lz); plan.add({ t: 'bld', x: p[0], z: p[1], yaw, y0: y, w, d, h: H * r.range(0.8, 1.1), mat, tint: '#f2f0ee', setup: true }); };
      const off = inner / 2 + th / 2, full = inner + 2 * th;
      put(0, -off, full, th); put(-off, 0, th, inner); put(off, 0, th, inner);
      const part = (full - gap) / 2;                                  // façade avant percée d'un passage
      put(-(gap / 2 + part / 2), off, part, th); put(gap / 2 + part / 2, off, part, th);
      const mouth = G.local(o, 0, off);
      // arrivée par le passage (bas) ; plonger d'en haut reste possible
      return { pos: [site.x, y + 0.1, site.z], gate: [mouth[0] + dir[0] * 28, y + 7, mouth[1] + dir[1] * 28], entry: [[mouth[0], y + 5.5, mouth[1]]], enclosed: true, reserveBox: o };
    },
  });
  S('alley', {
    protection: 0.7, radius: 30,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), yaw = Math.atan2(dir[0], dir[1]);
      const aw = G.lerp(18, 11, plan.profile.targetProtection) + r.range(0, 2), len = r.range(40, 60), th = r.range(10, 14);
      const H = G.lerp(18, 50, plan.profile.buildingDensity) * r.range(0.85, 1.15);
      const o = G.obb(site.x, site.z, aw + 2 * th, len, yaw);
      const mat = { side: r.pick((plan.biome.facades || ['facade'])), top: 'concreteDark' };
      for (const sg of [-1, 1]) { const p = G.local(o, sg * (aw / 2 + th / 2), 0); plan.add({ t: 'bld', x: p[0], z: p[1], yaw, y0: y, w: th, d: len, h: H * r.range(0.85, 1.1), mat, tint: '#eae6e2', setup: true }); }
      const back = G.local(o, 0, -len / 2 + 2); plan.add({ t: 'wall', x: back[0], z: back[1], yaw, y0: y, len: aw, h: 6, th: 1, style: 'brick', setup: true });
      const tp = G.local(o, 0, -len / 2 + 10), mouth = G.local(o, 0, len / 2);
      return { pos: [tp[0], y + 0.1, tp[1]], gate: [mouth[0] + dir[0] * 26, y + 9, mouth[1] + dir[1] * 26], entry: [[mouth[0], y + 6, mouth[1]]], enclosed: true, reserveBox: o };
    },
  });
  S('rooftop', {
    protection: 0.3, radius: 20, air: true,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z), h = G.lerp(16, 46, plan.profile.buildingDensity) * r.range(0.8, 1.15);
      const w = r.range(22, 28), d = r.range(22, 28), yaw = Math.atan2(dir[0], dir[1]);
      plan.add({ t: 'bld', x: site.x, z: site.z, yaw, y0: y, w, d, h, mat: { side: r.pick(plan.biome.facades || ['facade']), top: 'concreteDark' }, tint: '#f2f0ee', helipad: true, setup: true });
      const pos = [site.x, y + h + 3.6, site.z];
      return { pos, gate: [site.x + dir[0] * 34, pos[1] + 7, site.z + dir[1] * 34], entry: [] };
    },
  });
  S('airborne', {
    protection: 0.5, radius: 10, air: true,
    place(plan, site, K, dir, r) {
      const y = G.heightAt(plan, site.x, site.z);
      const pos = [site.x, y + r.range(28, 40), site.z];
      return { pos, gate: [site.x + dir[0] * 36, pos[1] + 4, site.z + dir[1] * 36], entry: [], airborne: true };
    },
  });

  // ---------- lanceur ----------
  G.placeLauncher = function (plan, r) {
    const sp = plan.launcherSpot, P = plan.profile, B = plan.biome;
    const ground = G.heightAt(plan, sp.x, sp.z);
    const eye = ground + P.launcherEye;
    const style = B.launcher === 'rooftop' ? 'rooftop' : B.launcher === 'ledge' ? 'ledge' : 'tower';
    const w = style === 'tower' ? 4 : r.range(14, 20), d = style === 'tower' ? 4 : r.range(14, 18);
    const cz = sp.z - 3 + d / 2;                                       // l'œil est à 3 m du bord avant
    const it = { t: 'platform', x: sp.x, z: cz, yaw: 0, y0: ground - (style === 'ledge' ? 6 : 0), w, d, h: eye - 1.7 - ground + (style === 'ledge' ? 6 : 0), style, launcher: true };
    if (style === 'rooftop') { it.mat = { side: r.pick(B.facades || ['facade']), top: 'concreteDark' }; it.tint = '#f2f0ee'; }
    plan.add(it);
    plan.space.add(G.obb(sp.x, cz, w + 4, d + 4, 0), 'reserve');
    // vue dégagée devant le lanceur : aucune structure dans les 70 premiers mètres au-dessus de l'œil − 6 m
    plan.space.add(G.obb(sp.x, sp.z - 45, 26, 70, 0), 'reserve');
    plan.launcher = { pos: [sp.x, eye, sp.z], yaw: 0, pitch: style === 'tower' ? -3 : -2, style, platform: it };
  };

  // ---------- cibles ----------
  const SPREAD = { 1: [0.8], 2: [0.55, 0.93], 3: [0.42, 0.7, 0.95], 4: [0.34, 0.55, 0.76, 0.96] };
  G.placeTargets = function (plan, r) {
    const P = plan.profile, B = plan.biome, bd = plan.bounds, L = plan.launcher.pos;
    const n = P.targetCount, spread = SPREAD[n] || SPREAD[4];
    const kinds = B.targets;
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const want = G.clamp(spread[i] + r.range(-0.05, 0.05), 0.25, 0.98);
      const kindId = r.weighted(kinds), kind = G.TargetKinds.get(kindId);
      // mise en situation : proche de la protection voulue (± hasard), parmi celles du type
      const sw = {};
      for (const [sid, w] of Object.entries(kind.setups)) {
        const s = G.Setups.get(sid);
        if ((sid === 'rooftop' || sid === 'courtyard' || sid === 'alley') && B.layout !== 'grid') continue;
        sw[sid] = w * Math.max(0.04, 1 - Math.abs(s.protection - P.targetProtection) * 1.8);
      }
      if (!Object.keys(sw).length) sw.open = 1;
      const setupId = r.weighted(sw), setup = G.Setups.get(setupId);
      // parcelle : profondeur visée, loin du lanceur, écart latéral avec les autres cibles
      let best = null, bs = -Infinity;
      for (const pc of plan.parcels) {
        if (used.has(pc) || pc.launcher) continue;
        const need = setup.radius * 2;
        if (pc.obb.hw * 2 < Math.min(need, 30) || pc.obb.hd * 2 < Math.min(need, 30)) continue;
        const dist = Math.hypot(pc.obb.x - L[0], pc.obb.z - L[2]);
        if (dist < 150) continue;
        let s = -Math.abs(pc.depth - want) * 6 + r() * 0.6;
        for (const t of plan.targets) s += Math.min(1.2, Math.hypot(pc.obb.x - t.pos[0], pc.obb.z - t.pos[2]) / 120) * 0.8;
        if (pc.field) s -= 0.5;
        if (s > bs) { bs = s; best = pc; }
      }
      if (!best) best = syntheticSite(plan, want, setup.radius, r);        // secours : emplacement au bord d'une route
      if (!best) { plan.issues.push({ layer: 'combat', msg: 'no plot for target ' + i }); continue; }
      used.add(best); best.target = true;
      // direction d'arrivée : vers le lanceur, tournée d'autant plus que la protection est forte (il faut contourner) ;
      // une cible à découvert se prend dans l'axe naturel. L'axe d'approche doit rester au ras du sol (pas dans une pente).
      const site = { x: best.obb.x + r.range(-0.15, 0.15) * best.obb.hw, z: best.obb.z + r.range(-0.15, 0.15) * best.obb.hd, parcel: best };
      const toL = Math.atan2(L[0] - site.x, L[2] - site.z);
      const free = setupId === 'open' || setupId === 'rooftop' || setupId === 'airborne';
      const ang = approachAngle(plan, site, toL + r.sign() * r.range(0, free ? 0.45 : Math.PI * 0.85 * P.targetProtection));
      const dir = [Math.sin(ang), Math.cos(ang)];
      const res = setup.place(plan, site, kind, dir, r);
      const t = { i, kind: kindId, type: kind.type, setup: setupId, pos: res.pos, gate: res.gate, entry: res.entry, dir, yaw: G.round(ang * 180 / Math.PI + (r.chance(0.5) ? 180 : 0), 1), enclosed: !!res.enclosed, airborne: !!res.airborne, parcel: best };
      if (kind.type === 'heli' && res.airborne) {
        t.patrol = orbit(res.pos, r.range(28, 45), r.int(5, 7), r); t.patrolSpeed = r.range(4, 7) + 6 * P.helicopterDensity;
      }
      // axe d'approche : but de la recherche de trajectoire (en retrait de la porte, hors de la marge du sol), puis point
      // d'alignement au bout d'une allée d'approche (longue de 2 rayons de virage) où le couloir se met dans l'axe
      // entrée basse (hangar, filet, cour, ruelle) : on descend tôt et doucement, dans l'allée réservée, pour arriver à
      // hauteur d'entrée bien avant la porte (pente ≈ 7°) ; sinon, arrivée plongeante classique
      const low = res.entry.length > 0;
      const gx = res.gate[0] + dir[0] * 16, gz = res.gate[2] + dir[1] * 16;
      t.navGoal = [G.round(gx), G.round(low ? res.gate[1] + 1.2 : Math.max(res.gate[1] + 3, G.heightAt(plan, gx, gz) + P.clearance + 6)), G.round(gz)];
      const lane = laneLength(P);
      const ax = res.gate[0] + dir[0] * lane, az = res.gate[2] + dir[1] * lane;
      t.approach = [G.round(ax), G.round(Math.max(t.navGoal[1] + (lane - 16) * (low ? 0.12 : 0.2), G.heightAt(plan, ax, az) + P.clearance + 6)), G.round(az)];
      plan.targets.push(t);
      // réservations : la cible, et l'allée alignement → but → porte → entrée → cible (aucune structure ni décor)
      plan.space.add(res.reserveBox || G.obb(site.x, site.z, setup.radius * 1.4, setup.radius * 1.4, 0), 'reserve');
      const pts = [t.approach, t.navGoal, res.gate, ...res.entry, res.pos];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (len < 1) continue;
        // largeur : de quoi passer avec la marge du profil de chaque côté (plus étroit en IMPOSSIBLE)
        plan.space.add(G.obb((a[0] + b[0]) / 2, (a[2] + b[2]) / 2, k < 2 ? 2 * (P.clearance + 5) + 6 : 12, len + 6, Math.atan2(b[0] - a[0], b[2] - a[2])), 'reserve');
      }
    }
  };

  // longueur de l'allée d'approche : deux rayons de virage (60 m/s ÷ taux permis) + marge
  const laneLength = (P) => G.clamp(2 * 60 / P.maxTurnRate + 20, 60, 120);
  G.laneLength = laneLength;
  /* Angle d'approche le plus proche de l'angle voulu dont l'axe (allée d'approche) reste sur un sol presque plat et libre. */
  function approachAngle(plan, site, want) {
    const g0 = G.heightAt(plan, site.x, site.z), lane = laneLength(plan.profile) + 30;
    for (const d of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.1, -2.1, 2.6, -2.6, Math.PI]) {
      const a = want + d, dx = Math.sin(a), dz = Math.cos(a);
      let ok = true;
      for (let k = 10; k <= lane && ok; k += 10) {
        const x = site.x + dx * k, z = site.z + dz * k;
        if (G.heightAt(plan, x, z) > g0 + 5) ok = false;
        else if (plan.valleys && k <= 50 && G.valleyFloorDist(plan, x, z) > 2) ok = false;
        else if (x < plan.bounds.x0 || x > plan.bounds.x1 || z > 0) ok = false;
      }
      if (ok && plan.space.free(G.obb(site.x + dx * (lane / 2 + 10), site.z + dz * (lane / 2 + 10), 14, lane - 10, a), 0, (t) => t === 'reserve' || t === 'bld')) return a;
    }
    return want;
  }

  /* Emplacement de secours pour une cible : au bord de la route principale, à la profondeur voulue (toutes dispositions).
   * Renvoie une parcelle synthétique ou null. */
  function syntheticSite(plan, want, radius, r) {
    const bd = plan.bounds, zWant = -want * (-bd.z0);
    const mains = plan.roads.filter((rd) => rd.kind === 'main' || rd.kind === 'path' || rd.kind === 'street');
    let best = null, bdist = Infinity;
    for (let k = 0; k < 60; k++) {
      const rd = r.pick(mains), t = r();
      const p = G.local(rd.obb, r.sign() * (rd.w / 2 + radius + 3), (t - 0.5) * 2 * rd.obb.hd);
      const o = G.obb(p[0], p[1], radius * 2, radius * 2, rd.obb.yaw);
      if (p[0] < bd.x0 + radius || p[0] > bd.x1 - radius || p[1] > -120) continue;
      if (!plan.space.free(o, 1, (tg) => tg === 'road' || tg === 'bld' || tg === 'reserve')) continue;
      if (plan.valleys && G.valleyFloorDist(plan, p[0], p[1]) > -radius * 0.5) continue;
      const d = Math.abs(p[1] - zWant);
      if (d < bdist) { bdist = d; best = { obb: o, row: -1, col: -1, depth: -p[1] / Math.max(1, -bd.z0), synthetic: true }; }
    }
    if (best) { plan.parcels.push(best); plan.space.add(best.obb, 'site'); }
    return best;
  }

  // Boucle de patrouille : polygone irrégulier autour d'un centre
  function orbit(c, rad, n, r) {
    const pts = [], a0 = r() * 6.28, dirS = r.sign();
    for (let i = 0; i < n; i++) {
      const a = a0 + dirS * i * 2 * Math.PI / n, rr = rad * r.range(0.75, 1.2);
      pts.push([G.round(c[0] + Math.cos(a) * rr), G.round(c[1] + r.range(-3, 3)), G.round(c[2] + Math.sin(a) * rr)]);
    }
    return pts;
  }

  // ---------- défenses (après la navigation : lignes de vue réelles) ----------
  G.placeDefenses = function (plan, nav, r) {
    const P = plan.profile, L = plan.launcher.pos, A = CC.CONFIG.aa;
    const range = A.range[0] + (A.range[1] - A.range[0]) * P.enemyReaction;
    // échantillons des couloirs d'approche (routes initiales), pondérés vers la fin (approche de la cible)
    const samples = [];
    for (const rt of plan.corridors) {
      let acc = 0;
      for (let i = 1; i < rt.length; i++) {
        const a = rt[i - 1], b = rt[i], len = G.dist3(a, b);
        for (let s = 0; s < len; s += 16) {
          const k = s / len, p = [G.lerp(a[0], b[0], k), G.lerp(a[1], b[1], k), G.lerp(a[2], b[2], k)];
          acc += 16;
          samples.push({ p, w: 0.5 + acc / 1000, covered: 0 });
        }
      }
    }
    // allées finales (point d'alignement → porte → cible) : échantillons « finaux »
    for (const t of plan.targets) {
      const pts = [t.approach, t.navGoal, t.gate, ...t.entry, t.pos];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], len = G.dist3(a, b);
        for (let s = 0; s < len; s += 10) { const k = s / len; samples.push({ p: [G.lerp(a[0], b[0], k), G.lerp(a[1], b[1], k) + 1, G.lerp(a[2], b[2], k)], w: 1, covered: 0, final: true }); }
      }
    }
    // FACILE / MOYEN : l'entrée finale reste calme (aucune défense placée pour la couvrir) ; DIFFICILE / IMPOSSIBLE : elle
    // est au contraire une cible prioritaire des défenses
    const calmFinal = P.tankDensity < 0.55;
    // candidats : sol libre (routes, cours, terrain), loin des structures, loin du lanceur
    const cand = [], bd = plan.bounds;
    const step = 14;
    for (let x = bd.x0 + 20; x < bd.x1 - 20; x += step) for (let z = -60; z > bd.z0 + 20; z -= step) {
      const px = x + r.range(-4, 4), pz = z + r.range(-4, 4);
      if (Math.hypot(px - L[0], pz - L[2]) < 160) continue;
      if (plan.coast && (plan.coast.side > 0 ? px > plan.coast.x - 6 : px < plan.coast.x + 6)) continue;
      if (!plan.space.free(G.obb(px, pz, 8, 10, 0), 2, (t) => t === 'bld' || t === 'reserve' || t === 'decor' || t === 'obst')) continue;
      const gr = G.groundRange(plan, G.obb(px, pz, 5, 7, 0));
      if (gr[1] - gr[0] > 1.6) continue;                                   // pente trop forte pour un char
      cand.push({ x: px, z: pz, y: gr[0] });
    }
    r.shuffle(cand);
    const pool = cand.slice(0, 220);
    // couverture de chaque candidat (échantillons en portée et en vue)
    for (const c of pool) {
      c.cov = []; c.eye = [c.x, c.y + 3.6, c.z];
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i].p, d = G.dist3(c.eye, s);
        if (d < A.minRange || d > range) continue;
        if (nav.los(c.eye, s)) c.cov.push(i);
      }
      c.near = Math.min(...plan.targets.map((t) => Math.hypot(t.pos[0] - c.x, t.pos[2] - c.z)));
    }
    const chosen = [];
    const minSpacing = G.lerp(110, 32, P.tankDensity);
    const pickOne = (kind) => {
      let best = null, bs = -Infinity;
      for (const c of pool) {
        if (c.used) continue;
        if (chosen.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < minSpacing)) continue;
        let fresh = 0, total = 0, fin = 0;
        for (const i of c.cov) {
          if (samples[i].final) { fin++; if (calmFinal) continue; }
          total += samples[i].w; if (!samples[i].covered) fresh += samples[i].w;
        }
        if (calmFinal && fin > 0) continue;
        // FACILE : couverture modérée, tanks à l'écart ; IMPOSSIBLE : nouveaux angles, près des cibles
        const cov = P.tankDensity > 0.5 ? fresh + total * 0.3 : Math.min(total, 6 + 10 * P.tankDensity);
        const protect = P.targetProtection * Math.max(0, 1 - c.near / 160) * 8;
        let diversity = 0;
        for (const o of chosen) {                                       // tirs croisés : angles différents autour de la cible la plus proche
          const t = plan.targets.reduce((a, b) => (Math.hypot(b.pos[0] - c.x, b.pos[2] - c.z) < Math.hypot(a.pos[0] - c.x, a.pos[2] - c.z) ? b : a));
          const a1 = Math.atan2(c.x - t.pos[0], c.z - t.pos[2]), a2 = Math.atan2(o.x - t.pos[0], o.z - t.pos[2]);
          diversity += Math.min(1, Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) / 1.2);
        }
        const s = cov + protect + diversity * P.defenseDensity * 2 + (kind === 'sam' ? c.near < 110 ? 4 : -4 : 0) + r() * 2;
        if (s > bs) { bs = s; best = c; }
      }
      if (!best) return null;
      best.used = true;
      for (const i of best.cov) samples[i].covered++;
      chosen.push(best);
      return best;
    };
    for (let i = 0; i < P.tankCount; i++) {
      const c = pickOne('tank'); if (!c) break;
      const yaw = Math.atan2(L[0] - c.x, L[2] - c.z) * 180 / Math.PI + 180 + r.range(-35, 35);   // face au lanceur (modèle : avant = −z)
      plan.guards.push({ type: 'tank', pos: [G.round(c.x), G.round(c.y + 0.1), G.round(c.z)], yaw: G.round(yaw, 1), cov: c.cov.length });
      plan.space.add(G.obb(c.x, c.z, 5, 7.5, 0), 'decor');
    }
    for (let i = 0; i < P.samCount; i++) {
      const c = pickOne('sam'); if (!c) break;
      plan.guards.push({ type: 'sam', pos: [G.round(c.x), G.round(c.y + 0.1), G.round(c.z)], yaw: G.round(r() * 360, 1), cov: c.cov.length });
      plan.space.add(G.obb(c.x, c.z, 5, 7.5, 0), 'decor');
    }
    plan.analysis.samples = samples.length;
    plan.analysis.coverage = samples.length ? samples.filter((s) => s.covered).length / samples.length : 0;
  };

  // ---------- hélicoptères de garde (patrouilles) ----------
  G.placeHelis = function (plan, nav, r) {
    const P = plan.profile, L = plan.launcher.pos;
    for (let i = 0; i < P.heliCount; i++) {
      // centre : près d'une cible (protection) ou au milieu d'un couloir
      const t = r.pick(plan.targets), rt = r.pick(plan.corridors);
      const onRoute = rt[Math.floor(rt.length * r.range(0.45, 0.8))];
      const c = r.chance(0.5 + 0.3 * P.targetProtection) ? [t.pos[0] + r.range(-40, 40), 0, t.pos[2] + r.range(-40, 40)] : [onRoute[0] + r.range(-30, 30), 0, onRoute[2] + r.range(-30, 30)];
      if (Math.hypot(c[0] - L[0], c[2] - L[2]) < 170) continue;
      // FACILE / MOYEN : patrouille à l'écart des cibles (l'entrée finale reste calme)
      if (P.tankDensity < 0.55) {
        const near = plan.targets.reduce((m, q) => Math.min(m, Math.hypot(q.pos[0] - c[0], q.pos[2] - c[2])), Infinity);
        if (near < 150) { const q = plan.targets.find((x) => Math.hypot(x.pos[0] - c[0], x.pos[2] - c[2]) === near), k = 150 / Math.max(1, near); c[0] = q.pos[0] + (c[0] - q.pos[0]) * k; c[2] = q.pos[2] + (c[2] - q.pos[2]) * k; }
        if (plan.targets.some((x) => Math.hypot(x.pos[0] - c[0], x.pos[2] - c[2]) < 140) || c[0] < plan.bounds.x0 || c[0] > plan.bounds.x1 || c[2] < plan.bounds.z0) continue;
      }
      const spd = r.between(P.heliSpeed);
      const mode = spd < 1 ? 'hover' : P.helicopterDensity > 0.8 && r.chance(0.6) ? 'waypoints' : r.chance(0.5) ? 'orbit' : 'racetrack';
      let pts;
      if (mode === 'hover') pts = [[c[0], 0, c[2]]];
      else if (mode === 'orbit') pts = orbit(c, r.range(40, 75), r.int(6, 8), r);
      else if (mode === 'racetrack') { const a = r() * 3.14, l = r.range(60, 120); pts = [[c[0] - Math.sin(a) * l / 2, 0, c[2] - Math.cos(a) * l / 2], [c[0] + Math.sin(a) * l / 2, 0, c[2] + Math.cos(a) * l / 2]]; }
      else pts = orbit(c, r.range(60, 110), r.int(3, 5), r);
      // altitude : au-dessus de tout ce que survole la boucle (+ 12 m), relevée jusqu'à ce que la boucle soit dégagée
      let alt = 0;
      const loop = densify(pts, 6);
      for (const p of loop) alt = Math.max(alt, nav.topAt(p[0], p[2]));
      alt = G.clamp(alt + r.range(12, 18), 20, 85);
      let ok = false;
      for (let k = 0; k < 6 && !ok; k++) { ok = loop.every((p) => nav.clearSphere(p[0], alt, p[2], 7)); if (!ok) alt += 7; }
      if (!ok || alt > 95) { plan.issues.push({ layer: 'combat', msg: 'helicopter patrol not clear', fixed: true }); continue; }
      const path = pts.map((p) => [G.round(p[0]), G.round(alt + r.range(-2, 2)), G.round(p[2])]);
      plan.helis.push({ mode, patrol: mode === 'hover' ? null : path, pos: path[0], speed: G.round(spd, 1), dir: 1, alt: G.round(alt, 1), drift: mode === 'hover' ? r.range(4, 8) : 0 });
    }
  };
  function densify(pts, step) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < (n > 1 ? n : 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (let s = 0; s < Math.max(len, 0.1); s += step) { const k = len ? s / len : 0; out.push([G.lerp(a[0], b[0], k), 0, G.lerp(a[2], b[2], k)]); }
    }
    return out;
  }
  G.densify = densify;
})();
