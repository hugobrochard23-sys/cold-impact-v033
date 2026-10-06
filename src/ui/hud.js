/* HUD en 3 variantes (MESURÉES, voir ANALYSE §8) :
 *  A (ville)           : BINDS/SETTINGS/MENU, chrono + STYLE, THRUST:45 + COOLDOWN...
 *  B (briques, forêts) : chrono (+ TARGETS n/4), SCORE
 *  C (canyon, grotte, chantier) : RESET/MENU/SETTINGS, chrono + STYLE, TIME:∞, SPEED:N */
(function () {
  const U = CC.U;
  const V = THREE.Vector3;

  class HUD {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false; this._v = new V(); }

    // v017 : tailles de texte rapportées à refH (= hauteur, sauf en vertical où la largeur limite : les textes du HUD,
    // pensés pour un écran 16:9, tiennent ainsi dans la largeur du téléphone)
    text(str, x, y, pxFrac, color, opts) {
      return CC.Font.draw(this.ctx, str, x, y, pxFrac * this.refH, color, opts);
    }

    draw(game, dt) {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      this.portrait = !!game.portrait;
      // zones système (encoche, barre d'accueil) : marges en pixels du canvas ; l'interface et les éléments de bord les respectent
      const pr = game.renderer ? game.renderer.getPixelRatio() : 1, sf = game.safe || { t: 0, b: 0, l: 0, r: 0 };
      const sa = this.sa = { l: Math.round(sf.l * pr), t: Math.round(sf.t * pr), r: Math.round(sf.r * pr), b: Math.round(sf.b * pr) };
      const Wc = W - sa.l - sa.r, Hc = H - sa.t - sa.b;
      this.refH = this.portrait ? Math.min(Hc, Wc * 0.95) : Hc;
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      const s = game.state;
      const inGame = ['AIM', 'FLIGHT', 'IMPACT', 'CRASHED', 'RESPAWN'].includes(s) || (s === 'RESULTS');
      if (inGame && game.level && game.showHud && !game.paused) this.drawGame(game);   // v033-ux : en pause, l'écran est celui du menu
      if (game.ui) {
        // v017 : en vertical, les menus (pensés en 16:9) sont dessinés dans une bande centrée de hauteur refH ; v033-ux : dans la zone sûre
        const Hv = this.refH, off = Math.round((Hc - Hv) / 2);
        const ui = game.ui;
        ui.portrait = this.portrait; ui.offsetY = off; ui.fullH = Hc; ui.safeL = sa.l; ui.safeT = sa.t; ui.safeR = sa.r; ui.safeB = sa.b;
        ctx.save(); ctx.translate(sa.l, sa.t + off);
        ui.draw(ctx, game, Wc, Hv);
        ctx.restore();
      }
      if (game.debug) this.text('FPS ' + Math.round(game.fps), 0.01 * W + sa.l, 0.965 * H - sa.b, 0.0018, '#8f8', {});
    }

    drawGame(game) {
      const W = this.canvas.width, H = this.canvas.height, C = CC.CONFIG.hud, col = C.colors;
      const v = game.level.hud, rk = game.rocket;
      // v017 : en vertical, les textes du coin haut droit sont alignés à droite sur le bord (sinon ils débordent)
      const R = this.portrait ? { x: () => 0.97 * W, o: { align: 'right' } } : { x: (c) => c.x * W, o: undefined };
      // v022 : écran tactile → affichage minimal (jauge d'essence, réticule, repères de cibles, alerte missile, aide au lancement)
      const lite = document.body.classList.contains('cc-touch');
      if (!lite) this.drawInfo(game, W, H, C, col, v, rk, R);
      this.drawGameRest(game, W, H, C, col, v, rk, lite);
    }

    // Textes d'information du HUD (raccourcis, chrono, STYLE, THRUST, TIME, SPEED…), absents sur écran tactile (v022).
    drawInfo(game, W, H, C, col, v, rk, R) {
      if (v === 'A' || v === 'C') {
        const b = C.binds[v];
        const lines = v === 'A' ? ['BINDS:F1', 'SETTINGS:TAB', 'MENU:ESC'] : ['RESET:R', 'MENU:ESC', 'SETTINGS:TAB'];
        lines.forEach((l, i) => this.text(l, b.x * W, (b.y + i * b.pitch) * H, b.px, col.white));
      }
      // chrono (format MESURÉ 0:08,27)
      const tm = C.timer[v] || C.timer;
      if (!game.endlessRun) this.text(U.formatTime(game.runTime), 0.5 * W, C.timer.y * H, tm.px, col.white, { align: 'center', cw: tm.cw });   // v033 : distance à la place (drawEndless)
      if (v === 'A' || v === 'C') {
        const st = C.style[v];
        this.text('STYLE ' + U.formatInt(game.style.total), 0.5 * W, st.y * H, st.px, col.white, { align: 'center' });
      } else if (game.level.mode === 'targets') {
        this.text('TARGETS ' + game.targetsDone + '/' + game.targets.filter((t) => !t.guard).length, 0.5 * W, C.targets.y * H, C.targets.px, col.white, { align: 'center' });
      }
      if (v === 'A') {
        this.text('THRUST:' + Math.round(CC.CONFIG.rocket.thrustHud), R.x(C.topRight), C.topRight.y * H, C.topRight.px, col.white, R.o);
        this.text('COOLDOWN...', R.x(C.cooldown), C.cooldown.y * H, C.cooldown.px, col.yellow, R.o);
      } else if (v === 'B') {
        this.text('SCORE', R.x(C.score), C.score.y * H, C.score.px, col.white, R.o);
      } else {
        this.text('TIME:∞', R.x(C.time), C.time.y * H, C.time.px, col.white, R.o);
        if (!game.level.hideSpeed) this.text('SPEED:' + Math.round(rk && rk.active ? rk.speed : (game.state === 'AIM' ? 0 : game.lastSpeed)), R.x(C.speed), C.speed.y * H, C.speed.px, col.white, R.o);
      }
    }

    drawGameRest(game, W, H, C, col, v, rk, lite) {
      // jauge de capacité (MESURÉE : barre jaune sur gris, sous la roquette)
      if (rk && rk.active && (rk.gaugeShowT > 0 || rk.retroActive || rk.grapple.active)) {
        const g = C.gauge, ctx = this.ctx;
        const x0 = g.x0 * W, x1 = g.x1 * W, y0 = g.y0 * H, y1 = g.y1 * H;
        ctx.fillStyle = '#7d7d7d'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.fillStyle = col.yellow; ctx.fillRect(x0, y0, (x1 - x0) * U.clamp(rk.gauge, 0, 1), y1 - y0);
      }
      this.drawFuel(game);
      if (game.endlessRun && game.state !== 'RESULTS') this.drawEndless(game, W, H, C, col, lite);
      // réticule "x" (MESURÉ 50 % / 40,2 %)
      let cross = (game.state === 'AIM' || game.state === 'FLIGHT') && !lite;   // v024 : pas de curseur sur mobile
      let cx = C.crosshair.x * W, cy = C.crosshair.y * H;
      if (game.state === 'FLIGHT' && rk.active) {
        // v010 : la caméra suit la trajectoire, le réticule indique où la roquette est dirigée
        const p = this._v.copy(rk.pos).addScaledVector(game.rig.aimDir, 60).project(game.camera);
        if (p.z > 1) cross = false;
        else { cx = U.clamp((p.x * 0.5 + 0.5) * W, 0, W); cy = U.clamp((0.5 - p.y * 0.5) * H, 0, H); }
      }
      if (cross) {
        const ctx = this.ctx, sz = C.crosshair.size * this.refH / 2;
        ctx.strokeStyle = col.crosshair; ctx.lineWidth = Math.max(1, H / 540);
        ctx.beginPath(); ctx.moveTo(cx - sz, cy - sz); ctx.lineTo(cx + sz, cy + sz); ctx.moveTo(cx + sz, cy - sz); ctx.lineTo(cx - sz, cy + sz); ctx.stroke();
      }
      if (v !== 'B' && !lite) this.drawPopups(game);   // OBSERVÉ : aucune annonce de style dans les séquences au HUD B
      this.drawIndicators(game);
      this.drawMissileWarning(game);
      const tut = game.tutorial && game.tutorial.active;
      if (tut) game.tutorial.draw(this.ctx, W, H, this);   // v033-ux : tutoriel interactif (src/ui/tutorial.js)
      const msg = tut ? null : game.centerMsg || (lite && game.state === 'AIM' ? 'TOUCHE POUR TIRER    MAINTIENS : BOOST' : null);
      // v032 : réduit si le message dépasse la largeur de l'écran (brief de mission long, téléphone en portrait)
      const cpx = msg ? Math.min(C.center.px, 0.94 * W / Math.max(1, CC.Font.measure(msg, this.refH))) : 0;
      if (msg && !game.paused) this.text(msg, 0.5 * W, C.center.y * H, cpx, '#101010', { align: 'center', outline: '#f0f0f0' });   // v024 : pas par-dessus le menu pause
    }

    // Jauge d'essence (v009) : longueur du cadre proportionnelle au réservoir du niveau, remplissage = essence restante.
    /* v033 : mode CLASSIQUE — distance (le score) en haut au centre, record dessous (jaune une fois battu), palier de
     * difficulté, essence gagnée (+2,4 S) au-dessus de la jauge, alarme ALTITUDE! au-dessus du plafond du couloir. */
    drawEndless(game, W, H, C, col, lite) {
      const run = game.endlessRun, rec = (game.save.endless && game.save.endless.best) || 0, d = Math.round(run.dist);
      const y0 = (lite ? 0.045 : C.timer.y) * H + this.sa.t;   // sous l'encoche
      this.text(d + ' M', 0.5 * W, y0, lite ? 0.0052 : 0.0046, col.white, { align: 'center', outline: '#101010' });
      if (rec > 0) this.text(d > rec ? 'NOUVEAU RECORD' : 'RECORD ' + rec + ' M', 0.5 * W, y0 + this.refH * (lite ? 0.068 : 0.098), 0.0021, d > rec ? col.yellow : '#d8d8d8', { align: 'center', outline: '#101010' });
      const D = run.stageLabel();
      this.text(D.label, (this.portrait ? 0.04 : 0.03) * W + this.sa.l, y0 + (lite ? 0 : this.refH * 0.1), 0.0024, D.color, { outline: '#101010' });
      if (run.fuelGainT > 0 && game.state === 'FLIGHT') {
        const F = C.fuel, a = Math.min(1, run.fuelGainT / 0.4);
        this.ctx.globalAlpha = a;
        this.text('+' + U.formatDec(run.fuelGain, 1) + ' S', F.x0 * W, (F.labelY - 0.05) * H, 0.0032, col.green, { outline: '#101010' });
        this.ctx.globalAlpha = 1;
      }
      if (run.altT > 0 && game.state === 'FLIGHT' && Math.floor(run.altT * 6) % 2 === 0) this.text('ALTITUDE! DESCENDS', 0.5 * W, 0.3 * H, 0.0036, col.red, { align: 'center', outline: '#101010' });
    }

    // rectangle de la jauge d'essence (px du canvas) : au doigt, plus épaisse, et au-dessus de la barre d'accueil du téléphone
    fuelRect(game) {
      const W = this.canvas.width, H = this.canvas.height, F = CC.CONFIG.hud.fuel, rc = CC.CONFIG.rocket, sa = this.sa || { l: 0, b: 0 };
      const max = game.rocket.fuelMax || (game.level.fuel || rc.fuelDefault), lite = document.body.classList.contains('cc-touch');
      const h = (F.y1 - F.y0) * H * (lite ? 1.4 : 1);
      return { x: F.x0 * W + sa.l, y: F.y0 * H - sa.b - (lite ? h * 0.25 : 0), w: F.w * W * Math.min(1, max / rc.fuelBarMax), h, labelY: F.labelY * H - sa.b, max };
    }

    drawFuel(game) {
      if (game.state !== 'AIM' && game.state !== 'FLIGHT') return;
      const ctx = this.ctx, F = CC.CONFIG.hud.fuel, col = CC.CONFIG.hud.colors;
      const rk = game.rocket, rc = CC.CONFIG.rocket;
      const R = this.fuelRect(game), max = R.max;
      const fuel = rk.active ? rk.fuel : max;
      const frac = U.clamp(fuel / max, 0, 1);
      const x0 = R.x, y0 = R.y, h = R.h, w = R.w;
      const boostLeft = rk.active ? rc.ignitionDelay + rc.freeBoost - rk.age : rc.freeBoost;
      let label = 'FUEL ' + U.formatDec(fuel, 1) + 'S', color = frac < 0.25 ? col.red : col.orange;
      if (rk.active && rk.freeBoost) { label = 'FREE BOOST ' + U.formatDec(Math.max(0, boostLeft), 1) + 'S'; color = col.blue; }
      else if (rk.active && fuel <= 0) { label = 'NO FUEL'; color = col.red; }
      if (!document.body.classList.contains('cc-touch') || label === 'NO FUEL') this.text(label, x0, R.labelY, F.px, color);   // v022 : au doigt, la barre suffit
      ctx.fillStyle = col.outline; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
      ctx.fillStyle = '#7d7d7d'; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = color; ctx.fillRect(x0, y0, w * frac, h);
      if (rk.active && rk.thrusting && !rk.freeBoost) { ctx.fillStyle = col.white; ctx.fillRect(x0 + w * frac - 2, y0, 2, h); }   // curseur blanc : l'essence brûle
      // v026 (tactile) : fine barre qui se vide pendant la seconde où reposer le doigt relance le boost aussitôt
      const T = game.input.touch, left = T && T.reboostUntil ? (T.reboostUntil - performance.now()) / CC.CONFIG.input.touch.reboostMs : 0;
      if (rk.active && left > 0) { ctx.fillStyle = col.yellow; ctx.fillRect(x0, y0 + h + 4, w * Math.min(1, left), Math.max(2, h * 0.35)); }
    }

    drawPopups(game) {
      const W = this.canvas.width, H = this.canvas.height, P = CC.CONFIG.hud.popups, cfg = CC.CONFIG.style;
      for (const p of game.style.popups) {
        let alpha = 1, rise = 0;
        if (p.live) alpha = 0.92;
        else if (p.age > cfg.popupHold) { const f = (p.age - cfg.popupHold) / cfg.popupFade; alpha = 1 - f; rise = f * cfg.popupRise; }
        if (alpha <= 0) continue;
        const x = this.portrait ? 0.5 + (p.x - P.cx) * 0.3 : p.x;   // v017 : en vertical, annonces recentrées (sinon elles débordent à droite)
        this.text(p.segments, x * W, (p.y - rise) * H, P.px, '#ffffff', { align: 'center', skew: P.skew, alpha });
      }
    }

    // v020 : « MISSILE! » clignotant quand un missile ennemi approche, pour laisser au joueur le temps de manœuvrer ;
    // v026 : « LOW FUEL » clignotant sous le seuil d'essence (état calculé par game.updateWarnings)
    drawMissileWarning(game) {
      const rk = game.rocket, w = game.warn;
      if (game.state !== 'FLIGHT' || !rk.active || !w || game.paused) return;
      const W = this.canvas.width, H = this.canvas.height, col = CC.CONFIG.hud.colors;
      if (w.missile && !(Math.floor(performance.now() / 180) % 2)) this.text('MISSILE!', 0.5 * W, 0.2 * H, 0.0058, col.red, { align: 'center', outline: col.outline });
      // design : repère de chaque missile ennemi proche — crochets rouges autour de lui s'il est à l'écran, flèche au bord
      // de l'écran sinon (on voit d'où vient la menace pour l'esquiver)
      const ctx = this.ctx, cam = game.camera, lw = Math.max(2, H / 360);
      for (const m of game.missiles) {
        if (!m.alive || m.pos.distanceTo(rk.pos) > CC.CONFIG.aa.warnDist) continue;
        const p = this._v.copy(m.pos).project(cam), behind = p.z > 1;
        if (!behind && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95) {
          const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H, r = Math.max(7, this.refH * 0.018), c = r * 0.45;
          ctx.strokeStyle = col.red; ctx.lineWidth = lw;
          ctx.beginPath();
          for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(sx + dx * r, sy + dy * (r - c)); ctx.lineTo(sx + dx * r, sy + dy * r); ctx.lineTo(sx + dx * (r - c), sy + dy * r); }
          ctx.stroke();
          continue;
        }
        let x = p.x, y = p.y;
        if (behind) { x = -x; y = -y; }
        const a = Math.atan2(-y, x), m2 = Math.max(Math.abs(x), Math.abs(y)) || 1;
        const ex = U.clamp((x / m2 * 0.5 + 0.5) * W, W * 0.08, W * 0.92), ey = U.clamp((-y / m2 * 0.5 + 0.5) * H, H * 0.16, H * 0.84);   // hors des coins du HUD
        const s = Math.max(8, this.refH * 0.022);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = col.red; ctx.strokeStyle = col.outline; ctx.lineWidth = lw * 0.6;
        ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(-s * 0.6, s * 0.7); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (w.lowFuel && !(Math.floor(performance.now() / 300) % 2)) this.text('LOW FUEL', 0.5 * W, 0.2 * H + 0.075 * this.refH, 0.0046, col.orange, { align: 'center', outline: col.outline });
    }

    // Point rouge au bord de l'écran vers les cibles hors champ (ESTIMATION, vu séq. 3/4).
    drawIndicators(game) {
      if (game.state !== 'FLIGHT' && game.state !== 'AIM') return;
      if (game.guideLevel(game.levelIndex, game.level)) return;   // v023 : niveaux 1 à 3 → flèches vertes à la place
      const W = this.canvas.width, H = this.canvas.height, ctx = this.ctx, cam = game.camera;
      for (const t of game.targets) {
        if (!t.alive || t.guard) continue;   // v021 : pas de repère vers les tanks de garde
        const p = this._v.copy(t.obb.c).project(cam);
        const behind = p.z > 1;
        if (!behind && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) {
          // v023 : cible à l'écran → repère rouge permanent sur elle (il ne disparaît plus quand on fonce dessus)
          const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H, r = Math.max(5, H * 0.012);
          ctx.lineWidth = Math.max(2, H / 360);
          ctx.strokeStyle = '#1a1a1a'; ctx.strokeRect(sx - r - 1, sy - r - 1, 2 * r + 2, 2 * r + 2);
          ctx.strokeStyle = '#ff1e1e'; ctx.strokeRect(sx - r, sy - r, 2 * r, 2 * r);
          ctx.fillStyle = '#ff1e1e'; ctx.fillRect(sx - 2, sy - 2, 4, 4);
          continue;
        }
        let x = p.x, y = p.y;
        if (behind) { x = -x; y = -y; }
        const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
        x /= m; y /= m;
        const sx = (x * 0.5 + 0.5) * W, sy = (-y * 0.5 + 0.5) * H;
        const s = Math.max(3, H * 0.0075);
        ctx.fillStyle = '#ff1e1e';
        ctx.fillRect(U.clamp(sx, s * 2, W - s * 3), U.clamp(sy, s * 2, H - s * 3), s, s);
      }
    }
  }

  CC.HUD = HUD;
})();
