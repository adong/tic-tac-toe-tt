/* TT Tic-Tac-Toe: the menu, the match, the HUD, input and the main loop.
   Screens: home (pick REGULAR or SPIN, 1 or 2 players, who you are and the level), play, round over, match over,
   pause. A match is up to 5 rounds: first to 3 round wins takes it, draws use up a round, and whoever is ahead
   after 5 wins (level after 5 is a tie). Who goes first swaps every round; you (or Teddy, in 2 players) start.
   In 1 player you're Teddy (X) or Tommy (O) against a CPU friend: 🐣 EASY is Bruno the bear, 🔥 NORMAL is Bolt the
   robot. Your brother isn't the CPU: he's the one you call for help (js/buddy.js).
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const TTT = window.TTT;
  const R = TTT.rules;
  const ST = TTT.stage;
  const S = Kit.sound;
  const { X, O } = R;
  const $ = (id) => document.getElementById(id);
  const { rand } = Kit.gfx;

  const KEY = 'ticTacToeTT.v1';
  const CPU = { easy: 'bruno', normal: 'bolt' };
  const ROUNDS = 5, TO_WIN = 3;

  const prefs = Object.assign({ players: 1, who: 'teddy', level: 'easy', mode: 'regular' }, load());
  const G = {
    state: 'boot', mode: 'regular', players: 1, level: 'easy', sides: null, round: null, roundNo: 0, results: [],
    wins: { 1: 0, 2: 0 }, starter: X, cpuT: -1, waitT: -1, turnId: 0, endT: -1, endEv: null, cursor: -1, hover: -1,
    held: false, last: 0, auto: false, demo: null, lockT: 0,
  };
  const actors = [TTT.makeActor(), TTT.makeActor()];
  const badges = [];
  let ui = null, flyers = null, bursts = null, spots = null, art = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }

  // ---------------------------------------------------------------- who's at the board

  const nameOf = (id) => Kit.roster.get(id).name;
  // sides[0] is on the left (you, or Teddy in 2 players), sides[1] on the right
  function makeSides(players, who) {
    if (players === 2) return [{ id: 'teddy', mark: X, human: true }, { id: 'tommy', mark: O, human: true }];
    const mine = who === 'tommy' ? O : X;
    return [{ id: who, mark: mine, human: true }, { id: CPU[G.level], mark: R.other(mine), human: false }];
  }
  const sideOf = (mark) => G.sides.find((s) => s.mark === mark);
  const current = () => (G.round ? sideOf(G.round.turn) : null);
  const kid = () => G.sides[0];

  function setActors() {
    G.sides.forEach((s, k) => {
      const a = actors[k];
      if (!a.entry || a.entry.id !== s.id) a.set(s.id, 1);
      s.actor = a;
      a.visible = true;
      setBadge(k, s.mark);
    });
    TTT.buddy.setFor(kid().id);
  }

  // the mark that bobs over the head of whoever's turn it is
  function markTexture(mark) {
    const [c, g] = Kit.gfx.makeCanvas(128, 128);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#14121f';
    g.stroke();
    g.lineCap = 'round';
    g.lineWidth = 18;
    g.strokeStyle = mark === X ? ST.COL.X : ST.COL.O;
    g.beginPath();
    if (mark === X) {
      g.moveTo(38, 38);
      g.lineTo(90, 90);
      g.moveTo(90, 38);
      g.lineTo(38, 90);
    } else g.arc(64, 64, 26, 0, Math.PI * 2);
    g.stroke();
    return Kit.gfx.toTexture(c);
  }
  const markTex = {};
  function setBadge(k, mark) {
    if (!badges[k]) {
      badges[k] = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
      badges[k].renderOrder = 23;
      badges[k].scale.setScalar(0.62);
      ST.scene.add(badges[k]);
    }
    markTex[mark] = markTex[mark] || markTexture(mark);
    badges[k].material.map = markTex[mark];
    badges[k].material.needsUpdate = true;
  }

  // ---------------------------------------------------------------- layout

  // Where everyone stands, for this screen shape. Wide: the two players either side of the board. Tall: behind it.
  function makeSpots(wide) {
    const H2 = ST.HALF;
    if (wide) {
      return {
        wide,
        sides: [{ x: -(H2 + 1.3), z: -0.45, face: Math.PI + 0.35 }, { x: H2 + 1.3, z: -0.45, face: Math.PI - 0.35 }],
        buddy: { x: -(H2 + 0.45), z: -(H2 + 1.35), face: Math.PI + 0.45 },
        meet: [{ x: -0.8, z: -(H2 + 1.15) }, { x: 0.8, z: -(H2 + 1.15) }],
      };
    }
    return {
      wide,
      sides: [{ x: -1.6, z: -(H2 + 1.05), face: Math.PI + 0.15 }, { x: 1.6, z: -(H2 + 1.05), face: Math.PI - 0.15 }],
      buddy: { x: 0, z: -(H2 + 1.9), face: Math.PI },
      meet: [{ x: -0.75, z: -(H2 + 1.05) }, { x: 0.75, z: -(H2 + 1.05) }],
    };
  }

  function layout() {
    ST.resize();
    TTT.fx.overlay.resize();
    const W = ST.W, H = ST.H;
    if (W < 2 || H < 2) return;
    const wide = W / H >= 1.15;
    spots = makeSpots(wide);
    const V = THREE.Vector3, h = ST.HALF, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new V(sx * h, 0, sz * h), new V(sx * h, ST.TOP, sz * h));
    const people = spots.sides.concat(G.state === 'home' ? [] : [spots.buddy]);
    for (const s of people) pts.push(new V(s.x - 0.8, 0, s.z), new V(s.x + 0.8, 0, s.z), new V(s.x, 3.0, s.z));
    // the kit's round ? and language buttons sit on the left edge: keep the board and the boys clear of them
    const kitL = 62;
    const m = { l: kitL, r: 14, t: 14, b: 14 };
    if (G.state === 'home') {
      if (wide) m.r = W * 0.54 + 10;
      else {
        m.b = H * 0.62 + 6;
        m.t = 8;
      }
    } else {
      const top = ui.hudtop.getBoundingClientRect();
      m.t = top.bottom + 8;
      if (!wide) m.b = Math.min(H * 0.16, 130);
      else m.r = kitL;
    }
    ST.fit(pts, wide ? 0.95 : 1.02, m);
    G.sides && G.sides.forEach((s, k) => {
      const sp = spots.sides[k];
      s.actor.faceDefault = sp.face;
      if (!TTT.highFive.on) s.actor.place(sp.x, 0, sp.z);
    });
  }

  // ---------------------------------------------------------------- the match

  function startMatch(opts = {}) {
    gesture();
    G.mode = opts.mode || prefs.mode;
    G.players = opts.players || prefs.players;
    G.level = opts.level || prefs.level;
    const who = opts.who || prefs.who;
    Object.assign(prefs, { mode: G.mode, players: G.players, level: G.level, who });
    save();
    G.sides = makeSides(G.players, who);
    setActors();
    G.results = [];
    G.wins = { 1: 0, 2: 0 };
    G.roundNo = 0;
    G.starter = kid().mark;
    show(ui.home, false);
    show(ui.hud, true);
    show(ui.callBtn, true);
    show(ui.matchOver, false);
    show(ui.roundOver, false);
    document.body.dataset.screen = 'play';
    G.state = 'play';
    TTT.highFive.cancel();
    setupHud();
    layout();
    S.music('title');
    startRound();
  }

  function startRound() {
    G.round = R.newRound(G.mode, G.starter);
    G.endT = -1;
    G.endEv = null;
    G.cpuT = -1;
    G.waitT = -1;
    G.lockT = 0;
    ST.set(G.round.board);
    ST.hint(-1);
    ST.lock(-1);
    ST.hover(-1, 0);
    TTT.buddy.reset();
    TTT.fx.overlay.clear();
    flyers.clear();
    bursts.clear();
    clearToasts();
    G.sides.forEach((s) => {
      s.actor.react('idle');
      s.actor.drop();
    });
    G.state = 'play';
    show(ui.roundOver, false);
    show(ui.pause, false);
    renderScore();
    beginTurn();
  }

  function beginTurn() {
    G.turnId++;
    const s = current();
    G.cursor = G.cursor >= 0 ? G.cursor : -1;
    if (!s.human) {
      G.cpuT = rand(0.85, 1.35);
      s.actor.act('think', G.cpuT + 0.2, 0, true);
      TTT.sfx.think(s.id === 'bolt');
      const p = s.actor.root.position;
      flyers.add('🤔', p.x, 2.9, p.z, 0, 0.3, 0.6, G.cpuT, 0, 0);
    } else if (G.auto) G.cpuT = 0.35;
    updateTurnText();
  }

  // A square was chosen for the side to move. Returns false if it can't be played.
  function move(i, byKid) {
    const st = G.round;
    if (!st || st.over || G.state !== 'play' || G.lockT > 0) return false;
    if (!R.isLegal(st, i)) {
      if (byKid) TTT.sfx.nope();
      return false;
    }
    const s = current();
    const kind = R.judge(st, i);
    const ev = R.play(st, i);
    G.lockT = 0.3;
    G.cpuT = -1;
    if (G.mode === 'regular') {
      ST.place(i, ev.to);
      setTimeout(() => TTT.sfx.place(ev.mark), 200);
    } else {
      ST.spin(i, ev.from, ev.to, ev.mark === X ? 1 : -1);
      TTT.sfx.spin(ev.mark === X ? 1 : -1);
    }
    ST.lock(st.lockRule && !st.over ? st.lock : -1);
    if (s.human) {
      ST.hint(-1);
      TTT.buddy.moved();
    }
    // the mover reaches toward the board; the good moves get a word and a cheer
    if (s.actor.mode !== 'signature') s.actor.act('give', 0.45, 0, true);
    react(kind, ev, s);
    if (st.over) {
      G.endEv = ev;
      G.endT = G.mode === 'regular' ? 0.5 : 0.7;
    } else {
      G.waitT = G.mode === 'regular' ? 0.45 : 0.62;
    }
    updateTurnText();
    return true;
  }

  const WORDS = { block: 'BLOCKED!', fork: 'SUPER!', threat: 'NICE!', steal: 'GOTCHA!', erase: 'POOF!', center: 'NICE!', oops: 'OOPS!' };
  function react(kind, ev, s) {
    if (!kind || kind === 'win') return;
    const p = ST.cellPos(ev.cell);
    const word = WORDS[kind];
    if (word) bursts.add(word, p.x, ST.TOP + 1.2, p.z, 1.7, kind === 'oops' ? '#b8e2ff' : '#ffd400', kind === 'oops' ? '#2f7cf0' : '#e8372c');
    const foe = G.sides.find((o) => o !== s);
    setTimeout(() => {
      if (kind === 'oops') {
        s.actor.react('shrug');
        TTT.sfx.oops();
        return;
      }
      if (kind === 'block') TTT.sfx.block();
      else TTT.sfx.nice();
      s.actor.react('cheer');
      if (kind === 'block' || kind === 'steal' || kind === 'erase' || kind === 'fork') foe.actor.react('oops');
    }, 260);
  }

  function endRound() {
    const st = G.round, ev = G.endEv;
    G.results.push(st.winner || 3);
    if (st.winner) G.wins[st.winner]++;
    G.starter = R.other(G.starter);
    const win = st.winner ? sideOf(st.winner) : null, lose = win ? G.sides.find((s) => s !== win) : null;
    if (win) {
      ST.win(st.line);
      win.actor.react('signature');
      setTimeout(() => lose.actor.react('shrug'), 250);
      const a = ST.toScreen(ST.cellPos(st.line[1]));
      const humanWon = win.human;
      if (humanWon) {
        TTT.sfx.win();
        TTT.fx.overlay.burst(a.x, a.y, 70, ['⭐', '🎉', win.mark === X ? '💙' : '🧡'], 1.2);
        TTT.fx.overlay.rain(70);
      } else TTT.sfx.lose();
      if (ev && ev.gift) toast(`${nameOf(lose.id)} SPUN IT FOR ${nameOf(win.id)}!`, 'hint');
      bumpScore(win === G.sides[0] ? ui.scoreL : ui.scoreR);
    } else {
      TTT.sfx.draw();
      G.sides.forEach((s) => s.actor.react('shrug'));
      const p = ST.cellPos(4);
      for (let i = 0; i < 6; i++) flyers.add('🤝', p.x, ST.TOP + 1, p.z, rand(-2, 2), rand(2, 3.5), 0.6, 1.2, rand(-2, 2), 4);
    }
    G.state = 'ended';
    G.endT = -1;
    renderScore();
    updateTurnText();
    const over = G.wins[1] >= TO_WIN || G.wins[2] >= TO_WIN || G.results.length >= ROUNDS;
    G.panelT = over ? 2.6 : 2.0;
    G.matchDone = over;
  }

  function showRoundPanel() {
    const st = G.round;
    const win = st.winner ? sideOf(st.winner) : null;
    ui.rFace.innerHTML = win ? `<img alt="" src="${art[win.id]}">` : '<span class="big">🤝</span>';
    ui.rTitle.textContent = win ? `${nameOf(win.id)} WINS!` : 'DRAW!';
    renderPanelScore(ui.rScore);
    G.state = 'between';
    show(ui.roundOver, true);
  }

  function showMatchPanel() {
    const a = G.sides[0], b = G.sides[1];
    const wa = G.wins[a.mark], wb = G.wins[b.mark];
    const win = wa > wb ? a : wb > wa ? b : null;
    ui.mFace.innerHTML = win ? `<img alt="" src="${art[win.id]}"><span class="big">🏆</span>` : '<span class="big">🤝</span>';
    ui.mTitle.textContent = win ? `${nameOf(win.id)} WINS THE MATCH!` : 'TIE MATCH!';
    renderPanelScore(ui.mScore);
    G.state = 'match';
    show(ui.matchOver, true);
    if (win) {
      win.actor.react('over');
      const lose = win === a ? b : a;
      lose.actor.react('sulk');
      if (win.human) {
        TTT.sfx.trophy();
        TTT.fx.overlay.rain(140);
      } else TTT.sfx.lose();
    } else TTT.sfx.draw();
  }

  function renderPanelScore(el) {
    const a = G.sides[0], b = G.sides[1];
    el.innerHTML = `<span>${G.wins[a.mark]}</span><i class="chip ${a.mark === X ? 'x' : 'o'}">${a.mark === X ? '✕' : '◯'}</i><span class="dash">–</span><i class="chip ${b.mark === X ? 'x' : 'o'}">${b.mark === X ? '✕' : '◯'}</i><span>${G.wins[b.mark]}</span>`;
  }

  function next() {
    gesture();
    if (G.state === 'between') startRound();
    else if (G.state === 'match') startMatch();
  }

  function restartRound() {
    if (G.state !== 'play' && G.state !== 'paused' && G.state !== 'ended') return;
    if (G.state === 'ended') {
      // undo the finished round's result before playing it again
      const r = G.results.pop();
      if (r && r !== 3) G.wins[r]--;
      G.starter = R.other(G.starter);
    }
    show(ui.pause, false);
    startRound();
    toast('🔄', 'hint');
  }

  // ---------------------------------------------------------------- home

  function goHome() {
    G.state = 'home';
    document.body.dataset.screen = 'home';
    show(ui.hud, false);
    show(ui.callBtn, false);
    show(ui.roundOver, false);
    show(ui.matchOver, false);
    show(ui.pause, false);
    show(ui.home, true);
    TTT.buddy.reset();
    TTT.highFive.cancel();
    ST.hint(-1);
    ST.lock(-1);
    ST.cursor(-1);
    ST.hover(-1, 0);
    clearToasts();
    TTT.fx.overlay.clear();
    G.sides = [{ id: 'teddy', mark: X, human: false }, { id: 'tommy', mark: O, human: false }];
    setActors();
    layout();
    G.sides.forEach((s) => s.actor.react('hello'));
    refreshHome();
    demoStart();
    S.music('title');
  }

  // the board plays itself behind the menu: a slow game between the boys, regular then spin
  function demoStart() {
    const mode = G.demo && G.demo.mode === 'regular' ? 'spin' : 'regular';
    G.demo = { mode, st: R.newRound(mode, Math.random() < 0.5 ? X : O), t: 1.4, end: -1 };
    ST.set(G.demo.st.board);
  }
  function demoUpdate(dt) {
    const d = G.demo;
    if (!d) return;
    d.t -= dt;
    if (d.end >= 0) {
      d.end -= dt;
      if (d.end < 0) demoStart();
      return;
    }
    if (d.t > 0) return;
    const st = d.st;
    const i = R.cpuMove(st, Math.random() < 0.6 ? 'normal' : 'easy');
    const ev = R.play(st, i);
    if (st.mode === 'regular') {
      ST.place(i, ev.to);
      setTimeout(() => G.state === 'home' && TTT.sfx.place(ev.mark), 200);
    } else {
      ST.spin(i, ev.from, ev.to, ev.mark === X ? 1 : -1);
    }
    const s = sideOf(ev.mark);
    s.actor.act('give', 0.45, 0, true);
    d.t = st.mode === 'regular' ? 1.3 : 1.0;
    if (st.over || (st.mode === 'spin' && st.spins >= 12)) {
      d.end = 3.2;
      if (st.winner) {
        setTimeout(() => {
          if (G.state !== 'home' || G.demo !== d) return;
          ST.win(st.line);
          sideOf(st.winner).actor.react('signature');
          sideOf(R.other(st.winner)).actor.react('shrug');
        }, 600);
      }
    }
  }

  function refreshHome() {
    const seg = (el, v) => {
      for (const b of el.children) {
        const on = b.dataset.v === String(v);
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        b.setAttribute('role', 'radio');
      }
    };
    seg(ui.segPlayers, prefs.players);
    seg(ui.segWho, prefs.who);
    seg(ui.segLevel, prefs.level);
    ui.segWho.style.display = ui.segLevel.style.display = prefs.players === 1 ? '' : 'none';
    ui.duo.style.display = prefs.players === 2 ? '' : 'none';
  }

  function setPref(k, v) {
    gesture();
    prefs[k] = v;
    save();
    refreshHome();
    TTT.sfx.kit('click');
    if (k === 'who') {
      const s = G.sides && G.sides.find((x) => x.id === v);
      if (s && G.state === 'home') s.actor.react('hello');
    }
  }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    const [a, b] = G.sides;
    ui.faceL.src = art[a.id];
    ui.faceR.src = art[b.id];
    for (const [el, s] of [[ui.chipL, a], [ui.chipR, b]]) {
      el.className = 'chip ' + (s.mark === X ? 'x' : 'o');
      el.textContent = s.mark === X ? '✕' : '◯';
    }
    ui.spinbar.style.display = G.mode === 'spin' ? '' : 'none';
    if (G.players === 1) {
      const bud = TTT.buddy.entry;
      ui.callBtn.innerHTML = `<img alt="" src="${art[bud.id]}"><kbd>T</kbd>`;
      const nice = bud.name[0] + bud.name.slice(1).toLowerCase();
      ui.callBtn.title = `Call ${nice} (T)`;
      ui.callBtn.setAttribute('aria-label', `Call ${nice}`);
    } else {
      ui.callBtn.innerHTML = '🙌<kbd>T</kbd>';
      ui.callBtn.title = 'High five! (T)';
      ui.callBtn.setAttribute('aria-label', 'High five!');
    }
  }

  function renderScore() {
    const [a, b] = G.sides;
    ui.scoreL.textContent = G.wins[a.mark];
    ui.scoreR.textContent = G.wins[b.mark];
    let html = '';
    for (let i = 0; i < ROUNDS; i++) {
      const r = G.results[i];
      const cls = r === X ? 'x' : r === O ? 'o' : r === 3 ? 'd' : i === G.results.length && G.state === 'play' ? 'now' : '';
      html += `<i class="${cls}"></i>`;
    }
    ui.dots.innerHTML = html;
  }
  function bumpScore(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  const cache = {};
  function setText(el, key, v) {
    if (cache[key] !== v) {
      cache[key] = v;
      el.textContent = v;
    }
  }

  function updateTurnText() {
    if (!G.round || !ui) return;
    const s = current();
    const st = G.round;
    let text = '', mine = false;
    if (G.state === 'ended' || st.over) text = st.winner ? `${nameOf(sideOf(st.winner).id)} WINS!` : 'DRAW!';
    else if (!s.human) text = `${nameOf(s.id)} IS THINKING…`;
    else if (G.players === 1) {
      text = 'YOUR TURN!';
      mine = true;
    } else {
      text = `${nameOf(s.id)}'S TURN!`;
      mine = true;
    }
    setText(ui.turn, 'turn', text);
    ui.turn.classList.toggle('mine', mine);
    ui.sideL.classList.toggle('now', !st.over && G.sides[0].mark === st.turn);
    ui.sideR.classList.toggle('now', !st.over && G.sides[1].mark === st.turn);
    setText(ui.spinCount, 'spins', `${st.spins} / ${st.limit}`);
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), cls === 'save' ? 2450 : 1950);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  }
  function clearToasts() {
    if (ui) ui.toasts.innerHTML = '';
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  // ---------------------------------------------------------------- your brother and the high five

  function call() {
    gesture();
    if (!G.sides || (G.state !== 'play' && G.state !== 'ended' && G.state !== 'between' && G.state !== 'match')) return 'none';
    if (G.players === 2) return TTT.highFive.start();
    return TTT.buddy.call();
  }

  const buddyApi = {
    toast: (t, c) => toast(t, c),
    player: () => kid().actor,
    spot: () => spots.buddy,
    turnId: () => G.turnId,
    canHint: () => G.state === 'play' && G.round && !G.round.over && current() === kid() && G.lockT <= 0,
    roundOver: () => G.state !== 'play' || (G.round && G.round.over),
    showHint() {
      const h = R.hint(G.round, G.level);
      if (!h) return null;
      ST.hint(h.cell);
      return h;
    },
    clearHint: () => ST.hint(-1),
    players: () => [G.sides[0].actor, G.sides[1].actor],
    meet: () => spots.meet,
    homes: () => spots.sides,
    get flyers() { return flyers; },
  };

  // ---------------------------------------------------------------- input

  let audioReady = false;
  function gesture() {
    if (!audioReady) {
      audioReady = true;
      S.init();
      S.music('title');
    } else S.init();
  }

  // what a tap on square i would make, for the see-through preview
  function ghostFor(i) {
    const st = G.round;
    if (!st || st.over || G.state !== 'play' || i < 0 || !R.isLegal(st, i)) return 0;
    const s = current();
    if (!s || !s.human) return 0;
    return st.mode === 'regular' ? st.turn : R.spun(st.board[i]);
  }

  function humanTap(i) {
    const s = current();
    if (G.state !== 'play' || !s || !s.human || G.auto) return false;
    return move(i, true);
  }

  function moveCursor(dx, dy) {
    if (G.state !== 'play') return;
    let c = G.cursor < 0 ? 4 : G.cursor;
    if (G.cursor >= 0) {
      const col = Math.min(2, Math.max(0, (c % 3) + dx)), row = Math.min(2, Math.max(0, Math.floor(c / 3) + dy));
      c = row * 3 + col;
    }
    G.cursor = c;
    TTT.sfx.tick();
  }

  function bindInput() {
    ui.canvas.addEventListener('pointerdown', (e) => {
      gesture();
      if (G.state !== 'play') return;
      const i = ST.pick(e.clientX, e.clientY);
      if (i >= 0) {
        G.cursor = -1;
        humanTap(i);
      }
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const i = G.state === 'play' ? ST.pick(e.clientX, e.clientY) : -1;
      if (i !== G.hover && i >= 0 && ghostFor(i)) TTT.sfx.tick();
      G.hover = i;
      ui.canvas.style.cursor = i >= 0 && ghostFor(i) ? 'pointer' : '';
    });
    ui.canvas.addEventListener('pointerleave', () => (G.hover = -1));
    const tap = (el, fn) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      gesture();
      fn();
    });
    tap(ui.goRegular, () => startMatch({ mode: 'regular' }));
    tap(ui.goSpin, () => startMatch({ mode: 'spin' }));
    for (const b of ui.segPlayers.children) tap(b, () => setPref('players', +b.dataset.v));
    for (const b of ui.segWho.children) tap(b, () => setPref('who', b.dataset.v));
    for (const b of ui.segLevel.children) tap(b, () => setPref('level', b.dataset.v));
    ui.callBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      call();
    });
    tap(ui.pauseBtn, () => pause(true));
    tap(ui.pResume, () => pause(false));
    tap(ui.pRestart, restartRound);
    tap(ui.pHome, goHome);
    tap(ui.rNext, next);
    tap(ui.rHome, goHome);
    tap(ui.mAgain, next);
    tap(ui.mHome, goHome);
    tap(ui.muteBtn, toggleMute);
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      gesture();
      const k = e.key.toLowerCase();
      const pad = /^Numpad([1-9])$/.exec(e.code);
      const digit = pad ? +pad[1] : /^[1-9]$/.test(e.key) ? +e.key : 0;
      if (k === 'm') return toggleMute();
      if (G.state === 'home') {
        if (digit === 1) startMatch({ mode: 'regular' });
        else if (digit === 2) startMatch({ mode: 'spin' });
        else if (k === 'arrowleft' || k === 'arrowright') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'arrowup' || k === 'arrowdown') setPref('players', prefs.players === 1 ? 2 : 1);
        else if (k === 'l') setPref('level', prefs.level === 'easy' ? 'normal' : 'easy');
        else if (k === 'enter' || k === ' ') startMatch({});
        return;
      }
      if (k === 't') return call();
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        else if (k === 'r') restartRound();
        return;
      }
      if (G.state === 'between' || G.state === 'match') {
        if (k === 'enter' || k === ' ') next();
        else if (k === 'escape') goHome();
        return;
      }
      if (k === 'escape' || k === 'p') return pause(true);
      if (k === 'r') return restartRound();
      if (G.state !== 'play') return;
      if (digit) {
        G.cursor = ST.PAD.indexOf(digit);
        humanTap(G.cursor);
      } else if (k === 'arrowleft') moveCursor(-1, 0);
      else if (k === 'arrowright') moveCursor(1, 0);
      else if (k === 'arrowup') moveCursor(0, -1);
      else if (k === 'arrowdown') moveCursor(0, 1);
      else if ((k === 'enter' || k === ' ') && G.cursor >= 0) humanTap(G.cursor);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    });
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
  }

  function pause(on) {
    if (on && (G.state === 'play' || G.state === 'ended')) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      S.music('title');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  const tmp = new THREE.Vector3();
  function step(dt) {
    dt = Math.min(dt, 0.1);
    // the window can start at 0 x 0 (a hidden tab) and resize without an event reaching us: re-fit when it changes
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout();
    const running = G.state !== 'paused' && G.state !== 'boot';
    if (running) {
      if (G.state === 'home') demoUpdate(dt);
      if (G.state === 'play') {
        G.lockT = Math.max(0, G.lockT - dt);
        if (G.waitT > 0) {
          G.waitT -= dt;
          if (G.waitT <= 0 && !G.round.over) beginTurn();
        } else if (G.cpuT > 0) {
          G.cpuT -= dt;
          if (G.cpuT <= 0) {
            const s = current();
            const level = s.human ? 'normal' : G.level; // test bot (G.auto) plays the kid's side well
            move(R.cpuMove(G.round, s.human ? (G.autoLevel || level) : level), false);
          }
        }
        if (G.endT > 0) {
          G.endT -= dt;
          if (G.endT <= 0) endRound();
        }
      }
      if (G.state === 'ended' && G.panelT > 0) {
        G.panelT -= dt;
        if (G.panelT <= 0) (G.matchDone ? showMatchPanel : showRoundPanel)();
      }
      ST.update(dt);
      flyers.update(dt);
      bursts.update(dt);
      if (G.sides) G.sides.forEach((s) => s.actor.update(dt));
      TTT.buddy.update(dt);
      TTT.highFive.update(dt);
    }
    // the turn badge over whoever is to move, and the hover / cursor preview
    const st = G.state === 'home' ? (G.demo && G.demo.st) : G.round;
    if (G.sides) {
      G.sides.forEach((s, k) => {
        const on = st && !st.over && st.turn === s.mark && G.state !== 'home';
        const bdg = badges[k];
        bdg.visible = !!on;
        if (on) {
          s.actor.root.getWorldPosition(tmp);
          bdg.position.set(tmp.x, 2.75 + Math.abs(Math.sin(performance.now() / 260)) * 0.18, tmp.z);
        }
      });
    }
    const hov = G.state === 'play' ? G.hover : -1, cur = G.state === 'play' ? G.cursor : -1;
    ST.hover(hov, ghostFor(hov >= 0 ? hov : cur));
    ST.cursor(cur);
    TTT.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', TTT.buddy.on || TTT.highFive.on);
    ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    ui = {
      canvas: $('game'), home: $('home'), hud: $('hud'), hudtop: document.querySelector('.hudtop'), logo: $('logo'),
      goRegular: $('goRegular'), goSpin: $('goSpin'), segPlayers: $('segPlayers'), segWho: $('segWho'), segLevel: $('segLevel'),
      duo: $('duo'), duoA: $('duoA'), duoB: $('duoB'), pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'), sideL: $('sideL'),
      sideR: $('sideR'), faceL: $('faceL'), faceR: $('faceR'), chipL: $('chipL'), chipR: $('chipR'), scoreL: $('scoreL'),
      scoreR: $('scoreR'), dots: $('dots'), turn: $('turn'), spinbar: $('spinbar'), spinCount: $('spinCount'),
      callBtn: $('callBtn'), toasts: $('toasts'), roundOver: $('roundOver'), rFace: $('rFace'), rTitle: $('rTitle'),
      rScore: $('rScore'), rNext: $('rNext'), rHome: $('rHome'), matchOver: $('matchOver'), mFace: $('mFace'),
      mTitle: $('mTitle'), mScore: $('mScore'), mAgain: $('mAgain'), mHome: $('mHome'), pause: $('pause'),
      pResume: $('pResume'), pRestart: $('pRestart'), pHome: $('pHome'),
    };
    // the logo: the first word small on top, the rest big ("TT" / "Tic-Tac-Toe"); a one-word name is all big
    const words = window.TTT_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    ST.init(ui.canvas);
    TTT.fx.overlay.init($('fx'));
    flyers = TTT.fx.flyers(ST.scene, 60);
    bursts = TTT.fx.bursts(ST.scene, 6);
    actors.forEach((a) => a.attach(ST.scene, flyers));
    art = Kit.portraits(['teddy', 'tommy', 'bolt', 'bruno'].map((id) => Kit.roster.get(id)), { size: 160 });
    ui.segWho.children[0].querySelector('img').src = art.teddy;
    ui.segWho.children[1].querySelector('img').src = art.tommy;
    ui.segLevel.children[0].querySelector('img').src = art.bruno;
    ui.segLevel.children[1].querySelector('img').src = art.bolt;
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    TTT.buddy.init(buddyApi);
    bindInput();
    goHome();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  window.game = {
    // advance `secs` of game time in 1/60 s steps, rendering once at the end (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60);
      return game.info();
    },
    hold(on = true) { G.held = on; },
    // start({ mode: 'regular' | 'spin', players: 1 | 2, who: 'teddy' | 'tommy', level: 'easy' | 'normal' })
    start(opts = {}) {
      startMatch(opts);
      return game.info();
    },
    home: () => goHome(),
    tap: (i) => humanTap(i),         // play square i (0..8, from the top left) for the kid whose turn it is
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    pause: (on = true) => pause(on),
    next: () => next(),
    restart: () => restartRound(),
    // let a test bot play the kid's side too ('normal' plays perfectly in regular, 'easy' at random)
    auto(on = true, level = 'normal') {
      G.auto = on;
      G.autoLevel = level;
      if (on && G.state === 'play' && current() && current().human && G.cpuT < 0 && G.waitT <= 0) G.cpuT = 0.3;
    },
    // set the board straight away (for screenshots): board is 9 numbers (0 empty, 1 X, 2 O), turn the mark to move
    stage(board, turn) {
      G.round.board = board.slice();
      if (turn) G.round.turn = turn;
      ST.set(G.round.board);
      G.cpuT = -1;
      G.waitT = -1;
      beginTurn();
      return game.info();
    },
    check: (opts) => TTT.check(opts),
    info() {
      const st = G.round;
      return {
        state: G.state, mode: G.mode, players: G.players, level: G.level,
        sides: G.sides && G.sides.map((s) => ({ id: s.id, mark: s.mark, human: s.human, pose: s.actor.pose })),
        board: st && st.board.join(''), turn: st && st.turn, spins: st && st.spins, over: st && st.over, winner: st && st.winner,
        round: G.results.length + (G.state === 'play' ? 1 : 0), results: G.results.slice(), wins: Object.assign({}, G.wins),
        buddy: TTT.buddy.info(), hint: ST.hintCell, panel: !ui.roundOver.classList.contains('hidden') ? 'round' : !ui.matchOver.classList.contains('hidden') ? 'match' : null,
      };
    },
    get G() { return G; },
    get rules() { return R; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();
