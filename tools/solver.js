// Platformer reachability solver. Re-implements the player physics of src/js2_platform.part
// (same step order, same constants) and searches, goal by goal (cards sorted by x, then the
// kassa), for a death-free input sequence. Enemies and moving platforms are pure functions of
// the frame number, so they are precomputed. Any change to the physics in js2 must be
// mirrored here; tools/test/solver.test.js replays the result in the real game to catch drift.
'use strict';
const fs = require('fs');
const path = require('path');

const T = 32, COLS = 30, ROWS = 17, W = 960, H = 544;
const G = 0.5, JUMP = 12, JUMP_CUT = 4, MAXV = 4.2, SPRING = 19, COYOTE = 10, JBUF = 12;
const PW = 32, PH = 38;
const INPUTS = [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1], [0, 1, 0], [0, 1, 1]]; // [l, r, j]
const DURATIONS = [1, 2, 4, 8, 16]; // frames an input is held per search edge

/** Evaluate src/segs.part standalone and return {SEGS_P1, SEGS_P2, ...}. */
function loadSegs(file) {
  const src = fs.readFileSync(file || path.join(__dirname, '..', 'src', 'segs.part'), 'utf8');
  const names = [...src.matchAll(/^const (SEGS_\w+)=/gm)].map(m => m[1]);
  return new Function(src + ';return {' + names.join(',') + '};')();
}

/** Parse a map exactly like Platform.build() does. */
function buildMap(segs) {
  const LW = segs.length * COLS, tiles = new Uint8Array(LW * ROWS);
  const L = { coins: [], items: [], springs: [], enemies: [], movers: [], flags: [], kassa: null, start: { x: 64, y: 400 } };
  for (let r = 0; r < ROWS; r++) {
    let row = ''; for (const s of segs) row += (s[r] || '').padEnd(COLS, ' ').slice(0, COLS);
    for (let c = 0; c < LW; c++) {
      const ch = row[c], px = c * T, py = r * T;
      if (ch === '#') tiles[r * LW + c] = 1; else if (ch === '-') tiles[r * LW + c] = 2; else if (ch === '^') tiles[r * LW + c] = 3;
      else if (ch === '@') L.start = { x: px, y: py + T - PH };
      else if (ch === 'o') L.coins.push({ x: px + 16, y: py + 16, c, r });
      else if (ch >= '0' && ch <= '9') L.items.push({ i: +ch, x: px + 16, y: py + 16, c, r });
      else if (ch === 'S') L.springs.push({ x: px, y: py });
      else if (ch === 'P') L.enemies.push({ x: px + 1, y: py + T - 22, w: 30, h: 22, dir: -1, c, r });
      else if (ch === 'M') L.movers.push({ x0: px, y0: py, w: 96, h: 14, axis: 'x', amp: 96, ph: L.movers.length * Math.PI / 2 });
      else if (ch === 'N') L.movers.push({ x0: px, y0: py, w: 96, h: 14, axis: 'y', amp: 64, ph: L.movers.length * Math.PI / 2 });
      else if (ch === 'F') L.flags.push({ x: px, y: py });
      else if (ch === 'K') L.kassa = { x: px, y: py - T };
    }
  }
  return { LW, tiles, L };
}

const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

/**
 * Build a simulator for one map + difficulty. Returns {stepState, L, LW, tileAt, moverPos, enemyX, ...}.
 * State vector: [x, y, vx, vy, t, grounded, coyote, jbuf, jheld, onPlat, jumping]
 */
