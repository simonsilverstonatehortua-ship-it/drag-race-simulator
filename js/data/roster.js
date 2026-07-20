// Rosters de concursantes reales, agrupados por temporada de origen (extraído de tu hoja
// TRACKRECORDS / fandom wiki). Cada temporada es solo el "cast" del que vienen las
// concursantes: al simular puedes elegir libremente entre TODAS las concursantes de TODAS
// las temporadas cargadas, mezclando reinas de distinto origen en un mismo reparto.
// Amplía ALL_SEASONS (o añade una nueva temporada) para incorporar más casts.

const ALL_SEASONS = [
  {
    id: "US_S1",
    seasonName: "RuPaul's Drag Race — Temporada 1 (US)",
    contestants: [
      { name: "BeBe Zahara Benet", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/BeBe_Zahara_Benet" },
      { name: "Nina Flowers", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Nina_Flowers" },
      { name: "Rebecca Glasscock", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Rebecca_Glasscock" },
      { name: "Shannel", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Shannel" },
      { name: "Ongina", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Ongina" },
      { name: "Jade", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jade" },
      { name: "Akashia", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Akashia" },
      { name: "Tammie Brown", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Tammie_Brown" },
      { name: "Victoria Parker", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Victoria_Parker" },
    ],
  },
  {
    id: "US_S2",
    seasonName: "RuPaul's Drag Race — Temporada 2 (US)",
    contestants: [
      { name: "Tyra Sanchez", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/Tyra_Sanchez" },
      { name: "Raven", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Raven" },
      { name: "Jujubee", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Jujubee" },
      { name: "Tatianna", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Tatianna" },
      { name: "Pandora Boxx", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Pandora_Boxx" },
      { name: "Jessica Wild", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jessica_Wild" },
      { name: "Sahara Davenport", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Sahara_Davenport" },
      { name: "Morgan McMichaels", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Morgan_McMichaels" },
      { name: "Kylie Sonique Love", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Kylie_Sonique_Love" },
      { name: "Mystique Summers", finalPlacement: "10th", link: "https://rupaulsdragrace.fandom.com/wiki/Mystique_Summers" },
      { name: "Nicole Paige Brooks", finalPlacement: "11th", link: "https://rupaulsdragrace.fandom.com/wiki/Nicole_Paige_Brooks" },
      { name: "Shangela", finalPlacement: "12th", link: "https://rupaulsdragrace.fandom.com/wiki/Shangela" },
    ],
  },
];

// Lista plana de todas las concursantes de todas las temporadas cargadas, cada una con su
// temporada de origen. El simulador usa esta lista para dejarte elegir libremente entre
// cualquier combinación, sin estar atado a un solo cast.
const ALL_CONTESTANTS = ALL_SEASONS.flatMap((season) =>
  season.contestants.map((c) => ({ ...c, season: season.seasonName, seasonId: season.id }))
);

window.ALL_SEASONS = ALL_SEASONS;
window.ALL_CONTESTANTS = ALL_CONTESTANTS;
