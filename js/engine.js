/**
 * CHRONO TRANSCENDENCE — Motor: bucle temporal, eventos, persistencia y arranque.
 *
 * Bucle temporal (corrige la pérdida de tiempo en pestañas en segundo plano):
 *  - El tiempo se mide con el RELOJ DE PARED (Date.now), no con el delta de rAF
 *    (que v1 recortaba a 1 s: una pestaña oculta 10 min perdía 9:59).
 *  - Paso fijo: cada 100 ms reales = 1 tick de 0.4 días. Determinista e
 *    independiente del framerate (60 Hz, 144 Hz o 1 fps dan el mismo resultado).
 *  - rAF dibuja; un setInterval de respaldo sigue bombeando la simulación cuando
 *    rAF se congela en segundo plano. Si el atraso supera 50 ticks se usa la vía
 *    masiva (Sim.advance) sin tocar el DOM.
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});
  const U = CT.U, F = CT.F, B = CT.BALANCE, Sim = CT.Sim, Save = CT.Save;
  const TICK_DAYS = B.TICK_MS / B.DAY_MS;
  const $ = (id) => document.getElementById(id);

  class GameEngine {
    constructor() {
      this.state = null;
      this.ctx = null;
      this.accMs = 0;
      this.lastWall = Date.now();
      this.lastUi = 0;
      this.lastSave = Date.now();
      this.readOnly = false;
      this.resetting = false;
      this.tabId = Math.random().toString(36).slice(2);
      this.forgetLogged = false;
    }

    async init() {
      CT.Sound.attachUnlock();
      await this.acquireTabLock();

      const { state, source, warnings } = Save.read();
      this.state = state;
      this.ctx = Sim.createContext(state);
      Sim.checkUnlocks(state, this.ctx);
      this.ctx.events.length = 0;
      CT.Sound.setEnabled(state.settings.soundEnabled);

      this.lattice = new CT.CelestialLattice('lattice-canvas', this);
      this.ui = new CT.UI(this);
      this.ui.init();
      this.initControls();
      this.ui.syncSettings();
      this.ambient = initAmbientCanvas(() => this.state.settings.particlesEnabled);

      if (warnings.length) this.ui.banner(warnings.join(' '), 'warn');
      if (source === 'new') this.ui.log('Despiertas a los 14 años en un soportal helado. Tu alma resuena con fragmentos de vidas olvidadas.', 'highlight');
      else this.ui.log('El ciclo vital se reanuda.', 'highlight');

      this.runOfflineProgress();
      if (!this.state.player.isAlive) this.handleDeath(true);

      this.ui.update();
      this.lattice.updateInspector();
      this.updateRespecHint();

      requestAnimationFrame((t) => this.frame(t));
      this.bgTimer = setInterval(() => this.pump(), 1000);
      document.addEventListener('visibilitychange', () => {
        CT.Sound.muted = document.hidden;
        if (document.hidden) this.save();
        else this.pump();
      });
      window.addEventListener('pagehide', () => this.save());
      window.addEventListener('beforeunload', () => this.save());
    }

    // ------------------------------------------------------- BLOQUEO DE PESTAÑA
    /**
     * Dos pestañas con la misma partida se sobrescriben mutuamente. La pestaña
     * nueva anuncia su llegada; la antigua guarda, confirma y queda en sólo-lectura.
     */
    acquireTabLock() {
      if (typeof BroadcastChannel === 'undefined') return Promise.resolve();
      try {
        this.channel = new BroadcastChannel('chrono-transcendence');
      } catch (e) {
        return Promise.resolve(); // algunos navegadores lo bloquean en file://
      }
      this.channel.onmessage = (e) => {
        const msg = e.data || {};
        if (msg.from === this.tabId) return;
        if (msg.type === 'hello' && this.state && !this.readOnly) {
          this.save();
          this.channel.postMessage({ type: 'saved', from: this.tabId });
          this.enterReadOnly();
        }
        if (msg.type === 'saved' && this.awaitingSave) this.awaitingSave();
      };
      return new Promise((resolve) => {
        const t = setTimeout(resolve, 250);
        this.awaitingSave = () => { clearTimeout(t); this.awaitingSave = null; resolve(); };
        this.channel.postMessage({ type: 'hello', from: this.tabId });
      });
    }

    enterReadOnly() {
      this.readOnly = true;
      this.ui.banner('La partida se ha abierto en otra pestaña. Esta queda congelada para no sobrescribir tu progreso: recárgala para continuar aquí.', 'error');
    }

    // --------------------------------------------------------------- BUCLE
    frame(t) {
      this.pump();
      this.lattice.frame();
      if (t - this.lastUi > 100) { // UI a 10 Hz
        this.lastUi = t;
        this.ui.update();
      }
      requestAnimationFrame((tt) => this.frame(tt));
    }

    pump() {
      const now = Date.now();
      let elapsed = now - this.lastWall;
      this.lastWall = now;
      if (elapsed < 0) elapsed = 0; // reloj del sistema retrocedió
      const s = this.state;
      if (!s || this.readOnly) return;
      if (!s.player.isAlive || s.settings.isPaused) { this.accMs = 0; this.maybeAutosave(now); return; }

      this.accMs += elapsed * s.settings.timeScale;
      const ticks = Math.floor(this.accMs / B.TICK_MS);
      if (ticks > 0) {
        this.accMs -= ticks * B.TICK_MS;
        if (ticks > B.MAX_CATCHUP_TICKS_PER_FRAME) {
          // Vía masiva: pestaña en segundo plano, suspensión del equipo o velocidad dev.
          const realSec = (ticks * B.TICK_MS) / 1000 / s.settings.timeScale;
          if (realSec > 60 && s.settings.timeScale === 1) {
            this.runCatchUp(ticks * TICK_DAYS, realSec);
          } else {
            Sim.advance(s, this.ctx, ticks * TICK_DAYS, { maxStep: Math.max(TICK_DAYS, (ticks * TICK_DAYS) / 4000), bulk: false, autoReincarnate: true });
          }
        } else {
          for (let i = 0; i < ticks && s.player.isAlive; i++) Sim.step(s, this.ctx, TICK_DAYS);
        }
        this.processEvents();
      }
      this.maybeAutosave(now);
    }

    maybeAutosave(now) {
      if (now - this.lastSave >= B.AUTOSAVE_MS) this.save();
    }

    save() {
      if (this.readOnly || this.resetting || !this.state) return;
      this.lastSave = Date.now();
      const r = Save.write(this.state);
      const el = $('save-status');
      if (el) el.textContent = r.ok ? `Guardado: ${new Date().toLocaleTimeString()}` : `⚠ Error al guardar: ${r.error}`;
      if (!r.ok && !this.saveErrorShown) { this.saveErrorShown = true; this.ui.banner(`No se pudo guardar la partida (${r.error}). Exporta tu clave desde Opciones.`, 'error'); }
    }

    // ------------------------------------------------------ OFFLINE / CATCH-UP
    simulateBlock(days) {
      const s = this.state;
      const before = { age: F.age(s), gold: s.player.lifeGoldEarned };
      this.ctx.bulkCounts = {};
      CT.Sound.muted = true;
      const res = Sim.advance(s, this.ctx, days, { maxStep: Math.max(1, days / 150000), bulk: true, autoReincarnate: true });
      CT.Sound.muted = document.hidden;
      return {
        simDays: res.simulatedDays, lives: res.lives,
        ageFrom: before.age, ageTo: F.age(s),
        levels: this.ctx.bulkCounts.levelup || 0,
        gold: res.lives ? s.player.lifeGoldEarned : s.player.lifeGoldEarned - before.gold,
        died: !s.player.isAlive,
      };
    }

    runOfflineProgress() {
      const s = this.state;
      const awaySec = (Date.now() - s.meta.lastSavedAt) / 1000;
      if (awaySec < B.OFFLINE_MIN_SECONDS || s.settings.isPaused) return;
      if (!s.player.isAlive) {
        if (!(this.ctx.mods.autoReincarnateUnlocked && s.planner.autoReincarnate)) return;
        Sim.reincarnate(s, this.ctx);
      }
      const capSec = this.ctx.mods.offlineCapHours * 3600;
      const simSec = Math.min(awaySec, capSec);
      const t0 = performance.now();
      const r = this.simulateBlock((simSec * 1000) / B.DAY_MS);
      this.processEvents(true);
      this.ui.structDirty = this.ui.housingDirty = this.ui.grimoireDirty = true;
      if (awaySec > 30) {
        this.ui.showOffline({
          awaySec, simSec: (r.simDays * B.DAY_MS) / 1000, capped: awaySec > capSec, capHours: this.ctx.mods.offlineCapHours,
          ageFrom: r.ageFrom, ageTo: r.ageTo, gold: r.gold, levels: r.levels, lives: r.lives, died: r.died,
        });
      }
      this.ui.log(`Progreso sin conexión: ${U.fmtDuration(simSec)} simulados en ${Math.round(performance.now() - t0)} ms.`, 'highlight');
    }

    /** Vuelta a una pestaña que estuvo congelada > 60 s. */
    runCatchUp(days, realSec) {
      const r = this.simulateBlock(days);
      this.processEvents(true);
      this.ui.structDirty = this.ui.housingDirty = this.ui.grimoireDirty = true;
      this.ui.log(`Pestaña en segundo plano: ${U.fmtDuration(realSec)} recuperados (+${r.levels} niveles).`, 'highlight');
    }

    // ------------------------------------------------------------- EVENTOS
    processEvents(quiet = false) {
      const evs = this.ctx.events;
      if (!evs.length) return;
      this.ctx.events = [];
      for (const ev of evs) {
        switch (ev.type) {
          case 'levelup':
            if (!quiet) CT.Sound.playLevelUp();
            this.ui.grimoireDirty = true;
            break;
          case 'milestone': {
            const def = CT.taskDef(ev.id);
            this.ui.log(`HITO · ${def.name} Lv ${ev.level}: «${ev.bp.name}» — ${ev.bp.desc}`, 'milestone');
            if (!quiet) CT.Sound.playMilestone();
            this.ui.structDirty = true;
            break;
          }
          case 'unlock': {
            const def = CT.taskDef(ev.id);
            this.ui.log(`${ev.first ? '¡Nueva senda descubierta' : 'Senda recuperada'}: ${def.name}!`, 'highlight');
            this.ui.structDirty = true;
            break;
          }
          case 'eureka':
            if (!quiet) { CT.Sound.playEureka(); this.ui.eurekaSpark(ev.amount); }
            this.ui.log(`¡EUREKA! Comprensión súbita en ${CT.taskDef(ev.id).name} (+${U.fmt(ev.amount)} XP).`, 'eureka');
            break;
          case 'evicted':
            this.ui.log(`Sin oro para el alquiler: desahuciado a ${CT.HOUSING[ev.id].name}.`, 'danger');
            if (!quiet) CT.Sound.playWarning();
            this.ui.housingDirty = true;
            break;
          case 'condition':
            this.ui.log(`${CT.CONDITIONS[ev.id].icon} Condición: ${CT.CONDITIONS[ev.id].name}. ${CT.CONDITIONS[ev.id].desc}`, 'danger');
            if (!quiet) CT.Sound.playWarning();
            break;
          case 'forget':
            if (!this.forgetLogged) { this.forgetLogged = true; this.ui.log('Desvarío: olvidas fragmentos de lo estudiado…', 'danger'); }
            break;
          case 'planner':
            this.ui.log(`Planificador: ${this.ui.ruleText(ev.rule)}.`, 'planner');
            this.ui.structDirty = this.ui.plannerDirty = this.ui.housingDirty = true;
            break;
          case 'housing':
          case 'active':
            this.ui.structDirty = this.ui.housingDirty = true;
            break;
          case 'reincarnate':
            this.afterReincarnate(ev.summary, quiet);
            break;
          case 'death':
            if (!quiet) this.handleDeath(false);
            break;
        }
      }
    }

    // ---------------------------------------------------- MUERTE / RENACER
    handleDeath(fromLoad) {
      const s = this.state;
      if (!s.player.deathSummary) s.player.deathSummary = Sim.buildSummary(s, this.ctx, 'senescence');
      if (this.ctx.mods.autoReincarnateUnlocked && s.planner.autoReincarnate && s.player.deathSummary.cause !== 'voluntary') {
        this.ui.log(`Mueres a los ${s.player.deathSummary.age.toFixed(1)} años. La Rueda del Samsara gira…`, 'highlight');
        this.reincarnate();
        return;
      }
      if (!fromLoad) CT.Sound.playDeathBell();
      this.ui.log(`Has fallecido a los ${s.player.deathSummary.age.toFixed(1)} años.`, 'danger');
      this.ui.showDeath(s.player.deathSummary);
      this.updateRespecHint();
      this.save();
    }

    reincarnate() {
      Sim.reincarnate(this.state, this.ctx);
      this.processEvents();
    }

    afterReincarnate(summary, quiet) {
      if (!quiet) CT.Sound.playReincarnationChant();
      this.forgetLogged = false;
      this.ui.hideDeath();
      this.ui.banner(null);
      this.ui.structDirty = this.ui.housingDirty = this.ui.plannerDirty = this.ui.grimoireDirty = true;
      this.lattice.requestRender();
      this.lattice.updateInspector();
      this.updateRespecHint();
      this.ui.log(`RENACES en el Ciclo #${this.state.player.reincarnationCount + 1}: +${U.fmtInt(summary.karma)} Karma, Eco Álmico +${(summary.echoGain * 100).toFixed(1)}%.`, 'karma');
      if (this.state.player.reincarnationCount === B.PLANNER_UNLOCK_REINCARNATIONS) this.ui.log('📜 El Planificador Vital se ha desbloqueado.', 'highlight');
      this.save();
    }

    pendingKarma() {
      const p = this.state.player;
      return p.deathSummary ? p.deathSummary.karma : F.pendingKarma(this.state, this.ctx.mods);
    }

    updateRespecHint() {
      const info = this.lattice.respecInfo();
      const el = $('respec-hint');
      if (el) el.textContent = info.free ? 'Purificar ahora es gratis (100%).' : `Purificar ahora devuelve el ${B.RESPEC_REFUND_LATE * 100}%. Gratis el primer año de cada vida.`;
    }

    // ------------------------------------------------------------- ACCIONES
    setActive(kind, id) {
      if (!this.state.player.isAlive) return;
      if (Sim.setActive(this.state, this.ctx, kind, id)) {
        CT.Sound.playClick();
        this.processEvents();
      }
    }

    moveHousing(id) {
      const r = Sim.moveHousing(this.state, this.ctx, id);
      if (r.ok) {
        CT.Sound.playClick();
        this.ui.log(`Te has mudado a ${CT.HOUSING[id].name}.`, 'highlight');
        this.processEvents();
      } else if (r.reason === 'deposit') {
        this.ui.log(`Fianza insuficiente: necesitas ${U.fmt(r.deposit)} oro.`, 'danger');
      }
      this.ui.housingDirty = true;
    }

    onTreeChanged() {
      Sim.refresh(this.state, this.ctx);
      this.ui.structDirty = this.ui.housingDirty = this.ui.plannerDirty = this.ui.grimoireDirty = true;
      this.lattice.requestRender();
      this.ui.syncSettings();
      this.updateRespecHint();
      this.save();
    }

    log(msg, kind) { this.ui.log(msg, kind); }

    addRule(rule) {
      const pl = this.state.planner;
      const clean = Save.sanitizeRule({ ...rule, id: pl.nextId, enabled: true, fired: false });
      if (!clean) { this.ui.log('Regla inválida.', 'danger'); return; }
      pl.nextId++;
      pl.rules.push(clean);
      CT.Sound.playClick();
      this.ui.plannerDirty = true;
      this.save();
    }

    ruleAction(id, action) {
      const rules = this.state.planner.rules;
      const i = rules.findIndex((r) => r.id === id);
      if (i < 0) return;
      if (action === 'del') rules.splice(i, 1);
      if (action === 'toggle') rules[i].enabled = !rules[i].enabled;
      if (action === 'up' && i > 0) [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]];
      if (action === 'down' && i < rules.length - 1) [rules[i + 1], rules[i]] = [rules[i], rules[i + 1]];
      CT.Sound.playClick();
      this.ui.plannerDirty = true;
    }

    setAutoReincarnate(v) { this.state.planner.autoReincarnate = !!v; this.save(); }
    setSound(v) { this.state.settings.soundEnabled = !!v; CT.Sound.setEnabled(v); this.ui.syncSettings(); }
    setParticles(v) { this.state.settings.particlesEnabled = !!v; this.ui.syncSettings(); }

    initControls() {
      $('btn-pause').addEventListener('click', () => {
        this.state.settings.isPaused = !this.state.settings.isPaused;
        CT.Sound.playClick();
        this.ui.syncSettings();
      });
      if (CT.DEV) {
        $('dev-speed-group').classList.remove('hidden');
        document.querySelectorAll('#dev-speed-group .btn-time').forEach((b) => b.addEventListener('click', () => {
          this.state.settings.timeScale = +b.dataset.speed;
          this.ui.syncSettings();
        }));
      }
      $('btn-audio-toggle').addEventListener('click', () => this.setSound(!this.state.settings.soundEnabled));

      $('btn-modal-reincarnate').addEventListener('click', () => this.reincarnate());
      $('btn-modal-tree').addEventListener('click', () => {
        this.ui.hideDeath();
        this.ui.showTab('tab-lattice');
        this.ui.banner('Estás en el Umbral entre vidas. Purificar el Árbol es gratis ahora. Cuando estés listo:', 'info');
        const b = $('system-banner');
        const btn = document.createElement('button');
        btn.className = 'btn-primary banner-btn';
        btn.textContent = 'Trascender';
        btn.addEventListener('click', () => this.reincarnate());
        b.appendChild(btn);
      });
      $('btn-voluntary-reincarnate').addEventListener('click', () => {
        if (!this.state.player.isAlive) { this.ui.showDeath(this.state.player.deathSummary); return; }
        if (confirm('¿Inmolar tu recipiente mortal ahora? Recibirás el Karma y el Eco de esta vida.')) {
          Sim.die(this.state, this.ctx, 'voluntary');
          this.processEvents();
        }
      });
      $('btn-offline-close').addEventListener('click', () => $('offline-modal').classList.add('hidden'));

      $('btn-manual-save').addEventListener('click', () => { this.save(); CT.Sound.playClick(); });
      $('btn-export-save').addEventListener('click', () => {
        const str = Save.exportString(this.state);
        const fallback = () => prompt('Copia tu clave de partida:', str);
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(str).then(() => this.ui.log('Clave de partida copiada al portapapeles.', 'highlight'), fallback);
        } else fallback();
      });
      $('btn-import-save').addEventListener('click', () => {
        const raw = prompt('Pega tu clave de partida (CT2:… o del prototipo v1):');
        if (!raw) return;
        try {
          const { state, warnings } = Save.importString(raw);
          if (!confirm('¿Sustituir la partida actual por la importada?')) return;
          this.state = state;
          state.meta.lastSavedAt = Date.now();
          this.ctx = Sim.createContext(state);
          this.save();
          location.reload();
          if (warnings.length) console.warn(warnings);
        } catch (e) {
          alert(`No se pudo importar: ${e.message}`);
        }
      });
      $('btn-hard-reset').addEventListener('click', () => {
        if (!confirm('¿Destruir el alma para siempre? Se borrarán Karma, Árbol, récords y Eco Álmico.')) return;
        this.resetting = true; // impide que pagehide vuelva a guardar
        Save.clear();
        location.reload();
      });
    }
  }

  /** Partículas de fondo: HiDPI, movimiento por delta de tiempo, pausa al ocultar. */
  function initAmbientCanvas(isEnabled) {
    const canvas = $('ambient-canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, last = performance.now();
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const parts = Array.from({ length: 45 }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 2 + 0.5,
      vy: -(Math.random() * 24 + 6), vx: (Math.random() - 0.5) * 12, a: Math.random() * 0.5 + 0.2,
    }));
    const tick = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000); // px/s: igual a 60 Hz que a 144 Hz
      last = t;
      if (!document.hidden) {
        ctx.clearRect(0, 0, w, h);
        if (isEnabled() && !reduced) {
          for (const p of parts) {
            p.y += p.vy * dt; p.x += p.vx * dt;
            if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
            if (p.x < -5) p.x = w + 5;
            if (p.x > w + 5) p.x = -5;
            ctx.fillStyle = `rgba(212,175,55,${p.a})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { resize };
  }

  window.addEventListener('DOMContentLoaded', () => {
    CT.Engine = new GameEngine();
    window.Engine = CT.Engine; // depuración desde la consola
    CT.Engine.init().catch((e) => {
      console.error(e);
      document.body.insertAdjacentHTML('afterbegin', `<div class="system-banner error">Error crítico al iniciar: ${CT.U.esc(e.message)}</div>`);
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
