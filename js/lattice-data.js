/**
 * CHRONO TRANSCENDENCE — The Celestial Lattice (36 nodos).
 *
 * Cuatro ramas en cruz alrededor del Despertar, unidas por un anillo interior
 * (no lineal: a cualquier rama se llega por dos caminos):
 *   N  · Erudición  → Build "Intelectual Pura"     (Keystone: Ascetismo del Erudito)
 *   E  · Alquimia   → economía / vivienda           (Keystone: Avaricia del Dragón)
 *   S  · Samsara    → Build "Karma Rush"            (Keystone: Pacto con la Muerte)
 *   O  · Vida       → Build "Esperanza de Vida Extrema" (Keystone: Elixir Eterno)
 *
 * Posición en coordenadas polares (a = ángulo en grados, 0 = este, -90 = norte; r = radio).
 * Las KEYSTONES quedan "selladas al nacer": si se imbuyen a mitad de una vida
 * se activan en la siguiente encarnación (evita el exploit de comprar el Pacto
 * con la Muerte a los 69 años para cuadruplicar el Karma de una vida larga).
 */
(function (root) {
  'use strict';
  const CT = (root.CT = root.CT || {});

  const N = (id, title, type, cost, a, r, links, effect, effectText, flavor) =>
    ({ id, title, type, cost, a, r, links, effect, effectText, flavor });

  const nodes = [
    N('root_awakening', 'Despertar del Alma', 'minor', 0, 0, 0,
      ['inner_focus', 'alchemical_spark', 'karmic_seed', 'iron_veins'],
      { xpGlobal: 0.10 }, '+10% XP global.', 'El núcleo de tu memoria ancestral se activa.'),

    // ------------------------------------------------------- ANILLO INTERIOR
    N('inner_focus', 'Foco Interior', 'minor', 5, -90, 120, ['honed_instincts', 'celestial_ledger', 'deep_study'],
      { xpIntellect: 0.20 }, '+20% XP intelectual.', 'Los pensamientos dispersos se funden en un rayo.'),
    N('alchemical_spark', 'Chispa Alquímica', 'minor', 5, 0, 120, ['celestial_ledger', 'frugality', 'alchemical_synthesis'],
      { gold: 0.15 }, '+15% oro global.', 'La primera transmutación siempre es accidental.'),
    N('karmic_seed', 'Semilla Kármica', 'minor', 5, 90, 120, ['frugality', 'memento_mori', 'destiny_equations'],
      { karma: 0.10 }, '+10% Karma al reencarnar.', 'Cada acto deja una semilla en el alma.'),
    N('iron_veins', 'Venas de Hierro', 'minor', 5, 180, 120, ['memento_mori', 'honed_instincts', 'transmuted_longevity'],
      { maxAge: 4 }, '+4 años de vida máxima.', 'Tus vasos se templan con metales primordiales.'),

    N('honed_instincts', 'Instintos Afilados', 'minor', 10, -135, 170, ['muscle_memory'],
      { xpPhysical: 0.20, xpMartial: 0.10 }, '+20% XP física, +10% marcial.', 'Reaccionas antes de pensar.'),
    N('celestial_ledger', 'Libro Mayor Celeste', 'minor', 10, -45, 170, ['chronos_mastery'],
      { xpGlobal: 0.05, gold: 0.05 }, '+5% XP global y +5% oro.', 'Los astros llevan la contabilidad del destino.'),
    N('frugality', 'Austeridad', 'minor', 10, 45, 170, ['tithe'],
      { housingCost: 0.10 }, '-10% coste de alojamiento.', 'Quien nada necesita, nada teme perder.'),
    N('memento_mori', 'Memento Mori', 'minor', 10, 135, 170, ['serene_mind'],
      { agingThreshold: 3, karma: 0.05 }, 'Achaques +3 años más tarde, +5% Karma.', 'Recordar la muerte es empezar a vencerla.'),

    // --------------------------------------------------- NORTE · ERUDICIÓN
    N('deep_study', 'Estudio Profundo', 'minor', 25, -90, 240, ['mana_circulation', 'muscle_memory', 'celestial_affinity'],
      { xpIntellect: 0.25 }, '+25% XP intelectual.', 'Las horas se disuelven entre páginas.'),
    N('mana_circulation', 'Circulación de Maná', 'minor', 30, -108, 300, ['vision_prophetic'],
      { xpArcane: 0.25 }, '+25% XP arcana.', 'Corrientes de éter fluyen por tus meridianos.'),
    N('muscle_memory', 'Memoria Muscular', 'notable', 70, -125, 280, [],
      { muscleMemory: 0.5 }, 'El 50% de tu Fuerza sobre 1 se suma también a la XP intelectual.',
      'El sudor del esfuerzo lubrica los engranajes del intelecto.'),
    N('celestial_affinity', 'Afinidad Celestial', 'notable', 90, -72, 310, ['chronos_mastery', 'crystal_mind'],
      { xpCost: 0.10 }, '-10% XP requerida en todas las tareas.', 'Tu alma resuena con la armonía de las esferas.'),
    N('vision_prophetic', 'Visión Profética', 'notable', 60, -95, 380, ['extended_schedule', 'crystal_mind'],
      { unlockPlanner: 1, plannerSlots: 3 }, 'Desbloquea el Planificador Vital (+3 reglas).',
      'Ves los hilos de tus vidas futuras y puedes trazarlos de antemano.'),
    N('crystal_mind', 'Mente Cristalina', 'minor', 60, -72, 420, ['ascetic'],
      { mentalThreshold: 8, xpIntellect: 0.15 }, 'Neblina Senil +8 años más tarde, +15% XP intelectual.',
      'Una mente tallada no se empaña.'),
    N('extended_schedule', 'Cronograma Extendido', 'minor', 90, -112, 450, ['ascetic'],
      { plannerSlots: 3 }, '+3 reglas en el Planificador Vital.', 'El destino se escribe con letra pequeña.'),
    N('ascetic', 'Ascetismo del Erudito', 'keystone', 220, -90, 520, [],
      { xpIntellectMult: 2.0, xpArcaneMult: 1.5, xpPhysicalMult: 0.4, goldMult: 0.7 },
      'XP intelectual ×2 y arcana ×1.5. XP física y marcial ×0.4, oro ×0.7.',
      'KEYSTONE: renuncias al cuerpo para que la mente arda sin humo.'),

    // ----------------------------------------------------- ESTE · ALQUIMIA
    N('alchemical_synthesis', 'Síntesis Alquímica', 'minor', 25, 0, 240, ['merchant_guile', 'golden_touch', 'chronos_mastery'],
      { gold: 0.25 }, '+25% oro global.', 'Transmutas escoria en pepitas de oro puro.'),
    N('merchant_guile', 'Astucia Mercantil', 'minor', 30, 20, 290, ['tithe'],
      { housingCost: 0.10, goldIntellect: 0.20 }, '-10% alquiler, +20% oro intelectual.', 'Todo contrato tiene una cláusula oculta.'),
    N('chronos_mastery', 'Soberanía Temporal', 'notable', 70, -28, 300, [],
      { eurekaChance: 0.60 }, '+60% probabilidad de Eureka.', 'Los descubrimientos caen como relámpagos.'),
    N('golden_touch', 'Toque de Midas', 'notable', 90, 0, 360, ['dragon_hoard'],
      { goldArcane: 0.50, gold: 0.15 }, '+50% oro arcano y +15% oro global.', 'Lo que tocas se vuelve frío, pesado y amarillo.'),
    N('tithe', 'Diezmo Kármico', 'notable', 90, 35, 360, ['dragon_hoard'],
      { tithe: 0.04 }, '+4% Karma por cada orden de magnitud (log10) del oro ganado en esta vida.',
      'El templo acepta ofrendas. El cosmos también.'),
    N('dragon_hoard', 'Avaricia del Dragón', 'keystone', 200, 15, 460, [],
      { goldMult: 2.0, housingCostMult: 0.6, xpGlobalMult: 0.8 },
      'Oro ×2 y alquileres ×0.6, pero toda la XP ×0.8.', 'KEYSTONE: duermes sobre tu tesoro y sueñas con más.'),

    // ----------------------------------------------------- SUR · SAMSARA
    N('destiny_equations', 'Ecuaciones del Karma', 'minor', 25, 90, 240, ['astral_resonance', 'resonant_echoes', 'wheel_samsara'],
      { karma: 0.15 }, '+15% Karma.', 'Cada vida es un término de una serie infinita.'),
    N('astral_resonance', 'Resonancia Astral', 'notable', 80, 68, 310, ['cosmic_sleep'],
      { pastLifeXp: 0.03 }, '+3% XP global por reencarnación previa (máx. +60%).',
      'Cada vida que viviste añade su peso gravitacional.'),
    N('resonant_echoes', 'Ecos Resonantes', 'notable', 100, 112, 310, ['death_pact', 'serene_mind'],
      { echoGain: 0.02 }, '+2 puntos al Eco Álmico ganado en cada vida (p.ej. 8% → 10%).',
      'El eco de tus pasos te alcanza en la siguiente vida.'),
    N('cosmic_sleep', 'Sueño Cósmico', 'minor', 60, 72, 410, ['wheel_samsara'],
      { offlineCapHours: 24 }, '+24 h de progreso sin conexión.', 'Mientras duermes, el alma sigue trabajando.'),
    N('wheel_samsara', 'Rueda del Samsara', 'notable', 150, 90, 440, ['death_pact'],
      { autoReincarnate: 1, offlineCapHours: 12 }, 'Reencarnación automática (opcional) y +12 h sin conexión.',
      'La rueda gira sola cuando aprendes a soltarla.'),
    N('death_pact', 'Pacto con la Muerte', 'keystone', 160, 112, 500, [],
      { maxAgeMult: 0.5, karmaMult: 2.2 }, 'Vida máxima ×0.5, pero Karma ×2.2.',
      'KEYSTONE: un pacto con la guadaña. Ardes el doble de rápido, pero tu llama ciega.'),

    // ------------------------------------------------------- OESTE · VIDA
    N('transmuted_longevity', 'Longevidad Transmutada', 'minor', 25, 180, 240, ['phoenix_blood', 'oak_heart', 'circadian'],
      { agingThreshold: 8 }, 'Los Achaques empiezan 8 años más tarde.', 'La alquimia celular retiene la juventud.'),
    N('phoenix_blood', 'Sangre de Fénix', 'minor', 30, 200, 300, ['basalt_skin'],
      { maxAgePct: 0.06 }, '+6% vida máxima.', 'Algo en tu sangre se niega a enfriarse.'),
    N('oak_heart', 'Corazón de Roble', 'minor', 30, 160, 300, ['serene_mind'],
      { attr_vitality: 0.12 }, '+0.12 Vitalidad (≈ +3 años).', 'Late lento, late fuerte, late siempre.'),
    N('serene_mind', 'Mente Serena', 'notable', 70, 145, 360, [],
      { mentalThreshold: 12, xp_meditation: 0.30 }, 'Neblina Senil +12 años más tarde, +30% XP en Meditación.',
      'La quietud es el antídoto del olvido.'),
    N('circadian', 'Ritmo Circadiano', 'notable', 100, 180, 360, ['eternal_elixir'],
      { agingRate: 0.10 }, 'Envejeces un 10% más lento (la vida dura más en tiempo real).',
      'Tu reloj interno marca su propio compás.'),
    N('basalt_skin', 'Piel de Basalto', 'minor', 60, 210, 390, ['eternal_elixir'],
      { agingSlope: 0.25 }, 'Los Achaques avanzan un 25% más lento.', 'La piedra no envejece: se erosiona.'),
    N('eternal_elixir', 'Elixir Eterno', 'keystone', 220, 190, 490, [],
      { maxAgeMult: 1.5, eurekaMult: 0, goldMult: 0.7 },
      'Vida máxima ×1.5, pero sin Eurekas y oro ×0.7.', 'KEYSTONE: la eternidad tiene un precio: la sorpresa.'),
  ];

  // Polar → cartesiano y conexiones bidireccionales.
  const byId = {};
  for (const n of nodes) {
    const rad = (n.a * Math.PI) / 180;
    n.x = Math.round(Math.cos(rad) * n.r);
    n.y = Math.round(Math.sin(rad) * n.r);
    n.connections = [];
    byId[n.id] = n;
  }
  for (const n of nodes) {
    for (const l of n.links) {
      if (!byId[l]) throw new Error(`Lattice: enlace roto ${n.id} → ${l}`);
      if (!n.connections.includes(l)) n.connections.push(l);
      if (!byId[l].connections.includes(n.id)) byId[l].connections.push(n.id);
    }
  }

  CT.LATTICE = nodes;
  CT.LATTICE_BY_ID = byId;
  CT.LATTICE_ROOT = 'root_awakening';
  CT.LATTICE_TOTAL_COST = nodes.reduce((s, n) => s + n.cost, 0);
})(typeof window !== 'undefined' ? window : globalThis);
