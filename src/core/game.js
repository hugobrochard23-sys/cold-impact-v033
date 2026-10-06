/* Boucle de jeu et machine à états.
 * BOOT → MENU → AIM (1re personne au lanceur) → FLIGHT → IMPACT (cible) | CRASHED → RESPAWN → AIM … → RESULTS
 * PAUSE et les surcouches SETTINGS / BINDS se superposent à n'importe quel état de jeu. */
(function () {
  const V = THREE.Vector3;
  const U = CC.U;

  const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
  const skyFrag = `uniform vec3 top, horizon, bottom, sunCol; uniform vec3 sunDir; uniform float sunSize; varying vec3 vDir;
    void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-y * 4.0, 0.0, 1.0), 0.6));
      float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 64.0) * 0.6 + pow(s, sunSize) * 0.9);
      gl_FragColor = vec4(c, 1.0); }`;

  class Telemetry {
    constructor() { this.frames = []; this.events = []; this.enabled = false; this.t = 0; }
    event(type, data) { if (this.enabled) this.events.push(Object.assign({ t: +this.t.toFixed(4), type }, data || {})); }
  }

  class Game {
    constructor(root) {
      CC.game = this;
      this.root = root;
      const P = new URLSearchParams(location.search);
      this.params = P;
      this.testMode = P.has('test');
      this.useAutopilot = P.has('autopilot');
      this.debug = P.has('showfps');
      this.genDebug = P.has('gendebug');                 // v032 : vue de débogage du générateur de missions (touche G)
      this.showHud = P.get('hud') !== '0';
      U.rng.reseed(parseInt(P.get('seed') || '1234', 10));

      this.canvas = document.createElement('canvas'); this.canvas.className = 'gl';
      this.hudCanvas = document.createElement('canvas'); this.hudCanvas.className = 'hud';
      root.appendChild(this.canvas); root.appendChild(this.hudCanvas);

      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: this.testMode, powerPreference: 'high-performance' });
      this.renderer.shadowMap.enabled = CC.CONFIG.render.shadows;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(CC.CONFIG.camera.fovV, 16 / 9, CC.CONFIG.camera.near, CC.CONFIG.camera.far);
      this.scene.add(this.camera);
      this.postfx = new CC.PostFX(this.renderer);
      this.effects = new CC.Effects(this.scene);
      this.audio = new CC.Audio(); this.audio.cam = this.camera;   // design : atténuation des sons avec la distance
      if (this.testMode || P.has('mute')) this.audio.enabled = false;
      this.telemetry = new Telemetry();
      this.style = new CC.Style(this);
      this.hud = new CC.HUD(this.hudCanvas);
      this.ui = new CC.UI(this);
      this.ads = new CC.Ads(this);   // v030 : publicités d'exemple (src/ui/ads.js)
      this.tutorial = new CC.Tutorial(this);   // v033-ux : premier vol guidé (src/ui/tutorial.js)
      this.input = new CC.Input(this, this.hudCanvas);
      this.domUi = CC.DomButtons.attach(this);   // v033-ux : boutons PAUSE / PASSER posés sur le jeu
      this.rig = new CC.CameraRig(this.camera, this);
      this.rocket = new CC.Rocket(this);
      this.trails = new CC.Trails(this);   // v026
      this.world = new CC.World();
      this.targets = []; this.grapplePoints = []; this.entities = []; this.missiles = [];
      this.initEnvironment();
      this.loadSave();
      // v023 : volumes enregistrés (SOUND / MUSIC sur OFF) appliqués dès le démarrage, avant même que le son soit créé
      this.audio.setVolumes(CC.CONFIG.audio.master, this.settings.music, this.settings.sfx);
      this.applyCosmetic();
      if (CC.Haptics) CC.Haptics.setLevel(this.settings.vibration);
      // v031 : retour d'un paiement Stripe (?paid=1&utm_content=<cosmétique>) → cosmétique débloqué ; la boutique s'ouvre sur sa célébration (start)
      if (!this.testMode && CC.Shop.handleReturn) this.paidReturn = CC.Shop.handleReturn(this);
      this.state = 'BOOT'; this.paused = false;
      this.runTime = 0; this.lastSpeed = 0; this.acc = 0; this.fps = 60; this.flash = 0;
      this.shoulder = CC.Models.shoulderLauncher(); this.shoulder.visible = false; this.camera.add(this.shoulder);
      this.tripod = null;
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
      this.resize();
    }

    // ---------- environnement ----------
    initEnvironment() {
      this.skyMat = new THREE.ShaderMaterial({
        vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new V(0, 1, 0) }, sunSize: { value: 900 } },
      });
      this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 16), this.skyMat);
      this.sky.renderOrder = -10; this.sky.frustumCulled = false;
      this.scene.add(this.sky);
      const sg = new THREE.BufferGeometry(), sp = [];
      const r = U.makeRng(5);
      for (let i = 0; i < 700; i++) { const u = r.range(-1, 1), a = r.range(0, 6.283), y = Math.abs(u); const rr = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * rr * 900, y * 900 + 20, Math.sin(a) * rr * 900); }
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }));
      this.stars.frustumCulled = false; this.stars.visible = false;
      this.sky.add(this.stars);
      this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.6); this.scene.add(this.hemi);
      this.ambient = new THREE.AmbientLight('#ffffff', 0.2); this.scene.add(this.ambient);
      this.sun = new THREE.DirectionalLight('#ffffff', 0.8);
      this.sun.castShadow = CC.CONFIG.render.shadows;
      const S = CC.CONFIG.render.shadowRange, sc = this.sun.shadow.camera;
      sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 1; sc.far = 400;
      this.sun.shadow.mapSize.set(CC.CONFIG.render.shadowMapSize, CC.CONFIG.render.shadowMapSize);
      this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.04;
      this.scene.add(this.sun); this.scene.add(this.sun.target);
      this.scene.fog = new THREE.Fog('#ffffff', 50, 800);
    }

    applyEnvironment(env) {
      const u = this.skyMat.uniforms;
      u.top.value.set(env.sky.top); u.horizon.value.set(env.sky.horizon); u.bottom.value.set(env.sky.bottom);
      u.sunCol.value.set(env.sky.sunColor || '#000000'); u.sunDir.value.fromArray(env.sun.dir).normalize(); u.sunSize.value = env.sky.sunSize || 900;
      this.stars.visible = !!env.sky.stars;
      this.scene.fog.color.set(env.fog.color); this.scene.fog.near = env.fog.near; this.scene.fog.far = env.fog.far;
      this.renderer.setClearColor(env.fog.color);
      this.hemi.color.set(env.hemi.sky); this.hemi.groundColor.set(env.hemi.ground); this.hemi.intensity = env.hemi.intensity;
      this.ambient.color.set(env.ambient.color); this.ambient.intensity = env.ambient.intensity;
      this.sun.color.set(env.sun.color); this.sun.intensity = env.sun.intensity;
      this.sunDir = new V().fromArray(env.sun.dir).normalize();
      this.sun.castShadow = CC.CONFIG.render.shadows && env.sun.shadow !== false && this.shadowsAllowed !== false;
      this.postParams = Object.assign({}, CC.CONFIG.postfx, env.postfx || {});
    }

    // ---------- sauvegarde / réglages ----------
    loadSave() {
      let s = null;
      // Clé d'avant le changement de nom : reprise une seule fois pour ne pas perdre la progression des joueurs.
      try { s = JSON.parse(localStorage.getItem('coldimpact.save') || localStorage.getItem('closecall.save') || 'null'); } catch (e) { s = null; }
      this.save = s || { best: {} };
      this.save.best = this.save.best || {};
      // Boutique (v007) : solde en centimes, cosmétiques possédés, cosmétique équipé.
      this.save.owned = this.save.owned || {};
      this.save.owned.stock = true;
      if (!this.save.owned[this.save.equipped]) this.save.equipped = 'stock';
      this.settings = Object.assign({ sensitivity: CC.CONFIG.input.sensitivity, invertY: false, music: CC.CONFIG.audio.music, sfx: CC.CONFIG.audio.sfx, postfx: true, graphics: 'auto', vibration: 2, touchSens: 1 }, (s && s.settings) || {});
      if (this.testMode) this.settings.postfx = this.params.get('postfx') !== '0';
    }
    writeSave() {
      if (this.testMode) return;
      this.save.settings = this.settings;
      try { localStorage.setItem('coldimpact.save', JSON.stringify(this.save)); } catch (e) { /* stockage indisponible */ }
    }
    applySettings() { this.audio.setVolumes(CC.CONFIG.audio.master, this.settings.music, this.settings.sfx); if (CC.Haptics) CC.Haptics.setLevel(this.settings.vibration); this.writeSave(); }

    // ---------- cosmétiques ----------
    applyCosmetic() { this.rocket.setSkin(CC.Skins.get(this.save.equipped)); }
    // v031 : débloque un cosmétique (paiement Stripe confirmé par le retour, ou minute de publicité regardée) et l'équipe
    unlockCosmetic(id) {
      const s = CC.Skins.byId[id];
      if (!s || this.save.owned[id]) return false;
      this.save.owned[id] = true;
      this.save.equipped = id;
      this.applyCosmetic(); this.writeSave();
      return true;
    }
    equipCosmetic(id) {
      if (!this.save.owned[id]) return false;
      this.save.equipped = id;
      this.applyCosmetic(); this.writeSave();
      return true;
    }

    // marges des zones système (encoche, coins arrondis, barre d'accueil) en pixels CSS, lues sur la sonde #cc-safe (style.css)
    readSafe() {
      const el = document.getElementById('cc-safe');
      if (!el) return (this.safe = { t: 0, b: 0, l: 0, r: 0 });
      const cs = getComputedStyle(el), n = (v) => Math.max(0, parseFloat(v) || 0);
      return (this.safe = { t: n(cs.paddingTop), b: n(cs.paddingBottom), l: n(cs.paddingLeft), r: n(cs.paddingRight) });
    }

    // ---------- dimensions (16:9 letterbox) ----------
    resize() {
      this.readSafe();
      const w = window.innerWidth, h = window.innerHeight, ar = CC.CONFIG.render.aspect;
      // v022 : écran tactile → plein écran (couché comme debout) ; ordinateur → zone 16:9 centrée
      const touch = !!(CC.Touch && CC.Touch.active);
      this.portrait = touch && h > w;
      let cw = w, ch = Math.round(w / ar);
      if (touch) {
        // la page peut réserver des marges pour l'encoche et la barre d'accueil (padding du document) : on les déduit,
        // sinon le bas du jeu (jauge d'essence) passe sous le bord de l'écran
        const cs = getComputedStyle(document.documentElement);
        ch = Math.max(1, h - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
      }
      else if (ch > h) { ch = h; cw = Math.round(h * ar); }
      this.root.style.width = cw + 'px'; this.root.style.height = ch + 'px';
      const pr = this.testMode ? 1 : Math.min(window.devicePixelRatio || 1, CC.CONFIG.render.maxPixelRatio);
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(cw, ch, false);
      this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
      this.hudCanvas.width = Math.round(cw * pr); this.hudCanvas.height = Math.round(ch * pr);
      this.hudCanvas.style.width = cw + 'px'; this.hudCanvas.style.height = ch + 'px';
      this.camera.aspect = cw / ch;
      // debout, l'écran est étroit : on élargit la vue verticale pour garder un angle horizontal suffisant (v022)
      const fovV = CC.CONFIG.camera.fovV, minH = touch ? CC.CONFIG.input.touch.fovMinH : 0;
      const needV = 2 * Math.atan(Math.tan(U.deg(minH) / 2) / this.camera.aspect) * 180 / Math.PI;
      this.camera.fov = this.baseFov = Math.min(100, Math.max(fovV, needV));   // baseFov : sans le zoom du boost (v026)
      if (this.rig) this.rig.zoom = 1;
      this.camera.updateProjectionMatrix();
      this.postfx.setSize(Math.round(cw * pr), Math.round(ch * pr));
    }

    // ---------- niveaux ----------
    unloadLevel() {
      if (this.endlessRun) { this.endlessRun.dispose(); this.endlessRun = null; }   // v033 : tronçons du couloir infini
      if (this.builder) { this.builder.dispose(); this.builder = null; }
      for (const m of this.missiles) this.scene.remove(m.object);
      for (const t of this.targets) if (t.clearWreck) t.clearWreck(this);   // design : épaves ajoutées à la scène
      this.missiles = []; this.targets = []; this.grapplePoints = []; this.entities = [];
      if (this.tripod) { this.scene.remove(this.tripod); this.tripod = null; }
      this.effects.clear(); this.rocket.reset(); this.trails.clear();
      this.world = new CC.World();
    }

    loadLevel(i) {
      this.generated = false;
      this.loadLevelFrom(CC.Levels[i], i);
    }

    loadLevelFrom(L, i) {
      this.unloadLevel();
      this.level = L; this.levelIndex = i;
      U.levelRng.reseed(L.seed || 7);
      const b = new CC.LevelBuilder(this.scene, this.world, L);
      this.builder = b;
      L.build(b, this);
      // v023 : niveaux 1 à 3 → flèches vertes le long du chemin (à partir du 4e, les points rouges suffisent)
      if (this.guideLevel(i, L)) b.guideArrows(L.routes || [L.route], CC.CONFIG.hud.guideArrowStep);
      b.finish();
      this.targets = b.targets; this.grapplePoints = b.grapplePoints; this.entities = b.entities;
      this.groundVehicles();
      this.applyEnvironment(L.env);
      const la = L.launcher;
      this.launcherEye = new V().fromArray(la.pos);
      if (la.type === 'tripod') {
        this.tripod = CC.Models.tripodLauncher();
        const fwd = new V(-Math.sin(U.deg(la.yaw)), 0, -Math.cos(U.deg(la.yaw)));
        this.tripod.position.copy(this.launcherEye).addScaledVector(fwd, 2.0); this.tripod.position.y -= 1.6;
        this.tripod.rotation.y = U.deg(la.yaw);
        this.tripod.userData.head.rotation.x = U.deg(la.pitch || 0) * 0.5;
        this.scene.add(this.tripod);
      }
      this.renderer.compile(this.scene, this.camera);
    }

    // Design : véhicules au sol (chars, camions, maisons) posés exactement sur la surface sous eux (sol bosselé, dalle) :
    // plus de chenilles qui flottent de quelques centimètres ni de roues enfoncées. Écart limité à ±1,5 m (erreur de niveau).
    groundVehicles() {
      const down = new V(0, -1, 0);
      for (const t of this.targets) {
        if (t.type !== 'tank' && t.type !== 'truck' && t.type !== 'house') continue;
        const p = t.object.position;
        const hit = this.world.raycast(new V(p.x, p.y + 1.5, p.z), down, 3.2, (bx) => bx.kind === 'solid' || bx.kind === 'brick');
        if (!hit || Math.abs(hit.point.y - p.y) > 1.5) continue;
        p.y = hit.point.y; t.base.y = p.y;
        t.updateObb();
      }
    }

    startLevel(i) {
      this.loadLevel(i);
      this.restartLevel();
      if (!this.testMode) { this.input.requestLock(); this.audio.init(); this.audio.resume(); if (this.audio.music) this.audio.music.start(); }
    }

    /* v032 : mission générée (src/world/gen/) — graine tirée au hasard, ou donnée (seed partagée, carte du jour, banc de
     * test) : même graine + même difficulté = même carte. Seuls la graine, la difficulté et quelques statistiques sont
     * sauvegardés ; la carte, elle, est reconstruite à chaque fois. */
    startGenerated(diffId, seed, opts) {
      opts = opts || {};
      if (seed === undefined || seed === null) seed = CC.Gen.randomSeed();
      const t0 = performance.now();
      const plan = CC.Gen.generate(seed, diffId, { keepNav: !!this.genDebug, biome: opts.biome || (this.testMode ? this.params.get('biome') : null) });
      const t1 = performance.now();
      const L = CC.Gen.toLevel(plan);
      this.loadLevelFrom(L, -1);
      const t2 = performance.now();
      this.generated = true;
      this.mission = Object.assign({}, L.mission, { daily: opts.daily || null, challenge: opts.challenge || null, genMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), attempt: plan.attempt });
      this.restartLevel();
      // brief de mission : graine, zone, difficulté, cibles (quelques secondes au lanceur)
      const m = this.mission;
      this.centerMsg = opts.challenge ? 'CHALLENGE ' + m.label + '  -  MAP ' + opts.challenge.n + '/' + CC.CONFIG.challenge.maps + '  -  ' + m.biome
        : (opts.daily ? 'DAILY MISSION  ' : 'MISSION ') + seed + '  -  ' + m.biome + '  -  ' + m.label;
      this.centerMsgT = 3.4;
      if (!this.testMode) { this.input.requestLock(); this.audio.init(); this.audio.resume(); if (this.audio.music) this.audio.music.start(); }
    }
    // Écran « GÉNÉRATION... » affiché une image avant le calcul (sinon le jeu semble figé pendant la construction)
    requestMission(diffId, seed, opts) {
      this.pendingMission = { diffId, seed, opts, frames: 0 };
      this.ui.overlay = 'generating';
      this.audio.init(); this.audio.resume();
    }
    runPendingMission() {
      const pm = this.pendingMission;
      if (!pm || ++pm.frames < 2) return;
      this.pendingMission = null;
      try { this.startGenerated(pm.diffId, pm.seed, pm.opts); this.ui.overlay = null; } catch (e) {
        console.error(e); this.ui.overlay = 'missions'; this.ui.toast('GENERATION FAILED - TRY ANOTHER SEED', '#ff9a3a', 3.4);
      }
    }

    /* v033 : mode CLASSIQUE — couloir infini (src/world/endless.js). Chaque partie a sa graine (une nouvelle à chaque
     * essai, sauf graine imposée par le banc de test) ; une seule vie, score = mètres parcourus. */
    startEndless(seed) {
      if (seed === undefined || seed === null) seed = CC.Gen.randomSeed();
      this.generated = false; this.mission = null;
      const L = CC.Endless.level(seed);
      this.loadLevelFrom(L, -1);
      this.endlessRun = new CC.Endless.Run(this, L);
      this.restartLevel(true);
      this.rocket.fuel = CC.CONFIG.endless.fuelStart;
      const rec = this.save.endless && this.save.endless.best;
      this.centerMsg = rec ? 'BEST ' + Math.round(rec) + ' M' : 'GO AS FAR AS YOU CAN';
      this.centerMsgT = 2.6;
      if (!this.testMode) { this.input.requestLock(); this.audio.init(); this.audio.resume(); if (this.audio.music) this.audio.music.start(); }
    }

    // v033 : partie CLASSIQUE terminée (crash) → distance, record, cause
    finishEndless() {
      const run = this.endlessRun, S = this.save, dist = Math.round(run.dist);
      S.endless = S.endless || { best: 0, runs: 0 };
      const prev = S.endless.best || 0;
      S.endless.runs = (S.endless.runs || 0) + 1;
      if (dist > prev) S.endless.best = dist;
      const causes = { wall: 'WALL', hazard: 'LASER', cable: 'CABLE', missile: 'MISSILE', altitude: 'TOO HIGH', outOfBounds: 'FELL', stalled: 'OUT OF FUEL' };
      this.results = { endless: true, title: 'DISTANCE ' + dist + ' M', dist, best: S.endless.best, newRecord: dist > prev && prev > 0, firstRun: prev === 0,
        style: this.style.total, time: this.runTime, stage: run.stageLabel(), cause: causes[this.crashKind] || 'CRASH' };
      this.state = 'RESULTS'; this.centerMsg = null;
      if (this.ads) this.ads.onLevelEnd();
      this.writeSave();
      this.input.exitLock();
      this.telemetry.event('results', { dist, style: this.style.total });
    }

    // v033 : chaque gain de STYLE recharge l'essence en mode CLASSIQUE (la destruction d'une cible a son propre bonus)
    onStyleAward(label, points) {
      if (this.endlessRun && label !== 'BOMB SMASH!') this.endlessRun.addFuel(points * CC.CONFIG.endless.fuelPerStyle);
    }

    restartLevel(fromEndless) {
      if (this.endlessRun && fromEndless !== true) { this.startEndless(this.testMode ? this.level.seed : null); return; }   // v033 : nouveau couloir
      for (const t of this.targets) { t.reset(); t.updateObb(); }
      for (const e of this.entities) if (e.reset && !(e instanceof CC.Target)) e.reset();
      for (const m of this.missiles) this.scene.remove(m.object);
      this.missiles = [];
      this.effects.clear();
      this.style.reset();
      this.runTime = 0; this.targetsDone = 0; this.results = null; this.firstFire = true;
      this.telemetry.event('restart', { level: this.level.id });
      this.enterAim(true);
    }

    enterAim(resetAim) {
      const la = this.level.launcher;
      this.state = 'AIM'; this.centerMsg = null; this.centerMsgT = 0; this.paused = false;
      if (this.launchFx) { this.launchFx.bore.ring.visible = false; this.launchFx = null; }
      this.rocket.reset();
      { this.input.setAim(U.deg(la.yaw), U.deg(la.pitch || 0)); if (this.autopilot) this.autopilot.init(U.deg(la.yaw), U.deg(la.pitch || 0)); }
      this.rig.setAim(U.deg(la.yaw), U.deg(la.pitch || 0));
      this.rig.startLauncher(this.launcherEye);
      this.shoulder.visible = la.type !== 'tripod';
      this.shoulder.position.set(0, -0.44, -0.78);
      this.shoulder.rotation.set(this.rig.crossAngle() + 0.04, 0, 0);
      this.aimTime = 0;
      if (this.useAutopilot) { this.autopilot = new CC.Autopilot(this, this.level); this.autopilot.init(U.deg(la.yaw), U.deg(la.pitch || 0)); }
    }

    // v024 : animation du tir. Le renflement parcourt le tube en launchFx s, le lanceur recule puis revient.
    updateLaunchFx(dt) {
      const fx = this.launchFx;
      if (!fx) return;
      fx.t += dt;
      const D = CC.CONFIG.render.launchFx, k = Math.min(1, fx.t / D), ring = fx.bore.ring;
      ring.visible = k < 1;
      ring.position.z = fx.bore.z0 + (fx.bore.z1 - fx.bore.z0) * k;
      const swell = 1 + 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.15));      // gonfle puis dégonfle en arrivant à la bouche
      ring.scale.set(swell, 1, swell);
      const kick = Math.sin(Math.PI * Math.min(1, fx.t / (D * 1.6))) * (fx.host === this.tripod ? 0.12 : 0.07);
      if (fx.host === this.shoulder) fx.host.position.set(fx.base.x, fx.base.y, fx.base.z + kick);   // recul vers l'arrière
      if (k >= 1 && fx.t > D * 1.6) { if (fx.host === this.shoulder) fx.host.position.copy(fx.base); ring.visible = false; this.launchFx = null; }
    }

    fire() {
      const dir = this.rig.aimDir.clone();
      const muzzle = this.launcherEye.clone().addScaledVector(dir, this.level.launcher.type === 'tripod' ? 3.2 : 1.3).addScaledVector(this.rig.up, -0.25);
      this.rocket.launch(muzzle, dir);
      if (this.endlessRun) this.rocket.fuel = Math.min(this.rocket.fuel, CC.CONFIG.endless.fuelStart);   // v033 : réservoir de 20 s, départ à 14 s
      this.effects.launchBurst(muzzle.clone(), dir);
      this.audio.play('launch');
      // v024 : animation du tube (renflement qui file vers la bouche + recul)
      const host = this.level.launcher.type === 'tripod' ? this.tripod : this.shoulder;
      if (host && host.userData.bore) this.launchFx = { t: 0, host, bore: host.userData.bore, base: host.position.clone() };
      this.rig.startFlight();
      this.state = 'FLIGHT'; this.flightTime = 0;
      this.telemetry.event('fire', { runTime: this.runTime });
    }

    respawn() {
      if (this.level.mode === 'targets') this.enterAim(true);
      else this.restartLevel();
    }

    onTargetHit(t, rocket) {
      const c = t.obb.c.clone();
      t.kill(this);
      if (this.endlessRun) {   // v033 : la roquette traverse la cible et continue ; essence rechargée
        this.effects.explosion(c, null, true, 'orange');
        this.rig.shake = 0.7;
        this.audio.play('boom', c); this.audio.play('target');
        this.style.bombSmash(rocket.vel.length());
        this.endlessRun.addFuel(CC.CONFIG.endless.fuelTarget);
        if (CC.Haptics) CC.Haptics.medium();
        this.telemetry.event('targetHit', { target: t.type, speed: +rocket.vel.length().toFixed(2), runTime: +this.runTime.toFixed(3) });
        return;
      }
      if (!t.guard) this.targetsDone++;   // v021 : un tank de garde détruit ne compte pas dans l'objectif
      const speed = rocket.vel.length();
      this.lastSpeed = 4;                                            // MESURÉ : "SPEED:4" après l'impact
      const variant = this.level.impactVariant || 'orange';
      this.effects.explosion(c, null, true, variant);
      if (variant === 'cyan') { this.flash = 1; this.flashColor = '#dff8ff'; }
      this.rig.startImpact(c); this.rig.shake = 1;
      this.audio.play('boom', c); this.audio.play('target');
      if (CC.Haptics) CC.Haptics.heavy();   // v033-ux : cible détruite = gros impact
      this.style.bombSmash(speed);
      rocket.active = false; rocket.mesh.visible = false; rocket.light.intensity = 0; rocket.rope.visible = false;
      this.telemetry.event('targetHit', { target: t.type, speed: +speed.toFixed(2), runTime: +this.runTime.toFixed(3) });
      const all = this.targets.every((x) => !x.alive || x.guard);
      if (all) {
        if (this.level.parTime && this.runTime < this.level.parTime && this.level.hud !== 'B') this.style.speedBonus(this.level.parTime - this.runTime);
        this.state = 'IMPACT'; this.impactT = 0; this.complete = true;
      } else {
        this.state = 'IMPACT'; this.impactT = 0; this.complete = false;
      }
    }

    onRocketCrash(kind, pos, normal) {
      if (!this.rocket.active) return;
      const rk = this.rocket;
      this.lastSpeed = 0; this.crashKind = kind;
      rk.active = false; rk.mesh.visible = false; rk.light.intensity = 0; rk.rope.visible = false; rk.grapple.active = false;
      this.effects.explosion(pos, normal, false, 'orange');
      this.audio.play('boom', pos);
      this.style.dropCombos();
      this.rig.startImpact(pos); this.rig.shake = 0.8;
      if (CC.Haptics) CC.Haptics.heavy();   // v033-ux : explosion de la roquette
      this.state = 'CRASHED'; this.impactT = 0;
      this.telemetry.event('crash', { kind, pos: pos.toArray().map((v) => +v.toFixed(2)), runTime: +this.runTime.toFixed(3) });
    }

    guideLevel(i, L) { return i >= 0 && i < CC.CONFIG.hud.guideArrowLevels && L.guide !== false && !!(L.routes || L.route); }   // v027 : `guide: false` dans la fiche du niveau → repères rouges

    // v023 : progression — un niveau est ouvert si c'est le premier ou si le précédent a déjà été terminé (record enregistré)
    isUnlocked(i) { return i <= 0 || !!(CC.Levels[i - 1] && this.save.best[CC.Levels[i - 1].id]); }
    nextUnlocked() {
      const n = this.levelIndex + 1;
      return !this.generated && this.levelIndex >= 0 && n < CC.Levels.length && this.isUnlocked(n) ? n : -1;
    }

    // v023 : salves anti-aériennes sur les 3 derniers niveaux et sur AUTOMAP difficile
    aaSalvo() {
      const L = this.level;
      if (!L) return false;
      if (L.aaSalvo !== undefined) return L.aaSalvo;                 // v032 : profil de la mission générée
      return L.generated ? L.difficulty === 'hard' : this.levelIndex >= CC.Levels.length - 3;
    }

    respawnMsg() { return CC.Touch && CC.Touch.active ? 'TAP TO RESPAWN' : 'CLICK TO RESPAWN AT THE LAUNCHER'; }

    // v020 : niveau de menace des tirs anti-aériens, 0 (premier niveau) → 1 (dernier) ; AUTOMAP : selon la difficulté
    aaThreat() {
      const L = this.level;
      if (!L) return 0;
      if (L.aaThreat !== undefined) return L.aaThreat;               // v032 : profil de la mission générée (0 → 1)
      if (L.generated) return CC.CONFIG.aaByDifficulty[L.difficulty] !== undefined ? CC.CONFIG.aaByDifficulty[L.difficulty] : 0.5;
      return CC.Levels.length > 1 ? U.clamp(this.levelIndex / (CC.Levels.length - 1), 0, 1) : 0;
    }

    spawnEnemyMissile(from, rocket, opts) {
      const m = new CC.EnemyMissile(from, rocket, opts);
      this.scene.add(m.object); this.missiles.push(m);
      if (!opts || !opts.quiet) this.audio.play('launch');   // design : tirs de char / d'hélicoptère → leur propre son (onFire)
      this.telemetry.event('enemyMissile', {});
    }

    finishLevel() {
      const id = this.level.id, best = this.save.best[id];
      const r = { title: this.level.mode === 'targets' ? 'ALL TARGETS DESTROYED' : 'TARGET DESTROYED', time: this.runTime, style: this.style.total, newRecord: false };
      if (!best || this.runTime < best.time) { this.save.best[id] = { time: this.runTime, style: this.style.total }; r.newRecord = !!best || true; }
      r.bestTime = this.save.best[id].time;
      if (this.generated && this.mission) this.recordMission(r);
      if (this.generated && this.mission && this.mission.challenge) this.recordChallenge(r);   // v033
      if (this.tutorial.active) { this.writeSave(); this.tutorial.finish(false); return; }   // v033-ux : le tutoriel s'achève sur le menu, sans écran de résultats
      this.results = r; this.state = 'RESULTS'; this.centerMsg = null;
      if (this.ads) this.ads.onLevelEnd();
      this.writeSave();
      this.input.exitLock();
      this.telemetry.event('results', { time: r.time, style: r.style });
    }

    /* v032 : historique léger des missions (graine, difficulté, temps) + record par graine et par carte du jour.
     * Aucune carte n'est stockée : la graine suffit à la reconstruire. */
    recordMission(r) {
      const m = this.mission, S = this.save, key = m.difficulty + ':' + m.seed;
      S.missions = (S.missions || []).filter((x) => x.k !== key);
      S.missions.unshift({ k: key, seed: m.seed, d: m.difficulty, b: m.biome, t: +r.time.toFixed(2), s: Math.round(r.style), at: new Date().toISOString().slice(0, 10) });
      S.missions.length = Math.min(S.missions.length, 30);
      S.seedBest = S.seedBest || {};
      const prev = S.seedBest[key];
      r.seedBest = prev === undefined ? r.time : Math.min(prev, r.time); r.seedRecord = prev === undefined || r.time < prev;
      S.seedBest[key] = +r.seedBest.toFixed(2);
      const keys = Object.keys(S.seedBest);
      if (keys.length > 200) delete S.seedBest[keys[0]];               // au plus 200 records de graines
      if (m.daily) { S.daily = S.daily || {}; const d = S.daily[m.daily]; if (d === undefined || r.time < d) S.daily[m.daily] = +r.time.toFixed(2); }
    }

    /* v033 : mode DÉFI — 20 cartes fixes par difficulté (graines communes à tous), 1 à 3 étoiles au temps, la carte
     * suivante s'ouvre quand la précédente est terminée ; trophées BRONZE / ARGENT / OR au total d'étoiles. */
    startChallenge(diff, n) { this.requestMission(diff, CC.Gen.challengeSeed(diff, n), { challenge: { diff, n } }); }
    challengeRec(diff, n) { const c = this.save.challenge && this.save.challenge[diff]; return (c && c[n]) || null; }
    challengeOpen(diff, n) { return n <= 1 || !!this.challengeRec(diff, n - 1); }
    challengeStars(diff) { let t = 0; for (let n = 1; n <= CC.CONFIG.challenge.maps; n++) { const r = this.challengeRec(diff, n); if (r) t += r.s; } return t; }
    starsFor(time, par) { const C = CC.CONFIG.challenge; return time <= par * C.star3 ? 3 : time <= par * C.star2 ? 2 : 1; }
    recordChallenge(r) {
      const ch = this.mission.challenge, S = this.save, par = this.level.parTime;
      S.challenge = S.challenge || {}; S.challenge[ch.diff] = S.challenge[ch.diff] || {};
      const prev = S.challenge[ch.diff][ch.n], stars = this.starsFor(r.time, par);
      r.challenge = { diff: ch.diff, n: ch.n, stars, prevStars: prev ? prev.s : 0, par,
        next: stars < 3 ? par * (stars === 2 ? CC.CONFIG.challenge.star3 : CC.CONFIG.challenge.star2) : null,
        trophyBefore: this.trophyCount(ch.diff) };
      S.challenge[ch.diff][ch.n] = { s: Math.max(stars, prev ? prev.s : 0), t: +Math.min(r.time, prev ? prev.t : Infinity).toFixed(2) };
      r.challenge.trophyAfter = this.trophyCount(ch.diff);
      r.challenge.best = S.challenge[ch.diff][ch.n].t;
    }
    trophyCount(diff) { const s = this.challengeStars(diff); return CC.CONFIG.challenge.trophies.filter((t) => s >= t).length; }

    toMenu() {
      this.paused = false; this.ui.overlay = null; this.ui.modal = null; this.tutorial.active = false;
      this.input.exitLock();
      if (this.levelIndex === undefined || !this.level) this.loadLevel(0);
      this.state = 'MENU'; this.centerMsg = null; this.rocket.reset(); this.shoulder.visible = false;
      const m = this.level.menuView || { center: this.level.launcher.pos, radius: 40, height: 18 };
      this.rig.startMenu(new V().fromArray(m.center), m.radius, m.height);
    }

    pause() { if (['AIM', 'FLIGHT', 'IMPACT', 'CRASHED', 'RESPAWN'].includes(this.state)) { this.paused = true; this.input.exitLock(); } }
    resume() { this.paused = false; this.ui.overlay = null; if (!this.testMode) this.input.requestLock(); }

    onPointerLost() { if (!this.testMode && !this.ui.overlay && ['AIM', 'FLIGHT', 'IMPACT', 'CRASHED', 'RESPAWN'].includes(this.state)) this.paused = true; }

    onKey(k) {
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement.tagName === 'INPUT') return;   // saisie d'une graine
      this.audio.init(); this.audio.resume();
      const inGame = ['AIM', 'FLIGHT', 'IMPACT', 'CRASHED', 'RESPAWN'].includes(this.state);
      if (k === 'Escape') {
        // clavier : confort sur ordinateur (chaque écran a aussi son bouton RETOUR / REPRENDRE au toucher)
        if (this.ui.back()) return;
        if (this.state === 'RESULTS') { this.toMenu(); return; }
        if (inGame) { if (this.paused) this.resume(); else this.pause(); }
      } else if (k === 'Tab') {
        if (this.ui.overlay === 'settings') this.ui.back(); else { this.ui.open('settings'); if (inGame) this.pause(); }
      } else if (k === 'F1') {
        if (this.ui.overlay === 'help') this.ui.back(); else { this.ui.open('help'); if (inGame) this.pause(); }
      } else if (k === 'KeyR' && (inGame || this.state === 'RESULTS')) {
        this.paused = false; this.ui.overlay = null; this.restartLevel(); if (!this.testMode) this.input.requestLock();
      } else if (k === 'KeyN' && this.state === 'RESULTS' && !this.generated && this.levelIndex < CC.Levels.length - 1) {
        this.startLevel(this.levelIndex + 1);
      } else if (k === 'KeyH') { this.showHud = !this.showHud; }
      else if (k === 'KeyG' && (this.generated || this.state === 'MENU')) { this.genDebug = !this.genDebug; }   // v032 : vue de débogage du générateur
    }

    // ---------- boucle ----------
    update(dt) {
      const inp = (this.useAutopilot && this.autopilot && this.state !== 'MENU') ? this.autopilot.poll(dt) : this.input.poll(dt);
      if (inp.aimQ) this.rig.setAimQ(inp.aimQ);
      else { this.input.setAim(inp.yaw, inp.pitch); this.rig.setAim(inp.yaw, inp.pitch); }   // pilote automatique : lacet / tangage
      const rk = this.rocket;
      switch (this.state) {
        case 'AIM':
          this.aimTime += dt;
          if (inp.fire && this.aimTime > 0.15) this.fire();
          break;
        case 'FLIGHT': {
          this.flightTime += dt;
          if (this.flightTime > 0.28) this.shoulder.visible = false;   // v024 : 0,2 → 0,28 s, le temps de voir l'animation du tube
          if (inp.thrust !== rk.throttle) { rk.throttle = inp.thrust; this.telemetry.event('engine', { on: rk.throttle }); }
          if (inp.grappleEdge) rk.tryGrapple(this.rig.aimDir, this.camera.position);
          const fdt = CC.CONFIG.physics.fixedDt;
          this.acc += dt;
          let n = 0;
          while (this.acc >= fdt && n < 80) {
            this.acc -= fdt; n++;
            rk.step(fdt, { aimDir: this.rig.aimDir, retro: inp.retro });
            if (!rk.active) break;
          }
          if (rk.active) {
            rk.frame(dt, inp);
            this.updateWarnings(dt, rk);
            this.lastSpeed = rk.speed;
            const killY = this.level.killY !== undefined ? this.level.killY : -60;
            if (rk.pos.y < killY || (rk.pos.length() > 4000 && !this.endlessRun)) this.onRocketCrash('outOfBounds', rk.pos.clone(), null);   // v033 : le couloir infini n'a pas de bord
            // v032 : roquette immobilisée (posée en glissant sur un toit, sans essence) → comptée comme un crash, sinon
            // la partie ne peut plus avancer
            this.stallT = rk.speed < 3 && this.flightTime > 1 ? (this.stallT || 0) + dt : 0;
            if (rk.active && this.stallT > 1.5) { this.stallT = 0; this.onRocketCrash('stalled', rk.pos.clone(), null); }
          }
          this.runTime += dt;
          break;
        }
        case 'IMPACT':
          this.impactT += dt;
          if (this.level.mode === 'targets' && !this.complete) this.runTime += dt;
          if (this.complete && this.impactT > 2.2) this.finishLevel();
          else if (!this.complete && this.impactT > 0.5) { this.state = 'RESPAWN'; this.centerMsg = this.respawnMsg(); }
          break;
        case 'CRASHED':
          this.impactT += dt;
          if (this.endlessRun) { if (this.impactT > 1.3) this.finishEndless(); break; }   // v033 : une seule vie
          if (this.level.mode === 'targets') this.runTime += dt;
          if (this.impactT > 0.45) { this.state = 'RESPAWN'; this.centerMsg = this.respawnMsg(); }
          break;
        case 'RESPAWN':
          if (this.level.mode === 'targets') this.runTime += dt;
          if (inp.fire || (this.useAutopilot && this.impactT > 1.2)) this.respawn();
          this.impactT += dt;
          break;
      }
      this.updateLaunchFx(dt);
      if (this.endlessRun && this.state !== 'MENU' && this.state !== 'RESULTS') this.endlessRun.update(dt);   // v033 : tronçons, paliers, zones
      for (const e of this.entities) if (e.update) e.update(dt, this);
      for (const m of this.missiles) m.update(dt, this);
      this.missiles = this.missiles.filter((m) => { if (!m.alive) this.scene.remove(m.object); return m.alive; });
      if (this.centerMsgT > 0 && (this.centerMsgT -= dt) <= 0) { this.centerMsg = null; this.centerMsgT = 0; }   // message passager (graine de la carte générée)
      if (this.state === 'FLIGHT') this.style.update(dt, rk); else this.style.update(dt, null);
      this.effects.update(dt, this.camera);
      this.rig.update(dt);
      this.trails.update(dt, rk, this.camera);   // après la caméra : effacement près de sa position de cette image
      this.audio.updateRocket(rk, dt);
      this.audio.updateWorld(this, dt);
      this.flash = Math.max(0, this.flash - dt * 7);
      this.telemetry.t += dt;
    }

    // v026 : alertes « MISSILE! » (bip répété + vibration à l'arrivée) et « LOW FUEL » (deux notes + vibration une fois).
    // L'affichage est dans le HUD, qui lit this.warn.
    updateWarnings(dt, rk) {
      const W = this.warn || (this.warn = { missile: false, lowFuel: false, beepT: 0 });
      const buzz = () => { if (CC.Haptics) CC.Haptics.medium(); };
      const missile = this.missiles.some((m) => m.alive && m.pos.distanceTo(rk.pos) < CC.CONFIG.aa.warnDist);
      if (missile) {
        if (!W.missile) { buzz(); W.beepT = 0; }
        if ((W.beepT -= dt) <= 0) { this.audio.play('warnMissile'); W.beepT = CC.CONFIG.aa.warnBeep; }
      }
      W.missile = missile;
      const lowFuel = !rk.freeBoost && rk.fuel > 0 && rk.fuel / rk.fuelMax < CC.CONFIG.rocket.lowFuel;
      if (lowFuel && !W.lowFuel) { this.audio.play('warnFuel'); buzz(); this.telemetry.event('lowFuel', { fuel: +rk.fuel.toFixed(2) }); }
      W.lowFuel = lowFuel;
    }

    render(time) {
      // lumière du soleil et ombres centrées sur la zone d'intérêt
      const focus = this.rocket.active ? this.rocket.pos : this.camera.position;
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
      this.sun.target.position.copy(focus);
      this.sky.position.copy(this.camera.position);
      if (this.settings.postfx && this.postParams) {
        this.postParams.flash = this.flash * 0.85; this.postParams.flashColor = this.flashColor || '#ffffff';
        this.postfx.render(this.scene, this.camera, this.postParams, time);
      } else {
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      }
    }

    tick(dt) {
      if (this.ads) this.ads.update(dt);
      if (this.pendingMission) this.runPendingMission();
      if (this.tutorial.active) this.tutorial.update(dt);
      if (!this.paused && this.state !== 'BOOT') this.update(dt * this.tutorial.timeScale());   // tutoriel : ralenti tant que le geste demandé n'est pas fait
      else { this.input.poll(0); this.rig.update(0); }
      this.render(performance.now() / 1000);
      this.hud.draw(this, dt);
      if (this.domUi) this.domUi.update();
      if (this.telemetry.enabled) this.recordFrame();
    }

    recordFrame() {
      const rk = this.rocket, f = { t: +this.telemetry.t.toFixed(4), state: this.state, run: +this.runTime.toFixed(3), style: this.style.total };
      if (rk.active) {
        f.pos = rk.pos.toArray().map((v) => +v.toFixed(2)); f.speed = +rk.speed.toFixed(2); f.thrust = rk.thrusting; f.g = +rk.gForce.toFixed(2); f.gauge = +rk.gauge.toFixed(3); f.fuel = +rk.fuel.toFixed(2);
        const n = rk.nozzle(new V()).project(this.camera);
        f.nozzle = [+(n.x * 0.5 + 0.5).toFixed(4), +(0.5 - n.y * 0.5).toFixed(4)];
        f.cam = this.camera.position.toArray().concat(this.camera.quaternion.toArray()).map((v) => +v.toFixed(4));   // pose caméra (mesures de stabilité)
      }
      this.telemetry.frames.push(f);
    }

    start() {
      if (this.testMode) { this.initTestHarness(); return; }
      this.quality = new CC.Quality(this);
      this.quality.apply(this.quality.initial());
      this.watchVisibility();
      this.toMenu();
      // v032 : lien partagé ?mission=<graine>&diff=<difficulté> → écran du générateur avec cette graine
      const ms = CC.Gen.parseSeed(this.params.get('mission'));
      if (ms !== null) { this.ui.overlay = 'missions'; this.ui.seedChoice = ms; this.ui.diffChoice = this.params.get('diff'); }
      else if (this.paidReturn) this.ui.openShop(this.paidReturn);   // retour de paiement : la boutique s'ouvre sur la célébration
      else if (!this.settings.tutorialDone) this.tutorial.start();   // v033-ux : tout premier lancement → premier vol guidé
      const Q = CC.CONFIG.quality;
      let last = performance.now(), fpsAcc = 0, fpsN = 0;
      const loop = (now) => {
        requestAnimationFrame(loop);
        // v030 : cadence plafonnée — 60 images/s en jeu sur écran tactile (écrans 120 Hz), 20 dans les menus et la pause
        const idle = this.paused || this.state === 'MENU' || this.state === 'RESULTS' || this.hidden;
        const cap = this.hidden ? 4 : idle ? (this.ui.fast() ? Q.maxFpsTouch : Q.pausedFps) : (CC.Touch && CC.Touch.active ? Q.maxFpsTouch : 0);   // v033-ux : 60 images/s dès que l'interface s'anime (appui, défilement, aperçu)
        if (cap && now - last < 1000 / cap - 2) return;
        const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now;
        fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { this.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
        this.quality.watch(real);
        this.tick(dt);
      };
      requestAnimationFrame(loop);
    }

    // v030 : application mise en arrière-plan (autre appli, écran verrouillé, onglet masqué) → partie en pause et son
    // suspendu (sur Android, une WebView continue sinon de jouer la musique et le moteur) ; au retour, le son reprend,
    // la partie reste en pause (le joueur reprend quand il est prêt).
    watchVisibility() {
      const onHide = () => { this.hidden = true; this.pause(); if (this.audio.ctx && this.audio.ctx.state === 'running') this.audio.ctx.suspend(); if (CC.Haptics) CC.Haptics.boostStop(); };
      const onShow = () => { this.hidden = false; if (this.audio.ctx) this.audio.resume(); };
      document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
      window.addEventListener('pagehide', onHide);
      window.addEventListener('pageshow', onShow);
    }

    // ---------- banc de test (enregistrements déterministes) ----------
    initTestHarness() {
      const P = this.params;
      const fps = parseFloat(P.get('fps') || CC.CONFIG.test.fps);
      const lv = Math.max(0, Math.min(CC.Levels.length - 1, parseInt(P.get('level') || '1', 10) - 1));
      this.telemetry.enabled = true;
      // ?gen=easy|medium|hard&seed=N : carte aléatoire reproductible (enregistrable comme les niveaux fixes)
      if (P.get('gen')) this.startGenerated(P.get('gen'), parseInt(P.get('seed') || '4242', 10));
      else if (P.has('endless')) this.startEndless(parseInt(P.get('endless') || '4242', 10));   // v033 : ?endless=<graine>
      else this.startLevel(lv);
      const self = this;
      CC.harness = {
        ready: true, fps,
        step(n) { for (let i = 0; i < (n || 1); i++) self.tick(1 / fps); return self.telemetry.frames[self.telemetry.frames.length - 1]; },
        state() { return { state: self.state, runTime: self.runTime, style: self.style.total, done: self.state === 'RESULTS' }; },
        telemetry() { return { frames: self.telemetry.frames, events: self.telemetry.events, level: self.level.id, version: CC.CONFIG.version }; },
        // image composée (3D + HUD) : évite de dépendre du compositeur du navigateur pour les enregistrements
        capture() {
          const c = this._cap || (this._cap = document.createElement('canvas'));
          c.width = self.canvas.width; c.height = self.canvas.height;
          const g = c.getContext('2d');
          g.drawImage(self.canvas, 0, 0, c.width, c.height);
          g.drawImage(self.hudCanvas, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        },
      };
      this.tick(0);
    }
  }

  CC.Game = Game;
})();
