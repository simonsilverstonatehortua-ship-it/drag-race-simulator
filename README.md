# Drag Race Simulator

Sitio estático (sin backend, sin build): abre `index.html` en el navegador o cuélgalo en
GitHub Pages. Todo lo que edites se guarda en `localStorage` del navegador y se puede
exportar/importar como JSON desde los botones de arriba.

## Qué incluye esta fase

- **`js/data/statuses.js`** — catálogo de estados semanales (WIN, HIGH, SAFE, LOW, BTM,
  ELIM, TOP2, MVQ, ADV, RTRN, QUIT, DISQ, GUEST) y colocaciones finales (WINNER, RUNNER_UP,
  MISS_CONGENIALITY), con color y "puntos" para las futuras estadísticas.
- **`js/data/challenges.js`** — catálogo de tipos de reto (Diseño, Snatch Game, Rusical,
  Ball, Talent Show, Roast, Girl Group, Make Over, etc.) y la escala de puntuación 0–10
  que ya usabas en tu Excel.
- **`js/data/formats.js`** — formatos de estreno, regreso, temporada y final, inspirados en
  el simulador de referencia (myrainboww.github.io) y en los formatos reales documentados
  en el fandom wiki.
- **`js/data/roster.js`** — temporadas reales cargadas (`ALL_SEASONS`: Temporadas 1, 2 y 3
  de EE.UU. por ahora), cada una con sus concursantes, enlace a su ficha del fandom wiki,
  **foto** y un bloque de **12 estadísticas** (0–15, estimadas para el juego: ver sección de
  abajo). En la pestaña Simular puedes mezclar concursantes de cualquier temporada cargada
  en un mismo reparto.

### Fotos de concursantes

Cada concursante real tiene una foto (se ve en Roster, en los chips de cada reto y en el
podio final): la de su **última aparición** en la franquicia Drag Race. Para quienes no
han vuelto en ninguna temporada posterior, es la foto de
[MochaMishu/Drag-Race-Simulator](https://github.com/MochaMishu/Drag-Race-Simulator) (un
fork del simulador de referencia, myrainboww.github.io/Drag-Race-Simulator, alojada en
`raw.githubusercontent.com`) — su única temporada. Para quienes sí han vuelto (BeBe Zahara
Benet → All Stars 3, Shannel → All Stars 9, Ongina → All Stars 5, Tammie Brown → All Stars
1, Raven → Down Under vs The World T1, Jujubee → UK vs The World T1, Tatianna → All Stars
2, Pandora Boxx → All Stars 6, Jessica Wild → All Stars 8, Morgan McMichaels → All Stars
11, Kylie Sonique Love → All Stars 6, Mystique Summers → All Stars 11, Nicole Paige Brooks
→ Down Under vs The World T1, Shangela → All Stars 3, Raja → All Stars 7, Manila Luzon →
All Stars 4, Alexis Mateo → Canada's Drag Race vs The World T2, Yara Sofia → All Stars 6,
Mariah Balenciaga → UK vs The World T3, Mimi Imfurst → All Stars 1, Phoenix → All Stars 10)
se usa la foto promocional oficial de esa temporada más reciente, alojada en
`static.wikia.nocookie.net` (el CDN de imágenes del fandom wiki). Todo esto es hotlink a
terceros: si algún día se borra o renombra, esa foto concreta deja de cargar (solo se
oculta el icono roto, no rompe nada más). Puedes sustituir la URL de cualquier concursante
editando `js/data/roster.js`, y las concursantes personalizadas tienen su propio campo
"Foto (URL)" editable desde la UI.
- **Editor completo**: puedes añadir, editar y borrar estados/retos/formatos desde la UI.
  Los que vienen de la referencia están marcados `custom:false`; lo que tú añadas queda
  marcado como "personalizado".
- **Exportar / Importar JSON**: para respaldar tu configuración o para que el motor de
  simulación (fase 2) la use como entrada.

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub (o usa uno existente).
2. Sube el contenido de esta carpeta (`index.html`, `css/`, `js/`) a la raíz del repo,
   o a una carpeta `/docs` si prefieres mantenerlo dentro de un repo más grande.
3. En el repo: **Settings → Pages → Source**, elige la rama y carpeta donde subiste los
   archivos.
4. En un par de minutos tendrás tu sitio en `https://<tu-usuario>.github.io/<repo>/`.

No hace falta ningún paso de build ni dependencias de Node: todo es HTML/CSS/JS plano.

