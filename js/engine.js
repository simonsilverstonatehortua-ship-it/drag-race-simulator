// Motor de simulación. Fase 2 + ampliaciones de Fase "formatos avanzados" + estadísticas
// por concursante.
//
// Implementado de verdad: estreno normal / doble / Porkchop, sin regreso / regreso al
// azar / LaLaParUza, temporada regular / por equipos / Lipsync Assassin,
// final Top2 / Top3 / Top4 / voto del jurado / Lip Sync For The Crown por rondas.
// Los demás formatos (entrada tardía, Rate a Queen, Lip Sync Smackdown, Lipsync For
// Your Legacy, All Winners...) siguen seleccionables en la UI pero de momento caen en
// el comportamiento "regular" (se anota en el log de la temporada con una nota
// "(no implementado aún)").
//
// Estadísticas: en cada episodio se puntúa a cada concursante dos veces, por separado: el
// reto (media de las estadísticas relevantes del reto, js/data/challenges.js, + bono al azar
// entre -1 y 5) y la pasarela (su Runway + su propio bono al azar entre -1 y 5). El resultado
// del episodio (ganadora, tops, bottoms...) sale de 70% reto + 30% pasarela (ver scoreParts);
// los retos de Design y Coreografía y looks de coreo no tienen pasarela aparte, ya que el
// propio reto construye el look. Para lip syncs se usa únicamente Lip Sync + bono al azar
// entre -3 y 5 (ver lipsyncScore). Una estadística que falte cuenta como 0: nunca se
// sustituye al azar, así que una concursante con stats planas se puntúa tal cual.
//
// Relaciones: simulateSeason acepta unas relaciones ya elegidas (presetRelationships) o las
// genera al azar según la Estrategia de cada una (generateRelationships).

const IMPLEMENTED_PREMIERE = ["PREMIERE_NORMAL", "PREMIERE_NORMAL_NOELIM", "PREMIERE_DOUBLE", "PREMIERE_DOUBLE_NOELIM", "PREMIERE_PORKCHOP", "PREMIERE_MEET_THE_QUEENS"];
const IMPLEMENTED_RETURN = ["RETURN_NONE", "RETURN_RANDOM", "RETURN_LALAPARUZA"];
const IMPLEMENTED_SEASON = ["SEASON_REGULAR", "SEASON_TEAMS", "SEASON_LIPSYNC_ASSASSIN", "SEASON_LIPSYNC_LEGACY"];
const IMPLEMENTED_FINALE = ["FINALE_TOP2", "FINALE_TOP3", "FINALE_TOP4", "FINALE_JURY_VOTE", "FINALE_LIPSYNC_CROWN"];

const FINALE_SIZE = {
  FINALE_TOP2: 2,
  FINALE_TOP3: 3,
  FINALE_TOP4: 4,
  FINALE_TOP5: 5,
  FINALE_TEAMS: 4,
  FINALE_LIPSYNC_FINALE: 4,
  FINALE_JURY_TOP5: 5,
  FINALE_TOP6_AS11: 6,
  FINALE_JURY_VOTE: 3,
  FINALE_LIPSYNC_CROWN: 4,
};

const ALL_STAT_KEYS = ["acting", "comedy", "dance", "design", "improv", "runway", "lipsync", "makeup", "singing", "verses"];

const RELATIONSHIP_LEVELS = ["le cae muy bien", "le cae bien", "normal", "le cae mal", "le cae muy mal"];

// Retos que puede forzar el selector de "reto de estreno" en la UI; si se deja en "Al
// azar" (sin elegir ninguno), el estreno sortea entre estos 4 en vez de entre todo el
// catálogo de retos.
const OPENING_CHALLENGE_IDS = ["TALENT_SHOW", "GIRL_GROUP", "DESIGN", "RUNWAY"];
window.OPENING_CHALLENGE_IDS = OPENING_CHALLENGE_IDS;

// Tipos de reunión, elegidos al azar cada temporada: antes de la final (su propio capítulo)
// o dentro de la propia final. Nunca después de la final. En ambos casos las eliminadas
// vuelven como invitadas (GUEST) en la final.
const REUNION_TYPES = ["BEFORE", "SAME"];

// Retos "de firma" que no se repiten dos veces en la misma temporada (a diferencia de
// retos genéricos como Actuación o Coreografía, que sí pueden repetirse con otra temática).
const NO_REPEAT_CHALLENGE_IDS = new Set(["TALENT_SHOW", "RUSICAL", "BALL", "MAKEOVER", "MUSIC_VIDEO", "SNATCH_GAME", "ROAST", "RUMIX"]);

const SNATCH_GAME_ID = "SNATCH_GAME";

// Historial de retos de una temporada, compartido en todas las llamadas. Como Set guarda los
// ids de los retos "de firma" ya salidos; además recuerda el último reto (para no repetirlo
// en dos episodios seguidos) y si este episodio toca forzar el Snatch Game.
class ChallengeHistory extends Set {
  constructor() {
    super();
    this.last = null;
    this.lastMini = null;
    this.forceSnatch = false;
  }
}

// "requireElim": excluye retos marcados "noElim" para formatos (equipos, Lipsync Assassin,
// Lipsync For Your Legacy) cuya lógica exige que alguien se vaya esa semana.
// "usedChallengeIds": historial (ver ChallengeHistory) compartido durante toda la temporada;
// se actualiza aquí mismo con el reto elegido.
// "forceId": fuerza un reto concreto (p.ej. el reto de estreno elegido) en vez de al azar.
// Nunca sale el mismo reto en dos episodios seguidos (salvo que no quede otra opción).
function randomChallenge(challenges, { requireElim = false, usedChallengeIds = new Set(), forceId = null } = {}) {
  // Los mini retos (category "mini") nunca son el reto principal del episodio.
  const mainChallenges = challenges.filter((c) => c.category !== "mini");
  let maxis = mainChallenges.length ? mainChallenges : challenges;
  if (requireElim) {
    const withElim = maxis.filter((c) => !c.noElim);
    if (withElim.length) maxis = withElim;
  }

  let picked;
  if (forceId) {
    picked = maxis.find((c) => c.id === forceId);
  }
  if (!picked && usedChallengeIds.forceSnatch) {
    picked = maxis.find((c) => c.id === SNATCH_GAME_ID && !usedChallengeIds.has(c.id) && c.id !== usedChallengeIds.last);
  }
  if (!picked) {
    const notRepeated = maxis.filter((c) => !(NO_REPEAT_CHALLENGE_IDS.has(c.id) && usedChallengeIds.has(c.id)));
    if (notRepeated.length) maxis = notRepeated;
    const notPrevious = maxis.filter((c) => c.id !== usedChallengeIds.last);
    if (notPrevious.length) maxis = notPrevious;
    picked = maxis[Math.floor(Math.random() * maxis.length)];
  }

  if (NO_REPEAT_CHALLENGE_IDS.has(picked.id)) usedChallengeIds.add(picked.id);
  usedChallengeIds.last = picked.id;
  return picked;
}

// Probabilidad de que un episodio tenga mini reto antes del reto principal.
const MINI_CHALLENGE_CHANCE = 0.75;

