#!/usr/bin/env node
/* Run the headless checks from a terminal, with the same rules and CPU files the page loads (js/rules.js, js/check.js).
     node tools/check.js                      the checks: REGULAR's NORMAL CPU never loses, SPIN games always end
     node tools/check.js 1000                 the same with 1000 games per bot (default 200)
     node tools/check.js --sabotage shallow   proves the CPU check can fail: a one-move-deep CPU loses games
     node tools/check.js --sabotage nolimit   proves the spin check can fail: with no draw rule, games never end
     node tools/check.js --sabotage wildbrother  proves the brother check can fail: his flips may lose you the round
     node tools/check.js --lock               SPIN with the "can't spin the square just spun" rule switched on
     node tools/check.js rates                win rates of the kids' test bots against both levels (how they were tuned)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set, Error, Infinity };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/rules.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const t0 = Date.now();
if (args[0] === 'rates') {
  console.log(JSON.stringify(ctx.TTT.rates(+(args[1] || 1000)), null, 1));
  process.exit(0);
}
const out = ctx.TTT.check({
  games: +(args.find((a) => /^\d+$/.test(a)) || 200),
  sabotage: opt('sabotage'),
  seed: opt('seed') ? +opt('seed') : undefined,
  rules: args.includes('--lock') ? { lock: true } : undefined,
});
out.seconds = +((Date.now() - t0) / 1000).toFixed(1);
console.log(JSON.stringify(out, null, 1));
console.log(out.ok ? 'CHECK PASSED' : 'CHECK FAILED');
process.exitCode = out.ok ? 0 : 1;
