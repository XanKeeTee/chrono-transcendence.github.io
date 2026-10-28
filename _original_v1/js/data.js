/**
 * CHRONO TRANSCENDENCE — Game Data & Constants
 * Definitions for Jobs, Skills, Housing, Celestial Lattice Nodes, and Initial State.
 */

const GAME_CONSTANTS = {
  DAYS_PER_YEAR: 12,
  DAY_DURATION_MS: 1000, // 1 game day = 1000ms real time at 1x
  BASE_AGING_THRESHOLD: 45, // years before physical penalty
  BASE_MAX_AGE: 70,
  BASE_START_AGE: 14.0,
  XP_EXPONENT: 2.8, // Aggressive polynomial curve: Base * (Level ^ 2.8)
};

const JOBS_DATA = {
  beggar: {
    id: 'beggar',
    name: 'Mendigo del Rellano',
    category: 'physical',
    icon: '🥣',
    desc: 'Mendigas limosnas en el mercado de almas. Malvives pero forjas paciencia y templanza.',
    baseIncome: 0.25, // gold per day
    baseXp: 10,
    requires: null,
    breakpoints: {
      10: { name: 'Picaresca Callejera', desc: 'Ahorras 15% en costes diarios de alojamiento.' },
      25: { name: 'Vagabundo Iluminado', desc: '+50% velocidad de estudio para Meditación.' },
      50: { name: 'Ojo del Pobre', desc: '+25% de oro en cualquier trabajo mundano.' }
    }
  },
  laborer: {
    id: 'laborer',
    name: 'Jornalero de Minas',
    category: 'physical',
    icon: '⛏️',
    desc: 'Cargas bloques de mineral pesado en las canteras profundas. Desarrolla fuerza bruta.',
    baseIncome: 1.40,
    baseXp: 28,
    requires: { job: 'beggar', level: 5, stat: 'strength', minStat: 1.15 },
    breakpoints: {
      10: { name: 'Músculo de Pedernal', desc: '+15% Fuerza Física permanente.' },
      25: { name: 'Resistencia del Minero', desc: '+3 Años a la vida máxima.' },
      50: { name: 'Piel de Basalto', desc: 'Reduce un 20% los achaques de la vejez.' }
    }
  },
  guard: {
    id: 'guard',
    name: 'Guardia de Bastión',
    category: 'martial',
    icon: '🛡️',
    desc: 'Patrullas los muros de la ciudadela contra horrores nocturnos. Requiere destreza marcial.',
    baseIncome: 5.20,
    baseXp: 75,
    requires: { skill: 'swordsmanship', level: 10, job: 'laborer', jobLevel: 10 },
    breakpoints: {
      10: { name: 'Disciplina Militar', desc: '+25% XP en todas las habilidades físicas.' },
      25: { name: 'Paga de Élite', desc: '+25% Oro en todos los trabajos.' },
      50: { name: 'Veterano de Hierro', desc: '+5 Años a la vida máxima.' }
    }
  },
  alchemist_apprentice: {
    id: 'alchemist_apprentice',
    name: 'Aprendiz de Alquimista',
    category: 'arcane',
    icon: '⚗️',
    desc: 'Destilas elixires prohibidos y transmutas metales impuros. Requiere alto intelecto y concentración.',
    baseIncome: 16.50,
    baseXp: 180,
    requires: { skill: 'concentration', level: 12, skill2: 'meditation', level2: 15 },
    breakpoints: {
      10: { name: 'Destilación Eficiente', desc: '+35% Oro generado.' },
      25: { name: 'Elixir de Juventud', desc: '+6 Años a la vida máxima.' },
      50: { name: 'Piedra Filosofal Menor', desc: '+50% Afinidad Arcana y +30% Karma.' }
    }
  }
};

