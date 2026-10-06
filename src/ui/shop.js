/* Boutique de cosmétiques (v007, refaite en v031, repensée pour le tactile en v033-ux, habillée en v033-ux2).
 * Principe : un grand aperçu 3D tournant du cosmétique choisi en haut (rareté, état, nom, description, boutons d'action), des
 * onglets de rareté avec leur compteur, puis une grille de grandes cartes qui défile verticalement. Toucher une carte la choisit
 * (aperçu immédiat, sans rien acheter ni équiper) ; l'action se fait avec les gros boutons de l'aperçu :
 *   possédé       → ÉQUIPER (puis « ÉQUIPÉE ✓ »)
 *   à débloquer   → ACHETER (2,29 € : lien de paiement Stripe, avec confirmation) ou PUB 1 MIN (une minute de publicité)
 * Un déblocage déclenche une célébration plein écran (rayons, confettis, fanfare, vibration forte). Équiper : étincelles, son,
 * vibration.
 * Direction artistique : celle du HUD du jeu — aplats, bordures épaisses, crochets de visée dans les angles (comme les repères
 * rouges des cibles), police pixel, jaune / bleu / vert / orange ; la rareté a sa couleur et son nombre d'étoiles.
 * Données : CC.Skins (src/entities/skins.js). Aperçus 3D : CC.Thumbs (thumbs.js). Dessin : CC.UI (menu.js, widgets.js). */
