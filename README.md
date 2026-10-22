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
- **`js/data/roster.js`** — temporadas reales cargadas (`ALL_SEASONS`: Temporadas 1-10 de
  EE.UU. por ahora, 126 concursantes), cada una con sus concursantes, enlace a su ficha del
  fandom wiki, **foto** y un bloque de **15 estadísticas** (0–15: ver sección de abajo). En
  la pestaña Simular puedes mezclar concursantes de cualquier temporada cargada en un mismo
  reparto.

  Las 7 estadísticas "core" (Acting/Comedy/Dance/Design/Improv/Runway/Lip Sync) de las
  Temporadas 1-10 vienen de la base de datos curada del simulador de referencia
  (myrainboww.github.io/Drag-Race-Simulator, extraída de su código fuente público — tiene
  676 concursantes de decenas de temporadas y franquicias, así que hay mucho margen para
  seguir ampliando el roster). Las 8 estadísticas extra que no existen ahí
  (Makeup/Singing/Verses/Strategy/Charisma/Uniqueness/Nerve/Talent) están hechas a mano
  para las Temporadas 1-3, y derivadas automáticamente de las 7 "core" con una fórmula
  simple para las Temporadas 4-10 (ver `deriveStats()` en `js/data/roster.js`) — no son
  estimaciones cualitativas individuales como en las primeras 3 temporadas.

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
`static.wikia.nocookie.net` (el CDN de imágenes del fandom wiki). Las concursantes de las
Temporadas 4-10 usan por ahora la foto de su temporada de debut (no se ha investigado
retorno a temporadas posteriores para todas ellas todavía, a diferencia de las Temporadas
1-3); si vuelves a pedir una actualización puntual para alguna, se hace igual que las de
arriba. Todo esto es hotlink a terceros: si algún día se borra o renombra, esa foto
concreta deja de cargar (solo se oculta el icono roto, no rompe nada más). Puedes sustituir
la URL de cualquier concursante editando `js/data/roster.js`, y las concursantes
personalizadas tienen su propio campo "Foto (URL)" editable desde la UI.
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
hasta que se revela su eliminación (o el episodio Final si llega hasta el podio). Las
colocaciones se muestran como puesto real de la clasificación final ("9º lugar" para la
primera eliminada de un cast de 9, y así sucesivamente), no como "Eliminada #N".

**Puntos por estado (PPE)**: WIN=10, TOP2=9, HIGH=8, SAFE=5, LOW=3, BTM=1, ELIM=0. Solo
estos 7 estados semanales cuentan para el promedio de puntos por episodio (columna "PPE"
de la tabla); el resto (MVQ, ADV, RTRN, QUIT, DISQ, GUEST) y
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
- Dos retos especiales en el catálogo (pestaña Retos): **Meet the Queens** (capítulo de
  presentación sin reto principal ni eliminación; se destaca a quien mejor se presenta
  —Carisma/Nervio— y a quien luce el mejor look de promo —Runway/Diseño/Maquillaje—,
  ambas quedan como WIN esa semana) y **Coreografía y looks de coreo** (reto normal con
  eliminación que puntúa Baile, Diseño y Maquillaje a la vez). Meet the Queens nunca sale
  sorteado en episodios de equipos, Lipsync Assassin o Lipsync For Your Legacy, porque esos
  formatos necesitan que alguien se vaya esa semana sí o sí.
- Miss Simpatía (ponderada por Carisma si hay estadísticas; si no, al azar).
- Cuando hay una doble+ eliminación en un mismo episodio, o finalistas que no llegan al
  lip sync final en Top3/Top4/jurado/bracket, el resultado indica explícitamente el puesto
  de cada una ("Fulana y Mengana quedaron en 5º lugar y 4º lugar, respectivamente").

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

## Simulador "estilo myrainboww" (copia paso a paso)

