// Rosters de concursantes reales, agrupados por temporada de origen (extraído de tu hoja
// TRACKRECORDS / fandom wiki). Cada temporada es solo el "cast" del que vienen las
// concursantes: al simular puedes elegir libremente entre TODAS las concursantes de TODAS
// las temporadas cargadas, mezclando reinas de distinto origen en un mismo reparto.
// Amplía ALL_SEASONS (o añade una nueva temporada) para incorporar más casts.
//
// Cada concursante tiene además un bloque "stats" (0-15 por categoría, inspirado en el
// simulador de referencia myrainboww.github.io/Drag-Race-Simulator): Acting, Comedy,
// Dance, Design, Improv, Runway y Lip Sync. Son estimaciones de ambientación para que el
// motor de simulación (js/engine.js) las use al puntuar retos, NO datos oficiales.

const STAT_KEYS = ["acting", "comedy", "dance", "design", "improv", "runway", "lipsync"];
const STAT_LABELS = {
  acting: "Actuación",
  comedy: "Comedia",
  dance: "Baile",
  design: "Diseño",
  improv: "Improvisación",
  runway: "Runway",
  lipsync: "Lip Sync",
};

function randomStats() {
  const stats = {};
  STAT_KEYS.forEach((k) => { stats[k] = Math.floor(Math.random() * 16); });
  return stats;
}

const ALL_SEASONS = [
  {
    id: "US_S1",
    seasonName: "RuPaul's Drag Race — Temporada 1 (US)",
    contestants: [
      { name: "BeBe Zahara Benet", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/BeBe_Zahara_Benet",
        stats: { acting: 9, comedy: 6, dance: 12, design: 12, improv: 8, runway: 13, lipsync: 10 } },
      { name: "Nina Flowers", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Nina_Flowers",
        stats: { acting: 6, comedy: 6, dance: 11, design: 12, improv: 6, runway: 13, lipsync: 9 } },
      { name: "Rebecca Glasscock", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Rebecca_Glasscock",
        stats: { acting: 7, comedy: 6, dance: 8, design: 9, improv: 6, runway: 11, lipsync: 7 } },
      { name: "Shannel", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Shannel",
        stats: { acting: 7, comedy: 5, dance: 8, design: 12, improv: 6, runway: 12, lipsync: 8 } },
      { name: "Ongina", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Ongina",
        stats: { acting: 9, comedy: 7, dance: 7, design: 7, improv: 7, runway: 8, lipsync: 8 } },
      { name: "Jade", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jade",
        stats: { acting: 6, comedy: 8, dance: 7, design: 6, improv: 7, runway: 6, lipsync: 6 } },
      { name: "Akashia", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Akashia",
        stats: { acting: 5, comedy: 5, dance: 6, design: 5, improv: 5, runway: 6, lipsync: 5 } },
      { name: "Tammie Brown", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Tammie_Brown",
        stats: { acting: 8, comedy: 12, dance: 6, design: 7, improv: 13, runway: 7, lipsync: 6 } },
      { name: "Victoria Parker", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Victoria_Parker",
        stats: { acting: 4, comedy: 4, dance: 5, design: 5, improv: 4, runway: 5, lipsync: 4 } },
    ],
  },
  {
    id: "US_S2",
    seasonName: "RuPaul's Drag Race — Temporada 2 (US)",
    contestants: [
      { name: "Tyra Sanchez", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/Tyra_Sanchez",
        stats: { acting: 6, comedy: 5, dance: 8, design: 13, improv: 6, runway: 14, lipsync: 9 } },
      { name: "Raven", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Raven",
        stats: { acting: 9, comedy: 10, dance: 9, design: 14, improv: 9, runway: 13, lipsync: 10 } },
      { name: "Jujubee", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Jujubee",
        stats: { acting: 11, comedy: 10, dance: 8, design: 8, improv: 9, runway: 9, lipsync: 12 } },
      { name: "Tatianna", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Tatianna",
        stats: { acting: 9, comedy: 9, dance: 12, design: 7, improv: 8, runway: 9, lipsync: 13 } },
      { name: "Pandora Boxx", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Pandora_Boxx",
        stats: { acting: 8, comedy: 13, dance: 6, design: 6, improv: 11, runway: 6, lipsync: 7 } },
      { name: "Jessica Wild", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jessica_Wild",
        stats: { acting: 6, comedy: 7, dance: 10, design: 6, improv: 6, runway: 7, lipsync: 8 } },
      { name: "Sahara Davenport", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Sahara_Davenport",
        stats: { acting: 6, comedy: 5, dance: 11, design: 8, improv: 5, runway: 9, lipsync: 7 } },
      { name: "Morgan McMichaels", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Morgan_McMichaels",
        stats: { acting: 6, comedy: 6, dance: 8, design: 10, improv: 6, runway: 11, lipsync: 8 } },
      { name: "Kylie Sonique Love", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Kylie_Sonique_Love",
        stats: { acting: 6, comedy: 5, dance: 7, design: 8, improv: 5, runway: 9, lipsync: 7 } },
      { name: "Mystique Summers", finalPlacement: "10th", link: "https://rupaulsdragrace.fandom.com/wiki/Mystique_Summers",
        stats: { acting: 5, comedy: 5, dance: 6, design: 5, improv: 5, runway: 6, lipsync: 5 } },
      { name: "Nicole Paige Brooks", finalPlacement: "11th", link: "https://rupaulsdragrace.fandom.com/wiki/Nicole_Paige_Brooks",
        stats: { acting: 4, comedy: 5, dance: 5, design: 5, improv: 5, runway: 6, lipsync: 5 } },
      { name: "Shangela", finalPlacement: "12th", link: "https://rupaulsdragrace.fandom.com/wiki/Shangela",
        stats: { acting: 6, comedy: 8, dance: 7, design: 5, improv: 7, runway: 5, lipsync: 6 } },
    ],
  },
];

// Lista plana de todas las concursantes de todas las temporadas cargadas, cada una con su
// temporada de origen. El simulador usa esta lista para dejarte elegir libremente entre
// cualquier combinación, sin estar atado a un solo cast.
const ALL_CONTESTANTS = ALL_SEASONS.flatMap((season) =>
  season.contestants.map((c) => ({ ...c, season: season.seasonName, seasonId: season.id }))
);

window.STAT_KEYS = STAT_KEYS;
window.STAT_LABELS = STAT_LABELS;
window.randomStats = randomStats;
window.ALL_SEASONS = ALL_SEASONS;
window.ALL_CONTESTANTS = ALL_CONTESTANTS;
