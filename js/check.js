/* TT Tic-Tac-Toe: the headless checks, on the same rules and CPU the game plays with (js/rules.js). No page needed:
   game.check() runs them in the browser and `node tools/check.js` in a terminal.

   REGULAR  the 🔥 NORMAL CPU never loses:
            - every game against every possible opponent (the whole game tree, the CPU going first and second, and
              each of the CPU's equally good moves, since it picks among them at random);
            - plus many games against test bots (random, the 🐣 EASY CPU, a "kid" bot, itself).
   SPIN     every game ends, with a winner or with the draw after SPIN_RULES.limit spins, never later
            (the mirrored spin: X turns a square empty -> X -> O, O turns it empty -> O -> X):
            many games between the bots, the CPU on both levels and a bot that only ever spins one square.
   Sabotage, to prove the checks can fail:
            { sabotage: 'shallow' }  the NORMAL CPU only looks one move ahead -> the tree search finds lost games
            { sabotage: 'nolimit' }  no draw rule in SPIN -> two bots that never finish a line play forever, and
                                     games still going after 600 spins are reported
            { sabotage: 'wildbrother' }  your brother's flips may finish the other side's line -> reported
   MISCHIEF your brother in SPIN (flip a mark to empty or the other mark, or bomb a row or column) never hands the
            other side the win: every flip and bomb on every board, and games where the kid keeps calling him. */
