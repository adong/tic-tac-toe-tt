/* TT Tic-Tac-Toe: the rules and the CPU. Plain JavaScript with no Three.js and no page, so the browser game and the
   headless checks (js/check.js, tools/check.js under Node) run the very same code.

   A square is 0 (empty), 1 (X, Teddy's mark) or 2 (O, Tommy's mark). Squares are numbered 0..8 from the top left:
       0 1 2
       3 4 5
       6 7 8
   REGULAR: on your turn put your mark on an empty square. Three in a row wins; a full board is a draw.
   SPIN:    on your turn spin any one square one step. Your tap makes YOUR mark first (Alan's pick, so it's fair for
            both brothers): X (Teddy) spins empty -> X -> O -> empty, O (Tommy) spins the other way, empty -> O -> X
            -> empty. So for both: tap an empty square and it's yours, tap your brother's mark and it's gone, tap your
            own and it turns into his. After the spin a line of three X is a win for X and a line of three O a win
            for O, whoever spun it (both at once can't happen: one spin makes one square one mark). SPIN_RULES.limit
            spins with no winner is a draw. SPIN_RULES.lock (off): the square the other player just spun can't be spun
            straight back. With that lock on, the first X to move could win in 3 spins every time in the one-way
            version; without it, perfect play is a draw from either side. */
