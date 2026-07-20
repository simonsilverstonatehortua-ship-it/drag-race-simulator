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
//
// "image": foto de la concursante. Para quienes han vuelto en una temporada más reciente
// (All Stars, UK vs the World, Down Under vs the World...) se usa la foto promocional
// OFICIAL de esa temporada más reciente (alojada en static.wikia.nocookie.net, el CDN de
// imágenes del fandom wiki). Para el resto (sin retornos conocidos) se usa la foto de su
// única temporada, de MochaMishu/Drag-Race-Simulator (fork del simulador de referencia,
// alojado en raw.githubusercontent.com). Todo esto es hotlink a terceros: si algún día se
// borra o renombra, esa foto concreta deja de cargar (se oculta el icono roto, no rompe
// el resto de la app). Puedes sustituir cualquiera por tu propia URL en cualquier momento.

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

const IMG_BASE = "https://raw.githubusercontent.com/MochaMishu/Drag-Race-Simulator/main/image/queens/";
const WIKIA_IMG_BASE = "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/";

const ALL_SEASONS = [
  {
    id: "US_S1",
    seasonName: "RuPaul's Drag Race — Temporada 1 (US)",
    contestants: [
      { name: "BeBe Zahara Benet", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/BeBe_Zahara_Benet",
        // Foto de su regreso más reciente: All Stars 3 (2018).
        image: WIKIA_IMG_BASE + "e/ea/BeBeAS3Promo.png/revision/latest/scale-to-width-down/300?cb=20181021181328",
        stats: { acting: 9, comedy: 6, dance: 12, design: 12, improv: 8, runway: 13, lipsync: 10 } },
      { name: "Nina Flowers", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Nina_Flowers",
        image: IMG_BASE + "NinaFlowers.webp",
        stats: { acting: 6, comedy: 6, dance: 11, design: 12, improv: 6, runway: 13, lipsync: 9 } },
      { name: "Rebecca Glasscock", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Rebecca_Glasscock",
        image: IMG_BASE + "Rebecca.webp",
        stats: { acting: 7, comedy: 6, dance: 8, design: 9, improv: 6, runway: 11, lipsync: 7 } },
      { name: "Shannel", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Shannel",
        // Foto de su regreso más reciente: All Stars 9 (2024).
        image: WIKIA_IMG_BASE + "5/52/ShannelAS9.jpg/revision/latest/scale-to-width-down/300?cb=20240423174517",
        stats: { acting: 7, comedy: 5, dance: 8, design: 12, improv: 6, runway: 12, lipsync: 8 } },
      { name: "Ongina", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Ongina",
        // Foto de su regreso más reciente: All Stars 5 (2020).
        image: WIKIA_IMG_BASE + "0/0d/OnginaAllStars5.jpg/revision/latest/scale-to-width-down/300?cb=20200508170217",
        stats: { acting: 9, comedy: 7, dance: 7, design: 7, improv: 7, runway: 8, lipsync: 8 } },
      { name: "Jade", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jade",
        image: IMG_BASE + "Jade.webp",
        stats: { acting: 6, comedy: 8, dance: 7, design: 6, improv: 7, runway: 6, lipsync: 6 } },
      { name: "Akashia", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Akashia",
        image: IMG_BASE + "Akashia.webp",
        stats: { acting: 5, comedy: 5, dance: 6, design: 5, improv: 5, runway: 6, lipsync: 5 } },
      { name: "Tammie Brown", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Tammie_Brown",
        // Foto de su regreso más reciente: All Stars 1 (2012).
        image: WIKIA_IMG_BASE + "a/a8/Tammie_Brown_All_Stars.jpg/revision/latest/scale-to-width-down/300?cb=20210906195713",
        stats: { acting: 8, comedy: 12, dance: 6, design: 7, improv: 13, runway: 7, lipsync: 6 } },
      { name: "Victoria Parker", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Victoria_Parker",
        image: IMG_BASE + "Victoria.webp",
        stats: { acting: 4, comedy: 4, dance: 5, design: 5, improv: 4, runway: 5, lipsync: 4 } },
    ],
  },
  {
    id: "US_S2",
    seasonName: "RuPaul's Drag Race — Temporada 2 (US)",
    contestants: [
      { name: "Tyra Sanchez", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/Tyra_Sanchez",
        image: IMG_BASE + "Tyra.webp",
        stats: { acting: 6, comedy: 5, dance: 8, design: 13, improv: 6, runway: 14, lipsync: 9 } },
      { name: "Raven", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Raven",
        // Foto de su regreso más reciente: Drag Race Down Under vs The World T1 (2026).
        image: WIKIA_IMG_BASE + "9/9a/RavenDUvsTW1.jpg/revision/latest/scale-to-width-down/300?cb=20260623203742",
        stats: { acting: 9, comedy: 10, dance: 9, design: 14, improv: 9, runway: 13, lipsync: 10 } },
      { name: "Jujubee", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Jujubee",
        // Foto de su regreso más reciente: UK vs the World T1 (2022).
        image: WIKIA_IMG_BASE + "e/ea/JujubeeUKvsTW.jpeg/revision/latest/scale-to-width-down/300?cb=20220117162759",
        stats: { acting: 11, comedy: 10, dance: 8, design: 8, improv: 9, runway: 9, lipsync: 12 } },
      { name: "Tatianna", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Tatianna",
        // Foto de su regreso más reciente: All Stars 2 (2016).
        image: WIKIA_IMG_BASE + "f/f8/Rpdr-as-s2-t-w.jpg/revision/latest/scale-to-width-down/300?cb=20200126212216",
        stats: { acting: 9, comedy: 9, dance: 12, design: 7, improv: 8, runway: 9, lipsync: 13 } },
      { name: "Pandora Boxx", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Pandora_Boxx",
        // Foto de su regreso más reciente: All Stars 6 (2021).
        image: WIKIA_IMG_BASE + "c/c5/PandoraBoxxAS6.png/revision/latest/scale-to-width-down/300?cb=20210526183915",
        stats: { acting: 8, comedy: 13, dance: 6, design: 6, improv: 11, runway: 6, lipsync: 7 } },
      { name: "Jessica Wild", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jessica_Wild",
        // Foto de su regreso más reciente: All Stars 8 (2023).
        image: WIKIA_IMG_BASE + "4/41/JessicaWildAS8.jpg/revision/latest/scale-to-width-down/300?cb=20230420190123",
        stats: { acting: 6, comedy: 7, dance: 10, design: 6, improv: 6, runway: 7, lipsync: 8 } },
      { name: "Sahara Davenport", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Sahara_Davenport",
        image: IMG_BASE + "Sahara.webp",
        stats: { acting: 6, comedy: 5, dance: 11, design: 8, improv: 5, runway: 9, lipsync: 7 } },
      { name: "Morgan McMichaels", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Morgan_McMichaels",
        // Foto de su regreso más reciente: All Stars 11 (2026).
        image: WIKIA_IMG_BASE + "7/79/MorganMcMichaelsAS11.jpg/revision/latest/scale-to-width-down/300?cb=20260422165509",
        stats: { acting: 6, comedy: 6, dance: 8, design: 10, improv: 6, runway: 11, lipsync: 8 } },
      { name: "Kylie Sonique Love", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Kylie_Sonique_Love",
        // Foto de su regreso más reciente: All Stars 6 (2021, ganadora).
        image: WIKIA_IMG_BASE + "3/34/KylieSoniqueLoveAS6.png/revision/latest/scale-to-width-down/300?cb=20210528135509",
        stats: { acting: 6, comedy: 5, dance: 7, design: 8, improv: 5, runway: 9, lipsync: 7 } },
      { name: "Mystique Summers", finalPlacement: "10th", link: "https://rupaulsdragrace.fandom.com/wiki/Mystique_Summers",
        // Foto de su regreso más reciente: All Stars 11 (2026).
        image: WIKIA_IMG_BASE + "e/e1/MystiqueSummersAS11.jpg/revision/latest/scale-to-width-down/300?cb=20260422165717",
        stats: { acting: 5, comedy: 5, dance: 6, design: 5, improv: 5, runway: 6, lipsync: 5 } },
      { name: "Nicole Paige Brooks", finalPlacement: "11th", link: "https://rupaulsdragrace.fandom.com/wiki/Nicole_Paige_Brooks",
        // Foto de su regreso más reciente: Drag Race Down Under vs The World T1 (2026).
        image: WIKIA_IMG_BASE + "c/ce/NicolePaigeBrooksDUvsTW1.jpg/revision/latest/scale-to-width-down/300?cb=20260623204232",
        stats: { acting: 4, comedy: 5, dance: 5, design: 5, improv: 5, runway: 6, lipsync: 5 } },
      { name: "Shangela", finalPlacement: "12th", link: "https://rupaulsdragrace.fandom.com/wiki/Shangela",
        // Foto de su regreso más reciente: All Stars 3 (2018).
        image: WIKIA_IMG_BASE + "3/36/ShangelaAS3.jpg/revision/latest/scale-to-width-down/300?cb=20171021011525",
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
