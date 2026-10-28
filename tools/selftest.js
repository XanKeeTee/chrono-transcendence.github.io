#!/usr/bin/env node
/**
 * CHRONO TRANSCENDENCE — Pruebas de regresión del núcleo (sin navegador).
 *   node tools/selftest.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mínimos de navegador para save.js
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; },
};

const root = path.join(__dirname, '..', 'js');
for (const f of ['utils.js', 'config.js', 'data.js', 'lattice-data.js', 'state.js', 'formulas.js', 'simulation.js', 'save.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
}
const { U, F, Sim, Save, BALANCE: B } = globalThis.CT;
const CT = globalThis.CT;

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); } catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || ''} esperado ${b}, obtenido ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg || 'condición falsa'); };
const fresh = () => { const s = CT.createDefaultState(); return { s, ctx: Sim.createContext(s, { rng: U.seededRng(1) }) }; };

console.log('\nChrono Transcendence — selftest\n');

t('Oro en punto fijo: 0.1 + 0.2 == 0.3 exacto', () => {
  const { s } = fresh();
  U.addGold(s.player, 0.1); U.addGold(s.player, 0.2);
  eq(s.player.goldMills, 300); ok(U.canAfford(s.player, 0.3));
});

t('Oro: un millón de ingresos fraccionarios no deriva', () => {
  const { s } = fresh();
  for (let i = 0; i < 1e6; i++) U.addGold(s.player, 0.001);
  eq(s.player.goldMills, 1000 * U.MONEY_SCALE); // exactamente 1000 de oro
});

t('Save: ida y vuelta conserva el estado', () => {
  const { s } = fresh();
  s.player.karma = 123; s.jobs.beggar.level = 7; s.tree.allocated.push('inner_focus');
  const back = Save.sanitize(Save.openEnvelope(Save.envelope(s)));
  eq(back.player.karma, 123); eq(back.jobs.beggar.level, 7); ok(back.tree.allocated.includes('inner_focus'));
});

t('Save: checksum detecta corrupción', () => {
  const { s } = fresh();
  const env = JSON.parse(Save.envelope(s));
  env.data = env.data.replace('"karma":0', '"karma":999999');
  let threw = false;
  try { Save.openEnvelope(JSON.stringify(env)); } catch (e) { threw = true; }
  ok(threw);
});

t('Save: corrupto → cae al respaldo', () => {
  const { s } = fresh();
  s.player.karma = 5; Save.write(s);
  s.player.karma = 6; Save.write(s); // el 5 pasa a backup
  mem[CT.SAVE_KEY] = mem[CT.SAVE_KEY].slice(0, 40); // truncado
  const r = Save.read();
  eq(r.source, 'backup'); eq(r.state.player.karma, 5);
});

t('Save: saneado contra NaN, tipos raros, ids falsos y HTML', () => {
  const bad = { player: { karma: 'NaN', goldMills: Infinity, activeJobId: 'hacker', housingId: '<img onerror=1>' },
    jobs: { beggar: { level: '<script>', xp: -5, pastMax: 1e99 } }, tree: { allocated: ['death_pact', 'nope'] } };
  const s = Save.sanitize(bad);
  eq(s.player.karma, CT.LATTICE_BY_ID.death_pact.cost, 'Karma NaN → 0 + reembolso del nodo huérfano');
  eq(s.player.goldMills, 0); eq(s.player.activeJobId, 'beggar'); eq(s.player.housingId, 'street');
  eq(s.jobs.beggar.level, 0); eq(s.jobs.beggar.xp, 0); ok(s.jobs.beggar.pastMax <= 1e6);
  ok(!s.tree.allocated.includes('death_pact'), 'nodo desconectado debe eliminarse');
});

t('Save: migración desde prototipo v1', () => {
  const v1 = { player: { karma: 40, reincarnationCount: 3 }, jobs: { beggar: { level: 4, pastMaxLevel: 60 } }, skills: {},
    celestialTree: { allocatedNodes: ['root_awakening', 'iron_veins'] } };
  const s = Save.migrateV1(v1, []);
  eq(s.player.karma, 42); eq(s.jobs.beggar.pastMax, 30); eq(s.player.reincarnationCount, 3);
});

t('Exploit Pacto con la Muerte: el keystone no actúa hasta renacer', () => {
  const { s, ctx } = fresh();
  s.tree.allocated.push('karmic_seed', 'destiny_equations', 'resonant_echoes', 'death_pact');
  Sim.refresh(s, ctx);
  eq(ctx.mods.maxAge > 50, true, 'maxAge no debe reducirse a mitad de vida');
  const k1 = ctx.mods.karmaMult;
  s.player.lifeDays = 100; s.player.isAlive = false; s.player.deathSummary = Sim.buildSummary(s, ctx, 'x');
  Sim.reincarnate(s, ctx);
  ok(s.tree.activeKeystones.includes('death_pact')); ok(ctx.mods.karmaMult > k1 * 2);
});

t('Memoria Álmica: no cambia a mitad de vida (sin bucle de realimentación)', () => {
  const { s, ctx } = fresh();
  const m0 = F.memoryMult(s.jobs.beggar.pastMax, ctx.mods);
  Sim.advance(s, ctx, 2000, { maxStep: 0.4, bulk: false });
  eq(s.jobs.beggar.pastMax, 0); eq(F.memoryMult(s.jobs.beggar.pastMax, ctx.mods), m0);
});

t('Independencia del framerate: paso 0.1 vs 0.4 días (sin Eureka)', () => {
  const run = (step) => {
    const { s, ctx } = fresh();
    s.tree.allocated = [CT.LATTICE_ROOT]; s.tree.activeKeystones = ['eternal_elixir']; // eurekaMult 0
    Sim.refresh(s, ctx);
    Sim.advance(s, ctx, 3000, { maxStep: step, bulk: false });
    return s.jobs.beggar.level * 1e6 + s.skills.meditation.level * 1e3 + Math.round(s.jobs.beggar.xp);
  };
  const a = run(0.1), b = run(0.4);
  ok(Math.abs(a - b) / a < 0.002, `${a} vs ${b}`);
});

t('Eureka en modo masivo: valor esperado determinista', () => {
  const run = () => { const { s, ctx } = fresh(); Sim.advance(s, ctx, 5000, { bulk: true, maxStep: 2 }); return s.skills.meditation.xp; };
  eq(run(), run());
});

t('Desahucio: sin oro para el alquiler baja de hogar', () => {
  const { s, ctx } = fresh();
  s.player.housingId = 'mage_tower'; Sim.refresh(s, ctx);
  Sim.step(s, ctx, 0.4);
  ok(s.player.housingId !== 'mage_tower');
});

t('Mudanza exige fianza de 30 días', () => {
  const { s, ctx } = fresh();
  ok(!Sim.moveHousing(s, ctx, 'tent').ok);
  U.addGold(s.player, 30);
  ok(Sim.moveHousing(s, ctx, 'tent').ok); eq(s.player.goldMills, 0);
});

t('Planificador: la regla se dispara una vez y espera si el objetivo está bloqueado', () => {
  const { s, ctx } = fresh();
  s.player.reincarnationCount = B.PLANNER_UNLOCK_REINCARNATIONS; Sim.refresh(s, ctx);
  s.planner.rules.push({ id: 1, enabled: true, cond: { type: 'age', value: 14 }, action: { type: 'job', target: 'laborer' }, fired: false });
  Sim.step(s, ctx, 0.4);
  eq(s.planner.rules[0].fired, false, 'laborer bloqueado: debe esperar');
  s.planner.rules.push({ id: 2, enabled: true, cond: { type: 'age', value: 14 }, action: { type: 'skill', target: 'swordsmanship' }, fired: false });
  Sim.step(s, ctx, 0.4);
  eq(s.player.activeSkillId, 'swordsmanship'); eq(s.planner.rules[1].fired, true);
});

t('Senescencia: Neblina se retrasa 0.5 años por nivel de Meditación', () => {
  const { s, ctx } = fresh();
  const base = ctx.mods.mentalThreshold;
  s.skills.meditation.level = 20; Sim.refresh(s, ctx);
  eq(+(ctx.mods.mentalThreshold - base).toFixed(3), 10); // 20 niveles × 0.5 años
});

t('Rendimiento: 12 h offline completas (con reencarnación automática) en < 2 s', () => {
  const { s, ctx } = fresh();
  s.player.soulEcho = 1e3;
  s.tree.allocated.push('karmic_seed', 'destiny_equations', 'wheel_samsara');
  s.planner.autoReincarnate = true;
  Sim.refresh(s, ctx);
  const t0 = Date.now();
  const r = Sim.advance(s, ctx, (12 * 3600 * 1000) / B.DAY_MS, { maxStep: 1, bulk: true, autoReincarnate: true });
  const ms = Date.now() - t0;
  ok(ms < 2000, `${ms} ms`);
  ok(Math.abs(r.simulatedDays - 172800) < 1, `días simulados ${r.simulatedDays}`);
  console.log(`      (${ms} ms, ${r.lives} vidas, Karma ${s.player.karma})`);
});

console.log(`\n${pass} correctas, ${fail} fallidas\n`);
process.exit(fail ? 1 : 0);