## Fase 2: motor de simulación (ya incluida)

Pestaña "Simular": eliges concursantes del roster de prueba y el formato de estreno /
regreso / temporada / final, y el motor (`js/engine.js`) genera la temporada completa de
golpe puertas adentro, pero el resultado se **revela episodio a episodio** en una tabla de
trackrecord (Rank / Concursante / Ep. 1 / Ep. 2 / ... / PPE) al estilo de tu hoja Excel o
del simulador de referencia: cada celda tiene el fondo del color de su estado (igual que
las hojas de cálculo con formato condicional), cada click en "▶ Siguiente episodio" añade
una columna más, y "Revelar todo" salta al final. El "Rank" de cada fila se queda en "TBA"
hasta que se revela su eliminación (o el episodio Final si llega hasta el podio). El
historial guardado (pestaña Estadísticas → "Ver detalle") sí se muestra completo de una
vez, sin revelado progresivo, porque ya es una temporada pasada. Las colocaciones se
muestran como puesto real de la clasificación final ("9º lugar" para la primera eliminada
de un cast de 9, y así sucesivamente), no como "Eliminada #N".

**Puntos por estado (PPE)**: WIN=10, TOP2=9, HIGH=8, SAFE=5, LOW=3, BTM=1, ELIM=0. Solo
estos 7 estados semanales cuentan para el promedio de puntos por episodio (columna "PPE"
de la tabla y "Puntos/ep." en Estadísticas); el resto (MVQ, ADV, RTRN, QUIT, DISQ, GUEST) y
las colocaciones finales (WINNER/RUNNER_UP/MISS_CONGENIALITY, que sí suman aparte como
puntos de carrera) quedan fuera del promedio. Esto es configurable por estado (campo
"Cuenta para el promedio (PPE)") desde la pestaña Estados.

**Reparto de estados por episodio**: lo habitual (~90% de las veces en cada categoría) es
1 WIN, 2 HIGH, 1 LOW y 2 en el fondo (1 BTM que sobrevive + 1 ELIM) — con reparto amplio,
ese patrón exacto sale en torno a la mitad de los episodios. El resto es variación poco
probable (~7-9%): empate en la victoria (2-3 ganadoras), más o menos HIGH/LOW, lipsyncs de
3-4 concursantes o dobles eliminaciones. El motor nunca deja que una doble eliminación baje
el reparto por debajo del tamaño de la final elegida.

**Implementado de verdad:**
- Estreno normal, estreno normal sin eliminación, doble estreno (con y sin eliminación),
  **Porkchop** (llegan por parejas, un mini reto decide quién compite el reto principal).
- Sin regreso, regreso al azar de una eliminada, o **LaLaParUza** (bracket de lip sync
  grupal entre eliminadas; la ganadora regresa).
- Temporada regular (reto → WIN/HIGH/SAFE/LOW/BTM → lip sync → eliminación), **por
  equipos** (un episodio con equipos de 2; el equipo peor puntuado hace lip sync
  interno), y **Lipsync Assassin** (la ganadora del reto reta a quien quiera a un lip
  sync directo, sin pasar por el fondo de la clasificación).
  o **Lipsync For Your Legacy** (las dos mejor puntuadas de la semana hacen lip sync por
  su legado; la perdedora queda TOP2: a salvo pero sin puntos de victoria).
- Final Top 2, Top 3 y Top 4 (lip sync final entre las dos mejor puntuadas), **voto del
  jurado** (las eliminadas de la temporada votan a la ganadora entre las finalistas,
  ponderado también por Carisma) y **Lip Sync For The Crown por rondas** (bracket
  eliminatorio entre las finalistas).
- Miss Simpatía (ponderada por Carisma si hay estadísticas; si no, al azar).
- Cuando hay una doble+ eliminación en un mismo episodio, o finalistas que no llegan al
  lip sync final en Top3/Top4/jurado/bracket, el resultado indica explícitamente el puesto
  de cada una ("Fulana y Mengana quedaron en 5º lugar y 4º lugar, respectivamente").
- Cada temporada simulada se guarda en `localStorage` (`dragRaceSimulator.history.v1`)
  para que el panel de estadísticas pueda leerlas.

**Todavía no implementado** (seleccionable en la UI, pero cae en el comportamiento
estándar y se avisa con una nota en el resultado): Rate a Queen, entrada tardía, Lipsync
Smackdown, All Winners.