const SKILLS_DATA = {
  meditation: {
    id: 'meditation',
    name: 'Meditación del Vacío',
    category: 'intellect',
    icon: '🧘',
    desc: 'Aquietas el ruido de la carne para percibir la corriente del tiempo y el cosmos.',
    baseXp: 8,
    effectDesc: '+% XP Global y desbloqueo de chispas Eureka!',
    requires: null,
    breakpoints: {
      10: { name: 'Calma Interior', desc: '+2 Años a la vida máxima.' },
      25: { name: 'Despertar Místico', desc: '+5% probabilidad de Golpe Crítico Eureka! de XP x5.' },
      50: { name: 'Mente Trascendente', desc: '+30% XP Global permanente.' }
    }
  },
  swordsmanship: {
    id: 'swordsmanship',
    name: 'Esgrima de la Sombra',
    category: 'physical',
    icon: '🗡️',
    desc: 'Entrenas cortes y paradas con hojas de acero negro. Aumenta la fuerza y el vigor.',
    baseXp: 22,
    effectDesc: 'Aumenta la Fuerza Física y desbloquea ocupaciones marciales.',
    requires: null,
    breakpoints: {
      10: { name: 'Filo Certero', desc: '+15% XP en trabajos físicos.' },
      25: { name: 'Corte de Alma', desc: '+25% Fuerza Física.' },
      50: { name: 'Maestro de Armas', desc: '+50% Fuerza y +20% Oro en guardia.' }
    }
  },
  concentration: {
    id: 'concentration',
    name: 'Concentración Profunda',
    category: 'intellect',
    icon: '🧠',
    desc: 'Enfocas la mente en un solo punto matemático, ignorando las distracciones del mundo.',
    baseXp: 40,
    effectDesc: 'Aumenta el Intelecto y acelera el estudio intelectual.',
    requires: { skill: 'meditation', level: 5 },
    breakpoints: {
      10: { name: 'Mente Inquebrantable', desc: '+20% XP en habilidades intelectuales.' },
      25: { name: 'Hiper-Cálculo', desc: '+25% Intelecto.' },
      50: { name: 'Enfoque Absoluto', desc: '+40% XP general en todas las tareas.' }
    }
  },
  arcane_mathematics: {
    id: 'arcane_mathematics',
    name: 'Matemáticas Arcanas',
    category: 'arcane',
    icon: '📐',
    desc: 'Estudias la geometría sagrada que gobierna la reencarnación y la conservación de almas.',
    baseXp: 95,
    effectDesc: 'Multiplica el Karma ganado al morir y potencia la Afinidad Arcana.',
    requires: { skill: 'concentration', level: 10 },
    breakpoints: {
      10: { name: 'Ecuaciones del Destino', desc: '+20% Karma al reencarnar.' },
      25: { name: 'Singularidad', desc: '+35% Afinidad Arcana.' },
      50: { name: 'Teorema de la Inmortalidad', desc: '+10 Años de vida máxima.' }
    }
  }
};

const HOUSING_DATA = {
  tent: {
    id: 'tent',
    name: 'Tienda Raída',
    costPerDay: 0.05,
    healthBonusYears: 0,
    xpMultiplier: 1.0,
    desc: 'Telas andrajosas en un rincón sucio. Apenas te protege de la intemperie.'
  },
  hovel: {
    id: 'hovel',
    name: 'Choza de Madera',
    costPerDay: 0.85,
    healthBonusYears: 3,
    xpMultiplier: 1.15,
    desc: 'Un techo sólido con un hogar de leña. El descanso te permite absorber conocimientos más rápido.'
  },
  mage_tower: {
    id: 'mage_tower',
    name: 'Torre del Mago Abandonada',
    costPerDay: 6.50,
    healthBonusYears: 8,
    xpMultiplier: 1.40,
    desc: 'Un enclave lleno de grimorios, observatorio estelar y manantiales de maná vital.'
  }
};

/**
 * CELESTIAL LATTICE (Path of Exile style mini-tree with 12 interconnected nodes)
 */
