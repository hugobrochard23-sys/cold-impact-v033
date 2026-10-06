/* Commandes tactiles (v022, iPhone / tablette) — en vol, l'écran est entièrement dédié au pilotage :
 *  - glisser le doigt n'importe où : dirige la roquette (comme la souris : droite = tourne à droite, haut = monte) ;
 *  - toucher (tap) : tir depuis le lanceur, ou réapparition après un crash ;
 *  - appui long (doigt immobile ≥ 0,4 s) en vol : boost tant que le doigt reste posé, avec vibration continue (v024) ;
 *    boost relâché → pendant 0,6 s (v029), reposer le doigt relance le boost aussitôt (v026) ; mini vibration à chaque toucher (v026) ;
 *  - doigt dans la bande gauche / droite de l'écran : virage sans fin (v024) ; au lanceur, la vue ne bouge pas (v024) ;
 *  - bouton pause en haut à droite (src/ui/dombuttons.js) : menu pause.
 * Réglages (v033-ux) : sensibilité du glissé (settings.touchSens) et inversion haut / bas (settings.invertY).
 * Plein écran, affichage allégé et rendu moins coûteux (fluidité). Les menus se touchent directement (src/ui/widgets.js).
 * Actives seulement sur un écran tactile, ou avec #touch / ?touch=1 dans l'adresse (essai sur ordinateur). */
(function () {
  function wanted() {
    if (/(^|[#&])touch\b/.test(location.hash) || /[?&]touch=1\b/.test(location.search)) return true;
    return (navigator.maxTouchPoints || 0) > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  const FLY = ['AIM', 'FLIGHT', 'IMPACT', 'CRASHED', 'RESPAWN'];

  function attach(game) {
    if (!wanted()) return null;
    const input = game.input, cfg = CC.CONFIG.input.touch;
    const T = input.touch = { thrust: false, reboostUntil: 0, edgeAt: 0 };   // reboostUntil : fin de la fenêtre de relance du boost (v026) ; edgeAt : dernier virage au bord (tutoriel)
    CC.Touch.active = true;
    document.body.classList.add('cc-touch');

    // fluidité : définition, ombres et effets réglés par le niveau de qualité (src/core/quality.js, v030)

    const wake = () => { game.audio.init(); game.audio.resume(); };   // iOS : le son ne démarre qu'après un geste
    const playing = () => FLY.includes(game.state) && !game.paused && !game.ui.overlay && !game.ui.modal;
    const onButton = (e) => !!(e.target && e.target.closest && e.target.closest('.cc-dombtn'));   // boutons pause / passer : un vrai clic
    const buzz = (k) => { if (CC.Haptics) CC.Haptics.tick(k); };

    // --- glisser / toucher / appui long ---
    let finger = null;
    const scale = () => cfg.dragGain * (game.settings.touchSens || 1) / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const boostOff = () => { if (T.thrust) { T.thrust = false; if (CC.Haptics) CC.Haptics.boostStop(); } };
    const boostOn = () => { T.thrust = true; game.audio.play('toggle'); if (CC.Haptics) CC.Haptics.boostStart(); };
    document.addEventListener('touchstart', (e) => {
      wake();
      if (!playing() || onButton(e)) return;          // menus, pause, boutons : le toucher devient un clic sur l'interface
      e.preventDefault();
      buzz('touch');                                 // v026 : mini vibration dès que le doigt touche l'écran en partie
      if (finger) return;                            // un seul doigt pilote
      const t = e.changedTouches[0];
      finger = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now(), moved: false };
      // v026 : dans la seconde qui suit la fin d'un boost, reposer le doigt relance le boost tout de suite (sans appui long)
      if (game.state === 'FLIGHT' && performance.now() < T.reboostUntil) { finger.boost = true; T.reboostUntil = 0; boostOn(); }
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (!finger) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== finger.id) continue;
        // v024 : au lanceur, la vue ne bouge pas ; en vol, le glissé dirige
        if (game.state === 'FLIGHT') { const k = scale(); input.addAim(-(t.clientX - finger.x) * k, -(t.clientY - finger.y) * k * (game.settings.invertY ? -1 : 1)); }
        finger.x = t.clientX; finger.y = t.clientY;
        if (Math.hypot(t.clientX - finger.x0, t.clientY - finger.y0) > cfg.tapMaxMove) finger.moved = true;
      }
    }, { passive: false });
    const end = (e) => {
      if (!finger) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== finger.id) continue;
        const tap = !finger.moved && !finger.boost && performance.now() - finger.t0 < cfg.tapMaxMs;
        if (finger.boost && game.state === 'FLIGHT') T.reboostUntil = performance.now() + cfg.reboostMs;   // v026
        finger = null;
        boostOff();                                  // v024 : doigt levé → boost coupé
        if (!tap || !playing()) return;
        e.preventDefault();
        if (game.state !== 'FLIGHT') { input.fireEdge = true; if (game.state === 'AIM') buzz('fire'); }   // tir (ou réapparition)
      }
    };
    document.addEventListener('touchend', end, { passive: false });
    document.addEventListener('touchcancel', end, { passive: false });

    // à chaque image du jeu : appui long → boost ; doigt dans une bande latérale → virage continu
    const tick = game.tick.bind(game);
    game.tick = (dt) => {
      tick(dt);
      const flying = game.state === 'FLIGHT' && playing();
      if (finger && flying) {
        // v024 : appui long (doigt immobile ≥ longPressMs) → boost, maintenu tant que le doigt reste posé (il peut alors bouger)
        if (!finger.boost && !finger.moved && performance.now() - finger.t0 >= cfg.longPressMs) {
          finger.boost = true; boostOn();
        }
        // v024 : virage sans fin quand le doigt est dans la bande de gauche ou de droite (plus vite près du bord) ;
        // haut / bas : inchangés (glissé relatif)
        const x = finger.x / Math.max(1, window.innerWidth), b = cfg.edgeBand;
        const push = x < b ? -(b - x) / b : x > 1 - b ? (x - (1 - b)) / b : 0;
        if (push) { input.addAim(-push * cfg.edgeTurnRate * dt, 0); T.edgeAt = performance.now(); }
      }
      if (!flying) { boostOff(); if (game.state !== 'FLIGHT') T.reboostUntil = 0; }   // pause : la fenêtre reste ouverte
    };
    game.resize();   // plein écran
    return T;
  }

  CC.Touch = { attach, wanted };
})();