### Estadísticas por concursante (15: Acting/Comedy/Dance/Design/Improv/Runway/Lip Sync/
Makeup/Singing/Verses + Strategy/Charisma/Uniqueness/Nerve/Talent)

Inspirado en el simulador de referencia (myrainboww.github.io/Drag-Race-Simulator/custom.html)
y en el "C.U.N.T." clásico de RuPaul, cada concursante puede tener un bloque de 15
estadísticas (0–15). Cuando existen:
- Cada reto (`js/data/challenges.js`) tiene marcadas sus estadísticas relevantes (p.ej.
  Snatch Game usa Comedy + Acting, Talent Show usa Talent, Rusical/Girl Group/Videoclip
  usan Singing + Verses, Runway/Ball/Sesión de fotos/Make Over usan Makeup); la
  puntuación de la concursante en ese reto se sesga hacia esas estadísticas (65%
  habilidad / 35% azar), en vez de ser un número totalmente aleatorio.
- Todos los lip sync (fondo de la clasificación, LaLaParUza, Lipsync Assassin, finales)
  usan específicamente la estadística de Lip Sync.
- **Strategy** influye en Lipsync Assassin (cuanta más Estrategia tenga la asesina, más
  probable que juegue "sucio" y rete a su mayor amenaza real en la competencia — alianzas
  rotas, traiciones al estilo Mistress/Jorgeous en All Stars 10 — en vez de a quien
  puntuó más bajo) y en qué tan marcadas son sus **relaciones** con las demás (ver abajo).
- **Charisma** influye en el voto del jurado (además de la puntuación de la final) y en
  quién gana Miss Simpatía.
- Las concursantes **sin** estadísticas definidas siguen puntuando totalmente al azar, sin
  romper nada de lo anterior.

### Relaciones entre concursantes

Antes de cada simulación, el motor genera una matriz de relaciones (quién opina qué de
quién, en 5 niveles: le cae muy bien / le cae bien / normal / le cae mal / le cae muy
mal) que se muestra en una tabla al principio del resultado. Cuanta más **Estrategia**
tenga una concursante, más marcadas (menos "normal") son sus opiniones — juega sus
alianzas y rivalidades de forma más calculada. En el formato Lipsync Assassin, cuando la
asesina juega "sucio", prioriza retar a alguien que le cae mal por encima de solo mirar
quién es la mayor amenaza.

Puedes crear tus propias **concursantes personalizadas** con sus 12 estadísticas (o
aleatorizarlas con un botón) desde la pestaña **Roster**, y usarlas para simular igual que
a las reales. También puedes **editar las estadísticas de cualquier concursante real**
(botón "Editar stats" en su tarjeta de Roster) sin perder sus datos originales — un botón
"Restablecer original" los recupera en cualquier momento. Y puedes editar qué estadísticas
usa cada reto desde la pestaña Retos.

## Fase 3: panel de estadísticas (ya incluida)

Pestaña "Estadísticas": lee todo el historial de temporadas simuladas guardado en
`localStorage` (`js/stats.js`) y muestra:
- Un ranking de concursantes con veces en WIN/HIGH/SAFE/LOW/BTM/ELIM, coronaciones,
  runner-ups, Miss Simpatía, puntos promedio por episodio ("Puntos" tal como se
  calculaba en el Excel original) y puntos totales de carrera.
- Un listado de las temporadas simuladas con opción de ver el detalle episodio a
  episodio de cualquiera de ellas.
- Botón para borrar el historial guardado.

## Próximas fases (pendientes)

1. Completar los formatos que faltan del motor: Rate a Queen, entrada tardía, Lipsync
   Smackdown, All Winners.
2. **Comparador de concursantes**: cabeza a cabeza entre dos o más participantes de
   distintas temporadas/franquicias.
3. **Estrategias entre temporadas**: guardar "builds" o estrategias de simulación
   reutilizables entre partidas.
4. **Importar el resto de tu Excel**: convertir todas las 118 temporadas de la pestaña
   TRACKRECORDS en el formato de roster (`js/data/roster.js` es solo la plantilla/ejemplo
   con la Temporada 1).

## Nota sobre el desarrollo continuado

Este es un proyecto con muchas piezas (motor de reglas, simulación aleatoria, estadísticas,
comparador). Para las siguientes fases, herramientas como **Claude Code** funcionan muy bien
para iterar sobre un proyecto de archivos como este de forma continuada entre sesiones.
