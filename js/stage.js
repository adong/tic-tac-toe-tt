/* TT Tic-Tac-Toe: the renderer, the garden and the board.
   The board is a chunky wooden tray on a picnic blanket with nine cream tiles. Each tile has an X (Teddy's blue
   crossed bars) and an O (Tommy's orange ring) that show or hide with the square's state.
     place(i, mark)      REGULAR: the mark drops in with a bounce
     spin(i, from, to, dir)  SPIN: the tile hops and flips over like a coin; the mark changes while it's upside down
     set(board)          show a board straight away (a new round)
     win(line)           a glowing bar across the line, and its marks bounce
     hint(i)             the square glows gold with a bouncing 👇 (your brother's tip); hint(-1) clears it
     blast(cells)        your brother's 💣 lands: the marks there fly up and away, and the tiles hop
     shake(secs)         the camera shakes for a moment
     cursor(i), hover(i, state), lock(i)
     pick(x, y)          the square under a screen point, or -1
   fit(points, elev, margins) aims the camera so world points fill the screen minus margins (in pixels). */
(function () {
  'use strict';
  const T = THREE;
  const TTT = (window.TTT = window.TTT || {});
  const { makeCanvas, toTexture, std, rand, pick: pickOne, radialTexture, emojiTexture, FONT } = Kit.gfx;

  const TILE = 1.2, GAP = 0.14, PITCH = TILE + GAP, RIM = 0.34;
  const HALF = 1.5 * TILE + GAP + RIM; // half the tray's width
  const TRAY_H = 0.34, TILE_H = 0.22;
  const TOP = TRAY_H + TILE_H; // height of the tile tops
  const COL = { X: '#2f7cf0', O: '#ff8a1f' };
  // the numbers on a computer's number pad, laid out like the board (7 8 9 on top)
  const PAD = [7, 8, 9, 4, 5, 6, 1, 2, 3];

  let renderer = null, W = 1, H = 1;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(36, 1, 0.1, 300);
  const cells = [];
  const fx = { line: null, lineT: -1, lineCells: null, hint: -1, hintT: 0, cursor: -1, hover: -1, hoverState: 0, lock: -1, t: 0, shake: 0 };
  const camBase = new T.Vector3();
  let board = null, glowMesh = null, finger = null, ring = null, lockSprite = null;
  const ghosts = { 1: null, 2: null };

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildGarden();
    buildBoard();
    resize();
  }

  function resize() {
    W = Math.max(1, innerWidth || 1);
    H = Math.max(1, innerHeight || 1);
    if (renderer) renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- shapes

  // A rounded rectangle slab, w wide (x) and d deep (z), h tall, centred on the origin, flat on y.
  function slab(w, d, h, r, bevel = 0.04) {
    const s = new T.Shape();
    const x = -w / 2 + bevel, y = -d / 2 + bevel, ww = w - 2 * bevel, dd = d - 2 * bevel, rr = Math.max(0.01, r - bevel);
    s.moveTo(x + rr, y);
    s.lineTo(x + ww - rr, y);
    s.quadraticCurveTo(x + ww, y, x + ww, y + rr);
    s.lineTo(x + ww, y + dd - rr);
    s.quadraticCurveTo(x + ww, y + dd, x + ww - rr, y + dd);
    s.lineTo(x + rr, y + dd);
    s.quadraticCurveTo(x, y + dd, x, y + dd - rr);
    s.lineTo(x, y + rr);
    s.quadraticCurveTo(x, y, x + rr, y);
    const g = new T.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(h - 2 * bevel) / 2, 0);
    return g;
  }

  // ---------------------------------------------------------------- the garden

  function lawnTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#7fd35c';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#74c851';
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 64, 256, 32);
    for (let i = 0; i < 1100; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(30,90,10,0.08)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5);
    }
    return toTexture(c, true);
  }

  function blanketTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255, 61, 127, 0.55)';
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(i * 32, 0, 32, 256);
      g.fillRect(0, i * 32, 256, 32);
    }
    return toTexture(c, true);
  }

  function buildGarden() {
    scene.background = new T.Color('#9fdcff');
    scene.add(new T.HemisphereLight('#ffffff', '#5a8a3a', 0.85));
    const sun = new T.DirectionalLight('#fff3dc', 1.0);
    sun.position.set(-5, 12, 8);
    scene.add(sun);

    const tex = lawnTexture();
    tex.repeat.set(30, 30);
    const ground = new T.Mesh(new T.PlaneGeometry(120, 120), std('#ffffff', { map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // the picnic blanket under the board
    const bt = blanketTexture();
    bt.repeat.set(3, 3);
    const blanket = new T.Mesh(new T.PlaneGeometry(HALF * 2 + 1.6, HALF * 2 + 1.6), std('#ffffff', { map: bt, roughness: 1 }));
    blanket.rotation.x = -Math.PI / 2;
    blanket.rotation.z = 0.04;
    blanket.position.y = 0.01;
    scene.add(blanket);

    // a white picket fence along the back, then hedges and trees
    const white = std('#ffffff', { roughness: 0.6 });
    const postGeo = new T.BoxGeometry(0.22, 1.3, 0.1), tipGeo = new T.ConeGeometry(0.16, 0.22, 4);
    const fenceZ = -9.5;
    for (let x = -26; x <= 26; x += 0.55) {
      const post = new T.Mesh(postGeo, white);
      post.position.set(x, 0.65, fenceZ);
      scene.add(post);
      const tip = new T.Mesh(tipGeo, white);
      tip.position.set(x, 1.4, fenceZ);
      tip.rotation.y = Math.PI / 4;
      scene.add(tip);
    }
    for (const y of [0.35, 1.0]) {
      const rail = new T.Mesh(new T.BoxGeometry(53, 0.14, 0.08), white);
      rail.position.set(0, y, fenceZ + 0.08);
      scene.add(rail);
    }
    const leaf = [std('#3f9e3a'), std('#4cb244'), std('#378c33')];
    const bush = (x, z, s) => {
      for (let i = 0; i < 3; i++) {
        const b = new T.Mesh(new T.SphereGeometry(0.7 * s, 14, 10), leaf[i]);
        b.position.set(x + (i - 1) * 0.6 * s, 0.45 * s + (i === 1 ? 0.25 * s : 0), z + (i % 2) * 0.2);
        scene.add(b);
      }
    };
    const tree = (x, z, s) => {
      const trunk = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.3 * s, 2.2 * s, 8), std('#8a5a32'));
      trunk.position.set(x, 1.1 * s, z);
      scene.add(trunk);
      for (const [dx, dy, r] of [[0, 2.8, 1.3], [-0.8, 2.3, 0.9], [0.8, 2.4, 0.95]]) {
        const top = new T.Mesh(new T.SphereGeometry(r * s, 16, 12), leaf[(dx > 0) + 1 - 1]);
        top.position.set(x + dx * s, dy * s, z);
        scene.add(top);
      }
    };
    for (const x of [-12, -7, 7, 12]) bush(x, -8.6, 1.3);
    bush(-10.5, -2, 1.4);
    bush(10.5, -2, 1.4);
    bush(-11, 5, 1.5);
    bush(11, 5, 1.5);
    tree(-16, -12, 1.6);
    tree(16, -12, 1.6);
    tree(-3, -13, 1.3);
    tree(5, -14, 1.5);

    // flowers, kept clear of the blanket and the spots where the boys stand
    const petals = ['#ff6f91', '#ffd23f', '#ffffff', '#a77bff', '#ff8a1f'];
    const stem = std('#2f8a2a'), centre = std('#ffcc00');
    for (let i = 0; i < 110; i++) {
      const x = rand(-14, 14), z = rand(-8.8, 9);
      if (Math.abs(x) < HALF + 3.2 && z > -HALF - 3.6 && z < HALF + 1.6) continue;
      const f = new T.Group();
      const s = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.35, 5), stem);
      s.position.y = 0.17;
      f.add(s);
      const head = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), std(pickOne(petals)));
      head.position.y = 0.38;
      head.scale.y = 0.6;
      f.add(head);
      const dot = new T.Mesh(new T.SphereGeometry(0.05, 6, 4), centre);
      dot.position.y = 0.43;
      f.add(dot);
      f.position.set(x, 0, z);
      scene.add(f);
    }
  }

  // ---------------------------------------------------------------- the board

  function woodTexture(base, dark) {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = dark;
      g.globalAlpha = rand(0.08, 0.2);
      g.lineWidth = rand(1, 3);
      g.beginPath();
      const y = rand(0, 256);
      g.moveTo(0, y);
      g.bezierCurveTo(80, y + rand(-8, 8), 170, y + rand(-8, 8), 256, y + rand(-6, 6));
      g.stroke();
    }
    g.globalAlpha = 1;
    return toTexture(c, true);
  }

  // the tile top: cream, a soft inner edge, and its number-pad digit in the corner (not on touch screens)
  const showDigits = !(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  function tileTexture(digit) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#fff7e4';
    g.fillRect(0, 0, 128, 128);
    const grad = g.createRadialGradient(64, 64, 30, 64, 64, 92);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(230,190,130,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    if (digit && showDigits) {
      g.font = `22px ${FONT}`;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = 'rgba(150,110,60,0.45)';
      g.fillText(String(digit), 14, 12);
    }
    const t = toTexture(c);
    t.repeat.set(1 / TILE, 1 / TILE);
    t.offset.set(0.5, 0.5);
    return t;
  }

  function markX(mat) {
    const g = new T.Group();
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new T.Mesh(slab(0.98, 0.26, 0.2, 0.13, 0.05), mat);
      bar.rotation.y = a;
      g.add(bar);
    }
    return g;
  }
  function markO(mat) {
    const g = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(0.33, 0.115, 14, 40), mat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    return g;
  }

  function buildBoard() {
    board = new T.Group();
    scene.add(board);
    const wood = woodTexture('#d4975a', '#7a4a20');
    const tray = new T.Mesh(slab(HALF * 2, HALF * 2, TRAY_H, 0.45, 0.07), [
      std('#ffffff', { map: wood, roughness: 0.65 }), std('#b87a40', { roughness: 0.7 }),
    ]);
    wood.repeat.set(0.25, 0.25);
    tray.position.y = TRAY_H / 2;
    board.add(tray);

    const xMat = std(COL.X, { roughness: 0.35, metalness: 0.05 });
    const oMat = std(COL.O, { roughness: 0.35, metalness: 0.05 });
    const side = std('#ead2a8', { roughness: 0.7 });
    const tileGeo = slab(TILE, TILE, TILE_H, 0.2, 0.05);
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const pivot = new T.Group();
      pivot.position.set((col - 1) * PITCH, TRAY_H + TILE_H / 2, (row - 1) * PITCH);
      const topMat = std('#ffffff', { map: tileTexture(PAD[i]), roughness: 0.55 });
      const tile = new T.Mesh(tileGeo, [topMat, side]);
      pivot.add(tile);
      const x = markX(xMat), o = markO(oMat);
      for (const m of [x, o]) {
        m.position.y = TILE_H / 2 + 0.1;
        m.visible = false;
        pivot.add(m);
      }
      board.add(pivot);
      cells.push({ pivot, tile, topMat, x, o, state: 0, anim: null, lift: 0, bounce: -1, home: pivot.position.clone() });
    }

    // ghosts: see-through marks for what a tap would make
    for (const [k, make, colr] of [[1, markX, COL.X], [2, markO, COL.O]]) {
      const m = make(new T.MeshBasicMaterial({ color: colr, transparent: true, opacity: 0.38, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      ghosts[k] = m;
    }
    // the hint glow and finger, the keyboard cursor, the lock
    const glowTex = radialTexture(128, [[0, 'rgba(255,230,90,1)'], [0.45, 'rgba(255,200,40,0.65)'], [1, 'rgba(255,190,0,0)']]);
    glowMesh = new T.Mesh(new T.PlaneGeometry(TILE * 1.9, TILE * 1.9), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.visible = false;
    glowMesh.renderOrder = 5;
    scene.add(glowMesh);
    finger = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('👇'), depthTest: false, transparent: true }));
    finger.scale.setScalar(0.95);
    finger.visible = false;
    finger.renderOrder = 25;
    scene.add(finger);
    const [rc, rg] = makeCanvas(128, 128);
    rg.strokeStyle = '#ffd400';
    rg.lineWidth = 12;
    Kit.gfx.roundRect(rg, 8, 8, 112, 112, 22);
    rg.stroke();
    rg.strokeStyle = '#14121f';
    rg.lineWidth = 4;
    Kit.gfx.roundRect(rg, 2, 2, 124, 124, 26);
    rg.stroke();
    ring = new T.Mesh(new T.PlaneGeometry(TILE * 1.12, TILE * 1.12), new T.MeshBasicMaterial({ map: toTexture(rc), transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 6;
    scene.add(ring);
    lockSprite = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('🔒'), depthTest: false, transparent: true, opacity: 0.9 }));
    lockSprite.scale.setScalar(0.6);
    lockSprite.visible = false;
    lockSprite.renderOrder = 24;
    scene.add(lockSprite);
  }

  const cellPos = (i, out = new T.Vector3()) => out.set(((i % 3) - 1) * PITCH, TOP, (Math.floor(i / 3) - 1) * PITCH);

  function show(c, state) {
    c.state = state;
    c.x.visible = state === 1;
    c.o.visible = state === 2;
  }

  function set(b) {
    cells.forEach((c, i) => {
      show(c, b[i]);
      c.anim = null;
      c.pivot.rotation.set(0, 0, 0);
      c.pivot.position.copy(c.home);
      c.x.scale.setScalar(1);
      c.o.scale.setScalar(1);
      c.x.position.y = c.o.position.y = TILE_H / 2 + 0.1;
      c.bounce = -1;
    });
    clearWin();
  }

  // REGULAR: the mark drops in from above and squashes as it lands.
  function place(i, mark) {
    const c = cells[i];
    show(c, mark);
    c.anim = { kind: 'drop', t: 0, dur: 0.42 };
  }

  // The 💣: every mark in these squares flies up spinning and vanishes, and every tile hops.
  function blast(list) {
    for (const i of list) {
      const c = cells[i];
      c.anim = { kind: 'blast', t: Math.random() * -0.08, dur: 0.55 };
    }
  }
  function shake(secs) {
    fx.shake = Math.max(fx.shake, secs);
  }

  // SPIN: the tile hops and flips over (dir 1 rolls it away from you, -1 towards you); the mark changes half way.
  function spin(i, from, to, dir = 1) {
    const c = cells[i];
    show(c, from);
    c.anim = { kind: 'flip', t: 0, dur: 0.62, to, dir, swapped: false };
  }

  function win(line) {
    clearWin();
    if (!line) return;
    const a = cellPos(line[0]), b = cellPos(line[2]);
    const len = a.distanceTo(b) + TILE * 0.95;
    const geo = new T.BoxGeometry(1, 0.16, 0.26);
    const bar = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#fff27a' }));
    const glowTex = radialTexture(64, [[0, 'rgba(255,240,120,0.9)'], [1, 'rgba(255,200,0,0)']]);
    const halo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    halo.rotation.x = -Math.PI / 2;
    halo.scale.set(1.15, 0.9, 1);
    const g = new T.Group();
    g.add(halo);
    g.add(bar);
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.position.y = TOP + 0.42;
    g.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    g.userData.len = len;
    g.scale.set(0.01, 1, 1);
    scene.add(g);
    fx.line = g;
    fx.lineT = 0;
    fx.lineCells = line.slice();
    line.forEach((i, k) => (cells[i].bounce = -k * 0.12));
  }
  function clearWin() {
    if (fx.line) {
      scene.remove(fx.line);
      fx.line.traverse((o) => o.geometry && o.geometry.dispose());
      fx.line = null;
    }
    fx.lineCells = null;
    for (const c of cells) {
      c.bounce = -1;
      c.topMat.emissive && c.topMat.emissive.setRGB(0, 0, 0);
    }
  }

  function hint(i) {
    fx.hint = i;
    fx.hintT = 0;
  }
  function cursor(i) { fx.cursor = i; }
  function hover(i, state) {
    fx.hover = i;
    fx.hoverState = state;
  }
  function lock(i) { fx.lock = i; }

  // ---------------------------------------------------------------- every frame

  const ease = (u) => 1 - Math.pow(1 - u, 3);
  function update(dt) {
    fx.t += dt;
    for (let i = 0; i < 9; i++) {
      const c = cells[i];
      const a = c.anim;
      let lift = (i === fx.hover || i === fx.cursor) && !a ? 0.07 : 0;
      c.lift += (lift - c.lift) * Math.min(1, dt * 14);
      c.pivot.position.y = c.home.y + c.lift;
      if (a) {
        a.t += dt;
        const u = Math.min(1, a.t / a.dur);
        const m = c.state === 1 ? c.x : c.o;
        if (a.kind === 'drop') {
          // fall from 2.2 m, land at u 0.55, squash, settle
          const yTop = TILE_H / 2 + 0.1;
          if (u < 0.55) {
            const k = u / 0.55;
            m.position.y = yTop + 2.2 * (1 - k * k);
            m.scale.set(0.9, 1.15, 0.9);
          } else {
            const k = (u - 0.55) / 0.45;
            m.position.y = yTop;
            const sq = Math.sin(k * Math.PI) * 0.35 * (1 - k);
            m.scale.set(1 + sq, 1 - sq * 1.6, 1 + sq);
          }
        } else if (a.kind === 'blast') {
          // the mark shoots up, spins and shrinks away; the tile bounces
          const k = Math.max(0, u);
          c.pivot.position.y = c.home.y + Math.sin(k * Math.PI) * 0.45;
          m.position.y = TILE_H / 2 + 0.1 + k * 2.6;
          m.rotation.y = k * 9;
          m.scale.setScalar(Math.max(0.01, 1 - k));
          if (u >= 1) {
            show(c, 0);
            m.rotation.y = 0;
          }
        } else {
          // a hop and a full turn about the x axis; the mark changes when the tile is upside down
          c.pivot.rotation.x = a.dir * ease(u) * Math.PI * 2;
          c.pivot.position.y = c.home.y + Math.sin(u * Math.PI) * 0.9;
          if (!a.swapped && u >= 0.5) {
            a.swapped = true;
            show(c, a.to);
          }
        }
        if (u >= 1) {
          c.anim = null;
          c.pivot.rotation.x = 0;
          c.x.position.y = c.o.position.y = TILE_H / 2 + 0.1;
          c.x.scale.setScalar(1);
          c.o.scale.setScalar(1);
        }
      }
      // the winning line's marks bounce, one after another
      if (c.bounce > -1 || (fx.lineCells && fx.lineCells.includes(i))) {
        c.bounce += dt;
        const b = Math.max(0, c.bounce);
        const m = c.state === 1 ? c.x : c.o;
        if (!c.anim) {
          m.position.y = TILE_H / 2 + 0.1 + Math.abs(Math.sin(b * 6)) * 0.35;
          m.rotation.y = Math.sin(b * 3) * 0.3;
        }
        if (c.topMat.emissive) c.topMat.emissive.setRGB(0.35, 0.28, 0.02);
      } else {
        c.x.rotation.y = c.o.rotation.y = 0;
      }
    }
    if (fx.line) {
      fx.lineT += dt;
      const u = Math.min(1, fx.lineT / 0.35);
      fx.line.scale.x = fx.line.userData.len * ease(u);
      fx.line.children[0].material.opacity = 0.7 + Math.sin(fx.t * 8) * 0.3;
    }
    // the hint: glow and a bouncing finger
    const h = fx.hint;
    glowMesh.visible = finger.visible = h >= 0;
    if (h >= 0) {
      fx.hintT += dt;
      const p = cellPos(h, tmp);
      glowMesh.position.set(p.x, TOP + 0.012 + cells[h].lift, p.z);
      const pulse = 1 + Math.sin(fx.t * 6) * 0.12;
      glowMesh.scale.setScalar(pulse * Math.min(1, fx.hintT * 4));
      finger.position.set(p.x, TOP + 1.35 + Math.abs(Math.sin(fx.t * 5)) * 0.35, p.z + 0.15);
    }
    // the keyboard cursor
    ring.visible = fx.cursor >= 0;
    if (fx.cursor >= 0) {
      const p = cellPos(fx.cursor, tmp);
      ring.position.set(p.x, TOP + 0.02 + cells[fx.cursor].lift, p.z);
      ring.scale.setScalar(1 + Math.sin(fx.t * 7) * 0.035);
    }
    // the ghost of what a tap would make (mouse hover, the keyboard cursor and the hint)
    const gi = fx.hover >= 0 ? fx.hover : fx.cursor;
    ghosts[1].visible = ghosts[2].visible = false;
    if (gi >= 0 && fx.hoverState && !cells[gi].anim && cells[gi].state !== fx.hoverState) {
      const g = ghosts[fx.hoverState];
      const p = cellPos(gi, tmp);
      g.visible = true;
      g.position.set(p.x, TOP + 0.45 + Math.sin(fx.t * 4) * 0.06, p.z);
    }
    // the camera shake (from the 💣)
    if (fx.shake > 0) {
      fx.shake = Math.max(0, fx.shake - dt);
      const amp = fx.shake * 0.35;
      cam.position.set(camBase.x + (Math.random() - 0.5) * amp, camBase.y + (Math.random() - 0.5) * amp, camBase.z + (Math.random() - 0.5) * amp);
      cam.updateMatrixWorld(true);
    } else if (!cam.position.equals(camBase) && camBase.lengthSq()) {
      cam.position.copy(camBase);
      cam.updateMatrixWorld(true);
    }
    lockSprite.visible = fx.lock >= 0;
    if (fx.lock >= 0) {
      const p = cellPos(fx.lock, tmp);
      lockSprite.position.set(p.x + 0.3, TOP + 0.7, p.z + 0.3);
    }
  }
  const tmp = new T.Vector3();

  // ---------------------------------------------------------------- camera

  // Aim the camera down at `elev` radians from the front so the world points `pts` fill the screen minus margins
  // { l, r, t, b } in pixels. It fits them in a box of that size in the middle of the picture, then slides the
  // picture (the camera's view offset) so the box sits over the free part of the screen. Returns the point it looks at.
  const right = new T.Vector3(), up = new T.Vector3();
  function fit(pts, elev, m) {
    cam.clearViewOffset();
    const dir = new T.Vector3(0, Math.sin(elev), Math.cos(elev));
    const center = new T.Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const hw = Math.max(0.1, (W - m.l - m.r) / W), hh = Math.max(0.1, (H - m.t - m.b) / H);
    const box = { x0: -hw, x1: hw, y0: -hh, y1: hh };
    const place = (d) => {
      cam.position.copy(center).addScaledVector(dir, d);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
    };
    const bounds = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) {
        tmp.copy(p).project(cam);
        x0 = Math.min(x0, tmp.x);
        x1 = Math.max(x1, tmp.x);
        y0 = Math.min(y0, tmp.y);
        y1 = Math.max(y1, tmp.y);
      }
      return { x0, x1, y0, y1 };
    };
    for (let iter = 0; iter < 4; iter++) {
      let lo = 2, hi = 300;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (b.x0 >= box.x0 && b.x1 <= box.x1 && b.y0 >= box.y0 && b.y1 <= box.y1) hi = mid;
        else lo = mid;
      }
      place(hi);
      const b = bounds();
      const dx = (b.x0 + b.x1) / 2 - (box.x0 + box.x1) / 2;
      const dy = (b.y0 + b.y1) / 2 - (box.y0 + box.y1) / 2;
      const d = cam.position.distanceTo(center);
      const halfH = d * Math.tan((cam.fov * Math.PI) / 360), halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      center.addScaledVector(right, dx * halfW).addScaledVector(up, dy * halfH);
    }
    const bx = (m.l + W - m.r) / 2, by = (m.t + H - m.b) / 2;
    cam.setViewOffset(W, H, W / 2 - bx, H / 2 - by, W, H);
    cam.updateMatrixWorld(true);
    camBase.copy(cam.position);
    return center;
  }

  // The square under screen point (x, y), or -1.
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP), hit = new T.Vector3();
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const col = Math.round(hit.x / PITCH) + 1, row = Math.round(hit.z / PITCH) + 1;
    if (col < 0 || col > 2 || row < 0 || row > 2) return -1;
    const cx = (col - 1) * PITCH, cz = (row - 1) * PITCH;
    if (Math.abs(hit.x - cx) > PITCH / 2 + 0.05 || Math.abs(hit.z - cz) > PITCH / 2 + 0.05) return -1;
    return row * 3 + col;
  }

  function toScreen(v, out = { x: 0, y: 0 }) {
    tmp.copy(v).project(cam);
    out.x = ((tmp.x + 1) / 2) * W;
    out.y = ((1 - tmp.y) / 2) * H;
    return out;
  }

  function render() {
    if (renderer) renderer.render(scene, cam);
  }

  TTT.stage = {
    init, resize, render, update, fit, pick, toScreen, cellPos, set, place, spin, blast, shake, win, clearWin, hint, cursor, hover, lock,
    scene, cam, HALF, TOP, PITCH, TILE, PAD, COL,
    busy: () => cells.some((c) => c.anim),
    get W() { return W; },
    get H() { return H; },
    get renderer() { return renderer; },
    get hintCell() { return fx.hint; },
  };
})();