// Mini reto previo al reto principal: entre las concursantes del episodio, puntuadas con la
// media de las estadísticas del mini reto + el bono al azar de -1 a 5 (sin pasarela aparte).
// Gana la de mayor puntuación (desempate al azar). Por ahora solo es narrativa: no cambia los
// resultados del episodio. Devuelve null si esa semana no hay mini reto (o no hay ninguno en
// el catálogo). Nunca repite el mismo mini reto en dos episodios seguidos.
function runMiniChallenge(names, db, statsByName, history) {
  if (names.length < 2 || Math.random() >= MINI_CHALLENGE_CHANCE) return null;
  let minis = db.challenges.filter((c) => c.category === "mini");
  if (!minis.length) return null;
  const notPrevious = minis.filter((c) => c.id !== history.lastMini);
  if (notPrevious.length) minis = notPrevious;
  const mini = minis[Math.floor(Math.random() * minis.length)];
  history.lastMini = mini.id;

  const keys = mini.stats && mini.stats.length ? mini.stats : ALL_STAT_KEYS;
  const results = names.map((name) => {
    const stats = statsByName[name];
    const vals = keys.map((k) => (stats && typeof stats[k] === "number") ? stats[k] : 0);
    return { name, score: average(vals) + performanceBonus() };
  });
  results.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  return { challenge: mini.label, results, winner: results[0].name };
}

// El Snatch Game sale en todas las temporadas. Antes de cada episodio normal se decide si
// toca forzarlo (si todavía no ha salido): la probabilidad es 1 / (episodios normales que
// quedan menos uno), así que cae en un momento al azar de la temporada y, como tarde, sale
// cuando quedan dos episodios. Ese margen de uno cubre las eliminaciones dobles por empate,
// que pueden acortar la temporada antes de que le toque salir.
function scheduleSnatchGame(history, activeCount, finaleSize) {
  const remaining = Math.max(1, activeCount - finaleSize);
  history.forceSnatch = !history.has(SNATCH_GAME_ID) && Math.random() < 1 / Math.max(1, remaining - 1);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function average(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Bono al azar (entero entre -3 y 5) que se suma a la estadística de Lip Sync para dar la
// puntuación de un lip sync (ver lipsyncScore).
function randomStatBonus() {
  return -3 + Math.floor(Math.random() * 9);
}

// Bono al azar (entero entre -1 y 5) que se suma, por separado, a la puntuación del reto y
// a la de la pasarela de cada concursante en cada episodio.
function performanceBonus() {
  return -1 + Math.floor(Math.random() * 7);
}

// Cuánto pesa cada parte en el resultado final del episodio (ganadora, tops, bottoms...).
const CHALLENGE_WEIGHT = 0.7;
const RUNWAY_WEIGHT = 0.3;

// Retos que ya construyen la pasarela/el look como parte del propio reto: sumarles encima
// la pasarela puntuaría lo mismo dos veces, así que en ellos no hay pasarela aparte y el
// resultado sale 100% de la puntuación del reto.
const RUNWAY_WEIGHT_EXEMPT_CHALLENGES = new Set(["DESIGN", "CHOREO_LOOKS"]);

// Puntuación de una concursante en un episodio, en sus dos partes:
//  - challenge: media de las estadísticas relevantes del reto + bono al azar entre -1 y 5.
//  - runway: su estadística de Runway + su propio bono al azar entre -1 y 5 (tirada
//    independiente de la del reto).
//  - total: lo que decide el resultado del episodio = 70% reto + 30% pasarela.
// Una estadística que no tenga definida cuenta como 0, nunca se sustituye al azar: una
// concursante con stats planas (p.ej. todo en 7 porque todavía no hay datos reales) se
// puntúa tal cual. "challengeId" determina si el reto está en RUNWAY_WEIGHT_EXEMPT_CHALLENGES
// (Design, Coreografía y looks de coreo): ahí no hay pasarela (runway: null) y el total es
// 100% el reto.
function scoreParts(name, statKeys, statsByName, challengeId) {
  const stats = statsByName[name];
  const keys = statKeys && statKeys.length ? statKeys : ALL_STAT_KEYS;
  const vals = keys.map((k) => (stats && typeof stats[k] === "number") ? stats[k] : 0);
  const challenge = average(vals) + performanceBonus();

  if (challengeId && RUNWAY_WEIGHT_EXEMPT_CHALLENGES.has(challengeId)) {
    return { challenge, runway: null, total: challenge };
  }

  const runwayVal = (stats && typeof stats.runway === "number") ? stats.runway : 0;
  const runway = runwayVal + performanceBonus();
  return { challenge, runway, total: challenge * CHALLENGE_WEIGHT + runway * RUNWAY_WEIGHT };
}

// Resultado de scoreParts listo para guardarse junto al nombre en los resultados del
// episodio: "score" decide el estado; challengeScore/runwayScore los usa la interfaz para
// mostrar quién lo hizo bien y mal en cada parte por separado.
function scoredEntry(name, statKeys, statsByName, challengeId) {
  const p = scoreParts(name, statKeys, statsByName, challengeId);
  return { name, score: p.total, challengeScore: p.challenge, runwayScore: p.runway };
}

function challengeScore(name, statKeys, db, statsByName, challengeId) {
  return scoreParts(name, statKeys, statsByName, challengeId).total;
}

// Puntuación de una concursante en un lip sync: únicamente su estadística de Lip Sync (si
// no la tiene definida cuenta como 0, nunca al azar) más un bono al azar entre -3 y 5.
function lipsyncScore(name, db, statsByName) {
  const stats = statsByName[name];
  const lipsyncVal = (stats && typeof stats.lipsync === "number") ? stats.lipsync : 0;
  return lipsyncVal + randomStatBonus();
}

// Umbral para considerar "alto" un empate exacto en la puntuación de lip sync (escala
// aprox. -3 a 20: media de 5 estadísticas 0-15 + bono al azar -3 a 5). Empate en o por encima:
// doble shantay (nadie se va a casa). Empate por debajo: doble sashay (se van todas las
// empatadas). Ver assignPlacementsAndElimination.
const DOUBLE_LIPSYNC_HIGH_THRESHOLD = 11;

function lipsyncWinner(nameA, nameB, db, statsByName) {
  const scoreA = lipsyncScore(nameA, db, statsByName);
  const scoreB = lipsyncScore(nameB, db, statsByName);
  if (scoreA === scoreB) return Math.random() < 0.5 ? nameA : nameB;
  return scoreA > scoreB ? nameA : nameB;
}

// Lip sync grupal entre varias concursantes (fondo de la clasificación, equipo peor
// puntuado, etc.): quien saca peor puntuación de lip sync, pierde.
function loseLipsyncBattle(names, db, statsByName) {
  const scored = names.map((name) => ({ name, lip: lipsyncScore(name, db, statsByName) }));
  scored.sort((a, b) => a.lip - b.lip || Math.random() - 0.5);
  return scored[0].name;
}

// Junta nombres y puestos en una frase: "A y B quedaron en Xº lugar y Yº lugar,
// respectivamente." (o "A quedó en Xº lugar." si solo hay una entrada).
function describeTiedPlacements(entries) {
  const joinList = (arr) => arr.length <= 1
    ? arr.join("")
    : arr.length === 2
      ? arr.join(" y ")
      : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;
  if (entries.length === 1) return `${entries[0].name} quedó en ${entries[0].placement}.`;
  return `${joinList(entries.map((e) => e.name))} quedaron en ${joinList(entries.map((e) => e.placement))}, respectivamente.`;
}

// Genera las relaciones (direccionales) entre todas las concursantes antes de empezar la
// temporada: qué opina cada una de cada una de las demás, en 5 niveles. Cuanta más
// Estrategia tenga una concursante, más marcadas (menos "normal") son sus opiniones —
// juega sus alianzas y rivalidades de forma más calculada.
function generateRelationships(names, statsByName) {
  const relationships = {};
  names.forEach((a) => {
    relationships[a] = {};
    const strategyA = statsByName[a] && typeof statsByName[a].strategy === "number" ? statsByName[a].strategy : 7.5;
    const polarization = Math.max(0, Math.min(1, strategyA / 15));
    const baseWeights = [15, 25, 30, 20, 10];
    const weights = baseWeights.map((w, i) => (i === 2 ? w * (1 - polarization) : w * (1 + polarization * 0.6)));
    names.forEach((b) => {
      if (a === b) return;
      relationships[a][b] = weightedPick(RELATIONSHIP_LEVELS.map((lvl, i) => ({ value: lvl, weight: weights[i] })));
    });
  });
  return relationships;
}

// Puntuación numérica de cada nivel de relación, para calcular medias (misma escala que
// los símbolos ++/+/•/−/−− de la tabla de relaciones en la UI).
const RELATIONSHIP_SCORE = { "le cae muy bien": 2, "le cae bien": 1, "normal": 0, "le cae mal": -1, "le cae muy mal": -2 };

// Miss Simpatía: de entre las candidatas (solo eliminadas durante la temporada; nunca una
// finalista), se elige a quien mejor se lleva con el resto según la tabla de relaciones —
// media de ambos sentidos (cuánto le cae bien a cada compañera y cuánto le cae ella a cada
// compañera) con todas las demás concursantes de la temporada.
function pickMissCongeniality(candidates, relationships) {
  const allNames = Object.keys(relationships);
  const scoreOf = (name) => {
    const others = allNames.filter((n) => n !== name);
    if (!others.length) return 0;
    const total = others.reduce((sum, other) => {
      const aToB = RELATIONSHIP_SCORE[relationships[name]?.[other]] ?? 0;
      const bToA = RELATIONSHIP_SCORE[relationships[other]?.[name]] ?? 0;
      return sum + (aToB + bToA) / 2;
    }, 0);
    return total / others.length;
  };
  const ranked = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a) || Math.random() - 0.5);
  return ranked[0];
}

