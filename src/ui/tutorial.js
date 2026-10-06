/* Tutoriel interactif (v033-ux) : un vrai premier vol guidé sur le niveau CITY, qui apprend en faisant.
 * Une étape = une consigne courte, un pictogramme animé, et une condition de réussite mesurée dans le jeu (pas un minuteur) :
 *   tirer → diriger → boost → surveiller l'essence → virage au bord (tactile) → foncer sur la cible.
 * Pendant les consignes qui demandent un geste, le temps passe au ralenti jusqu'à ce que le joueur le réussisse : il a le
 * temps de comprendre sans que la roquette ne s'écrase. Chaque réussite : coche verte, carillon, vibration.
 * Le joueur peut passer à tout moment (bouton PASSER, ou menu pause) ; le tutoriel est sauvegardé comme terminé
 * (settings.tutorialDone) et se rejoue depuis RÉGLAGES → REVOIR LE TUTORIEL.
 *
 * Pour modifier le tutoriel : éditer le tableau STEPS ci-dessous — une étape est un objet
 *   { id, hint (pictogramme), text: { touch, pc }, slow (ralenti 0..1, optionnel), time (durée auto en s, optionnel),
 *     touchOnly, begin(game, tut) (initialisation), done(game, tut) → true quand l'étape est réussie }. */