const LATTICE_NODES = [
  {
    id: 'root_awakening',
    title: 'Despertar del Alma',
    type: 'minor',
    tier: 1,
    cost: 0, // Unlocked at start
    x: 400,
    y: 300,
    connections: ['iron_veins', 'inner_focus', 'transmuted_longevity'],
    flavor: 'El núcleo de tu memoria ancestral se activa en el cosmos.',
    effectText: '+20% Ganancia de XP Global en todas las tareas.',
    effect: { globalXpMult: 0.20 }
  },
  {
    id: 'iron_veins',
    title: 'Venas de Hierro',
    type: 'minor',
    tier: 2,
    cost: 2,
    x: 280,
    y: 230,
    connections: ['root_awakening', 'honed_instincts'],
    flavor: 'Tus vasos sanguíneos se templan con la densidad de metales primordiales.',
    effectText: '+5 Años a tu esperanza de vida máxima.',
    effect: { maxAgeBonus: 5 }
  },
  {
    id: 'honed_instincts',
    title: 'Instintos Afilados',
    type: 'minor',
    tier: 3,
    cost: 4,
    x: 160,
    y: 190,
    connections: ['iron_veins', 'muscle_memory'],
    flavor: 'Tus reflejos reaccionan antes de que el pensamiento consciente se formule.',
    effectText: '+30% XP en Esgrima y Trabajos Físicos.',
    effect: { physicalXpMult: 0.30 }
  },
  {
    id: 'muscle_memory',
    title: 'Memoria Muscular',
    type: 'notable',
    tier: 4,
    cost: 8,
    x: 120,
    y: 320,
    connections: ['honed_instincts', 'death_pact'],
    flavor: 'Sinergia cuerpo-mente: el sudor del esfuerzo físico lubrica los engranajes del intelecto.',
    effectText: 'El 20% de tu Fuerza Física escala directamente la velocidad de estudio intelectual.',
    effect: { muscleMemorySynergy: 0.20 }
  },
  {
    id: 'inner_focus',
    title: 'Foco Interior',
    type: 'minor',
    tier: 2,
    cost: 2,
    x: 400,
    y: 160,
    connections: ['root_awakening', 'mana_circulation'],
    flavor: 'Los pensamientos dispersos se funden en un rayo de concentración pura.',
    effectText: '+35% XP en Meditación y Concentración.',
    effect: { intellectualXpMult: 0.35 }
  },
  {
    id: 'mana_circulation',
    title: 'Circulación de Maná',
    type: 'minor',
    tier: 3,
    cost: 4,
    x: 400,
    y: 60,
    connections: ['inner_focus', 'celestial_affinity'],
    flavor: 'Corrientes de éter fluyen por tus meridianos espirituales.',
    effectText: '+25% Oro en trabajos arcanos y alquímicos.',
    effect: { arcaneGoldMult: 0.25 }
  },
  {
    id: 'celestial_affinity',
    title: 'Afinidad Celestial',
    type: 'notable',
    tier: 4,
    cost: 8,
    x: 530,
    y: 110,
    connections: ['mana_circulation', 'chronos_mastery'],
    flavor: 'Tu alma resuena con la armonía de las esferas celestiales.',
    effectText: 'Reduce el coste de XP requerido en todas las disciplinas en un 15%.',
    effect: { xpCostReduction: 0.15 }
  },
  {
    id: 'transmuted_longevity',
    title: 'Longevidad Transmutada',
    type: 'minor',
    tier: 2,
    cost: 3,
    x: 520,
    y: 240,
    connections: ['root_awakening', 'alchemical_synthesis'],
    flavor: 'La alquimia biológica retiene la frescura celular durante décadas extra.',
    effectText: 'Retrasa los achaques del envejecimiento físico de 45 a 55 años.',
    effect: { agingThresholdBonus: 10 }
  },
  {
    id: 'alchemical_synthesis',
    title: 'Síntesis Alquímica',
    type: 'minor',
    tier: 3,
    cost: 5,
    x: 640,
    y: 200,
    connections: ['transmuted_longevity', 'astral_resonance'],
    flavor: 'Transmutas la escoria ordinaria en pepitas de oro puro.',
    effectText: 'Multiplica todos los ingresos netos de oro por x1.40.',
    effect: { goldGlobalMult: 0.40 }
  },
  {
    id: 'astral_resonance',
    title: 'Resonancia Astral',
    type: 'notable',
    tier: 4,
    cost: 10,
    x: 690,
    y: 320,
    connections: ['alchemical_synthesis', 'chronos_mastery'],
    flavor: 'Cada vida que has vivido añade su peso gravitacional a tu presente.',
    effectText: 'Cada reencarnación previa otorga +8% multiplicador aditivo a toda la XP.',
    effect: { pastLifeXpScaling: 0.08 }
  },
  {
    id: 'death_pact',
    title: 'Pacto con la Muerte',
    type: 'keystone',
    tier: 5,
    cost: 12,
    x: 230,
    y: 430,
    connections: ['muscle_memory', 'chronos_mastery'],
    flavor: 'KEYSTONE: Un pacto con la guadaña cósmica. Arden el doble de rápido, pero su llama es cegadora.',
    effectText: 'Tu esperanza de vida máxima se reduce un 50%, pero la ganancia de Karma al morir se cuadruplica (x4.0).',
    effect: { keystoneDeathPact: true }
  },
  {
    id: 'chronos_mastery',
    title: 'Soberanía Temporal',
    type: 'notable',
    tier: 5,
    cost: 15,
    x: 470,
    y: 440,
    connections: ['celestial_affinity', 'astral_resonance', 'death_pact'],
    flavor: 'Desafías el paso lineal del tiempo. Los descubrimientos ocurren como relámpagos.',
    effectText: '+50% Probabilidad de chispas críticas Eureka! (XP x5).',
    effect: { eurekaChanceBonus: 0.50 }
  }
];