// Elige un valor al azar de una lista de {value, weight}.
function weightedPick(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

// Reparte HIGH/LOW/fondo+eliminación sobre quienes en "results" sigan "SAFE" (deja
// intactas las casillas ya asignadas antes, p.ej. WIN/TOP2 de Lipsync For Your Legacy).
// "pool" ya viene ordenado de mejor a peor puntaje: las 2 últimas siempre van a lip sync
// por su vida (la de menor puntaje de lip sync es eliminada, la otra sobrevive como BTM);
// de las que quedan en medio, las 2 mejores quedan HIGH y la peor queda LOW (3 HIGH y 2 LOW
// si hay 14 o más concursantes activas esta semana en total, contando también a quien ganó
// el reto: con casts grandes no tiene sentido dejar a tantas simplemente en SAFE). Si no hay
// sitio para esas posiciones de en medio sin pisar el fondo, se decide HIGH o LOW comparando
// el puntaje de cada una con la media del grupo restante.
//
// Empates de puntaje en el reto (mismo puntaje exacto): comparten posición en vez de
// desempatarse al azar.
//  - Empate entre quien sería HIGH y una que sería SAFE: esa SAFE también queda HIGH
//    (pueden quedar 3+ HIGH).
//  - Empate entre quien sería LOW y una que sería SAFE: esa SAFE también queda LOW.
//  - Empate entre quien sería LOW y alguien del fondo: esa LOW se suma también al lip
//    sync por su vida (lip sync a 3 o más en vez de a 2).
// (El empate por la victoria del reto se resuelve en runEpisode/runLipsyncLegacyEpisode:
// todas las que empatan en la puntuación más alta ganan.)
//
// Empates de puntaje en el lip sync por su vida (entre las del fondo, sean 2 o más por los
// empates de arriba): si TODAS empatan exactamente, se decide en bloque en vez de al azar:
// puntaje alto (>= DOUBLE_LIPSYNC_HIGH_THRESHOLD) = doble shantay, nadie se va a casa (BTM_MULTI
// para todas); puntaje bajo = doble sashay, se van todas (ELIM_MULTI). Si solo empatan varias
// por el último puesto (pero no todas), se eliminan esas entre sí (ELIM_MULTI) y quien
// sobreviva queda BTM — lo más común, con diferencia, es que solo empate/se elimine 1 sola
// (ELIM normal). BTM_MULTI queda reservado solo para el doble shantay (nadie eliminada);
// si hay eliminación de por medio, quien sobrevive siempre es BTM, aunque sobrevivan varias.
//
// Si solo queda 1 persona en el grupo (p.ej. Lipsync For Your Legacy con apenas 3 activas:
// las 2 mejores ya se fueron al legacy lip sync), esa única persona no tiene con quién
// hacer lip sync y queda eliminada directamente, para no estancar la temporada.
// "maxElim" evita eliminar cuando ya se llegó al tamaño de la final (si un doble sashay o
// una eliminación múltiple por empate se pasara de "maxElim", solo se elimina a las peores
// puntuadas en lip sync hasta llegar al límite).
//
// "immuneNames": con el twist de Inmunidad activo, quienes ganaron la semana pasada no
// pueden caer en el fondo esta semana pase lo que pase con su puntaje: se las salta al
// elegir a las peores, y la siguiente peor no inmune ocupa su sitio en el fondo. Quedan
// dentro del middlePool (HIGH/SAFE/LOW según su puntaje relativo) en vez de arriesgar el
// lip sync por su vida.
// Devuelve { eliminatedNames, lipsyncNote }.
function assignPlacementsAndElimination(results, db, statsByName, { noElim = false, maxElim = Infinity, immuneNames = new Set() } = {}) {
  const pool = results.filter((r) => r.status === "SAFE");
  const eligibleForBottom = immuneNames.size ? pool.filter((r) => !immuneNames.has(r.name)) : pool;
  const canEliminate = !noElim && maxElim > 0 && eligibleForBottom.length >= 1;

  // Fondo: nominalmente las 2 últimas de las elegibles (no inmunes), ampliable si la que
  // debería ser LOW empata en puntaje con la peor de esas 2 (y así sucesivamente si el
  // empate sigue).
  let bottomSize = Math.min(2, eligibleForBottom.length);
  while (
    bottomSize < eligibleForBottom.length &&
    eligibleForBottom[eligibleForBottom.length - bottomSize - 1].score === eligibleForBottom[eligibleForBottom.length - bottomSize].score
  ) {
    bottomSize++;
  }
  const bottomPool = eligibleForBottom.slice(eligibleForBottom.length - bottomSize);
  const bottomNameSet = new Set(bottomPool.map((r) => r.name));
  const middlePool = pool.filter((r) => !bottomNameSet.has(r.name));

  // Con casts grandes (14+ concursantes activas esta semana) la estructura base reparte más
  // HIGH/LOW en vez de dejar a tantas en SAFE sin distinguir: 1 WIN, 3 HIGH, 2 LOW, 1 BTM,
  // 1 ELIM, en vez de la estructura normal de 1 WIN, 2 HIGH, 1 LOW, 1 BTM, 1 ELIM.
  const bigCast = results.length >= 14;
  const baseHighCount = bigCast ? 3 : 2;
  const baseLowCount = bigCast ? 2 : 1;

  if (middlePool.length >= baseHighCount + baseLowCount) {
    const midLen = middlePool.length;
    let highCount = baseHighCount;
    while (highCount < midLen - 1 && middlePool[highCount - 1].score === middlePool[highCount].score) {
      highCount++;
    }
    let lowCount = baseLowCount;
    while (highCount + lowCount < midLen && middlePool[midLen - lowCount - 1].score === middlePool[midLen - lowCount].score) {
      lowCount++;
    }
    for (let i = 0; i < highCount; i++) middlePool[i].status = "HIGH";
    for (let i = midLen - lowCount; i < midLen; i++) middlePool[i].status = "LOW";
  } else if (middlePool.length > 0) {
    const avg = average(pool.map((r) => r.score));
    middlePool.forEach((r) => { r.status = r.score >= avg ? "HIGH" : "LOW"; });
  }

  let eliminatedNames = [];
  let lipsyncNote = "";

  if (canEliminate && bottomPool.length >= 2) {
    const lipScored = bottomPool.map((r) => ({ name: r.name, lip: lipsyncScore(r.name, db, statsByName) }));
    const minLip = Math.min(...lipScored.map((r) => r.lip));
    const tiedAtMin = lipScored.filter((r) => r.lip === minLip);
    const allTied = tiedAtMin.length === lipScored.length;
    const doubleShantay = allTied && minLip >= DOUBLE_LIPSYNC_HIGH_THRESHOLD;

    let loserNames = doubleShantay ? [] : tiedAtMin.map((r) => r.name);
    if (loserNames.length > maxElim) {
      loserNames = [...tiedAtMin].sort((a, b) => a.lip - b.lip).slice(0, maxElim).map((r) => r.name);
    }

    eliminatedNames = loserNames;
    const elimStatus = loserNames.length > 1 ? "ELIM_MULTI" : "ELIM";
    const survivors = bottomPool.filter((r) => !loserNames.includes(r.name));
    bottomPool.forEach((r) => {
      r.status = loserNames.includes(r.name) ? elimStatus : (doubleShantay ? "BTM_MULTI" : "BTM");
    });

    const groupDesc = bottomPool.map((r) => r.name).join(", ");
    if (doubleShantay) {
      lipsyncNote = `Lip sync entre ${groupDesc}: empatan con un número tan bueno que RuPaul decide que nadie se va a casa esta semana (doble shantay).`;
    } else if (loserNames.length === bottomPool.length) {
      lipsyncNote = `Lip sync entre ${groupDesc}: empatan tan flojas que RuPaul manda a todas a casa (doble sashay).`;
    } else if (loserNames.length > 1) {
      lipsyncNote = `Lip sync entre ${groupDesc}: empatan entre sí como las peores y se van ${loserNames.join(" y ")}. Se salva${survivors.length > 1 ? "n" : ""} ${survivors.map((r) => r.name).join(", ")}.`;
    } else {
      lipsyncNote = `Lip sync entre ${groupDesc}: se salva${survivors.length > 1 ? "n" : ""} ${survivors.map((r) => r.name).join(", ")}.`;
    }
  } else if (canEliminate && bottomPool.length === 1) {
    const only = bottomPool[0];
    only.status = "ELIM";
    eliminatedNames = [only.name];
    lipsyncNote = `${only.name} es la única fuera del podio esta semana y queda eliminada sin lip sync (no hay con quién emparejarla).`;
  } else if (!noElim && pool.length > 0 && eligibleForBottom.length === 0) {
    lipsyncNote = "Todas las que podrían estar en el fondo esta semana tienen inmunidad: nadie es eliminada.";
  } else if (!noElim) {
    lipsyncNote = "Grupo demasiado reducido para lip sync esta semana: nadie es eliminada.";
  }

  return { eliminatedNames, lipsyncNote };
}

// Simula un único reto entre un grupo de concursantes activas. Se puntúa a cada una
// (70% reto + 30% pasarela, cada parte con su propio bono al azar de -1 a 5; ver
// scoreParts) y se ordena de mejor a peor: la primera de la lista gana
// el reto (o todas las que empaten con ella en la puntuación más alta); las 2 últimas van a
// lip sync por su vida (puntuadas únicamente por su Lip Sync + bono al azar); de las que
// quedan en medio, las 2 mejores quedan HIGH y la peor LOW (3 HIGH y 2 LOW si hay
// 14+ concursantes activas esta semana; ver assignPlacementsAndElimination para el reparto y
// los empates de puntaje).
// "maxElim" limita cuántas puede eliminar este episodio (para no bajar del tamaño de la
// final); por defecto sin límite. "forceChallengeId" fuerza un reto concreto (p.ej. el reto
// de estreno elegido) en vez de sortearlo; "usedChallengeIds" evita repetir retos "de firma"
// durante la temporada (ver randomChallenge). "immuneNames" son quienes traen inmunidad de
// haber ganado la semana pasada (twist de Inmunidad): no pueden caer en el fondo esta
// semana (ver assignPlacementsAndElimination) y quedan marcadas "immune:true" para que la
// UI dibuje el borde rosa característico, ganen o no de nuevo esta semana.
// Devuelve { results: [{name, score, status}], eliminatedNames, lipsyncNote }
function runEpisode(activeNames, db, { noElim = false, maxElim = Infinity, forceChallengeId = null, usedChallengeIds = new Set(), immuneNames = new Set() } = {}, statsByName = {}) {
  const challenge = randomChallenge(db.challenges, { forceId: forceChallengeId, usedChallengeIds });

  const scored = activeNames.map((name) => scoredEntry(name, challenge.stats, statsByName, challenge.id));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  // Si dos o más empatan exactamente en la puntuación más alta, ganan todas el reto (en
  // vez de desempatarlas al azar): WIN_TIE si son 2+, WIN si es una sola. (WIN_RUNWAY queda
  // de momento sin usar: se retomará más adelante.)
  const topScore = scored[0].score;
  const topScorerCount = scored.filter((s) => s.score === topScore).length;
  const winStatus = topScorerCount > 1 ? "WIN_TIE" : "WIN";
  const results = scored.map((s) => ({ ...s, status: s.score === topScore ? winStatus : "SAFE" }));
  if (immuneNames.size) results.forEach((r) => { if (immuneNames.has(r.name)) r.immune = true; });

  const { eliminatedNames, lipsyncNote } = assignPlacementsAndElimination(results, db, statsByName, { noElim, maxElim, immuneNames });
  return { challenge: challenge.label, results, eliminatedNames, lipsyncNote };
}

// Estadísticas relevantes para juzgar la presentación inicial de Meet the Queens.
const MEET_THE_QUEENS_STATS = ["charisma", "nerve", "runway", "design", "makeup"];

// --- Meet the Queens: no es un reto normal, es un formato especial de ESTRENO (todas las
// concursantes tienen que estar presentes, así que solo tiene sentido en el capítulo 1).
// Se puntúa a cada una y se ordena de mejor a peor: las 2 mejores hacen lip sync por el
// primer puesto (gana WIN, pierde TOP2; si empatan exactas, ambas WIN_TIE); de las que
// quedan, la mejor mitad queda HIGH y el resto SAFE. Nadie es eliminada esta semana. ---
function runMeetTheQueensEpisode(activeNames, db, statsByName) {
  const scored = activeNames.map((name) => scoredEntry(name, MEET_THE_QUEENS_STATS, statsByName));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));

  let lipsyncNote = "";
  if (results.length >= 2) {
    const [first, second] = results;
    const winner = lipsyncWinner(first.name, second.name, db, statsByName);
    const isTie = first.score === second.score;
    if (isTie) {
      first.status = "WIN_TIE";
      second.status = "WIN_TIE";
      lipsyncNote = `${first.name} y ${second.name} empatan como mejores de la presentación y hacen lip sync: gana ${winner}, pero ambas se quedan con la victoria.`;
    } else {
      first.status = first.name === winner ? "WIN" : "TOP2";
      second.status = second.name === winner ? "WIN" : "TOP2";
      lipsyncNote = `${first.name} y ${second.name} hacen lip sync por el primer puesto: gana ${winner}.`;
    }
  } else if (results.length === 1) {
    results[0].status = "WIN";
  }

  const rest = results.slice(2);
  const highCount = Math.ceil(rest.length / 2);
  for (let i = 0; i < highCount; i++) rest[i].status = "HIGH";

  return {
    challenge: "Meet the Queens",
    results,
    eliminatedNames: [],
    lipsyncNote: `${lipsyncNote} La mejor mitad del resto queda destacada (HIGH). Al ser la presentación inicial, nadie es eliminada esta semana.`.trim(),
  };
}

