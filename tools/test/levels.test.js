// Per-level behaviour: every level renders, is winnable by a bot (3 seeds), kills the player
// when it should, and ends the game after three deaths. Platformer winnability is proven by
// the solver in solver.test.js; here the platformer gets the death/over checks only.
// Run: node --test tools/test/levels.test.js   (about two minutes, flappy planning dominates)
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, runFrames } = require('../harness.js');
const { flappyBot, snakeBot, tetrisBot, press } = require('../bots.js');

const SEEDS = [1, 2, 3];
const BUDGET = { flappy: 9000, snake: 12000, tetris: 3000 };
const BOT = { flappy: flappyBot, snake: snakeBot, tetris: tetrisBot };

/** Force a death in the current mode by editing its state so the next step() kills. */
const KILL = {
  platform(F) { F.debug().P.y = 544 + 60; },
  flappy(F) { const d = F.debug(); d.F.started = true; d.F.y = d.consts.FLOOR + 5; },
  snake(F) { const d = F.debug(); d.SN.queue.length = 0; d.SN.dir = { x: 0, y: -1 }; d.SN.cells[0].y = d.SN.top; d.SN.timer = d.SN.speed; },
  tetris(F) { const d = F.debug(); for (const row of d.TZ.board) row.fill('#000'); d.TZ.cur = null; d.TZ.clearing = { rows: [], t: 1 }; },
};

function dieOnce(F, kill) {
  const before = F.lives;
  for (let i = 0; i < 6 && F.lives === before; i++) { kill(F); F.step(); }
  assert.equal(F.lives, before - 1, 'kill did not cost a life');
  // wait out the death animation (70 frames) and the invulnerability (90 frames)
  for (let i = 0; i < 165 && F.state === 'play'; i++) F.step();
}

const { F: F0 } = loadGame({ seed: 1 });
const LEVELS = F0.LEVELS;

for (let idx = 0; idx < LEVELS.length; idx++) {
  const lv = LEVELS[idx];
  describe(`${lv.game.name} · level ${lv.li + 1} "${lv.name}" (${lv.type})`, () => {
    it('renders the first frames without throwing', () => {
      const { F } = loadGame({ seed: 1 });
      F.play(idx, true); runFrames(F, 5); F.draw(5);
      assert.equal(F.state, 'play'); assert.equal(F.lives, 3); assert.equal(F.collected, 0);
      assert.equal(F.tot.items, 10);
    });

    if (lv.type !== 'platform') {
      for (const seed of SEEDS) {
        it(`is won by the bot with all 10 cards (seed ${seed})`, () => {
          const { F } = loadGame({ seed });
          F.play(idx, true);
          const n = runFrames(F, BUDGET[lv.type], BOT[lv.type]());
          assert.equal(F.state, 'win', `not won within ${BUDGET[lv.type]} frames (ran ${n}, collected ${F.collected}, lives ${F.lives})`);
          assert.equal(F.collected, 10);
        });
      }
    }

    it('kills the player when it should', () => {
      const { F } = loadGame({ seed: 1 });
      F.play(idx, true);
      if (lv.type === 'flappy') { press(F, 'Space'); const n = runFrames(F, 200); assert.ok(F.lives === 2, `flappy with no input should hit the floor (ran ${n})`); }
      else if (lv.type === 'snake') { const n = runFrames(F, 23 * lv.diff.speed0 + 30); assert.equal(F.lives, 2, `snake with no input should hit the wall (ran ${n})`); }
      else if (lv.type === 'tetris') { let n = 0; while (F.lives === 3 && n++ < 800) { press(F, 'Space'); F.step(); } assert.equal(F.lives, 2, 'hard-dropping every frame should top out'); }
      else { F.keys.r = true; let n = 0; while (F.lives === 3 && n++ < 900) F.step(); assert.equal(F.lives, 2, `running right without jumping should die within 900 frames`); }
    });

    it('ends the game after three deaths and resets on a new play()', () => {
      const { F } = loadGame({ seed: 1 });
      F.play(idx, true);
      dieOnce(F, KILL[lv.type]); assert.equal(F.state, 'play');
      dieOnce(F, KILL[lv.type]); assert.equal(F.state, 'play');
      dieOnce(F, KILL[lv.type]);
      assert.equal(F.state, 'over'); assert.equal(F.lives, 0);
      F.play(idx, true); assert.equal(F.state, 'play'); assert.equal(F.lives, 3);
    });
  });
}

describe('level flow', () => {
  it('advances within a game and wraps to level 1 of the same game after level 3', () => {
    const { F, sandbox } = loadGame({ seed: 1 });
    F.play(3, true); F.win(); assert.equal(F.state, 'win');
    sandbox.document.getElementById('btnAgain').onclick(); assert.equal(F.lvIdx, 4);
    F.win(); sandbox.document.getElementById('btnAgain').onclick(); assert.equal(F.lvIdx, 5);
    F.win(); sandbox.document.getElementById('btnAgain').onclick(); assert.equal(F.lvIdx, 3);
  });
  it('receipt of the last level of a game shows the game total', () => {
    const { F, sandbox } = loadGame({ seed: 1 });
    F.play(2, true); F.win();
    const html = sandbox.document.getElementById('receipt').innerHTML;
    assert.match(html, /Totaal De winkel/);
    assert.match(sandbox.document.getElementById('btnAgain').textContent, /vanaf level 1/);
  });
});
