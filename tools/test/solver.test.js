// Platformer levels: the solver must find a death-free route through every card to the kassa,
// and that route must win when replayed in the real game (catches physics drift between
// src/js2_platform.part and tools/solver.js).
// Run: node --test tools/test/solver.test.js   (slow: up to a few minutes per map)
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runFrames } = require('../harness.js');
const { platformReplay } = require('../bots.js');
const S = require('../solver.js');

const { F: F0 } = loadGame({ seed: 1 });
const BUDGET = +(process.env.FEEST_BUDGET || 4e6);

for (let idx = 0; idx < F0.LEVELS.length; idx++) {
  const lv = F0.LEVELS[idx];
  if (lv.type !== 'platform') continue;
  describe(`${lv.game.name} · level ${lv.li + 1} "${lv.name}"`, () => {
    let result;
    it('solver reaches every card and the kassa without dying', () => {
      result = S.solveMap(lv.segs, lv.diff, { budget: BUDGET });
      const report = result.goals.map(g => `${g.ok ? 'OK' : 'FAIL'} ${g.name}${g.best ? ' best ' + JSON.stringify(g.best) : ''}`).join('\n');
      assert.ok(result.ok, 'unsolvable:\n' + report);
      assert.equal(result.goals.length, 11);
    });
    it('the solver route wins when replayed in the real game', () => {
      assert.ok(result && result.ok, 'no route to replay');
      const { F } = loadGame({ seed: 1 });
      F.play(idx, true);
      const pred = S.simulate(result.sim, result.inputs);
      const bot = platformReplay(result.inputs);
      let diverged = null;
      for (let t = 0; t < result.inputs.length + 120 && F.state === 'play'; t++) {
        bot(F); F.step();
        const P = F.debug().P, p = pred[t];
        if (!diverged && p && (Math.abs(P.x - p[0]) > 0.01 || Math.abs(P.y - p[1]) > 0.01)) diverged = { t, game: [P.x, P.y], solver: [p[0], p[1]] };
      }
      assert.equal(diverged, null, 'game and solver physics diverge: ' + JSON.stringify(diverged));
      assert.equal(F.state, 'win', `replay did not win (collected ${F.collected}, lives ${F.lives})`);
      assert.equal(F.collected, 10);
      assert.equal(F.lives, 3);
    });
  });
}
