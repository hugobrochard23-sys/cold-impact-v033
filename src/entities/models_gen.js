/* Modèles des nouvelles cibles du générateur de missions (v032), dans le style des modèles existants (low-poly, pièces
 * fusionnées par matériau avec CC.Models.bake, avant = −Z) : station radar, dépôt de carburant, poste de commandement,
 * lance-missiles sol-air. Chacun déclare userData.size / center (boîte de collision de la cible). */
(function () {
  const M = CC.Models, { lam, basic, box, cyl, cylX, cylZ } = M.kit;
  const V = THREE.Vector3;

  // Châssis de camion militaire à 6 roues (partagé radar / lance-missiles), sur le groupe `body`
  function chassis(body, olive, dark, len) {
    const tire = lam('#141414'), hub = lam('#3a3a32'), frame = lam('#2e2f24');
    box(2.2, 0.3, len, frame, 0, 0.75, 0, body);
    box(2.3, 1.3, 1.6, olive, 0, 1.55, -len / 2 + 0.9, body);                 // cabine
    box(2.1, 0.55, 0.9, dark, 0, 1.1, -len / 2 - 0.2, body);                   // capot
    const glass = CC.Look.glass({ color: '#233040', specular: '#8aa0b8', shininess: 50 });
    box(2.0, 0.55, 0.05, glass, 0, 1.95, -len / 2 + 0.08, body);
    for (const sx of [-1, 1]) {
      const hl = box(0.2, 0.16, 0.06, basic('#fff0c8'), sx * 0.75, 1.15, -len / 2 - 0.66, body); hl.castShadow = false;
      for (const z of [-len / 2 + 1.0, len / 2 - 2.0, len / 2 - 0.8]) {
        cylX(0.46, 0.46, 0.34, tire, 12, sx * 1.12, 0.46, z, body);
        cylX(0.2, 0.2, 0.36, hub, 8, sx * 1.12, 0.46, z, body);
      }
      box(0.05, 0.25, len - 2.2, dark, sx * 1.16, 1.0, 0.8, body);            // longeron
    }
    box(2.3, 0.12, len - 1.8, dark, 0, 0.98, 0.9, body);                        // plateau
  }

  /* Station radar mobile : camion porteur, mât télescopique, antenne plane qui tourne (dish), groupe électrogène,
   * vérins de stabilisation, feu rouge au sommet. */
  M.radar = function () {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const olive = lam('#4e5a3c'), dark = lam('#39432c'), metal = lam('#50545a'), panel = lam('#c8ccc4');
    chassis(body, olive, dark, 7.4);
    box(2.2, 1.6, 2.4, olive, 0, 1.85, 1.9, body);                              // abri électronique
    for (let i = 0; i < 4; i++) box(0.04, 1.2, 0.3, dark, 1.12, 1.85, 1.0 + i * 0.6, body);   // grilles d'aération
    for (const sx of [-1, 1]) for (const z of [-1.8, 2.9]) { box(0.14, 0.9, 0.14, metal, sx * 1.35, 0.5, z, body); box(0.5, 0.06, 0.5, metal, sx * 1.35, 0.05, z, body); }   // vérins
    cyl(0.28, 0.34, 3.2, metal, 10, body).position.set(0, 3.3, 0.2);         // mât
    const dish = new THREE.Group(); dish.name = 'dish'; dish.position.set(0, 5.0, 0.2); g.add(dish);
    const face = new THREE.Group(); face.rotation.x = -0.35; dish.add(face);
    box(4.6, 2.2, 0.18, panel, 0, 0.9, 0, face);                                 // antenne plane
    for (let i = 0; i < 6; i++) box(0.05, 2.1, 0.05, lam('#8a8e88'), -2.0 + i * 0.8, 0.9, -0.12, face);
    box(4.8, 0.12, 0.3, metal, 0, -0.2, 0, face); box(0.4, 0.4, 0.8, metal, 0, 0, 0.4, face);
    const beacon = box(0.2, 0.2, 0.2, basic('#ff2a1a'), 0, 2.2, 0, face); beacon.castShadow = false;
    g.userData.dish = dish; g.userData.beacon = beacon;
    g.userData.size = [3.2, 7.2, 8]; g.userData.center = [0, 2.8, 0];
    return M.bake(g, [body, dish, face]);
  };

  /* Dépôt de carburant : dalle, trois cuves verticales cerclées (bande rouge), passerelle et échelle, tuyauteries,
   * vannes jaunes, panneau « danger ». */
  M.fuel = function () {
    const g = new THREE.Group();
    const white = lam('#d8d8d2'), red = lam('#a8281c'), metal = lam('#50545a'), yellow = lam('#d8b020'), pad = lam('#7a7874');
    box(12, 0.4, 12, pad, 0, 0.2, 0, g);
    const spots = [[-3, -2.4], [3, -2.4], [0, 3]];
    for (const [x, z] of spots) {
      cyl(2.3, 2.3, 5.6, white, 16, g).position.set(x, 3.2, z);
      cyl(2.34, 2.34, 0.5, red, 16, g).position.set(x, 4.4, z);
      cyl(2.36, 2.36, 0.12, metal, 16, g).position.set(x, 1.2, z);
      cyl(1.2, 2.3, 0.6, white, 16, g).position.set(x, 6.3, z);                  // toit conique
      cyl(0.3, 0.3, 0.3, metal, 8, g).position.set(x, 6.7, z);                  // évent
      for (let k = 0; k < 8; k++) box(0.06, 0.06, 0.5, metal, x + 2.35, 1.0 + k * 0.6, z, g);   // échelle
    }
    for (let i = 0; i < spots.length; i++) {                                    // tuyauteries entre cuves
      const a = spots[i], b = spots[(i + 1) % spots.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const pg = new THREE.Group(); pg.position.set(mx, 0.8, mz); pg.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); g.add(pg);
      cylZ(0.18, 0.18, len, metal, 8, 0, 0, 0, pg);
      box(0.4, 0.4, 0.4, yellow, mx, 0.8, mz, g);
    }
    box(1.2, 0.8, 0.06, yellow, 5.4, 1.2, -5.9, g);                              // panneau danger
    box(0.08, 1.2, 0.08, metal, 5.4, 0.6, -5.9, g);
    g.userData.size = [12, 7.2, 12]; g.userData.center = [0, 3.2, 0];
    return M.bake(g);
  };

  /* Poste de commandement : casemate en béton à façade inclinée, meurtrières, porte blindée, sacs de sable, antennes,
   * petite parabole, filet de camouflage sur le toit, feu rouge clignotant. */
  M.command = function () {
    const g = new THREE.Group();
    const conc = lam('#8a8680'), dark = lam('#5a5652'), sand = lam('#a89a70'), metal = lam('#40444a'), net = lam('#4a5236');
    box(9, 3.4, 8, conc, 0, 1.7, 0.4, g);
    const slope = box(9, 0.5, 2.6, conc, 0, 2.6, -3.9, g); slope.rotation.x = 0.7;   // façade inclinée
    for (let i = 0; i < 3; i++) box(1.4, 0.25, 0.1, lam('#101214'), -2.8 + i * 2.8, 2.5, -3.62, g);   // meurtrières
    box(1.6, 2.2, 0.15, metal, 3.2, 1.1, 4.45, g);                               // porte (arrière)
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(1.4, 0.6, 0.7, sand, Math.cos(a) * 6.2, 0.3, Math.sin(a) * 5.8 + 0.4, g).rotation.y = -a; }   // sacs de sable
    box(8.4, 0.15, 7.2, net, 0, 3.5, 0.6, g);                                    // filet de camouflage
    for (const [x, h] of [[-3.5, 6], [-2.6, 4.5], [3.8, 5.2]]) { cyl(0.05, 0.07, h, metal, 5, g).position.set(x, 3.4 + h / 2, 2.8); }
    const dishM = cyl(0.8, 0.2, 0.3, lam('#d0d0cc'), 12, g); dishM.position.set(1.8, 4.1, 2.6); dishM.rotation.x = -0.8;
    box(1.2, 0.8, 1.0, dark, -1.5, 3.9, 2.5, g);                                 // groupe électrogène
    const beacon = box(0.25, 0.25, 0.25, basic('#ff2a1a'), -3.5, 9.5, 2.8, g); beacon.castShadow = false;
    g.userData.beacon = beacon;
    g.userData.size = [10, 5.5, 9.5]; g.userData.center = [0, 2.2, 0.3];
    return M.bake(g);
  };

  /* Lance-missiles sol-air sur camion : tourelle qui suit la roquette (turret), rampe de 4 tubes qui se lève (gun),
   * recul de la rampe (slide), bouche de tir (muzzle). Mêmes pièces animées que le char : la même IA le pilote. */
  M.sam = function () {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const olive = lam('#56603f'), dark = lam('#3c4430'), metal = lam('#40444a');
    chassis(body, olive, dark, 7.6);
    const turret = new THREE.Group(); turret.name = 'turret'; turret.position.set(0, 1.2, 1.2); body.add(turret);
    cyl(1.0, 1.1, 0.3, dark, 12, turret).position.y = 0.15;
    box(1.6, 0.9, 1.4, olive, 0, 0.75, 0.3, turret);                              // socle
    const gun = new THREE.Group(); gun.position.set(0, 1.3, 0.3); turret.add(gun);
    const slide = new THREE.Group(); gun.add(slide);
    for (const sx of [-0.45, 0.45]) for (const sy of [0.2, 0.75]) {
      cylZ(0.24, 0.24, 3.6, olive, 10, sx, sy, -1.2, slide);
      cylZ(0.18, 0.18, 0.1, lam('#1a1a1a'), 10, sx, sy, -3.02, slide);           // bouchons
    }
    box(1.5, 0.12, 3.4, metal, 0, -0.1, -1.2, slide);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.5, -3.1); slide.add(muzzle);
    box(0.5, 0.5, 0.4, metal, 0.9, 1.3, 0.8, turret);                             // radar de conduite de tir
    g.userData.turret = turret; g.userData.gun = gun; g.userData.slide = slide; g.userData.muzzle = muzzle; g.userData.body = body;
    g.userData.exhausts = [new V(1.0, 1.0, -2.6)];
    g.userData.elev = [0.15, 1.05];                                              // hausse de la rampe (rad)
    g.userData.size = [3.0, 3.4, 8.2]; g.userData.center = [0, 1.6, 0];
    return M.bake(g, [body, turret, gun, slide]);
  };
})();