(function (root) {
  'use strict';
  const TTT = (root.TTT = root.TTT || {});
  const R = TTT.rules;
  const { X, O, other } = R;

  // the bots: each returns a square for the side to move
  const BOTS = {
    random: (st, rng) => {
      const m = R.legal(st);
      return m[Math.floor(rng() * m.length)];
    },
    easy: (st, rng) => R.cpuMove(st, 'easy', rng),
    normal: (st, rng) => R.cpuMove(st, 'normal', rng),
    // a kid: takes a win it can see most of the time, blocks sometimes, otherwise anywhere
    kid: (st, rng) => {
      const win = R.winsFor(st, st.turn);
      if (win.length && rng() < 0.7) return win[0];
      const block = st.mode === 'regular' ? R.winsFor(st, other(st.turn)) : [];
      if (block.length && rng() < 0.4) return block[0];
      return BOTS.random(st, rng);
    },
    // careful: always takes a win, never makes the other side's line, blocks a win it can see, otherwise anywhere
    careful: (st, rng) => {
      const me = st.turn, you = other(me);
      const win = R.winsFor(st, me);
      if (win.length) return win[0];
      const all = R.legal(st);
      const safe = st.mode === 'spin' ? all.filter((i) => !R.gives(st, i)) : all;
      const block = safe.filter((i) => {
        const t = R.clone(st);
        R.play(t, i);
        return !t.over && !R.winsFor(Object.assign({}, t, { turn: you, lock: -1 }), you).length;
      });
      const pool = block.length ? block : safe.length ? safe : all;
      return pool[Math.floor(rng() * pool.length)];
    },
    // SPIN: always the lowest square it may spin that doesn't finish any line (so it never wins or loses)
    staller: (st) => {
      const m = R.legal(st);
      for (const i of m) {
        const b = st.board.slice();
        b[i] = R.spun(b[i], st.turn);
        if (!R.lineMask(b)) return i;
      }
      return m[0];
    },
  };

  // the CPU under test, sabotaged or not
  function cpu(sabotage) {
    if (sabotage === 'shallow') {
      return (st, rng) => {
        const win = R.winsFor(st, st.turn);
        if (win.length) return win[0];
        return BOTS.random(st, rng);
      };
    }
    return BOTS.normal;
  }

  // REGULAR: walk the whole game tree. At the CPU's turns follow every move it might pick (all its best-scoring
  // moves, or with the sabotage every move the shallow CPU might make); at the opponent's turns follow every move.
  function regularTree(cpuMark, sabotage) {
    let games = 0, lost = 0, drawn = 0, won = 0;
    const example = [];
    function cpuChoices(st) {
      if (sabotage === 'shallow') {
        const win = R.winsFor(st, st.turn);
        return win.length ? [win[0]] : R.legal(st);
      }
      const sc = R.regularScores(st);
      const top = Math.max(...sc.map((m) => m.score));
      return sc.filter((m) => m.score === top).map((m) => m.cell);
    }
    function walk(st, path) {
      if (st.over) {
        games++;
        if (st.winner === cpuMark) won++;
        else if (st.winner) {
          lost++;
          if (example.length < 3) example.push(path.join(' '));
        } else drawn++;
        return;
      }
      const moves = st.turn === cpuMark ? cpuChoices(st) : R.legal(st);
      for (const i of moves) {
        const t = R.clone(st);
        R.play(t, i);
        walk(t, path.concat(i + 1));
      }
    }
    for (const first of [X, O]) walk(R.newRound('regular', first), []);
    return { cpu: cpuMark === X ? 'X' : 'O', games, won, drawn, lost, lostExamples: example };
  }

  // Play one game between two move functions. Returns the final state and how many moves it took.
  function playGame(mode, first, xMove, oMove, rng, rules, cap = 600) {
    const st = R.newRound(mode, first, rules);
    let n = 0;
    while (!st.over && n < cap) {
      const f = st.turn === X ? xMove : oMove;
      const i = f(st, rng);
      if (!R.play(st, i)) throw new Error(`illegal move ${i} in ${mode}`);
      n++;
    }
    return { st, n };
  }

  function check(opts = {}) {
    const games = opts.games || 200;
    const seed = opts.seed || 7;
    const rng = R.seeded(seed);
    const sabotage = opts.sabotage || null;
    const out = { ok: true, failures: [], seed, sabotage };
    const fail = (msg) => {
      out.ok = false;
      if (out.failures.length < 12) out.failures.push(msg);
    };

    // ---- REGULAR: the Normal CPU never loses
    const brain = cpu(sabotage);
    const tree = [regularTree(X, sabotage), regularTree(O, sabotage)];
    for (const t of tree) if (t.lost) fail(`regular tree: the CPU as ${t.cpu} lost ${t.lost} of ${t.games} games, e.g. squares ${t.lostExamples[0]}`);
    const vs = {};
    for (const bot of ['random', 'kid', 'easy', 'normal']) {
      const r = { games: 0, cpuWins: 0, draws: 0, cpuLosses: 0 };
      for (let g = 0; g < games; g++) {
        const cpuMark = g % 2 ? X : O, first = (g >> 1) % 2 ? X : O;
        const x = cpuMark === X ? brain : BOTS[bot], o = cpuMark === O ? brain : BOTS[bot];
        const { st } = playGame('regular', first, x, o, rng);
        r.games++;
        if (st.winner === cpuMark) r.cpuWins++;
        else if (st.winner) r.cpuLosses++;
        else r.draws++;
      }
      if (r.cpuLosses) fail(`regular: the CPU lost ${r.cpuLosses} of ${r.games} games against the ${bot} bot`);
      vs[bot] = r;
    }
    out.regular = { tree, vs };

    // ---- SPIN: every game ends, by a line or by the draw rule
    const rules = Object.assign({}, R.SPIN_RULES, opts.rules || {});
    if (sabotage === 'nolimit') rules.limit = Infinity;
    const cap = Number.isFinite(rules.limit) ? rules.limit + 5 : 600;
    const pairs = [['normal', 'normal'], ['normal', 'easy'], ['easy', 'normal'], ['easy', 'easy'], ['kid', 'random'], ['random', 'random'], ['staller', 'staller'], ['staller', 'normal']];
    const spin = { rules: { limit: rules.limit, lock: rules.lock }, pairs: {}, longest: 0, unfinished: 0 };
    const spinGames = Math.max(10, Math.round(games / 4));
    for (const [a, b] of pairs) {
      const r = { games: 0, x: 0, o: 0, draws: 0, gifts: 0, unfinished: 0, avgSpins: 0 };
      for (let g = 0; g < spinGames; g++) {
        const first = g % 2 ? X : O;
        const st = R.newRound('spin', first, rules);
        let n = 0, gifts = 0;
        while (!st.over && n < cap) {
          const i = (st.turn === X ? BOTS[a] : BOTS[b])(st, rng);
          const ev = R.play(st, i);
          if (!ev) {
            fail(`spin: ${a} v ${b} tried an illegal spin on square ${i + 1}`);
            break;
          }
          if (ev.gift) gifts++;
          n++;
        }
        r.games++;
        r.avgSpins += n;
        spin.longest = Math.max(spin.longest, n);
        if (!st.over) {
          r.unfinished++;
          spin.unfinished++;
        } else if (st.winner === X) r.x++;
        else if (st.winner === O) r.o++;
        else r.draws++;
        r.gifts += gifts;
        if (st.over && st.draw && st.spins !== rules.limit) fail(`spin: a draw after ${st.spins} spins (the rule says ${rules.limit})`);
        if (st.over && st.winner && !st.line) fail('spin: a winner with no line');
        if (n > rules.limit) fail(`spin: ${a} v ${b} went on for ${n} spins`);
      }
      r.avgSpins = +(r.avgSpins / r.games).toFixed(1);
      if (r.unfinished) fail(`spin: ${r.unfinished} of ${r.games} ${a} v ${b} games never ended (still going after ${cap} spins)`);
      spin.pairs[`${a} v ${b}`] = r;
    }
    // a spin can hand the other side the win
    const st = R.newRound('spin', O, rules);
    st.board = [1, 2, 2, 1, 0, 0, 2, 0, 0]; // O spins its own bottom-left O into an X: X's left column
    const ev = R.play(st, 6);
    if (!(ev && ev.win === X && ev.gift)) fail("spin: O turning an O into an X in X's column should hand X the win");
    const st2 = R.newRound('spin', X, rules);
    st2.board = [2, 2, 1, 0, 0, 0, 0, 0, 0]; // X spins its own top-right X into an O: O's top row
    const ev2 = R.play(st2, 2);
    if (!(ev2 && ev2.win === O && ev2.gift)) fail("spin: X turning an X into an O in O's row should hand O the win");
    // the mirrored spin: an empty square becomes the spinner's own mark, the other mark goes, your own turns over
    const one = (v, m) => R.spun(v, m);
    if (one(0, X) !== X || one(X, X) !== O || one(O, X) !== 0 || one(0, O) !== O || one(O, O) !== X || one(X, O) !== 0) fail('spin: the steps are wrong');
    // "both lines at once" can't happen: one spin changes one square into one mark, so from any board with no line
    // it can only make lines of that mark. Every board and every spin, by either side:
    let pairsSeen = 0;
    const b = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let code = 0; code < 19683; code++) {
      let c = code;
      for (let i = 0; i < 9; i++) {
        b[i] = c % 3;
        c = Math.floor(c / 3);
      }
      if (R.lineMask(b)) continue;
      for (let i = 0; i < 9; i++) {
        for (const m of [X, O]) {
          const v = b[i];
          b[i] = R.spun(v, m);
          if (R.lineMask(b) === 3) pairsSeen++;
          b[i] = v;
        }
      }
    }
    spin.bothLinesAtOnce = pairsSeen;
    if (pairsSeen) fail(`spin: ${pairsSeen} spins made both lines at once`);
    out.spin = spin;

    // ---- SPIN: your brother's mischief (flip a mark to empty or the other mark, or bomb a row or column)
    // He never hands the other side the win. Every board with no line, for a kid on either side:
    const wild = sabotage === 'wildbrother';
    const mis = { boards: 0, flips: 0, bombs: 0, flipsLeftOut: 0, games: 0, calls: 0, kidWinsByFlip: 0, foeWinsByFlip: 0, unfinished: 0 };
    for (let code = 0; code < 19683; code++) {
      let c = code;
      for (let i = 0; i < 9; i++) {
        b[i] = c % 3;
        c = Math.floor(c / 3);
      }
      if (R.lineMask(b)) continue;
      mis.boards++;
      for (const kid of [X, O]) {
        const st = R.newRound('spin', kid, rules);
        st.board = b.slice();
        const { flips, bombs } = R.mischiefOptions(st, kid, wild);
        const marks = b.filter((v) => v).length;
        // every mark can go two ways; the ones left out must be exactly those that finish the other side's line
        let gives = 0;
        for (let i = 0; i < 9; i++) {
          if (!b[i]) continue;
          for (const to of [0, R.other(b[i])]) {
            const t = b.slice();
            t[i] = to;
            if (R.lineMask(t) === R.other(kid)) gives++;
          }
        }
        if (!wild && flips.length !== marks * 2 - gives) fail(`mischief: board ${b.join('')} lists ${flips.length} flips, expected ${marks * 2 - gives}`);
        mis.flipsLeftOut += gives;
        for (const f of flips) {
          const t = R.clone(st);
          const ev = R.applyMischief(t, f);
          mis.flips++;
          if (ev.win && ev.win !== kid) fail(`mischief: on ${b.join('')} flipping square ${f.cell + 1} to ${f.to} hands the other side the win`);
          if (t.spins !== st.spins || t.turn !== st.turn) fail('mischief: a flip changed the spin count or the turn');
        }
        for (const bo of bombs) {
          mis.bombs++;
          if (!bo.cells.some((i) => b[i])) fail(`mischief: a bomb on an empty ${bo.axis}`);
          const t = R.clone(st);
          const ev = R.applyMischief(t, bo);
          if (ev.win || bo.cells.some((i) => t.board[i])) fail('mischief: a bomb left a mark or made a line');
        }
        if (!marks && R.mischief(st, kid, rng) !== null) fail('mischief: something to do on an empty board');
      }
    }
    // games where the kid calls him on about a third of its turns: they still end, and he never loses one for the kid
    for (const [kidBot, level] of [['kid', 'easy'], ['kid', 'normal'], ['random', 'normal'], ['careful', 'normal']]) {
      for (let g = 0; g < Math.max(10, Math.round(games / 4)); g++) {
        const kid = g % 2 ? X : O;
        const st = R.newRound('spin', g % 4 < 2 ? X : O, rules);
        let n = 0;
        while (!st.over && n < cap) {
          if (st.turn === kid && rng() < 0.33) {
            mis.calls++;
            const ev = R.applyMischief(st, R.mischief(st, kid, rng, wild));
            if (ev && ev.win === kid) mis.kidWinsByFlip++;
            if (ev && ev.win && ev.win !== kid) {
              mis.foeWinsByFlip++;
              fail(`mischief: in a game the brother's flip handed the CPU the win`);
            }
            if (st.over) break;
          }
          R.play(st, st.turn === kid ? BOTS[kidBot](st, rng) : R.cpuMove(st, level, rng));
          n++;
        }
        mis.games++;
        if (!st.over) {
          mis.unfinished++;
          fail('mischief: a game with the brother called never ended');
        }
        if (st.spins > rules.limit) fail(`mischief: a game went on for ${st.spins} spins`);
      }
    }
    out.mischief = mis;
    return out;
  }

  // Win rates of the kids' test bots against each CPU level, both modes, playing as Teddy and as Tommy in turn
  // (who starts swaps every game). Not a pass / fail check: it's how the levels were tuned.
  function rates(games = 1000, seed = 11) {
    const rng = R.seeded(seed);
    const out = {};
    for (const mode of ['regular', 'spin']) {
      for (const level of ['easy', 'normal']) {
        for (const bot of ['random', 'kid', 'careful']) {
          let kid = 0, cpu = 0, draw = 0;
          for (let g = 0; g < games; g++) {
            const kidMark = g % 2 ? X : O;
            const st = R.newRound(mode, (g >> 1) % 2 ? X : O);
            while (!st.over) R.play(st, st.turn === kidMark ? BOTS[bot](st, rng) : R.cpuMove(st, level, rng));
            if (st.winner === kidMark) kid++;
            else if (st.winner) cpu++;
            else draw++;
          }
          const pc = (n) => Math.round((100 * n) / games) + '%';
          out[`${mode} ${level} v ${bot}`] = `kid ${pc(kid)} · cpu ${pc(cpu)} · draw ${pc(draw)}`;
        }
      }
    }
    return out;
  }

  TTT.check = check;
  TTT.rates = rates;
  TTT.bots = BOTS;
})(typeof window !== 'undefined' ? window : globalThis);
