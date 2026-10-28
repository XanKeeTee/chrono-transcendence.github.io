/**
 * CHRONO TRANSCENDENCE — Capa de interfaz (DOM).
 *
 * Reglas de rendimiento:
 *  - Las tarjetas se reconstruyen sólo ante cambios ESTRUCTURALES (desbloqueo,
 *    hito, cambio de actividad). Cada reconstrucción oculta el tooltip (en v1 se
 *    quedaba "pegado" porque el nodo desaparecía sin disparar mouseleave).
 *  - Las actualizaciones por frame tocan referencias cacheadas (sin getElementById
 *    por tick) y se limitan a ~10 Hz.
 *  - Todo texto procedente del estado pasa por textContent o U.esc().
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});
  const U = CT.U;
  const F = CT.F;
  const B = CT.BALANCE;

  const $ = (id) => document.getElementById(id);
  const tierClass = (lvl) => (lvl >= 50 ? 'mastery-tier-3' : lvl >= 25 ? 'mastery-tier-2' : lvl >= 10 ? 'mastery-tier-1' : '');

  class UI {
    constructor(engine) {
      this.engine = engine;
      this.cardRefs = {};
      this.structDirty = true;
      this.housingDirty = true;
      this.plannerDirty = true;
      this.grimoireDirty = true;
      this.tooltipSource = null;
      this.sparks = 0;
    }

    get state() { return this.engine.state; }
    get mods() { return this.engine.ctx.mods; }

    init() {
      this.initTabs();
      this.initTooltips();
      this.initPlannerForm();
      this.initSettings();
      this.buildAttributes();
    }

    // ------------------------------------------------------------- PESTAÑAS
    initTabs() {
      const tabs = document.querySelectorAll('.nav-tab');
      tabs.forEach((tab) => tab.addEventListener('click', () => this.showTab(tab.dataset.tab)));
    }

    showTab(id) {
      CT.Sound.playClick();
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === id));
      this.hideTooltip();
      this.engine.lattice.setVisible(id === 'tab-lattice');
      if (id === 'tab-reincarnation') this.grimoireDirty = true;
      if (id === 'tab-planner') this.plannerDirty = true;
      if (id === 'tab-housing') this.housingDirty = true;
      this.activeTab = id;
    }

    // ------------------------------------------------------------- TOOLTIPS
    initTooltips() {
      const tt = $('global-tooltip');
      document.addEventListener('pointerover', (e) => {
        const el = e.target.closest('[data-tooltip],[data-task]');
        if (!el || el === this.tooltipSource) return;
        this.tooltipSource = el;
        if (el.dataset.task) this.fillTaskTooltip(el.dataset.task);
        else this.fillTooltip('Detalle', el.dataset.tooltip, '');
        tt.classList.remove('hidden');
      });
      document.addEventListener('pointerout', (e) => {
        if (!this.tooltipSource) return;
        if (!e.relatedTarget || !this.tooltipSource.contains(e.relatedTarget)) this.hideTooltip();
      });
      document.addEventListener('pointermove', (e) => {
        if (!this.tooltipSource) return;
        const w = tt.offsetWidth || 320, h = tt.offsetHeight || 160;
        tt.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX + 16))}px`;
        tt.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY + 16))}px`;
      });
    }

    fillTooltip(title, body, formula) {
      $('tooltip-title').textContent = title;
      $('tooltip-body').textContent = body;
      $('tooltip-formula').textContent = formula;
    }

    hideTooltip() {
      this.tooltipSource = null;
      $('global-tooltip').classList.add('hidden');
    }

    fillTaskTooltip(id) {
      const def = CT.taskDef(id), ts = CT.taskState(this.state, id), m = this.mods;
      if (!ts.unlocked) {
        const reqs = def.requires.map((r) => `${F.requirementMet(this.state, r, m) ? '✓' : '✗'} ${F.requirementText(r)}`).join('\n');
        this.fillTooltip(ts.discovered ? def.name : '???', ts.discovered ? def.desc : 'Una senda aún desconocida.', `Requisitos (cada vida):\n${reqs}`);
        return;
      }
      const br = F.xpRateBreakdown(this.state, id, m);
      const req = F.xpRequired(def, ts.level, m);
      const bps = Object.entries(def.breakpoints).map(([lv, bp]) => `${ts.level >= +lv ? '★' : '☆'} Lv ${lv} ${bp.name}: ${bp.desc}`).join('\n');
      let formula =
        `XP siguiente nivel: ${U.fmt(req)}  [${B.XP_BASE}·${def.difficulty}·(L+1)^${B.XP_POLY}·${B.XP_GROWTH}^L]\n` +
        `Tasa: ${U.fmt(br.total)} XP/día = ${br.base} base × ${U.fmt(br.global)} global × ${br.category.toFixed(2)} ${CT.CATEGORIES[def.category].name.toLowerCase()}` +
        `${br.task !== 1 ? ` × ${br.task.toFixed(2)} específico` : ''} × ${br.memory.toFixed(2)} memoria${br.senescence < 1 ? ` × ${br.senescence.toFixed(2)} senescencia` : ''}\n` +
        `Récord histórico: Lv ${ts.pastMax}\n${bps}`;
      if (CT.isJob(id)) formula = `Sueldo: ${U.fmt(F.jobIncome(this.state, id, m))} oro/día (+${B.INCOME_PER_LEVEL * 100}% por nivel)\n` + formula;
      this.fillTooltip(`${def.icon} ${def.name} — Lv ${ts.level}`, def.desc, formula);
    }

    // ---------------------------------------------------------- TARJETAS
    renderCards() {
      this.hideTooltip();
      this.cardRefs = {};
      this.renderList($('jobs-list'), CT.JOBS, this.state.jobs, 'job');
      this.renderList($('skills-list'), CT.SKILLS, this.state.skills, 'skill');
      const p = this.state.player;
      $('active-job-indicator').textContent = `Activo: ${CT.JOBS[p.activeJobId].name}`;
      $('active-skill-indicator').textContent = `Activo: ${CT.SKILLS[p.activeSkillId].name}`;
      this.structDirty = false;
    }

    renderList(container, defs, states, kind) {
      const frag = document.createDocumentFragment();
      let shownLocked = 0;
      for (const id in defs) {
        const def = defs[id], ts = states[id];
        const card = document.createElement('div');
        card.dataset.task = id;
        if (!ts.unlocked) {
          if (!ts.discovered && shownLocked >= 1) continue; // sólo un "???" a la vez
          shownLocked += ts.discovered ? 0 : 1;
          card.className = 'task-card locked-task';
          const reqs = def.requires.map((r) => {
            const ok = F.requirementMet(this.state, r, this.mods);
            return `<span class="req ${ok ? 'ok' : ''}">${ok ? '✓' : '✗'} ${U.esc(F.requirementText(r))}</span>`;
          }).join('');
          card.innerHTML = `
            <div class="task-card-header">
              <div class="task-title-wrap"><span class="task-icon">${ts.discovered ? def.icon : '❔'}</span>
              <span class="task-name">${ts.discovered ? U.esc(def.name) : '???'}</span></div>
              <span class="task-level-badge">${ts.pastMax ? `Récord ${ts.pastMax}` : '🔒'}</span>
            </div>
            <div class="req-list">${reqs}</div>`;
          frag.appendChild(card);
          continue;
        }
        const active = kind === 'job' ? this.state.player.activeJobId === id : this.state.player.activeSkillId === id;
        card.className = `task-card ${active ? 'active-task' : ''} ${tierClass(ts.level)}`;
        card.innerHTML = `
          <div class="task-card-header">
            <div class="task-title-wrap"><span class="task-icon">${def.icon}</span><span class="task-name">${U.esc(def.name)}</span>
              <span class="cat-dot" style="background:${CT.CATEGORIES[def.category].color}" title="${CT.CATEGORIES[def.category].name}"></span></div>
            <span class="task-level-badge" data-r="lvl">Lv ${ts.level}</span>
          </div>
          <div class="progress-bar-container"><div data-r="bar" class="progress-bar-fill ${kind === 'job' ? 'fill-job' : 'fill-skill'}"></div></div>
          <div class="task-yields">
            <span class="yield-rate" data-r="rate"></span>
            <span class="${kind === 'job' ? 'yield-income' : 'yield-memory'}" data-r="extra"></span>
          </div>
          <div class="task-next" data-r="next"></div>`;
        card.addEventListener('click', () => this.engine.setActive(kind, id));
        const refs = {};
        card.querySelectorAll('[data-r]').forEach((el) => { refs[el.dataset.r] = el; });
        this.cardRefs[id] = refs;
        frag.appendChild(card);
      }
      container.replaceChildren(frag);
    }

    updateCards() {
      const m = this.mods;
      for (const id in this.cardRefs) {
        const r = this.cardRefs[id], def = CT.taskDef(id), ts = CT.taskState(this.state, id);
        const req = F.xpRequired(def, ts.level, m);
        const rate = F.xpRate(this.state, id, m);
        r.lvl.textContent = `Lv ${ts.level}`;
        r.bar.style.width = `${Math.min(100, (ts.xp / req) * 100).toFixed(2)}%`;
        const daysLeft = (req - ts.xp) / Math.max(rate, 1e-9);
        r.rate.textContent = `${U.fmt(rate)} XP/día · próx. ${U.fmtDuration((daysLeft * B.DAY_MS) / 1000)}`;
        r.extra.textContent = CT.isJob(id)
          ? `+${U.fmt(F.jobIncome(this.state, id, m))} oro/día`
          : `Memoria ×${F.memoryMult(ts.pastMax, m).toFixed(2)}`;
        const nextBp = Object.keys(def.breakpoints).map(Number).find((lv) => lv > ts.level);
        r.next.textContent = nextBp ? `Hito Lv ${nextBp}: ${def.breakpoints[nextBp].name}` : '★ Todos los hitos alcanzados';
      }
    }

    // ------------------------------------------------------- BARRA SUPERIOR
    updateTopBar() {
      const s = this.state, p = s.player, m = this.mods;
      const age = F.age(s);
      $('player-age').textContent = age.toFixed(2);
      $('player-max-age').textContent = m.maxAge.toFixed(1);
      $('age-progress-bar').style.width = `${Math.min(100, ((age - B.START_AGE) / (m.maxAge - B.START_AGE)) * 100)}%`;
      const yearsLeft = Math.max(0, m.maxAge - age);
      $('life-remaining').textContent = `${yearsLeft.toFixed(1)} años ≈ ${U.fmtDuration((yearsLeft * B.DAYS_PER_YEAR * B.DAY_MS) / (1000 * m.agingRate * Math.max(s.settings.timeScale, 1e-9)))}`;

      const conds = F.activeConditions(age, m);
      const warn = $('mortality-warning');
      warn.textContent = conds.length ? conds.map((c) => CT.CONDITIONS[c].name).join(' · ') : 'Juventud';
      warn.className = `status-indicator ${conds.length ? 'aging-warning' : ''}`;

      $('player-gold').textContent = U.fmt(U.gold(p));
      const income = F.jobIncome(s, p.activeJobId, m);
      const rent = F.housingRent(p.housingId, m);
      const net = income - rent;
      const nl = $('net-income-label');
      nl.textContent = `${net >= 0 ? '+' : ''}${U.fmt(net)}/día`;
      nl.className = net >= 0 ? 'net-positive' : 'net-negative';
      $('current-housing-name').textContent = CT.HOUSING[p.housingId].name;

      $('player-karma').textContent = U.fmtInt(p.karma);
      $('latent-karma-label').textContent = `Latente ${U.pct(m.latentKarma, 1)}`;
      $('pending-karma').textContent = `+${U.fmtInt(this.engine.pendingKarma())}`;
      $('soul-echo').textContent = `×${U.fmt(p.soulEcho)}`;
      $('pending-echo').textContent = `+${(F.echoGain(s, m) * 100).toFixed(1)}%`;
      $('lattice-karma-display').textContent = U.fmtInt(p.karma);
      $('reincarnation-badge').textContent = `Ciclo Vital #${p.reincarnationCount + 1}`;

      const affordable = CT.LATTICE.some((n) => this.engine.lattice.canAllocate(n));
      $('tree-unspent-badge').classList.toggle('hidden', !affordable);
      $('planner-lock').classList.toggle('hidden', m.plannerUnlocked);
    }

    buildAttributes() {
      const grid = $('attributes-grid');
      grid.innerHTML = '';
      this.attrRefs = {};
      for (const k in CT.ATTRIBUTES) {
        const a = CT.ATTRIBUTES[k];
        const box = document.createElement('div');
        box.className = 'attr-box';
        box.dataset.tooltip = a.desc;
        box.innerHTML = `<span class="attr-icon">${a.icon}</span><div class="attr-meta"><span class="attr-name">${a.name}</span><span class="attr-val">1.00</span></div>`;
        this.attrRefs[k] = box.querySelector('.attr-val');
        grid.appendChild(box);
      }
    }

    updateSidePanel() {
      const s = this.state, m = this.mods, p = s.player;
      for (const k in this.attrRefs) this.attrRefs[k].textContent = m.attributes[k].toFixed(2);

      // Condiciones de senescencia (activas y próximas).
      const age = F.age(s);
      const rows = [
        ['aches', m.agingThreshold, F.achesFactor(age, m), 'XP/oro físico y marcial'],
        ['fog', m.mentalThreshold, F.fogFactor(age, m), 'XP intelectual y arcana'],
        ['delirium', m.mentalThreshold + B.DELIRIUM_OFFSET, F.inDelirium(age, m) ? 0.5 : 1, 'Eureka y olvidos'],
      ];
      $('conditions-list').innerHTML = rows.map(([id, at, factor, what]) => {
        const c = CT.CONDITIONS[id];
        const active = age > at;
        const status = active ? `<span class="crimson-text">activa · ${what} ×${factor.toFixed(2)}</span>` : `<span class="dim-text">a los ${at.toFixed(1)} años</span>`;
        return `<div class="condition-row ${active ? 'active' : ''}" data-tooltip="${U.esc(c.desc)}"><span>${c.icon} ${c.name}</span>${status}</div>`;
      }).join('');

      // Desglose matemático
      const skill = CT.SKILLS[p.activeSkillId];
      const br = F.xpRateBreakdown(s, skill.id, m);
      $('math-xp-rate').textContent = `${U.fmt(br.total)} XP/día`;
      $('math-formula-details').textContent =
        `${br.base} × Global ${U.fmt(br.global)} [Eco ×${U.fmt(m.echo)} · Latente ×${m.latentKarma.toFixed(2)} · Hogar ×${CT.HOUSING[p.housingId].xpMult}] × ` +
        `${CT.CATEGORIES[skill.category].name} ×${br.category.toFixed(2)} × Memoria ×${br.memory.toFixed(2)}` +
        `${br.task !== 1 ? ` × Específico ×${br.task.toFixed(2)}` : ''}${br.senescence < 1 ? ` × Senescencia ×${br.senescence.toFixed(2)}` : ''}` +
        ` · Eureka ${(m.eurekaChance * 100).toFixed(2)}%/día`;
      $('math-job-rate').textContent = `${U.fmt(F.xpRate(s, p.activeJobId, m))} XP/día`;
      $('math-eta').textContent = `Karma ×${(m.karmaMult).toFixed(2)} · Coste XP ×${m.xpCost.toFixed(2)} · Envejecimiento ×${m.agingRate.toFixed(2)}`;
    }

    // ------------------------------------------------------------- HOGARES
    renderHousing() {
      const s = this.state, m = this.mods, p = s.player;
      const list = $('housing-list');
      const curIdx = CT.HOUSING_ORDER.indexOf(p.housingId);
      const income = F.jobIncome(s, p.activeJobId, m);
      list.innerHTML = '';
      for (const id of CT.HOUSING_ORDER) {
        const h = CT.HOUSING[id], idx = CT.HOUSING_ORDER.indexOf(id);
        const rent = F.housingRent(id, m), deposit = F.housingDeposit(id, m);
        const current = id === p.housingId;
        const affordable = idx < curIdx || U.canAfford(p, deposit);
        const covers = rent === 0 ? '—' : `${Math.round((income / rent) * 100)}%`;
        const extras = Object.keys(h.effect).length
          ? Object.entries(h.effect).map(([k, v]) => k === 'xpArcane' ? `+${v * 100}% XP arcana` : k === 'mentalThreshold' ? `Neblina +${v} años` : '').filter(Boolean).join(' · ')
          : '';
        const card = document.createElement('div');
        card.className = `housing-card ${current ? 'current' : ''}`;
        card.innerHTML = `
          <div class="housing-header"><h3 class="housing-title">${U.esc(h.name)}</h3><span class="housing-cost">${U.fmt(rent)} oro/día</span></div>
          <p class="task-desc">${U.esc(h.desc)}</p>
          <div class="housing-bonus">${h.years >= 0 ? '+' : ''}${h.years} años · XP ×${h.xpMult.toFixed(2)}${extras ? ' · ' + extras : ''}</div>
          <div class="housing-meta">Fianza: ${idx > curIdx ? U.fmt(deposit) + ' oro' : 'no'} · Tu sueldo cubre: ${covers}</div>
          <button class="btn-rent ${current ? 'active-rent' : ''}" ${current || !affordable ? 'disabled' : ''}>
            ${current ? 'Hogar actual' : idx < curIdx ? 'Mudarse (gratis)' : affordable ? `Mudarse (−${U.fmt(deposit)} oro)` : `Faltan ${U.fmt(deposit - U.gold(p))} oro`}
          </button>`;
        card.querySelector('button').addEventListener('click', () => this.engine.moveHousing(id));
        list.appendChild(card);
      }
      this.housingDirty = false;
    }

    // ---------------------------------------------------------- PLANIFICADOR
    initPlannerForm() {
      const condType = $('rule-cond-type'), condTarget = $('rule-cond-target');
      const actType = $('rule-action-type'), actTarget = $('rule-action-target');
      const fill = (sel, entries) => { sel.innerHTML = entries.map(([v, t]) => `<option value="${v}">${U.esc(t)}</option>`).join(''); };
      const syncCond = () => {
        const t = condType.value;
        condTarget.classList.toggle('hidden', !t.endsWith('Level'));
        if (t === 'jobLevel') fill(condTarget, Object.values(CT.JOBS).map((d) => [d.id, d.name]));
        if (t === 'skillLevel') fill(condTarget, Object.values(CT.SKILLS).map((d) => [d.id, d.name]));
        $('rule-cond-value').value = t === 'age' ? 20 : t === 'gold' ? 200 : 10;
      };
      const syncAct = () => {
        const t = actType.value;
        if (t === 'job') fill(actTarget, Object.values(CT.JOBS).map((d) => [d.id, d.name]));
        if (t === 'skill') fill(actTarget, Object.values(CT.SKILLS).map((d) => [d.id, d.name]));
        if (t === 'housing') fill(actTarget, CT.HOUSING_ORDER.map((id) => [id, CT.HOUSING[id].name]));
      };
      condType.addEventListener('change', syncCond);
      actType.addEventListener('change', syncAct);
      syncCond(); syncAct();
      $('btn-add-rule').addEventListener('click', () => {
        this.engine.addRule({
          cond: { type: condType.value, target: condTarget.classList.contains('hidden') ? null : condTarget.value, value: +$('rule-cond-value').value },
          action: { type: actType.value, target: actTarget.value },
        });
      });
      $('auto-reincarnate-toggle').addEventListener('change', (e) => this.engine.setAutoReincarnate(e.target.checked));
    }

    ruleText(r) {
      const c = r.cond, a = r.action;
      const cond = c.type === 'age' ? `edad ≥ ${c.value}` : c.type === 'gold' ? `oro ≥ ${U.fmt(c.value)}`
        : `${CT.taskDef(c.target).name} Lv ≥ ${c.value}`;
      const act = a.type === 'housing' ? `mudarse a ${CT.HOUSING[a.target].name}` : `${a.type === 'job' ? 'trabajar como' : 'entrenar'} ${CT.taskDef(a.target).name}`;
      return `Cuando ${cond} → ${act}`;
    }

    renderPlanner() {
      const m = this.mods, pl = this.state.planner;
      $('planner-locked').classList.toggle('hidden', m.plannerUnlocked);
      $('planner-unlocked').classList.toggle('hidden', !m.plannerUnlocked);
      if (!m.plannerUnlocked) {
        const left = B.PLANNER_UNLOCK_REINCARNATIONS - this.state.player.reincarnationCount;
        $('planner-locked-text').textContent = `Se desbloquea tras ${B.PLANNER_UNLOCK_REINCARNATIONS} reencarnaciones (faltan ${left}) o al imbuir el nodo «Visión Profética» del Árbol.`;
        this.plannerDirty = false;
        return;
      }
      $('planner-slots').textContent = `(${Math.min(pl.rules.length, m.plannerSlots)}/${m.plannerSlots} reglas operativas)`;
      $('auto-reinc-row').classList.toggle('hidden', !m.autoReincarnateUnlocked);
      $('auto-reincarnate-toggle').checked = pl.autoReincarnate;
      $('btn-add-rule').disabled = pl.rules.length >= 30;
      const ol = $('planner-rules');
      ol.innerHTML = '';
      if (!pl.rules.length) ol.innerHTML = '<li class="dim-text">Aún no hay reglas. Ejemplo: «Cuando Mendigo Lv ≥ 10 → trabajar como Jornalero».</li>';
      pl.rules.forEach((r, i) => {
        const li = document.createElement('li');
        const inactive = i >= m.plannerSlots;
        li.className = `rule-row ${r.fired ? 'fired' : ''} ${inactive || !r.enabled ? 'inactive' : ''}`;
        li.innerHTML = `
          <span class="rule-text">${U.esc(this.ruleText(r))}</span>
          <span class="rule-status">${inactive ? 'sin hueco' : !r.enabled ? 'pausada' : r.fired ? '✓ ejecutada' : 'en espera'}</span>
          <span class="rule-buttons">
            <button class="btn-icon sm" data-a="up" title="Subir">↑</button>
            <button class="btn-icon sm" data-a="down" title="Bajar">↓</button>
            <button class="btn-icon sm" data-a="toggle" title="Pausar/activar">${r.enabled ? '⏸' : '▶'}</button>
            <button class="btn-icon sm" data-a="del" title="Eliminar">✕</button>
          </span>`;
        li.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.engine.ruleAction(r.id, b.dataset.a)));
        ol.appendChild(li);
      });
      this.plannerDirty = false;
    }

    // ------------------------------------------------------------- GRIMORIO
    updateGrimoire() {
      const s = this.state, m = this.mods, p = s.player;
      $('summary-age').textContent = `${F.age(s).toFixed(1)} años`;
      $('summary-levels').textContent = `${F.totalLevels(s)} (${s.stats.bestTotalLevels})`;
      $('summary-records').textContent = `${F.newRecordLevels(s)}`;
      $('summary-total-gold').textContent = U.fmt(p.lifeGoldEarned);
      $('summary-karma-gain').textContent = `+${U.fmtInt(this.engine.pendingKarma())}`;
      $('summary-echo-gain').textContent = `+${(F.echoGain(s, m) * 100).toFixed(1)}%`;
      $('summary-time').textContent = U.fmtDuration(s.stats.realSecondsLife);
      if (!this.grimoireDirty) return;
      const list = $('soul-memory-list');
      list.innerHTML = '';
      for (const [defs, states] of [[CT.JOBS, s.jobs], [CT.SKILLS, s.skills]]) {
        for (const id in defs) {
          const ts = states[id];
          if (!ts.discovered) continue;
          const chip = document.createElement('div');
          chip.className = 'memory-chip';
          chip.innerHTML = `<span class="memory-name">${defs[id].icon} ${U.esc(defs[id].name)} (récord Lv ${ts.pastMax})</span><span class="memory-mult">×${F.memoryMult(ts.pastMax, m).toFixed(2)}</span>`;
          list.appendChild(chip);
        }
      }
      $('lives-table').innerHTML = s.stats.lives.slice().reverse().map((l) =>
        `<tr><td>${l.n}</td><td>${l.age}</td><td>${l.levels}</td><td>+${U.fmtInt(l.karma)}</td><td>+${l.echo}%</td><td>${U.fmtDuration(l.secs)}</td></tr>`).join('')
        || '<tr><td colspan="6" class="dim-text">Aún no has muerto. Dale tiempo.</td></tr>';
      this.grimoireDirty = false;
    }

    // ------------------------------------------------------------- AJUSTES
    initSettings() {
      $('toggle-sound').addEventListener('change', (e) => this.engine.setSound(e.target.checked));
      $('toggle-particles').addEventListener('change', (e) => this.engine.setParticles(e.target.checked));
    }

    syncSettings() {
      const st = this.state.settings;
      $('toggle-sound').checked = st.soundEnabled;
      $('toggle-particles').checked = st.particlesEnabled;
      $('btn-audio-toggle').textContent = st.soundEnabled ? '🔊' : '🔇';
      const pause = $('btn-pause');
      pause.textContent = st.isPaused ? '▶' : '⏸';
      pause.classList.toggle('active', st.isPaused);
      document.querySelectorAll('#dev-speed-group .btn-time').forEach((b) => b.classList.toggle('active', +b.dataset.speed === st.timeScale));
      $('offline-cap').textContent = `${this.mods.offlineCapHours} h`;
    }

    // ------------------------------------------------------------- CRÓNICA
    log(msg, kind = '') {
      const feed = $('chronicle-feed');
      const entry = document.createElement('div');
      entry.className = `chronicle-entry ${kind}`;
      entry.textContent = `[${F.age(this.state).toFixed(1)}a] ${msg}`;
      feed.prepend(entry);
      while (feed.children.length > 40) feed.lastChild.remove();
    }

    eurekaSpark(amount) {
      if (this.sparks > 4 || document.hidden) return;
      const c = $('eureka-container');
      const el = document.createElement('div');
      el.className = 'eureka-spark';
      el.textContent = `✦ Eureka! +${U.fmt(amount)} XP`;
      el.style.left = `${Math.random() * 40 + 30}%`;
      el.style.top = `${Math.random() * 30 + 35}%`;
      c.appendChild(el);
      this.sparks++;
      setTimeout(() => { el.remove(); this.sparks--; }, 1300);
    }

    banner(msg, level = 'warn') {
      const b = $('system-banner');
      if (!msg) { b.classList.add('hidden'); return; }
      b.textContent = msg;
      b.className = `system-banner ${level}`;
    }

    // ------------------------------------------------------------- MODALES
    showDeath(summary) {
      $('death-cause-text').textContent = summary.cause === 'voluntary'
        ? `Has inmolado tu recipiente a los ${summary.age.toFixed(1)} años.`
        : `Tu cuerpo ha expirado a los ${summary.age.toFixed(1)} años.`;
      $('death-levels-stat').textContent = `${summary.totalLevels}`;
      $('death-records-stat').textContent = `${summary.records}`;
      $('death-karma-stat').textContent = `+${U.fmtInt(summary.karma)}`;
      $('death-memory-stat').textContent = `+${(summary.echoGain * 100).toFixed(1)}% (×${U.fmt(this.state.player.soulEcho)} → ×${U.fmt(this.state.player.soulEcho * (1 + summary.echoGain))})`;
      $('death-modal').classList.remove('hidden');
    }
    hideDeath() { $('death-modal').classList.add('hidden'); }

    showOffline(report) {
      const lines = [
        `Has estado fuera <strong>${U.fmtDuration(report.awaySec)}</strong>. Se han simulado <strong>${U.fmtDuration(report.simSec)}</strong>${report.capped ? ` (límite de ${report.capHours} h)` : ''}.`,
        `Edad: ${report.ageFrom.toFixed(1)} → ${report.ageTo.toFixed(1)} años · Oro: +${U.fmt(report.gold)}`,
        `Niveles ganados: <strong>${report.levels}</strong>`,
      ];
      if (report.lives) lines.push(`La Rueda del Samsara giró <strong>${report.lives}</strong> ${report.lives === 1 ? 'vez' : 'veces'}.`);
      if (report.died) lines.push('<span class="crimson-text">Tu cuerpo expiró mientras dormías. El tiempo restante se ha perdido.</span>');
      $('offline-report').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
      $('offline-modal').classList.remove('hidden');
    }

    // --------------------------------------------------------------- FRAME
    update() {
      if (this.structDirty) this.renderCards();
      if (this.activeTab === 'tab-housing' && this.housingDirty) this.renderHousing();
      if (this.activeTab === 'tab-planner' && this.plannerDirty) this.renderPlanner();
      this.updateTopBar();
      if (!this.activeTab || this.activeTab === 'tab-occupations') {
        this.updateCards();
        this.updateSidePanel();
      }
      if (this.activeTab === 'tab-reincarnation') this.updateGrimoire();
      if (this.tooltipSource && this.tooltipSource.dataset.task) this.fillTaskTooltip(this.tooltipSource.dataset.task);
    }
  }

  CT.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
