/**
 * CHRONO TRANSCENDENCE — Constantes de balance (ÚNICA fuente de verdad).
 * Todas las curvas del juego leen de aquí. tools/balance-sim.js las usa para
 * simular semanas de partida en segundos y verificar el ritmo "ultra slow-burn".
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});

  CT.SAVE_KEY = 'chrono_transcendence_save_v2';
  CT.SAVE_BACKUP_KEY = 'chrono_transcendence_save_v2_backup';
  CT.LEGACY_SAVE_KEY = 'chrono_transcendence_save'; // prototipo v1
  CT.SAVE_VERSION = 2;

  CT.BALANCE = {
    // ---------------------------------------------------------------- TIEMPO
    // Paso fijo de simulación: 100 ms reales = 0.4 días. 1 año = 360 días = 90 s.
    // Una primera vida (14 → ~55 años) dura ≈ 1 hora real a velocidad 1x.
    TICK_MS: 100,
    DAY_MS: 250,
    DAYS_PER_YEAR: 360,
    START_AGE: 14,
    BASE_MAX_AGE: 55,
    MAX_CATCHUP_TICKS_PER_FRAME: 50, // si hay más atraso, se usa la vía rápida (bulk)
    OFFLINE_BASE_CAP_HOURS: 12,
    OFFLINE_MIN_SECONDS: 5,
    AUTOSAVE_MS: 15000,

    // ---------------------------------------------------------- EXPERIENCIA
    // XP_req(L) = XP_BASE · dificultad · (L+1)^XP_POLY · XP_GROWTH^L
    // Polinomio suave al inicio + crecimiento exponencial = "muros" reales.
    XP_BASE: 150,
    XP_POLY: 1.2,
    XP_GROWTH: 1.12,
    XP_GAIN_PER_DAY: 10, // XP/día base de cualquier tarea antes de multiplicadores
    MAX_XP_COST_REDUCTION: 0.5,

    // ------------------------------------------------------------- ECONOMÍA
    INCOME_PER_LEVEL: 0.04, // +4% de sueldo por nivel del trabajo (lineal)
    DEPOSIT_DAYS: 30, // fianza de mudanza = 30 días de alquiler por adelantado

    // ------------------------------------------------------------ PRESTIGIO
    // Karma = floor( (max(0, Niveles - KARMA_FLOOR) / KARMA_DIV)^KARMA_EXP · multKarma )
    KARMA_FLOOR: 10,
    KARMA_DIV: 8,
    KARMA_EXP: 1.25,
    // Memoria por tarea: 1 + MEMORY_COEF · ln(1 + récord / MEMORY_SCALE)
    MEMORY_COEF: 0.30,
    MEMORY_SCALE: 5,
    // Eco Álmico (global): cada vida multiplica por (1 + ganancia),
    // ganancia = 5% + 10% · R/(R + ECHO_HALF), R = niveles de récord nuevos.
    ECHO_MIN_RECORDS: 5,
    ECHO_MIN_GAIN: 0.05,
    ECHO_BONUS_GAIN: 0.10,
    ECHO_HALF: 30,
    ECHO_PER_RECORD_BELOW_MIN: 0.015,
    // Karma Latente: el Karma SIN gastar da XP global = 1 + COEF · log2(1 + karma / SCALE).
    // Sumidero infinito: evita el estancamiento cuando el árbol está completo y
    // crea la tensión "gastar en nodos vs. atesorar".
    LATENT_KARMA_COEF: 0.15,
    LATENT_KARMA_SCALE: 25,
    FREE_RESPEC_YEARS: 1, // purificar el árbol es gratis el primer año de vida
    RESPEC_REFUND_LATE: 0.75,

    // ------------------------------------------------------------ SENESCENCIA
    AGING_THRESHOLD: 40, // inicio de Achaques físicos
    AGING_SLOPE: 0.02, // -2% eficacia física por año
    AGING_FLOOR: 0.25,
    MENTAL_THRESHOLD: 50, // inicio de Neblina Senil (sin meditar)
    MENTAL_MEDITATION_DELAY: 0.5, // años de retraso por nivel de Meditación
    MENTAL_MEDITATION_DELAY_CAP: 35,
    MENTAL_SLOPE: 0.015,
    MENTAL_FLOOR: 0.55,
    DELIRIUM_OFFSET: 10, // Desvarío: 10 años después de la Neblina
    DELIRIUM_FORGET_EVERY_DAYS: 90, // cada estación...
    DELIRIUM_FORGET_FRACTION: 0.02, // ...olvida un 2% de la barra de la disciplina activa
    DELIRIUM_FORGET_MAX_DAYS: 10, // pero nunca más de 10 días de XP (≈ -11% efectivo: leve, no un muro)

    // ----------------------------------------------------------------- EUREKA
    EUREKA_CHANCE_PER_DAY: 0.003,
    EUREKA_BURST_DAYS: 30, // un Eureka concede 30 días de XP de golpe

    // ------------------------------------------------------------ PLANIFICADOR
    PLANNER_UNLOCK_REINCARNATIONS: 5,
    PLANNER_BASE_SLOTS: 2,

    // --------------------------------------------------------------- ATRIBUTOS
    ATTR_XP_WEIGHT: 0.5, // (atributo - 1) · 0.5 se suma al multiplicador de su categoría
    VITALITY_YEARS: 25, // años de vida por punto de Vitalidad sobre 1
    ARCANA_KARMA_WEIGHT: 0.5,
  };

  /** Modo desarrollo (?dev=1): habilita velocidades altas para pruebas. */
  CT.DEV = typeof location !== 'undefined' && /[?&]dev=1/.test(location.search);
})(typeof window !== 'undefined' ? window : globalThis);
