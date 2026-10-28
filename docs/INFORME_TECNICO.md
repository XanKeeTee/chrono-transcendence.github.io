# Chrono Transcendence v2 — Informe de Diagnóstico, Fórmulas y Ritmo

> Prototipo original conservado íntegro en `_original_v1/` para comparar.
> Verificación: `node tools/selftest.js` (16 pruebas de regresión) y `node tools/balance-sim.js [vidas] [build]` (simula semanas de juego en ~1 s con el mismo código que el navegador).

---

## 1. Bugs detectados en v1 y su corrección

| # | Gravedad | Bug en v1 | Consecuencia | Corrección v2 |
|---|---|---|---|---|
| 1 | **Crítica** | `loadGame()` ejecutaba el progreso offline **antes** de `recalculateAllModifiers()`; `cachedModifiers` era `{}` | XP y oro pasaban a `NaN` y se guardaban: **cualquier regreso tras >10 s corrompía la partida para siempre** | El contexto de simulación (`Sim.createContext`) calcula los modificadores antes de cualquier paso; saneado anti-NaN en cada carga |
| 2 | **Crítica** | Recargar estando muerto: `isAlive=false` guardado, pero el modal de muerte empieza oculto | **Bloqueo total** (la simulación nunca vuelve a correr) | Al cargar un alma muerta se reconstruye el resumen y se muestra el Umbral |
| 3 | Alta | `deltaMs = min(1000, …)` con `requestAnimationFrame` | Pestaña en segundo plano = tiempo perdido (10 min fuera → 1 s simulado); el autoguardado tampoco corría | Reloj de pared + paso fijo de 100 ms + `setInterval` de respaldo + vía masiva si hay >50 ticks de atraso |
| 4 | Alta | `pastMaxLevel` se actualizaba **en vivo** al subir de nivel | La "memoria de vidas pasadas" aceleraba la vida actual (+15 %/nivel → ×4 a Lv 20): bucle de realimentación | La memoria se consolida sólo al renacer |
| 5 | Alta | Alquiler: `gold = max(0, gold − coste)` | La Torre del Mago era **gratis** con 0 de oro | Desahucio al hogar inferior + fianza de 30 días para subir |
| 6 | Alta | Pacto con la Muerte comprable a cualquier edad + reembolso 100 % gratis | Vivir 70 años, comprarlo a los 69 → Karma ×4 de una vida larga; purificar después | Keystones **sellados al nacer**; purificar gratis sólo el 1.er año de vida o en el Umbral (75 % después) |
| 7 | Alta | Los flags `unlocked` sobrevivían a la reencarnación | Desde la vida 2 se saltaban todos los requisitos | Requisitos re-evaluados cada vida; `discovered` (permanente) sólo para la UI |
| 8 | Media | Eureka = 5 × la XP **del frame** (~16 ms) | Bonificación invisible y dependiente del framerate | Eureka = 30 días de XP; probabilidad `1−(1−p)^dt`; valor esperado determinista offline |
| 9 | Media | Textos ≠ código: *Soberanía Temporal* decía +50 % y daba +7 %; *Circulación de Maná* decía "oro arcano" y daba oro global; `arcaneXp` nunca se modificaba; hitos de Mendigo 25, Esgrima 50 y Jornalero 50 no existían; Intelecto/Vitalidad/Arcana no hacían nada; los objetos `effect` se ignoraban | Builds imposibles de razonar | Efectos 100 % declarativos agregados por `F.computeModifiers` (texto y mecánica salen del mismo objeto); los 4 atributos tienen efecto |
| 10 | Media | Requisito del Guardia: comprobaba el nivel del trabajo con `requires.level` (el de la habilidad) | Funcionaba por coincidencia (ambos 10) | Requisitos como lista tipada `[{type,id,level}]` |
| 11 | Media | Modal de muerte: `totalLevels × 0.15 %` | Mostraba "+4.5 %" cuando el efecto real era +450 % | Muestra la ganancia real de Eco y el antes/después |
| 12 | Media | Offline: 86 400 iteraciones tocando el DOM y reproduciendo sonidos | Congelación de varios segundos; ráfaga de campanas al reanudar el audio | Simulación masiva sin DOM ni sonido: **12 h en ~80 ms** |
| 13 | Media | Importar: sin validación; `innerHTML` con valores del save | Crash con saves parciales; self-XSS vía `pastMaxLevel` | `Save.sanitize`: coerción de tipos, ids existentes, nodos conectados, `U.esc` en todo `innerHTML` |
| 14 | Media | Sin versionado ni migración | Añadir un trabajo nuevo rompía los saves existentes | Sobre `{v,t,crc,data}`, fusión con el esquema por defecto, migración desde v1 |
| 15 | Baja | Canvas sin DPR; `resize` con la pestaña oculta → 0×0; 60 fps con `shadowBlur`; soltar un arrastre seleccionaba nodo; sin táctil | Árbol borroso en Retina, CPU alta | Backing store × DPR (con detección de cambio de monitor), render bajo demanda, Pointer Events con pellizco y umbral de 5 px |
| 16 | Baja | Partículas: velocidad por frame | Doble de rápido a 120 Hz; ignoraba `particlesEnabled` | Movimiento en px/s, respeta ajuste y `prefers-reduced-motion`, se pausa oculto |
| 17 | Baja | Pausa/velocidad/sonido no se restauraban en la UI; indicadores "Activo" fijos en el HTML | UI incoherente tras recargar | `ui.syncSettings()` al cargar |
| 18 | Baja | Tooltip "pegado" al reconstruir tarjetas | Tooltip flotando sin elemento | Delegación de eventos + ocultar en cada reconstrucción |
| 19 | Baja | Dos pestañas abiertas se sobrescribían el save | Pérdida silenciosa de progreso | `BroadcastChannel`: la pestaña antigua guarda y queda congelada |
| 20 | Baja | `AudioContext` creado fuera de un gesto; `resume()` sin `catch` | Avisos de consola, sonidos encolados | Desbloqueo en el primer `pointerdown`/`keydown`; si no está `running`, el sonido se descarta |

