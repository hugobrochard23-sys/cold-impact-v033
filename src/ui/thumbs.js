/* Aperçus 3D des cosmétiques (v033-ux) : chaque roquette est rendue avec le vrai modèle du jeu (CC.Models.rocket) dans une
 * petite cible de rendu, lue puis recopiée dans un canvas 2D. Les images sont créées à la demande (quelques-unes par
 * image, pour ne jamais bloquer l'affichage), gardées en mémoire, puis dessinées par la boutique.
 *  - frame(skin, 0) : pose fixe des cartes de la grille ;
 *  - frame(skin, i) : plateau tournant (balancement de gauche à droite) du grand aperçu. */
(function () {
  const FRAMES = 24, SIZE = 192;

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
      this.scene.add(new THREE.AmbientLight('#ffffff', 0.85));
      const key = new THREE.DirectionalLight('#ffffff', 0.9); key.position.set(2, 3, 2.5); this.scene.add(key);
      const rim = new THREE.DirectionalLight('#9fc4ff', 0.35); rim.position.set(-3, 1, -2); this.scene.add(rim);
      this.tilt = new THREE.Group(); this.yaw = new THREE.Group(); this.tilt.add(this.yaw); this.scene.add(this.tilt);
      this.tilt.rotation.z = 0.22;                       // nez légèrement relevé
      this.px = new Uint8Array(SIZE * SIZE * 4);
      this.ready = !!g.renderer;
    }

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

    // balancement de ±38° autour d'une vue 3/4 (image 0 = vue des cartes)
    render(skin, i) {
      const g = this.game, r = g.renderer;
      const model = CC.Models.rocket(skin);
      if (model.userData.jet) model.userData.jet.group.visible = false;
      model.rotation.y = Math.PI / 2;                    // le nez (+Z) pointe vers la droite de l'image
      this.yaw.add(model);
      // cadrage : centré et mis à l'échelle sur la boîte englobante de la pose de face (identique à toutes les images)
      this.yaw.rotation.y = 0; this.tilt.rotation.z = 0; this.tilt.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), size = new THREE.Vector3(), ctr = new THREE.Vector3();
      box.getSize(size); box.getCenter(ctr);
      const k = 1.75 / Math.max(size.x, size.y * 1.6, size.z);
      model.scale.setScalar(k); model.position.copy(ctr).multiplyScalar(-k);
      this.tilt.rotation.z = 0.22; this.yaw.rotation.y = -0.55 + Math.sin(i / FRAMES * Math.PI * 2) * 0.66;
      // rendu transparent dans la cible, sans toucher à l'état du rendu principal
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
