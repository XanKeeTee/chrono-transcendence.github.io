/**
 * CHRONO TRANSCENDENCE — Utilidades puras (sin DOM).
 * Se cargan como script clásico para que el juego funcione abriendo index.html
 * directamente (file://), donde los módulos ES fallan por CORS.
 * En Node (tools/balance-sim.js) se cargan con vm.runInThisContext.
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});

  const U = {};

  U.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /** Devuelve un número finito o el valor por defecto (protege contra NaN/Infinity en saves). */
  U.num = (v, def = 0, lo = -Infinity, hi = Infinity) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? U.clamp(n, lo, hi) : def;
  };

  U.int = (v, def = 0, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Math.trunc(U.num(v, def, lo, hi));

  /** Comparación tolerante a coma flotante (0.1 + 0.2 >= 0.3). */
  U.EPS = 1e-9;
  U.gte = (a, b) => a + U.EPS * Math.max(1, Math.abs(b)) >= b;

  // ---------------------------------------------------------------------------
  // Oro en punto fijo: se guarda como entero de milésimas ("mills") + un
  // acarreo fraccional. Así los costes, depósitos y comparaciones son exactos
  // y nunca aparece 0.30000000000000004 en la UI ni falla "oro >= coste".
  // ---------------------------------------------------------------------------
  U.MONEY_SCALE = 1000;

  U.addGold = (player, amountGold) => {
    if (!Number.isFinite(amountGold) || amountGold === 0) return;
    const total = player.goldCarry + amountGold * U.MONEY_SCALE;
    const whole = Math.trunc(total);
    player.goldMills += whole;
    player.goldCarry = total - whole;
    if (player.goldMills < 0) { player.goldMills = 0; player.goldCarry = 0; }
  };

  U.gold = (player) => player.goldMills / U.MONEY_SCALE;
  U.canAfford = (player, costGold) => player.goldMills >= Math.round(costGold * U.MONEY_SCALE);
  U.spendGold = (player, costGold) => {
    const mills = Math.round(costGold * U.MONEY_SCALE);
    if (player.goldMills < mills) return false;
    player.goldMills -= mills;
    return true;
  };

  // ---------------------------------------------------------------------------
  // Formato numérico con sufijos (evita cadenas de 20 dígitos en niveles altos)
  // ---------------------------------------------------------------------------
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
  U.fmt = (n, decimals = 2) => {
    if (!Number.isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs < 1000) return n.toFixed(abs >= 100 ? Math.min(decimals, 1) : decimals);
    const tier = Math.floor(Math.log10(abs) / 3);
    if (tier >= SUFFIXES.length) return n.toExponential(2);
    return (n / Math.pow(10, tier * 3)).toFixed(2) + SUFFIXES[tier];
  };
  U.fmtInt = (n) => (Math.abs(n) < 1000 ? String(Math.floor(n)) : U.fmt(n));
  U.pct = (mult, decimals = 0) => `${mult >= 1 ? '+' : ''}${((mult - 1) * 100).toFixed(decimals)}%`;

  U.fmtDuration = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  /** Escapa texto que pueda acabar en innerHTML (p.ej. datos de un save importado). */
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Hash FNV-1a de 32 bits: detecta saves truncados o editados a mano. */
  U.hash = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  };

  /** Base64 seguro para UTF-8 (sustituye el obsoleto unescape/escape). */
  U.toBase64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  U.fromBase64 = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  /** RNG inyectable: el simulador de balance usa uno con semilla para ser reproducible. */
  U.rng = Math.random;
  U.seededRng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  CT.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
