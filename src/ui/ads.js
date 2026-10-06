/* Publicités d'EXEMPLE (v030) — aucune régie, aucun lien, aucune donnée envoyée : des emplacements factices qui montrent
 * où et comment des publicités s'intégreraient au jeu. Annonceurs inventés, mention « SAMPLE AD » sur chaque visuel.
 *  - bannière : bas du menu principal (jamais en partie) ;
 *  - interstitielle : en quittant l'écran de résultats, au plus une fois tous les `interstitialEvery` niveaux terminés
 *    et `minGap` s, jamais après le tout premier niveau ; fermable après `skipAfter` s ;
 *  - récompensée : facultative, sur l'écran de résultats (« WATCH AD: CASH X2 »), `rewardTime` s à regarder.
 * Réglages : CC.CONFIG.ads ; le joueur peut les couper (SAMPLE ADS: OFF). Désactivées au banc de test. */
(function () {
  const U = CC.U;
  // annonceurs fictifs (dessinés par le code, aucune image externe)
  const CREATIVES = [
    { brand: 'SKYLINE SODA', line: 'THE FIZZ THAT FLIES', bg: '#1f5fa8', fg: '#ffffff', accent: '#ffd23a', art: 'can' },
    { brand: 'TURBO KART LEGENDS', line: 'NEW SEASON - PLAY FREE', bg: '#b8321f', fg: '#fff2d0', accent: '#2ae07a', art: 'kart' },
    { brand: 'PIXEL PIZZA', line: 'HOT IN 15 MIN OR IT IS FREE', bg: '#2a7a3a', fg: '#fff8e0', accent: '#ff7a1a', art: 'pizza' },
    { brand: 'NOVA HEADPHONES', line: 'HEAR EVERY EXPLOSION', bg: '#23202e', fg: '#e8e0ff', accent: '#ff3aa8', art: 'phones' },
  ];

  class Ads {
    constructor(game) {
      this.game = game; this.cfg = CC.CONFIG.ads;
      this.ends = 0; this.lastAd = -Infinity; this.cur = null; this.bannerI = 0; this.bannerT = 0;
    }
    enabled() { const g = this.game; return this.cfg.enabled && !g.testMode && g.settings.ads !== false; }
    now() { return performance.now() / 1000; }

    // fin de niveau (écran de résultats)
    onLevelEnd() { this.ends++; }

    // en quittant l'écran de résultats : interstitielle éventuelle, puis `then`
    beforeContinue(then) {
      const due = this.enabled() && this.ends >= this.cfg.interstitialEvery && this.ends % this.cfg.interstitialEvery === 0 &&
        this.now() - this.lastAd > this.cfg.minGap && !this.shownFor(this.ends);
      if (!due) { then(); return; }
      this.shown = this.ends;
      this.open('interstitial', then);
    }
    shownFor(n) { return this.shown === n; }

    // récompensée : `grant` appelé seulement si la publicité a été regardée jusqu'au bout ; `seconds` : durée (v031 : une
    // minute pour débloquer un cosmétique, faite d'annonces de `adSegment` s qui s'enchaînent)
    rewarded(grant, seconds) { this.open('rewarded', null, grant, seconds); }

    open(kind, then, grant, seconds) {
      const g = this.game;
      const c0 = Math.floor(Math.random() * CREATIVES.length);
      this.cur = { kind, t: 0, then, grant, done: false, seconds, c0, c: CREATIVES[c0], back: g.ui.overlay };   // v031 : on revient où l'on était (boutique)
      this.lastAd = this.now();
      g.ui.overlay = 'ad';
      this.duck(true);
      g.telemetry.event('ad', { kind });
    }
    close(watched) {
      const A = this.cur, g = this.game;
      if (!A) return;
      this.cur = null; g.ui.overlay = A.back === 'shop' ? 'shop' : null;
      this.duck(false);
      if (A.kind === 'rewarded' && watched && A.grant) A.grant();
      if (A.then) A.then();
    }
    // musique baissée pendant la publicité (une vraie publicité aurait son propre son)
    duck(on) {
      const a = this.game.audio;
      if (!a.ctx) return;
      a.musicBus.gain.setTargetAtTime(on ? 0 : this.game.settings.music, a.ctx.currentTime, 0.1);
    }

    update(dt) {
      if (this.cur) this.cur.t += dt;
      this.bannerT += dt;
      if (this.bannerT > this.cfg.bannerCycle) { this.bannerT = 0; this.bannerI = (this.bannerI + 1) % CREATIVES.length; }
    }

    // ---------- dessin (canvas du HUD, police du jeu) ----------
    art(ctx, c, x, y, s) {
      ctx.fillStyle = c.accent;
      if (c.art === 'can') { ctx.fillRect(x - s * 0.3, y - s * 0.55, s * 0.6, s * 1.1); ctx.fillStyle = c.fg; ctx.fillRect(x - s * 0.3, y - s * 0.15, s * 0.6, s * 0.25); ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x - s * 0.24, y - s * 0.62, s * 0.48, s * 0.08); }
      else if (c.art === 'kart') { ctx.fillRect(x - s * 0.6, y - s * 0.1, s * 1.2, s * 0.35); ctx.fillRect(x - s * 0.2, y - s * 0.4, s * 0.4, s * 0.3); ctx.fillStyle = '#111'; for (const dx of [-0.45, 0.45]) ctx.fillRect(x + s * dx - s * 0.15, y + s * 0.2, s * 0.3, s * 0.3); }
      else if (c.art === 'pizza') { ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.4); ctx.lineTo(x + s * 0.55, y - s * 0.4); ctx.lineTo(x, y + s * 0.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c8321f'; for (const [dx, dy] of [[-0.2, -0.2], [0.18, -0.15], [0, 0.15]]) ctx.fillRect(x + s * dx - s * 0.07, y + s * dy - s * 0.07, s * 0.14, s * 0.14); }
      else { ctx.fillRect(x - s * 0.5, y - s * 0.1, s * 0.22, s * 0.5); ctx.fillRect(x + s * 0.28, y - s * 0.1, s * 0.22, s * 0.5); ctx.fillRect(x - s * 0.42, y - s * 0.5, s * 0.84, s * 0.1); ctx.fillRect(x - s * 0.5, y - s * 0.45, s * 0.1, s * 0.4); ctx.fillRect(x + s * 0.4, y - s * 0.45, s * 0.1, s * 0.4); }
    }

    // bannière du menu : x, y, w, h en pixels du canvas
    drawBanner(ctx, ui, x, y, w, h) {
      if (!this.enabled()) return;
      const c = CREATIVES[this.bannerI];
      ctx.fillStyle = c.bg; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = Math.max(1, h * 0.03); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      this.art(ctx, c, x + h * 0.6, y + h * 0.5, h * 0.62);
      // texte à gauche de la vignette « SAMPLE AD » (en haut à droite), police ajustée à la place disponible
      const tw = w - h * 1.3 - h * 1.1, px = Math.min(h * 0.075, tw / CC.Font.measure(c.brand, 1)), px2 = Math.min(px * 0.7, tw / CC.Font.measure(c.line, 1));
      ui.text(ctx, c.brand, x + h * 1.15, y + h * 0.2, px, c.fg, {});
      ui.text(ctx, c.line, x + h * 1.15, y + h * 0.6, px2, c.accent, {});
      const bpx = Math.min(h * 0.03, (h * 0.95) / CC.Font.measure('PUB EXEMPLE', 1));
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + w - h * 1.05, y + h * 0.08, h * 0.97, bpx * 11);
      ui.text(ctx, 'PUB EXEMPLE', x + w - h * 0.56, y + h * 0.08 + bpx * 2, bpx, '#ffffff', { align: 'center' });
    }

    // interstitielle / récompensée : plein écran
    draw(ctx, game, W, H, ui) {
      const A = this.cur;
      if (!A) return;
      const T = -(ui.offsetY || 0), HH = ui.fullH || H, col = CC.CONFIG.hud.colors;
      // v031 : une longue publicité (1 min) enchaîne plusieurs annonces : « AD 2/4 »
      const seg = CC.CONFIG.shop.adSegment, total0 = A.seconds || (A.kind === 'rewarded' ? this.cfg.rewardTime : this.cfg.interstitialTime);
      const nSeg = A.seconds ? Math.max(1, Math.round(total0 / seg)) : 1, iSeg = Math.min(nSeg - 1, Math.floor(A.t / seg));
      if (nSeg > 1) A.c = CREATIVES[(A.c0 + iSeg) % CREATIVES.length];
      const c = A.c;
      ctx.fillStyle = '#060608'; ctx.fillRect(0, T, W, HH);
      const cw = Math.min(W * 0.86, HH * 0.9), ch = Math.min(HH * 0.62, cw * 1.1), cx = (W - cw) / 2, cy = T + HH * 0.12;
      ctx.fillStyle = c.bg; ctx.fillRect(cx, cy, cw, ch);
      this.art(ctx, c, W / 2, cy + ch * 0.36, Math.min(cw, ch) * 0.42);
      const px = ui.fitPx([c.brand], cw * 0.9, ch * 0.012);
      ui.text(ctx, c.brand, W / 2, cy + ch * 0.66, px, c.fg, { align: 'center', skew: -0.15 });
      ui.text(ctx, c.line, W / 2, cy + ch * 0.8, ui.fitPx([c.line], cw * 0.9, px * 0.55), c.accent, { align: 'center' });
      const lab = ui.fitPx(['PUB D\'EXEMPLE - ANNONCEUR FICTIF - AUCUN LIEN'], W * 0.92, Math.max(H * 0.0026, HH * 0.0022));
      ui.text(ctx, 'PUB D\'EXEMPLE - ANNONCEUR FICTIF - AUCUN LIEN', W / 2, cy - HH * 0.035, lab, '#9a9a9a', { align: 'center' });
      // barre de progression + commandes
      const total = total0;
      if (nSeg > 1) ui.text(ctx, 'PUB ' + (iSeg + 1) + '/' + nSeg, cx, cy - HH * 0.07, ui.fitPx(['PUB 1/4'], W * 0.3, Math.max(H * 0.0026, HH * 0.0022)), '#cfcfcf', {});
      const k = U.clamp(A.t / total, 0, 1);
      ctx.fillStyle = '#333'; ctx.fillRect(cx, cy + ch + HH * 0.02, cw, HH * 0.01);
      ctx.fillStyle = col.yellow; ctx.fillRect(cx, cy + ch + HH * 0.02, cw * k, HH * 0.01);
      const by = cy + ch + HH * 0.09, bpx = Math.max(H * 0.0042, HH * 0.0038);
      if (A.kind === 'rewarded') {
        if (A.t >= total) ui.button(ctx, 'RECUPERER LA RECOMPENSE', W / 2, by, ui.fitPx(['RECUPERER LA RECOMPENSE'], W * 0.8, bpx), () => this.close(true), { color: col.yellow, hitW: W * 0.88, fx: 'primary' });
        else {
          ui.text(ctx, 'RECOMPENSE DANS ' + Math.ceil(total - A.t) + ' S', W / 2, by, ui.fitPx(['RECOMPENSE DANS 60 S'], W * 0.9, bpx), '#f4f4f4', { align: 'center' });
          ui.button(ctx, 'FERMER (SANS RECOMPENSE)', W / 2, by + HH * 0.08, ui.fitPx(['FERMER (SANS RECOMPENSE)'], W * 0.8, bpx * 0.7), () => this.close(false), { color: '#9a9a9a', hitW: W * 0.88, fx: 'back' });
        }
      } else {
        const skip = this.cfg.skipAfter;
        if (A.t >= skip || A.t >= total) ui.button(ctx, 'FERMER LA PUB  X', W / 2, by, ui.fitPx(['FERMER LA PUB  X'], W * 0.8, bpx), () => this.close(true), { hitW: W * 0.88, fx: 'back' });
        else ui.text(ctx, 'FERMETURE DANS ' + Math.ceil(skip - A.t) + ' S', W / 2, by, ui.fitPx(['FERMETURE DANS 60 S'], W * 0.9, bpx), '#bdbdbd', { align: 'center' });
        if (A.t >= total) this.close(true);
      }
    }
  }

  CC.Ads = Ads;
})();
