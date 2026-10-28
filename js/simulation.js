/**
 * CHRONO TRANSCENDENCE — Simulación determinista (sin DOM).
 *
 * Sim.step(state, ctx, dtDays) avanza el mundo dtDays días de calendario.
 * El mismo código ejecuta: el bucle en vivo (pasos de 0.4 días), el progreso
 * offline / pestaña en segundo plano (pasos grandes, "bulk") y el simulador
 * de balance en Node. La UI sólo consume los eventos que deja en ctx.events.
 *
 * ctx = { mods, modsDirty, events: [], bulk: bool, rng: () => number }
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});
  const B = CT.BALANCE;
  const U = CT.U;
  const F = CT.F;

  const Sim = {};

  Sim.createContext = (state, opts = {}) => ({
    mods: F.computeModifiers(state),
    modsDirty: false,
    events: [],
    bulk: !!opts.bulk,
    rng: opts.rng || U.rng,
  });

  Sim.refresh = (state, ctx) => {
    ctx.mods = F.computeModifiers(state);
    ctx.modsDirty = false;
  };

  const emit = (ctx, ev) => {
    // En modo bulk sólo se conservan los eventos importantes (evita millones de objetos).
    if (ctx.bulk && (ev.type === 'levelup' || ev.type === 'eureka' || ev.type === 'forget')) {
      ctx.bulkCounts = ctx.bulkCounts || {};
      ctx.bulkCounts[ev.type] = (ctx.bulkCounts[ev.type] || 0) + 1;
      return;
    }
    ctx.events.push(ev);
    if (ctx.events.length > 500) ctx.events.splice(0, ctx.events.length - 500);
  };

  /** Re-evalúa desbloqueos de la vida actual. Devuelve true si algo cambió. */
  Sim.checkUnlocks = (state, ctx) => {
    let changed = false;
    const check = (defs, states, kind) => {
      for (const id in defs) {
        const s = states[id];
        if (s.unlocked) continue;
        if (F.requirementsMet(state, defs[id], ctx.mods)) {
          s.unlocked = true;
          const first = !s.discovered;
          s.discovered = true;
          changed = true;
          emit(ctx, { type: 'unlock', id, kind, first });
        }
      }
    };
    check(CT.JOBS, state.jobs, 'job');
    check(CT.SKILLS, state.skills, 'skill');
    return changed;
  };

  function gainXp(state, ctx, id, amount) {
    const def = CT.taskDef(id);
    const ts = CT.taskState(state, id);
    if (!Number.isFinite(amount) || amount <= 0) return;
    ts.xp += amount;
    let req = F.xpRequired(def, ts.level, ctx.mods);
    let leveled = false;
    while (U.gte(ts.xp, req)) {
      ts.xp = Math.max(0, ts.xp - req);
      ts.level++;
      leveled = true;
      const bp = def.breakpoints[ts.level];
      emit(ctx, { type: 'levelup', id, level: ts.level });
      if (bp) emit(ctx, { type: 'milestone', id, level: ts.level, bp });
      // Cada nivel cambia atributos (y quizá hitos): recalcular antes del siguiente.
      Sim.refresh(state, ctx);
      req = F.xpRequired(def, ts.level, ctx.mods);
    }
    if (leveled) Sim.checkUnlocks(state, ctx);
  }

  /** Mudanza: subir de categoría exige fianza; bajar es gratis. */
  Sim.moveHousing = (state, ctx, id) => {
    const p = state.player;
    if (!CT.HOUSING[id] || p.housingId === id) return { ok: false, reason: 'same' };
    const cur = CT.HOUSING_ORDER.indexOf(p.housingId);
    const next = CT.HOUSING_ORDER.indexOf(id);
    if (next > cur) {
      const deposit = F.housingDeposit(id, ctx.mods);
      if (!U.spendGold(p, deposit)) return { ok: false, reason: 'deposit', deposit };
    }
    p.housingId = id;
    Sim.refresh(state, ctx);
    emit(ctx, { type: 'housing', id });
    return { ok: true };
  };

  Sim.setActive = (state, ctx, kind, id) => {
    const states = kind === 'job' ? state.jobs : state.skills;
    if (!states[id] || !states[id].unlocked) return false;
    if (kind === 'job') state.player.activeJobId = id;
    else state.player.activeSkillId = id;
    emit(ctx, { type: 'active', kind, id });
    return true;
  };

  /** Un paso de simulación. dtDays = días de calendario (antes de agingRate). */
  Sim.step = (state, ctx, dtDays) => {
    const p = state.player;
    if (!p.isAlive || !(dtDays > 0)) return;
    if (ctx.modsDirty) Sim.refresh(state, ctx);
    const mods = ctx.mods;

    // ---- Tiempo y envejecimiento
    p.lifeDays += dtDays * mods.agingRate;
    state.stats.realSecondsLife += (dtDays * B.DAY_MS) / 1000;
    state.stats.realSecondsTotal += (dtDays * B.DAY_MS) / 1000;
    const age = F.age(state);

    if (age >= mods.maxAge) {
      Sim.die(state, ctx, 'senescence');
      return;
    }

    // ---- Condiciones de senescencia (aviso al entrar)
    const conds = F.activeConditions(age, mods);
    if (conds.length !== p.conditions.length) {
      for (const c of conds) if (!p.conditions.includes(c)) emit(ctx, { type: 'condition', id: c });
      p.conditions = conds;
    }

    // ---- Trabajo: XP + oro
    const jobId = p.activeJobId;
    gainXp(state, ctx, jobId, F.xpRate(state, jobId, ctx.mods) * dtDays);
    const income = F.jobIncome(state, jobId, ctx.mods) * dtDays;
    U.addGold(p, income);
    p.lifeGoldEarned += income;

    // ---- Disciplina: XP + Eureka (independiente del framerate)
    const skillId = p.activeSkillId;
    const skillRate = F.xpRate(state, skillId, ctx.mods);
    let eurekaChance = ctx.mods.eurekaChance * (F.inDelirium(age, ctx.mods) ? 0.5 : 1);
    let skillXp = skillRate * dtDays;
    if (eurekaChance > 0) {
      const burst = skillRate * B.EUREKA_BURST_DAYS;
      if (ctx.bulk || dtDays > 1) {
        skillXp += burst * eurekaChance * dtDays; // valor esperado: offline determinista
      } else if (ctx.rng() < 1 - Math.pow(1 - eurekaChance, dtDays)) {
        skillXp += burst;
        emit(ctx, { type: 'eureka', id: skillId, amount: burst });
      }
    }
    gainXp(state, ctx, skillId, skillXp);

    // ---- Desvarío: olvidos periódicos
    if (F.inDelirium(age, ctx.mods)) {
      p.deliriumClock += dtDays;
      while (p.deliriumClock >= B.DELIRIUM_FORGET_EVERY_DAYS) {
        p.deliriumClock -= B.DELIRIUM_FORGET_EVERY_DAYS;
        const ts = state.skills[skillId];
        const lost = Math.min(ts.xp * B.DELIRIUM_FORGET_FRACTION, skillRate * B.DELIRIUM_FORGET_MAX_DAYS);
        ts.xp -= lost;
        emit(ctx, { type: 'forget', id: skillId, amount: lost });
      }
    } else p.deliriumClock = 0;

    // ---- Alquiler y desahucio
    const rent = F.housingRent(p.housingId, ctx.mods) * dtDays;
    if (rent > 0) {
      if (U.canAfford(p, rent)) U.addGold(p, -rent);
      else {
        const idx = CT.HOUSING_ORDER.indexOf(p.housingId);
        const lower = CT.HOUSING_ORDER[Math.max(0, idx - 1)];
        p.goldMills = 0; p.goldCarry = 0;
        p.housingId = lower;
        Sim.refresh(state, ctx);
        emit(ctx, { type: 'evicted', id: lower });
      }
    }

    // ---- Planificador Vital
    if (state.planner.rules.length && ctx.mods.plannerUnlocked) Sim.runPlanner(state, ctx);
  };

  // ------------------------------------------------------------------ PLANNER
  Sim.conditionMet = (state, cond) => {
    const v = +cond.value;
    switch (cond.type) {
      case 'age': return F.age(state) >= v;
      case 'jobLevel': return !!state.jobs[cond.target] && state.jobs[cond.target].level >= v;
      case 'skillLevel': return !!state.skills[cond.target] && state.skills[cond.target].level >= v;
      case 'gold': return U.gold(state.player) >= v;
      default: return false;
    }
  };

  /**
   * Reglas en orden; cada una se dispara UNA vez por vida cuando su condición se
   * cumple y la acción es posible (si el objetivo sigue bloqueado o no hay fianza,
   * la regla espera). Sólo cuentan las primeras `plannerSlots` reglas.
   */
  Sim.runPlanner = (state, ctx) => {
    const rules = state.planner.rules;
    const slots = ctx.mods.plannerSlots;
    for (let i = 0; i < rules.length && i < slots; i++) {
      const r = rules[i];
      if (!r.enabled || r.fired || !Sim.conditionMet(state, r.cond)) continue;
      let ok = false;
      if (r.action.type === 'job') ok = state.player.activeJobId === r.action.target || Sim.setActive(state, ctx, 'job', r.action.target);
      else if (r.action.type === 'skill') ok = state.player.activeSkillId === r.action.target || Sim.setActive(state, ctx, 'skill', r.action.target);
      else if (r.action.type === 'housing') ok = state.player.housingId === r.action.target || Sim.moveHousing(state, ctx, r.action.target).ok;
      if (ok) {
        r.fired = true;
        emit(ctx, { type: 'planner', rule: r });
      }
    }
  };

  // ---------------------------------------------------------- MUERTE / RENACER
  /** Congela la recompensa en el momento de la muerte (no cambia si luego tocas el árbol). */
  Sim.buildSummary = (state, ctx, cause) => ({
    cause,
    age: F.age(state),
    totalLevels: F.totalLevels(state),
    records: F.newRecordLevels(state),
    karma: F.pendingKarma(state, ctx.mods),
    echoGain: F.echoGain(state, ctx.mods),
    gold: state.player.lifeGoldEarned,
    realSeconds: state.stats.realSecondsLife,
  });

  Sim.die = (state, ctx, cause) => {
    const p = state.player;
    if (!p.isAlive) return;
    p.isAlive = false;
    p.deathSummary = Sim.buildSummary(state, ctx, cause);
    emit(ctx, { type: 'death', summary: p.deathSummary });
  };

  Sim.reincarnate = (state, ctx) => {
    const p = state.player;
    const summary = p.deathSummary || Sim.buildSummary(state, ctx, 'voluntary');

    // La memoria se consolida AL RENACER (en v1 se actualizaba en vivo y la
    // "memoria de vidas pasadas" aceleraba la vida actual: bucle de retroalimentación).
    const consolidate = (states) => {
      for (const id in states) {
        const s = states[id];
        s.pastMax = Math.max(s.pastMax, s.level);
        s.level = 0;
        s.xp = 0;
        s.unlocked = false;
      }
    };
    consolidate(state.jobs);
    consolidate(state.skills);

    p.karma += summary.karma;
    p.totalKarmaEarned += summary.karma;
    p.soulEcho *= 1 + summary.echoGain;
    p.reincarnationCount++;
    p.lifeDays = 0;
    p.goldMills = 0;
    p.goldCarry = 0;
    p.lifeGoldEarned = 0;
    p.isAlive = true;
    p.activeJobId = 'beggar';
    p.activeSkillId = 'meditation';
    p.housingId = 'street';
    p.deliriumClock = 0;
    p.conditions = [];
    p.deathSummary = null;

    const st = state.stats;
    st.bestTotalLevels = Math.max(st.bestTotalLevels, summary.totalLevels);
    st.bestAge = Math.max(st.bestAge, summary.age);
    st.lives.push({
      n: p.reincarnationCount, age: +summary.age.toFixed(1), levels: summary.totalLevels,
      karma: summary.karma, echo: +(summary.echoGain * 100).toFixed(1), secs: Math.round(summary.realSeconds),
    });
    if (st.lives.length > 20) st.lives.shift();
    st.realSecondsLife = 0;

    // Keystones: se sellan en este nacimiento.
    state.tree.activeKeystones = state.tree.allocated.filter((id) => CT.LATTICE_BY_ID[id] && CT.LATTICE_BY_ID[id].type === 'keystone');
    for (const r of state.planner.rules) r.fired = false;

    state.jobs.beggar.unlocked = true;
    state.skills.meditation.unlocked = true;
    state.skills.swordsmanship.unlocked = true;
    Sim.refresh(state, ctx);
    Sim.checkUnlocks(state, ctx);
    emit(ctx, { type: 'reincarnate', summary });
    return summary;
  };

  /**
   * Avance masivo (offline, pestaña en segundo plano, simulador).
   * Usa pasos grandes con valor esperado para el Eureka. Se detiene al morir,
   * salvo que la Rueda del Samsara tenga activada la reencarnación automática.
   */
  Sim.advance = (state, ctx, totalDays, opts = {}) => {
    const maxStep = opts.maxStep || 2;
    let remaining = totalDays;
    let lives = 0;
    const prevBulk = ctx.bulk;
    ctx.bulk = opts.bulk !== undefined ? opts.bulk : true;
    while (remaining > 1e-9) {
      if (!state.player.isAlive) {
        if (opts.autoReincarnate && ctx.mods.autoReincarnateUnlocked && state.planner.autoReincarnate) {
          Sim.reincarnate(state, ctx);
          lives++;
        } else break;
      }
      const dt = Math.min(maxStep, remaining);
      Sim.step(state, ctx, dt);
      remaining -= dt;
    }
    ctx.bulk = prevBulk;
    return { simulatedDays: totalDays - Math.max(0, remaining), lives };
  };

  CT.Sim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
