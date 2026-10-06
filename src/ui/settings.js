/* Réglages et aide (v033-ux). Remplacent l'ancien écran « SETTINGS » (flèches < > minuscules, ouvert seulement par la touche Tab)
 * et la liste des touches (F1). Accessibles au doigt : engrenage du menu d'accueil, bouton REGLAGES de la pause.
 * Liste verticale qui défile : curseurs (sons, sensibilité), interrupteurs, choix multiples (vibration, graphismes). */
(function () {
  const U = CC.U;
  const GFX = ['auto', 'high', 'medium', 'low'], VIB = ['OFF', 'LIGHT', 'MEDIUM', 'STRONG'];

  Object.assign(CC.UI.prototype, {
    // GRAPHICS : AUTO (niveau choisi par le jeu, affiché entre parenthèses) / HIGH / MEDIUM / LOW
    setGraphics(game, g) {
      game.settings.graphics = g;
      if (game.quality) game.quality.apply(g === 'auto' ? game.quality.initial() : g);
      game.applySettings();
    },

    drawSettings(ctx, game, W, H) {
      this.dim(ctx, W, H, 1);
      const s = game.settings, col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H, mt = this.minTap();
      const touch = this.isTouch(), x0 = W * 0.05, w = W * 0.9;
      this.backButton(ctx, W * 0.025, T + HH * 0.012, mt);
      this.text(ctx, 'SETTINGS', W / 2, T + HH * 0.012 + (mt - HH * 0.0075 * 7) / 2, this.fitPx(['SETTINGS'], W * 0.4, HH * 0.0075), col.white, { align: 'center', skew: -0.2 });
      const top = T + mt + HH * 0.03, area = { x: 0, y: top, w: W, h: T + HH - top };
      const rh = Math.max(mt * 1.2, HH * 0.075), rh2 = mt * 1.15 + 2.2 * this.pixelRatio() * 11, gap = rh * 0.16, head = rh * 0.7;
      const apply = () => game.applySettings();
      const level = s.vibration !== undefined ? s.vibration : 2;
      // contenu : [type, hauteur] dans l'ordre, pour connaître la hauteur totale avant de dessiner
      const rows = [
        ['h', 'SOUND'], ['slider', 'SOUND EFFECTS'], ['slider', 'MUSIC'],
        ['h', 'VIBRATION'], ['seg', 'STRENGTH'],
        ['h', 'CONTROLS'], ['slider', 'SENSITIVITY'], ['toggle', 'INVERT UP / DOWN'],
        ['h', 'DISPLAY'], ['seg', 'VISUAL STYLE'], ['seg', 'GRAPHICS'], ['toggle', 'VISUAL EFFECTS'],
        ['h', 'OTHER'], ['toggle', 'SAMPLE ADS'], ['toggle', 'SHOW FPS'],
        ['btn', 'HOW TO PLAY'], ['btn', 'REPLAY TUTORIAL'],
      ];
      const hOf = (t) => (t === 'h' ? head : t === 'slider' || t === 'seg' ? rh2 : rh) + gap;
      const total = rows.reduce((a, r) => a + hOf(r[0]), 0) + rh * 0.9;
      let y = top - this.scrollBegin(ctx, 'settings', area, total);
      for (const [type, label] of rows) {
        const r = { x: x0, y, w, h: type === 'h' ? head : type === 'slider' || type === 'seg' ? rh2 : rh };
        if (r.y + r.h + gap > area.y && r.y < area.y + area.h) {   // seules les lignes visibles sont dessinées
          if (type === 'h') {
            const px = this.fitPx([label], w * 0.5, head * 0.05);
            this.text(ctx, label, x0, r.y + head * 0.4, px, col.yellow, {});
            ctx.fillStyle = 'rgba(253,253,2,0.35)'; ctx.fillRect(x0 + CC.Font.measure(label, px) + px * 4, r.y + head * 0.4 + px * 3, w - CC.Font.measure(label, px) - px * 4, Math.max(2, px * 0.5));
          } else if (label === 'SOUND EFFECTS') this.slider(ctx, label, r, s.sfx, (v) => { s.sfx = Math.round(v * 20) / 20; game.audio.setVolumes(CC.CONFIG.audio.master, s.music, s.sfx); }, Math.round(s.sfx * 100) + '%', apply);
          else if (label === 'MUSIC') this.slider(ctx, label, r, s.music, (v) => { s.music = Math.round(v * 20) / 20; game.audio.setVolumes(CC.CONFIG.audio.master, s.music, s.sfx); }, Math.round(s.music * 100) + '%', apply);
          else if (label === 'STRENGTH') {
            this.segmented(ctx, 'STRENGTH', r, VIB, level, (i) => {
              s.vibration = i; if (CC.Haptics) { CC.Haptics.setLevel(i); CC.Haptics.medium(); } apply();
            }, CC.Haptics && CC.Haptics.supported ? '' : 'NOT AVAILABLE HERE');
          } else if (label === 'SENSITIVITY') {
            if (touch) this.slider(ctx, label, r, U.clamp((s.touchSens - 0.4) / 1.8, 0, 1), (v) => { s.touchSens = Math.round((0.4 + v * 1.8) * 20) / 20; }, Math.round(s.touchSens * 100) + '%', apply);
            else this.slider(ctx, label, r, U.clamp((s.sensitivity - 0.0004) / 0.0056, 0, 1), (v) => { s.sensitivity = Math.round((0.0004 + v * 0.0056) * 20000) / 20000; }, U.formatDec(s.sensitivity * 1000, 1), apply);
          } else if (label === 'INVERT UP / DOWN') this.toggle(ctx, label, r, !!s.invertY, (v) => { s.invertY = v; apply(); });
          else if (label === 'VISUAL STYLE') this.segmented(ctx, label, r, ['CLASSIC', 'REALISTIC'], CC.Look.real() ? 1 : 0, (i) => game.setLook(i ? 'real' : 'classic'));
          else if (label === 'GRAPHICS') {
            const g = s.graphics || 'auto', t = game.quality ? game.quality.tier : null;
            this.segmented(ctx, 'GRAPHICS', r, ['AUTO', 'HIGH', 'MEDIUM', 'LOW'], GFX.indexOf(g), (i) => this.setGraphics(game, GFX[i]), g === 'auto' && t ? 'AUTO = ' + { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[t] : '');
          } else if (label === 'VISUAL EFFECTS') this.toggle(ctx, label, r, !!s.postfx, (v) => { s.postfx = v; apply(); });
          else if (label === 'SAMPLE ADS') this.toggle(ctx, label, r, s.ads !== false, (v) => { s.ads = v; apply(); });
          else if (label === 'SHOW FPS') this.toggle(ctx, label, r, !!game.debug, (v) => { game.debug = v; });
          else if (label === 'HOW TO PLAY') this.placeButton(ctx, r, label, this.fitPx([label], r.w * 0.8, r.h * 0.04), () => this.open('help'), { color: '#8fd0ff' });
          else if (label === 'REPLAY TUTORIAL') this.placeButton(ctx, r, label, this.fitPx([label], r.w * 0.8, r.h * 0.04), () => { this.overlay = null; game.tutorial.start(); }, { color: col.green });
        }
        y += hOf(type);
      }
      this.text(ctx, CC.CONFIG.version.toUpperCase(), W / 2, y + rh * 0.1, HH * 0.002, '#707070', { align: 'center' });
      this.scrollEnd(ctx);
    },

    // aide : gestes (écran tactile) ou touches (ordinateur)
    drawHelp(ctx, game, W, H) {
      this.dim(ctx, W, H, 1);
      const col = CC.CONFIG.hud.colors, T = -(this.offsetY || 0), HH = this.fullH || H, mt = this.minTap(), touch = this.isTouch();
      this.backButton(ctx, W * 0.025, T + HH * 0.012, mt);
      this.text(ctx, 'HOW TO PLAY', W / 2, T + HH * 0.012 + (mt - HH * 0.0065 * 7) / 2, this.fitPx(['HOW TO PLAY'], W * 0.5, HH * 0.0065), col.white, { align: 'center', skew: -0.2 });
      const TOUCH = [
        ['TAP', 'FIRE THE ROCKET, OR RESPAWN AFTER A CRASH'],
        ['DRAG', 'STEER THE ROCKET IN FLIGHT'],
        ['HOLD', 'BOOST: THE ROCKET ACCELERATES AND BURNS FUEL'],
        ['SCREEN EDGE', 'FINGER ON THE LEFT OR RIGHT EDGE: ENDLESS TURN'],
        ['GRAZE THE WALLS', 'EARNS STYLE (AND FUEL IN CLASSIC)'],
        ['PAUSE BUTTON', 'TOP RIGHT DURING A RUN'],
      ];
      const PC = [
        ['W A S D', 'STEER (Z Q S D AND ARROWS WORK TOO)'], ['SPACE', 'BOOST (HOLD)'], ['MOUSE', 'AIM, LEFT CLICK TO FIRE'],
        ['RIGHT CLICK', 'GRAPPLING HOOK (HOLD)'], ['SHIFT', 'RETRO ROCKETS: BRAKE (HOLD)'], ['R', 'RESTART'], ['ESC', 'PAUSE'], ['H', 'HIDE THE HUD'],
      ];
      const list = touch ? TOUCH : PC.concat([['', ''], ['ON MOBILE', '']]).concat(TOUCH);
      const top = T + mt + HH * 0.03, foot = mt * 1.2, area = { x: 0, y: top, w: W, h: T + HH - top - foot - HH * 0.04 };
      const x0 = W * 0.06, w = W * 0.88, px = this.fitPx(['0123456789012345678901234'], w * (this.portrait ? 0.9 : 0.5), HH * 0.0034), gap = px * 4;
      // mise en page : étiquette jaune au-dessus, description sous elle (lisible en portrait étroit)
      const blocks = list.map(([a, b]) => ({ a, lines: b ? this.wrap(b, px, w) : [] }));
      const total = blocks.reduce((t, b) => t + (b.a ? px * 9 : 0) + b.lines.length * px * 9 + gap, 0);
      let y = top - this.scrollBegin(ctx, 'help', area, total);
      for (const b of blocks) {
        if (b.a) { this.text(ctx, b.a, x0, y, px, b.lines.length ? col.yellow : col.white, {}); y += px * 9; }
        for (const l of b.lines) { this.text(ctx, l, x0, y, px, '#dcdcdc', {}); y += px * 9; }
        y += gap;
      }
      this.scrollEnd(ctx);
      const bp = this.fitPx(['REPLAY TUTORIAL'], W * 0.7, foot * 0.04);
      this.placeButton(ctx, { x: W * 0.06, y: T + HH - foot - HH * 0.02, w: W * 0.88, h: foot }, 'REPLAY TUTORIAL', bp, () => { this.overlay = null; game.tutorial.start(); }, { color: col.green });
    },
  });
})();
