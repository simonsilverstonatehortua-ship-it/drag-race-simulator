// Catálogo de estados (semanales y de colocación final).
// Basado en la notación usada en rupaulsdragrace.fandom.com y en tu hoja TRACKRECORDS.
// custom:false = viene de la referencia oficial. Puedes añadir los tuyos desde la UI.
//
// "countsForPoints": si el estado entra en el cálculo de PPE (puntos por episodio) que se
// muestra en la tabla de trackrecord y en la pestaña Estadísticas. Solo los 7 estados
// semanales "de reto" (WIN/TOP2/HIGH/SAFE/LOW/BTM/ELIM) cuentan; el resto (MVQ, ADV, RTRN,
// QUIT, DISQ, GUEST) y las colocaciones finales (que ya suman aparte como puntos de
// carrera) quedan fuera del promedio.

const DEFAULT_STATUSES = [
  // --- Estados semanales (por reto) ---
  { id: "WIN", label: "Ganadora del reto", type: "weekly", color: "#D4AF37",
    points: 10, countsForPoints: true, custom: false,
    description: "Gana el reto principal (maxi challenge) de la semana." },
  { id: "TOP2", label: "Gana el reto, pierde el lip sync (TOP2)", type: "weekly", color: "#8CA6D4",
    points: 9, countsForPoints: true, custom: false,
    description: "Formato All Stars: gana el reto pero pierde el Lip Sync for Your Legacy." },
  { id: "HIGH", label: "Destacada (HIGH)", type: "weekly", color: "#4FD1C5",
    points: 8, countsForPoints: true, custom: false,
    description: "Entre las mejores de la semana, sin llegar a ganar." },
  { id: "SAFE", label: "A salvo (SAFE)", type: "weekly", color: "#7C8CA6",
    points: 5, countsForPoints: true, custom: false,
    description: "Ni entre las mejores ni entre las peores." },
  { id: "LOW", label: "Floja (LOW)", type: "weekly", color: "#E08A3E",
    points: 3, countsForPoints: true, custom: false,
    description: "Entre las peores, pero no en el fondo de la clasificación." },
  { id: "BTM", label: "En el fondo (BOTTOM)", type: "weekly", color: "#C24E4E",
    points: 1, countsForPoints: true, custom: false,
    description: "Entre las dos (o más) peores; se enfrenta al lip sync por su vida." },
  { id: "ELIM", label: "Eliminada", type: "weekly", color: "#7A1F2B",
    points: 0, countsForPoints: true, custom: false,
    description: "Pierde el lip sync y es eliminada de la competición." },
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
