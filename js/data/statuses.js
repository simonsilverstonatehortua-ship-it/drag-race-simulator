// Catálogo de estados (semanales y de colocación final).
// Basado en la notación usada en rupaulsdragrace.fandom.com y en tu hoja TRACKRECORDS.
// custom:false = viene de la referencia oficial. Puedes añadir los tuyos desde la UI.
//
// "countsForPoints": si el estado entra en el cálculo de PPE (puntos por episodio) que se
// muestra en la tabla de trackrecord y en la pestaña Estadísticas. Solo los estados
// semanales "de reto" cuentan; el resto (MVQ, ADV, RTRN, QUIT, DISQ, GUEST) y las
// colocaciones finales (que ya suman aparte como puntos de carrera) quedan fuera del
// promedio.

const DEFAULT_STATUSES = [
  // --- Estados semanales (por reto) ---
  { id: "WIN", label: "Ganadora del reto (única)", type: "weekly", color: "#4169e1",
    points: 10, countsForPoints: true, custom: false,
    description: "Es la única ganadora del maxi reto de la semana." },
  { id: "WIN_TIE", label: "Ganadora empatada (Lipsync For Your Legacy)", type: "weekly", color: "#00008b",
    points: 10, countsForPoints: true, custom: false,
    description: "Empata como mejor de la semana en un Lipsync For Your Legacy: ambas ganan el reto y se quedan con 10 puntos, gane o pierda el lip sync por su legado." },
  { id: "TOP2", label: "Gana el reto, pierde el Lipsync For Your Legacy", type: "weekly", color: "#00bfff",
    points: 10, countsForPoints: true, custom: false,
    description: "En un Lipsync For Your Legacy sin empate exacto de puntaje: gana el reto pero pierde el lip sync por su legado (se queda con los 10 puntos, sin poder de eliminación)." },
  { id: "WIN_RUNWAY", label: "Gana el reto por la pasarela", type: "weekly", color: "#00bfff",
    points: 10, countsForPoints: true, custom: false,
    description: "Gana el maxi reto de la semana en una categoría de solo pasarela (Ball, Runway libre, etc.)." },
  { id: "TIEBREAK_LOSE", label: "Empata el reto pero pierde el lip sync de desempate", type: "weekly", color: "#00bfff",
    points: 9, countsForPoints: true, custom: false,
    description: "Empata como mejor puntuada de la semana, hace lip sync para decidir la única ganadora del reto y lo pierde: se queda con 9 puntos. No es lo mismo que un Lipsync For Your Legacy: aquí solo hay una ganadora del reto." },
  { id: "HIGH", label: "Destacada (HIGH)", type: "weekly", color: "#add8e6",
    points: 8, countsForPoints: true, custom: false,
    description: "Entre las mejores de la semana, sin llegar a ganar." },
  { id: "HIGH_GROUP", label: "Grupo destacado (reto en equipos)", type: "weekly", color: "#7fffd4",
    points: 8, countsForPoints: true, custom: false,
    description: "En un reto en grupos/equipos: forma parte del grupo destacado de la semana (ni el ganador ni el peor)." },
  { id: "SAFE", label: "A salvo (SAFE)", type: "weekly", color: "#f9f9ff",
    points: 5, countsForPoints: true, custom: false,
    description: "Ni entre las mejores ni entre las peores." },
  { id: "LOW", label: "Floja (LOW)", type: "weekly", color: "#ffb6c1",
    points: 3, countsForPoints: true, custom: false,
    description: "Entre las peores, pero no en el fondo de la clasificación." },
  { id: "BTM", label: "En el fondo, sobrevive (BOTTOM)", type: "weekly", color: "#ff6347",
    points: 1, countsForPoints: true, custom: false,
    description: "Es la única en el fondo que sobrevive al lip sync por su vida." },
  { id: "BTM_MULTI", label: "En el fondo junto a otra(s), nadie es eliminada", type: "weekly", color: "#ff69b4",
    points: 1, countsForPoints: true, custom: false,
    description: "Dos o más concursantes están en el fondo de la clasificación pero ninguna es eliminada esta semana." },
  { id: "ELIM", label: "Eliminada", type: "weekly", color: "#ff0000",
    points: 0, countsForPoints: true, custom: false,
    description: "Pierde el lip sync y es eliminada de la competición." },
  { id: "ELIM_MULTI", label: "Eliminada (doble o más eliminación)", type: "weekly", color: "#8b0000",
    points: 0, countsForPoints: true, custom: false,
    description: "Es eliminada la misma semana que otra(s) concursante(s) (doble o triple eliminación)." },
  { id: "MVQ", label: "Most Valuable Queen (MVQ)", type: "weekly", color: "#B08CC7",
    points: 0, countsForPoints: false, custom: false,
    description: "Está en el fondo pero participa en el reparto de puntos de la 'Reina Más Valiosa'." },
  { id: "ADV", label: "Avanza de bracket (ADV)", type: "weekly", color: "#5FA3D0",
    points: 0, countsForPoints: false, custom: false,
    description: "Avanza a la siguiente fase en un formato de brackets/torneo." },
  { id: "RTRN", label: "Regresa a competir (RETURN)", type: "weekly", color: "#3FA796",
    points: 0, countsForPoints: false, custom: false,
    description: "Concursante eliminada que regresa a la competición." },
  { id: "QUIT", label: "Abandona (QUIT)", type: "weekly", color: "#5A3E3E",
    points: 0, countsForPoints: false, custom: false,
    description: "Abandona la competición voluntariamente." },
  { id: "DISQ", label: "Descalificada (DISQ)", type: "weekly", color: "#3A3A3A",
    points: 0, countsForPoints: false, custom: false,
    description: "Descalificada por la producción/RuPaul." },
  { id: "GUEST", label: "Invitada (ya eliminada)", type: "weekly", color: "#6B6B6B",
    points: 0, countsForPoints: false, custom: false,
    description: "Aparece como invitada tras haber sido eliminada (reunion, finale, etc.)." },

  // --- Colocaciones finales (no cuentan para el PPE; suman aparte como puntos de carrera) ---
  { id: "WINNER", label: "Ganadora de la temporada", type: "final", color: "#D4AF37",
    points: 10, countsForPoints: false, custom: false,
    description: "Corona final de la temporada." },
  { id: "RUNNER_UP", label: "Finalista (Runner-up)", type: "final", color: "#C0C0C0",
    points: 7, countsForPoints: false, custom: false,
    description: "Segunda posición final." },
  { id: "MISS_CONGENIALITY", label: "Miss Simpatía", type: "final", color: "#E4136B",
    points: 5, countsForPoints: false, custom: false,
    description: "Premio a la concursante más querida por sus compañeras." },
];

// Se combina con lo que el usuario guarde en localStorage (ver store.js)
window.DEFAULT_STATUSES = DEFAULT_STATUSES;
