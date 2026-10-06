/* Boutons « vrais éléments de page » affichés par-dessus le jeu pendant la partie (v033-ux) :
 *  - PAUSE (en haut à droite) : toujours disponible en partie, au doigt comme à la souris ;
 *  - PASSER (en haut à gauche) : seulement pendant le tutoriel.
 * Ce sont des éléments HTML (et non des dessins du canvas) parce qu'en vol tout toucher sur le canvas sert à piloter :
 * un vrai bouton reçoit son propre clic, sans conflit avec le pilotage (src/input/touch.js les laisse tranquilles).
 * Styles : style.css (.cc-dombtn). Marges : zones système du téléphone respectées. */
(function () {
  const FLY = ['AIM', 'FLIGHT', 'IMPACT', 'CRASHED', 'RESPAWN'];

  function make(cls, label, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cc-dombtn ' + cls; b.setAttribute('aria-label', label); b.hidden = true;
    if (text) b.textContent = text;
    b.addEventListener('click', (e) => { e.preventDefault(); onClick(); });
    // le clavier ne doit pas « cliquer » un bouton resté sélectionné (Espace = boost, Entrée = rien)
    b.addEventListener('keydown', (e) => e.preventDefault());
    b.addEventListener('focus', () => b.blur());
    document.body.appendChild(b);
    return b;
  }

  function attach(game) {
    const pause = make('cc-pause', 'Pause', '', () => { game.audio.init(); game.audio.resume(); if (CC.Haptics) CC.Haptics.light(); game.pause(); });
    const skip = make('cc-skip', 'Skip the tutorial', 'SKIP >', () => { if (CC.Haptics) CC.Haptics.light(); game.tutorial.finish(true); });
    return {
      // appelé à chaque image : visibilité selon l'état du jeu
      update() {
        const touch = !!(CC.Touch && CC.Touch.active);
        const playing = FLY.includes(game.state) && !game.paused && !game.ui.overlay && !game.ui.modal;
        // à la souris, la souris est capturée en vol (curseur caché) : le bouton ne sert qu'aux moments où le curseur est libre
        pause.hidden = !(playing && (touch || !game.input.locked));
        skip.hidden = !(playing && game.tutorial && game.tutorial.active && (touch || !game.input.locked));
      },
    };
  }

  CC.DomButtons = { attach };
})();
