/* Constructeur de niveaux : géométrie statique fusionnée par matériau (peu d'appels de dessin),
 * UV en mètres (textures alignées aux arêtes), colliders ajoutés au monde physique. */
(function () {
  const V = THREE.Vector3;
  const U = CC.U;

  // Lot de sommets accumulé → BufferGeometry indexée.
  function geometryFromBatch(b) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.setIndex(b.idx.length > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
    g.computeBoundingSphere();
    return g;
  }

  class LevelBuilder {
    constructor(scene, world, level) {
      this.scene = scene; this.world = world; this.level = level;
      this.batches = new Map();
      this.materials = new Map();
      this.root = new THREE.Group(); this.root.name = 'level';
      scene.add(this.root);
      this.entities = [];          // objets dynamiques (update/dispose)
      this.destructibles = [];
      this.targets = [];
      this.grapplePoints = [];
      this.rng = U.makeRng(level.seed || 7);
      this.deco = U.makeRng((level.seed || 7) * 31 + 5);   // design : hasard des détails de décor (n'altère pas this.rng)
      this.buildings = [];        // design : immeubles repérés (façade + toit) → toits et rez-de-chaussée décorés dans finish()
      this.groundAt = null;       // design : hauteur du terrain (définie par terrain())
      this._e = new THREE.Euler();
    }

    // ---------- Matériaux ----------
    mat(key) {
      if (this.materials.has(key)) return this.materials.get(key);
      let m;
      const L = CC.Look;
      if (key.startsWith('basic:')) m = new THREE.MeshBasicMaterial({ color: key.slice(6), fog: true });
      else if (key.startsWith('col:')) m = L.lam({ color: key.slice(4), vertexColors: true });
      else if (key === 'glass') m = L.glassPane({ color: '#8fd0ff', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
      else if (key === 'glassWarm') m = L.glassPane({ color: '#d8d28a', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
      else if (key.startsWith('emis:')) m = L.lam({ color: key.slice(5), emissive: key.slice(5), emissiveIntensity: 0.8 });
      else if (key.startsWith('cloud:')) m = new THREE.MeshBasicMaterial({ color: key.slice(6), fog: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
      else if (key === 'chainlink') m = L.lam({ map: CC.Textures.get(key), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }, { roughness: 0.5, metalness: 0.6, env: 0.8 });   // v032 : grillage (on voit à travers)
      else if (key === 'water') m = L.lam({ map: CC.Textures.get(key), vertexColors: true, emissive: '#0a1820', emissiveIntensity: 0.4 }, { roughness: 0.1, metalness: 0.3, env: 1.3 });
      else { const sf = L.surface(key); m = L.lam(Object.assign({ map: CC.Textures.get(key), vertexColors: true }, sf ? sf.opts : {}), sf ? sf.tune : null); }
      this.materials.set(key, m);
      return m;
    }

    batch(key) {
      let b = this.batches.get(key);
      if (!b) { b = { pos: [], nor: [], uv: [], col: [], idx: [], shadow: true }; this.batches.set(key, b); }
      return b;
    }

    quatFrom(r) {
      if (!r) return new THREE.Quaternion();
      if (r.isQuaternion) return r.clone();
      this._e.set(U.deg(r[0] || 0), U.deg(r[1] || 0), U.deg(r[2] || 0), 'YXZ');
      return new THREE.Quaternion().setFromEuler(this._e);
    }

    /* Boîte. o = { p:[x,y,z] centre, s:[w,h,d], r:[rx,ry,rz]°, mat:'clé' | {side,top,bottom}, tint:'#hex',
     *   kind:'solid'|'glass'|'brick'|'hazard'|'cable'|'noCollide', collide:true, render:true, tile:[u,v] } */
    box(o) {
      const q = this.quatFrom(o.r);
      const pos = new V().fromArray(o.p);
      const [w, h, d] = o.s;
      if (o.render !== false) this.addBoxGeometry(pos, q, w, h, d, o.mat || 'concrete', o.tint, o.tile, o.shadow);
      const m = o.mat;
      if (o.render !== false && m && typeof m === 'object' && /^facade/.test(m.side || '') && m.top && m.top !== 'none' && Math.abs(q.x) < 1e-3 && Math.abs(q.z) < 1e-3) {
        this.buildings.push({ pos, w, h, d, q: q.clone(), facade: m.side, tint: o.tint });
      }
      if (o.collide !== false && o.kind !== 'noCollide') {
        return this.world.addBox({ center: pos, size: o.s, quat: q, kind: o.kind || 'solid', ground: o.ground, ref: o.ref });
      }
      return null;
    }

    addBoxGeometry(pos, q, w, h, d, mat, tint, tileOverride, shadow) {
      const faces = [
        { n: [1, 0, 0], k: 'side', a: (x, y, z) => d / 2 - z, b: (x, y, z) => y + h / 2, c: [[w / 2, -h / 2, d / 2], [w / 2, -h / 2, -d / 2], [w / 2, h / 2, -d / 2], [w / 2, h / 2, d / 2]] },
        { n: [-1, 0, 0], k: 'side', a: (x, y, z) => z + d / 2, b: (x, y, z) => y + h / 2, c: [[-w / 2, -h / 2, -d / 2], [-w / 2, -h / 2, d / 2], [-w / 2, h / 2, d / 2], [-w / 2, h / 2, -d / 2]] },
        { n: [0, 1, 0], k: 'top', a: (x, y, z) => x + w / 2, b: (x, y, z) => z + d / 2, c: [[-w / 2, h / 2, d / 2], [w / 2, h / 2, d / 2], [w / 2, h / 2, -d / 2], [-w / 2, h / 2, -d / 2]] },
        { n: [0, -1, 0], k: 'bottom', a: (x, y, z) => x + w / 2, b: (x, y, z) => d / 2 - z, c: [[-w / 2, -h / 2, -d / 2], [w / 2, -h / 2, -d / 2], [w / 2, -h / 2, d / 2], [-w / 2, -h / 2, d / 2]] },
        { n: [0, 0, 1], k: 'side', a: (x, y, z) => x + w / 2, b: (x, y, z) => y + h / 2, c: [[-w / 2, -h / 2, d / 2], [w / 2, -h / 2, d / 2], [w / 2, h / 2, d / 2], [-w / 2, h / 2, d / 2]] },
        { n: [0, 0, -1], k: 'side', a: (x, y, z) => w / 2 - x, b: (x, y, z) => y + h / 2, c: [[w / 2, -h / 2, -d / 2], [-w / 2, -h / 2, -d / 2], [-w / 2, h / 2, -d / 2], [w / 2, h / 2, -d / 2]] },
      ];
      const tc = tint ? U.hexToRgb(tint).map((v) => v / 255) : [1, 1, 1];
      const v = new V(), nn = new V();
      for (const f of faces) {
        const key = typeof mat === 'string' ? mat : (mat[f.k] || mat.side || 'concrete');
        if (key === 'none') continue;
        const bt = this.batch(key);
        if (shadow === false) bt.shadow = false;
        let tile = tileOverride || CC.Textures.tile[key] || [2, 2];
        // design : façades → nombre entier de travées et d'étages sur chaque face (aucune fenêtre coupée par un angle)
        if (!tileOverride && /^facade|^storefront/.test(key) && f.k === 'side') {
          const lenU = f.n[0] !== 0 ? d : w;
          tile = [lenU / Math.max(1, Math.round(lenU / tile[0])), h / Math.max(1, Math.round(h / tile[1]))];
        }
        const base = bt.pos.length / 3;
        nn.fromArray(f.n).applyQuaternion(q);
        for (const c of f.c) {
          v.fromArray(c).applyQuaternion(q).add(pos);
          bt.pos.push(v.x, v.y, v.z);
          bt.nor.push(nn.x, nn.y, nn.z);
          bt.uv.push(f.a(c[0], c[1], c[2]) / tile[0], f.b(c[0], c[1], c[2]) / tile[1]);
          bt.col.push(tc[0], tc[1], tc[2]);
        }
        bt.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    /* Ajoute une BufferGeometry quelconque (cylindres, cônes...) transformée dans un lot. */
    addGeometry(geom, pos, q, scale, mat, tint, uvScale) {
      const bt = this.batch(mat);
      const g = geom;
      const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
      const m = new THREE.Matrix4().compose(pos, q, scale || new V(1, 1, 1));
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const base = bt.pos.length / 3;
      const tc = tint ? U.hexToRgb(tint).map((x) => x / 255) : [1, 1, 1];
      const v = new V(), n = new V();
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m);
        n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        bt.pos.push(v.x, v.y, v.z); bt.nor.push(n.x, n.y, n.z);
        bt.uv.push(UV ? UV.getX(i) * (uvScale ? uvScale[0] : 1) : 0, UV ? UV.getY(i) * (uvScale ? uvScale[1] : 1) : 0);
        bt.col.push(tc[0], tc[1], tc[2]);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) bt.idx.push(base + g.index.getX(i));
      else for (let i = 0; i < P.count; i++) bt.idx.push(base + i);
    }

    cylinder(o) {
      // o = { p:[x,y,z] (centre), rTop, rBot, h, seg, r:[..], mat, tint, collide }
      const q = this.quatFrom(o.r);
      const pos = new V().fromArray(o.p);
      const geo = new THREE.CylinderGeometry(o.rTop !== undefined ? o.rTop : o.rad, o.rBot !== undefined ? o.rBot : o.rad, o.h, o.seg || 8, 1, !!o.open);
      const rad = Math.max(o.rTop !== undefined ? o.rTop : o.rad, o.rBot !== undefined ? o.rBot : o.rad);
      const tile = CC.Textures.tile[o.mat] || [2, 2];
      this.addGeometry(geo, pos, q, null, o.mat || 'concrete', o.tint, [2 * Math.PI * rad / tile[0], o.h / tile[1]]);
      geo.dispose();
      if (o.collide !== false) {
        const s = o.colSize || [rad * 1.6, o.h, rad * 1.6];
        return this.world.addBox({ center: pos, size: s, quat: q, kind: o.kind || 'solid' });
      }
      return null;
    }

    /* Géométrie d'une seule boîte, hors des lots fusionnés : les objets destructibles doivent
     * pouvoir disparaître individuellement, ils ne peuvent donc pas être fusionnés au décor. */
    soloBoxGeometry(size, matKey) {
      const saved = this.batches;
      this.batches = new Map();
      this.addBoxGeometry(new V(), new THREE.Quaternion(), size[0], size[1], size[2], matKey);
      const g = geometryFromBatch(this.batches.get(matKey));
      this.batches = saved;
      return g;
    }

    finish() {
      this.decorateBuildings();
      this.decorateSky();
      for (const [key, b] of this.batches) {
        if (!b.idx.length) continue;
        const g = geometryFromBatch(b);
        const mesh = new THREE.Mesh(g, this.mat(key));
        mesh.castShadow = b.shadow && !key.startsWith('basic:') && key !== 'glass';
        mesh.receiveShadow = !key.startsWith('basic:');
        mesh.matrixAutoUpdate = false;
        this.root.add(mesh);
      }
      this.batches.clear();
    }

    /* Design : toits et rez-de-chaussée des immeubles.
     *  - acrotère (muret) autour du toit, couvertine claire ;
     *  - équipements : édicule d'escalier, climatiseurs à ventilateur, château d'eau sur pieds, antenne à feu rouge, conduits ;
     *    posés à ≥ 1,5 m des bords, jamais sur un toit survolé par une trajectoire (marge 12 m au-dessus) ni sur le toit du
     *    lanceur ; ils ont une collision (monde cohérent : on ne traverse pas un climatiseur) ;
     *  - rez-de-chaussée des immeubles posés au sol : bandeau de vitrines légèrement en saillie (rendu seul). */
    decorateBuildings() {
      const L = this.level, dr = this.deco;
      const routes = L.routes || (L.route ? [L.route] : []);
      const la = L.launcher && L.launcher.pos;
      const V3 = V;
      for (const B of this.buildings) {
        const { pos, w, h, d, q } = B;
        const top = pos.y + h / 2, bottom = pos.y - h / 2;
        const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
        const toWorld = (lx, ly, lz) => new V3(lx, ly, lz).applyQuaternion(q).add(new V3(pos.x, 0, pos.z)).setY(ly);
        const inFoot = (p, m) => { const l = new V3(p[0] - pos.x, 0, p[2] - pos.z).applyQuaternion(q.clone().invert()); return Math.abs(l.x) < w / 2 + m && Math.abs(l.z) < d / 2 + m; };
        // survol : un point de route au-dessus du toit (ou juste à côté) à moins de 12 m → pas d'équipements
        let flown = false;
        for (const R of routes) for (let i = 0; i < R.length - 1 && !flown; i++) {
          for (let k = 0; k <= 8; k++) {
            const t = k / 8, p = [U.lerp(R[i][0], R[i + 1][0], t), U.lerp(R[i][1], R[i + 1][1], t), U.lerp(R[i][2], R[i + 1][2], t)];
            if (inFoot(p, 6) && p[1] < top + 12 && p[1] > bottom) { flown = true; break; }
          }
        }
        const launcherRoof = la && inFoot(la, 2) && Math.abs(la[1] - top) < 4;
        const big = w > 7 && d > 7;
        // acrotère
        if (big && !flown) {
          const t = 0.3, ph = 0.75;
          for (const [lx, lz, sw, sd] of [[0, d / 2 - t / 2, w, t], [0, -d / 2 + t / 2, w, t], [w / 2 - t / 2, 0, t, d - 2 * t], [-w / 2 + t / 2, 0, t, d - 2 * t]]) {
            const c = toWorld(lx, top + ph / 2, lz);
            this.box({ p: c.toArray(), s: [sw, ph, sd], r: [0, yaw * 180 / Math.PI, 0], mat: 'concreteDark', collide: false });
            const cc = toWorld(lx, top + ph + 0.05, lz);
            this.box({ p: cc.toArray(), s: [sw + 0.08, 0.1, sd + 0.08], r: [0, yaw * 180 / Math.PI, 0], mat: 'concrete', collide: false, shadow: false });
          }
        }
        // équipements de toit
        if (big && !flown && !launcherRoof) {
          const inner = (m) => [dr.range(-w / 2 + m, w / 2 - m), dr.range(-d / 2 + m, d / 2 - m)];
          const ry = yaw * 180 / Math.PI;
          if (dr() < 0.6) { const [lx, lz] = inner(3); this.box({ p: toWorld(lx, top + 1.3, lz).toArray(), s: [2.6, 2.6, 3.2], r: [0, ry, 0], mat: { side: 'concreteWarm', top: 'concreteDark' } }); }   // édicule
          const nAC = dr.int(1, Math.min(5, Math.floor(w * d / 90) + 1));
          for (let i = 0; i < nAC; i++) {
            const [lx, lz] = inner(2);
            const c = toWorld(lx, top + 0.6, lz);
            this.box({ p: c.toArray(), s: [1.6, 1.1, 1.3], r: [0, ry + (dr() < 0.5 ? 90 : 0), 0], mat: 'metal', tint: '#' + new THREE.Color('#c8ccd0').multiplyScalar(dr.range(0.85, 1.05)).getHexString() });
            this.cylinder({ p: [c.x, top + 1.18, c.z], rad: 0.45, h: 0.06, seg: 10, mat: 'col:#1c1e20', collide: false });
          }
          if (h > 30 && dr() < 0.4) {                                             // château d'eau
            const [lx, lz] = inner(3.5), c = toWorld(lx, 0, lz);
            for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box({ p: [c.x + ox * 1.1, top + 1.2, c.z + oz * 1.1], s: [0.2, 2.4, 0.2], mat: 'col:#3a3028', collide: false });
            this.cylinder({ p: [c.x, top + 3.6, c.z], rad: 1.6, h: 2.6, seg: 12, mat: 'planks' });
            this.cylinder({ p: [c.x, top + 5.3, c.z], rTop: 0.1, rBot: 1.75, h: 0.8, seg: 12, mat: 'col:#4a3a30', collide: false });
          }
          if (dr() < 0.45) {                                                     // antenne + feu d'obstacle
            const [lx, lz] = inner(1.5), c = toWorld(lx, 0, lz), ah = dr.range(4, 9);
            this.cylinder({ p: [c.x, top + ah / 2, c.z], rad: 0.07, h: ah, seg: 5, mat: 'col:#2a2a2a', collide: false });
            for (let k = 1; k <= 2; k++) this.box({ p: [c.x, top + ah * k / 3, c.z], s: [1.2, 0.06, 0.06], r: [0, dr() * 180, 0], mat: 'col:#2a2a2a', collide: false });
            this.box({ p: [c.x, top + ah + 0.1, c.z], s: [0.22, 0.22, 0.22], mat: 'basic:#ff2a1a', collide: false, shadow: false });
          }
          for (let i = 0; i < dr.int(0, 3); i++) { const [lx, lz] = inner(1); this.cylinder({ p: toWorld(lx, top + 0.6, lz).toArray(), rad: 0.18, h: 1.2, seg: 6, mat: 'metal', collide: false }); }
        }
        // rez-de-chaussée : vitrines (immeubles posés au sol, assez hauts pour être des immeubles de ville)
        if (bottom < 1 && h > 12 && B.facade !== 'facadeDark') {
          const gh = 4.2, o = 0.12;
          this.addBoxGeometry(new V3(pos.x, bottom + gh / 2, pos.z), q, w + 2 * o, gh, d + 2 * o, { side: 'storefront', top: 'none', bottom: 'none' }, B.tint);
          this.box({ p: toWorld(0, bottom + gh + 0.12, 0).toArray(), s: [w + 0.5, 0.24, d + 0.5], r: [0, yaw * 180 / Math.PI, 0], mat: 'concreteWarm', collide: false });   // bandeau
        }
      }
    }

    /* Design : nuages voxel (ciels de jour seulement) — amas de pavés aplatis, dessous légèrement plus sombre, très haut et
     * loin du parcours ; aucune collision. La teinte suit l'horizon du niveau. */
    decorateSky() {
      const env = this.level.env;
      if (!env || !env.sky || env.sky.stars || env.clouds === false) return;
      const top = new THREE.Color(env.sky.top), hsl = {}; top.getHSL(hsl);
      if (hsl.l < 0.45) return;                                        // ciel sombre (nuit, crépuscule rouge) : pas de nuages
      const dr = U.makeRng((this.level.seed || 7) * 13 + 1);
      const R = this.level.route || (this.level.routes && this.level.routes[0]) || [[0, 0, 0]];
      const c = R[Math.floor(R.length / 2)];
      const col = '#' + new THREE.Color('#e8ecf2').lerp(new THREE.Color(env.sky.top), 0.18).getHexString();
      const under = '#' + new THREE.Color('#b8c2d0').lerp(new THREE.Color(env.sky.top), 0.25).getHexString();   // dessous ombré
      for (let i = 0; i < 26; i++) {
        const a = dr() * 6.28, d = dr.range(260, 820), y = dr.range(170, 300);
        const cx = c[0] + Math.cos(a) * d, cz = c[2] + Math.sin(a) * d, n = dr.int(4, 8), sz = dr.range(0.7, 1.4);
        for (let k = 0; k < n; k++) {
          const w = dr.range(26, 60) * sz, h = dr.range(7, 14) * sz, dd = dr.range(20, 44) * sz;
          const p = new V(cx + dr.range(-40, 40) * sz, y + dr.range(-4, 6) * sz, cz + dr.range(-26, 26) * sz);
          this.addBoxGeometry(p, new THREE.Quaternion(), w, h, dd, { side: 'cloud:' + col, top: 'cloud:#ffffff', bottom: 'cloud:' + under }, k % 3 ? '#ffffff' : '#e6e8ec', null, false);   // pas d'ombre portée
        }
      }
    }

    // ---------- Aides de haut niveau ----------
    building(x, z, w, d, h, o) {
      o = o || {};
      const y0 = o.y0 || 0;
      return this.box({ p: [x, y0 + h / 2, z], s: [w, h, d], r: o.r, mat: { side: o.facade || 'facade', top: o.roof || 'concrete', bottom: 'concreteDark' }, tint: o.tint });
    }

    cable(a, b, th, mat) {
      const pa = new V().fromArray(a), pb = new V().fromArray(b);
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const dir = pb.clone().sub(pa); const len = dir.length(); dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), dir);
      this.addBoxGeometry(mid, q, th, th, len, mat || 'col:#141414', null, null, true);
      return this.world.addBox({ center: mid, size: [th, th, len], quat: q, kind: 'cable' });
    }

    /* Arbre : tronc (collision inchangée) + design : pied enfoncé de 1,5 m sous le sol réel (plus de tronc qui flotte),
     * évasement à la base, houppier de conifère en 3 étages dans le tiers supérieur (rendu seul, au-dessus des trajectoires). */
    tree(x, z, h, rad, yBase, mat) {
      const g0 = yBase !== undefined ? yBase : (this.groundAt ? this.groundAt(x, z) : 0);
      const y = (yBase || 0) + h / 2;
      const col = this.cylinder({ p: [x, y, z], rad, h, seg: 7, mat: mat || 'bark', colSize: [rad * 1.7, h, rad * 1.7] });
      const dr = this.deco;
      this.cylinder({ p: [x, g0 - 0.5, z], rTop: rad, rBot: rad * 1.45, h: 3, seg: 7, mat: mat || 'bark', collide: false });
      if (this.level.foliage !== false) {
        const fcol = this.level.foliage || '#2a4a2c', tint = '#' + new THREE.Color(1, 1, 1).multiplyScalar(dr.range(0.78, 1)).getHexString();   // variation de teinte d'un arbre à l'autre
        const top = (yBase || 0) + h, R = Math.max(2.2, h * dr.range(0.09, 0.12));
        for (let k = 0; k < 3; k++) {
          const cy = top - h * (0.34 - k * 0.11), ch = h * 0.2, cr = R * (1 - k * 0.24);
          const geo = new THREE.ConeGeometry(cr, ch, 7);
          this.addGeometry(geo, new V(x, cy, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, dr() * 6.28, 0)), null, 'col:' + fcol, tint);
          geo.dispose();
        }
      }
      return col;
    }

    rockLump(x, y, z, s, mat) {
      const r = this.rng;
      const gy = this.groundAt ? Math.min(y, this.groundAt(x, z)) : y;   // design : posé sur le sol réel (le point le plus bas)
      const size = [s * r.range(1, 1.6), s * 0.55, s * r.range(0.8, 1.3)], rot = [r.range(-8, 8), r.range(0, 180), r.range(-8, 8)];
      const p = [x, gy + s * 0.18, z];
      this.box({ p, s: size, r: rot, render: false });                   // collision inchangée
      // design : rocher à facettes (icosaèdre déformé, base aplatie, un peu enterré) au lieu d'un pavé
      const dr = this.deco, geo = new THREE.IcosahedronGeometry(0.62, 0), P = geo.attributes.position, jit = new Map();
      for (let i = 0; i < P.count; i++) {
        const key = P.getX(i).toFixed(3) + ',' + P.getY(i).toFixed(3) + ',' + P.getZ(i).toFixed(3);
        if (!jit.has(key)) jit.set(key, dr.range(0.78, 1.18));
        const k = jit.get(key);
        P.setXYZ(i, P.getX(i) * k, Math.max(-0.42, P.getY(i) * k), P.getZ(i) * k);
      }
      geo.computeVertexNormals();
      const tint = '#' + new THREE.Color(1, 1, 1).multiplyScalar(dr.range(0.8, 1.05)).getHexString();
      this.addGeometry(geo, new V(p[0], p[1] - s * 0.05, p[2]), this.quatFrom(rot), new V(size[0], size[1] * 1.15, size[2]), mat || 'col:#5b6472', tint);
      geo.dispose();
    }

    // Surface de terrain (heightfield) : rendu + collision.
    terrain(o) {
      const n = o.n, step = o.step, x0 = o.x0, z0 = o.z0;
      const xMax = x0 + (n - 1) * step, zMax = z0 + (n - 1) * step;
      // design : hauteur exacte du sol rendu (interpolation bilinéaire de la grille) pour poser arbres, rochers, herbes
      this.groundAt = (x, z) => {
        if (x < x0 || x > xMax || z < z0 || z > zMax) return 0;
        const fx = (x - x0) / step, fz = (z - z0) / step, ix = Math.min(n - 2, Math.floor(fx)), iz = Math.min(n - 2, Math.floor(fz));
        const tx = fx - ix, tz = fz - iz, hh = (a, c) => o.height(x0 + a * step, z0 + c * step);
        // même découpage en triangles que PlaneGeometry (diagonale a-d)
        const h00 = hh(ix, iz), h10 = hh(ix + 1, iz), h01 = hh(ix, iz + 1), h11 = hh(ix + 1, iz + 1);
        return tx + tz <= 1 ? h00 + (h10 - h00) * tx + (h01 - h00) * tz : h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
      };
      const H = new Float32Array(n * n);
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) H[iz * n + ix] = o.height(x0 + ix * step, z0 + iz * step);
      this.world.addHeightfield({ x0, z0, step, n, h: H, kind: 'solid' });
      const g = new THREE.PlaneGeometry(1, 1, n - 1, n - 1);
      const P = g.attributes.position, UVA = g.attributes.uv;
      const tile = CC.Textures.tile[o.mat] || [4, 4];
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = x0 + ix * step, z = z0 + iz * step;
        P.setXYZ(i, x, H[i], z);
        UVA.setXY(i, x / tile[0], z / tile[1]);
      }
      // Lignes de PlaneGeometry = z croissant, colonnes = x croissant : l'ordre des triangles donne des normales +Y.
      g.computeVertexNormals();
      const colors = new Float32Array(n * n * 3);
      for (let i = 0; i < n * n; i++) {
        const c = o.color ? o.color(P.getX(i), P.getY(i), P.getZ(i)) : [1, 1, 1];
        colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(g, this.mat(o.mat));
      mesh.receiveShadow = true; mesh.castShadow = !!o.castShadow;
      this.root.add(mesh);
      return mesh;
    }

    // Tunnel de grotte : tube bruité (rendu intérieur) + collision analytique.
    caveTube(o) {
      const curve = new THREE.CatmullRomCurve3(o.points.map((p) => new V().fromArray(p)), false, 'catmullrom', 0.3);
      const L = curve.getLength();
      const spacing = 1.0;
      const nS = Math.ceil(L / spacing);
      const frames = curve.computeFrenetFrames(nS, false);
      const samples = [];
      for (let i = 0; i <= nS; i++) {
        const t = i / nS;
        // repère sans torsion : on ré-oriente la normale pour qu'elle pointe "vers le haut" autant que possible
        const tan = frames.tangents[i].clone();
        let nor = new V(0, 1, 0).sub(tan.clone().multiplyScalar(tan.y)).normalize();
        const bin = new V().crossVectors(tan, nor).normalize();
        samples.push({ p: curve.getPointAt(t), t: tan, n: nor, b: bin });
      }
      const baseR = o.radius;       // fonction (i/nS) → rayon
      const rs = U.makeRng(o.seed || 3);
      const ph = [rs() * 6.28, rs() * 6.28, rs() * 6.28, rs() * 6.28];
      const radiusAt = (fi, ang) => {
        const u = U.clamp(fi / nS, 0, 1);
        const k = fi * 0.045;
        let f = 1 + 0.16 * Math.sin(3 * ang + ph[0] + Math.sin(k) * 2) + 0.10 * Math.sin(5 * ang + ph[1] + k * 1.7)
          + 0.07 * Math.sin(2 * ang + ph[2] + Math.cos(k * 1.3) * 3) + 0.05 * Math.sin(9 * ang + ph[3] + k * 3.1);
        // sol plus plat : réduit le rayon vers le bas
        const down = Math.max(0, -Math.sin(ang));
        f -= 0.22 * down * down;
        return baseR(u) * f;
      };
      const tube = { samples, spacing: L / nS, radiusAt };
      this.world.addTube(tube);
      // maillage
      const radial = 28;
      const pos = [], idx = [], uv = [], col = [];
      for (let i = 0; i <= nS; i++) {
        const s = samples[i];
        for (let j = 0; j <= radial; j++) {
          const ang = (j / radial) * Math.PI * 2 - Math.PI;
          const R = radiusAt(i, ang);
          const p = s.p.clone().addScaledVector(s.n, Math.cos(ang) * R).addScaledVector(s.b, Math.sin(ang) * R);
          pos.push(p.x, p.y, p.z);
          uv.push((j / radial) * (2 * Math.PI * baseR(i / nS)) / 6, i * tube.spacing / 6);
          const shadeV = 0.75 + 0.35 * U.noise2(i * 0.2, j * 0.7, 5);
          col.push(shadeV, shadeV * 0.95, shadeV * 0.92);
        }
      }
      for (let i = 0; i < nS; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);   // faces tournées vers l'intérieur
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, this.mat(o.mat || 'rock'));
      mesh.receiveShadow = true;
      this.root.add(mesh);
      tube.curve = curve;
      return tube;
    }

    /* Mur percé d'ouvertures. o = { axis:'x'|'z' (direction du mur), at (coordonnée de l'autre axe), from, to, y0, y1, t,
     *   mat, tint, holes:[[a0,a1,b0,b1]] (le long du mur, en hauteur), glass:'cold'|'warm'|null } */
    wall(o) {
      const holes = o.holes || [], t = o.t || 0.5;
      const cuts = new Set([o.from, o.to]);
      for (const h of holes) { cuts.add(U.clamp(h[0], o.from, o.to)); cuts.add(U.clamp(h[1], o.from, o.to)); }
      const xs = [...cuts].sort((a, b) => a - b);
      const seg = (a0, a1, ya, yb) => {
        if (yb - ya < 1e-3 || a1 - a0 < 1e-3) return;
        const p = o.axis === 'x' ? [(a0 + a1) / 2, (ya + yb) / 2, o.at] : [o.at, (ya + yb) / 2, (a0 + a1) / 2];
        const s = o.axis === 'x' ? [a1 - a0, yb - ya, t] : [t, yb - ya, a1 - a0];
        this.box({ p, s, mat: o.mat || 'brick', tint: o.tint, kind: o.kind });
      };
      for (let i = 0; i < xs.length - 1; i++) {
        const a0 = xs[i], a1 = xs[i + 1], mid = (a0 + a1) / 2;
        const hs = holes.filter((h) => h[0] <= mid && h[1] >= mid).sort((p, q) => p[2] - q[2]);
        let y = o.y0;
        for (const h of hs) { if (h[2] > y) seg(a0, a1, y, h[2]); y = Math.max(y, h[3]); }
        if (y < o.y1) seg(a0, a1, y, o.y1);
      }
      if (o.glass) for (const h of holes) {
        const p = o.axis === 'x' ? [(h[0] + h[1]) / 2, (h[2] + h[3]) / 2, o.at] : [o.at, (h[2] + h[3]) / 2, (h[0] + h[1]) / 2];
        const s = o.axis === 'x' ? [h[1] - h[0], h[3] - h[2], 0.12] : [0.12, h[3] - h[2], h[1] - h[0]];
        if (!h[4]) this.glass(p, s, null, o.glass === 'warm');
      }
    }

    /* Dalle percée. o = { x0,x1,z0,z1, y (dessus), t, mat, holes:[[x0,x1,z0,z1]] } */
    floor(o) {
      const holes = o.holes || [], t = o.t || 0.4;
      const cuts = new Set([o.x0, o.x1]);
      for (const h of holes) { cuts.add(h[0]); cuts.add(h[1]); }
      const xs = [...cuts].sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i++) {
        const a0 = xs[i], a1 = xs[i + 1], mid = (a0 + a1) / 2;
        if (a1 - a0 < 1e-3) continue;
        const hs = holes.filter((h) => h[0] <= mid && h[1] >= mid).sort((p, q) => p[2] - q[2]);
        let z = o.z0;
        const seg = (za, zb) => { if (zb - za > 1e-3) this.box({ p: [(a0 + a1) / 2, o.y - t / 2, (za + zb) / 2], s: [a1 - a0, t, zb - za], mat: o.mat || 'concrete', ground: true, tint: o.tint }); };
        for (const h of hs) { if (h[2] > z) seg(z, h[2]); z = Math.max(z, h[3]); }
        if (z < o.z1) seg(z, o.z1);
      }
    }

    /* Silhouettes lointaines (tours claires de l'horizon, OBSERVÉES séq. 1 et 6) : rendu seul, sans collision. */
    skyline(cx, cz, r0, r1, n, h0, h1, color, yBase) {
      const r = this.rng;
      for (let i = 0; i < n; i++) {
        const a = r.range(0, Math.PI * 2), d = r.range(r0, r1), w = r.range(12, 40), h = r.range(h0, h1);
        const y0 = yBase || 0;
        this.box({ p: [cx + Math.cos(a) * d, y0 + h / 2, cz + Math.sin(a) * d], s: [w, h, r.range(12, 40)], r: [0, r.range(0, 90), 0], mat: 'basic:' + color, collide: false, shadow: false });
      }
    }

    add(obj) { this.root.add(obj); return obj; }
    entity(e) { this.entities.push(e); if (e.object) this.root.add(e.object); return e; }

    dispose() {
      this.scene.remove(this.root);
      this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of this.materials.values()) m.dispose();
    }
  }

  CC.LevelBuilder = LevelBuilder;
})();