function makeSim(segs, diff, opts = {}) {
  const { LW, tiles, L } = buildMap(segs);
  const enemySpd = diff.enemySpd, moverRate = diff.moverRate;
  const maxT = opts.maxT || 30000;
  const tileAt = (cx, cy) => { if (cx < 0 || cx >= LW) return 1; if (cy < 0 || cy >= ROWS) return 0; return tiles[cy * LW + cx]; };
  const moverPos = (m, t) => { const s = Math.sin(m.ph + t * moverRate) * m.amp; return m.axis === 'x' ? { x: m.x0 + s, y: m.y0 } : { x: m.x0, y: m.y0 + s }; };
  // enemy x per frame (index t = position after the move of frame t; index 0 = spawn)
  const enemyX = L.enemies.map(e => {
    const xs = new Float64Array(maxT + 1); let x = e.x, dir = e.dir; xs[0] = x;
    for (let t = 1; t <= maxT; t++) {
      x += dir * enemySpd; const fx = dir > 0 ? x + e.w + 1 : x - 1;
      const cx = Math.floor(fx / T), cym = Math.floor((e.y + e.h / 2) / T), cyb = Math.floor((e.y + e.h + 1) / T);
      if (tileAt(cx, cym) === 1) dir *= -1; else { const b = tileAt(cx, cyb); if (b !== 1 && b !== 2) dir *= -1; }
      xs[t] = x;
    }
    return xs;
  });
  // patrol range per enemy (the enemy roams far from its spawn point)
  const enemyRange = enemyX.map((xs, i) => { let lo = Infinity, hi = -Infinity; for (let t = 0; t <= Math.min(maxT, 6000); t++) { if (xs[t] < lo) lo = xs[t]; if (xs[t] > hi) hi = xs[t]; } return [lo - 64, hi + L.enemies[i].w + 64]; });
  function stepState(s, inL, inR, inJ) {
    let [x, y, vx, vy, t, grounded, coyote, jbuf, jheld, onPlat, jumping] = s;
    grounded = !!grounded; jheld = !!jheld; jumping = !!jumping;
    t++;
    if (t > maxT) return null;
    if (onPlat >= 0) { const m = L.movers[onPlat]; const p0 = moverPos(m, t - 1), p1 = moverPos(m, t); x += p1.x - p0.x; y += p1.y - p0.y; }
    onPlat = -1;
    if (inJ && !jheld) jbuf = JBUF; jheld = !!inJ;
    const tv = (inR ? MAXV : 0) - (inL ? MAXV : 0);
    vx += (tv - vx) * (grounded ? 0.3 : 0.2); if (Math.abs(vx) < 0.05) vx = 0;
    if (grounded) coyote = COYOTE; else if (coyote > 0) coyote--;
    if (jbuf > 0) jbuf--;
    if (jbuf > 0 && coyote > 0) { vy = -JUMP; jbuf = 0; coyote = 0; grounded = false; jumping = true; }
    if (!inJ && jumping && vy < -JUMP_CUT) vy = -JUMP_CUT;
    if (vy >= 0) jumping = false;
    vy = Math.min(vy + G, 14);
    x += vx;
    const y0 = Math.floor((y + 1) / T), y1 = Math.floor((y + PH - 2) / T);
    if (vx > 0) { const cx = Math.floor((x + PW - 1) / T); for (let cy = y0; cy <= y1; cy++) if (tileAt(cx, cy) === 1) { x = cx * T - PW; vx = 0; break; } }
    else if (vx < 0) { const cx = Math.floor(x / T); for (let cy = y0; cy <= y1; cy++) if (tileAt(cx, cy) === 1) { x = (cx + 1) * T; vx = 0; break; } }
    const prevBottom = y + PH; y += vy; grounded = false;
    const x0 = Math.floor((x + 4) / T), x1 = Math.floor((x + PW - 5) / T);
    if (vy >= 0) { const cy = Math.floor((y + PH - 1) / T); for (let cx = x0; cx <= x1; cx++) { const tt = tileAt(cx, cy); if (tt === 1 || (tt === 2 && prevBottom <= cy * T + 0.5)) { y = cy * T - PH; vy = 0; grounded = true; break; } } }
    else { const cy = Math.floor(y / T); for (let cx = x0; cx <= x1; cx++) if (tileAt(cx, cy) === 1) { y = (cy + 1) * T; vy = 0; break; } }
    for (let i = 0; i < L.movers.length; i++) { const m = L.movers[i]; const p = moverPos(m, t), p0 = moverPos(m, t - 1); const dy = p.y - p0.y;
      if (vy >= 0 && prevBottom <= p.y + Math.abs(dy) + 2 && y + PH >= p.y && x + PW - 4 > p.x && x + 4 < p.x + m.w) { y = p.y - PH; vy = 0; grounded = true; onPlat = i; } }
    for (const sp of L.springs) { if (vy >= 0 && overlap(x + 4, y, PW - 8, PH, sp.x + 4, sp.y + T - 18, 24, 18)) { vy = -SPRING; grounded = false; coyote = 0; jumping = false; } }
    const hx = x + 8, hy = y + 8, hw = PW - 16, hh = PH - 10;
    for (let cy = Math.floor(hy / T); cy <= Math.floor((hy + hh) / T); cy++) for (let cx = Math.floor(hx / T); cx <= Math.floor((hx + hw) / T); cx++) if (tileAt(cx, cy) === 3 && overlap(hx, hy, hw, hh, cx * T + 4, cy * T + 8, T - 8, T - 8)) return null;
    for (let i = 0; i < L.enemies.length; i++) { const e = L.enemies[i], ex = enemyX[i][t]; if (overlap(hx, hy, hw, hh, ex + 3, e.y + 3, e.w - 6, e.h - 4)) return null; }
    if (y > H + 40) return null;
    return [x, y, vx, vy, t, grounded ? 1 : 0, coyote, jbuf, jheld ? 1 : 0, onPlat, jumping ? 1 : 0];
  }
  const moverPeriod = Math.round(2 * Math.PI / moverRate);
  const startState = () => [L.start.x, L.start.y, 0, 0, 0, 0, 0, 0, 0, -1, 0]; // place(): grounded=false, coyote=0
  return { stepState, startState, L, LW, tileAt, moverPos, enemyX, enemyRange, moverPeriod, consts: { T, COLS, ROWS, W, H, G, JUMP, JUMP_CUT, MAXV, SPRING, COYOTE, JBUF, PW, PH } };
}

