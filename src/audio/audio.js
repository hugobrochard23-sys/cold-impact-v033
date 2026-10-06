/* Audio original synthétisé (Web Audio). La vidéo de référence est muette : tout ce qui suit est une création (CHOIX validé).
 * Moteur (bruit filtré + grondement), vent, tir, allumage, explosions, verre, briques, grappin, bips de style, musique. */
(function () {
  const U = CC.U;

  class Audio {
    constructor() {
      this.ctx = null; this.enabled = true; this.muted = false;
      this.cfg = Object.assign({}, CC.CONFIG.audio);   // v023 : copie — couper le son ne doit pas écraser les volumes par défaut
      this.engineLevel = 0; this.windLevel = 0;
    }

    init() {
      if (this.ctx || !this.enabled) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = this.cfg.master;
      // v023 : limiteur en sortie : explosions et moteur ensemble ne saturent jamais les haut-parleurs (téléphone)
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
      this.master.connect(lim); lim.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.gain.value = this.cfg.sfx; this.sfx.connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.cfg.music; this.musicBus.connect(this.master);
      // bruit blanc partagé
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // design : réacteur de missile en couches (création originale, pas un enregistrement) — tout passe par engBus :
      //  1 bourdonnement grave (2 sinus en quinte, trémolo) · 2 grondement de flammes (bruit brun saturé, passe-bas) ·
      //  3 souffle de poussée (passe-bande médium) · 4 sifflement d'air (passe-bande aigu, suit la vitesse) · 5 crépitement
      this.engBus = ctx.createGain(); this.engBus.gain.value = 0; this.engBus.connect(this.sfx);
      const loop = (buf, rate) => { const b = ctx.createBufferSource(); b.buffer = buf; b.loop = true; if (rate) b.playbackRate.value = rate; b.start(); return b; };
      const bl = ctx.sampleRate * 3, bb = ctx.createBuffer(1, bl, ctx.sampleRate), bd = bb.getChannelData(0), pops = ctx.createBuffer(1, bl, ctx.sampleRate), pd = pops.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < bl; i++) {
        brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = brown * 3.5;
        pd[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) : pd[i - 1] ? pd[i - 1] * 0.82 : 0;   // impulsions qui s'éteignent vite
      }
      this.subA = ctx.createOscillator(); this.subA.type = 'sine'; this.subA.frequency.value = 46;
      this.subB = ctx.createOscillator(); this.subB.type = 'triangle'; this.subB.frequency.value = 69.4;
      const trem = ctx.createOscillator(); trem.frequency.value = 7.3; const tremG = ctx.createGain(); tremG.gain.value = 0.18;
      this.subGain = ctx.createGain(); this.subGain.gain.value = 0.3;
      trem.connect(tremG); tremG.connect(this.subGain.gain);
      const subMix = ctx.createGain(); subMix.gain.value = 0.55;
      this.subA.connect(subMix); this.subB.connect(subMix); subMix.connect(this.subGain); this.subGain.connect(this.engBus);
      this.subA.start(); this.subB.start(); trem.start();
      const roar = loop(bb);
      this.roarFilter = ctx.createBiquadFilter(); this.roarFilter.type = 'lowpass'; this.roarFilter.frequency.value = 420; this.roarFilter.Q.value = 0.8;
      const sat = ctx.createWaveShaper(), curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.6 * x); }
      sat.curve = curve;
      this.roarGain = ctx.createGain(); this.roarGain.gain.value = 0.55;
      roar.connect(this.roarFilter); this.roarFilter.connect(sat); sat.connect(this.roarGain); this.roarGain.connect(this.engBus);
      const push = loop(this.noise, 0.9);
      this.pushFilter = ctx.createBiquadFilter(); this.pushFilter.type = 'bandpass'; this.pushFilter.frequency.value = 900; this.pushFilter.Q.value = 0.7;
      this.pushGain = ctx.createGain(); this.pushGain.gain.value = 0.12;
      push.connect(this.pushFilter); this.pushFilter.connect(this.pushGain); this.pushGain.connect(this.engBus);
      const air = loop(this.noise, 1.3);
      this.hissFilter = ctx.createBiquadFilter(); this.hissFilter.type = 'bandpass'; this.hissFilter.frequency.value = 3200; this.hissFilter.Q.value = 2.2;
      this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
      air.connect(this.hissFilter); this.hissFilter.connect(this.hissGain); this.hissGain.connect(this.sfx);   // le sifflement d'air existe aussi moteur coupé
      const crk = loop(pops);
      const crkF = ctx.createBiquadFilter(); crkF.type = 'highpass'; crkF.frequency.value = 1200;
      this.crackGain = ctx.createGain(); this.crackGain.gain.value = 0.5;
      crk.connect(crkF); crkF.connect(this.crackGain); this.crackGain.connect(this.engBus);
      // ambiance : rotor d'hélicoptère (bruit grave haché au rythme des pales), moteur de char, sifflement de missile ennemi
      const rot = loop(bb, 0.8);
      this.rotorFilter = ctx.createBiquadFilter(); this.rotorFilter.type = 'bandpass'; this.rotorFilter.frequency.value = 180; this.rotorFilter.Q.value = 0.9;
      this.rotorAM = ctx.createGain(); this.rotorAM.gain.value = 0.5;
      this.rotorLfo = ctx.createOscillator(); this.rotorLfo.type = 'sawtooth'; this.rotorLfo.frequency.value = 10.8;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5; this.rotorLfo.connect(lfoG); lfoG.connect(this.rotorAM.gain); this.rotorLfo.start();
      this.rotorGain = ctx.createGain(); this.rotorGain.gain.value = 0;
      rot.connect(this.rotorFilter); this.rotorFilter.connect(this.rotorAM); this.rotorAM.connect(this.rotorGain); this.rotorGain.connect(this.sfx);
      const tk = loop(bb, 0.5);
      const tkF = ctx.createBiquadFilter(); tkF.type = 'lowpass'; tkF.frequency.value = 140;
      this.tankGain = ctx.createGain(); this.tankGain.gain.value = 0;
      tk.connect(tkF); tkF.connect(this.tankGain); this.tankGain.connect(this.sfx);
      const ms = loop(this.noise, 1.1);
      this.misFilter = ctx.createBiquadFilter(); this.misFilter.type = 'bandpass'; this.misFilter.frequency.value = 2400; this.misFilter.Q.value = 4;
      this.misGain = ctx.createGain(); this.misGain.gain.value = 0;
      ms.connect(this.misFilter); this.misFilter.connect(this.misGain); this.misGain.connect(this.sfx);
      // vent
      const ws = ctx.createBufferSource(); ws.buffer = this.noise; ws.loop = true; ws.playbackRate.value = 0.7;
      this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 700; this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
      ws.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.sfx); ws.start();
      // rétro-fusées
      const rs = ctx.createBufferSource(); rs.buffer = this.noise; rs.loop = true;
      this.retroFilter = ctx.createBiquadFilter(); this.retroFilter.type = 'highpass'; this.retroFilter.frequency.value = 1800;
      this.retroGain = ctx.createGain(); this.retroGain.gain.value = 0;
      rs.connect(this.retroFilter); this.retroFilter.connect(this.retroGain); this.retroGain.connect(this.sfx); rs.start();
      this.music = new CC.Music(ctx, this.musicBus);
    }

    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    setVolumes(master, music, sfx) {
      this.cfg.master = master; this.cfg.music = music; this.cfg.sfx = sfx;
      if (!this.ctx) return;
      this.master.gain.value = master; this.musicBus.gain.value = music; this.sfx.gain.value = sfx;
    }

    // Sons continus pilotés par l'état de la roquette (design : couches du réacteur liées à la poussée, à la vitesse et à
    // l'accélération ; montée franche à l'allumage, extinction courte à la coupure).
    updateRocket(rocket, dt) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const on = rocket && rocket.active;
      const thrust = on && rocket.thrusting ? 1 : 0;
      const sp = on ? rocket.speed : 0;
      const acc = dt > 0 ? (sp - (this.lastSp || 0)) / dt : 0; this.lastSp = sp;
      this.accS = U.lerp(this.accS || 0, U.clamp(acc / 30, 0, 1), U.damp(4, dt));   // accélération lissée 0..1
      const v = U.clamp(sp / 75, 0, 1);
      this.engBus.gain.setTargetAtTime(thrust * 0.48, t, thrust ? 0.05 : 0.09);
      this.subA.frequency.setTargetAtTime(42 + v * 14 + this.accS * 5, t, 0.2);
      this.subB.frequency.setTargetAtTime((42 + v * 14 + this.accS * 5) * 1.505, t, 0.2);
      this.roarFilter.frequency.setTargetAtTime(300 + v * 520 + this.accS * 300, t, 0.1);
      this.roarGain.gain.setTargetAtTime(0.5 + this.accS * 0.25, t, 0.1);
      this.pushFilter.frequency.setTargetAtTime(700 + v * 900, t, 0.12);
      this.pushGain.gain.setTargetAtTime(0.08 + v * 0.08, t, 0.12);
      this.crackGain.gain.setTargetAtTime(0.35 + 0.4 * U.fx(), t, 0.03);                 // crépitement irrégulier
      this.hissGain.gain.setTargetAtTime(on ? v * v * 0.09 : 0, t, 0.08);
      this.hissFilter.frequency.setTargetAtTime(2200 + sp * 32, t, 0.12);
      this.windGain.gain.setTargetAtTime(on ? U.clamp((sp - 10) / 90, 0, 1) * 0.2 : 0, t, 0.1);
      this.windFilter.frequency.setTargetAtTime(400 + sp * 12, t, 0.1);
      this.retroGain.gain.setTargetAtTime(on && rocket.retroActive ? 0.25 : 0, t, 0.03);
      if (on && thrust && !this.wasThrust) this.play('engineOn');
      if (on && !thrust && this.wasThrust) this.play('engineOff');
      this.wasThrust = on && !!thrust;
    }

    // design : sons d'ambiance pilotés par la scène (distance à la caméra) : rotor du plus proche hélicoptère, moteur du
    // plus proche char, sifflement du plus proche missile ennemi (plus aigu quand il se rapproche)
    updateWorld(game, dt) {
      if (!this.ctx || !game.level) return;
      const t = this.ctx.currentTime, cam = game.camera.position;
      let heli = Infinity, tank = Infinity, mis = Infinity;
      for (const tg of game.targets) {
        if (!tg.alive) continue;
        const d = tg.object.position.distanceTo(cam);
        if (tg.type === 'heli' || tg.type === 'heliCamo') heli = Math.min(heli, d); else if (tg.type === 'tank') tank = Math.min(tank, d);
      }
      for (const m of game.missiles) if (m.alive) mis = Math.min(mis, m.pos.distanceTo(cam));
      const att = (d, ref) => d === Infinity ? 0 : U.clamp(ref / (ref + d), 0, 1);
      this.rotorGain.gain.setTargetAtTime(att(heli, 25) * 0.9, t, 0.15);
      this.rotorLfo.frequency.setTargetAtTime(10.8, t, 0.5);
      this.tankGain.gain.setTargetAtTime(att(tank, 8) * 0.7, t, 0.2);
      this.misGain.gain.setTargetAtTime(att(mis, 12) * 0.35, t, 0.05);
      this.misFilter.frequency.setTargetAtTime(mis === Infinity ? 2000 : 1800 + 2600 * att(mis, 20), t, 0.05);
    }

    // design : atténuation des sons ponctuels avec la distance (caméra) — un char qui tire à 120 m reste discret
    distGain(pos) {
      if (!pos || !this.cam) return 1;
      const d = pos.distanceTo(this.cam.position);
      return U.clamp(35 / (35 + d), 0.08, 1);
    }

    env(node, t, a, peak, dec) {
      node.gain.setValueAtTime(0.0001, t);
      node.gain.exponentialRampToValueAtTime(peak, t + a);
      node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    noiseHit(freq, type, q, peak, dec, rate) {
      const ctx = this.ctx, t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate || 1;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      s.connect(f); f.connect(g); g.connect(this.dest || this.sfx);
      this.env(g, t, 0.005, peak, dec);
      s.start(t, Math.random()); s.stop(t + dec + 0.1);
      return f;
    }
    tone(type, f0, f1, peak, dec, delay) {
      const ctx = this.ctx, t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dec);
      const g = ctx.createGain(); o.connect(g); g.connect(this.dest || this.sfx);
      this.env(g, t, 0.004, peak, dec);
      o.start(t); o.stop(t + dec + 0.05);
    }

    // Bruit filtré dont la fréquence glisse de f0 à f1 (souffles, whoosh).
    sweep(f0, f1, type, q, peak, dec, delay) {
      const ctx = this.ctx, t = ctx.currentTime + (delay || 0);
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dec);
      const g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(this.dest || this.sfx);
      this.env(g, t, Math.min(0.08, dec * 0.3), peak, dec);
      s.start(t, Math.random()); s.stop(t + dec + 0.15);
    }
    /* v023 : explosion plus crédible sans être réaliste à l'excès : claquement initial, déflagration dont l'aigu s'éteint vite,
     * coup de grave, débris qui crépitent, queue grave qui roule. `size` : 1 = roquette / cible, 0,45 = petit missile. */
    explosion(size) {
      const ctx = this.ctx, t = ctx.currentTime, k = size;
      this.noiseHit(4000, 'highpass', 0.7, 0.6 * k, 0.05);                       // claquement
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
      f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.15); f.frequency.exponentialRampToValueAtTime(140, t + 1.2 * k + 0.4);
      const sh = ctx.createWaveShaper(); const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.2 * x); }   // légère saturation : plus de corps
      sh.curve = curve;
      const g = ctx.createGain(); s.connect(f); f.connect(sh); sh.connect(g); g.connect(this.dest || this.sfx);
      this.env(g, t, 0.004, 0.75 * k, 1.1 * k + 0.5);
      s.start(t, Math.random()); s.stop(t + 1.8 * k + 0.8);
      this.tone('sine', 75, 26, 0.7 * k, 0.9 * k + 0.25);                          // coup de grave
      const tail = this.noiseHit(260, 'lowpass', 0.5, 0.55 * k, 2.8 * k + 0.4, 0.5);   // queue qui roule
      tail.frequency.setValueAtTime(320, t); tail.frequency.exponentialRampToValueAtTime(90, t + 2.8 * k + 0.4);
      const n = Math.round(5 + 9 * k);
      for (let i = 0; i < n; i++) {                                                 // débris
        const d = 0.06 + Math.random() * (0.7 * k + 0.2);
        setTimeout(() => { if (this.ctx) this.noiseHit(900 + Math.random() * 2600, 'bandpass', 2.5, (0.08 + Math.random() * 0.14) * k, 0.03 + Math.random() * 0.06); }, d * 1000);
      }
    }

    play(name, pos, param) {
      if (!this.ctx || this.muted) return;
      const dg = this.distGain(pos);
      if (dg < 0.999) { this.dest = this.ctx.createGain(); this.dest.gain.value = dg; this.dest.connect(this.sfx); }
      try { this.playRaw(name, param); } finally { this.dest = null; }
    }
    playRaw(name, param) {
      switch (name) {
        case 'launch':   // v023 : « chunk » pneumatique du tube, puis souffle qui s'éloigne
          this.tone('sine', 140, 45, 0.9, 0.18); this.noiseHit(700, 'lowpass', 0.8, 0.7, 0.12);
          this.sweep(900, 2600, 'bandpass', 0.7, 0.35, 0.45, 0.04); break;
        case 'ignite':   // v023 : « whoosh » qui monte + coup sourd à l'allumage
          this.sweep(300, 1800, 'bandpass', 0.9, 0.5, 0.4); this.tone('sine', 70, 38, 0.6, 0.25); break;
        case 'boom': this.explosion(1); break;
        case 'boomSmall': this.explosion(0.45); break;
        case 'glass': for (let i = 0; i < 5; i++) setTimeout(() => this.noiseHit(5000 + Math.random() * 3000, 'bandpass', 8, 0.35, 0.12), i * 28); break;
        case 'brick': this.noiseHit(600, 'lowpass', 1, 0.7, 0.35, 0.7); this.tone('square', 90, 50, 0.15, 0.15); break;
        case 'grapple': this.tone('square', 300, 1400, 0.12, 0.12); this.noiseHit(3000, 'highpass', 1, 0.2, 0.1); break;
        case 'release': this.tone('triangle', 900, 300, 0.12, 0.1); break;
        case 'popup': this.tone('square', 660 * (param || 1), 990 * (param || 1), 0.06, 0.08); break;
        case 'toggle': this.tone('square', 220, 180, 0.08, 0.06); break;
        case 'ui': this.tone('square', 520, 520, 0.06, 0.05); break;
        // v033-ux : sons d'interface — appui, retour, changement d'onglet, équipement, déblocage (fanfare), refus, étape réussie
        case 'tap': this.tone('triangle', 780, 700, 0.09, 0.06); break;
        case 'back': this.tone('triangle', 560, 380, 0.08, 0.08); break;
        case 'tab': this.tone('square', 880, 880, 0.045, 0.035); break;
        case 'equip': this.tone('triangle', 660, 660, 0.1, 0.07); this.tone('triangle', 990, 990, 0.1, 0.14, 0.07); break;
        case 'unlock': [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.09, 0.16, i * 0.09));
          this.sweep(2000, 6000, 'highpass', 1, 0.12, 0.5, 0.3); break;
        case 'denied': this.tone('square', 170, 130, 0.09, 0.1); this.tone('square', 150, 110, 0.09, 0.14, 0.11); break;
        case 'chime': this.tone('triangle', 784, 784, 0.1, 0.1); this.tone('triangle', 1175, 1175, 0.1, 0.22, 0.1); break;
        case 'target': this.tone('square', 523, 523, 0.1, 0.1); this.tone('square', 784, 784, 0.1, 0.18, 0.1); break;
        // design : départ de coup de canon de char (claquement, déflagration grave, écho) ; roquette d'hélicoptère (sifflement)
        case 'tankFire': this.noiseHit(2500, 'highpass', 0.7, 0.35, 0.04); this.tone('sine', 110, 38, 0.55, 0.45); this.sweep(1800, 300, 'lowpass', 0.7, 0.45, 0.5);
          this.sweep(900, 200, 'bandpass', 1.2, 0.12, 0.8, 0.18); break;
        case 'heliFire': this.noiseHit(3000, 'highpass', 0.8, 0.2, 0.03); this.sweep(600, 3200, 'bandpass', 1.5, 0.22, 0.35); this.tone('sine', 90, 50, 0.25, 0.2); break;
        // design : allumage du réacteur (claquement + montée) et coupure (souffle qui s'éteint)
        case 'engineOn': this.noiseHit(1800, 'bandpass', 1.2, 0.18, 0.05); this.sweep(400, 1600, 'bandpass', 1, 0.22, 0.18); break;
        case 'engineOff': this.sweep(1200, 250, 'lowpass', 0.8, 0.2, 0.3); break;
        case 'warnMissile': this.tone('square', 1320, 1320, 0.07, 0.05); this.tone('square', 1320, 1320, 0.07, 0.05, 0.09); break;   // v026 : bip-bip d'alerte
        case 'warnFuel': this.tone('triangle', 880, 880, 0.12, 0.12); this.tone('triangle', 587, 587, 0.12, 0.2, 0.15); break;     // v026 : deux notes descendantes
      }
    }
  }

  /* Musique originale : boucle électro 112 BPM (basse, grosse caisse, charleston, arpège), séquencée à l'avance. */
  class Music {
    constructor(ctx, out) {
      this.ctx = ctx; this.out = out; this.playing = false; this.step = 0; this.bpm = 112; this.next = 0; this.timer = null;
      this.scale = [0, 3, 5, 7, 10];
      this.prog = [0, 0, -4, -2];
    }
    start() {
      if (this.playing) return;
      this.playing = true; this.next = this.ctx.currentTime + 0.1; this.step = 0;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    stop() { this.playing = false; clearInterval(this.timer); }
    note(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
    voice(type, freq, t, dur, vol, cutoff) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 2000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
    }
    schedule() {
      const ctx = this.ctx, sp = 60 / this.bpm / 4;
      while (this.next < ctx.currentTime + 0.2) {
        const s = this.step % 64, bar = Math.floor(s / 16), root = 40 + this.prog[bar], t = this.next;
        if (s % 4 === 0) { // grosse caisse
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
          g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
        }
        if (s % 2 === 1) { // charleston
          const n = ctx.createBufferSource(); n.buffer = CC.game.audio.noise;
          const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
          n.connect(f); f.connect(g); g.connect(this.out); n.start(t, Math.random()); n.stop(t + 0.06);
        }
        if (s % 16 === 4 || s % 16 === 12) { // caisse claire
          const n = ctx.createBufferSource(); n.buffer = CC.game.audio.noise;
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          n.connect(f); f.connect(g); g.connect(this.out); n.start(t, Math.random()); n.stop(t + 0.16);
        }
        if (s % 2 === 0) this.voice('sawtooth', this.note(root + (s % 8 === 6 ? 12 : 0)), t, sp * 1.8, 0.16, 500);
        if (s % 4 === 2 || s % 8 === 3) this.voice('square', this.note(root + 24 + this.scale[(s * 3 + bar) % 5]), t, sp * 1.4, 0.05, 2600);
        this.step++; this.next += sp;
      }
    }
  }

  CC.Audio = Audio; CC.Music = Music;
})();