/**
 * DEFAULT NEW PLAYER STATE (Matches the JSON schema)
 */
function createDefaultGameState() {
  const jobs = {};
  for (const id in JOBS_DATA) {
    jobs[id] = {
      level: 0,
      xp: 0,
      pastMaxLevel: 0, // preserved across reincarnations
      unlocked: id === 'beggar'
    };
  }

  const skills = {};
  for (const id in SKILLS_DATA) {
    skills[id] = {
      level: 0,
      xp: 0,
      pastMaxLevel: 0, // preserved across reincarnations
      unlocked: id === 'meditation' || id === 'swordsmanship'
    };
  }

  return {
    version: '1.0.0',
    player: {
      name: 'Aspirante del Vacío',
      age: GAME_CONSTANTS.BASE_START_AGE,
      maxAge: GAME_CONSTANTS.BASE_MAX_AGE,
      isAlive: true,
      gold: 0.0,
      mana: 10,
      karma: 0,
      totalKarmaEarned: 0,
      reincarnationCount: 0,
      activeJobId: 'beggar',
      activeSkillId: 'meditation',
      housingId: 'tent',
      timeScale: 1,
      isPaused: false,
      attributes: {
        strength: 1.0,
        intellect: 1.0,
        vitality: 1.0,
        arcana: 1.0
      },
      timePlayedTotal: 0,
      timePlayedCurrentLife: 0,
      daySubProgress: 0 // 0 to 1 progress within current game day
    },
    jobs: jobs,
    skills: skills,
    celestialTree: {
      allocatedNodes: ['root_awakening']
    },
    settings: {
      soundEnabled: true,
      particlesEnabled: true,
      autoSaveIntervalSec: 10
    },
    offline: {
      lastSavedTimestamp: Date.now()
    }
  };
}
