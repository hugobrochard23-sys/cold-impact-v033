/* Vibrations / haptics (v024, centralisées en v033-ux). Point d'entrée unique : CC.Haptics.
 *
 * Trois niveaux de retour, à utiliser selon l'importance de l'événement :
 *   light()   pression d'un bouton, navigation, sélection, petite interaction
 *   medium()  récompense, équipement, action importante, événement positif
 *   heavy()   événement majeur : gros impact, explosion
 * plus trois motifs : success() (double impulsion montante), error() (deux impulsions sèches) et unlock() (achat, déblocage).
 * Le boost garde sa vibration continue (boostStart / boostStop).
 *
 * Réglage « VIBRATION » (game.settings.vibration) : 0 = OFF, 1 = LÉGÈRE, 2 = MOYENNE, 3 = FORTE.
 * Le niveau agit comme un réglage d'intensité : chaque événement est vibré plus ou moins longtemps.
 *  - Android et navigateurs qui ont l'API Vibration : navigator.vibrate (impulsions et motifs).
 *  - iPhone : Safari n'a pas cette API. Repli : un interrupteur invisible (<input type="checkbox" switch>, Safari 17.4+)
 *    produit un « tic » haptique quand on le bascule. Apple a bloqué ce déclenchement par script à partir d'iOS 26.5 :
 *    sur un iPhone à jour, il est probable que rien ne vibre. Pas de vibration continue possible : des tics rapprochés.
 *  - Aucune API (ordinateur) : tout est ignoré sans erreur.
 * Toute erreur est avalée : la vibration est un bonus, jamais une condition pour jouer. */
(function () {
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  let sw = null;
  function iosTick() {
    try {
      if (!sw) {
        const label = document.createElement('label');
        label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.setAttribute('switch', '');
        label.appendChild(input); document.body.appendChild(label);
        sw = label;
      }
      sw.click();
    } catch (e) { /* pas de retour haptique disponible */ }
  }

  // motifs en ms selon l'intensité [OFF, LÉGÈRE, MOYENNE, FORTE] ; un tableau = impulsion, pause, impulsion…
  const PATTERNS = {
    light:   [0, 6, 10, 16],
    medium:  [0, 14, 26, 42],
    heavy:   [0, 28, 50, 80],
    success: [0, [10, 45, 16], [14, 50, 26], [18, 55, 40]],
    error:   [0, [14, 50, 14], [22, 55, 22], [32, 60, 32]],
    unlock:  [0, [14, 40, 14, 40, 30], [24, 45, 24, 45, 50], [36, 50, 36, 50, 80]],   // achat / déblocage : trois coups montants
  };
  // anciens noms d'événements (appelés par le jeu en vol) → niveau sémantique
  const LEGACY = { button: 'light', touch: 'light', fire: 'medium', warn: 'medium', boost: 'medium' };

  const H = {
    level: 2,
    supported: canVibrate || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent || '')),
    // vibration continue du boost : [durée vibrée, pause] par cycle ; iPhone : intervalle entre deux tics (ms)
    cont: [null, [14, 56], [28, 32], [60, 10]], iosEvery: [0, 220, 130, 75],
    timer: null,

    play(kind) {
      const p = PATTERNS[kind] && PATTERNS[kind][this.level];
      if (!p) return;
      if (canVibrate) { try { navigator.vibrate(p); } catch (e) { /* ignoré */ } return; }
      iosTick();
      if (Array.isArray(p)) setTimeout(iosTick, p[0] + p[1]);   // motif à deux temps : deux tics espacés
    },
    light() { this.play('light'); },
    medium() { this.play('medium'); },
    heavy() { this.play('heavy'); },
    success() { this.play('success'); },
    error() { this.play('error'); },
    unlock() { this.play('unlock'); },   // une seule demande : un nouvel appel à navigator.vibrate coupe le précédent
    // compatibilité : tick('button' | 'touch' | 'fire' | 'warn' | 'boost') ou directement un niveau
    tick(kind) { this.play(PATTERNS[kind] ? kind : (LEGACY[kind] || 'light')); },

    boostStart() {
      this.boostStop();
      if (!this.level) return;
      this.medium();
      if (canVibrate) {
        const [on, off] = this.cont[this.level], pattern = [];
        for (let t = 0; t < 4000; t += on + off) pattern.push(on, off);
        const run = () => { try { navigator.vibrate(pattern); } catch (e) { /* ignoré */ } };
        run(); this.timer = setInterval(run, 3900);            // motif relancé avant sa fin : vibration sans trou
      } else this.timer = setInterval(iosTick, this.iosEvery[this.level]);
    },
    boostStop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (canVibrate) { try { navigator.vibrate(0); } catch (e) { /* ignoré */ } }
    },
    setLevel(l) { this.level = Math.max(0, Math.min(3, l | 0)); if (!this.level) this.boostStop(); },
  };
  CC.Haptics = H;
})();
