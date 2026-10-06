/* Roquette et cosmétiques du style « réaliste » (v033-gfx). Remplace CC.Models.rocket quand CC.Look.real().
 *
 * Même gabarit que le modèle d'origine (mêmes dimensions `dims`, mêmes pièces rapportées `parts`, mêmes points d'attache :
 * tuyère, bouts d'ailerons, pointe du nez) pour que la physique, les traînées et la flamme ne changent pas, mais :
 *  - corps et nez sont des SOLIDES DE RÉVOLUTION (24 facettes, nez en ogive, queue en tronc de cône) au lieu de cylindres ;
 *  - ailerons profilés (flèche, biseau) extrudés ; tuyère en cloche à double paroi ; collier et joints en tores ;
 *  - chaque cosmétique a une FINITION (peinture, mat, tôle brossée, chrome, laqué, camouflage, pain, pâte feuilletée, pierre, carton,
 *    pelage) : matériau physique (rugosité, métal, reflets du ciel) + texture pixel-art dessinée par le code (tôles rivetées,
 *    soudures, pochoirs, rayures, suie vers la tuyère, craquelures…), en plus proche voisin pour garder l'esprit pixel du jeu. */
(function () {
  const M = CC.Models, L = CC.Look, U = CC.U, V2 = THREE.Vector2;

  // propriétés physiques par type de finition : rugosité, métal, force du reflet du ciel
  const KINDS = {
    paint: { rough: 0.42, metal: 0.35, env: 0.9 }, matte: { rough: 0.86, metal: 0.12, env: 0.35 }, metal: { rough: 0.3, metal: 0.92, env: 1.3 },
    chrome: { rough: 0.1, metal: 1.0, env: 1.7 }, gloss: { rough: 0.12, metal: 0.45, env: 1.4 }, camo: { rough: 0.85, metal: 0.1, env: 0.35 },
    bread: { rough: 0.92, metal: 0, env: 0.3 }, pastry: { rough: 0.75, metal: 0, env: 0.4 }, rock: { rough: 0.97, metal: 0, env: 0.25 },
    cardboard: { rough: 0.92, metal: 0, env: 0.3 }, fur: { rough: 0.98, metal: 0, env: 0.25 },
  };
  const FINISH = {
    stock: 'paint', gamin: 'camo', bedon: 'matte', fuseev: 'paint', minutemec: 'paint', hachette: 'metal', croquette: 'camo', baguette: 'bread',
    tridentin: 'gloss', poisson: 'paint', gardien: 'paint', titanite: 'chrome', satanette: 'gloss', berthe: 'matte', croissant: 'pastry',
    chaton: 'fur', tsarini: 'paint', maman: 'matte', bombeh: 'chrome', colis: 'cardboard', caillou: 'rock',
  };

  // ---------- textures (canvas pixel-art, plus proche voisin) ----------
  const TEX = {};
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const rgb = (hex) => U.hexToRgb(hex);
  const sh = (c, d) => 'rgb(' + clamp(c[0] + d) + ',' + clamp(c[1] + d) + ',' + clamp(c[2] + d) + ')';
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  function canvas(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4; return t;
  }

  // y = 0 : côté nez (v = 1) ; y = h : côté tuyère (v = 0)
  function bodyTexture(kind, skin) {
    const c = skin.c, base = rgb(c.body), r = U.makeRng(hash(skin.id));
    return canvas(64, 160, (g, W, H) => {
      const px = (x, y, col) => { g.fillStyle = col; g.fillRect(((x % W) + W) % W, y, 1, 1); };
      if (kind === 'bread') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const lit = 0.5 + 0.5 * Math.sin(x / W * 6.283 + 0.8); px(x, y, sh(rgb('#c88a44'), (lit - 0.5) * 36 + (r() - 0.5) * 22 - (y > H * 0.9 ? 30 : 0))); }
        for (let y = 14; y < H - 10; y += 26) for (let k = 0; k < 14; k++) { px(6 + k * 3 + (y % 3), y + k, '#8a5524'); px(7 + k * 3 + (y % 3), y + k, '#f0cf94'); px(8 + k * 3 + (y % 3), y + k, '#f0cf94'); }
        for (let i = 0; i < 90; i++) px(Math.floor(r() * W), Math.floor(r() * H), 'rgba(255,248,230,0.8)');
        return;
      }
      if (kind === 'pastry') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const row = Math.floor((y + Math.round(Math.sin(x / W * 6.283) * 3)) / 6) % 2; px(x, y, sh(row ? rgb('#c68a35') : rgb('#e0ab52'), (r() - 0.5) * 18)); }
        for (let i = 0; i < 160; i++) px(Math.floor(r() * W), Math.floor(r() * H), '#f6dc9a');
        for (let i = 0; i < 70; i++) px(Math.floor(r() * W), Math.floor(r() * H), '#8a5a20');
        return;
      }
      if (kind === 'rock') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, sh(base, (U.fbm2(x * 0.22, y * 0.22, 3, 5) - 0.5) * 70 + (r() - 0.5) * 16));
        for (let k = 0; k < 9; k++) { let x = Math.floor(r() * W), y = Math.floor(r() * H); for (let n = 0; n < 22; n++) { px(x, y, '#3a3c40'); x += r() < 0.5 ? 1 : -1; y += 1; } }
        for (let i = 0; i < 50; i++) px(Math.floor(r() * W), Math.floor(r() * H), r() < 0.6 ? '#9ea1a6' : '#66795a');
        return;
      }
      if (kind === 'cardboard') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, sh(rgb('#b58b52'), (r() - 0.5) * 16 + ((y % 5) === 0 ? -6 : 0)));
        g.fillStyle = '#d8c496'; g.fillRect(28, 0, 9, H); g.fillStyle = '#efe0b4'; g.fillRect(28, 0, 1, H);
        g.fillStyle = '#efe8d8'; g.fillRect(4, 46, 18, 24); g.fillStyle = '#222'; for (let l = 0; l < 3; l++) g.fillRect(6, 50 + l * 4, 10 + (l * 3) % 6, 2);
        for (let b = 0; b < 12; b++) g.fillRect(6 + b + (b % 2), 62, 1, 5);
        g.fillStyle = '#2a2a2a'; for (const ax of [44, 54]) { g.fillRect(ax, 92, 2, 14); g.fillRect(ax - 3, 94, 8, 2); g.fillRect(ax - 2, 92, 6, 2); }
        for (let i = 0; i < 40; i++) px(Math.floor(r() * W), Math.floor(r() * H), 'rgba(60,40,20,0.35)');
        return;
      }
      if (kind === 'fur') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const stripe = ((x + Math.round(Math.sin(y * 0.18) * 2)) % 8) < 2; px(x, y, sh(stripe ? rgb('#6d6e74') : base, (r() - 0.5) * 22)); }
        for (let i = 0; i < 120; i++) px(Math.floor(r() * W), Math.floor(r() * H), 'rgba(255,255,255,0.22)');
        return;
      }
      // tôles : peinture, mat, métal brossé, chrome, laqué, camouflage
      const noise = kind === 'chrome' ? 3 : kind === 'gloss' ? 4 : 11, colVar = []; for (let x = 0; x < W; x++) colVar.push((r() - 0.5) * (kind === 'metal' ? 16 : 4));
      const camo = [base, rgb(c.fin), [base[0] * 0.55, base[1] * 0.55, base[2] * 0.55]];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let col = base;
        if (kind === 'camo') { const n = U.fbm2(x * 0.1, y * 0.1, 3, hash(skin.id) % 97); col = n < 0.42 ? camo[2] : n < 0.58 ? camo[1] : camo[0]; }
        px(x, y, sh(col, (r() - 0.5) * noise + colVar[x]));
      }
      const seams = [26, 66, 108, 142];
      for (const y of seams) {
        g.fillStyle = sh(base, -42); g.fillRect(0, y, W, 1); g.fillStyle = sh(base, 22); g.fillRect(0, y + 1, W, 1);
        if (kind !== 'chrome' && kind !== 'gloss') for (let x = 1; x < W; x += 4) { px(x, y - 2, sh(base, 34)); px(x, y + 3, sh(base, -34)); }
      }
      g.fillStyle = sh(base, -36); g.fillRect(0, 0, 1, H); g.fillRect(32, 0, 1, H);                       // soudures verticales
      if (c.band) {                                                                                      // collier de couleur
        const y = Math.round(H * 0.8); g.fillStyle = c.band; g.fillRect(0, y, W, 9); g.fillStyle = sh(rgb(c.band), -50); g.fillRect(0, y, W, 1); g.fillRect(0, y + 8, W, 1);
        g.fillStyle = c.tip; g.fillRect(0, y - 6, W, 2);
      }
      if (kind !== 'chrome' && kind !== 'gloss') {                                                       // pochoirs : lettres et numéros
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(7, 36, 22, 8); g.fillRect(40, 36, 16, 8);
        g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 7; k++) { const x = 8 + k * 3; g.fillRect(x, 38, 2, 1 + Math.floor(r() * 4)); }
        for (let k = 0; k < 5; k++) { const x = 41 + k * 3; g.fillRect(x, 38 + (k % 2), 2, 3 + Math.floor(r() * 2)); }
        g.fillStyle = '#e8c020'; g.fillRect(44, 82, 8, 7); g.fillStyle = '#222'; g.fillRect(47, 84, 2, 3);   // triangle d'avertissement
        for (let k = 0; k < 12; k++) { let x = Math.floor(r() * W), y = Math.floor(r() * H); const dx = r() < 0.5 ? 1 : -1; for (let n = 0; n < 4 + Math.floor(r() * 5); n++) { px(x, y, 'rgba(255,255,255,0.35)'); x += dx; y += 1; } }   // éraflures
      }
      for (let y = Math.round(H * 0.72); y < H; y++) {                                                   // suie vers la tuyère
        const t = (y - H * 0.72) / (H * 0.28);
        for (let x = 0; x < W; x++) if (r() < t * 0.9 + 0.1) px(x, y, 'rgba(14,11,9,' + (0.15 + 0.6 * t * t).toFixed(2) + ')');
      }
    });
  }
  function noseTexture(skin, kind) {
    const c = skin.c, base = rgb(c.nose), r = U.makeRng(hash(skin.id) + 3);
    return canvas(32, 48, (g, W, H) => {
      const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
      const tint = kind === 'bread' ? rgb('#d49a50') : kind === 'pastry' ? rgb('#d89a40') : kind === 'cardboard' ? rgb('#b8874c') : base;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, sh(tint, (r() - 0.5) * (kind === 'chrome' ? 3 : 10)));
      if (kind === 'paint' || kind === 'matte' || kind === 'metal' || kind === 'camo' || kind === 'gloss' || kind === 'chrome') {
        g.fillStyle = sh(base, -40); g.fillRect(0, H - 4, W, 1); g.fillStyle = sh(base, 22); g.fillRect(0, H - 3, W, 1);
        if (c.band) { g.fillStyle = c.band; g.fillRect(0, H - 9, W, 2); }
        g.fillStyle = c.tip; g.fillRect(0, 0, W, Math.round(H * 0.18));                                  // pointe colorée
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, Math.round(H * 0.18), W, 1);
      }
    });
  }
  function texFor(skin, kind) {
    const key = skin.id + ':' + kind;
    return TEX[key] || (TEX[key] = { body: bodyTexture(kind, skin), nose: noseTexture(skin, kind) });
  }
  M.resetRocketTextures = function () { for (const k in TEX) { TEX[k].body.dispose(); TEX[k].nose.dispose(); delete TEX[k]; } };

  // ---------- géométrie ----------
  function lathe(points, seg) { const g = new THREE.LatheGeometry(points, seg); g.rotateX(Math.PI / 2); return g; }   // axe Y → axe Z (nez vers +Z)
  function finGeometry(chord, height, thick) {
    const s = new THREE.Shape();
    s.moveTo(0.5 * chord, 0); s.lineTo(0.5 * chord - 0.5 * chord, height); s.lineTo(-0.5 * chord + 0.06 * chord, height * 0.96); s.lineTo(-0.5 * chord, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.3, bevelSize: thick * 0.3, bevelSegments: 1, steps: 1 });
    g.translate(0, 0, -thick / 2); g.rotateY(-Math.PI / 2);                                                  // sens de la corde → axe Z, épaisseur → axe X
    return g;
  }

  const std = (kind, extra) => {
    const K = KINDS[kind] || KINDS.paint;
    const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: K.rough, metalness: K.metal }, extra));
    m.envMapIntensity = K.env * L.T.rocketEnv; m.userData.look = 'rocket';
    return m;
  };

  M.rocketReal = function (skin) {
    skin = skin || CC.Skins.get('stock');
    const g = new THREE.Group(), c = skin.c, kind = FINISH[skin.id] || 'paint';
    const d = Object.assign({ r: 0.1, len: 0.86, noseLen: 0.3, noseR: 0.012, fins: 4, finH: 0.2, finW: 0.02, finPos: -0.33, scale: 1 }, skin.dims || {});
    const r = d.r, len = d.len, nl = d.noseLen, nr = d.noseR, fs = len / 0.86, y0 = -len / 2, y1 = len / 2, SEG = 24;
    const tx = texFor(skin, kind), add = (geo, mat, shadow) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow !== false; m.receiveShadow = true; g.add(m); return m; };

    // corps : queue en tronc de cône qui s'évase, puis fût cylindrique
    const bp = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; let rad = r; if (t < 0.1) rad = r * (0.8 + 0.2 * Math.sin(t / 0.1 * Math.PI / 2)); bp.push(new V2(rad, y0 + len * t)); }
    add(lathe(bp, SEG), std(kind, { map: tx.body }));
    // nez en ogive (rayon de la pointe = noseR), fermé par un point sur l'axe
    const np = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; np.push(new V2(nr + (r - nr) * Math.pow(1 - Math.pow(t, 1.7), 0.55), y1 + nl * t)); }
    np.push(new V2(0, y1 + nl + 0.002));
    add(lathe(np, SEG), std(kind, { map: tx.nose }));
    // embout des nez arrondis, antenne (pitot) des nez pointus et petits canards de guidage
    if (nr > 0.02) add(new THREE.SphereGeometry(nr * 0.7, 10, 8), new THREE.MeshBasicMaterial({ color: c.tip }), false).position.z = y1 + nl + nr * 0.2;
    else {
      const pit = add(new THREE.CylinderGeometry(0.006, 0.01, 0.07, 8), std('metal', { color: '#9aa0a8' }), false); pit.rotation.x = Math.PI / 2; pit.position.z = y1 + nl + 0.025;
      if (d.fins === 4) for (let i = 0; i < 4; i++) {
        const f = new THREE.Group(); f.rotation.z = i * Math.PI / 2 + Math.PI / 4; g.add(f);
        const cn = new THREE.Mesh(finGeometry(0.075, 0.05, 0.012), std('paint', { color: c.fin })); cn.position.set(0, r * 0.95, y1 - 0.02); cn.castShadow = false; f.add(cn);
      }
    }
    // joints de tronçons (tores sombres) et collier de couleur
    const seamCol = '#' + new THREE.Color(c.body).multiplyScalar(0.62).getHexString();
    for (const zf of [0.12, -0.05]) add(new THREE.TorusGeometry(r * 1.004, 0.006, 6, SEG), std('matte', { color: seamCol }), false).position.z = len * zf;
    add(new THREE.TorusGeometry(r * 1.012, r * 0.06, 8, SEG), std('paint', { color: c.band }), false).position.z = -len * 0.35;
    // tuyère : cloche à double paroi (le jet est placé à sa sortie)
    const nz = [[0.6, 0.02], [0.72, -0.04], [0.82, -0.1], [0.77, -0.1], [0.66, -0.04], [0.52, 0.02]].map(([k, y]) => new V2(r * k, y0 + y));
    add(lathe(nz, 16), std('metal', { color: c.nozzle, side: THREE.DoubleSide, roughness: 0.5 }), false);
    const jetInfo = M.makeJet(g, r, len); g.userData.jet = jetInfo;
    // ailerons profilés
    for (let i = 0; i < d.fins; i++) {
      const f = new THREE.Group(); f.rotation.z = i * Math.PI * 2 / d.fins + Math.PI / 4; g.add(f);
      const fin = new THREE.Mesh(finGeometry(d.finH * 1.1, d.finH * 0.95, Math.max(0.012, d.finW * 0.9)), std(kind === 'bread' || kind === 'pastry' || kind === 'cardboard' ? kind : 'paint', { color: c.fin }));
      fin.position.set(0, r * 0.93, d.finPos * fs); fin.castShadow = true; fin.receiveShadow = true; f.add(fin);
    }
    g.userData.finTips = [];
    for (let i = 0; i < d.fins; i++) {
      const a = i * Math.PI * 2 / d.fins + Math.PI / 4, y = r + d.finH * 0.85;
      g.userData.finTips.push(new THREE.Vector3(-y * Math.sin(a), y * Math.cos(a), d.finPos * fs - d.finH * 0.55));
    }
    g.userData.noseZ = len / 2 + nl;
    g.userData.nozzleZ = -0.53;
    // pièces rapportées du cosmétique (même fiche que le modèle d'origine), avec la matière de la finition
    for (const p of skin.parts || []) {
      const mat = p.basic ? new THREE.MeshBasicMaterial({ color: p.c }) : std(kind === 'chrome' || kind === 'metal' ? kind : (kind === 'bread' || kind === 'pastry' || kind === 'rock' || kind === 'cardboard' || kind === 'fur' ? kind : 'paint'), { color: p.c });
      let m;
      if (p.k === 'box') m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
      else if (p.k === 'sph') m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 12, 9), mat);
      else m = new THREE.Mesh(new THREE.CylinderGeometry(p.r2 !== undefined ? p.r2 : p.r, p.r, p.h, p.seg || 14), mat);
      m.position.fromArray(p.p || [0, 0, 0]);
      const rot = p.rot || [0, 0, 0];
      m.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180);
      m.castShadow = p.cast !== false && !p.basic; m.receiveShadow = true;
      g.add(m);
    }
    if (d.scale !== 1) g.scale.setScalar(d.scale);
    return g;
  };
})();
