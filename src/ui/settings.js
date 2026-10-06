/* Réglages et aide (v033-ux). Remplacent l'ancien écran « SETTINGS » (flèches < > minuscules, ouvert seulement par la touche Tab)
 * et la liste des touches (F1). Accessibles au doigt : engrenage du menu d'accueil, bouton REGLAGES de la pause.
 * Liste verticale qui défile : curseurs (sons, sensibilité), interrupteurs, choix multiples (vibration, graphismes). */
(function () {
  const U = CC.U;
  const GFX = ['auto', 'high', 'medium', 'low'], VIB = ['OFF', 'LEGERE', 'MOYENNE', 'FORTE'];

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
      this.text(ctx, 'REGLAGES', W / 2, T + HH * 0.012 + (mt - HH * 0.0075 * 7) / 2, this.fitPx(['REGLAGES'], W * 0.4, HH * 0.0075), col.white, { align: 'center', skew: -0.2 });
      const top = T + mt + HH * 0.03, area = { x: 0, y: top, w: W, h: T + HH - top };
      const rh = Math.max(mt * 1.2, HH * 0.075), rh2 = mt * 1.15 + 2.2 * this.pixelRatio() * 11, gap = rh * 0.16, head = rh * 0.7;
      const apply = () => game.applySettings();
      const level = s.vibration !== undefined ? s.vibration : 2;
      // contenu : [type, hauteur] dans l'ordre, pour connaître la hauteur totale avant de dessiner
      const rows = [
        ['h', 'SON'], ['slider', 'EFFETS SONORES'], ['slider', 'MUSIQUE'],
        ['h', 'VIBRATION'], ['seg', 'INTENSITE'],
        ['h', 'COMMANDES'], ['slider', 'SENSIBILITE'], ['toggle', 'INVERSER HAUT / BAS'],
        ['h', 'AFFICHAGE'], ['seg', 'GRAPHISMES'], ['toggle', 'EFFETS VISUELS'],
        ['h', 'AUTRES'], ['toggle', 'PUBS D\'EXEMPLE'], ['toggle', 'AFFICHER LES FPS'],
        ['btn', 'COMMENT JOUER'], ['btn', 'REVOIR LE TUTORIEL'],
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
          } else if (label === 'EFFETS SONORES') this.slider(ctx, label, r, s.sfx, (v) => { s.sfx = Math.round(v * 20) / 20; game.audio.setVolumes(CC.CONFIG.audio.master, s.music, s.sfx); }, Math.round(s.sfx * 100) + '%', apply);
          else if (label === 'MUSIQUE') this.slider(ctx, label, r, s.music, (v) => { s.music = Math.round(v * 20) / 20; game.audio.setVolumes(CC.CONFIG.audio.master, s.music, s.sfx); }, Math.round(s.music * 100) + '%', apply);
          else if (label === 'INTENSITE') {
            this.segmented(ctx, 'INTENSITE', r, VIB, level, (i) => {
              s.vibration = i; if (CC.Haptics) { CC.Haptics.setLevel(i); CC.Haptics.medium(); } apply();
            }, CC.Haptics && CC.Haptics.supported ? '' : 'NON DISPO. ICI');
          } else if (label === 'SENSIBILITE') {
            if (touch) this.slider(ctx, label, r, U.clamp((s.touchSens - 0.4) / 1.8, 0, 1), (v) => { s.touchSens = Math.round((0.4 + v * 1.8) * 20) / 20; }, Math.round(s.touchSens * 100) + '%', apply);
            else this.slider(ctx, label, r, U.clamp((s.sensitivity - 0.0004) / 0.0056, 0, 1), (v) => { s.sensitivity = Math.round((0.0004 + v * 0.0056) * 20000) / 20000; }, U.formatDec(s.sensitivity * 1000, 1), apply);
          } else if (label === 'INVERSER HAUT / BAS') this.toggle(ctx, label, r, !!s.invertY, (v) => { s.invertY = v; apply(); });
          else if (label === 'GRAPHISMES') {
            const g = s.graphics || 'auto', t = game.quality ? game.quality.tier : null;
            this.segmented(ctx, 'GRAPHISMES', r, ['AUTO', 'HAUT', 'MOYEN', 'BAS'], GFX.indexOf(g), (i) => this.setGraphics(game, GFX[i]), g === 'auto' && t ? 'AUTO = ' + { high: 'HAUT', medium: 'MOYEN', low: 'BAS' }[t] : '');
          } else if (label === 'EFFETS VISUELS') this.toggle(ctx, label, r, !!s.postfx, (v) => { s.postfx = v; apply(); });
          else if (label === 'PUBS D\'EXEMPLE') this.toggle(ctx, label, r, s.ads !== false, (v) => { s.ads = v; apply(); });
          else if (label === 'AFFICHER LES FPS') this.toggle(ctx, label, r, !!game.debug, (v) => { game.debug = v; });
          else if (label === 'COMMENT JOUER') this.placeButton(ctx, r, label, this.fitPx([label], r.w * 0.8, r.h * 0.04), () => this.open('help'), { color: '#8fd0ff' });
          else if (label === 'REVOIR LE TUTORIEL') this.placeButton(ctx, r, label, this.fitPx([label], r.w * 0.8, r.h * 0.04), () => { this.overlay = null; game.tutorial.start(); }, { color: col.green });
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
      this.text(ctx, 'COMMENT JOUER', W / 2, T + HH * 0.012 + (mt - HH * 0.0065 * 7) / 2, this.fitPx(['COMMENT JOUER'], W * 0.5, HH * 0.0065), col.white, { align: 'center', skew: -0.2 });
      const TOUCH = [
        ['TOUCHER', 'TIRER LA ROQUETTE, OU REAPPARAITRE APRES UN CRASH'],
        ['GLISSER', 'DIRIGER LA ROQUETTE EN VOL'],
        ['DOIGT TENU', 'BOOST : LA ROQUETTE ACCELERE ET BRULE DE L\'ESSENCE'],
        ['BORD DE L\'ECRAN', 'DOIGT SUR LE BORD GAUCHE OU DROIT : VIRAGE SANS FIN'],
        ['FROLER LES MURS', 'GAGNE DU STYLE (ET DE L\'ESSENCE EN CLASSIQUE)'],
        ['BOUTON PAUSE', 'EN HAUT A DROITE PENDANT LA PARTIE'],
      ];
      const PC = [
        ['W A S D', 'PILOTER (Z Q S D ET FLECHES AUSSI)'], ['ESPACE', 'BOOST (MAINTENIR)'], ['SOURIS', 'VISER, CLIC GAUCHE POUR TIRER'],
        ['CLIC DROIT', 'GRAPPIN (MAINTENIR)'], ['MAJ', 'RETRO-FUSEES : FREINER (MAINTENIR)'], ['R', 'RECOMMENCER'], ['ECHAP', 'PAUSE'], ['H', 'MASQUER L\'INTERFACE'],
      ];
      const list = touch ? TOUCH : PC.concat([['', ''], ['SUR MOBILE', '']]).concat(TOUCH);
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
      const bp = this.fitPx(['REVOIR LE TUTORIEL'], W * 0.7, foot * 0.04);
      this.placeButton(ctx, { x: W * 0.06, y: T + HH - foot - HH * 0.02, w: W * 0.88, h: foot }, 'REVOIR LE TUTORIEL', bp, () => { this.overlay = null; game.tutorial.start(); }, { color: col.green });
    },
  });
})();
