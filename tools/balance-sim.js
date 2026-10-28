#!/usr/bin/env node
/**
 * CHRONO TRANSCENDENCE — Simulador de balance headless.
 * Ejecuta el MISMO código de simulación que el navegador con un "bot" de
 * jugador competente y reporta el ritmo vida a vida.
 *
 *   node tools/balance-sim.js            # 40 vidas, build mixta
 *   node tools/balance-sim.js 60 karma   # 60 vidas, build Karma Rush
 *   (builds: mixed | karma | longevity | intellect)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
for (const f of ['utils.js', 'config.js', 'data.js', 'lattice-data.js', 'state.js', 'formulas.js', 'simulation.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
}
const CT = globalThis.CT;
const { F, Sim, U, BALANCE: B } = CT;

const LIVES = +process.argv[2] || 40;
const BUILD = process.argv[3] || 'mixed';

const BUILDS = {
  mixed: ['inner_focus', 'iron_veins', 'karmic_seed', 'alchemical_spark', 'celestial_ledger', 'deep_study', 'transmuted_longevity',
    'destiny_equations', 'alchemical_synthesis', 'honed_instincts', 'memento_mori', 'frugality', 'chronos_mastery', 'celestial_affinity',
    'astral_resonance', 'resonant_echoes', 'muscle_memory', 'mana_circulation', 'vision_prophetic', 'phoenix_blood', 'oak_heart',
    'circadian', 'serene_mind', 'golden_touch', 'merchant_guile', 'tithe', 'crystal_mind', 'basalt_skin', 'cosmic_sleep', 'wheel_samsara',
    'extended_schedule', 'eternal_elixir'],
  karma: ['karmic_seed', 'destiny_equations', 'memento_mori', 'inner_focus', 'resonant_echoes', 'astral_resonance', 'death_pact',
    'iron_veins', 'alchemical_spark', 'frugality', 'tithe', 'deep_study', 'celestial_ledger', 'chronos_mastery', 'celestial_affinity'],
  longevity: ['iron_veins', 'transmuted_longevity', 'oak_heart', 'phoenix_blood', 'memento_mori', 'circadian', 'serene_mind',
    'basalt_skin', 'karmic_seed', 'eternal_elixir', 'inner_focus', 'deep_study', 'destiny_equations', 'resonant_echoes'],
  intellect: ['inner_focus', 'deep_study', 'celestial_ledger', 'mana_circulation', 'karmic_seed', 'celestial_affinity', 'iron_veins',
    'chronos_mastery', 'honed_instincts', 'muscle_memory', 'vision_prophetic', 'crystal_mind', 'destiny_equations', 'ascetic'],
};

/**
 * Bot "jugador competente": elige la tarea cuyo siguiente nivel cuesta menos
 * tiempo, priorizando (×0.35) los requisitos de lo que aún está bloqueado y,
 * en trabajos, el sueldo cuando no cubre el alquiler del siguiente hogar.
 */
function botDecide(state, ctx) {
  const p = state.player;
  const priority = {};
  for (const [defs, states] of [[CT.JOBS, state.jobs], [CT.SKILLS, state.skills]]) {
    for (const id in defs) {
      if (states[id].unlocked) continue;
      for (const r of defs[id].requires) if (r.type !== 'attr' && !F.requirementMet(state, r, ctx.mods)) priority[r.id] = true;
      for (const r of defs[id].requires) if (r.type === 'attr') priority.swordsmanship = true;
    }
  }
  const pick = (defs, states, scoreExtra) => {
    let best = null, bestT = Infinity;
    for (const id in defs) {
      if (!states[id].unlocked) continue;
      const s = states[id];
      let t = (F.xpRequired(defs[id], s.level, ctx.mods) - s.xp) / F.xpRate(state, id, ctx.mods);
      if (priority[id]) t *= 0.35;
      t *= scoreExtra ? scoreExtra(id) : 1;
      if (t < bestT) { bestT = t; best = id; }
    }
    return best;
  };
  const curRent = F.housingRent(p.housingId, ctx.mods);
  const job = pick(CT.JOBS, state.jobs, (id) => {
    const inc = F.jobIncome(state, id, ctx.mods);
    return inc < curRent * 1.05 ? 50 : 1; // nunca un trabajo que no paga el techo actual
  });
  const skill = pick(CT.SKILLS, state.skills);
  if (job && p.activeJobId !== job) Sim.setActive(state, ctx, 'job', job);
  if (skill && p.activeSkillId !== skill) Sim.setActive(state, ctx, 'skill', skill);

  // Vivienda: la mejor que el sueldo actual sostenga con margen.
  let income = 0;
  for (const id in CT.JOBS) if (state.jobs[id].unlocked) income = Math.max(income, F.jobIncome(state, id, ctx.mods));
  const cur = CT.HOUSING_ORDER.indexOf(p.housingId);
  for (let i = CT.HOUSING_ORDER.length - 1; i > cur; i--) {
    const id = CT.HOUSING_ORDER[i];
    if (income >= F.housingRent(id, ctx.mods) * 1.3 && U.canAfford(p, F.housingDeposit(id, ctx.mods) * 1.2)) {
      Sim.moveHousing(state, ctx, id);
      break;
    }
  }
}

