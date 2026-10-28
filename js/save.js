/**
 * CHRONO TRANSCENDENCE — Persistencia robusta.
 *
 *  - Sobre versionado { v, t, crc, data }: el hash detecta saves truncados o corruptos.
 *  - Ranura de respaldo: antes de sobrescribir, el save válido anterior pasa a _backup.
 *  - Saneado completo: cada campo se fusiona con el esquema por defecto y se coerciona
 *    (números finitos, ids existentes, nodos conectados). Un save importado o antiguo
 *    nunca puede dejar NaN, ids inexistentes o HTML inyectado en el estado.
 *  - Migración desde el prototipo v1 (clave "chrono_transcendence_save").
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});
  const U = CT.U;
  const B = CT.BALANCE;

  const Save = {};
  const EXPORT_PREFIX = 'CT2:';

  const storage = () => {
    try { return root.localStorage || null; } catch (e) { return null; } // SecurityError con cookies bloqueadas
  };

  Save.envelope = (state) => {
    const data = JSON.stringify(state);
    return JSON.stringify({ v: CT.SAVE_VERSION, t: Date.now(), crc: U.hash(data), data });
  };

  /** Devuelve el estado (sin sanear) contenido en un sobre, o lanza si está corrupto. */
  Save.openEnvelope = (text) => {
    const env = JSON.parse(text);
    if (!env || typeof env.data !== 'string') throw new Error('Sobre de guardado inválido');
    if (U.hash(env.data) !== env.crc) throw new Error('Checksum incorrecto (save corrupto)');
    return JSON.parse(env.data);
  };

  /** Guarda. Devuelve { ok, error }. */
  Save.write = (state) => {
    const ls = storage();
    if (!ls) return { ok: false, error: 'localStorage no disponible' };
    state.meta.lastSavedAt = Date.now();
    try {
      const prev = ls.getItem(CT.SAVE_KEY);
      if (prev) {
        try { Save.openEnvelope(prev); ls.setItem(CT.SAVE_BACKUP_KEY, prev); } catch (e) { /* no respaldar basura */ }
      }
      ls.setItem(CT.SAVE_KEY, Save.envelope(state));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'Almacenamiento lleno' : String(e) };
    }
  };

  /**
   * Carga con cascada: principal → respaldo → prototipo v1 → partida nueva.
   * Devuelve { state, source, warnings[] }.
   */
  Save.read = () => {
    const ls = storage();
    const warnings = [];
    if (!ls) return { state: CT.createDefaultState(), source: 'new', warnings: ['localStorage no disponible: la partida no se guardará.'] };

    for (const [key, label] of [[CT.SAVE_KEY, 'main'], [CT.SAVE_BACKUP_KEY, 'backup']]) {
      let raw = null;
      try { raw = ls.getItem(key); } catch (e) { /* ignorar */ }
      if (!raw) continue;
      try {
        const state = Save.sanitize(Save.openEnvelope(raw), warnings);
        if (label === 'backup') warnings.push('El guardado principal estaba dañado; se ha restaurado la copia de respaldo.');
        return { state, source: label, warnings };
      } catch (e) {
        warnings.push(`Guardado ${label === 'main' ? 'principal' : 'de respaldo'} ilegible (${e.message}).`);
        try { ls.setItem(CT.SAVE_KEY + '_corrupt_' + label, raw); } catch (e2) { /* sin espacio */ }
      }
    }

    try {
      const legacy = ls.getItem(CT.LEGACY_SAVE_KEY);
      if (legacy) {
        const state = Save.migrateV1(JSON.parse(legacy), warnings);
        return { state, source: 'v1', warnings };
      }
    } catch (e) {
      warnings.push('No se pudo migrar la partida del prototipo v1.');
    }
    return { state: CT.createDefaultState(), source: 'new', warnings };
  };

  Save.clear = () => {
    const ls = storage();
    if (!ls) return;
    for (const k of [CT.SAVE_KEY, CT.SAVE_BACKUP_KEY, CT.LEGACY_SAVE_KEY]) {
      try { ls.removeItem(k); } catch (e) { /* ignorar */ }
    }
  };

  Save.exportString = (state) => EXPORT_PREFIX + U.toBase64(Save.envelope(state));

  Save.importString = (text) => {
    const warnings = [];
    let s = String(text || '').trim();
    if (s.startsWith(EXPORT_PREFIX)) {
      return { state: Save.sanitize(Save.openEnvelope(U.fromBase64(s.slice(EXPORT_PREFIX.length))), warnings), warnings };
    }
    // Formato v1: base64 de JSON plano.
    const legacy = JSON.parse(U.fromBase64(s));
    if (legacy && legacy.player && legacy.jobs && !legacy.tree) return { state: Save.migrateV1(legacy, warnings), warnings };
    return { state: Save.sanitize(legacy, warnings), warnings };
  };

  // ------------------------------------------------------------------ SANEADO
  const bool = (v, def) => (typeof v === 'boolean' ? v : def);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = (v) => (Array.isArray(v) ? v : []);

  Save.sanitize = (raw, warnings = []) => {
    raw = obj(raw);
    if (!raw.player || !raw.jobs) throw new Error('Estructura de partida desconocida');
    const s = CT.createDefaultState();
    const rp = obj(raw.player), p = s.player;

    p.lifeDays = U.num(rp.lifeDays, 0, 0, 1e9);
    p.isAlive = bool(rp.isAlive, true);
    p.goldMills = U.int(rp.goldMills, 0, 0);
    p.goldCarry = U.num(rp.goldCarry, 0, -U.MONEY_SCALE, U.MONEY_SCALE);
    p.lifeGoldEarned = U.num(rp.lifeGoldEarned, 0, 0);
    p.karma = U.int(rp.karma, 0, 0);
    p.totalKarmaEarned = U.int(rp.totalKarmaEarned, p.karma, 0);
    p.soulEcho = U.num(rp.soulEcho, 1, 1, 1e300);
    p.reincarnationCount = U.int(rp.reincarnationCount, 0, 0);
    p.housingId = CT.HOUSING[rp.housingId] ? rp.housingId : 'street';
    p.deliriumClock = U.num(rp.deliriumClock, 0, 0, 1e6);
    p.conditions = arr(rp.conditions).filter((c) => CT.CONDITIONS[c]);

    const copyTasks = (defs, from, to) => {
      from = obj(from);
      for (const id in defs) {
        const r = obj(from[id]), t = to[id];
        t.level = U.int(r.level, 0, 0, 1e6);
        t.xp = U.num(r.xp, 0, 0);
        t.pastMax = U.int(r.pastMax, 0, 0, 1e6);
        t.unlocked = bool(r.unlocked, t.unlocked);
        t.discovered = bool(r.discovered, t.unlocked) || t.unlocked;
      }
    };
    copyTasks(CT.JOBS, raw.jobs, s.jobs);
    copyTasks(CT.SKILLS, raw.skills, s.skills);
    s.jobs.beggar.unlocked = s.skills.meditation.unlocked = s.skills.swordsmanship.unlocked = true;

    p.activeJobId = s.jobs[rp.activeJobId] && s.jobs[rp.activeJobId].unlocked ? rp.activeJobId : 'beggar';
    p.activeSkillId = s.skills[rp.activeSkillId] && s.skills[rp.activeSkillId].unlocked ? rp.activeSkillId : 'meditation';

    // Muerte guardada: se conserva el resumen congelado (si falta, el motor lo recalcula).
    const ds = rp.deathSummary;
    if (!p.isAlive && ds && typeof ds === 'object') {
      p.deathSummary = {
        cause: String(ds.cause || 'senescence').slice(0, 20),
        age: U.num(ds.age, B.START_AGE, 0, 1e6), totalLevels: U.int(ds.totalLevels, 0),
        records: U.int(ds.records, 0), karma: U.int(ds.karma, 0),
        echoGain: U.num(ds.echoGain, 0, 0, 1), gold: U.num(ds.gold, 0, 0), realSeconds: U.num(ds.realSeconds, 0, 0),
      };
    }

    // Árbol: ids válidos, sin duplicados y conectados a la raíz (reembolsa huérfanos).
    const rt = obj(raw.tree);
    const wanted = new Set(arr(rt.allocated).filter((id) => CT.LATTICE_BY_ID[id]));
    wanted.add(CT.LATTICE_ROOT);
    const connected = new Set([CT.LATTICE_ROOT]);
    const queue = [CT.LATTICE_ROOT];
    while (queue.length) {
      for (const c of CT.LATTICE_BY_ID[queue.shift()].connections) {
        if (wanted.has(c) && !connected.has(c)) { connected.add(c); queue.push(c); }
      }
    }
    let refund = 0;
    for (const id of wanted) if (!connected.has(id)) refund += CT.LATTICE_BY_ID[id].cost;
    if (refund) { p.karma += refund; warnings.push(`Nodos desconectados reembolsados: +${refund} Karma.`); }
    s.tree.allocated = [...connected];
    s.tree.activeKeystones = arr(rt.activeKeystones).filter((id) => connected.has(id) && CT.LATTICE_BY_ID[id].type === 'keystone');

    // Planificador
    const rpl = obj(raw.planner);
    s.planner.autoReincarnate = bool(rpl.autoReincarnate, false);
    s.planner.nextId = U.int(rpl.nextId, 1, 1);
    s.planner.rules = arr(rpl.rules).slice(0, 30).map(Save.sanitizeRule).filter(Boolean);
    for (const r of s.planner.rules) s.planner.nextId = Math.max(s.planner.nextId, r.id + 1);

    // Estadísticas
    const rs = obj(raw.stats);
    s.stats.realSecondsTotal = U.num(rs.realSecondsTotal, 0, 0);
    s.stats.realSecondsLife = U.num(rs.realSecondsLife, 0, 0);
    s.stats.bestTotalLevels = U.int(rs.bestTotalLevels, 0);
    s.stats.bestAge = U.num(rs.bestAge, 0, 0, 1e6);
    s.stats.lives = arr(rs.lives).slice(-20).map((l) => ({
      n: U.int(l && l.n, 0), age: U.num(l && l.age, 0, 0), levels: U.int(l && l.levels, 0),
      karma: U.int(l && l.karma, 0), echo: U.num(l && l.echo, 0, 0, 100), secs: U.num(l && l.secs, 0, 0),
    }));

    const rset = obj(raw.settings);
    s.settings.soundEnabled = bool(rset.soundEnabled, true);
    s.settings.particlesEnabled = bool(rset.particlesEnabled, true);
    s.settings.isPaused = bool(rset.isPaused, false);
    s.settings.timeScale = CT.DEV ? U.num(rset.timeScale, 1, 0, 1000) : 1;

    const rm = obj(raw.meta);
    s.meta.lastSavedAt = U.num(rm.lastSavedAt, Date.now(), 0);
    s.meta.createdAt = U.num(rm.createdAt, Date.now(), 0);
    // Reloj del sistema adelantado/atrasado: nunca un lastSavedAt futuro.
    if (s.meta.lastSavedAt > Date.now()) s.meta.lastSavedAt = Date.now();
    return s;
  };

  Save.CONDITION_TYPES = ['age', 'jobLevel', 'skillLevel', 'gold'];
  Save.ACTION_TYPES = ['job', 'skill', 'housing'];

  Save.sanitizeRule = (r) => {
    r = obj(r);
    const c = obj(r.cond), a = obj(r.action);
    if (!Save.CONDITION_TYPES.includes(c.type) || !Save.ACTION_TYPES.includes(a.type)) return null;
    if (c.type === 'jobLevel' && !CT.JOBS[c.target]) return null;
    if (c.type === 'skillLevel' && !CT.SKILLS[c.target]) return null;
    const validTarget = a.type === 'job' ? CT.JOBS[a.target] : a.type === 'skill' ? CT.SKILLS[a.target] : CT.HOUSING[a.target];
    if (!validTarget) return null;
    return {
      id: U.int(r.id, 1, 1),
      enabled: bool(r.enabled, true),
      cond: { type: c.type, target: c.type.endsWith('Level') ? c.target : null, value: U.num(c.value, 0, 0, 1e12) },
      action: { type: a.type, target: a.target },
      fired: bool(r.fired, false),
    };
  };

  /** Prototipo v1 → v2. Las curvas cambiaron, así que se convierte con prudencia. */
  Save.migrateV1 = (old, warnings) => {
    const s = CT.createDefaultState();
    const op = obj(old.player);
    s.player.reincarnationCount = U.int(op.reincarnationCount, 0, 0, 1000);
    let refund = 0;
    const oldCosts = { iron_veins: 2, honed_instincts: 4, muscle_memory: 8, inner_focus: 2, mana_circulation: 4, celestial_affinity: 8,
      transmuted_longevity: 3, alchemical_synthesis: 5, astral_resonance: 10, death_pact: 12, chronos_mastery: 15 };
    for (const id of arr(obj(old.celestialTree).allocatedNodes)) refund += oldCosts[id] || 0;
    s.player.karma = Math.min(150, U.int(op.karma, 0, 0) + refund);
    s.player.totalKarmaEarned = s.player.karma;
    for (const [defs, from, to] of [[CT.JOBS, obj(old.jobs), s.jobs], [CT.SKILLS, obj(old.skills), s.skills]]) {
      for (const id in defs) {
        const r = obj(from[id]);
        const best = Math.max(U.int(r.pastMaxLevel, 0), U.int(r.level, 0));
        to[id].pastMax = Math.min(30, best); // las curvas v1 estaban infladas
        to[id].discovered = to[id].discovered || best > 0;
      }
    }
    warnings.push(`Partida del prototipo v1 migrada: ${s.player.karma} Karma reembolsado, récords limitados a Lv 30. Empiezas una nueva vida con el nuevo equilibrio.`);
    return s;
  };

  CT.Save = Save;
})(typeof window !== 'undefined' ? window : globalThis);