// --- Lipsync For Your Legacy: las dos mejores puntuadas de la semana hacen lip sync por
// su legado. Si empataron exactamente en puntaje, ambas quedan WIN_TIE (10 puntos cada
// una, gane quien gane el lip sync). Si no hubo empate exacto, la ganadora del lip sync
// se queda con el WIN y la otra queda TOP2 (también 10 puntos, sin poder de eliminación).
// El resto del grupo sigue el reparto normal de fondo+eliminación (las 2 últimas del
// ranking van a lip sync por su vida). ---
function runLipsyncLegacyEpisode(activeNames, db, statsByName, maxElim = Infinity, usedChallengeIds = new Set(), immuneNames = new Set()) {
  const challenge = randomChallenge(db.challenges, { requireElim: true, usedChallengeIds });
  const scored = activeNames.map((name) => scoredEntry(name, challenge.stats, statsByName, challenge.id));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));
  if (immuneNames.size) results.forEach((r) => { if (immuneNames.has(r.name)) r.immune = true; });
  const winStatus = "WIN"; // WIN_RUNWAY queda de momento sin usar: se retomará más adelante.

  let legacyNote = "";
  if (results.length >= 2) {
    const [first, second] = results;
    const winner = lipsyncWinner(first.name, second.name, db, statsByName);
    const loser = winner === first.name ? second.name : first.name;
    const isTie = first.score === second.score;
    if (isTie) {
      first.status = "WIN_TIE";
      second.status = "WIN_TIE";
      legacyNote = `${first.name} y ${second.name} empatan como mejores de la semana y hacen Lip Sync For Your Legacy: gana ${winner}, quien decide a quién eliminar del fondo. ${loser} también se queda con los 10 puntos de la victoria.`;
    } else {
      first.status = first.name === winner ? winStatus : "TOP2";
      second.status = second.name === winner ? winStatus : "TOP2";
      legacyNote = `${first.name} y ${second.name} hacen Lip Sync For Your Legacy: gana ${winner}. ${loser} se queda como TOP2 (10 puntos, sin poder de eliminación).`;
    }
  } else if (results.length === 1) {
    results[0].status = winStatus;
  }

  const { eliminatedNames, lipsyncNote } = assignPlacementsAndElimination(results, db, statsByName, { maxElim, immuneNames });
  return { challenge: challenge.label, results, eliminatedNames, lipsyncNote: `${legacyNote} ${lipsyncNote}`.trim() };
}

