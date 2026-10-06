/* Kit d'interface tactile (v033-ux) : tout ce que les écrans (menu, boutique, réglages, pause, résultats) partagent.
 * Ajouté au prototype de CC.UI (src/ui/menu.js) ; les écrans dessinent dans le canvas du HUD et enregistrent leurs zones
 * tactiles dans `ui.buttons` à chaque image.
 *
 *  - Pointeur unique (souris ET doigt) : l'appui met le bouton à l'état « enfoncé », l'action part au RELÂCHEMENT si le doigt
 *    est encore sur le même bouton (glisser en dehors annule), comme sur un vrai téléphone. Glisser sur une zone de
 *    défilement la fait défiler sans déclencher de bouton.
 *  - Boutons à états : normal, survolé (souris), enfoncé, désactivé, verrouillé ; zone tactile d'au moins 48 points.
 *  - Retour sensoriel centralisé : feedback('tap' | 'back' | 'tab' | 'equip' | 'unlock' | 'denied'…) joue le son ET la
 *    vibration qui vont ensemble (voir src/input/haptics.js).
 *  - Composants : bouton, gros bouton, onglets, interrupteur, choix multiple, curseur, zone défilante, annonce passagère
 *    (toast), boîte de confirmation, icônes dessinées (verrou, coche, retour, engrenage…). */
