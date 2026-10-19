/* TT Tic-Tac-Toe: the game's own sounds, built on Kit.sound.tone / hiss (all synthesised, no files).
   TTT.sfx.kit(name, ...args) plays a kit effect; the rest are ours. Every call is a silent no-op until
   Kit.sound.init() has run from the first tap. */
(function () {
  'use strict';
  const TTT = (window.TTT = window.TTT || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o);
  const hiss = (o) => S.hiss(o);

  const sfx = {
    kit(name, ...args) {
      if (S[name]) S[name](...args);
    },
    // a mark lands on its tile: a woody "tok", higher for X than for O
    place(mark) {
      const f = mark === 1 ? 520 : 400;
      tone({ type: 'triangle', f, to: f * 0.6, dur: 0.12, vol: 0.16 });
      hiss({ filter: 'lowpass', f: 1800, to: 500, dur: 0.08, vol: 0.07 });
    },
    // a tile spins over: a whoosh up and back down, and a click when it lands
    spin(dir = 1) {
      hiss({ f: 700, to: 3200, dur: 0.28, vol: 0.07, q: 1.2 });
      tone({ type: 'triangle', f: dir > 0 ? 330 : 440, to: dir > 0 ? 660 : 880, dur: 0.3, vol: 0.06 });
      tone({ type: 'triangle', f: 600, to: 360, dur: 0.1, vol: 0.12, at: 0.58 });
    },
    // the cursor or the hover moves
    tick() { tone({ type: 'square', f: 1200, dur: 0.025, vol: 0.025, lp: 3000 }); },
    // can't go there
    nope() {
      tone({ f: 220, dur: 0.08, vol: 0.08 });
      tone({ f: 180, dur: 0.1, vol: 0.08, at: 0.09 });
    },
    // the CPU is thinking: robot blips for Bolt, a hum for Bruno
    think(robot) {
      if (robot) [880, 1320, 990].forEach((f, i) => tone({ type: 'square', f, dur: 0.05, vol: 0.03, at: i * 0.09, lp: 2500 }));
      else tone({ type: 'triangle', f: 196, to: 247, dur: 0.35, vol: 0.06 });
    },
    // a good move: a little rising chime
    nice() { [784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.18, vol: 0.1 })); },
    // a block: a cheerful bonk
    block() {
      S.punch();
      tone({ type: 'triangle', f: 660, to: 990, dur: 0.16, vol: 0.1, at: 0.04 });
    },
    // a spin that made the other side's line: a gentle uh-oh
    oops() {
      tone({ type: 'triangle', f: 440, to: 330, dur: 0.16, vol: 0.12 });
      tone({ type: 'triangle', f: 330, to: 247, dur: 0.24, vol: 0.1, at: 0.15 });
    },
    // three in a row
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f, at: i * 0.11, dur: 0.16, vol: 0.05, lp: 3000 }));
      [523, 659, 784].forEach((f) => tone({ type: 'triangle', f: f * 2, at: 0.46, dur: 0.6, vol: 0.08 }));
      hiss({ filter: 'highpass', f: 6000, at: 0.46, dur: 0.5, vol: 0.06 });
    },
    // the CPU won: a soft wah-wah, never harsh
    lose() {
      [392, 370, 349, 311].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.22, dur: i === 3 ? 0.5 : 0.22, vol: 0.09 }));
    },
    draw() {
      tone({ type: 'triangle', f: 523, dur: 0.14, vol: 0.09 });
      tone({ type: 'triangle', f: 523, dur: 0.22, vol: 0.09, at: 0.16 });
    },
    // the whole match: a bigger fanfare
    trophy() {
      sfx.win();
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.9 + i * 0.09, dur: 0.3, vol: 0.09 }));
    },
    // your brother pops in (and out)
    pop() {
      tone({ f: 300, to: 900, dur: 0.12, vol: 0.1 });
      hiss({ f: 2000, to: 6000, dur: 0.15, vol: 0.05 });
    },
    // your brother's 💣 falls: a cartoon whistle down
    whistle() { tone({ f: 1500, to: 500, dur: 0.75, vol: 0.06 }); },
    // and lands: BOOM, a low thump and a rumble
    boom() {
      tone({ f: 140, to: 38, dur: 0.55, vol: 0.32 });
      hiss({ filter: 'lowpass', f: 1600, to: 90, dur: 0.75, vol: 0.32 });
      hiss({ filter: 'bandpass', f: 3000, to: 600, dur: 0.25, vol: 0.12, q: 0.7 });
    },
    // the high five: a clap
    clap() {
      hiss({ filter: 'bandpass', f: 1500, q: 0.8, dur: 0.09, vol: 0.22 });
      hiss({ filter: 'highpass', f: 3000, dur: 0.05, vol: 0.1, at: 0.01 });
    },
  };

  TTT.sfx = sfx;
})();
