#!/usr/bin/env node
// CLI over tools/solver.js: proves that every card and the kassa of each platformer level can
// be reached without dying, using the difficulty values of that level.
//   node tools/solve_final.js              all platformer levels
//   node tools/solve_final.js SEGS_P2      one map (uses the diff of the level that carries it)
//   FEEST_BUDGET=5e6 ...                   raise the per-goal search budget (default 2.5e6)
'use strict';
const { loadGame } = require('./harness.js');
const S = require('./solver.js');

const only = process.argv.slice(2);
const budget = +(process.env.FEEST_BUDGET || 2.5e6);
const { F } = loadGame();
const segsByName = S.loadSegs();
const nameOf = segs => Object.keys(segsByName).find(k => JSON.stringify(segsByName[k]) === JSON.stringify(segs)) || '?';
let allOk = true;
for (const lv of F.LEVELS) {
  if (lv.type !== 'platform') continue;
  const mapName = nameOf(lv.segs);
  if (only.length && !only.includes(mapName)) continue;
  const t0 = Date.now();
  const r = S.solveMap(lv.segs, lv.diff, { budget });
  console.log(`${lv.game.name} level ${lv.li + 1} "${lv.name}" [${mapName}] enemySpd=${lv.diff.enemySpd} moverRate=${lv.diff.moverRate}`);
  for (const g of r.goals) console.log(`   ${g.ok ? 'OK  ' : 'FAIL'} ${g.name}${g.ok ? ` in ${g.frames} frames` : ''} (explored ${g.explored})${g.best ? ' best ' + JSON.stringify(g.best) : ''}${g.error ? ' ' + g.error : ''}`);
  console.log(`   ${r.ok ? 'solvable' : 'NOT SOLVABLE'} · total ${r.frames} frames · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!r.ok) allOk = false;
}
process.exit(allOk ? 0 : 1);