(function () {
  const U = CC.U;
  const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const keyOf = (r) => Math.round(r.x) + '|' + Math.round(r.y) + '|' + Math.round(r.w) + '|' + Math.round(r.h);

  // couleur #rrggbb multipliée par k (ombre du rebord des boutons pleins)
  function shade(hex, k) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
  }

  // son + vibration qui vont ensemble : [son, niveau haptique]
  const FX = {
    tap: ['tap', 'light'], back: ['back', 'light'], tab: ['tab', 'light'], select: ['tab', 'light'],
    primary: ['tap', 'medium'], equip: ['equip', 'medium'], unlock: ['unlock', 'unlock'],
    denied: ['denied', 'error'], success: ['chime', 'success'], step: ['chime', 'medium'],
  };

  const Kit = {
    initKit() {
      this.ptr = null;            // pointeur posé : { x, y, sx, sy, down, scrolling }
      this.pressedKey = null;     // clé du bouton visé à l'appui
      this.drag = null;           // curseur (slider) en cours de déplacement
      this.regions = []; this.scrolls = {}; this.scrollReg = null; this.clip = null;
      this.toasts = [];
      this.tapFlash = null;
      this.eases = {};
      this.stack = [];            // pile de navigation (écran précédent)
      this.modal = null;
      this.t = 0; this.screenT = 0; this.lastDraw = performance.now();
      this.hoverOk = true;        // survol utile seulement si le dernier pointeur était une souris
      this.fastUntil = 0;
    },

    shade(hex, k) { return shade(hex, k); },   // couleur #rrggbb × k (ombres, reflets)

    // ---------- mesures ----------
    isTouch() { return document.body.classList.contains('cc-touch'); },
    pixelRatio() { return this.game.renderer ? this.game.renderer.getPixelRatio() : 1; },
    minTap() { return 48 * this.pixelRatio(); },          // plus petite zone de toucher (points d'écran → pixels du canvas)
    // plus grande taille de police (≤ maxPx) pour que tous les libellés tiennent dans maxW (police monospace)
    fitPx(labels, maxW, maxPx) { let m = 0; for (const l of labels) m = Math.max(m, CC.Font.measure(l, 1)); return Math.min(maxPx, maxW / Math.max(1, m)); },
    text(ctx, s, x, y, px, color, opts) { return CC.Font.draw(ctx, s, x, y, px, color, opts || {}); },
    // coupe un texte en lignes qui tiennent dans maxW
    wrap(text, px, maxW) {
      const words = String(text).split(' '), lines = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (cur && CC.Font.measure(t, px) > maxW) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      return lines;
    },
    // valeur qui rejoint doucement sa cible (animations d'interrupteurs, d'apparition) ; clé libre
    ease(key, target, rate) {
      const e = this.eases[key] === undefined ? target : this.eases[key];
      return (this.eases[key] = e + (target - e) * U.damp(rate || 18, this.dt || 0.016));
    },
    formPx() { return 2.0 * this.pixelRatio(); },   // taille des intitulés de formulaire (≈ 14 points de haut)
    needFrames() { this.fastUntil = performance.now() + 250; },   // écran animé : le jeu passe de 20 à 60 images/s
    fast() { return performance.now() < this.fastUntil || !!(this.ptr && this.ptr.down) || this.toasts.length > 0 || !!this.tapFlash; },

    // ---------- retour sensoriel ----------
    feedback(kind) {
      const f = FX[kind] || FX.tap;
      try { this.game.audio.play(f[0]); } catch (e) { /* son indisponible */ }
      if (CC.Haptics) CC.Haptics[f[1]]();
    },

    // ---------- pointeur ----------
    toLocal(e) {
      const c = this.game.hudCanvas, r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (c.width / r.width) - (this.safeL || 0), y: (e.clientY - r.top) * (c.height / r.height) - (this.safeT || 0) - (this.offsetY || 0) };
    },
    hit(x, y) {
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (inside(b, x, y) && (!b.clip || inside(b.clip, x, y))) return b;
      }
      return null;
    },
    pointerDown(x, y, e) {
      this.ptr = { x, y, sx: x, sy: y, down: true, scrolling: false, t: performance.now(), lastY: y, lastT: performance.now() };
      this.hoverOk = !e || e.pointerType === 'mouse';
      const b = this.hit(x, y);
      this.pressedKey = b ? b.idx : null;   // identité = rang d'enregistrement : reste valable si le bouton bouge (animation d'ouverture)
      this.drag = b && b.drag ? b : null;
      if (this.drag) this.drag.drag(x, true);
      this.scrollReg = this.regions.find((r) => inside(r, x, y)) || null;
      if (this.scrollReg) { const s = this.scrolls[this.scrollReg.id]; s.v = 0; this.ptr.startScroll = s.y; }
      this.needFrames();
    },
    pointerMove(x, y) {
      this.mouse.x = x; this.mouse.y = y;
      const p = this.ptr;
      if (!p || !p.down) return;
      p.x = x; p.y = y;
      if (this.drag) { this.drag.drag(x, false); return; }
      if (!p.scrolling && this.scrollReg && Math.abs(y - p.sy) > 8 * this.pixelRatio()) { p.scrolling = true; this.pressedKey = null; }
      if (p.scrolling) {
        const s = this.scrolls[this.scrollReg.id], ny = U.clamp(p.startScroll + (p.sy - y), 0, s.max), now = performance.now();
        s.v = (ny - s.y) / Math.max(0.008, (now - p.lastT) / 1000);
        s.y = ny; p.lastT = now;
      }
      this.needFrames();
    },
    pointerUp(x, y) {
      const p = this.ptr;
      if (!p) return;
      p.x = x; p.y = y; p.down = false;
      this.ptr = null;
      if (this.drag) { if (this.drag.dragEnd) this.drag.dragEnd(); this.drag = null; this.pressedKey = null; return; }
      if (p.scrolling) {
        const s = this.scrolls[this.scrollReg.id];
        if (performance.now() - p.lastT > 90) s.v = 0;            // le doigt s'est arrêté avant de lever : pas d'élan
        s.v = U.clamp(s.v, -4000, 4000); this.pressedKey = null; return;
      }
      const b = this.hit(x, y);
      const key = this.pressedKey; this.pressedKey = null;
      if (b && b.idx === key) this.activate(b);
    },
    pointerCancel() { this.ptr = null; this.pressedKey = null; if (this.drag && this.drag.dragEnd) this.drag.dragEnd(); this.drag = null; },
    wheel(dy) {
      const r = this.regions.find((q) => inside(q, this.mouse.x, this.mouse.y)) || this.regions[0];
      if (!r) return false;
      const s = this.scrolls[r.id];
      s.y = U.clamp(s.y + dy * this.pixelRatio() * 0.6, 0, s.max); s.v = 0; this.needFrames();
      return true;
    },
    activate(b) {
      if (b.disabled) { this.feedback('denied'); if (b.msg) this.toast(b.msg, '#ff9a3a'); return; }
      this.tapFlash = { key: b.idx, t: 0 };
      if (b.fx !== 'none') this.feedback(b.fx || 'tap');
      if (b.action) b.action();
    },

    // ---------- navigation ----------
    get overlay() { return this._ov || null; },
    set overlay(v) { this._ov = v || null; if (!v) this.stack.length = 0; this.screenT = 0; this.needFrames(); },
    open(name) { this.stack.push(this._ov || null); this._ov = name; this.screenT = 0; this.needFrames(); },
    // « retour » universel : ferme la boîte de dialogue, sinon revient à l'écran précédent ; false si rien à fermer
    back() {
      if (this.modal) { this.modal = null; return true; }
      if (this.shop && this._ov === 'shop' && this.shop.back()) return true;
      if (this._ov === 'ad' && this.game.ads) { this.game.ads.close(false); return true; }
      if (!this._ov) return false;
      if (this._ov === 'missions' && this.game.state === 'MENU' && !this.stack.length) { this._ov = 'defi'; }
      else if (this.stack.length) this._ov = this.stack.pop();
      else this.overlay = null;
      this.screenT = 0; this.closeSeedInput();
      return true;
    },

    // ---------- annonces passagères (toasts) et dialogue de confirmation ----------
    toast(msg, color, secs) {
      this.toasts.push({ msg, color: color || CC.CONFIG.hud.colors.green, t: 0, life: secs || 2.6 });
      if (this.toasts.length > 3) this.toasts.shift();
      this.needFrames();
    },
    confirm(o) { this.modal = o; this.screenT = 0; this.needFrames(); },
    drawToasts(ctx, W, H) {
      const T = -(this.offsetY || 0), HH = this.fullH || H;
      this.toasts = this.toasts.filter((q) => (q.t += this.dt) < q.life);
      this.toasts.forEach((q, i) => {
        const a = Math.min(1, q.t / 0.18, (q.life - q.t) / 0.3), slide = (1 - Math.min(1, q.t / 0.18)) * HH * 0.03;
        const px = this.fitPx([q.msg], W * 0.84, HH * 0.003), h = px * 14, w = Math.min(W * 0.92, CC.Font.measure(q.msg, px) + px * 14);
        const x = (W - w) / 2, y = T + HH * 0.02 + i * (h + HH * 0.01) - slide;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(8,10,14,0.92)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(2, px * 0.5); ctx.strokeRect(x, y, w, h);
        this.text(ctx, q.msg, W / 2, y + px * 3.5, px, q.color, { align: 'center' });
        ctx.restore();
      });
    },
    // { title, lines:[…], yes, no, color, onYes } — le fond cliquable annule
    drawModal(ctx, W, H) {
      const m = this.modal, T = -(this.offsetY || 0), HH = this.fullH || H, col = CC.CONFIG.hud.colors;
      this.buttons = []; this.regions = [];
      this.dim(ctx, W, H, 0.72);
      this.buttons.push({ x: -this.safeL - 5, y: T - this.safeT - 5, w: W + 4000, h: HH + 4000, idx: this.buttons.length, action: () => { this.modal = null; }, fx: 'back' });
      const k = U.smooth(0, 0.18, this.screenT);
      const w = Math.min(W * 0.9, HH * 0.8), px = this.fitPx([m.title], w * 0.86, HH * 0.0058), lp = Math.min(HH * 0.0028, W * 0.0062);
      const lines = (m.lines || []).flatMap((l) => this.wrap(l, lp, w * 0.86)), bh = this.minTap() * 1.15, h = px * 7 + lines.length * lp * 10 + bh + HH * 0.09 + px * 4;
      const x = (W - w) / 2, y = T + (HH - h) / 2 + (1 - k) * HH * 0.04;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = '#0c0e14'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = m.color || col.yellow; ctx.lineWidth = Math.max(3, HH * 0.004); ctx.strokeRect(x, y, w, h);
      this.text(ctx, m.title, W / 2, y + HH * 0.03, px, m.color || col.yellow, { align: 'center', skew: -0.15 });
      lines.forEach((l, i) => this.text(ctx, l, W / 2, y + HH * 0.03 + px * 11 + i * lp * 10, lp, '#dcdcdc', { align: 'center' }));
      const by = y + h - bh - HH * 0.025, bw = (w - HH * 0.075) / 2, bp = this.fitPx([m.yes || 'YES', m.no || 'NO'], bw * 0.8, bh * 0.046);
      this.placeButton(ctx, { x: x + HH * 0.025, y: by, w: bw, h: bh }, m.no || 'NO', bp, () => { this.modal = null; }, { color: '#bdbdbd', fx: 'back' });
      this.placeButton(ctx, { x: x + w - HH * 0.025 - bw, y: by, w: bw, h: bh }, m.yes || 'YES', bp, () => { this.modal = null; if (m.onYes) m.onYes(); }, { color: m.color || col.yellow, solid: true, fx: 'primary' });
      ctx.restore();
    },

    // ---------- boutons ----------
    /* Dessine un cadre de bouton selon son état et renvoie le rectangle de sa face (là où se place le texte).
     * o : color, fill, solid (plein, avec rebord), pressed, hot, disabled, flash (0..1), pulse. */
    drawBox(ctx, r, o) {
      const col = o.color || '#f4f4f4', lip = o.solid ? Math.max(3, r.h * 0.08) : 0, press = !!o.pressed;
      let fx = r.x, fy = r.y + (press ? lip : 0), fw = r.w, fh = r.h - lip;
      if (press) { const s = 0.035; fx += fw * s / 2; fy += fh * s / 2; fw *= 1 - s; fh *= 1 - s; }
      ctx.save();
      if (o.disabled) ctx.globalAlpha *= 0.4;
      if (lip && !press) { ctx.fillStyle = shade(col, 0.45); ctx.fillRect(r.x, r.y + lip, r.w, r.h - lip); }
      if (o.solid) {
        ctx.fillStyle = press ? shade(col, 0.82) : col; ctx.fillRect(fx, fy, fw, fh);
        ctx.fillStyle = 'rgba(255,255,255,' + (press ? 0.1 : 0.3) + ')'; ctx.fillRect(fx + 2, fy + 2, fw - 4, Math.max(2, fh * 0.07));   // reflet : le bouton paraît bombé
      }
      else {
        ctx.fillStyle = o.fill || 'rgba(8,10,14,0.74)'; ctx.fillRect(fx, fy, fw, fh);
        if (press || o.hot) { ctx.fillStyle = col; ctx.globalAlpha *= press ? 0.3 : 0.14; ctx.fillRect(fx, fy, fw, fh); ctx.globalAlpha = o.disabled ? 0.4 : 1; }
      }
      ctx.strokeStyle = o.solid ? '#14141a' : col; ctx.lineWidth = Math.max(2, r.h * 0.035);
      ctx.strokeRect(fx, fy, fw, fh);
      if (o.pulse) {                                             // attire l'œil (tutoriel, nouveauté)
        const a = 0.5 + 0.5 * Math.sin(this.t * 6), g = r.h * 0.08 * a;
        ctx.globalAlpha = 0.35 + 0.4 * a; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, r.h * 0.04);
        ctx.strokeRect(fx - g - 3, fy - g - 3, fw + g * 2 + 6, fh + g * 2 + 6);
      }
      if (o.flash > 0) {                                         // éclat à la validation
        ctx.globalAlpha = o.flash * 0.45; ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, fy, fw, fh);
      }
      ctx.restore();
      return { x: fx, y: fy, w: fw, h: fh };
    },

    /* Enregistre la zone tactile, détermine l'état (enfoncé / survolé / désactivé / verrouillé), dessine le cadre et le
     * libellé. opts : color, fill, solid, disabled, locked, msg (annonce si désactivé), fx, pulse, align, icon. */
    /* Enregistre une zone tactile et renvoie son état { pressed, hot, flash } : pour les écrans qui dessinent eux-mêmes leurs
     * cartes (grille du DÉFI, boutique). `key` identifie le bouton d'une image à l'autre (sa position). */
    hitRect(r, action, opts) {
      opts = opts || {};
      const idx = this.buttons.length, dis = !!(opts.disabled || opts.locked);
      this.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, idx, action, disabled: dis, fx: opts.fx, msg: opts.msg || (opts.locked ? 'LOCKED' : null), clip: this.clip });
      const p = this.ptr;
      const pressed = !dis && this.pressedKey === idx && !!(p && p.down && !p.scrolling && inside(r, p.x, p.y));
      const hot = this.hoverOk && !this.isTouch() && !dis && inside(r, this.mouse.x, this.mouse.y) && (!this.clip || inside(this.clip, this.mouse.x, this.mouse.y)) && !(p && p.down);
      if (hot) this.hover = this.buttons.length - 1;
      return { pressed, hot, dis, flash: this.tapFlash && this.tapFlash.key === idx ? Math.max(0, 1 - this.tapFlash.t / 0.28) : 0 };
    },

    placeButton(ctx, r, label, px, action, opts) {
      opts = opts || {};
      const st = this.hitRect(r, action, opts), dis = st.dis, pressed = st.pressed, hot = st.hot, fl = st.flash;
      const face = this.drawBox(ctx, r, { color: opts.color, fill: opts.fill, solid: opts.solid, pressed, hot, disabled: dis, flash: fl, pulse: opts.pulse });
      if (label) {
        const dark = opts.solid ? '#14141a' : (hot || pressed ? CC.CONFIG.hud.colors.yellow : (opts.color || '#f4f4f4'));
        const ty = face.y + (face.h - px * 7) / 2, left = opts.align === 'left';
        ctx.save(); if (dis) ctx.globalAlpha *= 0.4;
        this.text(ctx, label, left ? face.x + px * 3 : face.x + face.w / 2 + (opts.locked ? px * 4 : 0), ty, px, dark, { align: left ? 'left' : 'center', outline: opts.solid ? null : undefined });
        if (opts.locked) this.iconLock(ctx, face.x + face.w / 2 - CC.Font.measure(label, px) / 2 - px * 3, face.y + face.h / 2, px * 1.6, dark);
        ctx.restore();
      }
      return face;
    },

    // Bouton simple : le libellé est centré en x, `y` est le haut du texte ; zone ≥ 48 points de haut.
    button(ctx, label, x, y, px, action, opts) {
      opts = opts || {};
      const w = opts.hitW || (CC.Font.measure(label, px) + px * 10);
      let h = px * 11, by = y - px * 2;
      const minH = this.minTap();
      if (h < minH) { by -= (minH - h) / 2; h = minH; }
      const bx = opts.align === 'left' ? x - px * 3 : x - w / 2;
      return this.placeButton(ctx, { x: bx, y: by, w, h }, label, px, action, opts);
    },

    // Gros bouton à deux lignes (menu principal) : libellé, sous-titre ; `stars` : étoile devant le sous-titre
    bigButton(ctx, x, y, w, h, label, sub, color, action, stars, labelPx, opts) {
      opts = Object.assign({ color }, opts || {});
      const lp = labelPx || this.fitPx([label], w * 0.8, h * 0.06), sp = this.fitPx([sub + '    '], w * 0.8, h * 0.022);
      const face = this.placeButton(ctx, { x, y, w, h }, null, 0, action, opts);
      const block = lp * 7 + h * 0.1 + sp * 7, y0 = face.y + (face.h - block) / 2, cx = face.x + face.w / 2;
      const hot = !this.isTouch() && this.hoverOk && inside({ x, y, w, h }, this.mouse.x, this.mouse.y);
      ctx.fillStyle = color; ctx.globalAlpha = 0.18; ctx.fillRect(face.x, face.y, face.w * 0.025, face.h); ctx.globalAlpha = 1;
      this.text(ctx, label, cx, y0, lp, hot ? CC.CONFIG.hud.colors.yellow : color, { align: 'center', skew: -0.18 });
      const sy = y0 + lp * 7 + h * 0.1;
      if (stars) {
        const sw = CC.Font.measure(sub, sp), sx = cx - sw / 2;
        this.star(ctx, sx - sp * 6, sy + sp * 3.5, sp * 4, true, '#fdfd02');
        this.text(ctx, sub, sx + sp * 0.5, sy, sp, '#dcdcdc', {});
      } else this.text(ctx, sub, cx, sy, sp, '#dcdcdc', { align: 'center' });
      return face;
    },

    // Bouton carré portant une icône dessinée (retour, réglages, fermer…) : draw(ctx, cx, cy, s, color)
    iconButton(ctx, r, draw, action, opts) {
      opts = opts || {};
      const face = this.placeButton(ctx, r, null, 0, action, opts);
      draw.call(this, ctx, face.x + face.w / 2, face.y + face.h / 2, Math.min(face.w, face.h) * 0.3, opts.color || '#f4f4f4');
      return face;
    },
    // Bouton « retour » standard : carré avec une flèche, en haut à gauche de la zone sûre (≥ 48 points)
    backButton(ctx, x, y, h) {
      const r = { x, y, w: h * 1.2, h };
      this.iconButton(ctx, r, this.iconBack, () => this.back(), { fx: 'back' });
      return r;
    },

    // ---------- composants de formulaire ----------
    // Onglets : items [{ id, label, color }] sur une rangée dans r ; sélection `sel` ; rend la hauteur utilisée
    tabs(ctx, items, r, sel, onSelect) {
      const tw = r.w / items.length, px = Math.min(...items.map((it) => this.fitPx([it.label], tw * 0.82, r.h * 0.044)));
      items.forEach((it, i) => {
        const x = r.x + i * tw, on = it.id === sel, c = it.color || '#f4f4f4';
        const face = this.placeButton(ctx, { x: x + 2, y: r.y, w: tw - 4, h: r.h }, null, 0, () => onSelect(it.id), { color: on ? c : '#9a9a9a', fill: on ? 'rgba(255,255,255,0.1)' : 'rgba(8,10,14,0.6)', fx: 'tab' });
        this.text(ctx, it.label, face.x + face.w / 2, face.y + (face.h - px * 7) / 2, px, on ? c : '#bdbdbd', { align: 'center' });
        if (on) { ctx.fillStyle = c; ctx.fillRect(face.x, face.y + face.h - r.h * 0.07, face.w, r.h * 0.07); }
      });
    },
    // Ligne avec interrupteur : toute la ligne est tactile
    toggle(ctx, label, r, value, onChange, opts) {
      opts = opts || {};
      const face = this.placeButton(ctx, r, null, 0, () => onChange(!value), { color: '#9a9a9a', fx: 'tab' });
      const px = Math.min(this.formPx(), this.fitPx([label], r.w * 0.58, 9));
      this.text(ctx, label, face.x + r.h * 0.3, face.y + (face.h - px * 7) / 2, px, '#f4f4f4', {});
      const sw = r.h * 0.95, sh = r.h * 0.5, sx = face.x + face.w - sw - r.h * 0.3, sy = face.y + (face.h - sh) / 2, k = this.ease('tg' + keyOf(r), value ? 1 : 0, 22);
      ctx.fillStyle = value ? '#2f9a3a' : '#3a3a42'; ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = value ? CC.CONFIG.hud.colors.green : '#7a7a7a'; ctx.lineWidth = Math.max(2, sh * 0.08); ctx.strokeRect(sx, sy, sw, sh);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(sx + sh * 0.12 + k * (sw - sh), sy + sh * 0.12, sh * 0.76, sh * 0.76);
      if (opts.sub) this.text(ctx, opts.sub, face.x + r.h * 0.3, face.y + face.h - px * 4.5, px * 0.62, '#9a9a9a', {});
    },
    // Choix parmi quelques valeurs (segments égaux) ; `labels` : tableau, `index` : valeur courante.
    // r.h = ligne d'intitulé + boutons d'au moins 48 points
    segmented(ctx, label, r, labels, index, onChange, rightText) {
      const px = this.formPx(), lh = px * 11;
      this.text(ctx, label, r.x + r.h * 0.02, r.y, px, '#d8d8d8', {});
      if (rightText) this.text(ctx, rightText, r.x + r.w - r.h * 0.02, r.y, px, CC.CONFIG.hud.colors.yellow, { align: 'right' });
      const sh = Math.min(r.h - lh, this.minTap() * 1.15), sy = r.y + lh, sw = r.w / labels.length;
      const lp = Math.min(...labels.map((l) => this.fitPx([l], sw * 0.84, sh * 0.044)));
      labels.forEach((l, i) => {
        const on = i === index, c = CC.CONFIG.hud.colors.yellow;
        const face = this.placeButton(ctx, { x: r.x + i * sw + 2, y: sy, w: sw - 4, h: sh }, null, 0, () => onChange(i), { color: on ? c : '#9a9a9a', fill: on ? 'rgba(253,253,2,0.14)' : 'rgba(8,10,14,0.6)', fx: 'tab' });
        this.text(ctx, l, face.x + face.w / 2, face.y + (face.h - lp * 7) / 2, lp, on ? c : '#c8c8c8', { align: 'center' });
      });
    },
    // Curseur horizontal (0..1) : on le déplace du doigt, la valeur suit en continu ; un tic de vibration tous les 10 %.
    // r.h = ligne d'intitulé + zone de glissement d'au moins 48 points
    slider(ctx, label, r, value, onChange, valueText, onEnd) {
      const px = this.formPx(), lh = px * 11;
      this.text(ctx, label, r.x + r.h * 0.02, r.y, px, '#d8d8d8', {});
      if (valueText) this.text(ctx, valueText, r.x + r.w - r.h * 0.02, r.y, px, CC.CONFIG.hud.colors.yellow, { align: 'right' });
      const kr = Math.max(10 * this.pixelRatio(), (r.h - lh) * 0.3), pad = kr * 1.3, ty = r.y + lh + (r.h - lh) / 2, tx = r.x + pad, tw = r.w - pad * 2, th = Math.max(6, kr * 0.5);
      const zone = { x: r.x, y: r.y + lh * 0.6, w: r.w, h: r.h - lh * 0.6 };
      let last = Math.round(value * 10);
      const set = (xp, first) => {
        const v = U.clamp((xp - tx) / tw, 0, 1), s = Math.round(v * 10);
        if (s !== last && CC.Haptics) CC.Haptics.light();
        last = s; onChange(v, first);
      };
      const b = { x: zone.x, y: zone.y, w: zone.w, h: zone.h, idx: this.buttons.length, clip: this.clip, drag: set, dragEnd: () => { this.feedback('tab'); if (onEnd) onEnd(); } };
      this.buttons.push(b);
      const active = !!(this.drag && this.drag.idx === b.idx), k2 = kr * (active ? 1.25 : 1);
      ctx.fillStyle = '#2a2a32'; ctx.fillRect(tx, ty - th / 2, tw, th);
      ctx.fillStyle = CC.CONFIG.hud.colors.yellow; ctx.fillRect(tx, ty - th / 2, tw * value, th);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(tx + tw * value - k2, ty - k2, k2 * 2, k2 * 2);
      ctx.strokeStyle = '#14141a'; ctx.lineWidth = Math.max(2, k2 * 0.2); ctx.strokeRect(tx + tw * value - k2, ty - k2, k2 * 2, k2 * 2);
    },

    // ---------- défilement ----------
    // Ouvre une zone rognée qui défile ; dessiner le contenu avec (y - retour). Fermer par scrollEnd.
    scrollBegin(ctx, id, r, contentH) {
      const s = this.scrolls[id] || (this.scrolls[id] = { y: 0, v: 0, max: 0 });
      s.max = Math.max(0, contentH - r.h); s.y = U.clamp(s.y, 0, s.max);
      this.regions.push({ id, x: r.x, y: r.y, w: r.w, h: r.h });
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      this.clip = { x: r.x, y: r.y, w: r.w, h: r.h };
      this.curScroll = { id, r, s };
      return s.y;
    },
    scrollEnd(ctx) {
      const { r, s } = this.curScroll;
      ctx.restore(); this.clip = null;
      if (s.max > 0) {                                       // fine barre + dégradés pour montrer qu'il y a une suite
        const bh = Math.max(r.h * 0.12, r.h * r.h / (r.h + s.max)), by = r.y + (r.h - bh) * (s.y / s.max);
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(r.x + r.w - 5 * this.pixelRatio(), by, 3 * this.pixelRatio(), bh);
        if (s.y > 2) { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.05); g.addColorStop(0, 'rgba(6,8,12,0.9)'); g.addColorStop(1, 'rgba(6,8,12,0)'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h * 0.05); }
        if (s.y < s.max - 2) { const g = ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h * 0.95); g.addColorStop(0, 'rgba(6,8,12,0.9)'); g.addColorStop(1, 'rgba(6,8,12,0)'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y + r.h * 0.95, r.w, r.h * 0.05); }
      }
    },
    // élan du défilement (inertie) et temps des animations, une fois par image
    tickKit(dt) {
      this.dt = dt; this.t += dt; this.screenT += dt;
      for (const id in this.scrolls) {
        const s = this.scrolls[id];
        if (s.v && !(this.ptr && this.ptr.down && this.scrollReg && this.scrollReg.id === id)) {
          s.y += s.v * dt; s.v *= Math.exp(-dt * 4);
          if (s.y < 0 || s.y > s.max) { s.y = U.clamp(s.y, 0, s.max); s.v = 0; }
          if (Math.abs(s.v) < 8) s.v = 0;
          this.needFrames();
        }
      }
      if (this.tapFlash && (this.tapFlash.t += dt) > 0.3) this.tapFlash = null;
    },

    // ---------- icônes dessinées (la police du jeu n'a ni coche ni cadenas) ----------
    star(ctx, cx, cy, r, filled, color) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath();
      if (filled) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(200,200,200,0.55)'; ctx.lineWidth = Math.max(1, r * 0.16); ctx.stroke(); }
    },
    iconLock(ctx, cx, cy, s, color) {
      ctx.fillStyle = color; ctx.fillRect(cx - s * 0.55, cy - s * 0.1, s * 1.1, s * 0.85);
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, s * 0.22);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.32, cy - s * 0.1); ctx.lineTo(cx - s * 0.32, cy - s * 0.5); ctx.lineTo(cx + s * 0.32, cy - s * 0.5); ctx.lineTo(cx + s * 0.32, cy - s * 0.1); ctx.stroke();
    },
    iconCheck(ctx, cx, cy, s, color) {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, s * 0.34); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy + s * 0.05); ctx.lineTo(cx - s * 0.2, cy + s * 0.55); ctx.lineTo(cx + s * 0.75, cy - s * 0.5); ctx.stroke();
    },
    iconBack(ctx, cx, cy, s, color) {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, s * 0.34);
      ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.8); ctx.lineTo(cx - s * 0.45, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.8); ctx.stroke();
    },
    iconClose(ctx, cx, cy, s, color) {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, s * 0.3);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy - s * 0.7); ctx.lineTo(cx + s * 0.7, cy + s * 0.7); ctx.moveTo(cx + s * 0.7, cy - s * 0.7); ctx.lineTo(cx - s * 0.7, cy + s * 0.7); ctx.stroke();
    },
    iconGear(ctx, cx, cy, s, color) {
      ctx.fillStyle = color;
      for (let i = 0; i < 8; i++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-s * 0.17, -s * 1.08, s * 0.34, s * 0.5); ctx.restore(); }
      ctx.strokeStyle = color; ctx.lineWidth = s * 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke();
    },
    iconPause(ctx, cx, cy, s, color) { ctx.fillStyle = color; ctx.fillRect(cx - s * 0.7, cy - s * 0.8, s * 0.5, s * 1.6); ctx.fillRect(cx + s * 0.2, cy - s * 0.8, s * 0.5, s * 1.6); },
    iconPlay(ctx, cx, cy, s, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.85); ctx.lineTo(cx + s * 0.8, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.85); ctx.closePath(); ctx.fill(); },
    // coupe de trophée (BRONZE / ARGENT / OR), grisée tant qu'elle n'est pas gagnée
    trophy(ctx, cx, cy, s, color, won) {
      ctx.fillStyle = won ? color : 'rgba(120,120,120,0.35)';
      ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.5); ctx.lineTo(cx + s * 0.5, cy - s * 0.5); ctx.lineTo(cx + s * 0.3, cy + s * 0.05); ctx.lineTo(cx - s * 0.3, cy + s * 0.05); ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - s * 0.07, cy + s * 0.05, s * 0.14, s * 0.25); ctx.fillRect(cx - s * 0.28, cy + s * 0.3, s * 0.56, s * 0.12);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, s * 0.08);
      for (const e of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + e * s * 0.5, cy - s * 0.3, s * 0.16, e < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, e < 0 ? Math.PI * 1.5 : Math.PI * 0.5, e > 0); ctx.stroke(); }
    },
  };

  CC.UIKit = Kit;
})();