(function () {
  const U = CC.U;
  const TIER_COLOR = { base: '#9a9a9a', common: '#e8e8e8', rare: '#fdfd02', ultra: '#ff7c1f' };
  const TIER_NAME = { base: 'DE BASE', common: 'COMMUN', rare: 'RARE', ultra: 'ULTRA RARE' };
  const TIER_SHORT = { base: 'DE BASE', common: 'COMMUN', rare: 'RARE', ultra: 'ULTRA' };   // étiquettes courtes (pastilles)
  const TIER_STARS = { base: 0, common: 1, rare: 2, ultra: 3 };
  // catégories : pour l'instant les seules apparences de roquette (toutes les fiches de CC.Skins), filtrées par rareté.
  // Une nouvelle catégorie (flammes, thèmes…) = une entrée ici + sa liste de fiches.
  const TABS = [
    { id: 'all', label: 'TOUS', color: '#f4f4f4' }, { id: 'common', label: 'COMMUN', color: TIER_COLOR.common },
    { id: 'rare', label: 'RARE', color: TIER_COLOR.rare }, { id: 'ultra', label: 'ULTRA', color: TIER_COLOR.ultra },
  ];
  const CONFETTI = ['#fdfd02', '#ff7c1f', '#56ff5a', '#4ab0ff', '#ff3b2e', '#f4f4f4'];

  // motif de points discret pour le fond (créé une fois)
  let dotPattern = null;
  function dots(ctx) {
    if (!dotPattern) {
      const c = document.createElement('canvas'); c.width = c.height = 22;
      const g = c.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(10, 10, 2, 2);
      dotPattern = ctx.createPattern(c, 'repeat');
    }
    return dotPattern;
  }

  // crochets dans les quatre angles (comme les repères de cibles du HUD)
  function brackets(ctx, x, y, w, h, len, lw, color) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]]) {
      ctx.moveTo(cx + dx * len, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * len);
    }
    ctx.stroke();
  }
  // étincelle à quatre branches
  function sparkle(ctx, x, y, r, color, a) {
    ctx.globalAlpha = a; ctx.fillStyle = color;
    ctx.fillRect(x - r * 0.22, y - r, r * 0.44, r * 2); ctx.fillRect(x - r, y - r * 0.22, r * 2, r * 0.44);
    ctx.globalAlpha = 1;
  }

  class Shop {
    constructor(ui) {
      this.ui = ui; this.tab = 'all'; this.sel = null; this.cel = null; this.pop = null; this.burst = null; this.selT = 1;
      this.thumbs = new CC.Thumbs(ui.game);
    }

    onOpen(game) { this.sel = game.save.equipped; this.cel = null; this.burst = null; }
    items() { return CC.Skins.list.filter((s) => this.tab === 'all' || s.tier === this.tab); }
    back() { if (this.cel) { this.cel = null; return true; } return false; }

    // image d'un cosmétique (ou un repère le temps que l'aperçu 3D soit prêt)
    drawPreview(ctx, s, cx, cy, size, i) {
      let img = this.thumbs.frame(s, i);
      if (!img && i) img = this.thumbs.frame(s, 0);
      if (img) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); ctx.restore(); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - size * 0.3, cy - size * 0.04, size * 0.6, size * 0.08); }
    }

    // pastille (étiquette) : texte sur aplat, reflet en haut, filet sombre ; renvoie sa largeur. `icon(ctx, cx, cy, s, color)` facultatif
    pill(ctx, x, y, h, label, fg, bg, icon, alignRight) {
      const ui = this.ui, px = h * 0.075, iw = icon ? h * 0.75 : 0, w = CC.Font.measure(label, px) + h * 0.7 + iw, x0 = alignRight ? x - w : x;
      ctx.fillStyle = bg; ctx.fillRect(x0, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x0, y, w, Math.max(1, h * 0.08));
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = Math.max(1, h * 0.07); ctx.strokeRect(x0, y, w, h);
      if (icon) icon.call(ui, ctx, x0 + h * 0.5, y + h / 2, h * 0.26, fg);
      ui.text(ctx, label, x0 + h * 0.35 + iw, y + (h - px * 7) / 2, px, fg, { outline: null });
      return w;
    }
    // rangée d'étoiles de rareté
    stars(ctx, x, y, n, r, color) {
      for (let k = 0; k < n; k++) { this.ui.star(ctx, x + r + k * r * 2.3, y, r, true, color); }
      return n * r * 2.3;
    }

    draw(ctx, game, W, H) {
      const ui = this.ui, col = CC.CONFIG.hud.colors, T = -(ui.offsetY || 0), HH = ui.fullH || H, P = ui.portrait || W < HH, mt = ui.minTap(), pr = ui.pixelRatio();
      const save = game.save, owned = (id) => !!save.owned[id], list = CC.Skins.list;
      if (!this.sel || !CC.Skins.byId[this.sel]) this.sel = save.equipped;
      const sel = CC.Skins.byId[this.sel];
      if (this.heroId !== this.sel) { this.heroId = this.sel; this.selT = 0; this.thumbs.keepOnly(this.sel); }
      this.selT += ui.dt;
      ui.needFrames();

      // fond : dégradé nuit, trame de points, voile sombre sur les bords (comme la vignette du jeu)
      const fx = -ui.safeL - 2, fy = T - ui.safeT - 2, fw = W + ui.safeL + ui.safeR + 4, fh = HH + ui.safeT + ui.safeB + 4;
      const bg = ctx.createLinearGradient(0, fy, 0, fy + fh); bg.addColorStop(0, '#15203a'); bg.addColorStop(0.55, '#0a0e1a'); bg.addColorStop(1, '#05060a');
      ctx.fillStyle = bg; ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = dots(ctx); ctx.fillRect(fx, fy, fw, fh);
      const vg = ctx.createRadialGradient(W / 2, T + HH * 0.4, HH * 0.25, W / 2, T + HH * 0.4, Math.max(W, HH) * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vg; ctx.fillRect(fx, fy, fw, fh);

      // en-tête : retour, titre en relief, compteur de collection
      const sx = W * 0.025, gap = W * 0.025, hdrY = T + HH * 0.012;
      ui.backButton(ctx, sx, hdrY, mt);
      const own = list.filter((s) => owned(s.id)).length, cnt = own + '/' + list.length, cph = mt * 0.64;
      const pw = CC.Font.measure(cnt, cph * 0.075) + cph * 1.35, gx0 = sx + mt * 1.2 + gap, gx1 = W - sx - pw - gap;   // le titre se centre entre le retour et le compteur
      const tp = ui.fitPx(['BOUTIQUE'], (gx1 - gx0) * 0.88, HH * 0.0075), ty = hdrY + (mt - tp * 7) / 2, tcx = (gx0 + gx1) / 2;
      ui.text(ctx, 'BOUTIQUE', tcx + tp * 0.8, ty + tp * 0.8, tp, '#05060a', { align: 'center', skew: -0.2, outline: null });
      ui.text(ctx, 'BOUTIQUE', tcx, ty, tp, col.white, { align: 'center', skew: -0.2 });
      this.pill(ctx, W - sx, hdrY + mt * 0.18, cph, cnt, col.yellow, '#10162a', function (c, x, y, s, color) { this.star(c, x, y, s * 1.5, true, color); }, true);
      // barre de collection : une case par cosmétique, à la couleur de sa rareté quand il est possédé
      const barY = hdrY + mt + HH * 0.01, barH = Math.max(5 * pr, HH * 0.008), sg = 2 * pr, segW = (W - sx * 2 - sg * (list.length - 1)) / list.length;
      list.forEach((s, i) => {
        ctx.fillStyle = owned(s.id) ? TIER_COLOR[s.tier] : 'rgba(255,255,255,0.1)'; ctx.fillRect(sx + i * (segW + sg), barY, segW, barH);
        if (s.id === save.equipped) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + i * (segW + sg), barY - barH * 0.5, segW, barH * 0.35); }
      });

      // zones : portrait → aperçu en haut puis grille ; paysage → aperçu à gauche, grille à droite
      const top = barY + barH + HH * 0.014;
      const heroR = P ? { x: sx, y: top, w: W - sx * 2, h: HH * (HH < 720 ? 0.4 : 0.37) } : { x: sx, y: top, w: W * 0.37, h: T + HH - top - HH * 0.02 };
      const tabsR = P ? { x: sx, y: heroR.y + heroR.h + HH * 0.012, w: W - sx * 2, h: mt * 1.1 } : { x: heroR.x + heroR.w + gap, y: top, w: W - heroR.w - sx * 2 - gap, h: mt * 1.1 };
      const gridR = P ? { x: 0, y: tabsR.y + tabsR.h + HH * 0.008, w: W, h: T + HH - (tabsR.y + tabsR.h + HH * 0.008) } : { x: tabsR.x, y: tabsR.y + tabsR.h + HH * 0.01, w: tabsR.w, h: T + HH - (tabsR.y + tabsR.h + HH * 0.01) };

      this.drawHero(ctx, game, sel, heroR);
      this.drawTabs(ctx, game, tabsR);

      // grille de cartes
      const items = this.items(), cols = P ? (W > 600 ? 3 : 2) : (W > 1000 ? 4 : 3), pad = gap, cw = (gridR.w - pad * (cols + 1)) / cols, ch = cw * (P ? 1.12 : 1.04);
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

    // onglets de rareté, avec « possédés / total » sous le nom
    drawTabs(ctx, game, R) {
      const ui = this.ui, tw = R.w / TABS.length, owned = (id) => !!game.save.owned[id];
      const px = Math.min(...TABS.map((t) => ui.fitPx([t.label], tw * 0.8, R.h * 0.036)));
      TABS.forEach((t, i) => {
        const on = t.id === this.tab, list = CC.Skins.list.filter((s) => t.id === 'all' || s.tier === t.id), got = list.filter((s) => owned(s.id)).length;
        const face = ui.placeButton(ctx, { x: R.x + i * tw + 2, y: R.y, w: tw - 4, h: R.h }, null, 0, () => { this.tab = t.id; if (ui.scrolls.shop) ui.scrolls.shop.y = 0; }, { color: on ? t.color : '#6f7686', fill: on ? 'rgba(255,255,255,0.1)' : 'rgba(8,10,14,0.6)', fx: 'tab' });
        ui.text(ctx, t.label, face.x + face.w / 2, face.y + face.h * 0.13, px, on ? t.color : '#c4c9d6', { align: 'center' });
        ui.text(ctx, got + '/' + list.length, face.x + face.w / 2, face.y + face.h * 0.13 + px * 10.5, px * 0.72, on ? '#e8e8e8' : '#7d8497', { align: 'center' });
        if (on) { ctx.fillStyle = t.color; ctx.fillRect(face.x, face.y + face.h - R.h * 0.08, face.w, R.h * 0.08); }
      });
    }

    // carte de la grille : aperçu sur son socle, rareté, nom, état (équipé / possédé / cadenas + prix)
    drawCard(ctx, game, s, r0) {
      const ui = this.ui, col = CC.CONFIG.hud.colors, owned = !!game.save.owned[s.id], eq = game.save.equipped === s.id, isSel = this.sel === s.id;
      const st = ui.hitRect(r0, () => { this.sel = s.id; }, { fx: 'select' });
      let { x, y, w, h } = r0;
      const tc = TIER_COLOR[s.tier], lift = isSel && !st.pressed ? h * 0.012 : 0;
      if (st.pressed) { x += w * 0.03; y += h * 0.03; w *= 0.94; h *= 0.94; }
      y -= lift;
      const pop = this.pop && this.pop.id === s.id ? Math.max(0, 1 - this.pop.t / 0.5) : 0, u = Math.max(2, h * 0.012);
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(x + u * 1.5, y + u * 2, w, h);                         // ombre portée
      const body = ctx.createLinearGradient(0, y, 0, y + h); body.addColorStop(0, eq ? '#2b2a12' : '#1b2338'); body.addColorStop(1, eq ? '#14130a' : '#0c101b');
      ctx.fillStyle = body; ctx.fillRect(x, y, w, h);
      // halo de rareté + socle sous la roquette
      const ps = Math.min(w * 0.92, h * 0.58), pcx = x + w / 2, pcy = y + h * 0.07 + ps / 2;
      const gl = ctx.createRadialGradient(pcx, pcy, ps * 0.05, pcx, pcy, ps * 0.62); gl.addColorStop(0, tc + (owned ? '40' : '22')); gl.addColorStop(1, tc + '00');
      ctx.fillStyle = gl; ctx.fillRect(x, y, w, h * 0.7);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(pcx, pcy + ps * 0.34, ps * 0.34, ps * 0.045, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.globalAlpha = owned ? 1 : 0.78; this.drawPreview(ctx, s, pcx, pcy, ps, 0); ctx.restore();
      // bandeau du bas : nom et état
      const py = y + h * 0.69, ph = h - (py - y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, py, w, ph);
      ctx.fillStyle = tc; ctx.globalAlpha = s.tier === 'base' ? 0.5 : 0.95; ctx.fillRect(x, py, w, Math.max(2, h * 0.014)); ctx.globalAlpha = 1;
      const maxPx = h * 0.0125, name = ui.fitPx([s.name], w * 0.9, maxPx) >= maxPx * 0.7 ? s.name : (s.short || s.name);
      const npx = ui.fitPx([name], w * 0.9, maxPx), spx = Math.min(npx * 0.8, ui.fitPx(['2,29 EUR'], w * 0.6, h * 0.02));
      ui.text(ctx, name, x + w / 2, py + ph * 0.16, npx, tc, { align: 'center' });
      const sub = eq ? 'EQUIPEE' : owned ? 'POSSEDEE' : CC.Skins.formatPrice(s.price), sc = eq ? col.yellow : owned ? col.green : '#ffffff';
      ui.text(ctx, sub, x + w / 2, py + ph * 0.16 + npx * 9.5, spx, sc, { align: 'center' });
      // rareté : étoiles en haut à gauche ; état : pastille en haut à droite
      this.stars(ctx, x + w * 0.05, y + h * 0.075, TIER_STARS[s.tier], h * 0.028, tc);
      const br = Math.min(w, h) * 0.085, bx = x + w - br * 1.6, by = y + br * 1.7 + h * 0.01;
      if (eq || owned) { ctx.fillStyle = eq ? col.yellow : '#2f9a3a'; ctx.beginPath(); ctx.arc(bx, by, br * (1 + pop * 0.5), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke(); ui.iconCheck(ctx, bx, by, br * 0.55, eq ? '#14141a' : '#ffffff'); }
      else { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ui.iconLock(ctx, bx, by + br * 0.1, br * 0.6, '#cfcfcf'); }
      // cadre : jaune si équipée, bleu si choisie (avec crochets), sinon filet discret
      ctx.strokeStyle = eq ? col.yellow : isSel ? '#8fd0ff' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(2, h * (eq || isSel ? 0.016 : 0.009)); ctx.strokeRect(x, y, w, h);
      if (isSel || eq) brackets(ctx, x - u, y - u, w + u * 2, h + u * 2, h * 0.09, Math.max(2, h * 0.016), eq ? col.yellow : '#8fd0ff');
      if (pop) { ctx.globalAlpha = pop * 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
    }

    // grand aperçu du cosmétique choisi : scène éclairée, rareté, état, nom, description, boutons d'action
    drawHero(ctx, game, s, R) {
      const ui = this.ui, col = CC.CONFIG.hud.colors, save = game.save, owned = !!save.owned[s.id], eq = save.equipped === s.id;
      const tc = TIER_COLOR[s.tier], mt = ui.minTap(), t = ui.t, k = U.smooth(0, 0.3, this.selT);
      if (this.pop) { this.pop.t += ui.dt; if (this.pop.t > 0.6) this.pop = null; }
      // panneau : fond sombre dégradé, filet de la couleur de rareté, crochets dans les angles
      const pg = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); pg.addColorStop(0, '#182440'); pg.addColorStop(1, '#0a0d18');
      ctx.fillStyle = pg; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.strokeStyle = tc; ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(2, R.h * 0.007); ctx.strokeRect(R.x, R.y, R.w, R.h); ctx.globalAlpha = 1;
      brackets(ctx, R.x - 3, R.y - 3, R.w + 6, R.h + 6, R.h * 0.07, Math.max(3, R.h * 0.012), tc);

      const pad = R.h * 0.03, ph = Math.round(mt * 0.5), btnH = mt * 1.2, by = R.y + R.h - btnH - pad, bx = R.x + R.w * 0.04, bw = R.w * 0.92;
      // rangée du haut : rareté (pastille pleine + étoiles) et état
      const rw = this.pill(ctx, R.x + pad * 1.4, R.y + pad, ph, TIER_SHORT[s.tier], '#14141a', tc), starsW = TIER_STARS[s.tier] * ph * 0.22 * 2.3 + ph * 0.3;
      const stLabel = eq ? 'EQUIPEE' : owned ? 'POSSEDEE' : 'BLOQUEE', stW = CC.Font.measure(stLabel, ph * 0.075) + ph * 1.45;
      if (pad * 2.8 + rw + starsW + stW + ph * 0.3 < R.w) this.stars(ctx, R.x + pad * 1.4 + rw + ph * 0.3, R.y + pad + ph / 2, TIER_STARS[s.tier], ph * 0.22, tc);   // étoiles si la place le permet
      const pk = this.pop && this.pop.id === s.id ? 1 + Math.sin(Math.min(1, this.pop.t / 0.35) * Math.PI) * 0.12 : 1;
      ctx.save(); ctx.translate(R.x + R.w - pad * 1.4, R.y + pad + ph / 2); ctx.scale(pk, pk);
      this.pill(ctx, 0, -ph / 2, ph, stLabel, eq ? '#14141a' : '#ffffff', eq ? col.yellow : owned ? '#2f9a3a' : '#2a3148', eq || owned ? ui.iconCheck : ui.iconLock, true);
      ctx.restore();

      // pile du bas (de bas en haut) : boutons, description, nom ; l'aperçu prend la place restante
      const npx = ui.fitPx([s.name], R.w * 0.9, R.h * 0.0105), tpx = Math.min(ui.formPx() * 0.8, npx * 0.5);
      let tgx = tpx, tag = ui.wrap(s.tagline || '', tgx, R.w * 0.88);
      if (tag.length > 2) { tgx = tpx * 0.84; tag = ui.wrap(s.tagline, tgx, R.w * 0.88); }
      if (tag.length > 2) { tag = tag.slice(0, 2); tag[1] = tag[1].slice(0, Math.max(1, tag[1].length - 2)) + '...'; }
      const tagH = tag.length * tgx * 10.5;
      const prevTop = R.y + pad + ph + pad * 0.6;
      let ny = by - R.h * 0.04 - tagH - npx * 7 - R.h * 0.012;
      const showTag = (ny - prevTop) > R.h * 0.34;
      if (!showTag) ny = by - R.h * 0.04 - npx * 7;
      const ps = Math.max(R.h * 0.2, Math.min(R.w * 0.66, ny - prevTop - R.h * 0.01)), pcx = R.x + R.w / 2, pcy = prevTop + ps / 2 + R.h * 0.005;
      // scène : faisceau de lumière du haut, sol de la couleur de rareté, ombre sous la roquette
      const floor = pcy + ps * 0.46;
      const beam = ctx.createLinearGradient(0, prevTop - pad, 0, floor); beam.addColorStop(0, tc + '38'); beam.addColorStop(1, tc + '00');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(pcx - ps * 0.1, prevTop - pad); ctx.lineTo(pcx + ps * 0.1, prevTop - pad); ctx.lineTo(pcx + ps * 0.62, floor); ctx.lineTo(pcx - ps * 0.62, floor); ctx.closePath(); ctx.fill();
      const gl = ctx.createRadialGradient(pcx, pcy, ps * 0.05, pcx, pcy, ps * 0.6); gl.addColorStop(0, tc + '4a'); gl.addColorStop(1, tc + '00'); ctx.fillStyle = gl; ctx.fillRect(R.x, prevTop - pad, R.w, floor - prevTop + pad * 2);
      const fl = ctx.createLinearGradient(pcx - R.w * 0.42, 0, pcx + R.w * 0.42, 0); fl.addColorStop(0, tc + '00'); fl.addColorStop(0.5, tc); fl.addColorStop(1, tc + '00');
      ctx.fillStyle = fl; ctx.fillRect(pcx - R.w * 0.42, floor, R.w * 0.84, Math.max(2, R.h * 0.007));
      ctx.fillStyle = fl; ctx.globalAlpha = 0.4; ctx.fillRect(pcx - R.w * 0.3, floor + R.h * 0.018, R.w * 0.6, Math.max(1, R.h * 0.004)); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(pcx, floor - ps * 0.02, ps * 0.4, ps * 0.045, 0, 0, Math.PI * 2); ctx.fill();
      // étincelles (rare et ultra rare) qui scintillent autour
      const nsp = { base: 0, common: 2, rare: 5, ultra: 8 }[s.tier];
      for (let i = 0; i < nsp; i++) {
        const a = i * 2.4 + 0.7, rr = ps * (0.42 + 0.14 * ((i * 37) % 5) / 4), tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        sparkle(ctx, pcx + Math.cos(a) * rr * 1.25, pcy + Math.sin(a) * rr * 0.62, ps * (0.03 + 0.025 * tw), tc === '#e8e8e8' ? '#ffffff' : tc, 0.3 + 0.7 * tw);
      }
      // plateau tournant : on demande les 24 images (la première prête s'affiche tout de suite)
      const N = CC.Thumbs.FRAMES;
      for (let i = N - 1; i >= 1; i--) this.thumbs.frame(s, i);
      let idx = Math.floor(t * 9) % N;
      if (!this.thumbs.frame(s, idx)) { this.lastIdx = this.lastIdx && this.thumbs.cache[s.id + ':' + this.lastIdx] ? this.lastIdx : 0; idx = this.lastIdx; } else this.lastIdx = idx;
      const bob = Math.sin(t * 2.2) * ps * 0.014, sc = 0.8 + 0.2 * k + (this.pop && this.pop.id === s.id ? Math.sin(Math.min(1, this.pop.t / 0.4) * Math.PI) * 0.06 : 0);
      ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * k; this.drawPreview(ctx, s, pcx, pcy + bob, ps * sc, idx); ctx.restore();
      // étincelles d'équipement
      if (this.burst) {
        const b = this.burst; b.t += ui.dt;
        for (const p of b.parts) { const a = Math.max(0, 1 - b.t / 0.7); ctx.globalAlpha = a; ctx.fillStyle = p.c; const px = pcx + p.vx * b.t * ps, py = pcy + p.vy * b.t * ps + 0.9 * b.t * b.t * ps; ctx.fillRect(px, py, p.s, p.s); }
        ctx.globalAlpha = 1; if (b.t > 0.7) this.burst = null;
      }
      // nom (avec ombre portée), description
      ctx.save(); ctx.globalAlpha = k;
      ui.text(ctx, s.name, pcx + npx * 0.55, ny + npx * 0.55, npx, ui.shade(tc, 0.28), { align: 'center', skew: -0.12, outline: null });
      ui.text(ctx, s.name, pcx, ny, npx, tc, { align: 'center', skew: -0.12 });
      if (showTag) tag.forEach((l, i) => ui.text(ctx, l, pcx, ny + npx * 9 + i * tgx * 10.5, tgx, '#9aa6c4', { align: 'center' }));
      ctx.restore();

      // boutons d'action
      if (owned) {
        const label = eq ? 'EQUIPEE' : 'EQUIPER', bp = ui.fitPx([label], bw * 0.6, btnH * 0.05);
        if (eq) {
          const face = ui.placeButton(ctx, { x: bx, y: by, w: bw, h: btnH }, null, 0, null, { color: col.green, fx: 'none', fill: 'rgba(40,120,50,0.22)' });
          const tw = CC.Font.measure(label, bp);
          ui.text(ctx, label, face.x + face.w / 2 + bp * 4, face.y + (face.h - bp * 7) / 2, bp, col.green, { align: 'center' });
          ui.iconCheck(ctx, face.x + face.w / 2 - tw / 2 - bp * 2, face.y + face.h / 2, bp * 2.2, col.green);
        } else ui.placeButton(ctx, { x: bx, y: by, w: bw, h: btnH }, label, bp, () => this.equip(game, s.id), { color: col.yellow, solid: true, fx: 'equip' });
      } else {
        const hw = (bw - R.w * 0.03) / 2, price = CC.Skins.formatPrice(s.price);
        const bp = ui.fitPx(['ACHETER', 'PUB 1 MIN'], hw * 0.86, btnH * 0.046), sp = ui.fitPx([price, 'GRATUIT'], hw * 0.8, bp * 0.7);
        const a = ui.placeButton(ctx, { x: bx, y: by, w: hw, h: btnH }, null, 0, () => this.buy(game, s.id), { color: col.yellow, solid: true, fx: 'primary' });
        ui.text(ctx, 'ACHETER', a.x + a.w / 2, a.y + a.h * 0.5 - bp * 8, bp, '#14141a', { align: 'center', outline: null });
        ui.text(ctx, price, a.x + a.w / 2, a.y + a.h * 0.5 + bp * 1.2, sp, '#4a4a10', { align: 'center', outline: null });
        const b = ui.placeButton(ctx, { x: bx + hw + R.w * 0.03, y: by, w: hw, h: btnH }, null, 0, () => this.watch(game, s.id), { color: '#8fd0ff', fx: 'primary', fill: 'rgba(60,110,170,0.2)' });
        const lw = CC.Font.measure('PUB 1 MIN', bp);
        ui.iconPlay(ctx, b.x + b.w / 2 - lw / 2 - bp * 3, b.y + b.h * 0.5 - bp * 4.3, bp * 1.6, '#8fd0ff');
        ui.text(ctx, 'PUB 1 MIN', b.x + b.w / 2 + bp * 2, b.y + b.h * 0.5 - bp * 8, bp, '#8fd0ff', { align: 'center' });
        ui.text(ctx, 'GRATUIT', b.x + b.w / 2, b.y + b.h * 0.5 + bp * 1.2, sp, '#cfe8ff', { align: 'center' });
      }
    }

    equip(game, id) {
      if (!game.equipCosmetic(id)) return;
      this.pop = { id, t: 0 };
      const parts = [];
      for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, v = 0.25 + Math.random() * 0.45; parts.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, s: (3 + Math.random() * 4) * this.ui.pixelRatio(), c: i % 3 ? '#fdfd02' : '#ffffff' }); }
      this.burst = { t: 0, parts };
    }

    // Paiement : confirmation, puis redirection vers le lien Stripe (même onglet : au retour, Stripe renvoie vers le jeu qui
    // débloque le cosmétique — voir CC.Shop.handleReturn). Le cosmétique voyage dans utm_content (Stripe le recopie dans
    // l'adresse de retour) et dans client_reference_id (visible dans le Dashboard et les webhooks).
    buy(game, id) {
      const s = CC.Skins.byId[id], ui = this.ui;
      ui.confirm({ title: 'ACHETER ' + (s.short || s.name) + ' ?', lines: [CC.Skins.formatPrice(s.price) + ' - PAIEMENT EN LIGNE SECURISE', 'TU REVIENDRAS AU JEU APRES LE PAIEMENT'], yes: 'PAYER', no: 'ANNULER', color: '#fdfd02', onYes: () => this.pay(game, id) });
    }
    pay(game, id) {
      const link = CC.CONFIG.shop.stripeLink;
      if (!link) { this.ui.feedback('denied'); this.ui.toast('PAIEMENT PAS ENCORE ACTIF (LIEN STRIPE A RENSEIGNER)', '#ff9a3a', 3.4); return; }
      game.save.pendingPurchase = id; game.writeSave();
      const url = link + (link.indexOf('?') < 0 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(id) + '&utm_content=' + encodeURIComponent(id) + '&utm_source=coldimpact';
      game.telemetry.event('purchase', { id });
      if (window.top === window) window.location.href = url;          // page du jeu : même onglet, retour automatique
      else { const w = window.open(url, '_blank'); if (!w) this.ui.toast('OUVRE LE JEU DANS UN NAVIGATEUR POUR PAYER', '#ff9a3a', 3.4); }   // jeu intégré dans une autre page
    }

    // Publicité : une minute entière (annonces de 15 s enchaînées) ; fermer avant la fin ne débloque rien
    watch(game, id) {
      game.ads.rewarded(() => this.unlock(game, id), CC.CONFIG.shop.adSeconds);
    }

    // déblocage (publicité regardée ou paiement revenu) : équipé aussitôt, puis célébration
    unlock(game, id) {
      if (!game.unlockCosmetic(id)) return;
      this.sel = id; this.celebrate(id);
    }
    celebrate(id) {
      const ui = this.ui, s = CC.Skins.byId[id], pr = ui.pixelRatio(), parts = [];
      this.cel = { id, t: 0, parts };
      const W = ui.game.hudCanvas.width, H = ui.game.hudCanvas.height;
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, v = (180 + Math.random() * 520) * pr;
        parts.push({ x: W / 2, y: H * 0.38, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 420 * pr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: (5 + Math.random() * 7) * pr, c: Math.random() < 0.4 ? TIER_COLOR[s.tier] : CONFETTI[i % CONFETTI.length] });
      }
      ui.feedback('unlock');
    }

    drawCelebration(ctx, game, W, HH, T) {
      const ui = this.ui, c = this.cel, s = CC.Skins.byId[c.id], tc = TIER_COLOR[s.tier], col = CC.CONFIG.hud.colors, mt = ui.minTap();
      c.t += ui.dt; ui.needFrames();
      ui.buttons = []; ui.regions = [];
      ui.dim(ctx, W, HH, Math.min(0.94, c.t * 4));
      ui.buttons.push({ x: -ui.safeL - 5, y: T - ui.safeT - 5, w: W + 4000, h: HH + 4000, idx: ui.buttons.length, action: () => { if (c.t > 0.7) this.cel = null; }, fx: 'back' });
      const k = Math.min(1, c.t / 0.5), bounce = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 - (1 - k) * 0.6 : 1 + Math.sin(c.t * 3) * 0.015;
      const ps = Math.min(W * 0.78, HH * 0.34), cx = W / 2, cy = T + HH * 0.36;
      // rayons qui tournent derrière la roquette, couleur de rareté
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.t * 0.3); ctx.globalAlpha = Math.min(1, c.t * 2) * 0.16; ctx.fillStyle = tc;
      const R = Math.max(W, HH);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.12) * R, Math.sin(a - 0.12) * R); ctx.lineTo(Math.cos(a + 0.12) * R, Math.sin(a + 0.12) * R); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const gl = ctx.createRadialGradient(cx, cy, ps * 0.05, cx, cy, ps * 0.7); gl.addColorStop(0, tc + '88'); gl.addColorStop(1, tc + '00'); ctx.fillStyle = gl; ctx.fillRect(0, T, W, HH);
      this.drawPreview(ctx, s, cx, cy, ps * bounce, Math.floor(c.t * 9) % CC.Thumbs.FRAMES);
      const tp = ui.fitPx(['DEBLOQUE !'], W * 0.86, HH * 0.0105), tk = U.smooth(0, 0.35, c.t);
      ctx.save(); ctx.translate(cx, T + HH * 0.13); ctx.scale(0.4 + tk * 0.6, 0.4 + tk * 0.6); ctx.globalAlpha = tk;
      ui.text(ctx, 'DEBLOQUE !', tp * 0.7, -tp * 3.5 + tp * 0.7, tp, '#05060a', { align: 'center', skew: -0.2, outline: null });
      ui.text(ctx, 'DEBLOQUE !', 0, -tp * 3.5, tp, col.yellow, { align: 'center', skew: -0.2 }); ctx.restore();
      const np = ui.fitPx([s.name], W * 0.86, HH * 0.0072), ny = T + HH * 0.6;
      ui.text(ctx, s.name, cx + np * 0.5, ny + np * 0.5, np, ui.shade(tc, 0.28), { align: 'center', skew: -0.12, outline: null });
      ui.text(ctx, s.name, cx, ny, np, tc, { align: 'center', skew: -0.12 });
      const sr = np * 2.4, n = TIER_STARS[s.tier], sy = ny + np * 12;
      for (let i = 0; i < n; i++) ui.star(ctx, cx + (i - (n - 1) / 2) * sr * 2.4, sy, sr * (0.6 + 0.4 * U.smooth(0.3 + i * 0.15, 0.6 + i * 0.15, c.t)), true, tc);
      const line = TIER_NAME[s.tier] + '  -  EQUIPEE';
      ui.text(ctx, line, cx, sy + sr * 2.2, ui.fitPx([line], W * 0.86, np * 0.55), col.green, { align: 'center' });
      // confettis : gravité, rotation, disparition en bas
      const g = 1500 * ui.pixelRatio();
      for (const p of c.parts) {
        p.vy += g * ui.dt; p.x += p.vx * ui.dt; p.y += p.vy * ui.dt; p.r += p.vr * ui.dt;
        if (p.y > ui.game.hudCanvas.height + 40) continue;
        ctx.save(); ctx.translate(p.x - ui.safeL, p.y - ui.safeT - (ui.offsetY || 0)); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      const bh = mt * 1.3, bp = ui.fitPx(['SUPER !'], W * 0.5, bh * 0.05), bw = W * 0.7;
      if (c.t > 0.7) ui.placeButton(ctx, { x: (W - bw) / 2, y: T + HH - bh - HH * 0.05, w: bw, h: bh }, 'SUPER !', bp, () => { this.cel = null; }, { color: col.yellow, solid: true, fx: 'primary', pulse: true });
    }
  }

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
