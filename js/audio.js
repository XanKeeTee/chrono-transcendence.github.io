/**
 * CHRONO TRANSCENDENCE — Sintetizador procedural (Web Audio API).
 *
 * Política de autoplay: el AudioContext sólo se crea/reanuda dentro de un gesto
 * del usuario (pointerdown/keydown). Antes de eso, o con la pestaña oculta, los
 * sonidos se DESCARTAN en vez de encolarse (en v1 un contexto suspendido
 * acumulaba decenas de campanas que sonaban todas juntas al reanudar).
 * Además: bus maestro con compresor, límite de frecuencia por sonido y
 * desconexión de nodos al terminar.
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.muted = false; // silencio temporal (simulación masiva, pestaña oculta)
      this.lastPlayed = {};
      this.unlocked = false;
    }

    /** Llamar una vez: engancha el desbloqueo al primer gesto del usuario. */
    attachUnlock() {
      const unlock = () => {
        this.unlock();
        if (this.unlocked) {
          window.removeEventListener('pointerdown', unlock, true);
          window.removeEventListener('keydown', unlock, true);
        }
      };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else if (this.unlocked) this.ctx.resume().catch(() => {});
      });
    }

    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.value = -18;
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.8;
          this.master.connect(comp);
          comp.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        this.unlocked = true;
      } catch (e) {
        this.ctx = null;
      }
    }

    setEnabled(v) { this.enabled = !!v; }

    /** ¿Se puede sonar ahora? Además aplica un límite de frecuencia por id. */
    canPlay(id, minGapMs) {
      if (!this.enabled || this.muted || !this.ctx || this.ctx.state !== 'running') return false;
      const now = performance.now();
      if (this.lastPlayed[id] && now - this.lastPlayed[id] < minGapMs) return false;
      this.lastPlayed[id] = now;
      return true;
    }

    tone(freq, type, start, dur, vol, glideTo) {
      const t0 = this.ctx.currentTime + start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }

    playClick() {
      if (!this.canPlay('click', 40)) return;
      this.tone(440, 'sine', 0, 0.05, 0.05, 880);
    }

    playLevelUp() {
      if (!this.canPlay('level', 300)) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 'triangle', i * 0.06, 0.35, 0.06));
    }

    playMilestone() {
      if (!this.canPlay('milestone', 800)) return;
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 'triangle', i * 0.07, 0.6, 0.06));
    }

    playEureka() {
      if (!this.canPlay('eureka', 500)) return;
      [1318.51, 1567.98, 2093].forEach((f, i) => this.tone(f, 'sine', i * 0.05, 0.25, 0.045));
    }

    playWarning() {
      if (!this.canPlay('warn', 1500)) return;
      this.tone(220, 'square', 0, 0.25, 0.04, 180);
    }

    playDeathBell() {
      if (!this.canPlay('death', 2000)) return;
      this.tone(110, 'sawtooth', 0, 1.8, 0.12, 82.41);
      this.tone(55, 'sine', 0, 2.2, 0.15);
    }

    playReincarnationChant() {
      if (!this.canPlay('reinc', 2000)) return;
      [220, 277.18, 329.63, 440, 554.37].forEach((f, i) => this.tone(f, 'sine', i * 0.04, 2.0, 0.04));
    }
  }

  CT.Sound = new SoundEngine();
})(typeof window !== 'undefined' ? window : globalThis);
