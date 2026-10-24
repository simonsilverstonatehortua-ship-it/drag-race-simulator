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
  // --- Estilo ---
  { id: "SOLID_BACKGROUND", label: "Fondo liso", custom: false, section: "Estilo",
    description: "Las pantallas de la temporada se ven con un fondo liso, sin decoración." },
];

window.DEFAULT_TWISTS = DEFAULT_TWISTS;