(function (root) {
  'use strict';
  const TTT = (root.TTT = root.TTT || {});

  const EMPTY = 0, X = 1, O = 2;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const SPIN_RULES = { limit: 30, lock: false };
  const other = (m) => 3 - m;
  // one spin of a square by `mark`: X turns it forwards (empty -> X -> O), O backwards (empty -> O -> X)
  const spun = (v, mark) => (mark === O ? (v + 2) % 3 : (v + 1) % 3);

  // Which marks have a line of three: a bitmask (1 X, 2 O, 3 both), and the first line found for each.
  function linesOf(board) {
    let mask = 0, lx = null, lo = null;
    for (const L of LINES) {
      const v = board[L[0]];
      if (v && v === board[L[1]] && v === board[L[2]]) {
        mask |= v;
        if (v === X && !lx) lx = L;
        if (v === O && !lo) lo = L;
      }
    }
    return { mask, x: lx, o: lo };
  }
  function lineMask(board) {
    let mask = 0;
    for (let i = 0; i < 8; i++) {
      const L = LINES[i], v = board[L[0]];
      if (v && v === board[L[1]] && v === board[L[2]]) mask |= v;
    }
    return mask;
  }

  // A new round. `first` is the mark that moves first (1 X or 2 O).
  function newRound(mode, first = X, rules = SPIN_RULES) {
    return {
      mode, board: [0, 0, 0, 0, 0, 0, 0, 0, 0], turn: first, first, lock: -1, spins: 0, moves: 0,
      over: false, winner: 0, draw: false, line: null, last: -1, limit: rules.limit, lockRule: !!rules.lock,
    };
  }

  function clone(st) {
    return Object.assign({}, st, { board: st.board.slice(), line: st.line && st.line.slice() });
  }

  function legal(st) {
    const out = [];
    if (st.over) return out;
    for (let i = 0; i < 9; i++) {
      if (st.mode === 'regular' ? st.board[i] === EMPTY : !(st.lockRule && i === st.lock)) out.push(i);
    }
    return out;
  }
  const isLegal = (st, i) => !st.over && i >= 0 && i < 9 && (st.mode === 'regular' ? st.board[i] === EMPTY : !(st.lockRule && i === st.lock));

  // Play square `i` for the side to move. Changes `st` and returns what happened (or null if it isn't allowed).
  function play(st, i) {
    if (!isLegal(st, i)) return null;
    const mark = st.turn, from = st.board[i];
    const to = st.mode === 'regular' ? mark : spun(from, mark);
    st.board[i] = to;
    st.moves++;
    st.last = i;
    const ev = { cell: i, mark, from, to, win: 0, draw: false, line: null, gift: false };
    const L = linesOf(st.board);
    if (L.mask) {
      // both lines at once: the spinner wins
      const w = L.mask === 3 ? mark : L.mask;
      st.over = true;
      st.winner = ev.win = w;
      st.line = ev.line = (w === X ? L.x : L.o).slice();
      ev.gift = w !== mark; // a spin that made the other side's line
      return ev;
    }
    if (st.mode === 'spin') {
      st.spins++;
      st.lock = i;
      if (st.spins >= st.limit) st.over = st.draw = ev.draw = true;
    } else if (st.moves >= 9) st.over = st.draw = ev.draw = true;
    if (!st.over) st.turn = other(mark);
    return ev;
  }

  // ---------------------------------------------------------------- regular: perfect play

  // Score of the position for the side to move, with perfect play both ways: 10 - n for a win n moves from now
  // (counting both sides' moves), -(10 - n) for a loss, 0 for a draw. Memoised: there are only a few thousand.
  const memo = new Map();
  function regularValue(board, turn) {
    let key = 0;
    for (let i = 0; i < 9; i++) key = key * 3 + board[i];
    key = key * 3 + turn;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = -99, any = false;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      any = true;
      board[i] = turn;
      let v;
      if (lineMask(board)) v = 9;
      else {
        const r = regularValue(board, other(turn));
        v = r > 0 ? -(r - 1) : r < 0 ? -(r + 1) : 0;
      }
      board[i] = 0;
      if (v > best) best = v;
    }
    if (!any) best = 0;
    memo.set(key, best);
    return best;
  }

  // Every legal move with its score for the mover (perfect play afterwards).
  function regularScores(st) {
    const b = st.board.slice(), out = [];
    for (const i of legal(st)) {
      b[i] = st.turn;
      let v;
      if (lineMask(b)) v = 9;
      else {
        const r = regularValue(b, other(st.turn));
        v = r > 0 ? -(r - 1) : r < 0 ? -(r + 1) : 0;
      }
      b[i] = 0;
      out.push({ cell: i, score: v });
    }
    return out;
  }

  // ---------------------------------------------------------------- spin: search

  // spins of your own needed to turn a square into your mark: X from (empty 1, X 0, O 2); O from (empty 1, X 2, O 0)
  const DX = [1, 0, 2], DO = [1, 2, 0];
  const W = [0, 9, 3, 1, 0, 0, 0];
  // A rough score for the side to move: lines that are close to X's or O's (fewer spins to finish).
  function spinGuess(board, turn) {
    let s = 0;
    for (const L of LINES) {
      const dx = DX[board[L[0]]] + DX[board[L[1]]] + DX[board[L[2]]];
      const dO = DO[board[L[0]]] + DO[board[L[1]]] + DO[board[L[2]]];
      s += W[dx] - W[dO];
    }
    return turn === X ? s : -s;
  }

  const WIN = 1000;
  // Negamax with alpha-beta, from the side to move. ply counts from the root move (1 = the move itself).
  function spinSearch(board, turn, lock, spins, limit, lockRule, depth, ply, alpha, beta) {
    if (spins >= limit) return 0;
    let best = -Infinity;
    // wins first: a spin that finishes your line (or both lines) ends it here
    for (let i = 0; i < 9; i++) {
      if (lockRule && i === lock) continue;
      const v = board[i];
      board[i] = spun(v, turn);
      const m = lineMask(board);
      board[i] = v;
      if (m && (m === 3 || m === turn)) return WIN - ply;
    }
    for (let i = 0; i < 9; i++) {
      if (lockRule && i === lock) continue;
      const v = board[i];
      board[i] = spun(v, turn);
      const m = lineMask(board);
      let score;
      if (m) score = -(WIN - ply); // only the other side's line: you gave it away
      else if (spins + 1 >= limit) score = 0;
      else if (depth <= 1) score = -spinGuess(board, other(turn));
      else score = -spinSearch(board, other(turn), i, spins + 1, limit, lockRule, depth - 1, ply + 1, -beta, -alpha);
      board[i] = v;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best === -Infinity ? 0 : best;
  }

  function spinScores(st, depth = 5) {
    const b = st.board.slice(), out = [];
    for (const i of legal(st)) {
      const v = b[i];
      b[i] = spun(v, st.turn);
      const m = lineMask(b);
      let score;
      if (m) score = m === 3 || m === st.turn ? WIN - 1 : -(WIN - 1);
      else if (st.spins + 1 >= st.limit) score = 0;
      else score = -spinSearch(b, other(st.turn), i, st.spins + 1, st.limit, st.lockRule, depth - 1, 2, -Infinity, Infinity);
      b[i] = v;
      out.push({ cell: i, score });
    }
    return out;
  }

  // ---------------------------------------------------------------- helpers both modes use

  // Squares where the side `mark` would finish a line with its very next move (regular: place; spin: spin).
  function winsFor(st, mark) {
    const out = [];
    const b = st.board.slice();
    for (let i = 0; i < 9; i++) {
      if (st.mode === 'regular') {
        if (b[i]) continue;
        b[i] = mark;
        if (lineMask(b) & mark) out.push(i);
        b[i] = 0;
      } else {
        // the lock is the square just spun; when `mark` moves next, that lock applies to it only if it's its turn
        if (st.lockRule && i === st.lock && mark === st.turn) continue;
        const v = b[i];
        b[i] = spun(v, mark);
        const m = lineMask(b);
        if (m === 3 || m === mark) out.push(i);
        b[i] = v;
      }
    }
    return out;
  }

  function scores(st, depth) {
    return st.mode === 'regular' ? regularScores(st) : spinScores(st, depth);
  }

  // Pick at random among the best-scoring moves.
  function bestOf(list, rng) {
    let top = -Infinity;
    for (const m of list) if (m.score > top) top = m.score;
    const best = list.filter((m) => m.score === top);
    return best[Math.floor(rng() * best.length)];
  }

  // How the 🐣 EASY CPU plays: it takes a win it could make only this often, and blocks yours only this often.
  const EASY = { takeWin: 0.4, block: 0.3 };
  // 🔥 NORMAL in SPIN: how many spins ahead it looks (yours and its own), and how often it doesn't look at all and
  // spins any square that doesn't give you a line (so it can miss your threat). Careful play by both sides is always a
  // draw at the spin limit, so without the slips a careful Teddy could never win. Your brother's hint looks further.
  const LOOK = { normal: 3, slip: 0.08, hint: 4 };

  // The CPU's move. 'easy': plays at random, and sometimes takes a win or blocks one (EASY above).
  // 'normal': perfect in REGULAR; in SPIN a look-ahead with the odd slip (LOOK above). Returns a square.
  function cpuMove(st, level, rng = Math.random) {
    const moves = legal(st);
    if (!moves.length) return -1;
    const me = st.turn, you = other(me);
    if (level === 'easy') {
      const win = winsFor(st, me);
      if (win.length && rng() < EASY.takeWin) return win[Math.floor(rng() * win.length)];
      if (st.mode === 'regular') {
        const block = winsFor(st, you);
        if (block.length && rng() < EASY.block) return block[Math.floor(rng() * block.length)];
        return moves[Math.floor(rng() * moves.length)];
      }
      // spin: mostly random, but half the time it won't spin your line in for you
      let pool = moves;
      if (rng() < 0.5) {
        const safe = moves.filter((i) => !gives(st, i));
        if (safe.length) pool = safe;
      }
      return pool[Math.floor(rng() * pool.length)];
    }
    if (st.mode === 'spin' && rng() < LOOK.slip) {
      const win = winsFor(st, me);
      if (win.length) return win[0];
      const safe = moves.filter((i) => !gives(st, i));
      if (safe.length) return safe[Math.floor(rng() * safe.length)];
    }
    return bestOf(scores(st, LOOK.normal), rng).cell;
  }

  // Would spinning square i make only the other side's line? (spin mode)
  function gives(st, i) {
    const b = st.board.slice();
    b[i] = spun(b[i], st.turn);
    const m = lineMask(b);
    return m !== 0 && m !== 3 && m !== st.turn;
  }

  // The square your brother points at. kind: 'win' (finish your line), 'block' (stop the other side), 'good'.
  // easy: the best square, from the full look-ahead; normal: win, else the block, else a good square.
  function hint(st, level, rng = Math.random) {
    if (st.over) return null;
    const me = st.turn, you = other(me);
    const win = winsFor(st, me);
    const threats = st.mode === 'regular' ? winsFor(st, you) : winsFor(Object.assign({}, st, { turn: you, lock: -1 }), you);
    const all = scores(st, LOOK.hint);
    const best = bestOf(all, rng);
    if (win.length) return { cell: level === 'easy' ? best.cell : win[0], kind: 'win' };
    if (threats.length) {
      if (st.mode === 'regular') {
        // blocking one square; with two threats (a fork) the best square is still a block
        const block = level === 'easy' && threats.includes(best.cell) ? best.cell : threats[0];
        return { cell: block, kind: 'block' };
      }
      // spin: a spin that leaves the other side no winning spin next turn
      const safe = all.filter((m) => {
        const t = clone(st);
        play(t, m.cell);
        return !t.over && !winsFor(t, you).length;
      });
      if (safe.length) return { cell: bestOf(safe, rng).cell, kind: 'block' };
    }
    return { cell: best.cell, kind: 'good' };
  }

  // What kind of move square i was, for the cheers: 'win', 'block', 'fork', 'threat', 'erase' (spin: your brother's
  // mark wiped away), 'center' (first move in the middle), 'oops' (made the other side's line) or null. Call before play().
  function judge(st, i) {
    const me = st.turn, you = other(me);
    const before = st.mode === 'regular' ? winsFor(st, you) : winsFor(Object.assign({}, st, { turn: you, lock: -1 }), you);
    const t = clone(st);
    const ev = play(t, i);
    if (!ev) return null;
    if (ev.win) return ev.win === me ? 'win' : 'oops';
    const afterYou = winsFor(Object.assign({}, t, { turn: you, lock: t.lockRule ? i : -1 }), you);
    if (before.length && !afterYou.length) return 'block';
    const mine = winsFor(Object.assign({}, t, { turn: me, lock: -1 }), me);
    if (mine.length >= 2) return 'fork';
    if (st.mode === 'spin') {
      if (ev.from === you && ev.to === EMPTY) return 'erase';
    }
    if (mine.length === 1 && !afterYou.length) return 'threat';
    if (st.mode === 'regular' && st.moves === 0 && i === 4) return 'center';
    return null;
  }

  // ---------------------------------------------------------------- SPIN: your brother's mischief

  // Called in SPIN (1 player), your brother is a bit wild instead of giving a hint (Alan's idea). Half the time he
  // FLIPS one mark: it turns empty, or into the other mark (X -> O, O -> X). The other half he drops a BOMB on a row
  // or a column with marks in it, and those squares go empty. `kid` is the mark of the kid who called him; he's on
  // your side, so a flip never finishes the other side's line (a flip that finishes yours wins you the round).
  // options() lists every flip and bomb he may pick; with `wild` the flip that hands the other side a line is
  // allowed too (only the checks use it, to prove they would catch it).
  function mischiefOptions(st, kid, wild = false) {
    const foe = other(kid), flips = [], bombs = [];
    const b = st.board.slice();
    for (let i = 0; i < 9; i++) {
      const v = b[i];
      if (!v) continue;
      for (const to of [EMPTY, other(v)]) {
        b[i] = to;
        const m = lineMask(b);
        b[i] = v;
        if (m && m !== kid && !wild) continue; // that would finish the other side's line
        flips.push({ kind: 'flip', cell: i, to, gives: m === foe });
      }
    }
    for (let k = 0; k < 3; k++) {
      const row = [k * 3, k * 3 + 1, k * 3 + 2], col = [k, k + 3, k + 6];
      if (row.some((i) => b[i])) bombs.push({ kind: 'bomb', axis: 'row', cells: row });
      if (col.some((i) => b[i])) bombs.push({ kind: 'bomb', axis: 'column', cells: col });
    }
    return { flips, bombs };
  }

  // His pick: a flip or a bomb, half and half (whichever there is). null on an empty board.
  function mischief(st, kid, rng = Math.random, wild = false) {
    if (st.over) return null;
    const { flips, bombs } = mischiefOptions(st, kid, wild);
    if (!flips.length && !bombs.length) return null;
    const list = flips.length && (!bombs.length || rng() < 0.5) ? flips : bombs;
    return list[Math.floor(rng() * list.length)];
  }

  // Do it to the board. It isn't a spin: the spin count and whose turn it is stay the same. Returns what changed,
  // and the winner if a flip finished a line.
  function applyMischief(st, act) {
    if (st.over || !act) return null;
    const ev = { kind: act.kind, axis: act.axis, cells: [], from: [], to: [], win: 0, line: null };
    const cells = act.kind === 'flip' ? [act.cell] : act.cells;
    for (const i of cells) {
      ev.cells.push(i);
      ev.from.push(st.board[i]);
      st.board[i] = act.kind === 'flip' ? act.to : EMPTY;
      ev.to.push(st.board[i]);
    }
    const L = linesOf(st.board);
    if (L.mask) {
      const w = L.mask === 3 ? st.turn : L.mask;
      st.over = true;
      st.winner = ev.win = w;
      st.line = ev.line = (w === X ? L.x : L.o).slice();
    }
    return ev;
  }

  // A small seeded random generator for the tests (mulberry32).
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  TTT.rules = {
    EMPTY, X, O, LINES, SPIN_RULES, EASY, LOOK, other, spun, linesOf, lineMask, newRound, clone, legal, isLegal, play,
    regularScores, spinScores, scores, winsFor, cpuMove, hint, judge, gives, mischiefOptions, mischief, applyMischief, seeded,
  };
})(typeof window !== 'undefined' ? window : globalThis);
