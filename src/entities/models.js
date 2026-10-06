/* Modèles 3D originaux low-poly (fusée, lanceurs, char, hélicoptères, camion, maison, soldat, marqueurs).
 * Silhouettes et couleurs d'après la vidéo (OBSERVÉ), géométrie recréée. */
(function () {
  const V = THREE.Vector3;
  const mats = {};
  // v033-gfx : les matériaux viennent de CC.Look (Lambert d'origine ou Standard en mode réaliste) ; le cache est vidé au changement de style
  const lam = (c, extra) => { const k = CC.Look.mode + c + JSON.stringify(extra || {}); if (!mats[k]) mats[k] = CC.Look.lam(Object.assign({ color: c }, extra || {})); return mats[k]; };
  const metal = (c, rough) => { const k = CC.Look.mode + 'm' + c + rough; if (!mats[k]) mats[k] = CC.Look.metal({ color: c }, rough); return mats[k]; };
  const basic = (c, extra) => { const k = 'b' + c + JSON.stringify(extra || {}); if (!mats[k]) mats[k] = new THREE.MeshBasicMaterial(Object.assign({ color: c }, extra || {})); return mats[k]; };

  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function cyl(r1, r2, h, mat, seg, parent) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 10), mat);
    m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  const M = {};

  /* Design (performance mobile) : fusionne les pièces fixes d'un modèle par matériau. Les sous-groupes animés (`keep` :
   * tourelle, canon, rotor…) sont fusionnés séparément, chacun dans son propre repère, et restent animables.
   * Un char passe de ~80 appels de dessin à ~15, un hélicoptère de ~60 à ~12. */
  let vcMaterial = null;
  const vcMat = () => vcMaterial || (vcMaterial = CC.Look.lam({ color: '#ffffff', vertexColors: true }, { roughness: 0.72, env: 0.55 }));
  function bake(root, keep) {
    const keepSet = new Set(keep || []);
    const groups = [root, ...(keep || [])];
    for (const G of groups) {
      G.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(G.matrixWorld).invert();
      const byMat = new Map(), victims = [];
      const visit = (o) => {
        for (const c of o.children) {
          if (keepSet.has(c) && c !== G) continue;           // sous-groupe animé : traité à part
          if (c.isMesh && !c.isInstancedMesh && !c.material.transparent && !c.userData.noBake && c.visible) {
            const m = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
            let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
            g.applyMatrix4(m);
            // Lambert uni → un seul matériau partagé à couleurs par sommet (la couleur de la pièce passe dans les sommets)
            const plain = (c.material.isMeshLambertMaterial || (c.material.userData.look === 'std' && !c.material.metalness)) && !c.material.map && !c.material.emissiveMap;
            const k = plain ? 'vc' : c.material.uuid;
            if (!byMat.has(k)) byMat.set(k, { mat: plain ? vcMat() : c.material, geos: [], cast: false, vc: plain });
            const e = byMat.get(k); e.geos.push(g); e.cast = e.cast || c.castShadow;
            g.userData.col = c.material.color;
            victims.push(c);
          }
          visit(c);
        }
      };
      visit(G);
      for (const v of victims) { v.parent.remove(v); }
      for (const { mat, geos, cast, vc } of byMat.values()) {
        let n = 0; for (const g of geos) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = vc ? new Float32Array(n * 3) : null;
        let o = 0;
        for (const g of geos) {
          const c = g.attributes.position.count;
          pos.set(g.attributes.position.array, o * 3);
          if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
          if (col) { const k = g.userData.col; for (let i = 0; i < c; i++) { col[(o + i) * 3] = k.r; col[(o + i) * 3 + 1] = k.g; col[(o + i) * 3 + 2] = k.b; } }
          o += c; g.dispose();
        }
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        if (col) mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
        mg.computeBoundingSphere();
        const mesh = new THREE.Mesh(mg, mat); mesh.castShadow = cast; mesh.receiveShadow = true;
        G.add(mesh);
      }
    }
    return root;
  }
  M.bake = bake;

  /* Roquette : axe +Z = nez. Longueur ≈ 1,25 m (ESTIMATION), corps gris, nez à point rouge, collier jaune, 4 ailerons (OBSERVÉ).
   * v007 : le modèle est piloté par une fiche cosmétique (CC.Skins) — couleurs, dimensions, nombre d'ailerons et
   * pièces rapportées. Sans argument, on retombe exactement sur la roquette d'origine (`STOCK`). */
  const D2R = Math.PI / 180;
  /* Jet de tuyère — disque incandescent au fond de la tuyère + deux cônes lumineux (cœur jaune, enveloppe orange) animés par
   * Rocket.updateMesh (vacillement, allumage / coupure). Matériaux propres à chaque roquette. Renvoie { group, disc, core, outer }. */
  M.makeJet = function (g, r, len) {
    const jet = new THREE.Group(); jet.position.z = -len / 2 - 0.1; jet.visible = false; g.add(jet);   // allumé par Rocket.updateMesh
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 12), new THREE.MeshBasicMaterial({ color: '#fff2c0', transparent: true, opacity: 1 }));
    disc.rotation.y = Math.PI; disc.position.z = 0.005; jet.add(disc);
    const cone = (rad, h, color, op) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.geometry.translate(0, -h / 2, 0); m.rotation.x = Math.PI / 2;   // base à la tuyère, pointe vers l'arrière (−Z)
      m.userData.op = op; jet.add(m); return m;
    };
    const core = cone(r * 0.5, 0.42, '#fff0b0', 0.9), outer = cone(r * 0.72, 0.8, '#ff9a30', 0.45);
    return { group: jet, disc, core, outer };
  };

  M.rocket = function (skin) {
    skin = skin || (CC.Skins && CC.Skins.get('stock'));
    if (CC.Look.real() && M.rocketReal) return M.rocketReal(skin);   // v033-gfx : modèle détaillé (src/entities/rocket_real.js)
    const g = new THREE.Group();
    const c = skin ? skin.c : { body: '#c4c6c9', nose: '#c4c6c9', tip: '#e02a1c', band: '#f3cf00', fin: '#5d6065', nozzle: '#3d3f43' };
    const d = Object.assign({ r: 0.1, len: 0.86, noseLen: 0.3, noseR: 0.012, fins: 4, finH: 0.2, finW: 0.02, finPos: -0.33, scale: 1 }, (skin && skin.dims) || {});
    const r = d.r, len = d.len, nl = d.noseLen, nr = d.noseR, fs = len / 0.86;
    const body = cyl(r, r, len, lam(c.body), 14, g); body.rotation.x = Math.PI / 2; body.position.z = 0.0;
    const nose = cyl(nr, r, nl, lam(c.nose), 14, g); nose.rotation.x = Math.PI / 2; nose.position.z = len / 2 + nl / 2;
    // design : joints de tronçons (anneaux un peu plus sombres) et, sur les nez pointus, 4 petits canards de guidage
    const seamC = '#' + new THREE.Color(c.body).multiplyScalar(0.72).getHexString();
    for (const zf of [0.12, -0.05]) { const sm = cyl(r * 1.012, r * 1.012, 0.014, lam(seamC), 14, g); sm.rotation.x = Math.PI / 2; sm.position.z = len * zf; sm.castShadow = false; }
    if (nr <= 0.02 && d.fins === 4) for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.rotation.z = i * Math.PI / 2 + Math.PI / 4; g.add(f);
      box(0.012, 0.045, 0.07, lam(c.fin), 0, r + 0.02, len / 2 - 0.04, f).castShadow = false;
    }
    // embout des nez arrondis ; v027 (Hugo) : plus de petit cube rouge au bout des nez pointus (fusée de base)
    if (nr > 0.02) { const tip = cyl(nr * 0.55, nr, nr * 1.6, basic(c.tip), 8, g); tip.rotation.x = Math.PI / 2; tip.position.z = len / 2 + nl + nr * 0.6; tip.castShadow = false; }
    const band = cyl(r * 1.08, r * 1.08, 0.07, basic(c.band), 10, g); band.rotation.x = Math.PI / 2; band.position.z = -len * 0.35;
    const nozzle = cyl(r * 0.75, r * 0.6, 0.1, lam(c.nozzle), 10, g); nozzle.rotation.x = Math.PI / 2; nozzle.position.z = -len / 2 - 0.05;
    const jetInfo = M.makeJet(g, r, len), jet = jetInfo.group;   // jet de tuyère (partagé avec la roquette réaliste)
    g.userData.jet = jetInfo;
    for (let i = 0; i < d.fins; i++) {
      const f = new THREE.Group(); f.rotation.z = i * Math.PI * 2 / d.fins + Math.PI / 4; g.add(f);
      box(d.finW, d.finH, d.finH * 1.1, lam(c.fin), 0, r + d.finH * 0.35, d.finPos * fs, f);
    }
    // v026 : points de départ des traînées (coin arrière extérieur de chaque aileron) et pointe du nez, repère local
    g.userData.finTips = [];
    for (let i = 0; i < d.fins; i++) {
      const a = i * Math.PI * 2 / d.fins + Math.PI / 4, y = r + d.finH * 0.85;
      g.userData.finTips.push(new THREE.Vector3(-y * Math.sin(a), y * Math.cos(a), d.finPos * fs - d.finH * 0.55));
    }
    g.userData.noseZ = len / 2 + nl;
    // pièces rapportées propres au cosmétique (anneaux, oreilles, miettes de croissant…)
    for (const p of (skin && skin.parts) || []) {
      const mat = p.basic ? basic(p.c) : lam(p.c);
      let m;
      if (p.k === 'box') m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
      else if (p.k === 'sph') m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 8, 6), mat);
      else m = new THREE.Mesh(new THREE.CylinderGeometry(p.r2 !== undefined ? p.r2 : p.r, p.r, p.h, p.seg || 10), mat);
      m.position.fromArray(p.p || [0, 0, 0]);
      const rot = p.rot || [0, 0, 0];
      m.rotation.set(rot[0] * D2R, rot[1] * D2R, rot[2] * D2R);
      m.castShadow = p.cast !== false && !p.basic; m.receiveShadow = true;
      g.add(m);
    }
    if (d.scale !== 1) g.scale.setScalar(d.scale);
    // petites buses de rétro-fusées (visuelles)
    g.userData.nozzleZ = -0.53;
    return bake(g, [jet]);   // design : ~30 pièces → quelques appels de dessin
  };

  // Lanceur à l'épaule vu à la 1re personne (OBSERVÉ séq. 2–7 : tube sombre en bas au centre).
  M.shoulderLauncher = function () {
    const g = new THREE.Group();
    const tube = cyl(0.13, 0.13, 1.3, lam('#3c3d41'), 12, g); tube.rotation.x = Math.PI / 2; tube.position.z = -0.35;
    const rear = cyl(0.17, 0.15, 0.3, lam('#1c1d1f'), 12, g); rear.rotation.x = Math.PI / 2; rear.position.z = 0.35;
    box(0.1, 0.12, 0.25, lam('#3a3b3f'), 0, 0.17, -0.1, g);
    box(0.025, 0.025, 0.025, basic('#e0802a'), 0, 0.24, -0.08, g);
    box(0.08, 0.22, 0.1, lam('#1c1d1f'), 0, -0.16, -0.05, g);
    const muzzle = cyl(0.14, 0.14, 0.06, lam('#4a4b50'), 12, g); muzzle.rotation.x = Math.PI / 2; muzzle.position.z = -1.0;
    // design : colliers, bande jaune de sécurité près de la bouche, lunette (objectif bleuté), poignée avant, pavillon arrière
    for (const z of [-0.75, 0.05]) cylZ(0.14, 0.14, 0.05, lam('#2a2b2e'), 12, 0, 0, z, g);
    cylZ(0.135, 0.135, 0.06, basic('#c8a020'), 12, 0, 0, -0.9, g);
    cylZ(0.045, 0.05, 0.3, lam('#1c1d1f'), 8, 0.14, 0.22, -0.1, g);
    const lens = cylZ(0.04, 0.04, 0.01, basic('#3a6a9a'), 8, 0.14, 0.22, -0.26, g); lens.castShadow = false;
    box(0.06, 0.08, 0.1, lam('#2a2b2e'), 0.08, 0.17, -0.1, g);
    const fg = box(0.06, 0.2, 0.08, lam('#1c1d1f'), 0, -0.2, -0.55, g); fg.rotation.x = 0.25;
    cylZ(0.17, 0.2, 0.08, lam('#1c1d1f'), 12, 0, 0, 0.52, g);
    g.userData.bore = boreRing(g, 0.13, 0.25, '#3c3d41', 0.3, -1.0);
    return g;
  };

  /* v024 : anneau de renflement pour l'animation de tir : le tube gonfle sur les côtés, de l'arrière (z0) vers la bouche
   * (z1), comme si le missile le traversait. Caché au repos ; animé par Game.updateLaunchFx. */
  function boreRing(parent, r, len, color, z0, z1) {
    const ring = cyl(r, r, len, lam(color), 12, parent);
    ring.rotation.x = Math.PI / 2; ring.visible = false; ring.castShadow = false;
    return { ring, z0, z1 };
  }

  // Lanceur sur trépied (OBSERVÉ séq. 1 : tube noir, fente rouge à l'arrière).
  M.tripodLauncher = function () {
    const g = new THREE.Group();
    const head = new THREE.Group(); head.position.y = 1.0; g.add(head);
    const tube = cyl(0.2, 0.2, 1.6, lam('#1e1f22'), 12, head); tube.rotation.x = Math.PI / 2;
    const back = box(0.44, 0.44, 0.2, lam('#18191b'), 0, 0, 0.8, head);
    box(0.16, 0.24, 0.02, basic('#8a2a2a'), 0, 0, 0.91, head);
    box(0.12, 0.3, 0.12, lam('#18191b'), 0, 0.3, 0.2, head);
    for (let i = 0; i < 3; i++) {
      const leg = box(0.07, 1.25, 0.07, lam('#222326'), 0, 0, 0, g);
      const a = i * Math.PI * 2 / 3;
      leg.position.set(Math.sin(a) * 0.35, 0.5, Math.cos(a) * 0.35);
      leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    }
    // design : colliers et bouche renforcée, viseur, câble de mise à feu, patins au bout des pieds
    for (const z of [-0.55, 0.1, 0.55]) cylZ(0.215, 0.215, 0.06, lam('#2c2d30'), 12, 0, 0, z, head);
    cylZ(0.24, 0.22, 0.12, lam('#2c2d30'), 12, 0, 0, -0.78, head);
    box(0.08, 0.14, 0.3, lam('#2c2d30'), 0.24, 0.16, -0.1, head);
    cylZ(0.05, 0.05, 0.02, basic('#3a6a9a'), 8, 0.24, 0.18, -0.26, head).castShadow = false;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      box(0.16, 0.04, 0.16, lam('#1a1b1d'), Math.sin(a) * 0.56, -0.08 + 0.02, Math.cos(a) * 0.56, g);
    }
    const cable = cylZ(0.015, 0.015, 1.1, lam('#111'), 4, 0.15, 0.55, 0.7, g); cable.rotation.x = Math.PI / 2 + 0.9;
    g.userData.head = head;
    g.userData.bore = boreRing(head, 0.2, 0.35, '#1e1f22', 0.7, -0.8);
    return g;
  };

  /* Profil extrudé : forme 2D [u, v] (u le long de l'axe Z du monde, v en hauteur) épaisse de `w` le long de X, centrée.
   * Sert aux silhouettes (chenilles, fuselage, dérive) : une seule géométrie au lieu d'un empilement de boîtes. */
  function profileX(points, w, mat, bevel, parent) {
    const sh = new THREE.Shape();
    points.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    const b = bevel || 0;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, w - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 1 });
    geo.translate(0, 0, -(w - 2 * b) / 2);
    geo.rotateY(-Math.PI / 2);                      // u → Z du monde, épaisseur → X
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  // Plaque vue de dessus : contour [x, z] extrudé vers le haut sur `h` (tourelle, capots)
  function plateY(points, h, mat, bevel, parent) {
    const sh = new THREE.Shape();
    points.forEach((p, i) => (i ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1])));
    const b = bevel || 0;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 1 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, b, 0);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function cylX(r1, r2, h, mat, seg, x, y, z, parent) { const m = cyl(r1, r2, h, mat, seg, parent); m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m; }
  function cylZ(r1, r2, h, mat, seg, x, y, z, parent) { const m = cyl(r1, r2, h, mat, seg, parent); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; }

  /* Char (OBSERVÉ : vert foncé, tourelle qui suit la roquette). Design : silhouette de char moderne stylisée —
   * chenilles profilées (galets, barbotin, poulie, rouleaux), garde-boue, caisse à glacis incliné, pont moteur à grilles,
   * pots d'échappement, phares, coffres ; tourelle à pans coupés (masque, tourelleau, mitrailleuse, antenne,
   * lance-fumigènes, panier arrière) ; canon (évacuateur, frein de bouche) sur glissière de recul.
   * variant : 0..2 (teinte). Avant = −Z. Toutes les pièces reposent sur la caisse (pas d'intersection visible). */
  const TANK_PAL = [
    { hull: '#3d4c36', dark: '#2b3727', light: '#56654b', camo: '#2a3322' },
    { hull: '#4b4a36', dark: '#36352a', light: '#62614a', camo: '#35301f' },
    { hull: '#36453b', dark: '#27322b', light: '#4b5b50', camo: '#232c25' },
  ];
  M.tank = function (variant) {
    const P = TANK_PAL[(variant || 0) % TANK_PAL.length];
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);              // caisse (légères vibrations moteur, bascule au tir)
    const hull = lam(P.hull), dark = lam(P.dark), light = lam(P.light), camo = lam(P.camo);
    const track = lam('#1c1d1b'), wheel = lam('#31342f'), hub = lam('#1f211e'), metal = lam('#2d2f2c');
    // --- chenilles : profil (poulie avant relevée, barbotin arrière), galets en saillie sur la face extérieure ---
    const tp = [[2.55, 0.02], [-2.45, 0.02], [-2.95, 0.42], [-2.85, 0.78], [2.75, 0.84], [3.0, 0.5]];
    for (const sx of [-1, 1]) {
      const x = sx * 1.5;
      const t = profileX(tp, 0.66, track, 0.05, body); t.position.x = x;
      for (let i = 0; i < 6; i++) {
        const z = -1.95 + i * 0.86;
        cylX(0.31, 0.31, 0.16, wheel, 12, sx * 1.86, 0.34, z, body);
        cylX(0.12, 0.12, 0.18, hub, 8, sx * 1.9, 0.34, z, body);
      }
      cylX(0.3, 0.3, 0.18, metal, 9, sx * 1.86, 0.52, 2.72, body);           // barbotin (arrière)
      cylX(0.26, 0.26, 0.16, wheel, 12, sx * 1.86, 0.5, -2.72, body);        // poulie de tension (avant)
      for (const z of [-1.2, 0.2, 1.6]) cylX(0.08, 0.08, 0.12, hub, 6, sx * 1.84, 0.76, z, body);   // rouleaux porteurs
      box(0.74, 0.07, 5.9, dark, x + sx * 0.02, 0.92, 0.02, body);            // garde-boue
      box(0.05, 0.3, 4.9, hull, sx * 1.9, 0.76, -0.1, body).castShadow = true; // jupe latérale (cache le haut des galets)
      box(0.5, 0.32, 1.0, light, sx * 1.52, 1.12, 1.1, body);                // coffre de rangement
      box(0.28, 0.4, 0.2, dark, sx * 1.6, 1.16, 1.85, body);                 // jerrican
      const hl = box(0.2, 0.14, 0.12, basic('#fff2c8'), sx * 1.35, 1.05, -2.9, body); hl.castShadow = false;   // phares
      box(0.28, 0.2, 0.08, metal, sx * 1.35, 1.05, -2.84, body);
      box(0.25, 0.14, 0.3, metal, sx * 0.85, 0.88, 2.95, body);              // pot d'échappement
    }
    // --- caisse ---
    box(2.3, 0.72, 5.3, dark, 0, 0.62, 0, body);                              // caisse basse entre les chenilles
    box(2.62, 0.46, 3.9, hull, 0, 1.18, 0.45, body);                          // superstructure
    const glacis = box(2.62, 0.14, 1.55, hull, 0, 0.96, -2.12, body); glacis.rotation.x = -0.42;   // glacis incliné
    box(2.4, 0.4, 0.14, dark, 0, 0.55, -2.72, body);                          // plaque avant basse
    for (let i = 0; i < 4; i++) box(0.5, 0.06, 0.28, metal, -0.75 + i * 0.5, 1.02, -2.25, body).rotation.x = -0.42;   // maillons de rechange
    for (let i = 0; i < 5; i++) box(2.2, 0.04, 0.1, metal, 0, 1.42, 1.55 + i * 0.22, body);    // grilles du pont moteur
    box(2.5, 0.5, 0.12, dark, 0, 1.12, 2.44, body);                           // plaque arrière
    box(0.5, 0.12, 0.2, metal, -0.7, 0.7, -2.82, body); box(0.5, 0.12, 0.2, metal, 0.7, 0.7, -2.82, body);   // crochets de remorquage
    // --- tourelle ---
    const turret = new THREE.Group(); turret.name = 'turret'; turret.position.set(0, 1.41, 0.1); body.add(turret);
    cyl(1.08, 1.12, 0.12, metal, 16, turret).position.y = 0.06;                                    // couronne
    plateY([[-0.62, -1.42], [0.62, -1.42], [1.18, -0.55], [1.2, 0.95], [0.9, 1.4], [-0.9, 1.4], [-1.2, 0.95], [-1.18, -0.55]], 0.62, hull, 0.07, turret).position.y = 0.1;
    box(1.9, 0.02, 1.2, camo, 0.2, 0.73, 0.35, turret);                                            // tache de camouflage (toit)
    box(0.02, 0.35, 1.1, camo, 1.21, 0.42, 0.2, turret); box(0.02, 0.3, 0.9, camo, -1.21, 0.4, -0.1, turret);
    box(0.95, 0.5, 0.3, dark, 0, 0.42, -1.5, turret);                                              // masque du canon
    const cup = cyl(0.3, 0.33, 0.24, hull, 12, turret); cup.position.set(0.48, 0.84, 0.4);           // tourelleau
    const hatch = cyl(0.29, 0.29, 0.05, dark, 12, turret); hatch.position.set(0.48, 0.99, 0.62); hatch.rotation.x = -1.2;   // trappe entrouverte
    for (let i = 0; i < 5; i++) { const a = -1.2 + i * 0.6; box(0.1, 0.07, 0.04, basic('#1a2630'), 0.48 + Math.sin(a) * 0.33, 0.86, 0.4 - Math.cos(a) * 0.33, turret).rotation.y = a; }   // épiscopes
    box(0.48, 0.05, 0.48, dark, -0.45, 0.74, 0.25, turret);                                       // trappe du chargeur
    box(0.06, 0.26, 0.06, metal, 0.48, 1.07, 0.18, turret);                                       // support de mitrailleuse
    cylZ(0.035, 0.035, 0.9, metal, 6, 0.48, 1.18, -0.2, turret);                                  // mitrailleuse
    box(0.12, 0.12, 0.3, metal, 0.48, 1.18, 0.2, turret);
    const ant = cyl(0.014, 0.02, 2.4, metal, 4, turret); ant.position.set(-0.85, 1.9, 1.15); ant.rotation.x = 0.12;   // antenne
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {                                         // lance-fumigènes
      const tb = cyl(0.06, 0.06, 0.28, metal, 6, turret); tb.position.set(sx * (1.1 + i * 0.02), 0.55 + i * 0.1, -0.75);
      tb.rotation.set(-0.9, 0, -sx * 0.5);
    }
    // panier de rangement arrière (cadre) + sacs
    box(2.0, 0.04, 0.04, metal, 0, 0.62, 1.78, turret); box(2.0, 0.04, 0.04, metal, 0, 0.3, 1.78, turret);
    box(0.04, 0.36, 0.04, metal, -1.0, 0.46, 1.66, turret); box(0.04, 0.36, 0.04, metal, 1.0, 0.46, 1.66, turret);
    box(0.7, 0.28, 0.35, lam('#5a5440'), -0.45, 0.44, 1.6, turret); box(0.55, 0.24, 0.32, lam('#4a4a3a'), 0.4, 0.42, 1.6, turret);
    // --- canon : pivot (hausse) → glissière (recul) → tube ---
    const gunPivot = new THREE.Group(); gunPivot.position.set(0, 0.42, -1.55); turret.add(gunPivot);
    const slide = new THREE.Group(); gunPivot.add(slide);
    cylZ(0.13, 0.15, 0.6, dark, 10, 0, 0, -0.2, slide);                     // berceau
    cylZ(0.095, 0.11, 3.5, hull, 10, 0, 0, -1.9, slide);                     // tube
    cylZ(0.16, 0.16, 0.55, dark, 10, 0, 0, -1.75, slide);                    // évacuateur de fumées
    box(0.3, 0.2, 0.36, dark, 0, 0, -3.62, slide);                           // frein de bouche
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -3.85); slide.add(muzzle);
    g.userData.turret = turret; g.userData.gun = gunPivot; g.userData.slide = slide; g.userData.muzzle = muzzle; g.userData.body = body;
    g.userData.exhausts = [new V(-0.85, 0.88, 3.12), new V(0.85, 0.88, 3.12)];
    g.userData.size = [3.9, 2.9, 6.2]; g.userData.center = [0, 1.3, 0];
    return bake(g, [body, turret, gunPivot, slide]);
  };

  /* Hélicoptère (séq. 1 : noir ; séq. 6 : camouflé). Axe −Z = avant. Design : fuselage profilé (nez, verrière, dos, soute),
   * capot moteur + entrées d'air + échappements, mât et moyeu, 4 pales légèrement fléchies + disque flou, poutre de queue
   * effilée, dérive, stabilisateur, rotor anticouple, patins sur jambes de force, boule optronique, feux (rouge à gauche,
   * vert à droite, blanc à la queue, gyrophare rouge). Camouflé : ailettes + paniers de roquettes. */
  M.helicopter = function (camo) {
    const g = new THREE.Group();
    const skin = camo ? CC.Look.lam({ map: CC.Textures.get('camo') }) : lam('#1f2024');
    const trim = lam(camo ? '#4a4f35' : '#2b2d32'), dark = lam('#141416'), metal = lam('#3a3c40');
    const glass = CC.Look.glass({ color: '#1c2c3e', specular: '#9ab8d8', shininess: 60 });
    // fuselage (profil extrudé, arêtes chanfreinées)
    profileX([[-3.9, -0.12], [-3.55, -0.58], [-2.6, -0.86], [1.9, -0.86], [2.75, -0.35], [2.6, 0.55], [1.2, 0.86], [-1.4, 0.86], [-2.35, 0.6], [-3.55, 0.15]], 1.7, skin, 0.18, g);
    profileX([[-3.66, 0.08], [-2.34, 0.66], [-1.36, 0.9], [-1.28, 0.02], [-2.95, -0.28], [-3.74, -0.14]], 1.76, glass, 0.12, g);   // verrière
    box(1.78, 0.05, 1.9, trim, 0, -0.1, 0.15, g);                                        // ligne de porte (bas)
    box(1.78, 1.0, 0.05, trim, 0, 0.3, -0.85, g); box(1.78, 1.0, 0.05, trim, 0, 0.3, 1.15, g);   // montants de porte
    // capot moteur, entrées d'air, échappements
    box(1.15, 0.5, 2.5, skin, 0, 1.1, 0.35, g);
    box(1.2, 0.3, 0.3, dark, 0, 1.08, -0.95, g);
    for (const sx of [-1, 1]) { const ex = cylZ(0.14, 0.17, 0.5, dark, 8, sx * 0.45, 1.12, 1.75, g); ex.rotation.y = sx * 0.3; }
    // mât + moyeu
    cyl(0.11, 0.14, 0.42, metal, 8, g).position.set(0, 1.55, -0.1);
    const rotor = new THREE.Group(); rotor.position.set(0, 1.78, -0.1); g.add(rotor);
    box(0.5, 0.14, 0.5, metal, 0, 0, 0, rotor);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 2; rotor.add(arm);
      const bl = box(5.3, 0.05, 0.32, dark, 2.85, -0.06, 0, arm); bl.rotation.z = -0.025; bl.castShadow = true;   // pale fléchie
    }
    const blur = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), new THREE.MeshBasicMaterial({ color: '#0e0f10', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    blur.rotation.x = -Math.PI / 2; blur.position.set(0, 1.72, -0.1); g.add(blur);
    // queue
    cylZ(0.2, 0.42, 4.9, skin, 10, 0, 0.32, 4.9, g);
    profileX([[6.6, 0.25], [7.45, 2.05], [8.0, 2.05], [7.75, 0.2]], 0.14, skin, 0.03, g);          // dérive
    box(2.5, 0.08, 0.55, skin, 0, 0.3, 6.5, g);                                                  // stabilisateur
    box(0.06, 0.45, 0.5, skin, 1.25, 0.3, 6.5, g); box(0.06, 0.45, 0.5, skin, -1.25, 0.3, 6.5, g);
    const tail = new THREE.Group(); tail.position.set(0.22, 1.35, 7.72); g.add(tail);
    box(0.05, 1.8, 0.2, dark, 0, 0, 0, tail); box(0.05, 0.2, 1.8, dark, 0, 0, 0, tail);
    const tailBlur = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), new THREE.MeshBasicMaterial({ color: '#0e0f10', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    tailBlur.rotation.y = Math.PI / 2; tailBlur.position.set(0.25, 1.35, 7.72); g.add(tailBlur);
    // patins et jambes de force
    for (const sx of [-1, 1]) {
      cylZ(0.055, 0.055, 3.7, metal, 6, sx * 0.98, -1.38, -0.1, g);
      const tip = cylZ(0.055, 0.055, 0.55, metal, 6, sx * 0.98, -1.26, -2.15, g); tip.rotation.x = Math.PI / 2 + 0.55;
      for (const z of [-1.0, 0.9]) { const st = box(0.07, 0.6, 0.07, metal, sx * 0.9, -1.1, z, g); st.rotation.z = sx * 0.25; }
    }
    // boule optronique sous le nez
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), dark); ball.position.set(0, -0.62, -3.25); g.add(ball);
    box(0.16, 0.1, 0.05, basic('#2a4a6a'), 0, -0.62, -3.48, g);
    // feux : rouge à gauche, vert à droite, blanc à la queue, gyrophare rouge sur le capot (clignotant : Target.update)
    const light = (c, x, y, z) => { const m = box(0.12, 0.12, 0.12, new THREE.MeshBasicMaterial({ color: c }), x, y, z, g); m.castShadow = false; return m; };
    const lights = [light('#ff2a1a', -0.92, 0.25, -1.9), light('#2aff5a', 0.92, 0.25, -1.9), light('#ffffff', 0, 0.3, 7.35)];
    const beacon = light('#ff1a10', 0, 1.4, 0.9);
    const firePoints = [];
    if (camo) {
      box(3.6, 0.12, 0.85, skin, 0, -0.25, -0.2, g);                                           // ailettes
      for (const sx of [-1, 1]) {
        cylZ(0.24, 0.24, 1.35, dark, 8, sx * 1.75, -0.48, -0.25, g);                            // paniers de roquettes
        cylZ(0.2, 0.2, 0.05, lam('#0a0a0a'), 8, sx * 1.75, -0.48, -0.95, g);
        box(0.08, 0.25, 0.4, skin, sx * 1.75, -0.28, -0.25, g);
        firePoints.push(new V(sx * 1.75, -0.48, -1.05));
      }
    } else {
      for (const sx of [-1, 1]) { box(0.7, 0.08, 0.35, skin, sx * 1.15, -0.3, -0.2, g); cylZ(0.14, 0.14, 1.0, dark, 8, sx * 1.45, -0.42, -0.2, g); firePoints.push(new V(sx * 1.45, -0.42, -0.75)); }
    }
    g.userData.rotor = rotor; g.userData.tailRotor = tail; g.userData.blur = blur; g.userData.tailBlur = tailBlur;
    g.userData.lights = lights; g.userData.beacon = beacon; g.userData.firePoints = firePoints;
    g.userData.size = [3.0, 3.2, 12.5]; g.userData.center = [0, 0.1, 2.0];
    for (const l of lights.concat([beacon])) l.userData.noBake = true;   // feux clignotants : restent des objets à part
    return bake(g, [rotor, tail]);
  };

  // Camion / générateur (séq. 4). Design : cabine vitrée à capot, châssis, roues à moyeux dans des passages de roue,
  // caisse bâchée à arceaux, générateur à ailettes, pare-chocs, phares, rétroviseurs, échappement vertical. Avant = −Z.
  M.truck = function () {
    const g = new THREE.Group();
    const olive = lam('#5d5f3e'), oliveD = lam('#4b4d33'), frame = lam('#2e2f24'), tire = lam('#141414'), hubM = lam('#3a3a32');
    const glass = CC.Look.glass({ color: '#233040', specular: '#8aa0b8', shininess: 50 });
    box(2.1, 0.28, 4.9, frame, 0, 0.72, 0, g);                                            // châssis
    box(2.35, 0.3, 0.2, frame, 0, 0.7, -2.5, g);                                          // pare-chocs
    box(2.2, 1.35, 1.35, olive, 0, 1.55, -1.55, g);                                       // cabine
    box(2.0, 0.62, 0.7, oliveD, 0, 1.12, -2.5, g);                                        // capot
    box(1.9, 0.6, 0.05, glass, 0, 1.92, -2.24, g);                                        // pare-brise
    box(0.05, 0.5, 0.8, glass, 1.11, 1.9, -1.6, g); box(0.05, 0.5, 0.8, glass, -1.11, 1.9, -1.6, g);   // vitres latérales
    for (const sx of [-1, 1]) {
      box(0.06, 0.3, 0.2, frame, sx * 1.22, 1.85, -2.15, g);                              // rétroviseur
      const hl = box(0.22, 0.18, 0.06, basic('#fff0c8'), sx * 0.75, 1.12, -2.86, g); hl.castShadow = false;
      box(0.35, 0.4, 0.75, frame, sx * 1.05, 0.95, -1.5, g);                              // passage de roue
    }
    const exh = cyl(0.07, 0.07, 1.4, frame, 6, g); exh.position.set(1.0, 2.2, -0.85);     // échappement vertical
    // caisse arrière bâchée (arceaux visibles) + générateur
    box(2.2, 0.12, 3.2, oliveD, 0, 0.92, 0.85, g);
    box(2.24, 1.5, 3.1, lam('#6a6a48'), 0, 1.75, 0.95, g);
    for (let i = 0; i < 4; i++) box(2.28, 0.06, 0.08, oliveD, 0, 2.52, -0.45 + i * 0.95, g);
    const fr = lam('#c0784e');
    box(0.18, 2.6, 0.18, fr, -1.2, 1.3, -2.4, g); box(0.18, 2.6, 0.18, fr, 1.2, 1.3, -2.4, g); box(2.6, 0.18, 0.18, fr, 0, 2.6, -2.4, g);   // portique (OBSERVÉ)
    for (let i = 0; i < 6; i++) box(0.04, 0.9, 0.9, frame, -1.13, 1.75, 0.2 + i * 0.3, g);   // ailettes du générateur
    for (const sx of [-1.05, 1.05]) for (const sz of [-1.5, 0.6, 1.6]) {
      const w = cyl(0.44, 0.44, 0.32, tire, 12, g); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.12, 0.44, sz);
      const h = cyl(0.2, 0.2, 0.34, hubM, 8, g); h.rotation.z = Math.PI / 2; h.position.set(sx * 1.12, 0.44, sz);
    }
    g.userData.size = [2.8, 2.9, 5]; g.userData.center = [0, 1.4, 0];
    return bake(g);
  };

  // Maison (séq. 7). Design : murs, pignons fermés, toit à deux pans avec débord et faîtage, cheminée à chapeau, fenêtres à
  // encadrement et croisillons (vitres éclairées de l'intérieur, la nuit), porte encadrée avec marche, soubassement.
  M.house = function () {
    const g = new THREE.Group();
    const wall = lam('#8e8f94'), trimM = lam('#b8b6ae'), base = lam('#5d5e62');
    box(6, 4, 7.5, wall, 0, 2, 0, g);
    box(6.1, 0.5, 7.6, base, 0, 0.25, 0, g);                                                  // soubassement
    const roofMat = CC.Look.lam({ map: CC.Textures.get('roofBrown') });
    const r1 = box(4.5, 0.25, 8.3, roofMat, -1.6, 5.1, 0, g); r1.rotation.z = 0.62;
    const r2 = box(4.5, 0.25, 8.3, roofMat, 1.6, 5.1, 0, g); r2.rotation.z = -0.62;
    box(0.35, 0.3, 8.4, lam('#4d2618'), 0, 6.42, 0, g);                                       // faîtage
    // pignons : triangles pleins (plus de mur rectangulaire qui dépasse du toit)
    const gable = new THREE.Shape(); gable.moveTo(-3, 0); gable.lineTo(3, 0); gable.lineTo(0, 2.2); gable.lineTo(-3, 0);
    for (const z of [-3.75, 3.75]) { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), wall); m.position.set(0, 4, z - 0.1); m.castShadow = true; g.add(m); }
    box(0.8, 1.9, 0.8, lam('#6f6f74'), 1.5, 6.2, -1.5, g); box(1.0, 0.12, 1.0, lam('#4a4a4e'), 1.5, 7.2, -1.5, g);   // cheminée
    const lit = basic('#e8c878');
    const win = (x, y, z, rotY) => {
      const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = rotY || 0; g.add(w);
      box(1.3, 1.1, 0.08, trimM, 0, 0, 0, w); box(1.1, 0.9, 0.1, lit, 0, 0, 0.01, w);
      box(0.06, 0.9, 0.12, trimM, 0, 0, 0.02, w); box(1.1, 0.06, 0.12, trimM, 0, 0, 0.02, w);
      box(1.45, 0.1, 0.25, trimM, 0, -0.6, 0.08, w);
    };
    win(-1.8, 2.3, 3.78); win(1.8, 2.3, 3.78); win(-1.8, 2.3, -3.78, Math.PI); win(1.2, 2.3, -3.78, Math.PI);
    win(3.03, 2.3, -1.5, Math.PI / 2); win(3.03, 2.3, 1.8, Math.PI / 2); win(-3.03, 2.3, 0, -Math.PI / 2);
    box(1.25, 2.15, 0.1, trimM, 0, 1.2, 3.78, g); box(1.0, 1.95, 0.12, lam('#3a3030'), 0, 1.15, 3.8, g);   // porte
    box(1.6, 0.18, 0.7, base, 0, 0.55, 4.1, g);                                                 // marche
    g.userData.size = [6.4, 7, 8]; g.userData.center = [0, 3, 0];
    return bake(g);
  };

  // Soldat avec lance-missile (séq. 3). Design : casque, gilet, sac, bottes, bras qui tiennent le tube, visée.
  M.soldier = function () {
    const g = new THREE.Group();
    const cloth = lam('#2c3036'), light = lam('#c9ccd1'), vest = lam('#4a4e44'), skin = lam('#b89a80'), boot = lam('#16171a');
    box(0.22, 0.8, 0.24, cloth, -0.14, 0.48, 0, g); box(0.22, 0.8, 0.24, cloth, 0.14, 0.48, 0, g);
    box(0.24, 0.14, 0.34, boot, -0.14, 0.07, -0.04, g); box(0.24, 0.14, 0.34, boot, 0.14, 0.07, -0.04, g);
    box(0.62, 0.72, 0.34, light, 0, 1.2, 0, g);
    box(0.66, 0.46, 0.38, vest, 0, 1.28, 0, g);
    box(0.46, 0.5, 0.22, vest, 0, 1.25, 0.28, g);                                              // sac
    box(0.26, 0.26, 0.26, skin, 0, 1.7, 0, g);
    const helm = cyl(0.2, 0.22, 0.16, vest, 8, g); helm.position.set(0, 1.86, 0);
    box(0.16, 0.55, 0.16, cloth, -0.36, 1.35, -0.2, g).rotation.x = -1.0;                     // bras vers le tube
    box(0.16, 0.55, 0.16, cloth, 0.36, 1.4, -0.12, g).rotation.x = -0.7;
    const tube = cyl(0.1, 0.1, 1.3, lam('#1e1f22'), 8, g); tube.rotation.x = Math.PI / 2; tube.position.set(0.3, 1.62, -0.1);
    cylZ(0.13, 0.13, 0.2, lam('#2a2b2e'), 8, 0.3, 1.62, -0.72, g);                              // bouche du tube
    box(0.06, 0.12, 0.2, lam('#2a2b2e'), 0.3, 1.75, -0.25, g);                                  // viseur
    g.userData.size = [0.9, 2.0, 0.8]; g.userData.center = [0, 1.0, 0];
    return bake(g);
  };

  // Missile ennemi. Design : corps clair, bande rouge, ogive sombre, 4 ailettes arrière + 4 canards, tuyère lumineuse.
  M.enemyMissile = function () {
    const g = new THREE.Group();
    const b = cyl(0.06, 0.06, 0.62, lam('#d8d8d4'), 8, g); b.rotation.x = Math.PI / 2;
    const nose = cyl(0.005, 0.06, 0.18, lam('#3a3c40'), 8, g); nose.rotation.x = Math.PI / 2; nose.position.z = 0.4;
    const band = cyl(0.064, 0.064, 0.05, basic('#c8201a'), 8, g); band.rotation.x = Math.PI / 2; band.position.z = 0.2;
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.rotation.z = i * Math.PI / 2 + Math.PI / 4; g.add(f);
      box(0.015, 0.1, 0.12, lam('#555'), 0, 0.1, -0.26, f);
      box(0.012, 0.05, 0.05, lam('#555'), 0, 0.075, 0.25, f);
    }
    const glow = cyl(0.045, 0.02, 0.22, new THREE.MeshBasicMaterial({ color: '#ffd070', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 8, g);
    glow.rotation.x = -Math.PI / 2; glow.position.z = -0.42; glow.castShadow = false;
    g.userData.glow = glow;
    return g;
  };

  // Disque d'accroche du grappin (OBSERVÉ séq. 1 : anneaux rouge/blanc/orange).
  M.bullseye = function (radius) {
    const face = CC.Look.lam({ map: CC.Textures.special('bullseye') });
    const side = lam('#8a2a20');
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.25, 24), [side, face, face]);
    m.castShadow = true;
    return m;
  };

  // Flèche verte (séq. 6).
  M.arrow = function () {
    const g = new THREE.Group();
    const mat = basic('#1fbf22');
    box(1.2, 3.2, 0.3, mat, 0, 2.4, 0, g);
    const shape = new THREE.Shape(); shape.moveTo(-1.6, 0); shape.lineTo(1.6, 0); shape.lineTo(0, -2.0); shape.lineTo(-1.6, 0);
    const head = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), mat);
    head.position.set(0, 0.8, -0.15); g.add(head);
    g.traverse((o) => { o.castShadow = false; });
    return g;
  };

  // v023 : flèche de chemin (niveaux 1 à 3) : flèche plate verte, pointe vers +Z, lumineuse (visible de nuit comme de jour)
  M.guideArrow = function () {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#35ff4a', transparent: true, opacity: 0.85, depthWrite: false });
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 1.6); shape.lineTo(0.5, 1.6); shape.lineTo(0.5, 0); shape.lineTo(1.5, 0); shape.lineTo(0, -1.8); shape.lineTo(-1.5, 0); shape.lineTo(-0.5, 0); shape.lineTo(-0.5, 1.6);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }), mat);
    m.rotation.x = -Math.PI / 2;   // à plat : la pointe (−Y de la forme) passe vers +Z
    g.add(m);
    g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    return g;
  };

  // Sprites : "!" rouge au-dessus des ennemis et point rouge de cible.
  let alertTex = null, dotTex = null;
  M.alertSprite = function () {
    if (!alertTex) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 32;
      const g = c.getContext('2d'); g.fillStyle = '#ff2a1a';
      g.fillRect(5, 1, 6, 20); g.fillRect(5, 25, 6, 6);
      alertTex = new THREE.CanvasTexture(c); alertTex.magFilter = THREE.NearestFilter;
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTex, depthTest: false, transparent: true }));
    s.scale.set(0.7, 1.4, 1); s.renderOrder = 10;
    return s;
  };
  M.targetDot = function () {
    if (!dotTex) {
      const c = document.createElement('canvas'); c.width = 4; c.height = 4;
      const g = c.getContext('2d'); g.fillStyle = '#ff1e1e'; g.fillRect(1, 1, 2, 2);
      dotTex = new THREE.CanvasTexture(c); dotTex.magFilter = THREE.NearestFilter;
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, depthTest: false, transparent: true, sizeAttenuation: false }));
    s.scale.set(0.012, 0.012, 1); s.renderOrder = 11;
    return s;
  };

  // vide le cache des matériaux (changement de style visuel) : les modèles construits ensuite utilisent les nouveaux
  M.resetMaterials = function () { for (const k in mats) { if (mats[k].dispose) mats[k].dispose(); delete mats[k]; } if (vcMaterial) { vcMaterial.dispose(); vcMaterial = null; } };
  M.kit = { lam, metal, basic, box, cyl, cylX, cylZ, profileX, plateY };   // v032 : pièces partagées avec models_gen.js
  CC.Models = M;
})();