// --- Estreno Porkchop: llegan por parejas, un mini reto decide quién compite esa
// semana en el reto principal (el resto queda a salvo sin competir). ---
function runPorkchopPremiere(activeNames, db, statsByName, maxElim = Infinity, forceChallengeId = null, usedChallengeIds = new Set(), immuneNames = new Set()) {
  const shuffled = shuffle(activeNames);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) pairs.push([shuffled[i], shuffled[i + 1]]);
    else pairs.push([shuffled[i]]);
  }

  const safeFromMini = [];
  const competing = [];
  const miniNotes = [];
  pairs.forEach((pair) => {
    if (pair.length === 1) {
      safeFromMini.push(pair[0]);
      miniNotes.push(`${pair[0]} pasa directa (número impar de concursantes).`);
      return;
    }
    // El mini reto no tiene una categoría fija: se puntúa con el nivel general de la concursante.
    const scored = pair.map((name) => ({ name, score: challengeScore(name, null, db, statsByName) }));
    scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
    safeFromMini.push(scored[0].name);
    competing.push(scored[1].name);
    miniNotes.push(`${scored[0].name} gana su mini reto Porkchop frente a ${scored[1].name}.`);
  });

  const safeResult = (name) => ({ name, score: null, status: "SAFE", ...(immuneNames.has(name) ? { immune: true } : {}) });

  if (competing.length < 2) {
    safeFromMini.push(...competing);
    return {
      challenge: "Mini reto Porkchop",
      results: safeFromMini.map(safeResult),
      eliminatedNames: [],
      lipsyncNote: `${miniNotes.join(" ")} Reparto demasiado reducido para un reto principal aparte: nadie es eliminada esta semana.`,
    };
  }

  const maxi = runEpisode(competing, db, { maxElim, forceChallengeId, usedChallengeIds, immuneNames }, statsByName);
  const results = [
    ...safeFromMini.map(safeResult),
    ...maxi.results,
  ];
  return {
    challenge: `Mini reto Porkchop + ${maxi.challenge}`,
    results,
    eliminatedNames: maxi.eliminatedNames,
    lipsyncNote: `${miniNotes.join(" ")} ${competing.length} concursantes compiten por sus vidas en el reto principal ("${maxi.challenge}"). ${maxi.lipsyncNote}`,
  };
}

// --- LaLaParUza: lip sync grupal en bracket entre eliminadas; la ganadora regresa. ---
function runLaLaParUza(pool, db, statsByName) {
  let round = shuffle(pool);
  const roundLogs = [];
  while (round.length > 1) {
    const next = [];
    const roundLog = [];
    for (let i = 0; i < round.length; i += 2) {
      if (i + 1 >= round.length) {
        next.push(round[i]);
        roundLog.push(`${round[i]} pasa por bye.`);
        continue;
      }
      const a = round[i], b = round[i + 1];
      const winner = lipsyncWinner(a, b, db, statsByName);
      next.push(winner);
      roundLog.push(`${a} vs ${b}: gana ${winner}.`);
    }
    roundLogs.push(roundLog.join(" "));
    round = next;
  }
  return { returning: round[0], roundLogs };
}

// --- Temporada por equipos: se divide el reparto en equipos, el equipo peor puntuado
// hace lip sync interno para decidir quién se va. ---
function runTeamsEpisode(activeNames, db, statsByName, usedChallengeIds = new Set()) {
  const challenge = randomChallenge(db.challenges, { requireElim: true, usedChallengeIds });
  const winStatus = "WIN"; // WIN_RUNWAY queda de momento sin usar: se retomará más adelante.
  const shuffled = shuffle(activeNames);
  const teams = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) teams.push([shuffled[i], shuffled[i + 1]]);
    else teams[teams.length - 1].push(shuffled[i]);
  }

  const teamScores = teams.map((team) => {
    const members = team.map((name) => scoredEntry(name, challenge.stats, statsByName, challenge.id));
    return { members, teamScore: average(members.map((m) => m.score)) };
  });
  teamScores.sort((a, b) => b.teamScore - a.teamScore || Math.random() - 0.5);

  const results = [];
  teamScores.forEach((t, i) => {
    const sortedMembers = [...t.members].sort((a, b) => b.score - a.score);
    if (i === 0) {
      sortedMembers.forEach((m, j) => results.push({ ...m, status: j === 0 ? winStatus : "HIGH" }));
    } else if (i === teamScores.length - 1 && teamScores.length > 1) {
      sortedMembers.forEach((m) => results.push({ ...m, status: "BTM" }));
    } else if (i === 1 && teamScores.length > 2) {
      sortedMembers.forEach((m) => results.push({ ...m, status: "HIGH_GROUP" }));
    } else {
      sortedMembers.forEach((m) => results.push({ ...m, status: "SAFE" }));
    }
  });

  const teamsDesc = teams.map((t, i) => `Equipo ${i + 1} (${t.join(" y ")})`).join("; ");
  let eliminatedName = null;
  let lipsyncNote = `Reto por equipos: ${teamsDesc}.`;

  const worstTeam = teamScores[teamScores.length - 1];
  if (teamScores.length > 1 && worstTeam.members.length >= 2) {
    const memberNames = worstTeam.members.map((m) => m.name);
    const loserName = loseLipsyncBattle(memberNames, db, statsByName);
    results.find((r) => r.name === loserName).status = "ELIM";
    // BTM_MULTI queda reservado para el doble shantay (nadie eliminada): aquí sí hubo
    // eliminación, así que quien sobrevive es BTM aunque sobrevivan varias a la vez.
    const survivorNames = memberNames.filter((n) => n !== loserName);
    survivorNames.forEach((n) => { results.find((r) => r.name === n).status = "BTM"; });
    eliminatedName = loserName;
    lipsyncNote += ` El equipo peor puntuado hace lip sync entre sí: se salva ${survivorNames.join(", ")}.`;
  } else {
    lipsyncNote += " Reparto demasiado reducido para formar más de un equipo: nadie es eliminada esta semana.";
  }

  return { challenge: challenge.label, results, eliminatedName, lipsyncNote };
}