## 2. Casos críticos de juegos web idle

- **Throttling de rAF:** el tiempo se mide con `Date.now()`; rAF sólo dibuja. En segundo plano, el `setInterval(1000)` sigue bombeando (aunque Chrome lo baje a 1/min, el acumulador recupera todo). Atrasos >60 s usan la vía masiva y lo anotan en la Crónica. Reloj que retrocede → se ignora. `lastSavedAt` futuro → se recorta.
- **Coma flotante:** el oro es un entero de milésimas + acarreo fraccional (`U.addGold`): `0.1 + 0.2` da exactamente 300 milésimas y un millón de ingresos de 0.001 no deriva ni una milésima. XP y edad siguen en `double` (precisión relativa 1e-16, irrelevante) con comparación tolerante `U.gte`.
- **Autoplay:** ver bug 20. Silencio automático durante la simulación masiva y con la pestaña oculta; límite de frecuencia por sonido.
- **HiDPI:** ver bug 15.
- **Persistencia:** checksum FNV-1a, ranura de respaldo, copia `_corrupt_*` para recuperación manual, aviso si `localStorage` falla o se llena, guardado en `pagehide`/`visibilitychange`, el reset total bloquea el guardado de salida.

## 3. Economía matemática de v1 (por qué no tenía peso)

- 1 año = 12 s → la vida completa (14→70) duraba **11 minutos**.
- Memoria lineal sin tope (+15 % por nivel récord, aplicada en vivo) → crecimiento explosivo desde la 2.ª vida.
- Mendigo ganaba 0.25/día y la tienda costaba 0.05 → nunca había tensión; la torre era gratis (bug 5).
- El árbol entero costaba **73 Karma**: completo en 3–4 vidas (< 1 hora).

## 4. Fórmulas v2

Todas las constantes viven en `js/config.js` (`CT.BALANCE`).

**Tiempo.** Paso fijo de 100 ms = 0.4 días. **1 año = 360 días = 90 s reales.** Edad = 14 + díasVividos/360; los días vividos avanzan a `dt × ritmoEnvejecimiento` (nodos de longevidad < 1).

**XP requerida** (polinomio suave + exponencial = muros reales):
```
XP_req(L) = 150 · dificultad · (L+1)^1.2 · 1.12^L · (1 − reducción)      reducción ≤ 50 %
```
Dificultades: Mendigo 1 · Jornalero 2.5 · Escriba 5 · Guardia 12 · Alquimista 30 · Cronomante 120 · Meditación 1.5 · Esgrima 2 · Concentración 4 · Vitalismo 15 · Mat. Arcanas 40. Cada ×2 de dificultad ≈ 6 niveles más de muro.

