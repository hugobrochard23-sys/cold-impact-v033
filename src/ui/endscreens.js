/* Écrans de pause et de résultats (v033-ux : refaits pour le tactile).
 * Pause : gros boutons empilés (deux colonnes si l'écran est trop bas), retour en jeu en premier et le plus visible,
 * quitter la partie demande confirmation. Résultats : compteurs qui montent, étoiles qui apparaissent une à une avec
 * son et vibration, bouton REJOUER mis en avant ; plus aucun toucher « dans le vide » ne relance la partie. */
(function () {
  const U = CC.U;

  Object.assign(CC.UI.prototype, {
    // son et musique coupés / remis d'un geste (le volume précédent est conservé)
    toggleVolume(game, key) {
      const s = game.settings, keep = '_' + key;
      if (s[key] > 0) { s[keep] = s[key]; s[key] = 0; } else s[key] = s[keep] || CC.CONFIG.audio[key];
      game.applySettings();
    },

    drawPause(ctx, game, W, H) {
      this.dim(ctx, W, H, 0.64);
      const col = CC.CONFIG.hud.colors, s = game.settings, T = -(this.offsetY || 0), HH = this.fullH || H, P = this.portrait, mt = this.minTap();
      const Y = (f) => T + HH * f, tut = game.tutorial && game.tutorial.active;
      const k = U.smooth(0, 0.16, this.screenT);   // le menu glisse et apparaît
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * HH * 0.02);
      this.text(ctx, 'PAUSE', W / 2, Y(P ? 0.07 : 0.035), this.fitPx(['PAUSE'], W * 0.6, HH * (P ? 0.009 : 0.0085)), '#f4f4f4', { align: 'center', skew: -0.2 });
      let info = null;
      if (game.generated && game.mission) { const m = game.mission; info = m.challenge ? 'CHALLENGE ' + m.label + '  MAP ' + m.challenge.n + '/' + CC.CONFIG.challenge.maps : 'SEED ' + m.seed + '  ' + m.label + '  ' + m.biome; }
      else if (game.endlessRun) info = 'CLASSIC  ' + Math.round(game.endlessRun.dist) + ' M';
      else if (tut) info = 'TUTORIAL';
      if (info) this.text(ctx, info, W / 2, Y(P ? 0.125 : 0.125), this.fitPx([info], W * 0.9, HH * (P ? 0.0028 : 0.0042)), col.yellow, { align: 'center' });

      const soundOn = s.sfx > 0, musicOn = s.music > 0;
      const entries = [{ label: 'RESUME', action: () => game.resume(), solid: true, color: col.yellow, fx: 'primary' }];
      entries.push({ label: 'SOUND: ' + (soundOn ? 'ON' : 'OFF'), action: () => this.toggleVolume(game, 'sfx'), color: soundOn ? '#f4f4f4' : '#8a8a8a', fx: 'tab' });
      entries.push({ label: 'MUSIC: ' + (musicOn ? 'ON' : 'OFF'), action: () => this.toggleVolume(game, 'music'), color: musicOn ? '#f4f4f4' : '#8a8a8a', fx: 'tab' });
      if (!tut) entries.push({ label: 'RESTART', action: () => { game.resume(); game.restartLevel(); } });
      const next = game.nextUnlocked();
      if (next >= 0 && !tut) entries.push({ label: 'NEXT LEVEL', action: () => { game.resume(); game.startLevel(next); } });
      if (game.generated && game.mission && !game.mission.challenge) entries.push({ label: 'NEW MISSION', action: () => { game.resume(); game.requestMission(game.mission.difficulty); } });
      entries.push({ label: 'SETTINGS', action: () => this.open('settings') });
      if (tut) entries.push({ label: 'SKIP TUTORIAL', action: () => { game.resume(); game.tutorial.finish(true); }, color: '#8fd0ff' });
      else entries.push({ label: 'MAIN MENU', color: '#ff9a8a', action: () => this.confirm({ title: 'QUIT THIS RUN?', lines: ['YOUR CURRENT RUN WILL BE LOST.'], yes: 'QUIT', no: 'STAY', color: col.red, onYes: () => game.toMenu() }) });

      const y0 = Y(P ? 0.19 : 0.2), y1 = T + HH - HH * 0.04;
      const oneCol = (y1 - y0) / entries.length >= mt * 1.08, cols = oneCol ? 1 : 2, nRows = Math.ceil(entries.length / cols);
      const rowH = Math.min((y1 - y0) / nRows, mt * 1.5), bh = rowH * 0.84, bw = W * (cols === 1 ? (P ? 0.84 : 0.56) : 0.44);
      const px = this.fitPx(entries.map((e) => e.label), bw * 0.84, bh * 0.046);
      entries.forEach((e, i) => {
        const c = cols === 1 ? 0 : i % 2, r = cols === 1 ? i : Math.floor(i / 2);
        const x = cols === 1 ? W / 2 - bw / 2 : W / 2 - W * 0.455 + c * (bw + W * 0.03);
        this.placeButton(ctx, { x, y: y0 + r * rowH, w: bw, h: bh }, e.label, px, e.action, e);
      });
      ctx.restore();
    },

    // anneau d'étoiles qui apparaissent une à une (rebond) : renvoie combien sont visibles
    drawStarsPop(ctx, cx, cy, r, got, t0, onShow) {
      let shown = 0;
      for (let k = 0; k < 3; k++) {
        const t = this.screenT - t0 - k * 0.3, x = cx + (k - 1) * r * 2.7;
        if (k < got && t > 0) {
          shown++;
          const s = t < 0.25 ? 0.2 + 1.2 * (t / 0.25) : 1.4 - 0.4 * U.smooth(0.25, 0.45, t);
          if (onShow && !this.starSeen[k]) { this.starSeen[k] = true; onShow(k); }
          ctx.save(); ctx.translate(x, cy); ctx.scale(s, s); this.star(ctx, 0, 0, r, true, CC.CONFIG.hud.colors.yellow); ctx.restore();
        } else this.star(ctx, x, cy, r, false);
      }
      return shown;
    },

    drawResults(ctx, game, W, H) {
      const r = game.results;
      if (!r) return;
      if (game.state !== this.resState || r !== this.resObj) { this.resObj = r; this.resState = game.state; this.screenT = 0; this.starSeen = [false, false, false]; this.resDone = false; }
      if (r.endless || r.challenge) { this.drawResultsV33(ctx, game, W, H); return; }
      this.dim(ctx, W, H, 0.55);
      const col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H, Y = (f) => T + HH * f, fit = (t, w, m) => this.fitPx([t], W * w, m);
      const k = U.smooth(0, 0.3, this.screenT);
      this.needFrames();
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * HH * 0.03);
      this.text(ctx, r.title, W / 2, Y(0.1), fit(r.title, 0.9, HH * 0.0075), col.white, { align: 'center', skew: -0.2 });
      const c = U.smooth(0.2, 1.0, this.screenT), px = fit('TIME 0:00,00  ', 0.8, HH * 0.0048);
      this.text(ctx, 'TIME  ' + U.formatTime(r.time * c), W / 2, Y(0.2), px, col.white, { align: 'center' });
      this.text(ctx, 'STYLE ' + U.formatInt(Math.round(r.style * c)), W / 2, Y(0.2) + px * 12.5, px, col.white, { align: 'center' });
      if (r.bestTime) this.text(ctx, 'BEST  ' + U.formatTime(r.bestTime) + (r.newRecord ? '  RECORD!' : ''), W / 2, Y(0.2) + px * 25, px * 0.72, r.newRecord ? col.yellow : '#bdbdbd', { align: 'center' });
      if (r.newRecord && !this.resDone && this.screenT > 1.0) { this.resDone = true; this.feedback('success'); }
      let ty = Y(0.2) + px * 25;
      if (game.generated && game.mission) {   // v032 : graine, record de la graine
        const m = game.mission, t = 'SEED ' + m.seed + '  ' + m.label + (r.seedBest !== undefined ? '   BEST ' + U.formatTime(r.seedBest) : '');
        ty += px * 9; this.text(ctx, t, W / 2, ty, fit(t, 0.9, HH * 0.0028), r.seedRecord ? col.yellow : '#bdbdbd', { align: 'center' });
      }
      const via = (fn) => () => (game.ads ? game.ads.beforeContinue(fn) : fn());
      const acts = [{ label: 'RETRY', action: via(() => game.restartLevel()), solid: true, color: col.yellow, fx: 'primary' }];
      if (game.generated && game.mission) {
        acts.push({ label: 'NEW MISSION', action: via(() => game.requestMission(game.mission.difficulty)) });
        acts.push({ label: 'FREE MISSIONS', action: via(() => { this.overlay = 'missions'; }) });
      } else if (game.levelIndex < CC.Levels.length - 1) acts.push({ label: 'NEXT LEVEL', action: via(() => game.startLevel(game.levelIndex + 1)) });
      acts.push({ label: 'MENU', action: via(() => game.toMenu()), fx: 'back' });
      this.drawResultButtons(ctx, W, H, acts, ty + HH * 0.05);
      ctx.restore();
    },

    // pile de boutons de fin de partie (une colonne, ou deux si l'écran est bas)
    drawResultButtons(ctx, W, H, acts, yTop) {
      const T = -(this.offsetY || 0), HH = this.fullH || H, mt = this.minTap(), bottom = T + HH - HH * 0.04;
      const oneCol = (bottom - yTop) / acts.length >= mt * 1.08, cols = oneCol ? 1 : 2, nRows = Math.ceil(acts.length / cols);
      const rowH = Math.min((bottom - yTop) / nRows, mt * 1.5), bh = rowH * 0.84, bw = W * (cols === 1 ? (this.portrait ? 0.84 : 0.56) : 0.44);
      const px = this.fitPx(acts.map((a) => a.label), bw * 0.84, bh * 0.046);
      acts.forEach((a, i) => {
        const c = cols === 1 ? 0 : i % 2, r = cols === 1 ? i : Math.floor(i / 2);
        const x = cols === 1 ? W / 2 - bw / 2 : W / 2 - W * 0.455 + c * (bw + W * 0.03);
        this.placeButton(ctx, { x, y: yTop + r * rowH, w: bw, h: bh }, a.label, px, a.action, a);
      });
    },

    /* v033 : résultats du mode CLASSIQUE (distance, record, cause) et du DÉFI (étoiles, temps visé pour la suivante,
     * trophée gagné). Le premier bouton (REJOUER) est le plus visible. */
    drawResultsV33(ctx, game, W, H) {
      this.dim(ctx, W, H, 0.64);
      const r = game.results, col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H, Y = (f) => T + HH * f;
      const fit = (t, w, m) => this.fitPx([t], W * w, m);
      const via = (fn) => () => (game.ads ? game.ads.beforeContinue(fn) : fn());
      const k = U.smooth(0, 0.3, this.screenT);
      this.needFrames();
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * HH * 0.03);
      const acts = []; let yBtn;
      if (r.endless) {
        const c = U.smooth(0.15, 1.1, this.screenT), shown = Math.round(r.dist * c), title = 'DISTANCE ' + shown + ' M';
        this.text(ctx, title, W / 2, Y(0.12), fit('DISTANCE 0000 M', 0.9, HH * 0.009), col.white, { align: 'center', skew: -0.2 });
        const isRec = r.newRecord || r.firstRun, rl = isRec ? 'NEW RECORD!' : 'BEST ' + r.best + ' M';
        const pulse = isRec && this.screenT > 1.1 ? 1 + 0.06 * Math.sin(this.screenT * 8) : 1;
        ctx.save(); ctx.translate(W / 2, Y(0.25)); ctx.scale(pulse, pulse);
        this.text(ctx, rl, 0, 0, fit(rl, 0.8, HH * 0.005), isRec ? col.yellow : '#cfcfcf', { align: 'center' }); ctx.restore();
        if (isRec && !this.resDone && this.screenT > 1.1) { this.resDone = true; this.feedback('success'); game.audio.play('target'); }
        const l2 = 'STAGE ' + r.stage.label + '    CAUSE: ' + r.cause;
        this.text(ctx, l2, W / 2, Y(0.33), fit(l2, 0.9, HH * 0.003), '#dcdcdc', { align: 'center' });
        const l3 = 'STYLE ' + U.formatInt(r.style) + '    TIME ' + U.formatTime(r.time);
        this.text(ctx, l3, W / 2, Y(0.39), fit(l3, 0.9, HH * 0.003), '#bdbdbd', { align: 'center' });
        acts.push({ label: 'RETRY', solid: true, color: col.yellow, fx: 'primary', action: via(() => game.restartLevel()) }, { label: 'MENU', fx: 'back', action: via(() => game.toMenu()) });
        yBtn = Y(0.48);
      } else {
        const c = r.challenge, D = CC.Gen.Difficulties.get(c.diff), ttl = 'MAP ' + c.n + ' COMPLETE';
        this.text(ctx, ttl, W / 2, Y(0.08), fit(ttl, 0.9, HH * 0.008), col.white, { align: 'center', skew: -0.2 });
        this.text(ctx, 'CHALLENGE ' + D.label, W / 2, Y(0.165), fit('CHALLENGE IMPOSSIBLE', 0.6, HH * 0.0032), D.color, { align: 'center' });
        const sr = Math.min(W * 0.07, HH * 0.045);
        this.drawStarsPop(ctx, W / 2, Y(0.27), sr, c.stars, 0.35, (i) => { game.audio.play('popup', null, 1 + i * 0.25); if (CC.Haptics) CC.Haptics[i === c.stars - 1 ? 'medium' : 'light'](); });
        const l1 = 'TIME ' + U.formatTime(r.time) + '    BEST ' + U.formatTime(c.best);
        this.text(ctx, l1, W / 2, Y(0.35), fit(l1, 0.9, HH * 0.0034), col.white, { align: 'center' });
        const l2 = c.next ? (c.stars + 1) + ' STARS IN ' + U.formatTime(c.next) : 'PERFECT!';
        this.text(ctx, l2, W / 2, Y(0.41), fit(l2, 0.8, HH * 0.003), c.next ? '#cfcfcf' : col.yellow, { align: 'center' });
        if (c.trophyAfter > c.trophyBefore) {
          const tn = ['BRONZE', 'SILVER', 'GOLD'][c.trophyAfter - 1], tl = 'NEW TROPHY: ' + tn;
          this.text(ctx, tl, W / 2, Y(0.465), fit(tl, 0.9, HH * 0.0034), ['#d08a4a', '#d0d8e0', '#ffd23a'][c.trophyAfter - 1], { align: 'center' });
          if (!this.resDone && this.screenT > 1.4) { this.resDone = true; this.feedback('unlock'); }
        }
        acts.push({ label: 'RETRY', solid: true, color: col.yellow, fx: 'primary', action: via(() => game.restartLevel()) });
        if (c.n < CC.CONFIG.challenge.maps) acts.push({ label: 'NEXT MAP', color: D.color, action: via(() => game.startChallenge(c.diff, c.n + 1)) });
        acts.push({ label: 'CHALLENGE', color: '#8fd0ff', action: via(() => { game.toMenu(); this.open('defi'); this.defiTab = c.diff; }) }, { label: 'MENU', fx: 'back', action: via(() => game.toMenu()) });
        yBtn = Y(0.54);
      }
      this.drawResultButtons(ctx, W, H, acts, yBtn);
      ctx.restore();
    },
  });
})();
