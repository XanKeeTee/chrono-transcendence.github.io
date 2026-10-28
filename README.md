# Chrono Transcendence — Idle RPG de fantasía oscura (v2 "Slow-Burn")

Juego incremental inspirado en *Progress Knight*, *Melvor Idle*, *Increlution*, *Trimps* y *Path of Exile*.
Diseñado para semanas/meses de progresión: 1 año de juego = 90 s reales, la primera vida dura ~1 hora.

## Cómo jugar

Abre `index.html` en un navegador moderno (funciona directamente con `file://`, sin servidor ni dependencias).

- `index.html?dev=1` habilita velocidades 10x–500x para probar.
- El progreso se guarda cada 15 s, al ocultar la pestaña y al cerrarla. Sin conexión progresa hasta 12 h (ampliable a 48 h).

## Sistemas

- **Vida y senescencia:** Achaques físicos (40+ años), Neblina Senil y Desvarío (retrasados por la Meditación), muerte por vejez.
- **6 trabajos y 5 disciplinas** con hitos de maestría en Lv 10/25/50 y requisitos que se re-evalúan cada vida.
- **5 hogares** con alquiler diario, fianza de 30 días y desahucio: al principio se malvive en la calle.
- **Celestial Lattice:** 36 nodos, 4 ramas (Erudición, Alquimia, Samsara, Vida) y 4 keystones que se sellan al nacer.
- **Prestigio en tres capas:** Karma (árbol), Memoria Álmica por tarea (logarítmica) y Eco Álmico global (+5–15 % por vida si superas récords). El Karma sin gastar da *Karma Latente*.
- **Planificador Vital:** reglas automáticas "cuando X → haz Y" (tras 5 reencarnaciones o con *Visión Profética*); reencarnación automática con *Rueda del Samsara*.

## Herramientas

```
node tools/selftest.js                  # pruebas de regresión del núcleo
node tools/balance-sim.js 120 mixed     # simula 120 vidas (builds: mixed | karma | longevity | intellect)
```

Todas las constantes de balance están en `js/config.js`. El informe completo (bugs, fórmulas, ritmo) está en `docs/INFORME_TECNICO.md`. El prototipo original se conserva en `_original_v1/`.
