/**
 * CHRONO TRANSCENDENCE — Fórmulas puras y agregación de modificadores.
 * Sin DOM ni efectos secundarios: lo usan el motor, la UI y el simulador de balance.
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});
  const B = CT.BALANCE;
  const U = CT.U;

  const F = {};

  F.age = (state) => B.START_AGE + state.player.lifeDays / B.DAYS_PER_YEAR;

  /** XP_req(L) = XP_BASE · dificultad · (L+1)^POLY · GROWTH^L · (1 - reducción) */
  F.xpRequired = (def, level, mods) =>
    B.XP_BASE * def.difficulty * Math.pow(level + 1, B.XP_POLY) * Math.pow(B.XP_GROWTH, level) * (mods ? mods.xpCost : 1);

  /** Memoria Álmica por tarea (logarítmica: nunca rompe el juego). */
  F.memoryMult = (pastMax, mods) =>
    1 + (B.MEMORY_COEF + (mods ? mods.memoryPower : 0)) * Math.log(1 + pastMax / B.MEMORY_SCALE);

  /** Karma Latente: bonificación logarítmica por Karma sin gastar. */
  F.latentKarmaMult = (karma) => 1 + B.LATENT_KARMA_COEF * Math.log2(1 + Math.max(0, karma) / B.LATENT_KARMA_SCALE);

  F.totalLevels = (state) => {
    let t = 0;
    for (const id in state.jobs) t += state.jobs[id].level;
    for (const id in state.skills) t += state.skills[id].level;
    return t;
  };

  /** Niveles que superan el récord histórico de cada tarea (alimentan el Eco Álmico). */
  F.newRecordLevels = (state) => {
    let r = 0;
    for (const id in state.jobs) r += Math.max(0, state.jobs[id].level - state.jobs[id].pastMax);
    for (const id in state.skills) r += Math.max(0, state.skills[id].level - state.skills[id].pastMax);
    return r;
  };

  /**
   * Ganancia de Eco Álmico de una vida (fracción).
   * R < 5 récords: 1.5% por récord. R ≥ 5: 5% + 10% · (R-5)/(R-5+30)  → tope asintótico 15%.
   * Los nodos/hitos con echoGain suman puntos fijos si hubo algún récord.
   */
  F.echoGain = (state, mods) => {
    const R = F.newRecordLevels(state);
    if (R <= 0) return 0;
    let g;
    if (R < B.ECHO_MIN_RECORDS) g = R * B.ECHO_PER_RECORD_BELOW_MIN;
    else {
      const x = R - B.ECHO_MIN_RECORDS;
      g = B.ECHO_MIN_GAIN + B.ECHO_BONUS_GAIN * (x / (x + B.ECHO_HALF));
    }
    return g + (mods ? mods.echoGain : 0);
  };

  /** Karma = floor( (max(0, Niveles - SUELO) / DIV)^EXP · multKarma ) */
  F.pendingKarma = (state, mods) => {
    const tl = F.totalLevels(state);
    const base = Math.pow(Math.max(0, tl - B.KARMA_FLOOR) / B.KARMA_DIV, B.KARMA_EXP);
    const tithe = mods.tithe * Math.log10(1 + state.player.lifeGoldEarned);
    return Math.floor(base * (mods.karmaMult + tithe) + U.EPS);
  };

  // ------------------------------------------------------------- SENESCENCIA
  F.achesFactor = (age, mods) =>
    age <= mods.agingThreshold ? 1 : Math.max(B.AGING_FLOOR, 1 - mods.agingSlope * (age - mods.agingThreshold));

  F.fogFactor = (age, mods) =>
    age <= mods.mentalThreshold ? 1 : Math.max(B.MENTAL_FLOOR, 1 - mods.mentalSlope * (age - mods.mentalThreshold));

  F.inDelirium = (age, mods) => age > mods.mentalThreshold + B.DELIRIUM_OFFSET;

  F.activeConditions = (age, mods) => {
    const out = [];
    if (age > mods.agingThreshold) out.push('aches');
    if (age > mods.mentalThreshold) out.push('fog');
    if (F.inDelirium(age, mods)) out.push('delirium');
    return out;
  };

  /** Multiplicador de senescencia según categoría de la tarea. */
  F.senescence = (category, age, mods) => {
    if (category === 'physical' || category === 'martial') return F.achesFactor(age, mods);
    if (category === 'intellect' || category === 'arcane') return F.fogFactor(age, mods);
    return 1;
  };

  // ------------------------------------------------------- TASAS POR TAREA
  F.categoryXp = (category, mods) => mods.xpCat[category] || 1;

  /** Desglose de la tasa de XP por día (la UI lo muestra tal cual). */
  F.xpRateBreakdown = (state, id, mods) => {
    const def = CT.taskDef(id);
    const ts = CT.taskState(state, id);
    const age = F.age(state);
    const parts = {
      base: B.XP_GAIN_PER_DAY,
      global: mods.xpGlobal,
      category: F.categoryXp(def.category, mods),
      task: 1 + (mods.xpTask[id] || 0),
      memory: F.memoryMult(ts.pastMax, mods),
      senescence: F.senescence(def.category, age, mods),
    };
    parts.total = parts.base * parts.global * parts.category * parts.task * parts.memory * parts.senescence;
    return parts;
  };
  F.xpRate = (state, id, mods) => F.xpRateBreakdown(state, id, mods).total;

  F.jobIncome = (state, id, mods) => {
    const def = CT.JOBS[id];
    const ts = state.jobs[id];
    const age = F.age(state);
    const levelMult = 1 + B.INCOME_PER_LEVEL * ts.level;
    const senes = def.category === 'physical' || def.category === 'martial' ? F.achesFactor(age, mods) : 1;
    return def.income * levelMult * mods.goldGlobal * (1 + (mods.goldCat[def.category] || 0)) * (1 + (mods.goldTask[id] || 0)) * senes;
  };

  F.housingRent = (id, mods) => CT.HOUSING[id].rent * mods.housingCost;
  F.housingDeposit = (id, mods) => F.housingRent(id, mods) * B.DEPOSIT_DAYS;

  // ------------------------------------------------------------ REQUISITOS
  F.requirementMet = (state, req, mods) => {
    if (req.type === 'job') return state.jobs[req.id].level >= req.level;
    if (req.type === 'skill') return state.skills[req.id].level >= req.level;
    if (req.type === 'attr') return U.gte(mods.attributes[req.id], req.value);
    return false;
  };
  F.requirementsMet = (state, def, mods) => def.requires.every((r) => F.requirementMet(state, r, mods));
  F.requirementText = (req) => {
    if (req.type === 'attr') return `${CT.ATTRIBUTES[req.id].name} ≥ ${req.value.toFixed(2)}`;
    const d = CT.taskDef(req.id);
    return `${d.name} Lv ${req.level}`;
  };

  // ------------------------------------------------------- MODIFICADORES
  /**
   * Agrega todos los efectos declarativos (árbol, hitos, hogar, atributos) en
   * un objeto plano. Se recalcula sólo cuando algo cambia (subida de nivel,
   * nodo, mudanza), no en cada tick.
   */
  F.computeModifiers = (state) => {
    const add = Object.create(null);
    const mul = Object.create(null);
    const flags = Object.create(null);

    const apply = (eff) => {
      if (!eff) return;
      for (const k in eff) {
        const v = eff[k];
        if (k === 'unlockPlanner' || k === 'autoReincarnate') flags[k] = true;
        else if (k.endsWith('Mult')) mul[k] = (mul[k] === undefined ? 1 : mul[k]) * v;
        else add[k] = (add[k] || 0) + v;
      }
    };
    const a = (k) => add[k] || 0;
    const m = (k) => (mul[k] === undefined ? 1 : mul[k]);

    // 1. Árbol: nodos normales activos al instante; keystones sólo si sellados al nacer.
    for (const id of state.tree.allocated) {
      const n = CT.LATTICE_BY_ID[id];
      if (n && n.type !== 'keystone') apply(n.effect);
    }
    for (const id of state.tree.activeKeystones) {
      const n = CT.LATTICE_BY_ID[id];
      if (n) apply(n.effect);
    }

    // 2. Hitos de maestría.
    const applyBreakpoints = (defs, states) => {
      for (const id in defs) {
        const lvl = states[id].level;
        const bps = defs[id].breakpoints;
        for (const t in bps) if (lvl >= +t) apply(bps[t].effect);
      }
    };
    applyBreakpoints(CT.JOBS, state.jobs);
    applyBreakpoints(CT.SKILLS, state.skills);

    // 3. Hogar.
    const house = CT.HOUSING[state.player.housingId] || CT.HOUSING.street;
    apply(house.effect);

    // 4. Atributos derivados de niveles.
    const attributes = {};
    for (const attr in CT.ATTRIBUTE_SOURCES) {
      let v = 1 + a('attr_' + attr);
      const src = CT.ATTRIBUTE_SOURCES[attr];
      for (const id in src) {
        const ts = CT.taskState(state, id);
        if (ts) v += ts.level * src[id];
      }
      attributes[attr] = v;
    }
    const W = B.ATTR_XP_WEIGHT;
    const str = attributes.strength - 1, int = attributes.intellect - 1;
    const vit = attributes.vitality - 1, arc = attributes.arcana - 1;
    const p = state.player;

    const mods = { attributes, flags };

    // XP
    const pastLife = a('pastLifeXp') * Math.min(p.reincarnationCount, 20);
    mods.echo = p.soulEcho;
    mods.latentKarma = F.latentKarmaMult(p.karma);
    mods.xpGlobal = (1 + a('xpGlobal') + pastLife) * m('xpGlobalMult') * house.xpMult * p.soulEcho * mods.latentKarma;
    mods.xpCat = {
      physical: (1 + a('xpPhysical') + str * W) * m('xpPhysicalMult'),
      martial: (1 + a('xpMartial') + str * W) * m('xpPhysicalMult'),
      intellect: (1 + a('xpIntellect') + int * W + a('muscleMemory') * str) * m('xpIntellectMult'),
      arcane: (1 + a('xpArcane') + arc * W) * m('xpArcaneMult'),
    };
    mods.xpTask = {};
    mods.goldTask = {};
    for (const k in add) {
      if (k.startsWith('xp_')) mods.xpTask[k.slice(3)] = add[k];
      if (k.startsWith('gold_')) mods.goldTask[k.slice(5)] = add[k];
    }
    mods.xpCost = 1 - Math.min(B.MAX_XP_COST_REDUCTION, a('xpCost'));
    mods.memoryPower = a('memoryPower');

    // Oro
    mods.goldGlobal = (1 + a('gold')) * m('goldMult');
    mods.goldCat = {
      physical: a('goldPhysical'), martial: a('goldMartial'),
      intellect: a('goldIntellect'), arcane: a('goldArcane'),
    };
    mods.housingCost = Math.max(0.2, 1 - a('housingCost')) * m('housingCostMult');

    // Vida y senescencia
    const rawMaxAge = (B.BASE_MAX_AGE + a('maxAge') + house.years + vit * B.VITALITY_YEARS) * (1 + a('maxAgePct')) * m('maxAgeMult');
    mods.maxAge = Math.max(B.START_AGE + 6, rawMaxAge);
    mods.agingThreshold = B.AGING_THRESHOLD + a('agingThreshold') + vit * 10;
    mods.agingSlope = B.AGING_SLOPE * Math.max(0.2, 1 - a('agingSlope'));
    const medDelay = Math.min(B.MENTAL_MEDITATION_DELAY_CAP, state.skills.meditation.level * B.MENTAL_MEDITATION_DELAY);
    mods.mentalThreshold = B.MENTAL_THRESHOLD + medDelay + a('mentalThreshold');
    mods.mentalSlope = B.MENTAL_SLOPE * Math.max(0.2, 1 - a('mentalSlope'));
    mods.agingRate = Math.max(0.5, 1 - a('agingRate'));

    // Prestigio
    mods.karmaMult = (1 + a('karma') + arc * B.ARCANA_KARMA_WEIGHT) * m('karmaMult');
    mods.tithe = a('tithe');
    mods.echoGain = a('echoGain');

    // Eureka
    mods.eurekaChance = B.EUREKA_CHANCE_PER_DAY * (1 + a('eurekaChance')) * m('eurekaMult');

    // Sistemas
    mods.offlineCapHours = B.OFFLINE_BASE_CAP_HOURS + a('offlineCapHours');
    mods.plannerUnlocked = !!flags.unlockPlanner || p.reincarnationCount >= B.PLANNER_UNLOCK_REINCARNATIONS;
    mods.plannerSlots = mods.plannerUnlocked ? B.PLANNER_BASE_SLOTS + a('plannerSlots') : 0;
    mods.autoReincarnateUnlocked = !!flags.autoReincarnate;

    return mods;
  };

  CT.F = F;
})(typeof window !== 'undefined' ? window : globalThis);
