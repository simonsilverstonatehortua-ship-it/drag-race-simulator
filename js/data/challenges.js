// Catálogo de tipos de reto (maxi challenges), extraídos de tu hoja TRACKRECORDS.
// category: "maxi" (reto principal) | "mini" (mini reto) | "runway" (solo pasarela)
// stats: qué estadísticas de la concursante (js/data/roster.js) son relevantes para este
// reto; el motor de simulación (js/engine.js) las usa para influir en la puntuación en
// vez de puntuar totalmente al azar. Si se deja vacío (p.ej. en retos personalizados sin
// estadísticas marcadas), el reto se puntúa con el promedio de todas las estadísticas.

const DEFAULT_CHALLENGES = [
  { id: "DESIGN", label: "Diseño / Confección", category: "maxi", custom: false, stats: ["design"],
    description: "Confeccionar un look desde cero con un tiempo y presupuesto limitados." },
  { id: "ACTING", label: "Actuación", category: "maxi", custom: false, stats: ["acting"],
    description: "Reto de interpretación dramática o comedia en un sketch/escena." },
  { id: "IMPROV", label: "Improvisación", category: "maxi", custom: false, stats: ["improv", "comedy"],
    description: "Reto de improvisación cómica en personaje." },
  { id: "SNATCH_GAME", label: "Snatch Game", category: "maxi", custom: false, stats: ["comedy", "acting"],
    description: "El clásico concurso de imitación de celebridades." },
  { id: "RUSICAL", label: "Rusical", category: "maxi", custom: false, stats: ["dance", "acting", "lipsync", "singing", "verses"],
    description: "Número musical con canto, baile y actuación en un musical original." },
  { id: "BALL", label: "Ball / Eleganza", category: "runway", custom: false, stats: ["runway", "design", "makeup"],
    description: "Pasarela temática por categorías (Extravagant Eleganza, etc.)." },
  { id: "TALENT_SHOW", label: "Talent Show", category: "maxi", custom: false, stats: ["talent", "improv", "dance"],
    description: "Cada concursante presenta su propio número de talento." },
  { id: "ROAST", label: "Roast de RuPaul", category: "maxi", custom: false, stats: ["comedy"],
    description: "Comedia de improvisación burlándose de RuPaul y compañeras." },
  { id: "GIRL_GROUP", label: "Girl Group", category: "maxi", custom: false, stats: ["dance", "lipsync", "singing", "verses"],
    description: "Formar un grupo musical, coreografía y canto en directo o playback." },
  { id: "MAKEOVER", label: "Make Over", category: "maxi", custom: false, stats: ["design", "runway", "makeup"],
    description: "Transformar a una persona (familiar, fan, etc.) en una reina." },
  { id: "STAND_UP", label: "Stand Up", category: "maxi", custom: false, stats: ["comedy"],
    description: "Monólogo de comedia en directo." },
  { id: "CHOREO", label: "Coreografía", category: "maxi", custom: false, stats: ["dance"],
    description: "Reto centrado en una coreografía de baile grupal o individual." },
  { id: "ADVERT", label: "Anuncio comercial", category: "maxi", custom: false, stats: ["acting", "comedy"],
    description: "Grabar un anuncio publicitario paródico." },
  { id: "MUSIC_VIDEO", label: "Videoclip", category: "maxi", custom: false, stats: ["dance", "lipsync", "singing", "verses"],
    description: "Grabar el videoclip de una canción (a menudo de RuPaul)." },
  { id: "PHOTO_SHOOT", label: "Sesión de fotos", category: "maxi", custom: false, stats: ["runway", "makeup"],
    description: "Sesión fotográfica editorial con un concepto concreto." },
  { id: "RUNWAY", label: "Runway libre", category: "runway", custom: false, stats: ["runway", "makeup"],
    description: "Pasarela sin categoría temática específica." },
  { id: "MEET_THE_QUEENS", label: "Meet the Queens", category: "maxi", custom: false, noElim: true,
    stats: ["charisma", "nerve", "runway", "design", "makeup"],
    presentationStats: ["charisma", "nerve"], lookStats: ["runway", "design", "makeup"],
    description: "Presentación inicial: no hay eliminación esta semana. Se destaca a quien mejor se presenta y a quien luce el mejor look de promo." },
  { id: "CHOREO_LOOKS", label: "Coreografía y looks de coreo", category: "maxi", custom: false,
    stats: ["dance", "design", "makeup"],
    description: "Reto doble: montar una coreografía grupal/individual y diseñar los looks que se lucirán en ella." },
];

// Escala de puntuación por reto usada en tu hoja (0 a 10).
const DEFAULT_SCORE_SCALE = [
  { value: 0, label: "Fracaso total" },
  { value: 1, label: "Deficiente" },
  { value: 3, label: "Regular" },
  { value: 5, label: "Aceptable" },
  { value: 8, label: "Notable" },
  { value: 10, label: "Sobresaliente" },
];

window.DEFAULT_CHALLENGES = DEFAULT_CHALLENGES;
window.DEFAULT_SCORE_SCALE = DEFAULT_SCORE_SCALE;