**Tasa de XP** (por día de juego):
```
XP/día = 10 · Global · Categoría · Específico · Memoria(tarea) · Senescencia
Global = (1 + Σnodos/hitos + 3 %·vidas[Resonancia]) · Hogar · EcoÁlmico · KarmaLatente · keystones
Categoría = 1 + Σbonos + 0.5·(Atributo − 1)
```

**Oro:** `sueldo = base · (1 + 0.04·nivel) · multOro · (1 + bono categoría) · Achaques(físico)`.
Alquiler diario y **fianza = 30 días de alquiler**. Sueldos base 0.9 / 4 / 10 / 25 / 70 / 320; alquileres 0 / 1 / 6 / 28 / 150. El Mendigo a Lv 0 gana **menos que la tienda** → se empieza en la calle (−4 años, XP ×0.85).

**Prestigio (tres capas, cada una con una función distinta):**
```
Karma          = ⌊ ((Niveles − 10) / 8)^1.25 · multKarma ⌋         (moneda del Árbol)
Memoria(tarea) = 1 + 0.30 · ln(1 + récord / 5)                     (Lv10 ×1.33 · Lv50 ×1.72 · Lv100 ×1.91)
Eco Álmico     ×= 1 + g,  g = 5 % + 10 % · (R−5)/(R−5+30)          (R = niveles de récord nuevos; R<5 → 1.5 %/récord)
Karma Latente  = 1 + 0.15 · log2(1 + KarmaSinGastar / 25)          (sumidero infinito)
```
- El **Eco** da el "+5 % a +15 % por reencarnación según optimización" pedido: sólo los récords lo alimentan, así que repetir la misma vida no da nada y optimizar sí.
- La **Memoria** es logarítmica: especializarse ayuda, pero no rompe el juego.
- El **Karma Latente** crea la tensión "gastar vs. atesorar" y garantiza que nunca haya estancamiento absoluto (el simulador detectó que sin él el juego se congelaba al completar el árbol).

**Senescencia:**
```
Achaques (físico/marcial):   desde 40 años (+nodos, +10·(Vit−1)),  −2 %/año,  suelo 25 %
Neblina Senil (int/arcano):  desde 50 + 0.5·nivelMeditación (máx +35), −1.5 %/año, suelo 55 %
Desvarío:                    10 años tras la Neblina: Eureka ×0.5 y cada estación olvida 2 % de la barra (máx. 10 días de XP)
Muerte:                      vida máx = (55 + nodos + hogar + 25·(Vit−1)) · (1+%) · keystones
```

**Eureka:** 0.3 %/día base (≈ uno cada 1.4 min reales), concede 30 días de XP de la disciplina activa.

## 5. Ritmo resultante (simulador, jugador competente, horas de juego a 1x)

| Hito | Mixta | Karma Rush | Longevidad | Intelectual |
|---|---|---|---|---|
| Vida 1 | 66 min · 57 niveles · 9 Karma | = | = | = |
| Guardia desbloqueado | 28 h (vida 21) | 27 h | 45 h | 46 h |
| Alquimista + Torre | 60 h (vida 40) | 58 h | 71 h | 71 h |
| Cronomante | 199 h (vida 75) | **139 h** (vidas cortas) | 203 h | 183 h |
| Cronomante Lv 50 | 276 h | 172 h | 280 h | 265 h |
| Todos los trabajos ≥ 50 | 324 h | 186 h | 328 h | 461 h |

Duración de cada vida: ~1 h al principio → 2–4 h a mitad → 6–7 h al final (la longevidad alarga la vida *en tiempo real*). El progreso sin conexión (12 h base, hasta 48 h con nodos) se detiene al morir salvo con la Rueda del Samsara, así que un jugador que entra 2–3 veces al día avanza ~10–14 h de juego diarias:

- **Días 1–3:** malvivir, Jornalero/Escriba, primeros nodos menores.
- **Días 3–6:** primer gran muro (Guardia + Casa de Piedra), primer notable.
- **Semana 1–2:** Alquimista, Torre del Mago, primer keystone, Planificador.
- **Semanas 2–4:** Cronomante (antes con Karma Rush, que exige más atención).
- **Mes 1+:** hitos Lv 50, árbol completo y progreso lineal indefinido (~1 nivel por tarea y vida).

Ejecuta `node tools/balance-sim.js 150 karma` para ver la tabla completa de cualquier build.