(function () {
  const U = CC.U;
  const STEPS = [
    { id: 'fire', hint: 'tap', text: { touch: 'TAP THE SCREEN TO FIRE', pc: 'LEFT CLICK TO FIRE' }, done: (g) => g.state === 'FLIGHT' },
    { id: 'steer', hint: 'drag', slow: 0.3, text: { touch: 'DRAG YOUR FINGER TO STEER', pc: 'MOVE THE MOUSE TO STEER' },
      begin: (g, t) => { t.q0 = g.input.aimQ.clone(); }, done: (g, t) => g.input.aimQ.angleTo(t.q0) > 0.4 },
    { id: 'boost', hint: 'hold', slow: 0.3, text: { touch: 'HOLD YOUR FINGER: BOOST', pc: 'HOLD SPACE: BOOST' },
      begin: (g, t) => { t.held = 0; }, done: (g, t) => t.held > 0.6 },
    { id: 'fuel', hint: 'fuel', time: 3.4, text: { touch: 'THE BAR AT THE BOTTOM IS YOUR FUEL. BOOST EMPTIES IT', pc: 'THE BAR AT THE BOTTOM IS YOUR FUEL. BOOST EMPTIES IT' } },
    { id: 'edge', hint: 'edge', slow: 0.3, touchOnly: true, text: { touch: 'FINGER ON THE SCREEN EDGE: TURN', pc: '' },
      begin: (g, t) => { t.edgeSeen = 0; }, done: (g, t) => t.edgeSeen > 0.5 },
    { id: 'goal', hint: 'goal', time: 5, text: { touch: 'GRAZE THE WALLS FOR STYLE. FOLLOW THE GREEN ARROWS TO THE TARGET!', pc: 'GRAZE THE WALLS FOR STYLE. FOLLOW THE GREEN ARROWS TO THE TARGET!' } },
  ];

  class Tutorial {
    constructor(game) { this.game = game; this.active = false; this.idx = 0; this.t = 0; this.doneT = 0; this.msgT = 0; }

    get touch() { return !!(CC.Touch && CC.Touch.active); }
    steps() { return STEPS.filter((s) => !s.touchOnly || this.touch); }
    step() { return this.steps()[this.idx]; }

    // premier vol guidé : niveau CITY, depuis n'importe où (démarrage, réglages)
    start() {
      const g = this.game;
      this.active = true; this.idx = 0;
      g.paused = false; g.ui.overlay = null; g.ui.modal = null;
      g.startLevel(0);
      this.begin(0);
    }

    begin(i) {
      this.idx = i; this.t = 0; this.doneT = 0; this.wait = 0;
      const s = this.step();
      if (s && s.begin) s.begin(this.game, this);
    }

    // fin : réussie (bravo) ou abandonnée (passer) ; dans les deux cas elle est enregistrée et on revient au menu
    finish(skipped) {
      if (!this.active) return;
      const g = this.game;
      this.active = false;
      g.settings.tutorialDone = true; g.writeSave();
      g.toMenu();
      if (skipped) g.ui.toast('TUTORIAL SKIPPED - REPLAY IT IN SETTINGS', '#8fd0ff', 3);
      else { g.ui.toast('TUTORIAL COMPLETE! HAPPY FLYING, PILOT', CC.CONFIG.hud.colors.green, 3.4); g.ui.feedback('success'); }
    }

    // facteur de temps : ralenti tant que le geste demandé n'est pas réussi
    timeScale() {
      if (!this.active) return 1;   // le ralenti reste pendant l'affichage de la réussite : le virage demandé ne doit pas finir dans un mur
      const s = this.step();
      return s && s.slow && this.game.state === 'FLIGHT' ? s.slow : 1;
    }

    update(dt) {
      if (!this.active) return;
      const g = this.game, steps = this.steps();
      if (g.paused || g.ui.overlay) return;
      // après un crash, le joueur recommence au lanceur : on repart de la première consigne
      if (g.state === 'AIM' && this.idx > 0) { this.msgT = 0; this.begin(0); return; }
      if (g.state === 'RESPAWN' || g.state === 'CRASHED') { this.msgT += dt; return; }
      const s = steps[this.idx];
      if (!s) return;
      const real = dt;                                       // dt réel : les mesures de durée ne ralentissent pas avec le jeu
      this.t += real;
      if (g.state === 'FLIGHT') {
        if (g.rocket.throttle) this.held = (this.held || 0) + real; else this.held = 0;
        const T = g.input.touch;
        if (T && T.edgeAt && performance.now() - T.edgeAt < 250) this.edgeSeen = (this.edgeSeen || 0) + real;
      }
      if (this.doneT > 0) {                                  // réussite affichée un instant, puis étape suivante
        if ((this.doneT -= real) <= 0) { if (this.idx < steps.length - 1) this.begin(this.idx + 1); }
        return;
      }
      if (this.idx === steps.length - 1 && !s.done) return;   // dernière consigne : elle reste affichée jusqu'à la cible
      const ok = s.done ? s.done(g, this) : this.t >= s.time;
      if (ok || this.t > (s.time || 16)) {                    // sécurité : une étape trop longue passe toute seule
        if (ok && s.done) { g.ui.feedback('step'); this.doneT = 0.7; }
        else if (this.idx < steps.length - 1) this.begin(this.idx + 1);
      }
    }

    // ---------- dessin (canvas du HUD, coordonnées plein écran) ----------
    draw(ctx, W, H, hud) {
      const g = this.game;
      if (!this.active || g.paused || g.ui.overlay) return;
      const sa = hud.sa || { l: 0, t: 0, r: 0, b: 0 };
      const msg = (g.state === 'RESPAWN' || g.state === 'CRASHED') ? 'MISSED! TAP TO TRY AGAIN' : null;
      if (msg) { this.drawCard(ctx, W, H, sa, { title: 'OOPS', body: g.respawnMsg ? g.respawnMsg() : msg, color: '#ff9a3a', pct: 0 }); return; }
      const steps = this.steps(), s = steps[this.idx];
      if (!s || g.state === 'IMPACT') return;
      const text = this.touch ? s.text.touch : s.text.pc, done = this.doneT > 0;
      this.drawHint(ctx, W, H, sa, s, done, hud);
      this.drawCard(ctx, W, H, sa, { title: done ? 'WELL DONE!' : (this.idx + 1) + '/' + steps.length, body: text, color: done ? CC.CONFIG.hud.colors.green : '#fdfd02', pct: this.idx / steps.length, done });
    }

    drawCard(ctx, W, H, sa, o) {
      const ui = this.game.ui, px = Math.min(W * 0.0062, H * 0.0072), pad = px * 5, bw = Math.min(W - sa.l - sa.r - W * 0.06, px * 8.4 * 30);
      const lines = ui.wrap(o.body, px, bw - pad * 2), bh = pad * 2 + px * 11 + lines.length * px * 10;
      const x = (W - bw) / 2, y = sa.t + H * 0.11, k = U.smooth(0, 0.2, this.t < 0.2 && !o.done ? this.t : 1);
      ctx.save(); ctx.globalAlpha = Math.max(0.15, k); ctx.translate(0, (1 - k) * -H * 0.02);
      ctx.fillStyle = 'rgba(8,10,16,0.86)'; ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(2, px * 0.7); ctx.strokeRect(x, y, bw, bh);
      CC.Font.draw(ctx, o.title, x + pad, y + pad, px * 0.9, o.color, {});
      if (o.done) ui.iconCheck(ctx, x + bw - pad * 1.6, y + pad + px * 3, px * 3, o.color);
      lines.forEach((l, i) => CC.Font.draw(ctx, l, x + pad, y + pad + px * 11 + i * px * 10, px, '#f4f4f4', {}));
      if (o.pct) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y + bh - px * 1.2, bw, px * 1.2); ctx.fillStyle = o.color; ctx.fillRect(x, y + bh - px * 1.2, bw * o.pct, px * 1.2); }
      ctx.restore();
    }

    // pictogrammes animés : où poser le doigt, quel geste faire
    drawHint(ctx, W, H, sa, s, done, hud) {
      const t = this.game.ui.t, cx = W / 2, cy = sa.t + H * 0.62, r = Math.min(W, H) * 0.07, white = '#f4f4f4', yel = '#fdfd02';
      ctx.save();
      if (done) ctx.globalAlpha = 0.35;
      const finger = (x, y, down) => {
        ctx.fillStyle = down ? 'rgba(253,253,2,0.55)' : 'rgba(244,244,244,0.4)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = white; ctx.lineWidth = Math.max(2, r * 0.12); ctx.stroke();
      };
      const ring = (x, y, k) => { ctx.strokeStyle = yel; ctx.globalAlpha *= 1 - k; ctx.lineWidth = Math.max(2, r * 0.1); ctx.beginPath(); ctx.arc(x, y, r * (1 + k * 1.6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = done ? 0.35 : 1; };
      if (s.hint === 'tap') { const k = (t * 1.4) % 1; finger(cx, cy + (k < 0.2 ? r * 0.15 : 0), k < 0.2); ring(cx, cy, k); }
      else if (s.hint === 'drag') {
        const k = (t * 0.9) % 1, e = k < 0.5 ? k * 2 : 2 - k * 2, x = cx + Math.sin(e * Math.PI - Math.PI / 2) * W * 0.22;
        ctx.strokeStyle = 'rgba(253,253,2,0.55)'; ctx.lineWidth = Math.max(3, r * 0.14); ctx.setLineDash([r * 0.4, r * 0.5]); ctx.beginPath(); ctx.moveTo(cx - W * 0.22, cy); ctx.lineTo(cx + W * 0.22, cy); ctx.stroke(); ctx.setLineDash([]);
        finger(x, cy, true);
      } else if (s.hint === 'hold') {
        const k = (t * 0.7) % 1;
        finger(cx, cy, true);
        ctx.strokeStyle = yel; ctx.lineWidth = Math.max(3, r * 0.2); ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        const p = Math.min(1, (this.held || 0) / 0.6);
        if (p > 0) { ctx.fillStyle = yel; ctx.fillRect(cx - r * 1.5, cy + r * 2.1, r * 3 * p, r * 0.25); }
      } else if (s.hint === 'edge') {
        const bandW = W * (CC.CONFIG.input.touch.edgeBand || 0.22), a = 0.12 + 0.1 * Math.sin(t * 5);
        for (const side of [0, 1]) {
          const x0 = side ? W - bandW : 0, g = ctx.createLinearGradient(side ? W : 0, 0, side ? W - bandW : bandW, 0);
          g.addColorStop(0, 'rgba(253,253,2,' + (a + 0.12) + ')'); g.addColorStop(1, 'rgba(253,253,2,0)');
          ctx.fillStyle = g; ctx.fillRect(x0, 0, bandW, H);
        }
        const k = (t * 1.1) % 1, side = Math.floor(t * 0.55) % 2, fx = side ? W - bandW * 0.45 : bandW * 0.45;
        finger(fx, cy, true); ring(fx, cy, k);
      } else if (s.hint === 'fuel') {
        const f = hud.fuelRect(this.game), pulse = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.strokeStyle = yel; ctx.lineWidth = Math.max(3, f.h * 0.3); ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.strokeRect(f.x - f.h, f.y - f.h * 0.8, f.w + f.h * 2, f.h * 2.6);
        ctx.fillStyle = yel; ctx.globalAlpha = 1;
        const ax = f.x + f.w / 2, ay = f.y - f.h * 2 - pulse * f.h; ctx.beginPath(); ctx.moveTo(ax, ay + f.h * 1.6); ctx.lineTo(ax - f.h * 1.2, ay); ctx.lineTo(ax + f.h * 1.2, ay); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  CC.Tutorial = Tutorial;
})();
