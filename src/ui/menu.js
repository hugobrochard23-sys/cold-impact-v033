/* Interface : cœur (CC.UI), menu d'accueil, DÉFI, générateur de missions.
 * Tout est dessiné dans le canvas du HUD ; les composants communs (boutons à états, défilement, curseurs, toasts…) sont
 * dans src/ui/widgets.js, la pause et les résultats dans endscreens.js, réglages et aide dans settings.js, la boutique
 * dans shop.js. Chaque écran enregistre ses zones tactiles à chaque image (ui.buttons) ; le pointeur est géré par
 * ui.pointerDown / Move / Up (src/input/input.js les alimente). */
(function () {
  const U = CC.U;

  class UI {
    constructor(game) {
      this.game = game; this.buttons = []; this.hover = -1; this.mouse = { x: -1, y: -1 }; this._ov = null;
      this.safeL = this.safeT = this.safeR = this.safeB = 0;   // zones système (encoche, barre d'accueil) en pixels du canvas
      this.starSeen = [false, false, false]; this.screenKey = '';
      this.initKit();
    }

    // plein écran, zones système comprises
    dim(ctx, W, H, a) {
      ctx.fillStyle = 'rgba(8,8,12,' + a + ')';
      ctx.fillRect(-this.safeL - 2, -this.safeT - (this.offsetY || 0) - 2, W + this.safeL + this.safeR + 4, (this.fullH || H) + this.safeT + this.safeB + 4);
    }

    // true si l'interface capte le pointeur (menus, pause, surcouches, dialogue) : le jeu ne reçoit alors ni tir ni visée
    active() {
      const g = this.game;
      return g.state === 'MENU' || g.state === 'RESULTS' || g.state === 'BOOT' || g.paused || !!this._ov || !!this.modal;
    }

    draw(ctx, game, W, H) {
      const now = performance.now();
      this.tickKit(Math.min(0.05, (now - this.lastDraw) / 1000)); this.lastDraw = now;
      const sk = game.state + '|' + game.paused + '|' + this._ov;   // l'écran a changé : ses animations repartent de zéro
      if (sk !== this.screenKey) { this.screenKey = sk; this.screenT = 0; }
      this.buttons = []; this.regions = []; this.hover = -1; this.clip = null;
      const col = CC.CONFIG.hud.colors, ov = this._ov;
      if (game.state === 'MENU') this.drawMenu(ctx, game, W, H);
      else if (game.state === 'RESULTS') this.drawResults(ctx, game, W, H);
      else if (game.paused && !ov) this.drawPause(ctx, game, W, H);
      if (ov) {
        this.buttons = []; this.regions = [];   // une surcouche est exclusive : aucun toucher ne passe au travers
        if (ov === 'settings') this.drawSettings(ctx, game, W, H);
        else if (ov === 'help') this.drawHelp(ctx, game, W, H);
        else if (ov === 'missions') this.drawMissions(ctx, game, W, H);
        else if (ov === 'defi') this.drawDefi(ctx, game, W, H);
        else if (ov === 'generating') this.drawGenerating(ctx, game, W, H);
        else if (ov === 'shop') { if (!this.shop) this.shop = new CC.Shop(this); this.shop.draw(ctx, game, W, H); }
        else if (ov === 'ad' && game.ads) game.ads.draw(ctx, game, W, H, this);
      }
      if (game.state === 'MENU' && !ov && game.ads) this.drawMenuBanner(ctx, game, W, H);
      if (this.modal) this.drawModal(ctx, W, H);
      this.drawToasts(ctx, W, H);
      if (game.state === 'BOOT') { this.dim(ctx, W, H, 1); this.text(ctx, 'LOADING...', W / 2, H / 2, H * 0.004, col.white, { align: 'center' }); }
      game.hudCanvas.style.cursor = this.hover >= 0 ? 'pointer' : (this.active() ? 'default' : '');   // souris : main sur les boutons
      if (game.genDebug && game.level && game.level.plan && CC.Gen.drawDebugOverlay && !ov) CC.Gen.drawDebugOverlay(ctx, game, W, H, this);   // v032
    }

    /* v033 : menu d'accueil à trois gros boutons (façon Block Blast) : CLASSIQUE (couloir infini), DÉFI (cartes numérotées
     * à étoiles + les 9 niveaux d'origine), BOUTIQUE. v033-ux : bouton de réglages en haut à droite. Plein écran, portrait
     * comme paysage ; tous les boutons font au moins 48 points. */
    drawMenu(ctx, game, W, H) {
      this.dim(ctx, W, H, 0.5);
      const col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H, P = this.portrait, touch = this.isTouch();
      const Y = (f) => T + HH * f, banner = touch && P && game.ads && game.ads.enabled() ? HH * 0.075 : 0, mt = this.minTap();
      this.text(ctx, 'COLD IMPACT', W / 2, Y(P ? 0.085 : 0.07), this.fitPx(['COLD IMPACT'], W * (P ? 0.86 : 0.6), HH * (P ? 0.009 : 0.0125)), col.white, { align: 'center', skew: -0.22 });
      const tag = 'FLY. GRAZE. DESTROY.';
      this.text(ctx, tag, W / 2, Y(P ? 0.155 : 0.2), this.fitPx([tag], W * 0.8, HH * 0.003), col.yellow, { align: 'center' });
      this.iconButton(ctx, { x: W - mt - W * 0.025, y: T + HH * 0.012, w: mt, h: mt }, this.iconGear, () => { this.open('settings'); }, { color: '#cfcfcf' });
      const rec = game.save.endless && game.save.endless.best, maxStars = CC.Gen.difficultyIds().length * CC.CONFIG.challenge.maps * 3;
      const stars = CC.Gen.difficultyIds().reduce((a, d) => a + game.challengeStars(d), 0);
      const first = !(game.save.endless && game.save.endless.runs) && game.settings.tutorialDone;   // premier lancement après le tutoriel : on désigne le bouton à toucher
      const items = [
        ['CLASSIC', rec ? 'BEST ' + rec + ' M' : 'GO AS FAR AS YOU CAN', col.green, () => game.startEndless(), false, first],
        ['CHALLENGE', stars + ' / ' + maxStars + ' STARS', '#8fd0ff', () => { this.open('defi'); }, true],
        ['SHOP', 'ROCKET SKINS', col.yellow, () => { this.openShop(); }],
      ];
      const bw = W * (P ? 0.84 : 0.42), bh = HH * (P ? 0.14 : 0.165), gap = HH * (P ? 0.035 : 0.03);
      const top = P ? Y(0.25) : Y(0.29);
      const lp = this.fitPx(items.map((it) => it[0]), bw * 0.8, bh * 0.06);   // même taille pour les trois libellés
      items.forEach((it, i) => this.bigButton(ctx, W / 2 - bw / 2, top + i * (bh + gap), bw, bh, it[0], it[1], it[2], it[3], it[4], lp, { pulse: it[5] }));
      this.text(ctx, CC.CONFIG.version.toUpperCase(), W * 0.97, T + HH - banner - HH * (P ? 0.05 : 0.07) + HH * 0.035, HH * 0.0018, '#808080', { align: 'right' });
    }

    /* v033 : écran DÉFI — onglets FACILE / MOYEN / DIFFICILE / IMPOSSIBLE (20 cartes numérotées chacune, 1 à 3 étoiles,
     * trophées à 10, 20 et 40 étoiles) et NIVEAUX (les 9 niveaux d'origine). MISSIONS LIBRES : l'ancien générateur. */
    drawDefi(ctx, game, W, H) {
      this.dim(ctx, W, H, 1);
      const G = CC.Gen, col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H, P = this.portrait;
      const Y = (f) => T + HH * f, mt = this.minTap(), CH = CC.CONFIG.challenge, hh = mt + HH * 0.016;
      this.backButton(ctx, W * 0.025, T + HH * 0.012, mt);
      this.text(ctx, 'CHALLENGE', W / 2, T + HH * 0.012 + (mt - HH * 0.008 * 7) / 2, this.fitPx(['CHALLENGE'], W * 0.4, HH * 0.008), col.white, { align: 'center', skew: -0.2 });
      const ids = G.difficultyIds(), tabs = ids.concat(['levels']);
      const tab = this.defiTab && tabs.includes(this.defiTab) ? this.defiTab : 'easy';
      const lab = (id) => (id === 'levels' ? 'LEVELS' : G.Difficulties.get(id).label);
      const tcol = (id) => (id === 'levels' ? '#cfcfcf' : G.Difficulties.get(id).color);
      // onglets : une rangée (paysage) ou deux (portrait : FACILE MOYEN DIFFICILE / IMPOSSIBLE NIVEAUX, libellés lisibles)
      const th = Math.max(HH * (P ? 0.05 : 0.06), mt), rowsT = P ? [[0, 1, 2], [3, 4]] : [[0, 1, 2, 3, 4]], ty0 = T + hh + HH * 0.006;
      const tpx = Math.min(...rowsT.map((row) => this.fitPx(row.map((ti) => lab(tabs[ti])), W * 0.94 / row.length * 0.84, th * 0.044)));   // même taille pour tous les onglets
      rowsT.forEach((row, ri) => row.forEach((ti, ci) => {
        const tw = W * 0.94 / row.length, id = tabs[ti], on = id === tab;
        const px = tpx, r = { x: W * 0.03 + ci * tw + 2, y: ty0 + ri * (th + HH * 0.008), w: tw - 4, h: th };
        const face = this.placeButton(ctx, r, null, 0, () => { this.defiTab = id; }, { color: on ? tcol(id) : '#9a9a9a', fill: on ? 'rgba(255,255,255,0.1)' : 'rgba(8,10,14,0.6)', fx: 'tab' });
        this.text(ctx, lab(id), face.x + face.w / 2, face.y + (face.h - px * 7) / 2, px, on ? tcol(id) : '#bdbdbd', { align: 'center' });
        if (on) { ctx.fillStyle = tcol(id); ctx.fillRect(face.x, face.y + face.h - th * 0.07, face.w, th * 0.07); }
      }));
      const tabsBottom = ty0 + rowsT.length * (th + HH * 0.008);
      const footH = mt * 1.15, footY = T + HH - footH - HH * 0.02, areaTop = tabsBottom + HH * 0.02, areaBot = footY - HH * 0.015;
      if (tab === 'levels') this.drawDefiLevels(ctx, game, W, areaTop, areaBot);
      else {
        const stars = game.challengeStars(tab), D = G.Difficulties.get(tab);
        // total d'étoiles et trophées
        const spx = this.fitPx(['00 / 60'], W * 0.22, HH * 0.0034), sy = areaTop;
        this.star(ctx, W * 0.06 + spx * 3, sy + spx * 3.5, spx * 4.2, true, col.yellow);
        this.text(ctx, stars + ' / ' + CH.maps * 3, W * 0.06 + spx * 9, sy, spx, col.white, {});
        const names = ['BRONZE', 'SILVER', 'GOLD'], tc = ['#d08a4a', '#d0d8e0', '#ffd23a'], ts = spx * 10;
        CH.trophies.forEach((need, i) => {
          const cx = W * (P ? 0.6 : 0.62) + i * W * (P ? 0.13 : 0.1), won = stars >= need;
          this.trophy(ctx, cx, sy + ts * 0.35, ts, tc[i], won);
          this.text(ctx, won ? names[i] : String(need), cx, sy + ts * 0.95, spx * 0.6, won ? tc[i] : '#8a8a8a', { align: 'center' });
        });
        // grille des cartes : chaque carte est un bouton ≥ 48 points qui s'enfonce au toucher
        const cols = P ? 4 : 5, rows = Math.ceil(CH.maps / cols), gTop = sy + ts * 1.55, gh = areaBot - gTop;
        const cw = W * 0.94 / cols, chh = Math.min(gh / rows, cw * 1.05), gx = W * 0.03, npx = this.fitPx(['20'], cw * 0.5, chh * 0.05);
        for (let n = 1; n <= CH.maps; n++) {
          const c = (n - 1) % cols, rr = Math.floor((n - 1) / cols);
          let x = gx + c * cw + 3, y = gTop + rr * chh + 3, w = cw - 6, h = chh - 6;
          const open = game.challengeOpen(tab, n), rec = game.challengeRec(tab, n);
          const st = this.hitRect({ x, y, w, h }, () => game.startChallenge(tab, n), { disabled: !open, msg: 'FINISH MAP ' + (n - 1) + ' TO UNLOCK THIS ONE' });
          if (st.pressed) { x += w * 0.03; y += h * 0.03; w *= 0.94; h *= 0.94; }
          ctx.fillStyle = open ? (rec ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)') : 'rgba(255,255,255,0.015)'; ctx.fillRect(x, y, w, h);
          if (st.pressed) { ctx.fillStyle = D.color; ctx.globalAlpha = 0.25; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
          ctx.strokeStyle = open ? D.color : 'rgba(120,120,120,0.35)'; ctx.globalAlpha = open ? (rec ? 1 : 0.6) : 1; ctx.lineWidth = Math.max(1, h * 0.025); ctx.strokeRect(x, y, w, h); ctx.globalAlpha = 1;
          if (!open) this.iconLock(ctx, x + w / 2, y + h * 0.4, Math.min(w, h) * 0.2, '#555');
          else this.text(ctx, String(n), x + w / 2, y + h * 0.18, npx, col.white, { align: 'center' });
          const sr = Math.min(w * 0.12, h * 0.12);
          for (let k = 0; k < 3; k++) this.star(ctx, x + w / 2 + (k - 1) * sr * 2.3, y + h * 0.74, sr, !!rec && rec.s > k, col.yellow);
        }
      }
      // pied : missions libres (générateur à graine)
      const bpx = this.fitPx(['FREE MISSIONS'], W * 0.7, footH * 0.046);
      this.placeButton(ctx, { x: W * 0.06, y: footY, w: W * 0.88, h: footH }, 'FREE MISSIONS', bpx, () => { this.open('missions'); }, { color: '#8fd0ff' });
    }

    // v033 : les 9 niveaux d'origine (onglet NIVEAUX du DÉFI) : une ligne par niveau, record à droite, cadenas sinon
    drawDefiLevels(ctx, game, W, top, bottom) {
      const best = game.save.best, n = CC.Levels.length, mt = this.minTap(), rowH = Math.max((bottom - top) / n, mt * 1.05), x0 = W * 0.05, w = W * 0.9;
      const names = CC.Levels.map((lv, i) => (i + 1) + '  ' + lv.name);
      const px = this.fitPx(names, w * 0.55, rowH * 0.055), sub = px * 0.65;
      const sy = this.scrollBegin(ctx, 'levels', { x: 0, y: top, w: W, h: bottom - top }, n * rowH);
      CC.Levels.forEach((lv, i) => {
        const open = game.isUnlocked(i), b = best[lv.id], y = top + i * rowH - sy, r = { x: x0, y: y + rowH * 0.06, w, h: rowH * 0.88 };
        this.placeButton(ctx, r, null, 0, () => game.startLevel(i), { color: open ? '#f4f4f4' : '#6a6a6a', locked: !open, msg: 'FINISH LEVEL ' + i + ' TO UNLOCK THIS ONE' });
        const ty = r.y + (r.h - px * 7) / 2;
        this.text(ctx, names[i], x0 + px * 4, ty, px, open ? '#f4f4f4' : '#6a6a6a', {});
        if (!open) this.iconLock(ctx, x0 + w - px * 5, r.y + r.h / 2, px * 2.2, '#6a6a6a');
        else this.text(ctx, b ? U.formatTime(b.time) : '--:--,--', x0 + w - px * 4, r.y + (r.h - sub * 7) / 2, sub, b ? '#cfcfcf' : '#8a8a8a', { align: 'right' });
      });
      this.scrollEnd(ctx);
    }

    // v030 : bannière publicitaire d'exemple, en bas du menu principal
    drawMenuBanner(ctx, game, W, H) {
      if (!game.ads.enabled()) return;
      const T = -(this.offsetY || 0), HH = this.fullH || H;
      if (this.portrait && this.isTouch()) { const h = HH * 0.068; game.ads.drawBanner(ctx, this, W * 0.03, T + HH - h - HH * 0.006, W * 0.94, h); }
      else { const h = H * 0.08; game.ads.drawBanner(ctx, this, W * 0.745, H * 0.905, W * 0.24, h); }   // à droite du bouton de la boutique
    }

    /* v032 : GÉNÉRATEUR DE MISSIONS — quatre difficultés, mission du jour, graine choisie ou aléatoire, dernières missions.
     * Plein écran (portrait comme paysage), boutons encadrés ≥ 48 points. */
    drawMissions(ctx, game, W, H) {
      this.dim(ctx, W, H, 1);
      const G = CC.Gen, col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H;
      const P = this.portrait, mt = this.minTap();
      const fit = (t, w, m) => this.fitPx([t], W * w, m);
      const Y = (f) => T + HH * f;
      this.backButton(ctx, W * 0.025, T + HH * 0.012, mt);
      this.text(ctx, 'FREE MISSIONS', W / 2, T + HH * 0.012 + (mt - HH * 0.006 * 7) / 2, fit('FREE MISSIONS', P ? 0.5 : 0.6, HH * 0.006), col.white, { align: 'center', skew: -0.2 });
      const seedTxt = this.seedChoice !== undefined && this.seedChoice !== null ? 'SEED ' + this.seedChoice : 'RANDOM SEED - EVERY MISSION IS UNIQUE';
      this.text(ctx, seedTxt, W / 2, Y(0.16), fit(seedTxt, 0.9, HH * 0.0026), this.seedChoice != null ? col.yellow : '#c8c8c8', { align: 'center' });
      // quatre difficultés
      const ids = G.difficultyIds(), top = 0.22, gap = P ? 0.1 : 0.095;
      const bpx = this.fitPx(ids.map((id) => '  ' + G.Difficulties.get(id).label + '  '), W * (P ? 0.5 : 0.28), HH * 0.0048);
      ids.forEach((id, i) => {
        const D = G.Difficulties.get(id), y = Y(top + i * gap);
        const go = () => { const sd = this.seedChoice != null ? this.seedChoice : null; game.requestMission(id, sd); };
        if (P) {
          this.button(ctx, D.label, W / 2, y, bpx, go, { color: D.color, hitW: W * 0.84 });
          const bh = Math.max(bpx * 11, mt);   // hauteur réelle du bouton
          this.text(ctx, D.blurb, W / 2, y - bpx * 2 + bh + bpx * 0.8, fit(D.blurb, 0.84, HH * 0.0021), '#a8a8a8', { align: 'center' });
        } else {
          this.button(ctx, D.label, W * 0.36, y, bpx, go, { color: D.color, hitW: W * 0.26 });
          this.text(ctx, D.blurb, W * 0.51, y + bpx * 1.2, HH * 0.0024, '#b8b8b8', { align: 'left' });
        }
      });
      // mission du jour
      const dl = G.daily(), dD = G.Difficulties.get(dl.difficulty), done = game.save.daily && game.save.daily[dl.id];
      const dy = Y(top + 4 * gap + 0.02);
      const dLabel = 'DAILY MISSION  ' + dl.label + '  ' + dD.label;
      this.button(ctx, dLabel, W / 2, dy, fit(dLabel, 0.8, HH * 0.0034), () => game.requestMission(dl.difficulty, dl.seed, { daily: dl.id }), { color: '#8fd0ff', hitW: W * (P ? 0.84 : 0.6) });
      this.text(ctx, 'SEED ' + dl.seed + (done !== undefined ? '   BEST ' + U.formatTime(done) : '   SAME MAP FOR EVERYONE'), W / 2, dy + HH * 0.042, fit('SEED 000000000   SAME MAP FOR EVERYONE', 0.8, HH * 0.0022), '#9ab8cc', { align: 'center' });
      // graine : saisir / revenir à l'aléatoire
      const sy = dy + HH * 0.095, spx = fit('ENTER A SEED', P ? 0.36 : 0.22, HH * 0.003);
      this.button(ctx, 'ENTER A SEED', W * (P ? 0.29 : 0.4), sy, spx, () => this.openSeedInput(game), { hitW: W * (P ? 0.44 : 0.24) });
      this.button(ctx, 'RANDOM', W * (P ? 0.76 : 0.62), sy, spx, () => { this.seedChoice = null; }, { hitW: W * (P ? 0.36 : 0.14), color: this.seedChoice == null ? '#7a7a7a' : undefined });
      // dernières missions jouées (rejouer une graine)
      const hist = (game.save.missions || []).slice(0, P ? 3 : 2);
      if (hist.length) this.text(ctx, 'RECENT MISSIONS', W / 2, sy + HH * 0.075, fit('RECENT MISSIONS', 0.5, HH * 0.0024), '#8a8a8a', { align: 'center' });
      hist.forEach((h, i) => {
        const D = G.Difficulties.get(h.d) || G.Difficulties.get('easy'), lbl = h.seed + '  ' + D.label + '  ' + U.formatTime(h.t);
        this.button(ctx, lbl, W / 2, sy + HH * (0.115 + i * 0.058), fit(lbl, 0.7, HH * 0.0028), () => game.requestMission(h.d, h.seed), { hitW: W * (P ? 0.84 : 0.5), color: '#cfcfcf' });
      });
      if (this.diffChoice && G.Difficulties.has(this.diffChoice) && this.seedChoice != null) {   // lien partagé : difficulté suggérée
        this.text(ctx, 'SHARED MISSION: ' + G.Difficulties.get(this.diffChoice).label, W / 2, Y(0.19), fit('SHARED MISSION: IMPOSSIBLE', 0.6, HH * 0.0024), '#8fd0ff', { align: 'center' });
      }
    }

    // Écran de génération (une image avant le calcul, puis lancement immédiat)
    drawGenerating(ctx, game, W, H) {
      this.dim(ctx, W, H, 0.96);
      const pm = game.pendingMission, T = -(this.offsetY || 0), HH = this.fullH || H;
      const D = pm && CC.Gen.Difficulties.get(pm.diffId);
      this.text(ctx, 'GENERATING...', W / 2, T + HH * 0.44, this.fitPx(['GENERATING...'], W * 0.8, HH * 0.009), '#f4f4f4', { align: 'center', skew: -0.2 });
      if (D) this.text(ctx, D.label + (pm.seed != null ? '   SEED ' + pm.seed : ''), W / 2, T + HH * 0.54, this.fitPx(['IMPOSSIBLE   SEED 0000000000'], W * 0.8, HH * 0.0032), D.color, { align: 'center' });
    }

    // Saisie d'une graine : petit champ de texte (le clavier du téléphone s'ouvre) ; un mot est aussi une graine
    openSeedInput(game) {
      let box = document.getElementById('cc-seedbox');
      if (!box) {
        box = document.createElement('div'); box.id = 'cc-seedbox';
        box.innerHTML = '<span>SEED</span><input id="cc-seed" maxlength="14" autocomplete="off" spellcheck="false" enterkeyhint="go"><button id="cc-seed-ok" aria-label="Confirm">OK</button><button id="cc-seed-x" aria-label="Cancel">X</button>';
        document.body.appendChild(box);
        const ok = () => { const v = CC.Gen.parseSeed(document.getElementById('cc-seed').value); if (v !== null) this.seedChoice = v; this.closeSeedInput(); };
        document.getElementById('cc-seed-ok').onclick = ok;
        document.getElementById('cc-seed-x').onclick = () => this.closeSeedInput();
        document.getElementById('cc-seed').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') this.closeSeedInput(); };
      }
      box.style.display = 'flex';
      const inp = document.getElementById('cc-seed');
      inp.value = this.seedChoice != null ? String(this.seedChoice) : '';
      setTimeout(() => inp.focus(), 30);
    }
    closeSeedInput() { const box = document.getElementById('cc-seedbox'); if (box) { box.style.display = 'none'; const i = document.getElementById('cc-seed'); if (i) i.blur(); } }
  }
  // les composants communs, accesseurs compris (overlay)
  Object.defineProperties(UI.prototype, Object.getOwnPropertyDescriptors(CC.UIKit));

  CC.UI = UI;
})();
