// Rosters de concursantes reales, agrupados por temporada de origen (extraído de tu hoja
// TRACKRECORDS / fandom wiki). Cada temporada es solo el "cast" del que vienen las
// concursantes: al simular puedes elegir libremente entre TODAS las concursantes de TODAS
// las temporadas cargadas, mezclando reinas de distinto origen en un mismo reparto.
// Amplía ALL_SEASONS (o añade una nueva temporada) para incorporar más casts.
//
// Cada concursante tiene un bloque "stats" (0-15 por categoría, inspirado en el simulador
// de referencia myrainboww.github.io/Drag-Race-Simulator) con 15 estadísticas:
// - Acting, Comedy, Dance, Design, Improv, Runway, Lip Sync, Makeup, Singing, Verses:
//   usadas por el motor de simulación (js/engine.js) para sesgar la puntuación de cada
//   reto según su categoría.
// - Strategy: cuánto juega estratégicamente (alianzas, traiciones, elegir rival en
//   Lipsync Assassin / Lipsync For Your Legacy / formatos de bracket); también determina
//   cuán marcadas son sus relaciones con las demás antes de empezar la temporada.
// - Charisma, Uniqueness, Nerve, Talent (el "C.U.N.T." clásico de RuPaul): influyen en
//   Miss Simpatía, el voto del jurado y el reto de Talent Show.
// Son estimaciones de ambientación para el juego, NO datos oficiales.
//
// "image": foto de la concursante (su última aparición en la franquicia, ver README).
// La mayoría son hotlink a static.wikia.nocookie.net (CDN de imágenes del fandom wiki) o a
// raw.githubusercontent.com (fork del simulador de referencia); unas pocas usan Wikimedia
// Commons cuando no hay foto promocional disponible. Todo esto es hotlink a terceros: si
// algún día se borra o renombra, esa foto concreta deja de cargar (se oculta el icono
// roto, no rompe el resto de la app). Puedes sustituir cualquiera por tu propia URL.

const STAT_KEYS = ["acting", "comedy", "dance", "design", "improv", "runway", "lipsync", "makeup", "singing", "verses", "strategy", "charisma", "uniqueness", "nerve", "talent"];
const STAT_LABELS = {
  acting: "Actuación",
  comedy: "Comedia",
  dance: "Baile",
  design: "Diseño",
  improv: "Improvisación",
  runway: "Runway",
  lipsync: "Lip Sync",
  makeup: "Maquillaje",
  singing: "Canto",
  verses: "Versos",
  strategy: "Estrategia",
  charisma: "Carisma",
  uniqueness: "Originalidad",
  nerve: "Nervio",
  talent: "Talento",
};

function randomStats() {
  const stats = {};
  STAT_KEYS.forEach((k) => { stats[k] = Math.floor(Math.random() * 16); });
  return stats;
}

const IMG_BASE = "https://raw.githubusercontent.com/MochaMishu/Drag-Race-Simulator/main/image/queens/";