// --- Lipsync Assassin: la ganadora del reto reta a quien quiera a un lip sync directo,
// sin pasar por el fondo de la clasificación. ---
function runLipsyncAssassinEpisode(activeNames, db, statsByName, relationships = {}, usedChallengeIds = new Set()) {
  const challenge = randomChallenge(db.challenges, { requireElim: true, usedChallengeIds });
  const scored = activeNames.map((name) => scoredEntry(name, challenge.stats, statsByName, challenge.id));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const n = scored.length;
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));
  results[0].status = "WIN"; // WIN_RUNWAY queda de momento sin usar: se retomará más adelante.
  if (n >= 6) results[1].status = "HIGH";
  if (n >= 6) results[n - 1].status = "LOW";

  const assassin = results[0].name;
  const candidates = results.slice(1);

  // Cuanta más Estrategia tenga la asesina, más probable que juegue "sucio": en vez de
  // retar a quien puntuó más bajo (jugada segura), apunta a su mayor amenaza real en la
  // competencia (alianzas rotas, traiciones al estilo Mistress/Jorgeous en All Stars 10).
  const assassinStrategy = statsByName[assassin] && typeof statsByName[assassin].strategy === "number" ? statsByName[assassin].strategy : 7.5;
  const playsStrategically = Math.random() * 15 < assassinStrategy;

  let target, targetReason;
  if (playsStrategically) {
    const rel = relationships[assassin] || {};
    const relBonus = (name) => (rel[name] === "le cae muy mal" ? 6 : rel[name] === "le cae mal" ? 3 : rel[name] === "le cae muy bien" ? -3 : 0);
    const threatOf = (c) => {
      const stats = statsByName[c.name];
      const base = stats ? average(ALL_STAT_KEYS.map((k) => stats[k] ?? 7.5)) : c.score;
      return base + relBonus(c.name);
    };
    const sorted = [...candidates].sort((a, b) => threatOf(b) - threatOf(a) || Math.random() - 0.5);
    target = sorted[0].name;
    targetReason = rel[target] === "le cae mal" || rel[target] === "le cae muy mal"
      ? "en una jugada estratégica y personal, apunta a alguien que le cae mal y que además ve como una amenaza"
      : "en una jugada estratégica, apunta a su mayor amenaza en la competencia";
  } else {
    const weights = candidates.map((c) => 11 - c.score);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let targetIdx = candidates.length - 1;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { targetIdx = i; break; }
    }
    target = candidates[targetIdx].name;
    targetReason = "reta a quien puntuó más bajo";
  }

  const winner = lipsyncWinner(assassin, target, db, statsByName);
  let eliminatedName = null;
  let lipsyncNote = `${assassin} gana el reto y se convierte en la Lipsync Assassin: ${targetReason}, retando a ${target} a un lip sync sin red.`;
  if (winner === assassin) {
    eliminatedName = target;
    results.find((r) => r.name === target).status = "ELIM";
    lipsyncNote += ` ${assassin} gana el lip sync: ${target} es eliminada.`;
  } else {
    lipsyncNote += ` ${target} gana el lip sync y sobrevive: nadie es eliminada esta semana.`;
  }

  return { challenge: challenge.label, results, eliminatedName, lipsyncNote };
}

// --- Final: voto del jurado (eliminadas de la temporada votan a la ganadora). ---
function runJuryFinale(finalists, eliminatedPool, db, statsByName) {
  const finaleScored = finalists.map((name) => ({ name, score: challengeScore(name, null, db, statsByName) }));
  finaleScored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  // El jurado premia tanto la mejor actuación de la final como el Carisma (si hay stats).
  const favorability = {};
  finalists.forEach((name) => {
    const scoreRank = finaleScored.findIndex((f) => f.name === name);
    const scoreWeight = (finalists.length - scoreRank) * 2;
    const charisma = statsByName[name] && typeof statsByName[name].charisma === "number" ? statsByName[name].charisma : 7.5;
    favorability[name] = scoreWeight + charisma;
  });

  const votes = {};
  finalists.forEach((n) => (votes[n] = 0));
  eliminatedPool.forEach(() => {
    const votedFor = weightedPick(finalists.map((n) => ({ value: n, weight: favorability[n] })));
    votes[votedFor]++;
  });

  const scoreOf = (name) => finaleScored.find((f) => f.name === name).score;
  const ranked = [...finalists].sort((a, b) => votes[b] - votes[a] || scoreOf(b) - scoreOf(a) || Math.random() - 0.5);
  const winnerName = ranked[0];
  const runnerUpName = ranked[1];
  const rest = ranked.slice(2);

  const voteSummary = finalists.map((n) => `${n}: ${votes[n]} voto(s)`).join(", ");
  const juryDesc = eliminatedPool.length ? `El jurado de eliminadas (${eliminatedPool.join(", ")}) vota.` : "No hay eliminadas disponibles para formar jurado: se decide por la puntuación de la final.";

  return {
    finaleScored,
    winnerName,
    runnerUpName,
    rest,
    label: "Final — Voto del jurado",
    lipsyncNote: `${juryDesc} ${voteSummary}. ${winnerName} gana por decisión del jurado.`,
  };
}

// --- Final: Lip Sync For The Crown por rondas (bracket eliminatorio entre finalistas). ---
function runLipsyncCrownFinale(finalists, db, statsByName) {
  const finaleScored = finalists.map((name) => ({ name, score: challengeScore(name, null, db, statsByName) }));
  finaleScored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  let contenders = finaleScored.map((f) => f.name);
  const bracketLog = [];
  const roundsLosers = [];

  while (contenders.length > 1) {
    const pairs = [];
    let lo = 0, hi = contenders.length - 1;
    while (lo < hi) { pairs.push([contenders[lo], contenders[hi]]); lo++; hi--; }
    if (lo === hi) pairs.push([contenders[lo]]);

    const winners = [];
    const roundLosers = [];
    pairs.forEach(([a, b]) => {
      if (!b) {
        winners.push(a);
        bracketLog.push(`${a} pasa directamente a la siguiente ronda.`);
        return;
      }
      const winner = lipsyncWinner(a, b, db, statsByName);
      const loser = winner === a ? b : a;
      winners.push(winner);
      roundLosers.push(loser);
      bracketLog.push(`${a} vs ${b}: gana ${winner}.`);
    });
    roundsLosers.push(roundLosers);
    contenders = winners;
  }

  const winnerName = contenders[0];
  const finalRoundLosers = roundsLosers[roundsLosers.length - 1] || [];
  const runnerUpName = finalRoundLosers[0];
  const scoreOf = (name) => finaleScored.find((f) => f.name === name).score;

  const rest = [];
  roundsLosers.slice(0, -1).reverse().forEach((losers) => {
    const sorted = [...losers].sort((a, b) => scoreOf(b) - scoreOf(a));
    rest.push(...sorted);
  });

  return {
    finaleScored,
    winnerName,
    runnerUpName,
    rest,
    label: "Lip Sync For The Crown",
    lipsyncNote: `${bracketLog.join(" ")} ${winnerName} gana la corona.`,
  };
}