function spendKarma(state, order) {
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of order) {
      const n = CT.LATTICE_BY_ID[id];
      if (state.tree.allocated.includes(id)) continue;
      const connected = n.connections.some((c) => state.tree.allocated.includes(c));
      if (connected && state.player.karma >= n.cost) {
        state.player.karma -= n.cost;
        state.tree.allocated.push(id);
        if (n.type === 'keystone') state.tree.activeKeystones.push(id); // comprado al renacer
        bought = true;
        break;
      }
    }
  }
}

const state = CT.createDefaultState();
const ctx = Sim.createContext(state, { rng: U.seededRng(42) });
let cumSec = 0;
const rows = [];
const firsts = {};
const mark = (key, life) => { if (!(key in firsts)) firsts[key] = { life, hours: cumSec / 3600 }; };

for (let life = 1; life <= LIVES; life++) {
  const startSec = state.stats.realSecondsTotal;
  let maxJob = '', housing = 'street', guard = 0;
  while (state.player.isAlive && guard++ < 1e6) {
    botDecide(state, ctx);
    Sim.advance(state, ctx, 10, { maxStep: 0.4, bulk: true }); // pasos de tick reales
    for (const id in CT.JOBS) if (state.jobs[id].unlocked) { maxJob = id; mark('job:' + id, life); }
    for (const id in CT.SKILLS) if (state.skills[id].unlocked) mark('skill:' + id, life);
    if (CT.HOUSING_ORDER.indexOf(state.player.housingId) > CT.HOUSING_ORDER.indexOf(housing)) housing = state.player.housingId;
    mark('house:' + state.player.housingId, life);
    for (const id in CT.JOBS) for (const t of [25, 50]) if (state.jobs[id].level >= t) mark(`${id}≥${t}`, life);
  }
  const s = state.player.deathSummary;
  if (process.env.DUMP && life % +process.env.DUMP === 0) {
    const lv = (o) => Object.entries(o).map(([k, v]) => `${k.slice(0, 5)}${v.level}/${v.pastMax}`).join(' ');
    console.log(`L${life} ${lv(state.jobs)} | ${lv(state.skills)} | maxAge ${ctx.mods.maxAge.toFixed(0)} fog@${ctx.mods.mentalThreshold.toFixed(0)} aches@${ctx.mods.agingThreshold.toFixed(0)} xpG ${ctx.mods.xpGlobal.toFixed(2)}`);
  }
  const lifeSec = state.stats.realSecondsTotal - startSec;
  cumSec += lifeSec;
  const topJob = Object.keys(CT.JOBS).map((id) => [id, state.jobs[id].level]).sort((a, b) => b[1] - a[1])[0];
  const topSkill = Object.keys(CT.SKILLS).map((id) => [id, state.skills[id].level]).sort((a, b) => b[1] - a[1])[0];
  Sim.reincarnate(state, ctx);
  // La build prioriza sus nodos; con Karma sobrante compra el resto (como haría un jugador).
  spendKarma(state, [...(BUILDS[BUILD] || []), ...BUILDS.mixed]);
  Sim.refresh(state, ctx);
  rows.push({
    life, mins: (lifeSec / 60).toFixed(0), cumH: (cumSec / 3600).toFixed(1), age: s.age.toFixed(1), lv: s.totalLevels,
    rec: s.records, karma: s.karma, echo: (s.echoGain * 100).toFixed(1) + '%', soul: state.player.soulEcho.toFixed(2),
    job: `${maxJob}`, top: `${topJob[0].slice(0, 6)}${topJob[1]}/${topSkill[0].slice(0, 6)}${topSkill[1]}`,
    house: housing, nodes: state.tree.allocated.length, bank: state.player.karma,
  });
}

console.log(`\nBuild: ${BUILD} — coste total del árbol: ${CT.LATTICE_TOTAL_COST} Karma\n`);
console.table(rows);
console.log('\nPrimeras veces (vida · horas de juego acumuladas a 1x):');
for (const k in firsts) console.log(`  ${k.padEnd(30)} vida ${String(firsts[k].life).padStart(3)} · ${firsts[k].hours.toFixed(1)} h`);