Para **estreno normal + temporada regular + final Top 2 + sin regresos ni opciones**, la
pestaña Simular usa `js/refsim.js`, una copia fiel (reglas, pantallas y aleatoriedad) del
simulador de referencia [myrainboww.github.io/Drag-Race-Simulator](https://myrainboww.github.io/Drag-Race-Simulator/),
con todos los textos traducidos al español (`js/data/refdata.js`, `js/data/refreads.js`,
`js/data/refreads-queens.js`). Cada episodio recorre: mini reto → maxi reto (+ pasarela) →
jurado → ganadora/tops/bottoms → lip sync (canción, eventos, resultado) → Untucked (con
relaciones) → progreso de las concursantes (track record con PPE). Después: reunión (biblioteca
+ Miss Simpatía) y la gran final (pasarela, lip sync por la corona, ganadora). Al final se
pueden ver todos los lip syncs de la temporada y los más memorables, y descargar el track
record como imagen.

Se copian también los equipos y parejas en los retos, la ventaja del mini reto, los eventos
raros (nadie a salvo, doble shantay/sashay, abandono, descalificación, baja médica, sesión
de "slayers", "floppers", lip sync de seis y LaLaPaRUza Smackdown) y las relaciones que cambian
tras cada Untucked. Las puntuaciones salen de las 7 estadísticas básicas de cada reina
(acting, comedy, dance, design, improv, runway, lipsync) con la misma fórmula que el original.
Los demás formatos siguen usando `js/engine.js` hasta que se copien también.

### Segundo simulador de referencia: esopare

[esopare.github.io/esoteric-drag-race-simulator](https://esopare.github.io/esoteric-drag-race-simulator/)
parece una copia del de myrainboww, pero es una versión bastante ampliada (más de 37.000
líneas de código frente a 19.000). `js/refsim.js` usa los dos: la base de myrainboww y, encima,
lo que añade esopare, traducido en `js/data/refdata-eso.js` y `js/data/refreads-eso.js`:

- **Mini retos con nombre** (29), puntuados con la habilidad de cada tipo; los gana quien mejor
  lo hace, y también la lectura y los títeres se puntúan.
- **Retos principales nuevos** con reparto ponderado: sesión de fotos, certamen, canto, RDR
  Live, diseño de personaje, show de talentos + pasarela, monólogos, Untucked actuado,
  batallas de roast, Rappin' Roast, ¿Quién lo lleva mejor?, memorias, Las Vegas, transformación
  + girl group y diseño de habitaciones (varios en equipos).
- **Jurado**: RuPaul, panel de tres jueces y un invitado especial cada semana; Untucked de las
  reinas a salvo; críticas del jurado (RuPaul 80 %, el panel y el invitado).
- Frase de salida de cada eliminada, discurso de la ganadora, "Antes de esta noche, se os pidió
  que prepararais un lip sync con...", más motivos de "quién debería irse a casa", más pullas y
  canciones.
- **Final Top 3** (en los dos): las tres hacen lip sync si están igualadas o la tercera se va
  antes; las dos subcampeonas comparten el 2º/3º puesto. Con 3 reinas y un doble shantay, la
  final del Top 2 puede ampliarse a Top 3.

Donde esopare cambia una regla de myrainboww se sigue esopare, salvo en tres cosas que ya
estaban pedidas: el Snatch Game sale en todas las temporadas, no se repite el mismo reto dos
episodios seguidos y los episodios especiales raros (slayers, floppers, lip sync de seis,
LaLaPaRUza) se mantienen, porque en esopare han quedado desactivados.

### Final Top 4

Los dos simuladores comparten la final Top 4 (esopare solo añade la frase de salida de la
eliminada). Si la cuarta finalista va muy por detrás (diferencia de 10 o más con la primera
y menos de 5 puntos de final), se va antes ("no es tu momento...") y las otras tres hacen lip
sync; si no, las cuatro hacen lip sync a la vez ("vamos a romper todas las reglas"). Las tres
que no ganan en el lip sync de cuatro comparten el 2º-4º puesto; si hay empate de ganadoras,
las otras dos comparten el 3º/4º. En la fase previa, con 6 reinas se juega la transformación,
con 5 el Ball, y un doble shantay con 4 reinas puede ampliar el Top 3 a Top 4.

### Final Top 5 y aspecto del track record

- **Top 5** (los dos simuladores): las cinco finalistas hacen una actuación individual ("actuación
  final"); las dos mejores pasan al lip sync por la corona y las otras tres se van con su frase
  de salida (3º-5º). La ganadora se decide con la reputación de la temporada más el lip sync
  final, con un 5 % de que se invierta; la perdedora es 2ª. Solo
  hay una columna "Final" en el track record.
- **Track record** copiado estéticamente de los simuladores de referencia: tabla clara
  (lavanda), cabecera con "Ep. N" y el reto debajo, y todas las casillas —y la foto de cada
  reina— del mismo tamaño, en rectángulos verticales (64 × 110 px), con PPE al final.

### Final por equipos ("Teams Finale / Top 4 to Top 2")

Es el mismo formato en myrainboww ("Teams Finale/Top4 to Top2") y en esopare ("Teams Finale"):
con una temporada normal, quedan cuatro finalistas que ni hacen pasarela ni actuaciones; se
ordenan por la reputación de la temporada (favoritismo menos desfavoritismo). Las dos últimas
se van ("no es vuestro momento", puesto 3º/4º) y las dos primeras hacen lip sync por la corona;
gana la mejor valorada, con posible empate de ganadoras. Solo hay una columna "Final" en el track
record. Los equipos de la temporada ("Teams") todavía no están copiados.

### Lip-Sync For The Crown y nombres de reto en inglés

- **Lip-Sync For The Crown** (myrainboww) / **Top 4 Lip-Sync For The Crown** (esopare): con cuatro
  finalistas, se sortean dos parejas; cada pareja hace un lip sync preliminar y la perdedora se va
  ("PERDIÓ RONDA 1 / 2", puesto 3º/4º). Si una pareja empata con un lip sync bueno, pasan las dos
  (final a tres y, si empatan las dos, a cuatro). Las que pasan hacen el lip sync final; la
  ganadora sale de la reputación más la mitad del lip sync (5 % de sorpresa); las demás
  "PERDIÓ RONDA 3". Con cinco reinas se juega el reto **Rumix**, y un doble shantay con cinco
  reinas convierte el formato en Top 5.
- Los **nombres de los retos** del track record van siempre en inglés (Make Over, Improv, Snatch
  Game...). Las columnas usan `table-layout: fixed` con una anchura de 64 px, así que ninguna
  palabra larga puede ensanchar una columna: todas son rectángulos verticales idénticos.

### Lip Sync for the Finale

Es el final de la temporada 2 de Canadá en los dos simuladores (mismas pantallas en ambos). Tras la
reunión, el Top 4 se reparte al azar en dos parejas ("batalla real de lip syncs"): la ganadora de
cada pareja pasa a la final ("TOP 3 · Ganó ronda 1/2") y las dos perdedoras se enfrentan en una
tercera ronda; la que gana pasa ("Ganó ronda 3") y la otra se va. No hay empates ni doble shantay
en estas rondas. Después se juega la final normal del Top 3 (pasarela, tercera eliminada o lip sync
a tres) **sin columna de videoclip**: las eliminadas pasan a "Invitada" y el track record queda con
las columnas "Lipsync For The Finale" y "Finale". En el reto de reparto se usa el mismo calendario
que el Lip-Sync For The Crown, pero sin Rumix ni conversión a Top 5.

### Jury Vote (Top 4) y Top 5 Jury Vote

- **Jury Vote** (myrainboww) / **Top 4 Jury Vote** (esopare): el Top 4 hace la pasarela final y
  las eliminadas de la temporada votan: cada una da 2 puntos a su primera opción y 1 a la segunda
  (según su relación con las finalistas). Las dos más votadas son el Top 2; si hay empate por el
  segundo puesto, las eliminadas votan de nuevo entre las empatadas. Las otras dos se van (3º/4º),
  las dos finalistas hacen lip sync y gana la de mayor puntuación final (la reputación de la
  temporada; puede haber dos ganadoras si empatan). El track record muestra los puntos del jurado
  en la casilla de la final ("GANADORA (7 puntos)").
- **Top 5 Jury Vote** (solo esopare): las cinco finalistas defienden su caso, las eliminadas votan,
  las dos más votadas hacen el lip sync por la corona (igual que en el Top 5) y las otras tres se
  van (3º-5º). Corregí un fallo del original en el desempate, que podía duplicar a una finalista.

### Top 6 All Stars 11 (esopare)

Con seis finalistas hay un cuadro de eliminatorias, todo a base de lip syncs: la ganadora del último
episodio y la de mayor PPE pasan directas a la ronda 2; las otras cuatro hacen dos lip syncs en la
ronda 1 (las perdedoras quedan 5º/6º, "PERDIÓ RONDA 1"). La ronda 2 son otros dos lip syncs: las
dos ganadoras de la ronda 1 entre sí y las dos que pasaron directas entre sí (las perdedoras quedan
3º/4º, "PERDIÓ RONDA 2"). Las dos que ganan hacen el lip sync por la corona (reputación + la mitad
del lip sync, con un 5 % de sorpresa); la perdedora es "PERDIÓ RONDA 3" (2ª). No cuento los
extras de All Stars 11 (cuadros por bandos, reinas comodín).

### Top 8 (esopare)

Funciona como el Top 5 pero con ocho finalistas: cada una hace una actuación individual, las dos
mejores (actuación + reputación) pasan al lip sync por la corona y las otras seis se van con su
frase de salida (3º-8º). La ganadora y la subcampeona se deciden como en el Top 5. El calendario de
retos deja la transformación con nueve reinas y el Snatch Game y el Ball como en los demás
formatos largos.

### Top 8 Lip-Sync For The Crown (esopare) y PPE sobre 10

- **Top 8 Lip-Sync For The Crown**: antes de la final hay un **Rate-A-Queen**: cada una de las ocho
  finalistas ordena a las otras siete (la mitad de las veces según su último reto, si no al azar) y
  la media de puestos decide el cabeza de serie. Después, un cuadro solo de lip syncs: cuartos (1º
  vs 8º, 2º vs 7º, 3º vs 6º, 4º vs 5º; los perdedores quedan 5º-8º, "PERDIÓ RONDA 1"), semifinales
  (los perdedores quedan 3º/4º, "PERDIÓ RONDA 2") y el lip sync final (reputación + mitad del lip
  sync, con un 5 % de sorpresa; la perdedora es "PERDIÓ RONDA 3").
- El **PPE** del track record ahora va **sobre 10** (la media de puntos por episodio, que antes iba
  de 0 a 5, multiplicada por 2).

**Rate-A-Queen con relaciones:** cada finalista ordena a las demás por su último reto (o al azar, la
mitad de las veces) corrigiendo ese puesto según la relación: una relación alta sube a la rival, las
aliadas suben más y las enemigas bajan más. La pantalla avisa cuando alguien pone muy arriba a una
aliada o relega a una enemiga. Con relaciones extremas (todas adoran a una reina y odian a otra) la
querida acaba de media en el puesto 2 del cuadro y la odiada en el 7 de 8.

### Relaciones en 6 estados (como los simuladores de referencia)

Cómo se llevan dos concursantes ahora es **mutuo** y tiene los mismos 6 estados que
myrainboww/esopare (Slay!! 10 · Great! 5 · Good 3 · Neutral 0 · Bad.. −5 · Flopped... −10): se
llevan de maravilla / muy bien / bien / normal / mal / fatal. Al editar una pareja se cambia en los
dos sentidos, y el generador al azar tira una sola vez por pareja (la Estrategia media de las dos
sigue marcando cuánto se polarizan).

### Top 8 Lip-Sync For The Crown (Wildcard) y Random Finale (esopare)

- **Wildcard**: con 7 finalistas, una eliminada al azar regresa como comodín y son 8. Después se
  juega igual que el Top 8 Lip-Sync For The Crown (Rate-A-Queen y cuadro de lip syncs). Su casilla
  del track record lleva el prefijo "REGRESO +" ("REGRESO + PERDIÓ RONDA 1", "REGRESO + GANADORA"...).
  Si un doble sashay deja la temporada en 6 en vez de 7 finalistas, no hay comodín y se juega un
  final normal (el original da error en ese caso).
- **Random Finale**: el final se sortea entre los 13 formatos de esopare (Top 2, 3, 4, 5, 8, Teams,
  Lip-Sync For The Crown, Top 8 LFTC, Wildcard, Lip Sync for the Finale, Jury Vote Top 4 y Top 5,
  Top 6 All Stars 11), descartando los que no caben en el reparto. La reunión avisa de cuál ha tocado.

### Normal Premiere (No Elimination)

Está en los dos simuladores. En el episodio 1 siempre hay 3 reinas arriba (una gana, dos quedan
HIGH) y 3 abajo (la mejor de las tres se salva con LOW); las dos peores hacen lip sync y **se
quedan las dos** ("Shantay, las dos os quedáis", casilla BTM2 y menos reputación). Si las dos
hacen un lip sync muy flojo, el jurado lo comenta y les da una segunda oportunidad. A partir del
episodio 2 la temporada sigue normal y con eliminación; el episodio 1 no admite la tercera reina
en peligro ("nadie está a salvo") para que no se vaya nadie.

### Normal Premiere (Slayers / Top 2) y navegación con flechas

- **Normal Premiere (Slayers)** en myrainboww = **Normal Premiere (Top 2)** en esopare: en el episodio
  1 nadie se va. Si la tercera peor reina rinde mal, hay 3 arriba y 3 abajo (las de abajo se
  salvan con LOW); si no, la mitad mejor está arriba. Las dos mejores hacen lip sync por la victoria
  (WIN y TOP2) y las demás de arriba quedan HIGH.
- Las temporadas del simulador se pueden recorrer con **→** (siguiente pantalla) y **←** (anterior),
  igual que en los simuladores de referencia, sin tener que pulsar el botón de cada pantalla.