// Relaciones ya elegidas por el usuario (presetRelationships: { quien: { sobreQuien: nivel } }):
// se respetan las que sean un nivel válido y las que falten se rellenan con "normal". Sin
// preset, se generan al azar (ver generateRelationships).
function normalizeRelationships(names, preset) {
  const relationships = {};
  names.forEach((a) => {
    relationships[a] = {};
    names.forEach((b) => {
      if (a === b) return;
      const level = preset && preset[a] && preset[a][b];
      relationships[a][b] = RELATIONSHIP_LEVELS.includes(level) ? level : "normal";
    });
  });
  return relationships;
}

function simulateSeason(contestantNames, formatChoice, db, statsByName = {}, presetRelationships = null) {
  const log = [];
  let active = [...contestantNames];
  let eliminated = [];
  const notes = [];
  const relationships = presetRelationships
    ? normalizeRelationships(contestantNames, presetRelationships)
    : generateRelationships(contestantNames, statsByName);
  // Historial de retos de la temporada (retos "de firma" ya salidos, último reto, Snatch
  // Game pendiente; ver ChallengeHistory): se comparte esta misma referencia en todas las
  // llamadas para que no se repitan retos de firma ni el mismo reto dos episodios seguidos.
  const usedChallengeIds = new ChallengeHistory();
  // Mini reto de un episodio, entre las concursantes que participan en él (ver runMiniChallenge).
  const miniFor = (ep) => runMiniChallenge(ep.results.map((r) => r.name), db, statsByName, usedChallengeIds);

  // Twist de Inmunidad: quien gana el reto de la semana no puede caer en el fondo la
  // semana siguiente (ver assignPlacementsAndElimination). Se recalcula tras cada episodio
  // a partir de sus ganadoras (WIN/WIN_TIE); empieza vacío porque nadie ha ganado nada aún.
  const immunityEnabled = Array.isArray(formatChoice.twists) && formatChoice.twists.includes("IMMUNITY");
  let immuneNames = new Set();
  function winnersOf(ep) {
    return (ep.results || []).filter((r) => r.status === "WIN" || r.status === "WIN_TIE").map((r) => r.name);
  }

  // Procesa las eliminadas de un episodio, admitiendo tanto una sola (eliminatedName,
  // usado por Teams/Lipsync Assassin) como varias a la vez (eliminatedNames, para dobles
  // eliminaciones del reto regular).
  function processElimination(ep) {
    const names = ep.eliminatedNames || (ep.eliminatedName ? [ep.eliminatedName] : []);
    names.forEach((name) => {
      active = active.filter((n) => n !== name);
      eliminated.push(name);
    });
  }

  function noteIfUnimplemented(list, id, group) {
    if (!list.includes(id)) notes.push(`Formato de ${group} "${id}" aún no implementado: se ha simulado como el formato estándar.`);
  }
  noteIfUnimplemented(IMPLEMENTED_PREMIERE, formatChoice.premiere, "estreno");
  noteIfUnimplemented(IMPLEMENTED_RETURN, formatChoice.return, "regreso");
  noteIfUnimplemented(IMPLEMENTED_SEASON, formatChoice.season, "temporada");
  noteIfUnimplemented(IMPLEMENTED_FINALE, formatChoice.finale, "final");

  const finaleSize = FINALE_SIZE[formatChoice.finale] || 2;

  // --- Estreno ---
  const noElimPremiere = formatChoice.premiere === "PREMIERE_NORMAL_NOELIM" || formatChoice.premiere === "PREMIERE_DOUBLE_NOELIM";
  const doublePremiere = formatChoice.premiere === "PREMIERE_DOUBLE" || formatChoice.premiere === "PREMIERE_DOUBLE_NOELIM";
  const porkchopPremiere = formatChoice.premiere === "PREMIERE_PORKCHOP";
  const meetTheQueensPremiere = formatChoice.premiere === "PREMIERE_MEET_THE_QUEENS";

  // Si se deja en "Al azar" (sin elegir un reto de estreno concreto), el sorteo es solo
  // entre los 4 retos de estreno, no entre todo el catálogo.
  // Excepción: en una temporada tan corta que el estreno es el único episodio normal (el
  // estreno doble elimina hasta 2, uno por grupo), el estreno es el Snatch Game para que
  // salga en todas las temporadas.
  const premiereIsOnlyRegularEpisode = active.length - finaleSize <= (doublePremiere ? 2 : 1);
  const openingChallengeId = formatChoice.openingChallenge
    || (premiereIsOnlyRegularEpisode && !meetTheQueensPremiere ? SNATCH_GAME_ID : null)
    || OPENING_CHALLENGE_IDS[Math.floor(Math.random() * OPENING_CHALLENGE_IDS.length)];

  if (meetTheQueensPremiere) {
    const ep = runMeetTheQueensEpisode(active, db, statsByName);
    log.push({ label: "Episodio 1", ...ep });
    processElimination(ep);
    if (immunityEnabled) immuneNames = new Set(winnersOf(ep));
  } else if (porkchopPremiere) {
    const maxElim = Math.max(0, active.length - finaleSize);
    const ep = runPorkchopPremiere(active, db, statsByName, maxElim, openingChallengeId, usedChallengeIds, immuneNames);
    log.push({ label: "Episodio 1 (Porkchop)", ...ep, mini: miniFor(ep) });
    processElimination(ep);
    if (immunityEnabled) immuneNames = new Set(winnersOf(ep));
  } else if (doublePremiere) {
    const shuffled = shuffle(active);
    const groupA = shuffled.slice(0, Math.ceil(shuffled.length / 2));
    const groupB = shuffled.slice(Math.ceil(shuffled.length / 2));
    const maxElimA = Math.max(0, active.length - finaleSize);
    const epA = runEpisode(groupA, db, { noElim: noElimPremiere, maxElim: maxElimA, forceChallengeId: openingChallengeId, usedChallengeIds, immuneNames }, statsByName);
    log.push({ label: "Episodio 1a (grupo A)", ...epA, mini: miniFor(epA) });
    processElimination(epA);
    const maxElimB = Math.max(0, active.length - finaleSize);
    const epB = runEpisode(groupB, db, { noElim: noElimPremiere, maxElim: maxElimB, forceChallengeId: openingChallengeId, usedChallengeIds, immuneNames }, statsByName);
    log.push({ label: "Episodio 1b (grupo B)", ...epB, mini: miniFor(epB) });
    processElimination(epB);
    if (immunityEnabled) immuneNames = new Set([...winnersOf(epA), ...winnersOf(epB)]);
  } else {
    const maxElim = Math.max(0, active.length - finaleSize);
    const ep = runEpisode(active, db, { noElim: noElimPremiere, maxElim, forceChallengeId: openingChallengeId, usedChallengeIds, immuneNames }, statsByName);
    log.push({ label: "Episodio 1", ...ep, mini: miniFor(ep) });
    processElimination(ep);
    if (immunityEnabled) immuneNames = new Set(winnersOf(ep));
  }

  // --- Temporada regular hasta llegar al tamaño de la final ---
  let episodeNum = 2;
  let teamsEpisodeDone = false;
  while (active.length > finaleSize) {
    let ep;
    const maxElim = Math.max(0, active.length - finaleSize);
    scheduleSnatchGame(usedChallengeIds, active.length, finaleSize);
    if (formatChoice.season === "SEASON_LIPSYNC_ASSASSIN" && active.length >= 3) {
      ep = runLipsyncAssassinEpisode(active, db, statsByName, relationships, usedChallengeIds);
    } else if (formatChoice.season === "SEASON_LIPSYNC_LEGACY" && active.length >= 3) {
      ep = runLipsyncLegacyEpisode(active, db, statsByName, maxElim, usedChallengeIds, immuneNames);
    } else if (formatChoice.season === "SEASON_TEAMS" && !teamsEpisodeDone && active.length >= 4) {
      ep = runTeamsEpisode(active, db, statsByName, usedChallengeIds);
      teamsEpisodeDone = true;
    } else {
      ep = runEpisode(active, db, { maxElim, usedChallengeIds, immuneNames }, statsByName);
    }
    log.push({ label: `Episodio ${episodeNum}`, ...ep, mini: miniFor(ep) });
    processElimination(ep);
    if (immunityEnabled) immuneNames = new Set(winnersOf(ep));

    // Regreso al azar: una eliminada vuelve (solo si hay eliminadas disponibles)
    if (formatChoice.return === "RETURN_RANDOM" && eliminated.length > 0 && Math.random() < 0.3) {
      const idx = Math.floor(Math.random() * eliminated.length);
      const returning = eliminated.splice(idx, 1)[0];
      active.push(returning);
      log.push({ label: `Regreso (Episodio ${episodeNum})`, challenge: null, results: [], eliminatedName: null,
        lipsyncNote: `${returning} regresa a la competición.` });
    } else if (formatChoice.return === "RETURN_LALAPARUZA" && eliminated.length >= 2 && Math.random() < 0.3) {
      const poolSize = Math.min(eliminated.length, 4);
      const chosenIdx = shuffle(eliminated.map((_, i) => i)).slice(0, poolSize);
      const pool = chosenIdx.map((i) => eliminated[i]);
      eliminated = eliminated.filter((_, i) => !chosenIdx.includes(i));
      const laLa = runLaLaParUza(pool, db, statsByName);
      pool.filter((n) => n !== laLa.returning).forEach((n) => eliminated.push(n));
      active.push(laLa.returning);
      log.push({ label: `LaLaParUza (Episodio ${episodeNum})`, challenge: "LaLaParUza", results: [], eliminatedName: null,
        lipsyncNote: `Lip sync grupal entre ${pool.join(", ")}. ${laLa.roundLogs.join(" ")} ${laLa.returning} gana y regresa a la competición.` });
    }
    episodeNum++;
  }

  // --- Final ---
  const finalists = [...active];
  let winnerName, runnerUpName, restNames, finaleScoredForLog, finaleLabel, finaleLipsyncNote;

  if (formatChoice.finale === "FINALE_JURY_VOTE") {
    const jury = runJuryFinale(finalists, eliminated, db, statsByName);
    winnerName = jury.winnerName; runnerUpName = jury.runnerUpName; restNames = jury.rest;
    finaleScoredForLog = jury.finaleScored; finaleLabel = jury.label; finaleLipsyncNote = jury.lipsyncNote;
  } else if (formatChoice.finale === "FINALE_LIPSYNC_CROWN") {
    const crown = runLipsyncCrownFinale(finalists, db, statsByName);
    winnerName = crown.winnerName; runnerUpName = crown.runnerUpName; restNames = crown.rest;
    finaleScoredForLog = crown.finaleScored; finaleLabel = crown.label; finaleLipsyncNote = crown.lipsyncNote;
  } else {
    const finaleScored = finalists.map((name) => ({ name, score: challengeScore(name, null, db, statsByName) }));
    finaleScored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
    const [a, b] = finaleScored;
    winnerName = lipsyncWinner(a.name, b.name, db, statsByName);
    runnerUpName = winnerName === a.name ? b.name : a.name;
    restNames = finaleScored.slice(2).map((f) => f.name);
    finaleScoredForLog = finaleScored;
    finaleLabel = "Lip Sync por la corona";
    finaleLipsyncNote = `${winnerName} gana el lip sync final y se corona.`;
  }

  // Miss Simpatía: solo puede ganarla una eliminada durante la temporada (nunca una
  // finalista); se elige según quién mejor se lleve con el resto en la tabla de relaciones.
  const missCongeniality = eliminated.length ? pickMissCongeniality(eliminated, relationships) : null;

  // Reunión: al azar, o es su propio capítulo antes de la final (BEFORE) o ocurre dentro de la
  // propia final (SAME); nunca después. Es donde se revela Miss Simpatía. En ambos casos las
  // eliminadas vuelven como invitadas (GUEST) en la final.
  const reunionType = REUNION_TYPES[Math.floor(Math.random() * REUNION_TYPES.length)];

  const finalistsResults = finaleScoredForLog.map((f) => ({ name: f.name, score: f.score,
    status: f.name === winnerName ? "WINNER" : f.name === runnerUpName ? "RUNNER_UP" : "SAFE" }));
  // Miss Simpatía se entrega una sola vez: en la reunión (si es su propio capítulo) o en la
  // final (si la reunión va dentro de ella), nunca en las dos. Donde no se entrega, la ganadora
  // sale como una invitada más.
  const guestResults = (awardsMissCongeniality) => eliminated.map((name) => ({ name, score: null,
    status: awardsMissCongeniality && name === missCongeniality ? "MISS_CONGENIALITY" : "GUEST" }));

  const guestsNote = eliminated.length
    ? ` Las eliminadas vuelven como invitadas.${reunionType === "SAME" && missCongeniality ? ` ${missCongeniality} gana Miss Simpatía.` : ""}`
    : "";
  const finalLogEntry = {
    label: "Final",
    challenge: finaleLabel,
    results: [...finalistsResults, ...guestResults(reunionType === "SAME")],
    eliminatedNames: [],
    lipsyncNote: finaleLipsyncNote + guestsNote,
  };

  // Reunión como capítulo propio (antes de la final): las finalistas también "aparecen", pero
  // todavía no han hecho el lip sync final, así que quedan como RUN (ya clasificadas,
  // corriendo por la corona).
  if (reunionType === "BEFORE") {
    log.push({
      label: "Reunión",
      challenge: "Reunión",
      results: [...finalists.map((name) => ({ name, score: null, status: "RUN" })), ...guestResults(true)],
      eliminatedNames: [],
      lipsyncNote: `Las eliminadas de la temporada vuelven para la reunión.${missCongeniality ? ` ${missCongeniality} gana Miss Simpatía.` : ""} Las finalistas ya están confirmadas pero todavía no han hecho el lip sync final.`,
    });
  }
  log.push(finalLogEntry);

  const finalPlacements = { [winnerName]: "WINNER", [runnerUpName]: "RUNNER_UP" };
  restNames.forEach((name, i) => { finalPlacements[name] = `${i + 3}º lugar`; });
  // Las eliminadas durante la temporada siguen el mismo puesto de la clasificación final:
  // la última en salir queda justo detrás de las finalistas, la primera en salir queda última.
  [...eliminated].reverse().forEach((name, i) => {
    if (!finalPlacements[name]) finalPlacements[name] = `${finaleSize + i + 1}º lugar`;
  });

  // Narrativa: quiénes quedaron en qué puesto cuando hay más de una implicada a la vez
  // (dobles+ eliminaciones durante la temporada, o finalistas que no llegan al lip sync
  // final en formatos Top3/Top4/jurado/bracket).
  log.forEach((ep) => {
    if (ep.eliminatedNames && ep.eliminatedNames.length > 1) {
      const entries = ep.eliminatedNames.map((name) => ({ name, placement: finalPlacements[name] }));
      ep.lipsyncNote += ` ${describeTiedPlacements(entries)}`;
    }
  });
  if (restNames.length > 0) {
    const entries = restNames.map((name) => ({ name, placement: finalPlacements[name] }));
    finalLogEntry.lipsyncNote += ` ${describeTiedPlacements(entries)}`;
  }

  return { log, winnerName, runnerUpName, finalPlacements, missCongeniality, notes, relationships };
}

window.SimEngine = { simulateSeason, generateRelationships, RELATIONSHIP_LEVELS };
