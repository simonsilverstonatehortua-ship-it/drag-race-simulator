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

### Normal Premiere (Late Entry)

En el episodio 1 falta una reina elegida al azar. El reto es una pasarela con dos looks; hay 3
reinas arriba (una gana, las otras HIGH), el resto SAFE, y nadie se va ("por primera vez en la
herstory de Drag Race"). Al acabar, RuPaul presenta a la reina tardía, que entra en la carrera con
una casilla vacía en el episodio 1. Desde el episodio 2 la temporada es normal. (La reina tardía
se elige al azar; en el original se elige a mano.)

### Double Premiere

Con 10 o más reinas, el reparto se divide al azar en dos mitades. La primera hace el episodio 1
(con su mini reto, maxi reto, jurado y eliminación) mientras la segunda espera con una casilla
vacía; luego la segunda mitad hace el episodio 2 y la primera espera. Desde el episodio 3 sigue la
temporada con todas las que quedan. En los episodios de estreno el reto sale de la reserva aleatoria
(sin las reglas de calendario de la temporada) y no se puede ampliar el final. Con menos de 10
reinas se juega un estreno normal (el original avisa de que no se puede).

### Double Premiere (No Elimination) (esopare: "Double Premiere (Top 2)")

Igual que el doble estreno (dos mitades al azar, con 10 o más reinas), pero cada mitad hace un reto de
**Girl Group**, y el jurado deja 2 reinas arriba, 2 HIGH, 2 LOW y el resto SAFE; el Top 2 hace lip sync
por la victoria (WIN y TOP2) y **nadie se va** en ninguno de los dos episodios. Después el Girl Group
vuelve a poder salir durante la temporada.

### Double Premiere (Talent Show) / (Fake Elimination)

Igual que el doble estreno (dos mitades con 10 o más reinas), pero cada mitad hace un **Show de
talentos** y se juzga y elimina normalmente. Al llegar el episodio 3, **las eliminadas de los dos
estrenos vuelven** a la competición ("Las eliminaciones de los estrenos no eran definitivas"): su
casilla queda como "ELIM (falsa)" y en el rango aparece "(Elim. falsa)". El Show de talentos no
vuelve a salir en esa temporada. Sin cambios de la mecánica de chocolate del original (no está copiada).

### Double Premiere (Girl Groups) y Miss Simpatía solo entre eliminadas

- **Double Premiere (Girl Groups)**: doble estreno (dos mitades con 10 o más reinas) en el que cada
  mitad hace un reto de Girl Group, con su jurado, lip sync y eliminación normales. El Girl Group no
  vuelve a salir en la temporada.
- **Miss Simpatía**: ahora todas las concursantes votan, pero **solo se puede votar a las
  eliminadas**; las finalistas no pueden ser Miss Simpatía (ya no aparece la marca "MISS SIMPATÍA +
  GANADORA/SUBCAMPEONA" en las finalistas).

### Porkchop Premiere y empates en Miss Simpatía

- **Porkchop Premiere** (10 o más reinas): el episodio 1 son solo lip syncs ("Lipsync"). Todas se
  emparejan al azar (un trío si el reparto es impar); la ganadora de cada lip sync pasa al primer
  grupo (WIN) y la perdedora "se lleva la chuleta" (LOSS) y pasa al segundo. Las del segundo grupo
  votan a una de las suyas (con revotación si hay empate) y esa reina se cambia al primer grupo
  (LOSS en naranja). Después, cada grupo hace un episodio de Girl Group sin eliminación (como el doble
  estreno sin eliminación) y la temporada sigue con todas; el Girl Group no vuelve a salir.
- **Miss Simpatía** admite **empates**: si varias eliminadas reciben los mismos votos máximos, todas
  son Miss Simpatía y la reunión lo anuncia.

### Rate A Queen Premiere (esopare: "Rate-A-Queen (S16)")

Doble estreno (dos mitades con 10 o más reinas): cada mitad hace un **Show de talentos**, las reinas
se **puntúan entre sí** (cada una ordena a las demás por su último reto o al azar, corregido por las
relaciones y alianzas), las dos mejor valoradas hacen lip sync por la victoria (WIN y TOP2), el resto
es SAFE y nadie se va. En el **episodio 3** (todas juntas) hay otra ronda de Rate-A-Queen y los 3 de
arriba y los 3 de abajo salen de ese ranking en vez de las puntuaciones del reto. Las
pociones de inmunidad de la temporada 16 están copiadas (ver abajo).

### UK3 Premiere / Normal Premiere (Top 2 & Bottom 2)

Episodio 1 con una pasarela de dos looks: 3 reinas arriba y 3 abajo. La tercera de arriba es HIGH;
las dos primeras hacen lip sync por la victoria (WIN y TOP2). De las tres de abajo, la mejor se salva
(LOW) y las otras dos hacen lip sync por su vida, con eliminación normal. Desde el episodio 2 la
temporada es normal.

### Pociones de inmunidad (Rate-A-Queen / T16)

En la Rate A Queen Premiere, la ganadora de cada estreno obtiene una **poción de inmunidad**. En el
jurado de las semanas siguientes (mientras queden 7 reinas, o 6 en repartos de 8 a 10) cada reina con
poción decide si la usa: lo hace casi siempre si está entre las 3 peores del reto, y rara vez si está
arriba; en la última semana la usa casi seguro. Si la usa, decide si **se salva ella** (lo hace si está
entre las peores) o **se la regala a una amiga** (que puede aceptar o rechazar, y sube la relación entre
ambas). La salvada sale de arriba/abajo y, si el bottom queda con menos de 2, entra la siguiente peor no
inmune. En el track record, su casilla lleva un borde rosa.

### Double Premiere (Global All Stars) (solo esopare)

Doble estreno (dos mitades con 10 o más reinas) en el que cada mitad hace un **Show de talentos**; el
Top 2 hace lip sync por la victoria (WIN y TOP2), **todas las demás de la mitad son HIGH** y nadie se
va. La mitad que espera ese episodio tiene una casilla verde "RUN". Después, la temporada sigue normal
con todas.

### Porkchop Premiere (Elimination) (solo esopare)

Igual que el Porkchop (episodio 1 solo de lip syncs y votación de la chuleta), pero los dos grupos
hacen su episodio de Girl Group con **jurado y eliminación normales** en lugar de sin eliminación;
una reina se va de cada grupo (salvo doble shantay).

### Triple Premiere y Estreno al azar

- **Triple Premiere** (12 o más reinas): el reparto se divide al azar en tres grupos, que hacen los
  episodios 1, 2 y 3 (cada uno con su reto, jurado y eliminación normales) mientras los otros dos
  esperan con casillas vacías; en el episodio 4 siguen todas las que quedan.
- **Estreno al azar**: sortea el estreno entre los copiados (normal, sin eliminación, Slayers/Top 2,
  UK3, entrada tardía, doble y sus variantes, Porkchop y su variante, Rate A Queen y triple),
  descartando los que no caben en el reparto. Una primera pantalla avisa de cuál ha tocado.
  (Esopare no tiene esta opción; la añadí como la "Final al azar".)

### Formato de temporada Thailand ("Thailand's" / "Thailand S1/2 Format")

Cada episodio tiene dos retos: un **maxi reto**, del que solo se elige a la ganadora (WIN, o dos si
empatan; sin tops ni bottoms), y un **reto de pasarela** (o transformación con 5 o 6 reinas) que es el
que se juzga: con 7 o más reinas hay siempre 3 arriba y 3 abajo (4 y 4 con más de 13), sin el panel de
jueces ni las críticas del formato normal. La casilla del episodio **combina** el maxi y la pasarela
("WIN + HIGH", "WIN + BTM2", "WIN + ELIM", "WIN + LOW"; si la ganadora del maxi queda a salvo solo
se queda con su "WIN" y si gana también la pasarela es un "WIN" azul oscuro). Con un reto de diseño
no hay segunda prueba. Lo demás (lip sync, eliminación, finales, estrenos) es igual que en la
temporada regular. El Thailand de esopare ("Thailand S1/2 Format") y el de myrainboww son el mismo.

### Formato de temporada Teams ("Teams" / "Teams of 2")

Con un número **par** de reinas (6 o más) se forman **parejas al azar** que compiten juntas toda la
temporada con la **media de sus estadísticas** (la pareja lleva un nombre como "Team Fion..." hecho con
las letras de sus nombres). Cada semana: un mini reto que gana una pareja al azar, un maxi reto (solo los
retos básicos; Snatch Game con 5 parejas y Ball con 3), jurado con 2 parejas arriba y 3 abajo (1 y 2
con 3 parejas): la mejor gana (WIN), la segunda es HIGH, la mejor de las tres de abajo es LOW y las dos
peores hacen lip sync, en el que **solo hace lip sync una reina de cada pareja** (al azar; un 2 % de que
pulse el botón de "she-mergency" y salga su compañera). La pareja perdedora se va entera (los dos
puestos empatados). En la final quedan dos parejas, cuatro reinas: o se van una reina de cada pareja o
se va la pareja peor, y las dos restantes hacen lip sync por la corona. Con un reparto impar o de menos
de 6 reinas se juega una temporada regular. La final elegida se ignora (como en el original).

### Formato de temporada Lipsync For Your Legacy (All Stars)

Los episodios son como los de la temporada regular, con estas diferencias: el episodio 1 es un
**Show de talentos** con la **biblioteca** (lectura) de mini reto; cada semana, las **dos mejores
reinas** (Top 2) eligen el **pintalabios** de una de las reinas del bottom (sus compañeras se llevan
mejor o peor con ella según la relación); luego el Top 2 hace **lip sync por su legado**. La ganadora
(WIN) elimina a la reina cuyo pintalabios eligió; la otra (casilla "WIN" azul claro) se queda a salvo.
Si el lip sync empata con un buen resultado, ganan las dos y se van las dos elegidas (o solo una si
eligieron la misma). Las demás reinas del Top son HIGH, una del bottom puede ser LOW y las del bottom
que no se van quedan BTM2/BTM3/BTM4. Con 3 reinas, dos están arriba y una abajo. Las finales y los
estrenos funcionan igual que en la temporada regular. No he copiado el 0,5 % de que la ganadora se retire.

### Formato de temporada Lipsync Assassin

Como el Legacy (episodio 1 con Show de talentos y biblioteca), pero cada semana **una sola reina** gana
el reto (Top All Star, WIN) y el resto de las de arriba son HIGH. La ganadora elige el pintalabios de
una reina del bottom y **todas las demás reinas votan** su pintalabios (la pantalla muestra los
votos al pulsar el botón; una del bottom con 3 o más puede salvarse con LOW). Después aparece una
**asesina misteriosa de fuera del reparto** (una concursante de la base de datos que no juega la
temporada y que no se repite) y hace lip sync contra la ganadora del reto por su legado:
si gana la ganadora, se va la reina de su propio pintalabios; si gana la asesina, se va la más votada
por el grupo (y si hay un empate en los votos, el poder vuelve a la ganadora del reto, cuyo pintalabios
decide). Si el lip sync empata con un buen resultado, ganan las dos y se van las dos elegidas. Las
demás del bottom que no se van quedan BTM2-BTM5. Con 4 reinas o menos solo una está arriba. Las finales
y los estrenos funcionan como en la temporada regular. No está copiado el estreno "Lip-Sync Assassin
Premiere" ni el 0,5 % de que la ganadora se retire.

### Formato de temporada All Winners (por estrellas)

**Nadie se elimina durante la temporada**: se juegan 11 episodios (14 con más de 10 reinas) y las reinas
juntan **estrellas**. Los retos están marcados: Rumix (ep. 1), Snatch Game (2), Ball (3), Girl Group
(6) y, en el último episodio, un Show de talentos; el resto sale de la reserva aleatoria. Cada semana
las 4 mejores reinas (5 con más de 10) están arriba y el resto SAFE; el Top 2 (WIN y "WIN" azul claro)
recibe una **estrella** cada una y hace lip sync por su legado. La ganadora da el **desatascador de
platino** a una reina que queda **bloqueada** la semana siguiente (no recibe estrella aunque llegue al
Top 2); en los dos últimos episodios no se bloquea a nadie. En la semana 5 (y un 2 % de las demás) el
Top 2 regala su estrella a una compañera, y en el Show de talentos final el Top 2 recibe 3 estrellas. Al
terminar, las 4 reinas con más estrellas (si hay empate, la primera elige) pasan a la **gran final**
(Lip-Sync For The Crown), mientras que las clasificadas 5ª-8ª juegan **She Done Already Done Had
Herses**, un cuadro de lip syncs de consolación cuya ganadora se queda como "Reina de SDADHH". Las
demás reinas son eliminadas al final. Sin reunión ni Miss Simpatía, y sin estrenos ni finales aparte.

### Formato de temporada Slaysian Royale (solo esopare)

Hasta que quedan **6 reinas** es como el Lipsync For Your Legacy (Show de talentos y biblioteca en el
episodio 1; Top 2 con pintalabios y lip sync por el legado). Con 6 reinas se juega el **Top 6 Lip Sync
LaLaPaRUza**, un torneo: se saca una reina al azar que escoge a su rival (la que peor se lleva con
ella); hacen lip sync y la ganadora se queda en el escenario, y así hasta tres lip syncs. Las tres
ganadoras hacen un lip sync por la victoria: la mejor es WIN y las otras dos TOP 3, y la ganadora usa el
**Golden Balut** para salvar a una de las tres perdedoras (casilla "GOLDEN BALUT"); las otras dos hacen
lip sync por su vida con eliminación normal. Con 5 reinas o menos, el jurado es el de la temporada
regular. Las finales y los estrenos funcionan igual que siempre.

### Tournament of All Stars (grupos a medida, como en esopare)

En el selector de temporada, "Tournament of All Stars (grupos a medida)" muestra un panel de
**ajustes del torneo**: **número de grupos**, **episodios por grupo**, **reinas que pasan por grupo** y
una **segunda ronda de grupos** opcional (con sus propios grupos, episodios y reinas que pasan). El
reparto se divide al azar en grupos de tamaño parecido y cada grupo juega sus episodios mientras las
demás esperan con casillas vacías. En cada episodio las 3 mejores están arriba: el **Top 2** gana 2 puntos
MVQ (lip sync por su legado: la ganadora, un punto extra), la tercera es HIGH y las demás quedan SAFE; las
reinas que no son Top 2 **regalan su punto MVQ** a la compañera que prefieran. Al acabar los episodios del
grupo pasan las que más puntos tengan (el empate se rompe por PPE, con un 1 % de que pasen todas las
empatadas) y las demás quedan eliminadas con la casilla "+ELIM" (las que pasan, "+PASA"). Los retos son los
del original (Rumix, Improv, Runway, Design, Comedy, Rusical, Design, Girl Group, Improv, y vuelta a
empezar). Tras la última ronda las reinas que pasan siguen como una temporada regular con eliminación
hasta la final elegida. Con 3 grupos, 3 episodios y 3 pasan por grupo es el Tournament of All Stars original.

### Tournament of All Stars: más ajustes, colores y puntos MVQ

El formato "Tournament of All Stars (S11)" ya no existe como opción aparte: sus novedades son **ajustes del
torneo** (el botón "Cargar los ajustes de la temporada 11" los pone todos de golpe):
- **Comodines que vuelven** (0 = ninguno): de cada grupo se elige a la eliminada con mejor PPE y se sortean
  los comodines que vuelven (casilla "+COMODÍN").
- **Formato tras la ronda de grupos (merge)**: *Regular* (eliminación normal) o *Rate-A-Queen (S11)*: la ganadora
  del reto está a salvo, las demás se puntúan entre sí (con las relaciones) y las dos peor valoradas hacen lip sync.
- **Colores de los grupos**: el nombre de cada reina se pinta del color de su grupo y lleva "(Grupo N)" debajo,
  como en esopare (se guardan en el navegador).

**Puntos MVQ en el track record**: en el Tournament of All Stars y en All Winners, cada casilla muestra los
puntos que ganó la reina ese episodio ("+2 MVQ") y hay una columna **MVQ (pts)** con el total de cada reina.

### Aspecto copiado de la wiki (sección "Contestants" de All Stars 10 y 11)

Como en la wiki del fandom, el torneo y All Winners muestran:
- **Tarjetas del reparto** al empezar: marco redondeado del color del grupo, foto y el nombre en una etiqueta
  en la esquina (los colores por defecto son los de la temporada 11: #FE5007, #EA00B7, #8203D0...).
- **Leyenda de colores** bajo el track record (con todas las temporadas): "█ La concursante ganó el reto...",
  solo con los resultados que han salido en esa temporada.
- **Tabla de puntos del torneo (MVQ)**: un cuadro por grupo con cabecera del color del grupo y separadores
  negros; cada episodio tiene dos columnas (puntos del reto/lip sync en azul fuerte, celeste o azul claro, y el
  punto MVQ recibido de otra reina) y una columna de **puntos totales**; debajo, el historial de puntos regalados.
- Un doble ganador con una sola reina arriba ya no puede romper una temporada de torneo.
