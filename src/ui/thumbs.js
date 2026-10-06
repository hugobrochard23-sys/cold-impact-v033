/* Aperçus 3D des cosmétiques (v033-ux) : chaque roquette est rendue avec le vrai modèle du jeu (CC.Models.rocket) dans une
 * petite cible de rendu, lue puis recopiée dans un canvas 2D. Les images sont créées à la demande (quelques-unes par
 * image, pour ne jamais bloquer l'affichage), gardées en mémoire, puis dessinées par la boutique.
 *  - frame(skin, 0) : pose fixe des cartes de la grille ;
 *  - frame(skin, i) : plateau tournant (balancement de gauche à droite) du grand aperçu. */
(function () {
  const FRAMES = 24, SIZE = 256;

  class Thumbs {
    constructor(game) {
      this.game = game; this.cache = {}; this.queue = []; this.ready = false;
    }

    init() {
      const g = this.game;
      this.rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
      this.scene = new THREE.Scene();
      this.cam = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
      this.cam.position.set(0.0, 0.5, 3.4); this.cam.lookAt(0, 0, 0);
      this.amb = new THREE.AmbientLight('#ffffff', 0.85); this.scene.add(this.amb);
      this.key = new THREE.DirectionalLight('#ffffff', 0.9); this.key.position.set(2, 3, 2.5); this.scene.add(this.key);
      this.rim = new THREE.DirectionalLight('#9fc4ff', 0.35); this.rim.position.set(-3, 1, -2); this.scene.add(this.rim);
      this.tilt = new THREE.Group(); this.yaw = new THREE.Group(); this.tilt.add(this.yaw); this.scene.add(this.tilt);
      this.tilt.rotation.z = 0.22;                       // nez légèrement relevé
      this.px = new Uint8Array(SIZE * SIZE * 4);
      this.studio = this.buildStudio(g.renderer);
      this.ready = !!g.renderer;
    }

    // style visuel changé : toutes les images sont à refaire
    reset() { this.cache = {}; this.queue = []; }

    // image i (0..FRAMES-1) du cosmétique, ou null tant qu'elle n'est pas prête (elle est alors mise en file)
    frame(skin, i) {
      const key = skin.id + ':' + i;
      const c = this.cache[key];
      if (c) return c;
      if (!this.queue.some((q) => q.key === key)) this.queue.push({ key, skin, i });
      return null;
    }

    // mémoire : on ne garde les 24 images du plateau tournant que pour le cosmétique choisi (la pose fixe des cartes reste)
    keepOnly(id) {
      for (const k of Object.keys(this.cache)) { const [sid, i] = k.split(':'); if (i !== '0' && sid !== id) delete this.cache[k]; }
      this.queue = this.queue.filter((q) => q.i === 0 || q.skin.id === id);
    }

    // `n` images au plus par appel ; la file passe devant pour l'image demandée en dernier
    process(n) {
      if (!this.ready) { if (this.game.renderer) this.init(); else return; }
      while (n-- > 0 && this.queue.length) {
        const q = this.queue.pop();
        if (!this.cache[q.key]) this.cache[q.key] = this.render(q.skin, q.i);
      }
    }

    // « studio photo » pour le style réaliste : dôme sombre dégradé + trois boîtes à lumière ; donne aux métaux de vrais reflets contrastés
    buildStudio(renderer) {
      try {
        const sc = new THREE.Scene();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false,
          vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'varying vec3 p; void main(){ float y = p.y; vec3 top = vec3(0.12, 0.17, 0.30), hor = vec3(0.78, 0.82, 0.92), bot = vec3(0.05, 0.055, 0.08); vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor * 0.45, bot, pow(-y, 0.5)); gl_FragColor = vec4(c, 1.0); }',
        }));
        sc.add(dome);
        for (const [x, y, z, w, h, k] of [[4, 5, 3, 5, 2.4, 5], [-7, 1.5, -1, 2.2, 6, 3.2], [0, 3.5, -8, 7, 1.6, 4]]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 1.05), side: THREE.DoubleSide }));
          m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
        }
        const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(sc, 0, 0.1, 50); pm.dispose();
        return rt.texture;
      } catch (e) { return null; }
    }

    // balancement de ±38° autour d'une vue 3/4 (image 0 = vue des cartes)
    render(skin, i) {
      const g = this.game, r = g.renderer;
      const model = CC.Models.rocket(skin);
      if (model.userData.jet) model.userData.jet.group.parent.remove(model.userData.jet.group);   // la flamme ne fait pas partie de l'objet cadré
      model.rotation.y = Math.PI / 2;                    // le nez (+Z) pointe vers la droite de l'image
      this.yaw.add(model);
      // cadrage : centré et mis à l'échelle sur la boîte englobante de la pose de face (identique à toutes les images)
      this.yaw.rotation.y = 0; this.tilt.rotation.z = 0; this.tilt.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), size = new THREE.Vector3(), ctr = new THREE.Vector3();
      box.getSize(size); box.getCenter(ctr);
      const k = 1.36 / Math.max(size.x, size.y * 1.6, size.z);
      model.scale.setScalar(k); model.position.copy(ctr).multiplyScalar(-k);
      this.tilt.rotation.z = 0.22; this.yaw.rotation.y = -0.55 + Math.sin(i / FRAMES * Math.PI * 2) * 0.66;
      // rendu transparent dans la cible, sans toucher à l'état du rendu principal
      // style réaliste : les reflets du ciel éclairent la roquette, peu de lumière d'appoint ; sinon l'éclairage d'origine
      const real = CC.Look.real();
      this.scene.environment = real ? (this.studio || g.scene.environment) : null;
      this.amb.intensity = real ? 0.12 : 0.85; this.key.intensity = real ? 1.35 : 0.9; this.rim.intensity = real ? 0.9 : 0.35;
      const prevTarget = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
      r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear();
      r.render(this.scene, this.cam);
      r.readRenderTargetPixels(this.rt, 0, 0, SIZE, SIZE, this.px);
      r.setRenderTarget(prevTarget); r.setClearColor(prevClear, prevAlpha);
      this.yaw.remove(model);
      model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      // pixels (ligne du bas en premier, couleurs prémultipliées) → canvas
      const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(SIZE, SIZE), d = img.data, s = this.px;
      for (let y = 0; y < SIZE; y++) {
        const src = (SIZE - 1 - y) * SIZE * 4, dst = y * SIZE * 4;
        for (let x = 0; x < SIZE * 4; x += 4) {
          const a = s[src + x + 3];
          if (a === 0) continue;
          const f = a === 255 ? 1 : 255 / a;
          d[dst + x] = Math.min(255, s[src + x] * f); d[dst + x + 1] = Math.min(255, s[src + x + 1] * f); d[dst + x + 2] = Math.min(255, s[src + x + 2] * f); d[dst + x + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      return cv;
    }
  }
  Thumbs.FRAMES = FRAMES;
  CC.Thumbs = Thumbs;
})();
