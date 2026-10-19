/* 中文 for TT Tic-Tac-Toe: the words on the page, the toasts, the canvas word bursts and the ? panel (Kit.lang,
   from kit/lang.js). Simple words: Tommy is 5. The kids' and friends' names and the game's own name stay English. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Tic-Tac-Toe', 'TT', 'Tic-Tac-Toe', 'TEDDY', 'TOMMY', 'BOLT', 'BRUNO', 'Teddy', 'Tommy', 'Esc', 'Enter', 'Space']);

  L.add({
    // the menu
    REGULAR: '普通模式', 'Regular': '普通模式', 'Regular (1)': '普通模式 (1)',
    SPIN: '旋转模式', 'Spin': '旋转模式', 'Spin (2)': '旋转模式 (2)',
    '1 PLAYER': '1 人玩', '2 PLAYERS': '2 人玩', 'Players': '几个人玩', 'Who are you?': '你是谁？', 'Level': '难度',
    // while playing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)', 'HIGH FIVE! 🙌': '击掌！🙌',
    'YOUR TURN!': '轮到你啦！', 'DRAW!': '平局！', 'TIE MATCH!': '比赛打平！',
    // round over, match over, pause
    'Next round': '下一局', 'Home': '主页', 'Play again': '再玩一次', 'PLAY AGAIN': '再玩一次', 'Keep playing': '继续玩',
    'Start this round again': '这一局重新来',
    // canvas word bursts over the board (js/fx.js draws them through Kit.lang.t)
    'NICE!': '好棋！', 'BLOCKED!': '堵住了！', 'SUPER!': '太棒了！', 'POOF!': '没啦！', 'OOPS!': '哎呀！',
    // the ? panel (js/keys.js)
    'play a square (laid out like the number pad: 7 8 9 on top)': '下一个格子（和数字小键盘一样：7 8 9 在最上面）',
    'move round the board · play the square': '在棋盘上移动 · 下这个格子',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（2 人玩：击掌）',
    'start this round again': '这一局重新来',
    'menu: REGULAR · SPIN': '菜单：普通模式 · 旋转模式',
    'menu: Teddy or Tommy · 1 or 2 players · level': '菜单：Teddy 还是 Tommy · 1 人或 2 人 · 难度',
    'SPIN: a tap turns a square one step. Teddy: empty → X → O → empty. Tommy: empty → O → X → empty.':
      '旋转模式：点一下，格子转一步。Teddy：空 → X → O → 空。Tommy：空 → O → X → 空。',
    "Tap a square to play it. Tap your brother's face (bottom right) to call him.": '点格子就能下棋。点右下角兄弟的头像，叫他来帮忙。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^Call (\S+) \(T\)$/, '叫 $1 (T)');
  L.rule(/^Call (\S+)$/, '叫 $1');
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) SAYS: HERE!$/, '$1 说：下这里！');
  L.rule(/^(\S+) SAYS: WIN HERE!$/, '$1 说：下这里就赢啦！');
  L.rule(/^(\S+) SAYS: BLOCK HERE!$/, '$1 说：快堵这里！');
  L.rule(/^(\S+) IS THINKING…$/, '$1 在想…');
  L.rule(/^(\S+)'S TURN!$/, '轮到 $1！');
  L.rule(/^(\S+) WINS THE MATCH!$/, '$1 赢得比赛！');
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^(\S+) SPUN IT FOR (\S+)!$/, '$1 帮 $2 转出来啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
})();
