/**
 * CHRONO TRANSCENDENCE — Contenido del juego (trabajos, disciplinas, hogares).
 *
 * Todo efecto es DECLARATIVO: un objeto `effect` con claves que js/modifiers.js
 * agrega genéricamente. Así el texto mostrado y la mecánica no pueden divergir
 * (en el prototipo v1 varios hitos y nodos decían una cosa y hacían otra).
 *
 * Claves aditivas: xpGlobal, xpPhysical, xpMartial, xpIntellect, xpArcane, xp_<tarea>,
 *   gold, goldPhysical, goldMartial, goldIntellect, goldArcane, gold_<tarea>,
 *   maxAge, maxAgePct, agingThreshold, agingSlope, mentalThreshold, mentalSlope,
 *   agingRate, karma, eurekaChance, xpCost, housingCost, echoGain, memoryPower,
 *   offlineCapHours, plannerSlots, attr_<atributo>, muscleMemory, pastLifeXp, tithe
 * Claves multiplicativas (sufijo Mult): xpGlobalMult, xpPhysicalMult, xpIntellectMult,
 *   xpArcaneMult, goldMult, maxAgeMult, karmaMult, eurekaMult, housingCostMult
 * Banderas: unlockPlanner, autoReincarnate
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});

  CT.CATEGORIES = {
    physical: { name: 'Física', color: '#ef8a5a' },
    martial: { name: 'Marcial', color: '#ef4444' },
    intellect: { name: 'Intelectual', color: '#38bdf8' },
    arcane: { name: 'Arcana', color: '#a855f7' },
  };

  CT.JOBS = {
    beggar: {
      id: 'beggar', name: 'Mendigo del Rellano', icon: '🥣', category: 'physical',
      desc: 'Mendigas limosnas en el mercado de almas. Malvives, pero forjas paciencia.',
      income: 0.9, difficulty: 1, requires: [],
      breakpoints: {
        10: { name: 'Picaresca Callejera', desc: '-10% coste de alojamiento.', effect: { housingCost: 0.10 } },
        25: { name: 'Vagabundo Iluminado', desc: '+30% XP en Meditación.', effect: { xp_meditation: 0.30 } },
        50: { name: 'Ojo del Pobre', desc: '+15% oro global.', effect: { gold: 0.15 } },
      },
    },
    laborer: {
      id: 'laborer', name: 'Jornalero de Minas', icon: '⛏️', category: 'physical',
      desc: 'Cargas bloques de mineral en las canteras profundas. Forja fuerza bruta.',
      income: 4, difficulty: 2.5,
      requires: [{ type: 'job', id: 'beggar', level: 10 }, { type: 'attr', id: 'strength', value: 1.12 }],
      breakpoints: {
        10: { name: 'Músculo de Pedernal', desc: '+0.10 Fuerza.', effect: { attr_strength: 0.10 } },
        25: { name: 'Resistencia del Minero', desc: '+3 años de vida máxima.', effect: { maxAge: 3 } },
        50: { name: 'Piel de Basalto', desc: 'Los Achaques físicos avanzan un 20% más lento.', effect: { agingSlope: 0.20 } },
      },
    },
    scribe: {
      id: 'scribe', name: 'Escriba del Archivo Gris', icon: '📜', category: 'intellect',
      desc: 'Copias códices heréticos a la luz de una vela. Paga mejor que la mina, si sabes concentrarte.',
      income: 10, difficulty: 5,
      requires: [{ type: 'skill', id: 'concentration', level: 10 }, { type: 'job', id: 'beggar', level: 15 }],
      breakpoints: {
        10: { name: 'Caligrafía Ritual', desc: '+15% XP intelectual.', effect: { xpIntellect: 0.15 } },
        25: { name: 'Índice Prohibido', desc: '+0.15 Intelecto.', effect: { attr_intellect: 0.15 } },
        50: { name: 'Bibliotecario Eterno', desc: 'La Neblina Senil llega 5 años más tarde.', effect: { mentalThreshold: 5 } },
      },
    },
    guard: {
      id: 'guard', name: 'Guardia de Bastión', icon: '🛡️', category: 'martial',
      desc: 'Patrullas los muros contra horrores nocturnos. Requiere destreza marcial.',
      income: 25, difficulty: 12,
      requires: [{ type: 'skill', id: 'swordsmanship', level: 20 }, { type: 'job', id: 'laborer', level: 20 }],
      breakpoints: {
        10: { name: 'Disciplina Militar', desc: '+20% XP física y marcial.', effect: { xpPhysical: 0.20, xpMartial: 0.20 } },
        25: { name: 'Paga de Élite', desc: '+20% oro global.', effect: { gold: 0.20 } },
        50: { name: 'Veterano de Hierro', desc: '+5 años de vida máxima.', effect: { maxAge: 5 } },
      },
    },
    alchemist_apprentice: {
      id: 'alchemist_apprentice', name: 'Aprendiz de Alquimista', icon: '⚗️', category: 'arcane',
      desc: 'Destilas elixires prohibidos y transmutas metales impuros.',
      income: 70, difficulty: 30,
      requires: [
        { type: 'skill', id: 'concentration', level: 30 },
        { type: 'skill', id: 'meditation', level: 30 },
        { type: 'job', id: 'scribe', level: 15 },
      ],
      breakpoints: {
        10: { name: 'Destilación Eficiente', desc: '+25% oro arcano.', effect: { goldArcane: 0.25 } },
        25: { name: 'Elixir de Juventud', desc: '+6 años de vida máxima.', effect: { maxAge: 6 } },
        50: { name: 'Piedra Filosofal Menor', desc: '+0.20 Arcana y +15% Karma.', effect: { attr_arcana: 0.20, karma: 0.15 } },
      },
    },
    chronomancer: {
      id: 'chronomancer', name: 'Cronomante del Reloj Roto', icon: '⌛', category: 'arcane',
      desc: 'Remiendas fisuras en el tejido temporal. El oficio de quien ya ha muerto cien veces.',
      income: 320, difficulty: 120,
      requires: [
        { type: 'skill', id: 'arcane_mathematics', level: 40 },
        { type: 'job', id: 'alchemist_apprentice', level: 30 },
        { type: 'skill', id: 'vitalism', level: 25 },
      ],
      breakpoints: {
        10: { name: 'Segundo Robado', desc: 'Envejeces un 5% más lento.', effect: { agingRate: 0.05 } },
        25: { name: 'Bucle Menor', desc: '+3 puntos al Eco Álmico de cada vida.', effect: { echoGain: 0.03 } },
        50: { name: 'Paradoja Estable', desc: '+25% Karma y +10% XP global.', effect: { karma: 0.25, xpGlobal: 0.10 } },
      },
    },
  };

  CT.SKILLS = {
    meditation: {
      id: 'meditation', name: 'Meditación del Vacío', icon: '🧘', category: 'intellect',
      desc: 'Aquietas el ruido de la carne. Cada nivel retrasa 0.5 años la Neblina Senil.',
      difficulty: 1.5, requires: [],
      breakpoints: {
        10: { name: 'Calma Interior', desc: '+2 años de vida máxima.', effect: { maxAge: 2 } },
        25: { name: 'Despertar Místico', desc: '+40% probabilidad de Eureka.', effect: { eurekaChance: 0.40 } },
        50: { name: 'Mente Trascendente', desc: '+15% XP global y la Neblina avanza a la mitad.', effect: { xpGlobal: 0.15, mentalSlope: 0.5 } },
      },
    },
    swordsmanship: {
      id: 'swordsmanship', name: 'Esgrima de la Sombra', icon: '🗡️', category: 'physical',
      desc: 'Cortes y paradas con acero negro. +0.02 Fuerza por nivel.',
      difficulty: 2, requires: [],
      breakpoints: {
        10: { name: 'Filo Certero', desc: '+15% XP física.', effect: { xpPhysical: 0.15 } },
        25: { name: 'Corte de Alma', desc: '+0.20 Fuerza.', effect: { attr_strength: 0.20 } },
        50: { name: 'Maestro de Armas', desc: '+30% oro marcial y +20% XP marcial.', effect: { goldMartial: 0.30, xpMartial: 0.20 } },
      },
    },
    concentration: {
      id: 'concentration', name: 'Concentración Profunda', icon: '🧠', category: 'intellect',
      desc: 'Enfocas la mente en un solo punto. +0.02 Intelecto por nivel.',
      difficulty: 4, requires: [{ type: 'skill', id: 'meditation', level: 5 }],
      breakpoints: {
        10: { name: 'Mente Inquebrantable', desc: '+15% XP intelectual.', effect: { xpIntellect: 0.15 } },
        25: { name: 'Hiper-Cálculo', desc: '+0.15 Intelecto.', effect: { attr_intellect: 0.15 } },
        50: { name: 'Enfoque Absoluto', desc: '+15% XP global.', effect: { xpGlobal: 0.15 } },
      },
    },
    vitalism: {
      id: 'vitalism', name: 'Vitalismo Alquímico', icon: '🌿', category: 'arcane',
      desc: 'Estudias el flujo de la sangre y la savia. +0.015 Vitalidad por nivel (≈ +0.4 años de vida).',
      difficulty: 15,
      requires: [{ type: 'skill', id: 'meditation', level: 20 }, { type: 'job', id: 'laborer', level: 15 }],
      breakpoints: {
        10: { name: 'Pulso Lento', desc: 'Los Achaques empiezan 4 años más tarde.', effect: { agingThreshold: 4 } },
        25: { name: 'Savia Perenne', desc: '+5% vida máxima.', effect: { maxAgePct: 0.05 } },
        50: { name: 'Corazón Inagotable', desc: 'Envejeces un 8% más lento.', effect: { agingRate: 0.08 } },
      },
    },
    arcane_mathematics: {
      id: 'arcane_mathematics', name: 'Matemáticas Arcanas', icon: '📐', category: 'arcane',
      desc: 'La geometría sagrada que gobierna la reencarnación. +0.02 Arcana por nivel.',
      difficulty: 40,
      requires: [{ type: 'skill', id: 'concentration', level: 25 }, { type: 'job', id: 'scribe', level: 10 }],
      breakpoints: {
        10: { name: 'Ecuaciones del Destino', desc: '+15% Karma.', effect: { karma: 0.15 } },
        25: { name: 'Singularidad', desc: '+0.20 Arcana.', effect: { attr_arcana: 0.20 } },
        50: { name: 'Teorema de la Inmortalidad', desc: '+10 años de vida máxima.', effect: { maxAge: 10 } },
      },
    },
  };

  /** Contribución de niveles a atributos (por nivel). */
  CT.ATTRIBUTE_SOURCES = {
    strength: { swordsmanship: 0.02, laborer: 0.008, guard: 0.012 },
    intellect: { concentration: 0.02, scribe: 0.01, meditation: 0.004 },
    vitality: { vitalism: 0.015, laborer: 0.003 },
    arcana: { arcane_mathematics: 0.02, alchemist_apprentice: 0.01, chronomancer: 0.02 },
  };

  CT.ATTRIBUTES = {
    strength: { name: 'Fuerza Física', icon: '💪', desc: 'Cada punto sobre 1 suma +50% XP física y marcial (×0.5).' },
    intellect: { name: 'Intelecto', icon: '📖', desc: 'Cada punto sobre 1 suma +50% XP intelectual (×0.5).' },
    vitality: { name: 'Vitalidad', icon: '🩸', desc: 'Cada punto sobre 1 suma +25 años de vida máxima.' },
    arcana: { name: 'Afinidad Arcana', icon: '🔮', desc: 'Cada punto sobre 1 suma +50% XP arcana y +50% Karma.' },
  };

  /**
   * Hogares. "street" es gratuito pero penaliza: es el punto de partida obligado,
   * porque el Mendigo a nivel 0 gana menos de lo que cuesta la tienda.
   */
  CT.HOUSING = {
    street: {
      id: 'street', name: 'Soportal de la Catedral', rent: 0, xpMult: 0.85, years: -4,
      desc: 'Duermes sobre losas heladas. Gratis, pero el frío roba años y concentración.', effect: {},
    },
    tent: {
      id: 'tent', name: 'Tienda Raída', rent: 1, xpMult: 1.0, years: 0,
      desc: 'Telas andrajosas en un rincón sucio. Apenas te protege de la intemperie.', effect: {},
    },
    hovel: {
      id: 'hovel', name: 'Choza de Madera', rent: 6, xpMult: 1.12, years: 3,
      desc: 'Un techo sólido y un hogar de leña. El descanso acelera el aprendizaje.', effect: {},
    },
    stone_house: {
      id: 'stone_house', name: 'Casa de Piedra del Gremio', rent: 28, xpMult: 1.25, years: 6,
      desc: 'Muros gruesos, cama de plumas y una pequeña biblioteca heredada.',
      effect: { mentalThreshold: 3 },
    },
    mage_tower: {
      id: 'mage_tower', name: 'Torre del Mago Abandonada', rent: 150, xpMult: 1.45, years: 12,
      desc: 'Grimorios, observatorio estelar y manantiales de maná vital.',
      effect: { xpArcane: 0.25, mentalThreshold: 5 },
    },
  };
  CT.HOUSING_ORDER = ['street', 'tent', 'hovel', 'stone_house', 'mage_tower'];

  /** Condiciones de senescencia (texto de UI; la mecánica está en formulas.js). */
  CT.CONDITIONS = {
    aches: {
      name: 'Achaques', icon: '🦴', kind: 'physical',
      desc: 'El cuerpo cede. Las tareas físicas y marciales pierden eficacia cada año.',
    },
    fog: {
      name: 'Neblina Senil', icon: '🌫️', kind: 'mental',
      desc: 'Sin meditación, la mente se nubla: la XP intelectual y arcana disminuye cada año. Cada nivel de Meditación la retrasa 0.5 años.',
    },
    delirium: {
      name: 'Desvarío', icon: '🌀', kind: 'mental',
      desc: 'La mente vaga: los Eureka son la mitad de probables y cada estación olvidas un 2% de la barra de la disciplina activa (máx. 10 días de estudio).',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
