// Catálogo de formatos, inspirado en myrainboww.github.io/Drag-Race-Simulator
// y en los formatos reales documentados en el fandom wiki.
// Cada formato tiene un "group" (premiere | return | season | finale)
// para que el motor de simulación (siguiente fase) sepa dónde aplicarlo.

const DEFAULT_FORMATS = [
  // --- Estreno ---
  { id: "PREMIERE_NORMAL", group: "premiere", label: "Estreno normal", custom: false,
    description: "Todas compiten en un único reto; una es eliminada." },
  { id: "PREMIERE_NORMAL_NOELIM", group: "premiere", label: "Estreno normal (sin eliminación)", custom: false,
    description: "Todas compiten pero nadie es eliminada esta semana." },
  { id: "PREMIERE_DOUBLE", group: "premiere", label: "Doble estreno", custom: false,
    description: "El grupo se divide en dos; cada mitad hace su propio reto y eliminación." },
  { id: "PREMIERE_DOUBLE_NOELIM", group: "premiere", label: "Doble estreno (sin eliminación)", custom: false,
    description: "Doble estreno sin que nadie sea eliminada." },
  { id: "PREMIERE_LATE_ENTRY", group: "premiere", label: "Entrada tardía", custom: false,
    description: "Una concursante adicional se incorpora tras el primer reto." },
  { id: "PREMIERE_PORKCHOP", group: "premiere", label: "Reto Porkchop", custom: false,
    description: "Las concursantes llegan por parejas; un mini reto decide quién compite esa semana." },
  { id: "PREMIERE_RATE_A_QUEEN", group: "premiere", label: "Puntuar a una compañera", custom: false,
    description: "Cada concursante puntúa el look de otra antes del reto principal." },
  { id: "PREMIERE_MEET_THE_QUEENS", group: "premiere", label: "Meet the Queens", custom: false,
    description: "Presentación inicial sin eliminación: las 2 mejores hacen lip sync por el primer puesto (TOP 2) y la mejor mitad del resto queda destacada (HIGH)." },

  // --- Regreso ---
  { id: "RETURN_NONE", group: "return", label: "Sin regreso", custom: false,
    description: "Ninguna eliminada regresa a la competición." },
  { id: "RETURN_CHOOSE", group: "return", label: "Eligen quién regresa", custom: false,
    description: "Las concursantes que quedan votan quién regresa." },
  { id: "RETURN_RANDOM", group: "return", label: "Regreso al azar", custom: false,
    description: "Una eliminada regresa elegida al azar." },
  { id: "RETURN_LALAPARUZA", group: "return", label: "LaLaParUza", custom: false,
    description: "Lip sync grupal entre eliminadas; la ganadora regresa." },
  { id: "RETURN_SMACKDOWN", group: "return", label: "Lip Sync Smackdown", custom: false,
    description: "Serie de lip syncs de eliminación entre eliminadas; la superviviente regresa." },

  // --- Formato de temporada ---
  { id: "SEASON_REGULAR", group: "season", label: "Regular", custom: false,
    description: "Formato estándar: reto semanal, top/bottom, lip sync, eliminación." },
  { id: "SEASON_TEAMS", group: "season", label: "Por equipos", custom: false,
    description: "Las concursantes compiten organizadas en equipos durante parte de la temporada." },
  { id: "SEASON_LIPSYNC_LEGACY", group: "season", label: "Lipsync For Your Legacy", custom: false,
    description: "Sistema de puntos All Stars: WIN=3, TOP2=2, resto según reglas; se acumulan puntos para llegar a la final." },
  { id: "SEASON_LIPSYNC_ASSASSIN", group: "season", label: "Lipsync Assassin", custom: false,
    description: "Una concursante es nombrada 'asesina' y reta a otra a un lip sync sin reto de por medio." },
  { id: "SEASON_ALL_WINNERS", group: "season", label: "All Winners", custom: false,
    description: "Todas las concursantes son ganadoras previas de su temporada." },

  // --- Final ---
  { id: "FINALE_TOP2", group: "finale", label: "Top 2", custom: false,
    description: "Las dos finalistas hacen lip sync por la corona." },
  { id: "FINALE_TOP3", group: "finale", label: "Top 3", custom: false,
    description: "Tres finalistas; se reduce a la ganadora mediante retos y/o lip sync." },
  { id: "FINALE_TOP4", group: "finale", label: "Top 4", custom: false,
    description: "Cuatro finalistas compiten en la gran final." },
  { id: "FINALE_TOP5", group: "finale", label: "Top 5", custom: false,
    description: "Cinco finalistas hacen actuaciones individuales; las dos mejores hacen lip sync por la corona." },
  { id: "FINALE_TEAMS", group: "finale", label: "Final por equipos (Top 4 a Top 2)", custom: false,
    description: "Cuatro finalistas; las dos peor valoradas se van y las otras dos hacen lip sync por la corona." },
  { id: "FINALE_LIPSYNC_FINALE", group: "finale", label: "Lip Sync for the Finale", custom: false,
    description: "Cuatro finalistas en una batalla de lip syncs (dos parejas y una tercera ronda de las perdedoras): tres pasan a la final." },
  { id: "FINALE_TOP8", group: "finale", label: "Top 8", custom: false,
    description: "Ocho finalistas hacen actuaciones individuales; las dos mejores hacen lip sync por la corona." },
  { id: "FINALE_TOP8_LFTC", group: "finale", label: "Top 8 Lip-Sync For The Crown", custom: false,
    description: "Rate-A-Queen entre las ocho finalistas y cuadro de eliminatorias solo de lip syncs (cuartos, semifinales y final)." },
  { id: "FINALE_TOP6_AS11", group: "finale", label: "Top 6 All Stars 11", custom: false,
    description: "Seis finalistas: dos pasan directas a la ronda 2, las otras cuatro se juegan el pase en lip syncs; eliminatorias hasta la corona." },
  { id: "FINALE_JURY_VOTE", group: "finale", label: "Jury Vote (Top 4)", custom: false,
    description: "Cuatro finalistas; las eliminadas votan y las dos más votadas hacen lip sync por la corona." },
  { id: "FINALE_JURY_TOP5", group: "finale", label: "Top 5 Jury Vote", custom: false,
    description: "Cinco finalistas defienden su caso; las eliminadas votan y las dos más votadas hacen lip sync por la corona." },
  { id: "FINALE_LIPSYNC_CROWN", group: "finale", label: "Lip-Sync For The Crown", custom: false,
    description: "Rondas sucesivas de lip sync eliminatorio hasta coronar a la ganadora." },
];

window.DEFAULT_FORMATS = DEFAULT_FORMATS;
