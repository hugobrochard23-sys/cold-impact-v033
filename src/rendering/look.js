/* Style visuel (v033-gfx) : « classic » = le rendu d'origine du jeu ; « real » = pixel-art réaliste.
 *
 * Le mode réaliste garde l'esprit du jeu (textures pixelisées au plus proche voisin, trame de tramage, police pixel, HUD) mais
 * change la matière et la lumière :
 *   - matériaux physiques (MeshStandardMaterial : rugosité, métal) à la place de Lambert / Phong ;
 *   - reflets : une carte d'environnement tirée du ciel du niveau (CC.Look.buildEnv) éclaire et fait refléter métaux et vitres ;
 *   - roquettes et cosmétiques entièrement modélisés (profil de révolution, ailerons profilés, tuyère, textures de finition :
 *     tôle rivetée, peinture écaillée, croûte de pain, pâte feuilletée, pierre, carton…) — voir src/entities/rocket_real.js ;
 *   - étalonnage : courbe de tons « filmique » et teintes chaudes / froides dans le post-traitement (postfx.js).
 * Tout est derrière CC.Look.real() : un seul réglage (RÉGLAGES → STYLE VISUEL, ou ?look=real dans l'adresse) bascule entre les deux,
 * ce qui permet de comparer. Le mode « classic » n'est pas modifié. */
(function () {
  const L = { mode: 'classic' };
  // réglages d'ensemble du style réaliste (ajustables à chaud depuis la console : CC.Look.T.env = 0.3 …)
  L.T = { env: 0.3, hemi: 0.5, amb: 0.35, exposure: 1.05, contrast: 0.4, sat: 1.14, rocketEnv: 1.0, shafts: 1.0 };

  L.real = () => L.mode === 'real';
  L.set = (m) => { L.mode = m === 'real' ? 'real' : 'classic'; };

  // matériau courant du décor et des modèles : Lambert d'origine, ou Standard (rugosité élevée, léger reflet d'environnement)
  L.lam = (opts, tune) => {
    if (!L.real()) return new THREE.MeshLambertMaterial(opts);
    const t = tune || {};
    const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: t.roughness !== undefined ? t.roughness : 0.84, metalness: t.metalness || 0 }, opts));
    m.envMapIntensity = (t.env !== undefined ? t.env : 0.45) * L.T.env;
    m.userData.look = 'std';
    return m;
  };
  // pièce métallique (carrosserie, canon, rotor…)
  L.metal = (opts, rough) => L.lam(opts, { metalness: 0.78, roughness: rough !== undefined ? rough : 0.38, env: 1.0 });
  // verre : Phong d'origine, ou verre sombre très lisse qui reflète le ciel
  L.glass = (opts) => {
    if (!L.real()) return new THREE.MeshPhongMaterial(opts);
    const m = new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.06, metalness: 0.55 });
    m.envMapIntensity = 1.6 * L.T.env; m.userData.look = 'glass';
    return m;
  };

  // vitre de décor (transparente) : Lambert d'origine, ou Standard très lisse qui reflète le ciel
  L.glassPane = (opts) => {
    if (!L.real()) return new THREE.MeshLambertMaterial(opts);
    const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.05, metalness: 0.35 }, opts));
    m.envMapIntensity = 1.5 * L.T.env; m.userData.look = 'pane';
    return m;
  };

  /* Cartes rugosité / métal des façades : les pixels « fenêtre » (bleutés) deviennent lisses et métalliques (ils reflètent le
   * ciel), le reste reste rugueux. Une seule texture (G = rugosité, B = métal), calculée une fois par façade à partir du dessin
   * de la texture elle-même (CC.Textures, canvasSource). */
  const orms = {};
  L.orm = function (key, tex) {
    if (orms[key] !== undefined) return orms[key];
    const src = tex && tex.canvasSource;
    if (!src) return (orms[key] = null);
    const w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) {
      const r = sd[i * 4], gg = sd[i * 4 + 1], b = sd[i * 4 + 2], glass = b > r + 18 && b > gg - 4 && sd[i * 4 + 3] > 0;
      d[i * 4] = 255; d[i * 4 + 1] = glass ? 26 : 214; d[i * 4 + 2] = glass ? 150 : 0; d[i * 4 + 3] = 255;   // rugosité 0,10 / 0,84 ; métal 0,6 / 0
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (orms[key] = t);
  };
  L.resetMaps = function () { for (const k in orms) { if (orms[k]) orms[k].dispose(); delete orms[k]; } };

  // réglages de matière par texture du décor : { opts: cartes, tune: rugosité / métal / reflet }
  const GLASSY = /^(facade|storefront)/;
  L.surface = function (key) {
    if (!L.real()) return null;
    const tex = CC.Textures.get(key);
    if (GLASSY.test(key)) { const o = L.orm(key, tex); if (o) return { opts: { roughnessMap: o, metalnessMap: o }, tune: { roughness: 1, metalness: 1, env: 1.15 } }; }
    if (/^(metal|corrugated|hazard|rail|tankGreen|blueFloor)/.test(key)) return { opts: {}, tune: { roughness: 0.46, metalness: 0.55, env: 0.9 } };
    if (/^(asphalt)/.test(key)) return { opts: {}, tune: { roughness: 0.62, metalness: 0.0, env: 0.35 } };
    if (/^(water)/.test(key)) return { opts: {}, tune: { roughness: 0.1, metalness: 0.3, env: 1.3 } };
    if (/^(grass|dirt|sand|rock|bark|camo|roofBrown|brick|planks)/.test(key)) return { opts: {}, tune: { roughness: 0.95, metalness: 0, env: 0.18 } };
    return { opts: {}, tune: { roughness: 0.86, metalness: 0, env: 0.4 } };
  };

  /* Carte d'environnement : le ciel du niveau (même shader que le fond d'écran) rendu en cube puis filtré (PMREM).
   * Appelée à chaque chargement de niveau en mode réaliste ; remplace l'ancienne carte. */
  L.buildEnv = function (game) {
    L.disposeEnv(game);
    if (!L.real() || !game.renderer) return;
    try {
      const sc = new THREE.Scene();
      const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), game.skyMat.clone());
      sky.frustumCulled = false; sc.add(sky);
      const pm = new THREE.PMREMGenerator(game.renderer);
      L.envRT = pm.fromScene(sc, 0, 0.1, 200);
      pm.dispose(); sky.geometry.dispose(); sky.material.dispose();
      game.scene.environment = L.envRT.texture;
    } catch (e) { console.warn('environment map unavailable', e); game.scene.environment = null; }
  };
  L.disposeEnv = function (game) {
    if (L.envRT) { L.envRT.dispose(); L.envRT = null; }
    if (game.scene) game.scene.environment = null;
  };

  CC.Look = L;
})();
