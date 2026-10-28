# Chrono Transcendence — Idle Dark Fantasy RPG

Juego web incremental / Idle RPG inspirado en *Progress Knight*, *Path of Exile*, *Melvor Idle*, *Increlution* y *Antimatter Dimensions*.

## 🌟 Características Implementadas

1. **Bucle Vital de Envejecimiento & Senescencia:**
   - 1 segundo real (a 1x) = 1 día en el juego (12 días = 1 año vital).
   - El jugador comienza a los 14 años con una esperanza de vida base de 70 años.
   - A partir de los 45 años (o 55 con el nodo *Longevidad Transmutada*), se aplican debuffs progresivos a las actividades físicas.
   - Muerte por vejez al alcanzar la esperanza máxima, activando la pantalla de transición y balance kármico.

2. **Ocupaciones y Disciplinas Interconectadas:**
   - **4 Trabajos:** Mendigo del Rellano, Jornalero de Minas, Guardia de Bastión, Aprendiz de Alquimista.
   - **4 Habilidades:** Meditación del Vacío, Esgrima de la Sombra, Concentración Profunda, Matemáticas Arcanas.
   - **3 Albergues / Propiedades:** Tienda Raída, Choza de Madera, Torre del Mago Abandonada.
   - **Curva de Experiencia:** `XP_necesaria = Base * (Nivel ^ 2.8)`.
   - **Hitos de Maestría (Breakpoints):** Al alcanzar Lv 10, 25 y 50 se desbloquean pasivas únicas y efectos estéticos dorados/arcanos.
   - **Eventos Críticos 'Eureka!':** Posibilidad de comprensión súbita con multiplicador x5 de XP instantánea, efectos visuales y sonido sintetizado.

3. **Árbol del Destino ("The Celestial Lattice"):**
   - Mini-árbol de 12 nodos interconectados en Canvas interactivo.
   - Soporte para **Pan (arrastrar con ratón)** y **Zoom (rueda del ratón)**.
   - Tipos de nodo: Menores, Notables y la Keystone primordial *"Pacto con la Muerte"* (-50% esperanza de vida, x4 ganancia de Karma).
   - Sistema de reinicio / purificación (Respec) con reembolso del 100% de Karma.
   - Buscador de nodos en tiempo real con resaltado estelar.

4. **Capa de Prestigio (Reencarnación & Memoria Álmica):**
   - Reencarnación automática tras la muerte o voluntaria en el Grimorio.
   - Fórmula de Memoria Álmica permanente: `Multiplicador = 1 + (Nivel_Récord_Histórico * 0.15)` (+15% de velocidad de aprendizaje por nivel alcanzado en vidas previas).
   - Karma acumulativo para imbuir nodos del Árbol del Destino.

5. **Audio y Gráficos Procedurales:**
   - Sintetizador de audio Web Audio API (cero dependencias externas).
   - Canvas de partículas etéreas de fondo.
   - Tooltips profundos con desglose algebraico en tiempo real.
   - Guardado automático cada 10s en `localStorage`, exportación/importación en Base64 y reseteo completo.

## 🚀 Cómo Jugar

Abre directamente el archivo `index.html` en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari):
`file:///C:/Users/usuario/.gemini/antigravity/scratch/chrono-transcendence/index.html`
