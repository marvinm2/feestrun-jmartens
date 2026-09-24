// Structural checks: games/levels shape, map well-formedness, monotonic difficulty.
// Run: node --test tools/test/static.test.js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('../harness.js');
const { loadSegs } = require('../solver.js');

const { F } = loadGame({ seed: 1 });
const GAMES = F.GAMES, LEVELS = F.LEVELS;

describe('games and levels', () => {
  it('has 4 games with 3 levels each (12 levels in artifact mode)', () => {
    assert.equal(GAMES.length, 4);
    for (const g of GAMES) assert.equal(g.levels.length, 3, g.id);
    assert.equal(LEVELS.length, 12);
    assert.equal(F.FIXED_GAME, null);
  });
  it('every level has a name, a sub (makkelijk/gemiddeld/moeilijk) and a diff object', () => {
    for (const lv of LEVELS) {
      assert.ok(lv.name && lv.name.length > 2, lv.name);
      assert.equal(lv.sub, ['makkelijk', 'gemiddeld', 'moeilijk'][lv.li]);
      assert.equal(typeof lv.diff, 'object');
      assert.ok(lv.game && typeof lv.gi === 'number' && typeof lv.li === 'number');
    }
  });
  it('level names are unique within a game and game ids are unique', () => {
    assert.equal(new Set(GAMES.map(g => g.id)).size, 4);
    for (const g of GAMES) assert.equal(new Set(g.levels.map(l => l.name)).size, 3, g.id);
  });
});

describe('platformer maps', () => {
  const segsByName = loadSegs();
  const platLevels = LEVELS.filter(l => l.type === 'platform');
  it('has 3 platformer levels, each with its own map', () => {
    assert.equal(platLevels.length, 3);
    assert.equal(new Set(platLevels.map(l => JSON.stringify(l.segs))).size, 3, 'maps must differ');
  });
  for (const lv of platLevels) {
    it(`map of "${lv.name}" is well-formed`, () => {
      const rows = [];
      for (const seg of lv.segs) {
        assert.ok(seg.length <= 17, 'segment has more than 17 rows');
        for (let r = 0; r < 17; r++) { const row = (seg[r] || ''); assert.ok(row.length <= 30, `row longer than 30: ${row}`); rows[r] = (rows[r] || '') + row.padEnd(30, ' '); }
      }
      const all = rows.join('\n');
      for (const d of '0123456789') assert.equal(all.split(d).length - 1, 1, `card ${d} must appear exactly once`);
      assert.equal(all.split('@').length - 1, 1, 'exactly one start');
      assert.equal(all.split('K').length - 1, 1, 'exactly one kassa');
      const bad = all.replace(/[ #\-^@o0-9SPMNFK\n]/g, ''); assert.equal(bad, '', `unknown map characters: ${bad}`);
    });
    it(`map of "${lv.name}" is the one in src/segs.part`, () => {
      assert.ok(Object.values(segsByName).some(s => JSON.stringify(s) === JSON.stringify(lv.segs)));
    });
  }
});

describe('difficulty is strictly monotonic across the 3 levels', () => {
  // knob -> direction (+1 must increase, -1 must decrease) ; 0 = non-strict in that direction
  const RULES = {
    platformer: { enemySpd: 1, moverRate: 1 },
    flappy: { gapH: -1, gapMin: -1, gateDx: -1, speed0: 1, speedMax: 1 },
    snake: { speed0: -1, speedMin: -1, pinsPerItem: 1 },
    tetris: { interval0: -1, intervalMin: -1, lockDelay: -1 },
  };
  const SOFT = { snake: { coinEvery: -1 }, tetris: { garbage: 1 } };
  for (const g of GAMES) {
    it(g.id, () => {
      const d = g.levels.map(l => l.diff);
      for (const [k, dir] of Object.entries(RULES[g.id])) {
        for (let i = 1; i < 3; i++) assert.ok((d[i][k] - d[i - 1][k]) * dir > 0, `${g.id}.${k}: level ${i} (${d[i - 1][k]}) -> level ${i + 1} (${d[i][k]}) must ${dir > 0 ? 'increase' : 'decrease'}`);
      }
      for (const [k, dir] of Object.entries(SOFT[g.id] || {})) {
        for (let i = 1; i < 3; i++) assert.ok((d[i][k] - d[i - 1][k]) * dir >= 0, `${g.id}.${k} must not go the wrong way`);
      }
    });
  }
  it('platformer level 3 is the only night level', () => {
    assert.equal(JSON.stringify(GAMES[0].levels.map(l => !!l.night)), '[false,false,true]'); // vm arrays are another realm: compare by value
  });
});