/**
 * Prove that every card and the kassa can be reached without dying.
 * @returns {{ok:boolean, goals:Array<{name:string,ok:boolean,frames?:number,explored:number,best?:object}>, inputs:number[][], frames:number}}
 */
function solveMap(segs, diff, opts = {}) {
  const budget = opts.budget || 2.5e6;
  const sim = makeSim(segs, diff, opts);
  const { stepState, L } = sim;
  const nearMover = (x) => L.movers.some(m => Math.abs(m.x0 + 48 - x) < 260);
  const nearEnemy = (x) => sim.enemyRange.some(([lo, hi]) => x + PW > lo && x < hi);
  const heur = opts.heur || 'prox';
  const goals = [...L.items].sort((a, b) => a.x - b.x).map(it => ({ name: `item ${it.i} (c${it.c},r${it.r})`, x: it.x - 20, y: it.y - 20, w: 40, h: 40 }));
  if (L.kassa) goals.push({ name: 'kassa', x: L.kassa.x + 8, y: L.kassa.y, w: T * 2 - 16, h: T * 2 });
  const key = s => { const xq = Math.round(s[0] / 4), yq = Math.round(s[1] / 4) + 10, vxq = Math.round(s[2] * 2) + 10, vyq = Math.round(s[3]) + 20;
    let tq = 0; if (nearMover(s[0])) tq = Math.floor((s[4] % sim.moverPeriod) / 3); else if (nearEnemy(s[0])) tq = Math.floor(s[4] / 4) % 1024;
    return ((((xq * 160 + yq) * 24 + vxq) * 40 + vyq) * 2 + s[5]) * 1024 + tq; };
  // A goal state is only accepted if the player can still land somewhere: depth-limited search
  // for a grounded state within ~90 frames (otherwise a card grabbed mid-fall into pins counts).
  const survivable = (s0) => {
    if (s0[5]) return true;
    const seen = new Set(); const stack = [s0];
    let n = 0;
    while (stack.length && n++ < 20000) {
      const s = stack.pop();
      for (let ii = 0; ii < INPUTS.length; ii++) {
        const [inL, inR, inJ] = INPUTS[ii];
        let ns = s, d = 0;
        for (const len of DURATIONS) {
          while (d < len && ns) { ns = stepState(ns, inL, inR, inJ); d++; }
          if (!ns) break;
          if (ns[5]) return true;
          if (ns[4] - s0[4] > 90) break;
          const k = key(ns); if (seen.has(k)) continue; seen.add(k); stack.push(ns);
        }
      }
    }
    return false;
  };
  let cur = sim.startState();
  const out = []; const allInputs = []; let ok = true;
  // one best-first search for one goal; returns {found, foundKey, parent, n, best, bestS, maxS}
  function searchGoal(g, heur, budget) {
    const gx = g.x + g.w / 2, gy = g.y + g.h / 2, t0 = cur[4];
    const h = heur === 'greedy'
      ? s => Math.abs(s[0] + PW / 2 - gx) + Math.abs(s[1] + PH / 2 - gy) * 1.5 + (s[4] - t0) * 0.02
      : s => { const dx = Math.abs(s[0] + PW / 2 - gx), dy = Math.abs(s[1] + PH / 2 - gy);
          // height only counts when close to the goal; far away the ground route must not lose to airborne states
          return dx + dy * 1.5 * Math.max(0.15, 1 - dx / 320) + (s[4] - t0) * 0.02; };
    const parent = new Map(); // key -> [parentKey, inputIndex, frames]
    const k0 = key(cur); parent.set(k0, null);
    const heap = [];
    const push = (pr, st) => { heap.push([pr, st]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    push(h(cur), cur);
    let n = 0, found = null, foundKey = null, best = Infinity, bestS = null, maxS = cur;
    while (heap.length && n < budget) {
      const [pr, s] = pop(); n++;
      if (pr < best) { best = pr; bestS = s; }
      if (s[0] > maxS[0]) maxS = s;
      if (overlap(s[0], s[1], PW, PH, g.x, g.y, g.w, g.h) && survivable(s)) { found = s; foundKey = key(s); break; }
      const sk = key(s);
      for (let ii = 0; ii < INPUTS.length; ii++) {
        const [inL, inR, inJ] = INPUTS[ii];
        // macro actions: hold the same input for 1, 2, 4, 8 or 16 frames per search edge
        let ns = s, d = 0;
        for (const len of DURATIONS) {
          while (d < len && ns) { ns = stepState(ns, inL, inR, inJ); d++; }
          if (!ns) break;
          const k = key(ns); if (parent.has(k)) continue;
          parent.set(k, [sk, ii, len]); push(h(ns), ns);
        }
      }
    }
    return { found, foundKey, parent, n, best, bestS, maxS };
  }
  // portfolio: the proximity heuristic first (ground routes), then the plain greedy one (fast descents), small budgets before big ones
  const plan = opts.heur ? [[opts.heur, budget]] : [['prox', budget / 8], ['greedy', budget / 8], ['prox', budget], ['greedy', budget]];
  for (const g of goals) {
    let r = null, explored = 0;
    for (const [heur, b] of plan) { r = searchGoal(g, heur, b); explored += r.n; if (r.found) break; }
    if (!r.found) {
      ok = false;
      const fmt = s => ({ col: +(s[0] / T).toFixed(1), row: +((s[1] + PH) / T).toFixed(2), t: s[4], grounded: s[5] });
      out.push({ name: g.name, ok: false, explored, best: r.bestS && { ...fmt(r.bestS), dist: Math.round(r.best) }, maxX: fmt(r.maxS) });
      break;
    }
    // reconstruct inputs for this goal
    const seq = []; let k = r.foundKey;
    while (r.parent.get(k)) { const [pk, ii, len] = r.parent.get(k); for (let j = 0; j < len; j++) seq.push(INPUTS[ii]); k = pk; }
    seq.reverse();
    // the key-based chain may not be the exact state chain; re-simulate to make sure and to get the exact end state
    let s2 = cur; for (const [l, r2, j] of seq) { s2 = stepState(s2, l, r2, j); if (!s2) break; }
    if (!s2 || !overlap(s2[0], s2[1], PW, PH, g.x, g.y, g.w, g.h)) { ok = false; out.push({ name: g.name, ok: false, explored, error: 'replayed input chain does not reach the goal (key aliasing)' }); break; }
    out.push({ name: g.name, ok: true, frames: s2[4], explored });
    for (const inp of seq) allInputs.push(inp);
    cur = s2;
  }
  return { ok, goals: out, inputs: allInputs, frames: cur[4], sim };
}

/** Simulate an input sequence from the start; returns the per-frame states (for divergence reports). */
function simulate(sim, inputs) {
  const states = []; let s = sim.startState();
  for (const [l, r, j] of inputs) { s = sim.stepState(s, l, r, j); if (!s) break; states.push(s); }
  return states;
}

module.exports = { loadSegs, buildMap, makeSim, solveMap, simulate, INPUTS, consts: { T, COLS, ROWS, W, H, PW, PH } };
