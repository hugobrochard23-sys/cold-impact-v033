/* Post-traitement (OBSERVÉ) : vignettage teinté, aberration chromatique, tramage halftone dans les ombres, bloom, grain. */
(function () {
  const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const brightFrag = `
    uniform sampler2D tSrc; uniform float threshold; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b));
      float k = smoothstep(threshold, threshold + 0.25, l); gl_FragColor = vec4(c * k, 1.0); }`;

  const blurFrag = `
    uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
      s += texture2D(tSrc, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tSrc, vUv - dir * 1.385).rgb * 0.316;
      s += texture2D(tSrc, vUv + dir * 3.23).rgb * 0.070; s += texture2D(tSrc, vUv - dir * 3.23).rgb * 0.070;
      gl_FragColor = vec4(s, 1.0); }`;

  const compFrag = `
    uniform sampler2D tScene; uniform sampler2D tBloom; uniform vec2 res;
    uniform float vig, vigR, vigS, ca, halftone, cell, bloomStr, grain, time, flash, grade, exposure, contrast, shafts, gsat;
    uniform vec2 sunUv;
    uniform vec3 vigColor, tint, flashColor, lift; uniform float saturation;
    varying vec2 vUv;
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 cc = vUv - 0.5;
      vec2 ar = vec2(res.x / res.y, 1.0);
      float r = length(cc * ar) / length(0.5 * ar);
      vec2 off = cc * ca * (0.25 + 2.2 * r * r);
      vec3 col;
      col.r = texture2D(tScene, vUv + off).r;
      col.g = texture2D(tScene, vUv).g;
      col.b = texture2D(tScene, vUv - off).b;
      col += texture2D(tBloom, vUv).rgb * bloomStr;
      // rayons de lumière (v033-gfx, style réaliste) : le halo est étiré vers le soleil
      if (shafts > 0.0) {
        vec2 sd = (sunUv - vUv) * (1.0 / 16.0), suv = vUv; float sw = 1.0; vec3 acc = vec3(0.0);
        for (int i = 0; i < 16; i++) { suv += sd; acc += texture2D(tBloom, suv).rgb * sw; sw *= 0.93; }
        col += acc * shafts * 0.085;
      }
      // tramage : points dont le rayon dépend de la luminance, appliqués surtout dans les ombres
      float l = luma(col);
      vec2 f = fract(gl_FragCoord.xy / cell) - 0.5;
      float d = length(f) * 1.414;
      float dotMask = 1.0 - smoothstep(l * 1.5 - 0.08, l * 1.5 + 0.08, d);
      float shadowAmt = (1.0 - smoothstep(0.12, 0.62, l)) * halftone;
      col = mix(col, col * (0.45 + 0.9 * dotMask), shadowAmt);
      // étalonnage « réaliste » (v033-gfx) : courbe de tons filmique, hautes lumières chaudes, ombres froides, contraste
      if (grade > 0.0) {
        vec3 x = col * exposure;
        vec3 aces = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        col = mix(col, aces, 0.55 * grade);
        float lg = luma(col);
        col = mix(vec3(lg), col, 1.0 + (gsat - 1.0) * grade);
        col += grade * (vec3(0.030, 0.014, -0.012) * lg * lg + vec3(-0.012, 0.0, 0.020) * (1.0 - lg) * 0.6);
        col = mix(col, col * col * (3.0 - 2.0 * col), contrast * grade);
      }
      // vignettage teinté
      float v = smoothstep(vigR, vigR - vigS, r);
      col = mix(col * vigColor, col, mix(1.0 - vig, 1.0, v));
      col *= tint;
      // v005 : ombres relevées et légère désaturation (MESURÉ : les ombres de la vidéo sont grisées/bleutées)
      float lf = luma(col);
      col = mix(vec3(lf), col, saturation);
      col += lift * (1.0 - clamp(lf * 1.6, 0.0, 1.0));
      col = mix(col, flashColor, flash);
      col += (hash(gl_FragCoord.xy + time * 61.0) - 0.5) * grain;
      gl_FragColor = vec4(col, 1.0);
    }`;

  class PostFX {
    constructor(renderer) {
      this.renderer = renderer;
      const isGL2 = renderer.capabilities.isWebGL2;
      this.rtScene = new THREE.WebGLRenderTarget(4, 4, { samples: isGL2 ? 4 : 0 });
      this.rtA = new THREE.WebGLRenderTarget(4, 4); this.rtB = new THREE.WebGLRenderTarget(4, 4);
      this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
      this.quad.frustumCulled = false;
      this.scene = new THREE.Scene(); this.scene.add(this.quad);
      this.bright = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: brightFrag, uniforms: { tSrc: { value: null }, threshold: { value: 0.7 } }, depthTest: false });
      this.blur = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: blurFrag, uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false });
      this.comp = new THREE.ShaderMaterial({
        vertexShader: vert, fragmentShader: compFrag, depthTest: false,
        uniforms: {
          tScene: { value: null }, tBloom: { value: null }, res: { value: new THREE.Vector2(1, 1) },
          vig: { value: 0.5 }, vigR: { value: 0.8 }, vigS: { value: 0.5 }, ca: { value: 0.004 }, halftone: { value: 0.3 },
          cell: { value: 3 }, bloomStr: { value: 0.5 }, grain: { value: 0.02 }, time: { value: 0 }, flash: { value: 0 }, grade: { value: 0 }, shafts: { value: 0 }, gsat: { value: 1 }, sunUv: { value: new THREE.Vector2(0.5, 0.5) }, exposure: { value: 1 }, contrast: { value: 0.25 },
          vigColor: { value: new THREE.Color('#1a0c0c') }, tint: { value: new THREE.Color('#ffffff') }, flashColor: { value: new THREE.Color('#ffffff') },
          lift: { value: new THREE.Color('#000000') }, saturation: { value: 1 },
        },
      });
      this.w = 0; this.h = 0;
    }

    // v030 : anticrénelage réglable (niveau de qualité) — la cible de rendu est recréée avec le nouveau nombre d'échantillons
    setSamples(n) {
      const isGL2 = this.renderer.capabilities.isWebGL2, s = isGL2 ? n : 0;
      if (this.rtScene.samples === s) return;
      this.rtScene.dispose();
      this.rtScene = new THREE.WebGLRenderTarget(Math.max(1, this.w || 4), Math.max(1, this.h || 4), { samples: s });
    }

    setSize(w, h) {
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.rtScene.setSize(w, h);
      const bw = Math.max(1, Math.floor(w / 4)), bh = Math.max(1, Math.floor(h / 4));
      this.rtA.setSize(bw, bh); this.rtB.setSize(bw, bh);
      this.comp.uniforms.res.value.set(w, h);
    }

    pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.scene, this.cam); }

    render(scene, camera, p, time) {
      const r = this.renderer;
      r.setRenderTarget(this.rtScene); r.render(scene, camera);
      const bloom = this.bloom !== false;   // v030 : qualité LOW → pas de halo (5 passes économisées)
      if (bloom) {
        this.bright.uniforms.tSrc.value = this.rtScene.texture; this.bright.uniforms.threshold.value = p.bloomThreshold;
        this.pass(this.bright, this.rtA);
        const bw = this.rtA.width, bh = this.rtA.height;
        for (let i = 0; i < 2; i++) {
          this.blur.uniforms.tSrc.value = this.rtA.texture; this.blur.uniforms.dir.value.set((1 + i) / bw, 0); this.pass(this.blur, this.rtB);
          this.blur.uniforms.tSrc.value = this.rtB.texture; this.blur.uniforms.dir.value.set(0, (1 + i) / bh); this.pass(this.blur, this.rtA);
        }
      }
      const u = this.comp.uniforms;
      u.tScene.value = this.rtScene.texture; u.tBloom.value = this.rtA.texture;
      u.vig.value = p.vignette; u.vigR.value = p.vignetteRadius; u.vigS.value = p.vignetteSoftness;
      u.ca.value = p.chromatic; u.halftone.value = p.halftone; u.cell.value = p.halftoneCell * (this.h / 637);
      u.bloomStr.value = bloom ? p.bloomStrength : 0; u.grain.value = p.grain; u.time.value = time % 100;
      u.vigColor.value.set(p.vignetteColor || '#1a0c0c'); u.tint.value.set(p.tint || '#ffffff');
      u.grade.value = p.grade || 0; u.shafts.value = bloom ? (p.shafts || 0) : 0; if (p.sunUv) u.sunUv.value.copy(p.sunUv); u.exposure.value = p.exposure || 1; u.gsat.value = p.gsat || 1; u.contrast.value = p.contrast === undefined ? 0.25 : p.contrast; u.flash.value = p.flash || 0; u.flashColor.value.set(p.flashColor || '#ffffff');
      u.lift.value.set(p.lift || '#000000'); u.saturation.value = p.saturation === undefined ? 1 : p.saturation;
      this.pass(this.comp, null);
    }
  }

  CC.PostFX = PostFX;
})();
