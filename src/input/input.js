/* Entrées : souris (pointer lock) + clavier, et pilote automatique pour les tests reproductibles.
 * Contrôles (CHOIX validé) : souris = visée, clic gauche = tir/réapparition, clic droit maintenu = grappin,
 * W,A,S,D (ou Z,Q,S,D, ou flèches) = piloter, Espace maintenue = moteur (v011, G en v009-v010), Maj maintenue = rétro-fusées,
 * R = reset, Échap = menu, Tab = réglages, F1 = touches. */
(function () {
  const U = CC.U;
  const V = THREE.Vector3;
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const AX = new V(1, 0, 0), AY = new V(0, 1, 0), FWD = new V(0, 0, -1);
  const _f = new V(), _up = new V(), _want = new V(), _x = new V();

  class Input {
    constructor(game, el) {
      this.game = game; this.el = el;
      this.yaw = 0; this.pitch = 0;
      // v011 : visée = orientation complète (quaternion), sans butée à ±88° : loopings et vol sur le dos possibles
      this.aimQ = new THREE.Quaternion(); this.pitchActiveT = 0;
      this.keys = {}; this.edges = {};
      this.fireEdge = false; this.grappleHeld = false; this.grappleEdge = false;
      this.locked = false; this.enabled = true;
      // Z,Q,S,D : `e.code` désigne la position physique de la touche, pas son étiquette (sur un clavier AZERTY,
      // la touche « Z » produit le code KeyW). On enregistre donc à la fois le code et la lettre tapée :
      // le code couvre Z,Q,S,D sur AZERTY, la lettre couvre les dispositions qui placent ces lettres ailleurs.
      const onKey = (e, down) => {
        const k = e.code;
        const codes = [k];
        if (e.key && e.key.length === 1) codes.push('Key' + e.key.toUpperCase());
        if (['Tab', 'F1', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
        for (const c of codes) {
          if (down && !this.keys[c]) this.edges[c] = true;
          this.keys[c] = down;
        }
        if (down) game.onKey(k);
      };
      window.addEventListener('keydown', (e) => onKey(e, true));
      window.addEventListener('keyup', (e) => onKey(e, false));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      // v033-ux : interface (menus, pause, boutique…) = événements « pointeur » (souris ET doigt) : appui, glissé, relâchement.
      // L'action d'un bouton part au relâchement ; le jeu lui-même n'est piloté que par les événements ci-dessous.
      const uiOn = () => game.ui && game.ui.active();
      let lastTouchUp = -1e9;
      el.addEventListener('pointerdown', (e) => {
        game.audio.init(); game.audio.resume();
        if (!uiOn() || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const p = game.ui.toLocal(e);
        game.ui.pointerDown(p.x, p.y, e);
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
      });
      el.addEventListener('pointermove', (e) => { if (game.ui) { const p = game.ui.toLocal(e); game.ui.pointerMove(p.x, p.y); } });
      el.addEventListener('pointerup', (e) => {
        if (e.pointerType !== 'mouse') lastTouchUp = performance.now();
        if (game.ui && game.ui.ptr) { const p = game.ui.toLocal(e); game.ui.pointerUp(p.x, p.y); }
      });
      el.addEventListener('pointercancel', () => { if (game.ui) game.ui.pointerCancel(); });
      el.addEventListener('wheel', (e) => { if (uiOn() && game.ui.wheel(e.deltaY)) e.preventDefault(); }, { passive: false });
      el.addEventListener('mousedown', (e) => {
        game.audio.init(); game.audio.resume();
        if (uiOn()) return;                                        // le pointeur appartient à l'interface
        if (performance.now() - lastTouchUp < 800) return;         // « faux » clic que le navigateur génère après un toucher
        if (!this.locked && !game.testMode) this.requestLock();
        if (e.button === 0) this.fireEdge = true;
        if (e.button === 2) { this.grappleHeld = true; this.grappleEdge = true; }
      });
      window.addEventListener('mouseup', (e) => { if (e.button === 2) this.grappleHeld = false; });
      document.addEventListener('mousemove', (e) => {
        if (!this.locked || !this.enabled) return;
        const s = game.settings.sensitivity;
        this.addAim(-e.movementX * s, -e.movementY * s * (game.settings.invertY ? -1 : 1));
      });
      document.addEventListener('pointerlockchange', () => {
        const was = this.locked;
        this.locked = document.pointerLockElement === el;
        if (was && !this.locked) game.onPointerLost();
      });
    }

    requestLock() { try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignoré */ } }
    exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

    // Rotations dans le repère de la roquette : lacet autour de son « haut », tangage autour de sa « droite ».
    addAim(dy, dp) {
      if (dy) this.aimQ.multiply(_q.setFromAxisAngle(AY, dy));
      if (dp) { this.aimQ.multiply(_q.setFromAxisAngle(AX, dp)); this.pitchActiveT = 0.3; }
      this.aimQ.normalize();
    }
    setAim(yaw, pitch) { this.aimQ.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ')); }

    /* Au lanceur : visée classique (pas de roulis, tangage borné). En vol : horizon remis à plat doucement,
     * sauf pendant un tangage (sinon un looping serait interrompu) et près de la verticale (roulis indéfini). */
    constrainAim(dt) {
      const flying = this.game.state === 'FLIGHT';
      this.pitchActiveT = Math.max(0, this.pitchActiveT - dt);
      if (!flying) {
        _e.setFromQuaternion(this.aimQ, 'YXZ');
        const lim = U.deg(CC.CONFIG.input.maxPitchDeg);
        this.setAim(_e.y, U.clamp(_e.x, -lim, lim));
        return;
      }
      const f = _f.copy(FWD).applyQuaternion(this.aimQ);   // v030 : vecteurs réutilisés (appelé à chaque image)
      if (this.pitchActiveT > 0 || Math.abs(f.y) > 0.9 || dt <= 0) return;
      const up = _up.copy(AY).applyQuaternion(this.aimQ);
      const want = _want.copy(AY).addScaledVector(f, -f.y).normalize();
      const ang = Math.atan2(_x.crossVectors(up, want).dot(f), up.dot(want));
      this.aimQ.premultiply(_q.setFromAxisAngle(f, ang * U.damp(CC.CONFIG.input.autoLevel, dt))).normalize();
    }

    // État consommé par le jeu à chaque image.
    poll(dt) {
      const k = this.keys;
      const ar = 1.8 * dt;
      const turnLeft = k.ArrowLeft || k.KeyA || k.KeyQ;    // Q sur AZERTY, A sur QWERTY
      const turnRight = k.ArrowRight || k.KeyD;
      const pitchUp = k.ArrowUp || k.KeyW || k.KeyZ;       // Z sur AZERTY, W sur QWERTY
      const pitchDown = k.ArrowDown || k.KeyS;
      if (turnLeft) this.addAim(ar, 0);
      if (turnRight) this.addAim(-ar, 0);
      if (pitchUp) this.addAim(0, ar);
      if (pitchDown) this.addAim(0, -ar);
      const t = this.touch;   // v022 : écran tactile (src/input/touch.js) : le glissé agit directement via addAim, ici seul le moteur
      this.constrainAim(dt);
      const st = {
        aimQ: (this._stQ || (this._stQ = new THREE.Quaternion())).copy(this.aimQ),   // v030 : lu aussitôt par le jeu
        fire: this.fireEdge, grappleHeld: this.grappleHeld, grappleEdge: this.grappleEdge,
        retro: !!(k.ShiftLeft || k.ShiftRight),
        thrust: !!k.Space || !!(t && t.thrust),
      };
      this.fireEdge = false; this.grappleEdge = false; this.edges = {};
      return st;
    }
  }

  /* Pilote automatique : suit la route du niveau (poursuite pure) en produisant les mêmes commandes qu'un joueur.
   * Sert au protocole de test (enregistrements comparables d'une version à l'autre). */
  class Autopilot {
    constructor(game, level) {
      this.game = game; this.level = level;
      const rt = level.routes ? level.routes[Math.min(game.targetsDone || 0, level.routes.length - 1)] : level.route;
      this.route = (rt || []).map((p) => new V().fromArray(p));
      const ra = level.routeActionsPer ? level.routeActionsPer[Math.min(game.targetsDone || 0, level.routeActionsPer.length - 1)] : level.routeActions;   // v032 : une liste par route
      this.actions = (ra || []).map((a) => Object.assign({}, a));   // copie : état propre à chaque tentative
      this.idx = 0; this.t = 0; this.fired = false;
      this.yaw = 0; this.pitch = 0;
      this.lookAhead = level.lookAhead || 14;
      this.fireDelay = level.fireDelay !== undefined ? level.fireDelay : 0.35;
    }
    init(yaw, pitch) { this.yaw = yaw; this.pitch = pitch; }
    poll(dt) {
      this.t += dt;
      const g = this.game, rk = g.rocket;
      const st = { yaw: this.yaw, pitch: this.pitch, fire: false, grappleHeld: false, grappleEdge: false, retro: false, thrust: false };
      if (g.state === 'AIM') {
        if (this.route.length > 1) this.aimAt(this.route[1], dt, 4);
        if (this.t > this.fireDelay && !this.fired) { st.fire = true; this.fired = true; }
      } else if (g.state === 'FLIGHT' && rk.active && this.route.length) {
        // point le plus proche (avance monotone) puis point d'anticipation
        const R = this.route;
        let best = this.idx, bd = Infinity;
        for (let i = this.idx; i < Math.min(R.length - 1, this.idx + 6); i++) {
          const d = this.segDist(rk.pos, R[i], R[i + 1]);
          if (d.dist < bd) { bd = d.dist; best = i; }
        }
        this.idx = best;
        // anticipation proportionnelle à la vitesse + compensation du retard de la trajectoire (navigation proportionnelle simplifiée)
        const la = U.clamp(rk.speed * 0.2, 7, this.lookAhead);
        let target = this.pointAhead(rk.pos, la);
        // phase finale : viser directement la cible vivante la plus proche si elle est devant (cibles mobiles)
        // (uniquement la cible visée par cette route : la plus proche de son dernier point)
        let goal = null, gd = Infinity;
        for (const t of g.targets) { if (!t.alive || t.guard) continue; const d = t.obb.c.distanceTo(R[R.length - 1]) - (t.patrolRadius || 0); if (d < 18 && d < gd) { gd = d; goal = t; } }
        let mover = g.targets.find((t) => t.alive && !t.guard && t.path);   // v023 : cible qui s'enfuit → poursuite dès qu'elle est à portée
        if (!mover && goal && goal.patrol) mover = goal;                      // v032 : hélicoptère en patrouille (générateur)
        if (mover) goal = mover;
        if (goal) {
          const to = new V().subVectors(goal.obb.c, rk.pos), tl = to.length();
          // v032 : pas de ralliement direct si un obstacle masque la cible (hangar, filet, cour) : on suit la route
          const hidden = this.level.generated && tl > 3 && g.world.blocked(rk.pos, to.clone().divideScalar(tl), tl - 3, (b) => b.kind === 'solid' || b.kind === 'brick');
          if (tl < (this.level.terminalRange || 40) && to.angleTo(rk.vel) < 1.0 && (mover || this.idx >= R.length - 3) && !hidden) target = goal.obb.c.clone();
          else if (goal.patrol && this.idx >= R.length - 2 && !hidden) target = goal.obb.c.clone();   // v032 : cible en patrouille dépassée → demi-tour vers elle
        }
        const desired = new V().subVectors(target, rk.pos).normalize();
        const vDir = rk.vel.clone().normalize();
        // compensation du retard de la trajectoire, réglée pour grip = 11 ; une roquette plus réactive en demande moins (v019)
        const pn = (this.level.pnGain !== undefined ? this.level.pnGain : 1.3) * Math.pow(11 / CC.CONFIG.rocket.grip, 2);
        const aim = desired.clone().addScaledVector(new V().subVectors(desired, vDir), pn).normalize();
        if (aim.angleTo(desired) > 1.0) aim.copy(desired).lerp(aim, 1.0 / aim.angleTo(desired)).normalize();
        // v020 : esquive des missiles anti-aériens, comme un joueur : virer franchement perpendiculairement à l'axe
        // du missile, du côté où l'on s'écarte déjà
        // seulement si le missile est sur une trajectoire de collision (passage prévu à moins de 3,5 m)
        const onCourse = (m) => {
          const r = new V().subVectors(m.pos, rk.pos), vr = new V().copy(m.dir).multiplyScalar(m.speed).sub(rk.vel);
          const t = -r.dot(vr) / Math.max(vr.lengthSq(), 1e-6);
          return t > 0 && r.addScaledVector(vr, t).length() < 3.5;
        };
        const threat = g.missiles.filter((m) => m.alive && m.pos.distanceTo(rk.pos) < CC.CONFIG.aa.warnDist && onCourse(m))
          .sort((a, b) => a.pos.distanceTo(rk.pos) - b.pos.distanceTo(rk.pos))[0];
        if (threat) {
          // v023 : direction d'esquive la plus dégagée parmi gauche / droite / haut / bas (perpendiculaires à l'axe du missile),
          // choisie une fois par menace : dans une tranchée ou un canyon, s'écarter sur le côté mène droit dans la paroi
          if (!this.evadeDir) {
            const los = new V().subVectors(rk.pos, threat.pos).normalize();
            let side = new V().crossVectors(los, new V(0, 1, 0));
            if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
            side.normalize();
            const up = new V().crossVectors(side, los).normalize();
            let best = null, bestFree = -1;
            for (const c of [side, side.clone().negate(), up, up.clone().negate()]) {
              const hit = g.world.raycast(rk.pos, c, 30);
              const free = hit ? hit.dist : 30;
              if (free > bestFree) { bestFree = free; best = c; }
            }
            this.evadeDir = best;
          }
          aim.addScaledVector(this.evadeDir, 1.6).normalize();
        } else this.evadeDir = null;
        this.aimAt(new V().copy(rk.pos).addScaledVector(aim, 20), dt, 14);
        let wantOff = false;
        for (const a of this.actions) {
          if (a.from !== undefined && this.idx >= a.from && this.idx < a.to) {
            if (a.retro) { if (a._r0 === undefined) a._r0 = this.t; if (!a.hold || this.t - a._r0 < a.hold) st.retro = true; }
            if (a.engineOff && rk.speed > 40) wantOff = true;   // v021 : jamais sous 40 m/s (planer au ralenti = cible immobile pour les tirs anti-aériens)
            if (a.grapple) {
              if (!a._fired) { st.grappleEdge = true; a._fired = true; a._t0 = this.t; }
              if (!a.hold || this.t - a._t0 < a.hold) st.grappleHeld = true;
            }
          }
        }
        st.thrust = !wantOff;
      }
      st.yaw = this.yaw; st.pitch = this.pitch;
      return st;
    }
    segDist(p, a, b) {
      const ab = new V().subVectors(b, a), t = U.clamp(new V().subVectors(p, a).dot(ab) / ab.lengthSq(), 0, 1);
      return { dist: new V().copy(a).addScaledVector(ab, t).distanceTo(p), t };
    }
    pointAhead(p, dist) {
      const R = this.route;
      let i = this.idx, pr = this.segDist(p, R[i], R[i + 1]);
      let cur = new V().copy(R[i]).lerp(R[i + 1], pr.t);
      let left = dist;
      while (i < R.length - 1) {
        const segLeft = cur.distanceTo(R[i + 1]);
        if (segLeft >= left) return cur.clone().add(new V().subVectors(R[i + 1], cur).setLength(left));
        left -= segLeft; cur = R[i + 1].clone(); i++;
      }
      return R[R.length - 1].clone().add(new V().subVectors(R[R.length - 1], R[Math.max(0, R.length - 2)]).setLength(left));
    }
    aimAt(target, dt, rate) {
      const g = this.game;
      const from = g.state === 'AIM' ? g.launcherEye : g.rocket.pos;
      const d = new V().subVectors(target, from);
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = yaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const k = U.damp(rate, dt);
      this.yaw += dy * k; this.pitch += (pitch - this.pitch) * k;
    }
  }

  CC.Input = Input; CC.Autopilot = Autopilot;
})();
