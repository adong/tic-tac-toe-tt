/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.TTT_TITLE, // the name lives in js/title.js
  keys: [
    ['play a square (laid out like the number pad: 7 8 9 on top)', '1 – 9'],
    ['move round the board · play the square', '← ↑ → ↓ · Enter or Space'],
    ['call your brother (2 players: high five)', 'T'],
    ['start this round again', 'R'],
    ['pause · sound', 'P or Esc · M'],
    ['menu: REGULAR · SPIN', '1 · 2'],
    ['menu: Teddy or Tommy · 1 or 2 players · level', '← → · ↑ ↓ · L'],
  ],
  note: 'SPIN: a tap turns a square one step. Teddy: empty → X → O → empty. Tommy: empty → O → X → empty.',
  touch: 'Tap a square to play it. Tap your brother\'s face (bottom right) to call him.',
});
