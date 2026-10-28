/**
 * CHRONO TRANSCENDENCE — Estado de partida por defecto (esquema v2).
 * Cualquier campo nuevo debe añadirse aquí: save.js fusiona los saves antiguos
 * con este esquema, de modo que nunca falte una clave tras una actualización.
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});

  function taskState(unlocked) {
    return { level: 0, xp: 0, pastMax: 0, unlocked, discovered: unlocked };
  }

  CT.createDefaultState = function createDefaultState() {
    const jobs = {}, skills = {};
    for (const id in CT.JOBS) jobs[id] = taskState(CT.JOBS[id].requires.length === 0);
    for (const id in CT.SKILLS) skills[id] = taskState(CT.SKILLS[id].requires.length === 0);

    return {
      version: CT.SAVE_VERSION,
      player: {
        lifeDays: 0, // días biológicos vividos en esta encarnación (afectados por agingRate)
        isAlive: true,
        goldMills: 0, // oro ×1000 en entero (ver utils.addGold)
        goldCarry: 0,
        lifeGoldEarned: 0,
        karma: 0,
        totalKarmaEarned: 0,
        soulEcho: 1, // multiplicador global de XP acumulado por vidas (Eco Álmico)
        reincarnationCount: 0,
        activeJobId: 'beggar',
        activeSkillId: 'meditation',
        housingId: 'street',
        deliriumClock: 0,
        conditions: [], // condiciones de senescencia activas (para avisos de entrada)
        deathSummary: null,
      },
      jobs,
      skills,
      tree: {
        allocated: [CT.LATTICE_ROOT],
        activeKeystones: [], // keystones sellados en el nacimiento actual
      },
      planner: {
        rules: [], // { id, enabled, cond:{type,target,value}, action:{type,target}, fired }
        autoReincarnate: false,
        nextId: 1,
      },
      stats: {
        realSecondsTotal: 0,
        realSecondsLife: 0,
        bestTotalLevels: 0,
        bestAge: 0,
        lives: [], // historial corto de vidas (últimas 20) para el Grimorio
      },
      settings: {
        soundEnabled: true,
        particlesEnabled: true,
        timeScale: 1,
        isPaused: false,
      },
      meta: {
        lastSavedAt: Date.now(),
        createdAt: Date.now(),
      },
    };
  };

  CT.taskDef = (id) => CT.JOBS[id] || CT.SKILLS[id] || null;
  CT.taskState = (state, id) => state.jobs[id] || state.skills[id] || null;
  CT.isJob = (id) => !!CT.JOBS[id];
})(typeof window !== 'undefined' ? window : globalThis);