const ALL_SEASONS = [
  {
    id: "US_S1",
    seasonName: "RuPaul's Drag Race — Temporada 1 (US)",
    contestants: [
      { name: "BeBe Zahara Benet", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/BeBe_Zahara_Benet",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/e/ea/BeBeAS3Promo.png/revision/latest/scale-to-width-down/300?cb=20181021181328",
        stats: { acting: 9, comedy: 6, dance: 12, design: 12, improv: 8, runway: 13, lipsync: 10, makeup: 12, singing: 6, verses: 5, strategy: 10, charisma: 8, uniqueness: 9, nerve: 9, talent: 10 } },
      { name: "Nina Flowers", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Nina_Flowers",
        image: IMG_BASE + "NinaFlowers.webp",
        stats: { acting: 6, comedy: 6, dance: 11, design: 12, improv: 6, runway: 13, lipsync: 9, makeup: 11, singing: 5, verses: 5, strategy: 6, charisma: 8, uniqueness: 10, nerve: 7, talent: 9 } },
      { name: "Rebecca Glasscock", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Rebecca_Glasscock",
        image: IMG_BASE + "Rebecca.webp",
        stats: { acting: 7, comedy: 6, dance: 8, design: 9, improv: 6, runway: 11, lipsync: 7, makeup: 8, singing: 5, verses: 4, strategy: 6, charisma: 7, uniqueness: 6, nerve: 6, talent: 6 } },
      { name: "Shannel", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Shannel",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/5/52/ShannelAS9.jpg/revision/latest/scale-to-width-down/300?cb=20240423174517",
        stats: { acting: 7, comedy: 5, dance: 8, design: 12, improv: 6, runway: 12, lipsync: 8, makeup: 11, singing: 5, verses: 4, strategy: 8, charisma: 7, uniqueness: 6, nerve: 7, talent: 7 } },
      { name: "Ongina", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Ongina",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/0/0d/OnginaAllStars5.jpg/revision/latest/scale-to-width-down/300?cb=20200508170217",
        stats: { acting: 9, comedy: 7, dance: 7, design: 7, improv: 7, runway: 8, lipsync: 8, makeup: 8, singing: 6, verses: 5, strategy: 6, charisma: 9, uniqueness: 7, nerve: 8, talent: 7 } },
      { name: "Jade", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jade",
        image: IMG_BASE + "Jade.webp",
        stats: { acting: 6, comedy: 8, dance: 7, design: 6, improv: 7, runway: 6, lipsync: 6, makeup: 6, singing: 5, verses: 5, strategy: 5, charisma: 7, uniqueness: 6, nerve: 6, talent: 6 } },
      { name: "Akashia", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Akashia",
        image: IMG_BASE + "Akashia.webp",
        stats: { acting: 5, comedy: 5, dance: 6, design: 5, improv: 5, runway: 6, lipsync: 5, makeup: 5, singing: 4, verses: 4, strategy: 4, charisma: 5, uniqueness: 5, nerve: 5, talent: 5 } },
      { name: "Tammie Brown", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Tammie_Brown",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/a/a8/Tammie_Brown_All_Stars.jpg/revision/latest/scale-to-width-down/300?cb=20210906195713",
        stats: { acting: 8, comedy: 12, dance: 6, design: 7, improv: 13, runway: 7, lipsync: 6, makeup: 6, singing: 6, verses: 6, strategy: 5, charisma: 9, uniqueness: 15, nerve: 10, talent: 8 } },
      { name: "Victoria Parker", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Victoria_Parker",
        image: IMG_BASE + "Victoria.webp",
        stats: { acting: 4, comedy: 4, dance: 5, design: 5, improv: 4, runway: 5, lipsync: 4, makeup: 4, singing: 4, verses: 4, strategy: 3, charisma: 4, uniqueness: 4, nerve: 4, talent: 4 } },
    ],
  },
  {
    id: "US_S2",
    seasonName: "RuPaul's Drag Race — Temporada 2 (US)",
    contestants: [
      { name: "Tyra Sanchez", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/Tyra_Sanchez",
        image: IMG_BASE + "Tyra.webp",
        stats: { acting: 6, comedy: 5, dance: 8, design: 13, improv: 6, runway: 14, lipsync: 9, makeup: 13, singing: 5, verses: 5, strategy: 9, charisma: 5, uniqueness: 6, nerve: 6, talent: 8 } },
      { name: "Raven", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Raven",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/9/9a/RavenDUvsTW1.jpg/revision/latest/scale-to-width-down/300?cb=20260623203742",
        stats: { acting: 9, comedy: 10, dance: 9, design: 14, improv: 9, runway: 13, lipsync: 10, makeup: 13, singing: 7, verses: 7, strategy: 12, charisma: 9, uniqueness: 9, nerve: 9, talent: 10 } },
      { name: "Jujubee", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Jujubee",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/e/ea/JujubeeUKvsTW.jpeg/revision/latest/scale-to-width-down/300?cb=20220117162759",
        stats: { acting: 11, comedy: 10, dance: 8, design: 8, improv: 9, runway: 9, lipsync: 12, makeup: 9, singing: 8, verses: 8, strategy: 10, charisma: 12, uniqueness: 9, nerve: 9, talent: 10 } },
      { name: "Tatianna", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Tatianna",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/f/f8/Rpdr-as-s2-t-w.jpg/revision/latest/scale-to-width-down/300?cb=20200126212216",
        stats: { acting: 9, comedy: 9, dance: 12, design: 7, improv: 8, runway: 9, lipsync: 13, makeup: 8, singing: 9, verses: 7, strategy: 8, charisma: 9, uniqueness: 8, nerve: 8, talent: 11 } },
      { name: "Pandora Boxx", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Pandora_Boxx",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/c/c5/PandoraBoxxAS6.png/revision/latest/scale-to-width-down/300?cb=20210526183915",
        stats: { acting: 8, comedy: 13, dance: 6, design: 6, improv: 11, runway: 6, lipsync: 7, makeup: 7, singing: 6, verses: 8, strategy: 6, charisma: 10, uniqueness: 8, nerve: 8, talent: 9 } },
      { name: "Jessica Wild", finalPlacement: "6th", link: "https://rupaulsdragrace.fandom.com/wiki/Jessica_Wild",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/4/41/JessicaWildAS8.jpg/revision/latest/scale-to-width-down/300?cb=20230420190123",
        stats: { acting: 6, comedy: 7, dance: 10, design: 6, improv: 6, runway: 7, lipsync: 8, makeup: 7, singing: 8, verses: 6, strategy: 6, charisma: 8, uniqueness: 7, nerve: 8, talent: 8 } },
      { name: "Sahara Davenport", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Sahara_Davenport",
        image: IMG_BASE + "Sahara.webp",
        stats: { acting: 6, comedy: 5, dance: 11, design: 8, improv: 5, runway: 9, lipsync: 7, makeup: 8, singing: 6, verses: 5, strategy: 5, charisma: 6, uniqueness: 6, nerve: 6, talent: 8 } },
      { name: "Morgan McMichaels", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Morgan_McMichaels",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/7/79/MorganMcMichaelsAS11.jpg/revision/latest/scale-to-width-down/300?cb=20260422165509",
        stats: { acting: 6, comedy: 6, dance: 8, design: 10, improv: 6, runway: 11, lipsync: 8, makeup: 10, singing: 6, verses: 5, strategy: 7, charisma: 7, uniqueness: 6, nerve: 7, talent: 7 } },
      { name: "Kylie Sonique Love", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Kylie_Sonique_Love",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/3/34/KylieSoniqueLoveAS6.png/revision/latest/scale-to-width-down/300?cb=20210528135509",
        stats: { acting: 6, comedy: 5, dance: 7, design: 8, improv: 5, runway: 9, lipsync: 7, makeup: 8, singing: 6, verses: 5, strategy: 6, charisma: 8, uniqueness: 7, nerve: 7, talent: 7 } },
      { name: "Mystique Summers", finalPlacement: "10th", link: "https://rupaulsdragrace.fandom.com/wiki/Mystique_Summers",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/e/e1/MystiqueSummersAS11.jpg/revision/latest/scale-to-width-down/300?cb=20260422165717",
        stats: { acting: 5, comedy: 5, dance: 6, design: 5, improv: 5, runway: 6, lipsync: 5, makeup: 5, singing: 5, verses: 5, strategy: 4, charisma: 5, uniqueness: 5, nerve: 5, talent: 5 } },
      { name: "Nicole Paige Brooks", finalPlacement: "11th", link: "https://rupaulsdragrace.fandom.com/wiki/Nicole_Paige_Brooks",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/c/ce/NicolePaigeBrooksDUvsTW1.jpg/revision/latest/scale-to-width-down/300?cb=20260623204232",
        stats: { acting: 4, comedy: 5, dance: 5, design: 5, improv: 5, runway: 6, lipsync: 5, makeup: 5, singing: 5, verses: 5, strategy: 4, charisma: 5, uniqueness: 5, nerve: 5, talent: 5 } },
      { name: "Shangela", finalPlacement: "12th", link: "https://rupaulsdragrace.fandom.com/wiki/Shangela",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/3/36/ShangelaAS3.jpg/revision/latest/scale-to-width-down/300?cb=20171021011525",
        stats: { acting: 6, comedy: 8, dance: 7, design: 5, improv: 7, runway: 5, lipsync: 6, makeup: 7, singing: 7, verses: 8, strategy: 9, charisma: 11, uniqueness: 8, nerve: 10, talent: 9 } },
    ],
  },
  {
    id: "US_S3",
    seasonName: "RuPaul's Drag Race — Temporada 3 (US)",
    contestants: [
      { name: "Raja", finalPlacement: "WINNER", link: "https://rupaulsdragrace.fandom.com/wiki/Raja",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/d/dd/RajaAS7Promo.jpg/revision/latest/scale-to-width-down/300?cb=20220413174234",
        stats: { acting: 8, comedy: 7, dance: 9, design: 10, improv: 8, runway: 14, lipsync: 9, makeup: 14, singing: 6, verses: 6, strategy: 11, charisma: 8, uniqueness: 10, nerve: 7, talent: 9 } },
      { name: "Manila Luzon", finalPlacement: "RUNNER_UP", link: "https://rupaulsdragrace.fandom.com/wiki/Manila_Luzon",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/6/6b/ManilaAS4Promo.png/revision/latest/scale-to-width-down/300?cb=20181109165646",
        stats: { acting: 8, comedy: 11, dance: 8, design: 12, improv: 9, runway: 12, lipsync: 8, makeup: 12, singing: 7, verses: 8, strategy: 12, charisma: 10, uniqueness: 9, nerve: 9, talent: 9 } },
      { name: "Alexis Mateo", finalPlacement: "3rd", link: "https://rupaulsdragrace.fandom.com/wiki/Alexis_Mateo",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/e/e0/AlexisMateoCAvsTW2.jpeg/revision/latest/scale-to-width-down/300?cb=20240626150710",
        stats: { acting: 7, comedy: 8, dance: 10, design: 7, improv: 7, runway: 9, lipsync: 9, makeup: 9, singing: 7, verses: 6, strategy: 9, charisma: 10, uniqueness: 7, nerve: 8, talent: 9 } },
      { name: "Yara Sofia", finalPlacement: "4th", link: "https://rupaulsdragrace.fandom.com/wiki/Yara_Sofia",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/b/b5/YaraSofiaAS6PromoLook.jpg/revision/latest/scale-to-width-down/300?cb=20210526211709",
        stats: { acting: 7, comedy: 12, dance: 8, design: 6, improv: 9, runway: 7, lipsync: 8, makeup: 7, singing: 6, verses: 6, strategy: 6, charisma: 11, uniqueness: 9, nerve: 10, talent: 8 } },
      { name: "Carmen Carrera", finalPlacement: "5th", link: "https://rupaulsdragrace.fandom.com/wiki/Carmen_Carrera",
        image: IMG_BASE + "Carmen.webp",
        stats: { acting: 6, comedy: 5, dance: 8, design: 8, improv: 5, runway: 13, lipsync: 8, makeup: 11, singing: 5, verses: 4, strategy: 5, charisma: 7, uniqueness: 6, nerve: 6, talent: 7 } },
      { name: "Delta Work", finalPlacement: "7th", link: "https://rupaulsdragrace.fandom.com/wiki/Delta_Work",
        image: IMG_BASE + "Delta.webp",
        stats: { acting: 7, comedy: 8, dance: 6, design: 9, improv: 7, runway: 9, lipsync: 6, makeup: 9, singing: 5, verses: 5, strategy: 7, charisma: 8, uniqueness: 8, nerve: 8, talent: 7 } },
      { name: "Stacy Layne Matthews", finalPlacement: "8th", link: "https://rupaulsdragrace.fandom.com/wiki/Stacy_Layne_Matthews",
        image: IMG_BASE + "Stacy.webp",
        stats: { acting: 6, comedy: 8, dance: 5, design: 5, improv: 7, runway: 6, lipsync: 6, makeup: 6, singing: 6, verses: 5, strategy: 4, charisma: 6, uniqueness: 6, nerve: 7, talent: 5 } },
      { name: "Mariah Balenciaga", finalPlacement: "9th", link: "https://rupaulsdragrace.fandom.com/wiki/Mariah_Balenciaga",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/9/91/MariahBalenciagaUKvsTW3.jpg/revision/latest/scale-to-width-down/300?cb=20260109041055",
        stats: { acting: 6, comedy: 6, dance: 6, design: 6, improv: 6, runway: 7, lipsync: 7, makeup: 7, singing: 6, verses: 5, strategy: 6, charisma: 9, uniqueness: 7, nerve: 9, talent: 7 } },
      { name: "India Ferrah", finalPlacement: "10th", link: "https://rupaulsdragrace.fandom.com/wiki/India_Ferrah",
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Rupaul_Dragcon_2018-68_%2828203492128%29_%28cropped%29.jpg/330px-Rupaul_Dragcon_2018-68_%2828203492128%29_%28cropped%29.jpg",
        stats: { acting: 5, comedy: 5, dance: 6, design: 6, improv: 5, runway: 7, lipsync: 5, makeup: 6, singing: 5, verses: 4, strategy: 4, charisma: 6, uniqueness: 6, nerve: 5, talent: 5 } },
      { name: "Mimi Imfurst", finalPlacement: "11th", link: "https://rupaulsdragrace.fandom.com/wiki/Mimi_Imfurst",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/d/d7/MimiImfurstAS1TeamLook.jpg/revision/latest/scale-to-width-down/300?cb=20240716225730",
        stats: { acting: 6, comedy: 7, dance: 5, design: 5, improv: 6, runway: 6, lipsync: 5, makeup: 6, singing: 5, verses: 5, strategy: 5, charisma: 6, uniqueness: 7, nerve: 7, talent: 6 } },
      { name: "Phoenix", finalPlacement: "12th", link: "https://rupaulsdragrace.fandom.com/wiki/Phoenix",
        image: "https://static.wikia.nocookie.net/logosrupaulsdragrace/images/5/52/PhoenixAS10.jpg/revision/latest/scale-to-width-down/300?cb=20250425005241",
        stats: { acting: 5, comedy: 6, dance: 6, design: 6, improv: 5, runway: 6, lipsync: 6, makeup: 6, singing: 5, verses: 5, strategy: 5, charisma: 6, uniqueness: 6, nerve: 6, talent: 6 } },
      { name: "Venus D-Lite", finalPlacement: "13th", link: "https://rupaulsdragrace.fandom.com/wiki/Venus_D-Lite",
        image: IMG_BASE + "Venus.webp",
        stats: { acting: 4, comedy: 5, dance: 5, design: 5, improv: 4, runway: 5, lipsync: 4, makeup: 5, singing: 4, verses: 4, strategy: 3, charisma: 5, uniqueness: 6, nerve: 6, talent: 5 } },
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
