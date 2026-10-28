/**
 * CHRONO TRANSCENDENCE — Core Game Engine
 * Manages the game loop, aging, mortality, XP calculations, breakpoints, reincarnation, tooltips, and save system.
 */

class GameEngine {
  constructor() {
    this.state = createDefaultGameState();
    this.lastFrameTime = performance.now();
    this.autoSaveTimer = 0;
    this.cachedModifiers = {};
    this.chronicleFeed = [];

    // DOM Elements Cache
    this.dom = {};
  }

  init() {
    this.cacheDomElements();
    this.loadGame();
    this.recalculateAllModifiers();

    // Initialize Lattice Skill Tree
    this.lattice = new CelestialLattice('lattice-canvas', this);

    // Initialize Tabs, Buttons, & Tooltips
    this.initTabNavigation();
    this.initControls();
    this.initGlobalTooltips();
    this.renderInitialUI();

    // Start Animation / Loop
    requestAnimationFrame((t) => this.loop(t));

    this.addChronicle('El ciclo vital despierta. Sientes el flujo del tiempo consumiendo tus días terrenales.');
  }

  cacheDomElements() {
    this.dom.playerAge = document.getElementById('player-age');
    this.dom.playerMaxAge = document.getElementById('player-max-age');
    this.dom.ageProgressBar = document.getElementById('age-progress-bar');
    this.dom.mortalityWarning = document.getElementById('mortality-warning');

    this.dom.playerGold = document.getElementById('player-gold');
    this.dom.netIncomeLabel = document.getElementById('net-income-label');
    this.dom.currentHousingName = document.getElementById('current-housing-name');

    this.dom.playerKarma = document.getElementById('player-karma');
    this.dom.pendingKarma = document.getElementById('pending-karma');
    this.dom.latticeKarmaDisplay = document.getElementById('lattice-karma-display');
    this.dom.reincarnationBadge = document.getElementById('reincarnation-badge');

    this.dom.jobsList = document.getElementById('jobs-list');
    this.dom.skillsList = document.getElementById('skills-list');
    this.dom.housingList = document.getElementById('housing-list');

    this.dom.valStr = document.getElementById('val-str');
    this.dom.valInt = document.getElementById('val-int');
    this.dom.valVit = document.getElementById('val-vit');
    this.dom.valArc = document.getElementById('val-arc');

    this.dom.mathXpRate = document.getElementById('math-xp-rate');
    this.dom.mathFormulaDetails = document.getElementById('math-formula-details');
    this.dom.chronicleFeed = document.getElementById('chronicle-feed');

    this.dom.deathModal = document.getElementById('death-modal');
    this.dom.deathCauseText = document.getElementById('death-cause-text');
    this.dom.deathLevelsStat = document.getElementById('death-levels-stat');
    this.dom.deathKarmaStat = document.getElementById('death-karma-stat');
    this.dom.deathMemoryStat = document.getElementById('death-memory-stat');

    this.dom.summaryAge = document.getElementById('summary-age');
    this.dom.summaryHighestJob = document.getElementById('summary-highest-job');
    this.dom.summaryHighestSkill = document.getElementById('summary-highest-skill');
    this.dom.summaryTotalGold = document.getElementById('summary-total-gold');
    this.dom.summaryKarmaGain = document.getElementById('summary-karma-gain');
    this.dom.soulMemoryList = document.getElementById('soul-memory-list');

    this.dom.activeJobIndicator = document.getElementById('active-job-indicator');
    this.dom.activeSkillIndicator = document.getElementById('active-skill-indicator');
    this.dom.globalTooltip = document.getElementById('global-tooltip');
    this.dom.tooltipTitle = document.getElementById('tooltip-title');
    this.dom.tooltipBody = document.getElementById('tooltip-body');
    this.dom.tooltipFormula = document.getElementById('tooltip-formula');
  }

  initTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        window.Sound.playClick();
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetPane = document.getElementById(tab.dataset.tab);
        if (targetPane) {
          targetPane.classList.add('active');
          if (tab.dataset.tab === 'tab-lattice') {
            this.lattice.resizeCanvas();
            this.lattice.recenterView();
          }
          if (tab.dataset.tab === 'tab-reincarnation') {
            this.updateReincarnationTabUI();
          }
        }
      });
    });
  }

  initControls() {
    // Time controls
    document.getElementById('btn-pause')?.addEventListener('click', (e) => {
      this.state.player.isPaused = !this.state.player.isPaused;
      e.target.textContent = this.state.player.isPaused ? '▶' : '⏸';
      e.target.classList.toggle('active', this.state.player.isPaused);
      window.Sound.playClick();
    });

    [1, 2, 5].forEach(spd => {
      document.getElementById(`btn-speed-${spd}`)?.addEventListener('click', (e) => {
        this.state.player.timeScale = spd;
        document.querySelectorAll('.time-controls .btn-time').forEach(b => {
          if (b.dataset.speed) b.classList.remove('active');
        });
        e.target.classList.add('active');
        window.Sound.playClick();
      });
    });

    document.getElementById('btn-audio-toggle')?.addEventListener('click', (e) => {
      const enabled = window.Sound.toggle();
      e.target.textContent = enabled ? '🔊' : '🔇';
    });

    // Reincarnate buttons
    document.getElementById('btn-modal-reincarnate')?.addEventListener('click', () => {
      this.reincarnate();
    });

    document.getElementById('btn-voluntary-reincarnate')?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas inmolar tu recipiente mortal voluntariamente?')) {
        this.reincarnate();
      }
    });

    // Persistence buttons
    document.getElementById('btn-manual-save')?.addEventListener('click', () => {
      this.saveGame();
      alert('✓ Partida guardada con éxito en el almacenamiento local.');
    });

    document.getElementById('btn-export-save')?.addEventListener('click', () => {
      const dataStr = btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));
      navigator.clipboard.writeText(dataStr).then(() => {
        alert('✓ Partida copiada al portapapeles en formato Base64.');
      }).catch(() => {
        prompt('Copia tu partida exportada:', dataStr);
      });
    });

    document.getElementById('btn-import-save')?.addEventListener('click', () => {
      const raw = prompt('Pega aquí tu clave de partida codificada en Base64:');
      if (raw) {
        try {
          const parsed = JSON.parse(decodeURIComponent(escape(atob(raw.trim()))));
          if (parsed.player && parsed.jobs) {
            this.state = parsed;
            this.recalculateAllModifiers();
            this.renderInitialUI();
            alert('✓ Partida importada con éxito.');
          } else {
            alert('El formato de guardado no es válido.');
          }
        } catch (e) {
          alert('Error al descifrar la clave de guardado.');
        }
      }
    });

    document.getElementById('btn-hard-reset')?.addEventListener('click', () => {
      if (confirm('ADVERTENCIA: ¿Estás seguro de destruir el alma para siempre? Perderás todo el Karma, nodos y multiplicadores.')) {
        localStorage.removeItem('chrono_transcendence_save');
        location.reload();
      }
    });
  }

  // =========================================================================
  // CORE CALCULATION ENGINE & FORMULAS
  // =========================================================================

  getXpNeeded(level, baseXp) {
    // Exact requested formula: XP_necesaria = Base * (Nivel ^ 2.8)
    const exponent = GAME_CONSTANTS.XP_EXPONENT;
    const costMult = this.hasAllocatedNode('celestial_affinity') ? 0.85 : 1.0;
    return Math.max(baseXp, Math.floor(baseXp * Math.pow(level + 1, exponent) * costMult));
  }

  hasAllocatedNode(nodeId) {
    return this.state.celestialTree.allocatedNodes.includes(nodeId);
  }

  recalculateAllModifiers() {
    const p = this.state.player;
    const mods = {
      globalXp: 1.0,
      physicalXp: 1.0,
      intellectualXp: 1.0,
      arcaneXp: 1.0,
      goldMult: 1.0,
      maxAge: GAME_CONSTANTS.BASE_MAX_AGE,
      agingThreshold: GAME_CONSTANTS.BASE_AGING_THRESHOLD,
      karmaMult: 1.0,
      eurekaChance: 0.03, // 3% base
      housingDiscount: 1.0
    };

    // 1. Celestial Lattice Nodes Modifiers
    if (this.hasAllocatedNode('root_awakening')) mods.globalXp += 0.20;
    if (this.hasAllocatedNode('iron_veins')) mods.maxAge += 5;
    if (this.hasAllocatedNode('honed_instincts')) mods.physicalXp += 0.30;
    if (this.hasAllocatedNode('inner_focus')) mods.intellectualXp += 0.35;
    if (this.hasAllocatedNode('mana_circulation')) mods.goldMult += 0.25;
    if (this.hasAllocatedNode('transmuted_longevity')) mods.agingThreshold += 10;
    if (this.hasAllocatedNode('alchemical_synthesis')) mods.goldMult += 0.40;
    if (this.hasAllocatedNode('chronos_mastery')) mods.eurekaChance += 0.07;

    // Keystone: Pacto con la Muerte
    if (this.hasAllocatedNode('death_pact')) {
      mods.maxAge = Math.floor(mods.maxAge * 0.5);
      mods.karmaMult *= 4.0;
    }

    // Astral Resonance (Scales with past reincarnations)
    if (this.hasAllocatedNode('astral_resonance')) {
      mods.globalXp += (p.reincarnationCount * 0.08);
    }

    // 2. Housing Modifiers
    const housing = HOUSING_DATA[p.housingId] || HOUSING_DATA.tent;
    mods.maxAge += housing.healthBonusYears;
    mods.globalXp *= housing.xpMultiplier;

    // 3. Breakpoint Passives from Jobs & Skills
    // Beggar
    if (this.state.jobs.beggar.level >= 10) mods.housingDiscount *= 0.85;
    if (this.state.jobs.beggar.level >= 50) mods.goldMult += 0.25;
    // Laborer
    if (this.state.jobs.laborer.level >= 25) mods.maxAge += 3;
    // Guard
    if (this.state.jobs.guard.level >= 10) mods.physicalXp += 0.25;
    if (this.state.jobs.guard.level >= 25) mods.goldMult += 0.25;
    if (this.state.jobs.guard.level >= 50) mods.maxAge += 5;
    // Alchemist
    if (this.state.jobs.alchemist_apprentice.level >= 10) mods.goldMult += 0.35;
    if (this.state.jobs.alchemist_apprentice.level >= 25) mods.maxAge += 6;
    if (this.state.jobs.alchemist_apprentice.level >= 50) mods.karmaMult += 0.30;

    // Meditation
    if (this.state.skills.meditation.level >= 10) mods.maxAge += 2;
    if (this.state.skills.meditation.level >= 25) mods.eurekaChance += 0.05;
    if (this.state.skills.meditation.level >= 50) mods.globalXp += 0.30;
    // Swordsmanship
    if (this.state.skills.swordsmanship.level >= 10) mods.physicalXp += 0.15;
    // Concentration
    if (this.state.skills.concentration.level >= 10) mods.intellectualXp += 0.20;
    if (this.state.skills.concentration.level >= 50) mods.globalXp += 0.40;
    // Arcane Math
    if (this.state.skills.arcane_mathematics.level >= 10) mods.karmaMult += 0.20;
    if (this.state.skills.arcane_mathematics.level >= 50) mods.maxAge += 10;

    // 4. Update Attributes
    p.attributes.strength = 1.0 + (this.state.skills.swordsmanship.level * 0.05) +
      (this.state.jobs.laborer.level >= 10 ? 0.15 : 0) +
      (this.state.skills.swordsmanship.level >= 25 ? 0.25 : 0);

    p.attributes.intellect = 1.0 + (this.state.skills.concentration.level * 0.05) +
      (this.state.skills.concentration.level >= 25 ? 0.25 : 0);

    p.attributes.vitality = 1.0 + (this.state.jobs.laborer.level * 0.03);

    p.attributes.arcana = 1.0 + (this.state.skills.arcane_mathematics.level * 0.06) +
      (this.state.skills.arcane_mathematics.level >= 25 ? 0.35 : 0);

    // Notable Synergy: Muscle Memory (Fuerza escala estudio intelectual)
    if (this.hasAllocatedNode('muscle_memory')) {
      const bonusIntellectXp = (p.attributes.strength - 1.0) * 0.20;
      mods.intellectualXp += Math.max(0, bonusIntellectXp);
    }

    p.maxAge = mods.maxAge;
    this.cachedModifiers = mods;
  }

  getLegacyMultiplier(id) {
    const item = this.state.jobs[id] || this.state.skills[id];
    if (!item) return 1.0;
    // 1 + (maxLevelReachedInPastRuns * 0.15)
    return 1.0 + (item.pastMaxLevel * 0.15);
  }

  getPhysicalDebuff() {
    const age = this.state.player.age;
    const threshold = this.cachedModifiers.agingThreshold || GAME_CONSTANTS.BASE_AGING_THRESHOLD;
    if (age <= threshold) return 1.0;

    // Efficacy drops by 2.5% per year past threshold, down to minimum 20%
    const yearsPast = age - threshold;
    const debuff = Math.max(0.20, 1.0 - (yearsPast * 0.025));
    return debuff;
  }

  calculatePendingKarma() {
    let totalLevels = 0;
    for (const j in this.state.jobs) totalLevels += this.state.jobs[j].level;
    for (const s in this.state.skills) totalLevels += this.state.skills[s].level;

    if (totalLevels < 5) return 0;

    const base = Math.pow(totalLevels, 1.15) / 6.0;
    const total = Math.floor(base * this.cachedModifiers.karmaMult);
    return Math.max(1, total);
  }

  // =========================================================================
  // MAIN LOOP
  // =========================================================================

  loop(currentTime) {
    const deltaMs = Math.min(1000, currentTime - this.lastFrameTime);
    this.lastFrameTime = currentTime;

    if (this.state.player.isAlive && !this.state.player.isPaused) {
      const effectiveDeltaSec = (deltaMs / 1000) * this.state.player.timeScale;
      this.updateSimulation(effectiveDeltaSec);
    }

    // Render Canvas Skill Tree if tab is active
    if (document.getElementById('tab-lattice').classList.contains('active')) {
      this.lattice.render();
    }

    // Auto-save interval check
    this.autoSaveTimer += deltaMs / 1000;
    if (this.autoSaveTimer >= this.state.settings.autoSaveIntervalSec) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  updateSimulation(deltaSec) {
    const p = this.state.player;
    p.timePlayedTotal += deltaSec;
    p.timePlayedCurrentLife += deltaSec;

    // Time & Aging
    // 1 second real time at 1x = 1 game day. 12 days = 1 year.
    const gameDaysPassed = deltaSec; // 1s = 1 day
    p.daySubProgress += gameDaysPassed;

    const yearsPassed = gameDaysPassed / GAME_CONSTANTS.DAYS_PER_YEAR;
    p.age += yearsPassed;

    // Check Mortality
    if (p.age >= p.maxAge) {
      this.triggerDeath('senescencia');
      return;
    }

    // Check unlocks of jobs and skills
    this.checkUnlockRequirements();

    // Active Job Progress & Gold
    const activeJob = JOBS_DATA[p.activeJobId];
    if (activeJob) {
      this.processJobProgress(activeJob, deltaSec, gameDaysPassed);
    }

    // Active Skill Progress
    const activeSkill = SKILLS_DATA[p.activeSkillId];
    if (activeSkill) {
      this.processSkillProgress(activeSkill, deltaSec);
    }

    // Housing Expenses
    const housing = HOUSING_DATA[p.housingId] || HOUSING_DATA.tent;
    const housingCost = housing.costPerDay * this.cachedModifiers.housingDiscount * gameDaysPassed;
    p.gold = Math.max(0, p.gold - housingCost);

    // Update Live Math and UI
    this.updateTopBarUI();
    this.updateLiveMathInspector();
  }

  processJobProgress(jobDef, deltaSec, daysPassed) {
    const jobState = this.state.jobs[jobDef.id];
    const physicalDebuff = jobDef.category === 'physical' ? this.getPhysicalDebuff() : 1.0;
    const legacyMult = this.getLegacyMultiplier(jobDef.id);

    let catMult = 1.0;
    if (jobDef.category === 'physical') catMult = this.cachedModifiers.physicalXp;
    else if (jobDef.category === 'arcane') catMult = this.cachedModifiers.arcaneXp;

    const totalXpRate = jobDef.baseXp * this.cachedModifiers.globalXp * catMult * legacyMult * physicalDebuff;
    const xpGain = totalXpRate * deltaSec;

    jobState.xp += xpGain;

    // Gold Gain
    const baseIncome = jobDef.baseIncome * this.cachedModifiers.goldMult;
    const incomeGain = baseIncome * daysPassed;
    this.state.player.gold += incomeGain;

    // Level up check
    let req = this.getXpNeeded(jobState.level, jobDef.baseXp);
    while (jobState.xp >= req) {
      jobState.xp -= req;
      jobState.level++;
      this.onTaskLevelUp(jobDef, jobState.level, 'job');
      req = this.getXpNeeded(jobState.level, jobDef.baseXp);
    }

    // Update Progress bar in DOM
    const bar = document.getElementById(`job-bar-${jobDef.id}`);
    if (bar) {
      const pct = Math.min(100, (jobState.xp / req) * 100);
      bar.style.width = `${pct}%`;
    }
    const lvlText = document.getElementById(`job-lvl-${jobDef.id}`);
    if (lvlText) lvlText.textContent = `Lv ${jobState.level}`;
  }

  processSkillProgress(skillDef, deltaSec) {
    const skillState = this.state.skills[skillDef.id];
    const physicalDebuff = skillDef.category === 'physical' ? this.getPhysicalDebuff() : 1.0;
    const legacyMult = this.getLegacyMultiplier(skillDef.id);

    let catMult = 1.0;
    if (skillDef.category === 'physical') catMult = this.cachedModifiers.physicalXp;
    else if (skillDef.category === 'intellect') catMult = this.cachedModifiers.intellectualXp;
    else if (skillDef.category === 'arcane') catMult = this.cachedModifiers.arcaneXp;

    const totalXpRate = skillDef.baseXp * this.cachedModifiers.globalXp * catMult * legacyMult * physicalDebuff;
    let xpGain = totalXpRate * deltaSec;

    // Eureka Critical Study Spark check (Chance per second)
    const eurekaRoll = Math.random();
    if (eurekaRoll < (this.cachedModifiers.eurekaChance * deltaSec)) {
      const eurekaBurst = xpGain * 5.0;
      xpGain += eurekaBurst;
      this.triggerEurekaEffect(skillDef.name, eurekaBurst);
    }

    skillState.xp += xpGain;

    // Level up check
    let req = this.getXpNeeded(skillState.level, skillDef.baseXp);
    while (skillState.xp >= req) {
      skillState.xp -= req;
      skillState.level++;
      this.onTaskLevelUp(skillDef, skillState.level, 'skill');
      req = this.getXpNeeded(skillState.level, skillDef.baseXp);
    }

    // Update Progress bar in DOM
    const bar = document.getElementById(`skill-bar-${skillDef.id}`);
    if (bar) {
      const pct = Math.min(100, (skillState.xp / req) * 100);
      bar.style.width = `${pct}%`;
    }
    const lvlText = document.getElementById(`skill-lvl-${skillDef.id}`);
    if (lvlText) lvlText.textContent = `Lv ${skillState.level}`;
  }

  onTaskLevelUp(def, newLevel, type) {
    window.Sound.playLevelUp();

    // Check Breakpoints
    if (def.breakpoints && def.breakpoints[newLevel]) {
      const bp = def.breakpoints[newLevel];
      this.addChronicle(`¡HITO DE MAESTRÍA! [${def.name}] alcanzó Lv ${newLevel}: "${bp.name}" — ${bp.desc}`, true);
      this.recalculateAllModifiers();
      this.renderOccupationsUI(); // Re-render to show milestone glow
    }

    // Update pastMaxLevel for permanent memory
    const stateObj = type === 'job' ? this.state.jobs[def.id] : this.state.skills[def.id];
    if (newLevel > stateObj.pastMaxLevel) {
      stateObj.pastMaxLevel = newLevel;
    }
  }

  triggerEurekaEffect(sourceName, amount) {
    window.Sound.playEureka();
    this.addChronicle(`¡EUREKA! Comprensión súbita en [${sourceName}] (+${amount.toFixed(1)} XP)`, true);

    const container = document.getElementById('eureka-container');
    if (!container) return;

    const spark = document.createElement('div');
    spark.className = 'eureka-spark';
    spark.textContent = `✦ Eureka! +${amount.toFixed(0)} XP`;
    spark.style.left = `${Math.random() * 40 + 30}%`;
    spark.style.top = `${Math.random() * 30 + 35}%`;
    container.appendChild(spark);

    setTimeout(() => spark.remove(), 1200);
  }

  checkUnlockRequirements() {
    // Check Jobs
    for (const id in JOBS_DATA) {
      const job = JOBS_DATA[id];
      const stateObj = this.state.jobs[id];
      if (stateObj.unlocked) continue;

      if (!job.requires) {
        stateObj.unlocked = true;
        this.renderOccupationsUI();
        continue;
      }

      let reqMet = true;
      if (job.requires.job && this.state.jobs[job.requires.job].level < job.requires.level) reqMet = false;
      if (job.requires.skill && this.state.skills[job.requires.skill].level < job.requires.level) reqMet = false;
      if (job.requires.jobLevel && this.state.jobs[job.requires.job].level < job.requires.jobLevel) reqMet = false;
      if (job.requires.skill2 && this.state.skills[job.requires.skill2].level < job.requires.level2) reqMet = false;
      if (job.requires.stat && this.state.player.attributes[job.requires.stat] < job.requires.minStat) reqMet = false;

      if (reqMet) {
        stateObj.unlocked = true;
        this.addChronicle(`¡Nuevo Trabajo desbloqueado: ${job.name}!`, true);
        this.renderOccupationsUI();
      }
    }

    // Check Skills
    for (const id in SKILLS_DATA) {
      const skill = SKILLS_DATA[id];
      const stateObj = this.state.skills[id];
      if (stateObj.unlocked) continue;

      if (!skill.requires) {
        stateObj.unlocked = true;
        this.renderOccupationsUI();
        continue;
      }

      let reqMet = true;
      if (skill.requires.skill && this.state.skills[skill.requires.skill].level < skill.requires.level) reqMet = false;

      if (reqMet) {
        stateObj.unlocked = true;
        this.addChronicle(`¡Nueva Disciplina desbloqueada: ${skill.name}!`, true);
        this.renderOccupationsUI();
      }
    }
  }

  // =========================================================================
  // MORTALITY & PRESTIGE (REINCARNATION)
  // =========================================================================

  triggerDeath(cause) {
    this.state.player.isAlive = false;
    window.Sound.playDeathBell();

    const pendingKarma = this.calculatePendingKarma();
    let totalLevels = 0;
    for (const j in this.state.jobs) totalLevels += this.state.jobs[j].level;
    for (const s in this.state.skills) totalLevels += this.state.skills[s].level;

    this.dom.deathCauseText.textContent = `Tu cuerpo mortal ha expirado a los ${this.state.player.age.toFixed(1)} años de edad.`;
    this.dom.deathLevelsStat.textContent = `${totalLevels} Niveles Cultivados`;
    this.dom.deathKarmaStat.textContent = `+${pendingKarma} Karma`;
    this.dom.deathMemoryStat.textContent = `+${(totalLevels * 0.15).toFixed(1)}% Multiplicador de Aprendizaje`;

    this.dom.deathModal.classList.remove('hidden');
    this.addChronicle(`Has fallecido a los ${this.state.player.age.toFixed(1)} años. El ciclo de la carne termina.`, true);
  }

  reincarnate() {
    window.Sound.playReincarnationChant();

    const p = this.state.player;
    const karmaGained = this.calculatePendingKarma();

    // Save max levels to pastMaxLevel
    for (const id in this.state.jobs) {
      this.state.jobs[id].pastMaxLevel = Math.max(this.state.jobs[id].pastMaxLevel, this.state.jobs[id].level);
      this.state.jobs[id].level = 0;
      this.state.jobs[id].xp = 0;
    }
    for (const id in this.state.skills) {
      this.state.skills[id].pastMaxLevel = Math.max(this.state.skills[id].pastMaxLevel, this.state.skills[id].level);
      this.state.skills[id].level = 0;
      this.state.skills[id].xp = 0;
    }

    p.reincarnationCount++;
    p.karma += karmaGained;
    p.totalKarmaEarned += karmaGained;
    p.age = GAME_CONSTANTS.BASE_START_AGE;
    p.gold = 0.0;
    p.isAlive = true;
    p.activeJobId = 'beggar';
    p.activeSkillId = 'meditation';
    p.housingId = 'tent';
    p.timePlayedCurrentLife = 0;

    this.dom.deathModal.classList.add('hidden');
    this.recalculateAllModifiers();
    this.renderOccupationsUI();
    this.renderHousingUI();
    this.updateTopBarUI();
    this.updateReincarnationTabUI();

    this.addChronicle(`¡RENACES en el Ciclo #${p.reincarnationCount + 1}! Tu alma retiene el legado de vidas pasadas y ${karmaGained} Puntos de Karma.`, true);
    this.saveGame();
  }

  // =========================================================================
  // UI RENDERING & TOOLTIPS
  // =========================================================================

  renderInitialUI() {
    this.renderOccupationsUI();
    this.renderHousingUI();
    this.updateTopBarUI();
    this.updateReincarnationTabUI();
  }

  renderOccupationsUI() {
    // Render Jobs
    this.dom.jobsList.innerHTML = '';
    for (const id in JOBS_DATA) {
      const job = JOBS_DATA[id];
      const jobState = this.state.jobs[id];
      if (!jobState.unlocked) continue;

      const card = document.createElement('div');
      const isActive = this.state.player.activeJobId === id;
      const masteryTier = jobState.level >= 50 ? 'mastery-tier-3' : (jobState.level >= 25 ? 'mastery-tier-2' : (jobState.level >= 10 ? 'mastery-tier-1' : ''));
      card.className = `task-card ${isActive ? 'active-task' : ''} ${masteryTier}`;

      const legacy = this.getLegacyMultiplier(id);
      const req = this.getXpNeeded(jobState.level, job.baseXp);
      const pct = Math.min(100, (jobState.xp / req) * 100);

      card.innerHTML = `
        <div class="task-card-header">
          <div class="task-title-wrap">
            <span class="task-icon">${job.icon}</span>
            <span class="task-name">${job.name}</span>
          </div>
          <span class="task-level-badge" id="job-lvl-${job.id}">Lv ${jobState.level}</span>
        </div>
        <div class="task-desc">${job.desc}</div>
        <div class="progress-bar-container">
          <div id="job-bar-${job.id}" class="progress-bar-fill fill-job" style="width: ${pct}%"></div>
        </div>
        <div class="task-yields">
          <span class="yield-income">+${(job.baseIncome * this.cachedModifiers.goldMult).toFixed(2)} Oro/día</span>
          <span class="yield-rate">Memoria: x${legacy.toFixed(2)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.state.player.activeJobId = id;
        window.Sound.playClick();
        this.renderOccupationsUI();
        this.dom.activeJobIndicator.textContent = `Activo: ${job.name}`;
      });

      this.attachDeepTooltip(card, job, 'job');
      this.dom.jobsList.appendChild(card);
    }

    // Render Skills
    this.dom.skillsList.innerHTML = '';
    for (const id in SKILLS_DATA) {
      const skill = SKILLS_DATA[id];
      const skillState = this.state.skills[id];
      if (!skillState.unlocked) continue;

      const card = document.createElement('div');
      const isActive = this.state.player.activeSkillId === id;
      const masteryTier = skillState.level >= 50 ? 'mastery-tier-3' : (skillState.level >= 25 ? 'mastery-tier-2' : (skillState.level >= 10 ? 'mastery-tier-1' : ''));
      card.className = `task-card ${isActive ? 'active-task' : ''} ${masteryTier}`;

      const legacy = this.getLegacyMultiplier(id);
      const req = this.getXpNeeded(skillState.level, skill.baseXp);
      const pct = Math.min(100, (skillState.xp / req) * 100);

      card.innerHTML = `
        <div class="task-card-header">
          <div class="task-title-wrap">
            <span class="task-icon">${skill.icon}</span>
            <span class="task-name">${skill.name}</span>
          </div>
          <span class="task-level-badge" id="skill-lvl-${skill.id}">Lv ${skillState.level}</span>
        </div>
        <div class="task-desc">${skill.desc}</div>
        <div class="progress-bar-container">
          <div id="skill-bar-${skill.id}" class="progress-bar-fill fill-skill" style="width: ${pct}%"></div>
        </div>
        <div class="task-yields">
          <span class="yield-rate">${skill.effectDesc}</span>
          <span class="yield-income">Memoria: x${legacy.toFixed(2)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.state.player.activeSkillId = id;
        window.Sound.playClick();
        this.renderOccupationsUI();
        this.dom.activeSkillIndicator.textContent = `Activo: ${skill.name}`;
      });

      this.attachDeepTooltip(card, skill, 'skill');
      this.dom.skillsList.appendChild(card);
    }
  }

  renderHousingUI() {
    this.dom.housingList.innerHTML = '';
    const currentId = this.state.player.housingId;

    for (const id in HOUSING_DATA) {
      const house = HOUSING_DATA[id];
      const isCurrent = currentId === id;

      const card = document.createElement('div');
      card.className = `housing-card ${isCurrent ? 'current' : ''}`;
      card.innerHTML = `
        <div class="housing-header">
          <h3 class="housing-title">${house.name}</h3>
          <span class="housing-cost">${(house.costPerDay * this.cachedModifiers.housingDiscount).toFixed(2)} Oro/día</span>
        </div>
        <p class="task-desc">${house.desc}</p>
        <div class="housing-bonus">
          +${house.healthBonusYears} Años de Vida • x${house.xpMultiplier.toFixed(2)} Velocidad de Aprendizaje
        </div>
        <button class="btn-rent ${isCurrent ? 'active-rent' : ''}" ${isCurrent ? 'disabled' : ''}>
          ${isCurrent ? 'Hogar Actual' : 'Alquilar / Habitar'}
        </button>
      `;

      const btn = card.querySelector('button');
      btn.addEventListener('click', () => {
        this.state.player.housingId = id;
        window.Sound.playClick();
        this.recalculateAllModifiers();
        this.renderHousingUI();
        this.updateTopBarUI();
        this.addChronicle(`Te has mudado a: ${house.name}.`, true);
      });

      this.dom.housingList.appendChild(card);
    }
  }

  updateTopBarUI() {
    const p = this.state.player;
    this.dom.playerAge.textContent = p.age.toFixed(2);
    this.dom.playerMaxAge.textContent = p.maxAge.toFixed(1);

    const agePct = Math.min(100, (p.age / p.maxAge) * 100);
    this.dom.ageProgressBar.style.width = `${agePct}%`;

    const agingThreshold = this.cachedModifiers.agingThreshold || 45;
    if (p.age >= agingThreshold) {
      this.dom.mortalityWarning.textContent = 'Senescencia Activa';
      this.dom.mortalityWarning.className = 'status-indicator aging-warning';
    } else {
      this.dom.mortalityWarning.textContent = 'Juventud Vigorosa';
      this.dom.mortalityWarning.className = 'status-indicator';
    }

    this.dom.playerGold.textContent = p.gold.toFixed(2);

    // Net income calculation
    const activeJob = JOBS_DATA[p.activeJobId];
    const grossIncome = activeJob ? activeJob.baseIncome * this.cachedModifiers.goldMult : 0;
    const housing = HOUSING_DATA[p.housingId] || HOUSING_DATA.tent;
    const expense = housing.costPerDay * this.cachedModifiers.housingDiscount;
    const net = grossIncome - expense;
    this.dom.netIncomeLabel.textContent = `${net >= 0 ? '+' : ''}${net.toFixed(2)}/día`;
    this.dom.netIncomeLabel.className = net >= 0 ? 'net-positive' : 'net-negative';

    this.dom.currentHousingName.textContent = housing.name;

    this.dom.playerKarma.textContent = p.karma;
    this.dom.pendingKarma.textContent = `+${this.calculatePendingKarma()} Karma`;
    if (this.dom.latticeKarmaDisplay) {
      this.dom.latticeKarmaDisplay.textContent = p.karma;
    }
    this.dom.reincarnationBadge.textContent = `Ciclo Vital #${p.reincarnationCount + 1}`;

    // Attributes
    this.dom.valStr.textContent = p.attributes.strength.toFixed(2);
    this.dom.valInt.textContent = p.attributes.intellect.toFixed(2);
    this.dom.valVit.textContent = p.attributes.vitality.toFixed(2);
    this.dom.valArc.textContent = p.attributes.arcana.toFixed(2);
  }

  updateLiveMathInspector() {
    const p = this.state.player;
    const activeSkill = SKILLS_DATA[p.activeSkillId];
    if (!activeSkill) return;

    const legacy = this.getLegacyMultiplier(activeSkill.id);
    const physicalDebuff = activeSkill.category === 'physical' ? this.getPhysicalDebuff() : 1.0;

    let catMult = 1.0;
    if (activeSkill.category === 'physical') catMult = this.cachedModifiers.physicalXp;
    else if (activeSkill.category === 'intellect') catMult = this.cachedModifiers.intellectualXp;
    else if (activeSkill.category === 'arcane') catMult = this.cachedModifiers.arcaneXp;

    const totalRate = activeSkill.baseXp * this.cachedModifiers.globalXp * catMult * legacy * physicalDebuff;

    this.dom.mathXpRate.textContent = `${totalRate.toFixed(2)} XP/s`;
    this.dom.mathFormulaDetails.textContent =
      `Base (${activeSkill.baseXp}) × Global (x${this.cachedModifiers.globalXp.toFixed(2)}) × Categoría (x${catMult.toFixed(2)}) × Memoria Álmica (x${legacy.toFixed(2)})${physicalDebuff < 1 ? ` × Senescencia (x${physicalDebuff.toFixed(2)})` : ''}`;
  }

  updateReincarnationTabUI() {
    const p = this.state.player;
    this.dom.summaryAge.textContent = `${p.age.toFixed(1)} Años`;

    let highJob = { name: 'Ninguno', level: 0 };
    for (const j in this.state.jobs) {
      if (this.state.jobs[j].level > highJob.level) {
        highJob = { name: JOBS_DATA[j].name, level: this.state.jobs[j].level };
      }
    }
    this.dom.summaryHighestJob.textContent = `${highJob.name} (Lv ${highJob.level})`;

    let highSkill = { name: 'Ninguna', level: 0 };
    for (const s in this.state.skills) {
      if (this.state.skills[s].level > highSkill.level) {
        highSkill = { name: SKILLS_DATA[s].name, level: this.state.skills[s].level };
      }
    }
    this.dom.summaryHighestSkill.textContent = `${highSkill.name} (Lv ${highSkill.level})`;

    this.dom.summaryTotalGold.textContent = `${p.gold.toFixed(2)} Monedas`;
    this.dom.summaryKarmaGain.textContent = `+${this.calculatePendingKarma()} Karma`;

    // Grimoire memory chips
    this.dom.soulMemoryList.innerHTML = '';
    const allItems = { ...JOBS_DATA, ...SKILLS_DATA };
    for (const id in allItems) {
      const def = allItems[id];
      const pastLvl = (this.state.jobs[id] || this.state.skills[id]).pastMaxLevel;
      const mult = 1.0 + (pastLvl * 0.15);

      const chip = document.createElement('div');
      chip.className = 'memory-chip';
      chip.innerHTML = `
        <span class="memory-name">${def.name} (Récord: Lv ${pastLvl})</span>
        <span class="memory-mult">x${mult.toFixed(2)} XP</span>
      `;
      this.dom.soulMemoryList.appendChild(chip);
    }
  }

  attachDeepTooltip(element, dataDef, type) {
    element.addEventListener('mouseenter', (e) => {
      const stateObj = type === 'job' ? this.state.jobs[dataDef.id] : this.state.skills[dataDef.id];
      const legacy = this.getLegacyMultiplier(dataDef.id);
      const debuff = dataDef.category === 'physical' ? this.getPhysicalDebuff() : 1.0;
      const req = this.getXpNeeded(stateObj.level, dataDef.baseXp);

      this.dom.tooltipTitle.textContent = `${dataDef.name} (Nivel ${stateObj.level})`;
      this.dom.tooltipBody.textContent = dataDef.desc;

      const formulaText =
        `Fórmula de Progreso:\n` +
        `• XP Requerida al siguiente nivel: ${req} [Base * Level^2.8]\n` +
        `• Memoria de Vidas Previas: x${legacy.toFixed(2)} (+15% por cada nivel récord)\n` +
        `• Modificador Global Árbol/Hogar: x${this.cachedModifiers.globalXp.toFixed(2)}\n` +
        `${debuff < 1 ? `• Penalización de Vejez (Físico): x${debuff.toFixed(2)}\n` : ''}` +
        `• Hitos de Maestría: Lv 10, 25, 50`;

      this.dom.tooltipFormula.textContent = formulaText;
      this.dom.globalTooltip.classList.remove('hidden');
    });

    element.addEventListener('mousemove', (e) => {
      const tooltip = this.dom.globalTooltip;
      tooltip.style.left = `${Math.min(window.innerWidth - 340, e.clientX + 15)}px`;
      tooltip.style.top = `${Math.min(window.innerHeight - 200, e.clientY + 15)}px`;
    });

    element.addEventListener('mouseleave', () => {
      this.dom.globalTooltip.classList.add('hidden');
    });
  }

  initGlobalTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        this.dom.tooltipTitle.textContent = 'Detalle Místico';
        this.dom.tooltipBody.textContent = el.getAttribute('data-tooltip');
        this.dom.tooltipFormula.textContent = '';
        this.dom.globalTooltip.classList.remove('hidden');
      });
      el.addEventListener('mousemove', (e) => {
        const tooltip = this.dom.globalTooltip;
        tooltip.style.left = `${Math.min(window.innerWidth - 340, e.clientX + 15)}px`;
        tooltip.style.top = `${Math.min(window.innerHeight - 150, e.clientY + 15)}px`;
      });
      el.addEventListener('mouseleave', () => {
        this.dom.globalTooltip.classList.add('hidden');
      });
    });
  }

  addChronicle(msg, highlight = false) {
    const entry = document.createElement('div');
    entry.className = `chronicle-entry ${highlight ? 'highlight' : ''}`;
    entry.textContent = `[${this.state.player.age.toFixed(1)}a] ${msg}`;
    this.dom.chronicleFeed.prepend(entry);

    while (this.dom.chronicleFeed.children.length > 25) {
      this.dom.chronicleFeed.removeChild(this.dom.chronicleFeed.lastChild);
    }
  }

  // =========================================================================
  // PERSISTENCE & OFFLINE ENGINE
  // =========================================================================

  saveGame() {
    this.state.offline.lastSavedTimestamp = Date.now();
    try {
      localStorage.setItem('chrono_transcendence_save', JSON.stringify(this.state));
    } catch (e) {
      console.error('Error saving game:', e);
    }
  }

  loadGame() {
    try {
      const saved = localStorage.getItem('chrono_transcendence_save');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.player && parsed.jobs) {
          this.state = parsed;
          this.calculateOfflineProgress();
        }
      }
    } catch (e) {
      console.error('Error loading game:', e);
    }
  }

  calculateOfflineProgress() {
    const lastTime = this.state.offline.lastSavedTimestamp;
    if (!lastTime) return;

    const now = Date.now();
    const elapsedSeconds = Math.min(86400, Math.floor((now - lastTime) / 1000)); // Capped at 24h
    if (elapsedSeconds > 10) {
      this.addChronicle(`Has regresado tras ${elapsedSeconds}s de sueño cósmico. Se calcula tu cultivo offline.`, true);
      // Run deterministic offline simulation in chunks
      const chunkSize = 1;
      const iterations = Math.floor(elapsedSeconds / chunkSize);
      for (let i = 0; i < iterations; i++) {
        if (!this.state.player.isAlive) break;
        this.updateSimulation(chunkSize);
      }
    }
  }
}

// Background Particle Canvas
function initAmbientCanvas() {
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 0.5,
      vy: -(Math.random() * 0.4 + 0.1),
      vx: (Math.random() - 0.5) * 0.2,
      alpha: Math.random() * 0.5 + 0.2
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.y += p.vy;
      p.x += p.vx;
      if (p.y < 0) p.y = canvas.height;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;

      ctx.fillStyle = `rgba(212, 175, 55, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(render);
  }
  render();
}

window.addEventListener('DOMContentLoaded', () => {
  initAmbientCanvas();
  window.Engine = new GameEngine();
  window.Engine.init();
});
