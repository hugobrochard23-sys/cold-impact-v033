/* Boutique de cosmétiques (v007, refaite en v031, repensée pour le tactile en v033-ux).
 * Principe : un grand aperçu 3D tournant du cosmétique choisi en haut (nom, rareté, état, boutons d'action), des onglets de
 * rareté, puis une grille de grandes cartes qui défile verticalement. Toucher une carte la choisit (aperçu immédiat, sans
 * rien acheter ni équiper) ; l'action se fait avec les gros boutons de l'aperçu :
 *   possédé       → ÉQUIPER (puis « ÉQUIPÉE ✓ »)
 *   à débloquer   → ACHETER (2,29 € : lien de paiement Stripe, avec confirmation) ou PUB 1 MIN (une minute de publicité)
 * Un déblocage déclenche une célébration plein écran (confettis, fanfare, vibration forte). Équiper : éclat, son, vibration.
 * Données : CC.Skins (src/entities/skins.js). Aperçus 3D : CC.Thumbs (thumbs.js). Dessin : CC.UI (menu.js, widgets.js). */
(function () {
  const U = CC.U;
  const TIER_COLOR = { base: '#9a9a9a', common: '#e8e8e8', rare: '#fdfd02', ultra: '#ff7c1f' };
  const TIER_NAME = { base: 'DE BASE', common: 'COMMUN', rare: 'RARE', ultra: 'ULTRA RARE' };
  // catégories : pour l'instant les seules apparences de roquette (toutes les fiches de CC.Skins), filtrées par rareté.
  // Une nouvelle catégorie (flammes, thèmes…) = une entrée ici + sa liste de fiches.
  const TABS = [
    { id: 'all', label: 'TOUS', color: '#f4f4f4' }, { id: 'common', label: 'COMMUN', color: TIER_COLOR.common },
    { id: 'rare', label: 'RARE', color: TIER_COLOR.rare }, { id: 'ultra', label: 'ULTRA', color: TIER_COLOR.ultra },
  ];
  const CONFETTI = ['#fdfd02', '#ff7c1f', '#56ff5a', '#4ab0ff', '#ff3b2e', '#f4f4f4'];

  class Shop {
    constructor(ui) {
      this.ui = ui; this.tab = 'all'; this.sel = null; this.cel = null; this.pop = null;
      this.thumbs = new CC.Thumbs(ui.game);
    }

    onOpen(game) { this.sel = game.save.equipped; this.cel = null; }
    items() { return CC.Skins.list.filter((s) => this.tab === 'all' || s.tier === this.tab); }
    back() { if (this.cel) { this.cel = null; return true; } return false; }

    // image d'un cosmétique (ou son icône 2D de secours le temps que l'aperçu 3D soit prêt)
    drawPreview(ctx, s, cx, cy, size, i) {
      let img = this.thumbs.frame(s, i);
      if (!img && i) img = this.thumbs.frame(s, 0);
      if (img) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); ctx.restore(); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - size * 0.3, cy - size * 0.04, size * 0.6, size * 0.08); }
    }

    draw(ctx, game, W, H) {
      const ui = this.ui, col = CC.CONFIG.hud.colors, T = -(ui.offsetY || 0), HH = ui.fullH || H, P = ui.portrait || W < HH, mt = ui.minTap();
      const save = game.save, owned = (id) => !!save.owned[id];
      if (!this.sel || !CC.Skins.byId[this.sel]) this.sel = save.equipped;
      const sel = CC.Skins.byId[this.sel];
      if (this.heroId !== this.sel) { this.heroId = this.sel; this.thumbs.keepOnly(this.sel); }
      ui.needFrames();
      // fond : léger dégradé bleuté
      const bg = ctx.createLinearGradient(0, T, 0, T + HH); bg.addColorStop(0, '#111a2c'); bg.addColorStop(1, '#06070b');
      ctx.fillStyle = bg; ctx.fillRect(-ui.safeL - 2, T - ui.safeT - 2, W + ui.safeL + ui.safeR + 4, HH + ui.safeT + ui.safeB + 4);
      const sx = W * 0.025, gap = W * 0.025, hdrY = T + HH * 0.012;
      // en-tête : retour, titre, collection
      ui.backButton(ctx, sx, hdrY, mt);
      const own = CC.Skins.list.filter((s) => owned(s.id)).length, count = own + '/' + CC.Skins.list.length;
      const tp = ui.fitPx(['BOUTIQUE'], W * 0.34, HH * 0.0075), ty = hdrY + (mt - tp * 7) / 2;
      ui.text(ctx, 'BOUTIQUE', W / 2, ty, tp, col.white, { align: 'center', skew: -0.2 });
      const cp = ui.fitPx(['00/00'], W * 0.16, HH * 0.0032);
      ui.text(ctx, count, W - sx - cp * 7.5, hdrY + (mt - cp * 7) / 2, cp, col.yellow, { align: 'right' });
      ui.star(ctx, W - sx - cp * 3, hdrY + mt / 2, cp * 3, true, col.yellow);

      // zones : portrait → aperçu en haut puis grille ; paysage → aperçu à gauche, grille à droite
      const top = hdrY + mt + HH * 0.012;
      const heroR = P ? { x: sx, y: top, w: W - sx * 2, h: HH * (HH < 720 ? 0.385 : 0.33) } : { x: sx, y: top, w: W * 0.37, h: T + HH - top - HH * 0.02 };
      const tabsR = P ? { x: sx, y: heroR.y + heroR.h + HH * 0.012, w: W - sx * 2, h: mt } : { x: heroR.x + heroR.w + gap, y: top, w: W - heroR.w - sx * 2 - gap, h: mt };
      const gridR = P ? { x: 0, y: tabsR.y + tabsR.h + HH * 0.008, w: W, h: T + HH - (tabsR.y + tabsR.h + HH * 0.008) } : { x: tabsR.x, y: tabsR.y + tabsR.h + HH * 0.01, w: tabsR.w, h: T + HH - (tabsR.y + tabsR.h + HH * 0.01) };

      this.drawHero(ctx, game, sel, heroR, P);
      ui.tabs(ctx, TABS, tabsR, this.tab, (id) => { this.tab = id; ui.scrolls.shop && (ui.scrolls.shop.y = 0); });

      // grille de cartes
      const items = this.items(), cols = P ? (W > 600 ? 3 : 2) : (W > 1000 ? 4 : 3), pad = gap, cw = (gridR.w - pad * (cols + 1)) / cols, ch = cw * (P ? 1.08 : 1.0);
      const rows = Math.ceil(items.length / cols), contentH = rows * (ch + pad) + pad;
      const scroll = ui.scrollBegin(ctx, 'shop', gridR, contentH);
      items.forEach((s, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const rect = { x: gridR.x + pad + c * (cw + pad), y: gridR.y + pad + r * (ch + pad) - scroll, w: cw, h: ch };
        if (rect.y + rect.h < gridR.y || rect.y > gridR.y + gridR.h) return;   // hors écran : ni dessin ni aperçu à calculer
        this.drawCard(ctx, game, s, rect);
      });
      ui.scrollEnd(ctx);
      this.thumbs.process(2);
      if (this.cel) this.drawCelebration(ctx, game, W, HH, T);
    }
  }

  Object.assign(Shop.prototype, {
    // carte de la grille : aperçu, nom, rareté, état (équipé / possédé / cadenas + prix)
    drawCard(ctx, game, s, r0) {
      const ui = this.ui, col = CC.CONFIG.hud.colors, owned = !!game.save.owned[s.id], eq = game.save.equipped === s.id, isSel = this.sel === s.id;
      const st = ui.hitRect(r0, () => { this.sel = s.id; }, { fx: 'select' });
      let { x, y, w, h } = r0;
      if (st.pressed) { x += w * 0.03; y += h * 0.03; w *= 0.94; h *= 0.94; }
      const tc = TIER_COLOR[s.tier], pop = this.pop && this.pop.id === s.id ? Math.max(0, 1 - this.pop.t / 0.5) : 0;
      ctx.fillStyle = eq ? 'rgba(253,253,2,0.10)' : isSel ? 'rgba(143,208,255,0.12)' : 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = tc; ctx.globalAlpha = s.tier === 'base' ? 0.5 : 0.9; ctx.fillRect(x, y, w, Math.max(3, h * 0.025)); ctx.globalAlpha = 1;   // bandeau de rareté
      ctx.strokeStyle = eq ? col.yellow : isSel ? '#8fd0ff' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = Math.max(2, h * (eq || isSel ? 0.018 : 0.01)); ctx.strokeRect(x, y, w, h);
      const ps = Math.min(w * 0.92, h * 0.6);
      ctx.save(); if (!owned) ctx.globalAlpha = 0.72; this.drawPreview(ctx, s, x + w / 2, y + h * 0.1 + ps / 2, ps, 0); ctx.restore();
      const maxPx = h * 0.0125, name = ui.fitPx([s.name], w * 0.9, maxPx) >= maxPx * 0.7 ? s.name : (s.short || s.name);
      const npx = ui.fitPx([name], w * 0.9, maxPx), spx = Math.min(npx * 0.8, ui.fitPx(['2,29 EUR'], w * 0.6, h * 0.02));
      ui.text(ctx, name, x + w / 2, y + h * 0.74, npx, tc, { align: 'center' });
      const sub = eq ? 'EQUIPEE' : owned ? 'POSSEDEE' : CC.Skins.formatPrice(s.price), sc = eq ? col.yellow : owned ? col.green : '#e8e8e8';
      ui.text(ctx, sub, x + w / 2, y + h * 0.74 + npx * 9, spx, sc, { align: 'center' });
      // pastille d'état : coche jaune (équipée), coche verte (possédée), cadenas (à débloquer)
      const br = Math.min(w, h) * 0.085, bx = x + w - br * 1.6, by = y + br * 2 + h * 0.03;
      if (eq || owned) { ctx.fillStyle = eq ? col.yellow : '#2f9a3a'; ctx.beginPath(); ctx.arc(bx, by, br * (1 + pop * 0.5), 0, Math.PI * 2); ctx.fill(); ui.iconCheck(ctx, bx, by, br * 0.55, eq ? '#14141a' : '#ffffff'); }
      else { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ui.iconLock(ctx, bx, by + br * 0.1, br * 0.6, '#cfcfcf'); }
      if (pop) { ctx.globalAlpha = pop * 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
    },

    // grand aperçu du cosmétique choisi : image tournante, nom, rareté, état, boutons d'action
    drawHero(ctx, game, s, R, P) {
      const ui = this.ui, col = CC.CONFIG.hud.colors, save = game.save, owned = !!save.owned[s.id], eq = save.equipped === s.id;
      const tc = TIER_COLOR[s.tier], mt = ui.minTap();
      if (this.pop) { this.pop.t += ui.dt; if (this.pop.t > 0.6) this.pop = null; }
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.strokeStyle = tc; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(2, R.h * 0.008); ctx.strokeRect(R.x, R.y, R.w, R.h); ctx.globalAlpha = 1;
      // mise en page de bas en haut : boutons, état, nom ; l'aperçu prend la place restante
      const btnH = mt * 1.2, pad = R.h * 0.03, by = R.y + R.h - btnH - pad, bx = R.x + R.w * 0.04, bw = R.w * 0.92;
      const npx = ui.fitPx([s.name], R.w * 0.9, R.h * 0.0115), state = eq ? 'EQUIPEE' : owned ? 'POSSEDEE' : 'A DEBLOQUER', sc = eq ? col.yellow : owned ? col.green : '#e8e8e8';
      const line = TIER_NAME[s.tier] + '  -  ' + state, lp = ui.fitPx([line], R.w * 0.9, npx * 0.62);
      const lineY = by - R.h * 0.035 - lp * 7, ny = lineY - R.h * 0.022 - npx * 7;
      const ps = Math.max(R.h * 0.2, Math.min(R.w * 0.62, ny - (R.y + pad) - R.h * 0.01)), pcx = R.x + R.w / 2, pcy = R.y + pad + ps / 2;
      // halo derrière la roquette, couleur de la rareté
      const gl = ctx.createRadialGradient(pcx, pcy, ps * 0.05, pcx, pcy, ps * 0.62);
      gl.addColorStop(0, tc + '55'); gl.addColorStop(1, tc + '00'); ctx.fillStyle = gl; ctx.fillRect(R.x, R.y, R.w, R.h * 0.8);
      // plateau tournant : on demande les 24 images (la première prête s'affiche tout de suite)
      const N = CC.Thumbs.FRAMES;
      for (let i = N - 1; i >= 1; i--) this.thumbs.frame(s, i);
      let idx = Math.floor(ui.t * 9) % N, img = this.thumbs.frame(s, idx);
      if (!img) { this.lastIdx = this.lastIdx && this.thumbs.cache[s.id + ':' + this.lastIdx] ? this.lastIdx : 0; idx = this.lastIdx; } else this.lastIdx = idx;
      const bob = Math.sin(ui.t * 2.2) * ps * 0.012;
      this.drawPreview(ctx, s, pcx, pcy + bob, ps, idx);
      // nom, rareté, état
      ui.text(ctx, s.name, pcx, ny, npx, tc, { align: 'center', skew: -0.12 });
      const k = this.pop && this.pop.id === s.id ? 1 + Math.sin(Math.min(1, this.pop.t / 0.35) * Math.PI) * 0.12 : 1;
      ctx.save(); ctx.translate(pcx, lineY + lp * 3.5); ctx.scale(k, k);
      ui.text(ctx, line, 0, -lp * 3.5, lp, sc, { align: 'center' }); ctx.restore();
      // boutons d'action
      if (owned) {
        const label = eq ? 'EQUIPEE' : 'EQUIPER', bp = ui.fitPx([label], bw * 0.6, btnH * 0.05);
        if (eq) {
          const face = ui.placeButton(ctx, { x: bx, y: by, w: bw, h: btnH }, null, 0, null, { color: col.green, fx: 'none' });
          const tw = CC.Font.measure(label, bp);
          ui.text(ctx, label, face.x + face.w / 2 + bp * 4, face.y + (face.h - bp * 7) / 2, bp, col.green, { align: 'center' });
          ui.iconCheck(ctx, face.x + face.w / 2 - tw / 2 - bp * 2, face.y + face.h / 2, bp * 2.2, col.green);
        } else ui.placeButton(ctx, { x: bx, y: by, w: bw, h: btnH }, label, bp, () => this.equip(game, s.id), { color: col.yellow, solid: true, fx: 'equip', pulse: false });
      } else {
        const hw = (bw - R.w * 0.03) / 2, price = CC.Skins.formatPrice(s.price);
        const bp = ui.fitPx(['ACHETER', 'PUB 1 MIN'], hw * 0.86, btnH * 0.046), sp = ui.fitPx([price, 'GRATUIT'], hw * 0.8, bp * 0.7);
        const a = ui.placeButton(ctx, { x: bx, y: by, w: hw, h: btnH }, null, 0, () => this.buy(game, s.id), { color: col.yellow, solid: true, fx: 'primary' });
        ui.text(ctx, 'ACHETER', a.x + a.w / 2, a.y + a.h * 0.5 - bp * 8, bp, '#14141a', { align: 'center', outline: null });
        ui.text(ctx, price, a.x + a.w / 2, a.y + a.h * 0.5 + bp * 1.2, sp, '#3a3a10', { align: 'center', outline: null });
        const b = ui.placeButton(ctx, { x: bx + hw + R.w * 0.03, y: by, w: hw, h: btnH }, null, 0, () => this.watch(game, s.id), { color: '#8fd0ff', fx: 'primary' });
        ui.text(ctx, 'PUB 1 MIN', b.x + b.w / 2, b.y + b.h * 0.5 - bp * 8, bp, '#8fd0ff', { align: 'center' });
        ui.text(ctx, 'GRATUIT', b.x + b.w / 2, b.y + b.h * 0.5 + bp * 1.2, sp, '#cfe8ff', { align: 'center' });
      }
    },

    equip(game, id) {
      if (!game.equipCosmetic(id)) return;
      this.pop = { id, t: 0 };
    },

    // Paiement : confirmation, puis redirection vers le lien Stripe (même onglet : au retour, Stripe renvoie vers le jeu qui
    // débloque le cosmétique — voir CC.Shop.handleReturn). Le cosmétique voyage dans utm_content (Stripe le recopie dans
    // l'adresse de retour) et dans client_reference_id (visible dans le Dashboard et les webhooks).
    buy(game, id) {
      const s = CC.Skins.byId[id], ui = this.ui;
      ui.confirm({ title: 'ACHETER ' + (s.short || s.name) + ' ?', lines: [CC.Skins.formatPrice(s.price) + ' - PAIEMENT EN LIGNE SECURISE', 'TU REVIENDRAS AU JEU APRES LE PAIEMENT'], yes: 'PAYER', no: 'ANNULER', color: '#fdfd02', onYes: () => this.pay(game, id) });
    },
    pay(game, id) {
      const link = CC.CONFIG.shop.stripeLink;
      if (!link) { this.ui.feedback('denied'); this.ui.toast('PAIEMENT PAS ENCORE ACTIVE (LIEN STRIPE A RENSEIGNER)', '#ff9a3a', 3.4); return; }
      game.save.pendingPurchase = id; game.writeSave();
      const url = link + (link.indexOf('?') < 0 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(id) + '&utm_content=' + encodeURIComponent(id) + '&utm_source=coldimpact';
      game.telemetry.event('purchase', { id });
      if (window.top === window) window.location.href = url;          // page du jeu : même onglet, retour automatique
      else { const w = window.open(url, '_blank'); if (!w) this.ui.toast('OUVRE LE JEU DANS UN NAVIGATEUR POUR PAYER', '#ff9a3a', 3.4); }   // jeu intégré dans une autre page
    },

    // Publicité : une minute entière (annonces de 15 s enchaînées) ; fermer avant la fin ne débloque rien
    watch(game, id) {
      game.ads.rewarded(() => this.unlock(game, id), CC.CONFIG.shop.adSeconds);
    },

    // déblocage (publicité regardée ou paiement revenu) : équipé aussitôt, puis célébration
    unlock(game, id) {
      if (!game.unlockCosmetic(id)) return;
      this.sel = id; this.celebrate(id);
    },
    celebrate(id) {
      const ui = this.ui, s = CC.Skins.byId[id], pr = ui.pixelRatio(), parts = [];
      this.cel = { id, t: 0, parts };
      const W = ui.game.hudCanvas.width, H = ui.game.hudCanvas.height;
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, v = (180 + Math.random() * 520) * pr;
        parts.push({ x: W / 2, y: H * 0.38, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 420 * pr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: (5 + Math.random() * 7) * pr, c: Math.random() < 0.4 ? TIER_COLOR[s.tier] : CONFETTI[i % CONFETTI.length] });
      }
      ui.feedback('unlock');
    },

    drawCelebration(ctx, game, W, HH, T) {
      const ui = this.ui, c = this.cel, s = CC.Skins.byId[c.id], tc = TIER_COLOR[s.tier], col = CC.CONFIG.hud.colors, mt = ui.minTap();
      c.t += ui.dt; ui.needFrames();
      ui.buttons = []; ui.regions = [];
      ui.dim(ctx, W, HH, Math.min(0.86, c.t * 4));
      ui.buttons.push({ x: -ui.safeL - 5, y: T - ui.safeT - 5, w: W + 4000, h: HH + 4000, idx: ui.buttons.length, action: () => { if (c.t > 0.7) this.cel = null; }, fx: 'back' });
      const k = Math.min(1, c.t / 0.5), bounce = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 - (1 - k) * 0.6 : 1 + Math.sin(c.t * 3) * 0.015;
      const ps = Math.min(W * 0.78, HH * 0.34), cx = W / 2, cy = T + HH * 0.36;
      const gl = ctx.createRadialGradient(cx, cy, ps * 0.05, cx, cy, ps * 0.7); gl.addColorStop(0, tc + '88'); gl.addColorStop(1, tc + '00'); ctx.fillStyle = gl; ctx.fillRect(0, T, W, HH);
      this.drawPreview(ctx, s, cx, cy, ps * bounce, Math.floor(c.t * 9) % CC.Thumbs.FRAMES);
      const tp = ui.fitPx(['DEBLOQUE !'], W * 0.86, HH * 0.0105), tk = U.smooth(0, 0.35, c.t);
      ctx.save(); ctx.translate(cx, T + HH * 0.13); ctx.scale(0.4 + tk * 0.6, 0.4 + tk * 0.6); ctx.globalAlpha = tk;
      ui.text(ctx, 'DEBLOQUE !', 0, -tp * 3.5, tp, col.yellow, { align: 'center', skew: -0.2 }); ctx.restore();
      const np = ui.fitPx([s.name], W * 0.86, HH * 0.0072);
      ui.text(ctx, s.name, cx, T + HH * 0.6, np, tc, { align: 'center', skew: -0.12 });
      ui.text(ctx, TIER_NAME[s.tier] + '  -  EQUIPEE', cx, T + HH * 0.6 + np * 10, ui.fitPx([TIER_NAME[s.tier] + '  -  EQUIPEE'], W * 0.86, np * 0.55), col.green, { align: 'center' });
      // confettis : gravité, rotation, disparition en bas
      const g = 1500 * ui.pixelRatio();
      for (const p of c.parts) {
        p.vy += g * ui.dt; p.x += p.vx * ui.dt; p.y += p.vy * ui.dt; p.r += p.vr * ui.dt;
        if (p.y > ui.game.hudCanvas.height + 40) continue;
        ctx.save(); ctx.translate(p.x - ui.safeL, p.y - ui.safeT - (ui.offsetY || 0)); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      const bh = mt * 1.3, bp = ui.fitPx(['SUPER !'], W * 0.5, bh * 0.05), bw = W * 0.7;
      if (c.t > 0.7) ui.placeButton(ctx, { x: (W - bw) / 2, y: T + HH - bh - HH * 0.05, w: bw, h: bh }, 'SUPER !', bp, () => { this.cel = null; }, { color: col.yellow, solid: true, fx: 'primary', pulse: true });
    },
  });

  /* Retour du paiement Stripe : l'adresse contient ?paid=1 (réglé dans le Dashboard) et utm_content=<cosmétique>. Le
   * cosmétique est débloqué et équipé, puis ces paramètres sont retirés de l'adresse (un rechargement ne rejoue rien).
   * LIMITE : sans serveur, le jeu ne peut pas vérifier le paiement auprès de Stripe (il faudrait vérifier session_id avec la
   * clé secrète) ; quelqu'un qui recopie l'adresse de retour obtient le cosmétique. Renvoie l'identifiant débloqué, ou null. */
  Shop.handleReturn = function (game) {
    const P = new URLSearchParams(location.search);
    if (P.get('paid') !== '1') return null;
    const id = P.get('utm_content') || game.save.pendingPurchase;
    const s = id && CC.Skins.byId[id];
    ['paid', 'session_id', 'utm_content', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term'].forEach((k) => P.delete(k));
    try { history.replaceState(null, '', location.pathname + (P.toString() ? '?' + P : '') + location.hash); } catch (e) { /* adresse inchangée */ }
    if (!s) return null;
    delete game.save.pendingPurchase;
    game.unlockCosmetic(id);
    game.writeSave();
    return id;
  };

  // ouvre la boutique (depuis le menu, ou au retour d'un paiement avec la célébration du cosmétique débloqué)
  CC.UI.prototype.openShop = function (celebrateId) {
    if (!this.shop) this.shop = new CC.Shop(this);
    this.shop.onOpen(this.game);
    this.overlay = null; this.open('shop');
    if (celebrateId) { this.shop.sel = celebrateId; this.shop.celebrate(celebrateId); }
  };

  CC.Shop = Shop;
})();
