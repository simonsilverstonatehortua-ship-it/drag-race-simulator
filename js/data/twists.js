// Catálogo de "opciones"/twists de la temporada: a diferencia de Estreno/Regreso/
// Temporada/Final (donde eliges una sola opción de cada lista), aquí puedes activar
// varias a la vez, al estilo de la pestaña "Twists" de esopare.github.io y
// myrainboww.github.io. El motor de simulación (js/engine.js) las aplica cuando están
// activas en formatChoice.twists.

const DEFAULT_TWISTS = [
  // --- Desactivar ---
  { id: "DISABLE_DOUBLE", label: "Sin doble shantay ni doble sashay", custom: false, section: "Desactivar",
    description: "Se desactivan los dobles shantay, los dobles sashay y los empates de lip sync: siempre se va una sola reina." },
  { id: "DISABLE_REUNION", label: "Sin reunión en la final", custom: false, section: "Desactivar",
    description: "Tras el último episodio se pasa directamente a la final, sin la reunión (ni Miss Simpatía)." },
  // --- Activar ---
  { id: "RIGGORY", label: "Riggory de reto", custom: false, section: "Activar",
    description: "Gana quien mejor lo haga en el reto y en la pasarela: se ignora el favoritismo al elegir ganadora." },
  { id: "RIGGORY_LIPSYNC", label: "Riggory de lip sync", custom: false, section: "Activar",
    description: "Gana el lip sync quien mejor lo haga en el lip sync: se ignora el favoritismo y la mala fama." },
  { id: "CLAIM_QUEEN", label: "Reclamar una reina", custom: false, section: "Activar",
    description: "Antes de empezar puedes anotar quién (jugador) reclama a cada concursante; su nombre aparece junto al de la reina en la tabla." },
  // --- Twists ---
  { id: "IMMUNITY", label: "Inmunidad", custom: false, section: "Twists",
    description: "La ganadora del reto de la semana no puede estar en el fondo de la clasificación la semana siguiente (solo durante las primeras semanas). En la tabla se marca con el borde rosa característico (#FE4EDA), igual que en la hoja de la Temporada 1 del fandom wiki." },
  { id: "BEAVER", label: "Golden Beaver", custom: false, section: "Twists",
    description: "La ganadora del reto salva a una reina del bottom regalándole el Golden Beaver (casilla LOW con borde dorado)." },
  { id: "CHOCOLATE_RANDOM", label: "Barra de chocolate (al azar)", custom: false, section: "Twists",
    description: "Una concursante al azar tiene la barra de chocolate dorada: la primera vez que a una reina le toque irse por el lip sync, se salva si es la que la tiene (casilla CHOC)." },
  { id: "CHOCOLATE_CHOOSABLE", label: "Barra de chocolate (elegible)", custom: false, section: "Twists",
    description: "Como la barra de chocolate, pero eliges tú qué concursante tiene la barra dorada." },
  { id: "BADONKA_RANDOM", label: "Badonka Dunk (al azar)", custom: false, section: "Twists",
    description: "Cuando una reina pierde un lip sync tiene una última oportunidad: tira de una palanca del Badonka Dunk Tank. Dos de las diez palancas salvan a una reina (casilla BDNK); las palancas ganadoras son al azar." },
  { id: "BADONKA_CHOOSABLE", label: "Badonka Dunk (elegible)", custom: false, section: "Twists",
    description: "Como el Badonka Dunk, pero eliges tú cuáles son las dos palancas ganadoras." },
  // --- Retos de lip sync ---
  { id: "LIPSYNC_CHALLENGE", label: "LaLaPaRUza Smackdown (reto de lip sync)", custom: false, section: "Retos de lip sync",
    description: "A mitad de temporada el maxi reto es un torneo de lip syncs: las ganadoras de cada ronda se salvan y la última que queda se va a casa." },
  { id: "SLAY_OFF", label: "Slay Off Extravaganza", custom: false, section: "Retos de lip sync",
    description: "Con 8 reinas el maxi reto son dos rondas de lip syncs más una final: la ganadora gana el episodio y las perdedoras de la primera ronda quedan en el bottom." },
  { id: "SLAYSIAN_LALA", label: "Slaysian Lipsync LaLaPaRUza", custom: false, section: "Retos de lip sync",
    description: "Con 6 reinas se juega el torneo de lip syncs LaLaPaRUza del Slaysian Royale (con el Golden Balut), en cualquier temporada." },
  { id: "REUNION_SMACKDOWN", label: "Reunion Smackdown", custom: false, section: "Retos de lip sync",
    description: "Antes de la reunión, todas las eliminadas hacen un torneo de lip syncs por el título de Reina de She Done Already Done Had Herses." },
  // --- Títulos (se dan en la reunión, tras Miss Simpatía) ---
  { id: "TITLE_GOLDEN_BOOT", label: "Bota de Oro", custom: false, section: "Títulos",
    description: "Premio a la eliminada con mejor pasarela entre las que pasaron por SAFE, LOW o BTM." },
  { id: "TITLE_FAN_FAVORITE", label: "Favorita del público", custom: false, section: "Títulos",
    description: "Premio calculado con los resultados de cada reina durante la temporada (las eliminadas cuentan mucho)." },
  { id: "TITLE_VILLAIN", label: "Miss Villana", custom: false, section: "Títulos",
    description: "Todas las concursantes votan a la que peor les cae." },
  { id: "TITLE_ROBBED", label: "Miss Robada", custom: false, section: "Títulos",
    description: "Premio a la eliminada a la que más le robaron según sus resultados." },
  { id: "TITLE_POPSTAR", label: "Estrella del Pop Drag", custom: false, section: "Títulos",
    description: "Premio a la concursante con mejor nivel de baile." },
  { id: "TITLE_MOGUL", label: "Magnate de la Moda", custom: false, section: "Títulos",
    description: "Premio a la concursante con mejor nivel de diseño." },
  { id: "TITLE_WORST_LOOK", label: "Miss Peor Look", custom: false, section: "Títulos",
    description: "Premio a la eliminada con la peor pasarela." },
  { id: "TITLE_LOST_LOOK", label: "Miss Look Perdido", custom: false, section: "Títulos",
    description: "Premio a la eliminada con la mejor pasarela (el look que se perdió el público)." },
  { id: "TITLE_BRICK", label: "Miss Ladrillo", custom: false, section: "Títulos",
    description: "Todas votan a una de las tres con peor pasarela." },
  // --- Estilo ---
  { id: "SOLID_BACKGROUND", label: "Fondo liso", custom: false, section: "Estilo",
    description: "Las pantallas de la temporada se ven con un fondo liso, sin decoración." },
];

window.DEFAULT_TWISTS = DEFAULT_TWISTS;
