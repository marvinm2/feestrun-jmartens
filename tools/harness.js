// Headless harness: runs the built game (artifact.html) inside a Node vm with a stubbed
// DOM, canvas and timers, and hands back the window.__feest debug handle.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readGameScript(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const htmlMtime = fs.statSync(htmlPath).mtimeMs;
  const srcDir = path.join(ROOT, 'src');
  for (const f of fs.readdirSync(srcDir)) {
    if (!f.endsWith('.part')) continue;
    if (fs.statSync(path.join(srcDir, f)).mtimeMs > htmlMtime + 1000) {
      throw new Error(`${path.basename(htmlPath)} is stale (src/${f} is newer): run python3 build_site.py`);
    }
  }
  const a = html.indexOf('<script>');
  const b = html.lastIndexOf('</script>');
  if (a < 0 || b < 0) throw new Error('no <script> block in ' + htmlPath);
  return html.slice(a + '<script>'.length, b);
}

function makeCtx() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => gradient;
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeElement(tag, ctx) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    attrs: {},
    dataset: {},
    style: {},
    hidden: false,
    innerHTML: '',
    textContent: '',
    offsetWidth: 0,
    offsetHeight: 0,
    tabIndex: 0,
    onclick: null,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, force) { const on = force === undefined ? !this._s.has(c) : !!force; on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { el.children.push(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
    hasAttribute(k) { return k in el.attrs; },
    removeAttribute(k) { delete el.attrs[k]; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return makeElement('div', ctx); },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
    scrollIntoView() {},
    getContext() { return ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 544 }; },
  };
  Object.defineProperty(el, 'className', {
    get() { return [...el.classList._s].join(' '); },
    set(v) { el.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return el;
}

/**
 * Load the game headlessly.
 * @param {{seed?:number, html?:string}} opts
 * @returns {{F:object, sandbox:object, document:object}}
 */
function loadGame(opts = {}) {
  const seed = opts.seed ?? 1;
  const htmlPath = opts.html || process.env.FEEST_HTML || path.join(ROOT, 'artifact.html');
  const script = readGameScript(htmlPath);
  const ctx = makeCtx();
  const byId = new Map();
  const document = {
    getElementById(id) { if (!byId.has(id)) byId.set(id, makeElement('div', ctx)); return byId.get(id); },
    createElement(tag) { return makeElement(tag, ctx); },
    querySelector() { return makeElement('div', ctx); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
    body: makeElement('body', ctx),
  };
  let timerId = 0;
  const seededMath = Object.create(Math);
  seededMath.random = mulberry32(seed);
  const sandbox = {
    document,
    Math: seededMath,
    console,
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; this.src = ''; } },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame() { return ++timerId; },
    cancelAnimationFrame() {},
    setTimeout() { return ++timerId; },
    setInterval() { return ++timerId; },
    clearTimeout() {},
    clearInterval() {},
    location: { search: '', href: 'http://localhost/' },
    navigator: { userAgent: 'node' },
    Uint8Array, Uint8ClampedArray, Float32Array, Map, Set, Promise, Object, Array, String, Number, JSON,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: path.basename(htmlPath) });
  const F = sandbox.__feest;
  if (!F) throw new Error('window.__feest not exposed by the game script');
  return { F, sandbox, document };
}

/**
 * Run up to n frames, calling bot(F, debug) before each step. Stops when the state leaves 'play'.
 * @returns {number} frames actually run
 */
function runFrames(F, n, bot) {
  for (let i = 0; i < n; i++) {
    if (F.state !== 'play') return i;
    if (bot) bot(F, F.debug ? F.debug() : null);
    F.step();
  }
  return n;
}

module.exports = { loadGame, runFrames, mulberry32, ROOT };