## 6. Mecánicas nuevas

- **Planificador Vital** (pestaña propia): reglas "cuando edad/nivel/oro ≥ X → cambiar trabajo/disciplina/hogar". Ordenables, pausables, una ejecución por vida; si el objetivo está bloqueado o falta la fianza, la regla espera. Se desbloquea tras 5 reencarnaciones o con *Visión Profética* (+3 reglas; *Cronograma Extendido* +3 más). *Rueda del Samsara* añade reencarnación automática, también offline.
- **Árbol de 36 nodos** (antes 12), cuatro ramas unidas por un anillo interior (a cada rama se llega por dos caminos):
  - **Intelectual pura** (N): Foco Interior → Estudio Profundo → Afinidad Celestial → Mente Cristalina → *Ascetismo del Erudito* (XP intelectual ×2, arcana ×1.5; física ×0.4, oro ×0.7).
  - **Economía** (E): Síntesis → Toque de Midas / Diezmo Kármico (oro → Karma) → *Avaricia del Dragón* (oro ×2, alquiler ×0.6, XP ×0.8).
  - **Karma Rush** (S): Ecuaciones → Ecos Resonantes / Resonancia Astral → *Pacto con la Muerte* (vida ×0.5, Karma ×2.2). Ciclos cortos y frecuentes: el más rápido si el jugador entra a menudo.
  - **Esperanza de vida extrema** (O): Longevidad → Sangre de Fénix / Corazón de Roble → Ritmo Circadiano (envejecer −10 %) → *Elixir Eterno* (vida ×1.5, sin Eureka, oro ×0.7).
- **Senescencia mental:** Neblina Senil y Desvarío, retrasables con Meditación, *Mente Serena*, *Mente Cristalina*, Escriba Lv 50 y hogares de piedra/torre. Panel "Senescencia" con la edad de inicio de cada condición.
- **Contenido nuevo:** Escriba, Cronomante, Vitalismo Alquímico, Soportal (calle) y Casa de Piedra.
- **Calidad de vida:** tarjetas bloqueadas con requisitos ✓/✗, tiempo hasta el siguiente nivel, próximo hito, historial de vidas, informe de regreso offline, `?dev=1` con velocidades 10x–500x para pruebas (en juego normal sólo existe 1x: el ritmo lento es el diseño).

## 7. Arquitectura

Scripts clásicos bajo el espacio de nombres `CT` (funciona abriendo `index.html` directamente; los módulos ES fallarían en `file://`). El núcleo no toca el DOM y se ejecuta igual en Node.

```
js/utils.js        números seguros, oro en punto fijo, formato, base64 UTF-8, hash, RNG con semilla
js/config.js       CT.BALANCE: todas las constantes de balance
js/data.js         trabajos, disciplinas, atributos, hogares, condiciones (efectos declarativos)
js/lattice-data.js 36 nodos en coordenadas polares + validación de enlaces
js/state.js        esquema de partida por defecto
js/formulas.js     fórmulas puras + agregación de modificadores
js/simulation.js   paso de simulación, muerte/renacer, planificador, avance masivo
js/save.js         sobre versionado, respaldo, saneado, migración v1, export/import
js/audio.js        sintetizador con política de autoplay
js/tree.js         Celestial Lattice (canvas HiDPI, pointer events)
js/ui.js           DOM: tarjetas, paneles, planificador, grimorio, modales
js/engine.js       bucle temporal, eventos, offline, bloqueo multi-pestaña, arranque
tools/selftest.js     16 pruebas de regresión
tools/balance-sim.js  simulador de ritmo por builds
```

## 8. Riesgos y pendientes

- El **bot** del simulador es competente, no óptimo: un jugador experto irá más rápido (sobre todo en el muro del Guardia, días 3–6). Conviene validar con jugadores reales y ajustar `CT.BALANCE`.
- El Eco Álmico es multiplicativo: en vidas >120 los multiplicadores se muestran como ×1e4–×1e6 (con sufijos K/M/B). Es normal en el género, pero si se prefiere números pequeños puede pasarse a escala logarítmica en la UI.
- El progreso offline depende del reloj del sistema; adelantar el reloj da hasta el tope (12–48 h). No hay protección más allá de recortar `lastSavedAt` futuros.
- Saves del prototipo v1: se migran con Karma reembolsado (máx. 150) y récords limitados a Lv 30, porque las curvas antiguas estaban infladas.
