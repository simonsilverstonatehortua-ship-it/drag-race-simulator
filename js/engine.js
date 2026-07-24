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
// Estadísticas: la puntuación de una concursante en un reto es la media de las
// estadísticas relevantes del reto (js/data/challenges.js) más un bono al azar entre 1 y
// 5 (ver challengeScore). Para lip syncs se usa la media de Lip Sync/Carisma/
// Originalidad/Nervio/Talento, también +1-5 al azar (ver lipsyncScore). Las estadísticas
// que falten se sustituyen por un valor al azar en su misma escala 0-15, para no
// penalizar ni beneficiar a quien no las tenga definidas.

const IMPLEMENTED_PREMIERE = ["PREMIERE_NORMAL", "PREMIERE_NORMAL_NOELIM", "PREMIERE_DOUBLE", "PREMIERE_DOUBLE_NOELIM", "PREMIERE_PORKCHOP"];
const IMPLEMENTED_RETURN = ["RETURN_NONE", "RETURN_RANDOM", "RETURN_LALAPARUZA"];
const IMPLEMENTED_SEASON = ["SEASON_REGULAR", "SEASON_TEAMS", "SEASON_LIPSYNC_ASSASSIN", "SEASON_LIPSYNC_LEGACY"];
const IMPLEMENTED_FINALE = ["FINALE_TOP2", "FINALE_TOP3", "FINALE_TOP4", "FINALE_JURY_VOTE", "FINALE_LIPSYNC_CROWN"];

const FINALE_SIZE = {
  FINALE_TOP2: 2,
  FINALE_TOP3: 3,
  FINALE_TOP4: 4,
  FINALE_JURY_VOTE: 3,
  FINALE_LIPSYNC_CROWN: 4,
};

const ALL_STAT_KEYS = ["acting", "comedy", "dance", "design", "improv", "runway", "lipsync", "makeup", "singing", "verses"];

const RELATIONSHIP_LEVELS = ["le cae muy bien", "le cae bien", "normal", "le cae mal", "le cae muy mal"];

// "requireElim": excluye retos marcados "noElim" (p.ej. Meet the Queens) para formatos
// (equipos, Lipsync Assassin, Lipsync For Your Legacy) cuya lógica exige que alguien se
// vaya esa semana.
function randomChallenge(challenges, { requireElim = false } = {}) {
  let maxis = challenges;
  if (requireElim) {
    const withElim = maxis.filter((c) => !c.noElim);
    if (withElim.length) maxis = withElim;
  }
  return maxis[Math.floor(Math.random() * maxis.length)];
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

// Bono al azar (entero entre 1 y 5) que se suma a la media de estadísticas para dar
// puntuación final de un reto o un lip sync.
function randomStatBonus() {
  return 1 + Math.floor(Math.random() * 5);
}

// Estadísticas que decide un lip sync (no las de Lip Sync a secas: también Carisma,
// Originalidad, Nervio y Talento).
const LIPSYNC_SCORE_KEYS = ["lipsync", "charisma", "uniqueness", "nerve", "talent"];

// Puntuación de una concursante en un reto: media de las estadísticas relevantes del reto
// (las que no tenga definidas se sustituyen por un valor al azar en su misma escala 0-15,
// para no penalizarla ni beneficiarla) más un bono al azar entre 1 y 5.
function challengeScore(name, statKeys, db, statsByName) {
  const stats = statsByName[name];
  const keys = statKeys && statKeys.length ? statKeys : ALL_STAT_KEYS;
  const vals = keys.map((k) => (stats && typeof stats[k] === "number") ? stats[k] : Math.random() * 15);
  return average(vals) + randomStatBonus();
}

// Puntuación de una concursante en un lip sync: media de Lip Sync, Carisma, Originalidad,
// Nervio y Talento (mismo criterio de sustitución al azar que challengeScore) más un bono
// al azar entre 1 y 5.
function lipsyncScore(name, db, statsByName) {
  const stats = statsByName[name];
  const vals = LIPSYNC_SCORE_KEYS.map((k) => (stats && typeof stats[k] === "number") ? stats[k] : Math.random() * 15);
  return average(vals) + randomStatBonus();
}

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

// Miss Simpatía: si hay datos de Carisma, se sesga hacia quien tenga más; si no, al azar.
function pickMissCongeniality(candidates, statsByName) {
  const withStats = candidates.filter((n) => statsByName[n] && typeof statsByName[n].charisma === "number");
  if (!withStats.length) return candidates[Math.floor(Math.random() * candidates.length)];
  const weights = candidates.map((n) => (statsByName[n] ? statsByName[n].charisma + 1 : 8));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
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

// Reparte fondo+eliminación sobre quienes en "results" sigan "SAFE" (deja intactas las
// casillas ya asignadas antes, p.ej. WIN/TOP2 de Lipsync For Your Legacy): las 2 últimas
// del ranking por puntaje de reto van a lip sync por su vida; la de menor puntaje de lip
// sync es eliminada, la otra sobrevive (BTM). El resto del grupo se queda SAFE.
// Si solo queda 1 persona en el grupo (p.ej. Lipsync For Your Legacy con apenas 3 activas:
// las 2 mejores ya se fueron al legacy lip sync), esa única persona no tiene con quién
// hacer lip sync y queda eliminada directamente, para no estancar la temporada.
// "maxElim" evita eliminar cuando ya se llegó al tamaño de la final.
// Devuelve { eliminatedNames, lipsyncNote }.
function assignBottomTwoAndElimination(results, db, statsByName, { noElim = false, maxElim = Infinity } = {}) {
  const pool = results.filter((r) => r.status === "SAFE");
  const n = pool.length;
  const canEliminate = !noElim && maxElim > 0 && n >= 1;

  let eliminatedNames = [];
  let lipsyncNote = "";
  if (canEliminate && n >= 2) {
    const bottomTwo = pool.slice(n - 2);
    const lipScored = bottomTwo.map((r) => ({ name: r.name, lip: lipsyncScore(r.name, db, statsByName) }));
    lipScored.sort((a, b) => a.lip - b.lip || Math.random() - 0.5);
    const loserName = lipScored[0].name;
    eliminatedNames = [loserName];
    bottomTwo.forEach((r) => { r.status = r.name === loserName ? "ELIM" : "BTM"; });
    const survivor = bottomTwo.find((r) => r.name !== loserName).name;
    lipsyncNote = `Lip sync: se salva ${survivor}.`;
  } else if (canEliminate && n === 1) {
    const only = pool[0];
    only.status = "ELIM";
    eliminatedNames = [only.name];
    lipsyncNote = `${only.name} es la única fuera del podio esta semana y queda eliminada sin lip sync (no hay con quién emparejarla).`;
  } else if (!noElim) {
    lipsyncNote = "Grupo demasiado reducido para lip sync esta semana: nadie es eliminada.";
  }

  return { eliminatedNames, lipsyncNote };
}

// Simula un único reto entre un grupo de concursantes activas. Se puntúa a cada una
// (media de las estadísticas relevantes del reto + un bono al azar de 1 a 5) y se ordena
// de mejor a peor: la primera de la lista gana el reto; las 2 últimas van a lip sync por
// su vida (mismo método con Lip Sync/Carisma/Originalidad/Nervio/Talento); el resto queda
// SAFE.
// "maxElim" limita cuántas puede eliminar este episodio (para no bajar del tamaño de la
// final); por defecto sin límite.
// Devuelve { results: [{name, score, status}], eliminatedNames, lipsyncNote }
function runEpisode(activeNames, db, { noElim = false, maxElim = Infinity } = {}, statsByName = {}) {
  const challenge = randomChallenge(db.challenges);

  if (challenge.noElim && challenge.presentationStats && challenge.lookStats) {
    return runNoElimSpotlightEpisode(activeNames, db, statsByName, challenge);
  }

  const scored = activeNames.map((name) => ({ name, score: challengeScore(name, challenge.stats, db, statsByName) }));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  const winStatus = challenge.category === "runway" ? "WIN_RUNWAY" : "WIN";
  const results = scored.map((s, i) => ({ ...s, status: i === 0 ? winStatus : "SAFE" }));

  const { eliminatedNames, lipsyncNote } = assignBottomTwoAndElimination(results, db, statsByName, { noElim, maxElim });
  return { challenge: challenge.label, results, eliminatedNames, lipsyncNote };
}

// --- Reto sin eliminación con doble reconocimiento (p.ej. Meet the Queens): se juzga
// quién se presenta mejor y quién luce el mejor look de promo, pero nadie es eliminada. ---
function runNoElimSpotlightEpisode(activeNames, db, statsByName, challenge) {
  const results = activeNames.map((name) => ({
    name,
    score: challengeScore(name, challenge.stats, db, statsByName),
    status: "SAFE",
  }));

  const presentationScored = activeNames
    .map((name) => ({ name, score: challengeScore(name, challenge.presentationStats, db, statsByName) }))
    .sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const bestPresentation = presentationScored[0].name;

  const lookScored = activeNames
    .map((name) => ({ name, score: challengeScore(name, challenge.lookStats, db, statsByName) }))
    .sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const bestLook = lookScored[0].name;

  results.find((r) => r.name === bestPresentation).status = "WIN";
  results.find((r) => r.name === bestLook).status = "WIN";

  const lipsyncNote = bestPresentation === bestLook
    ? `${bestPresentation} es quien mejor se presenta y también luce el mejor look de promo esta semana.`
    : `${bestPresentation} es quien mejor se presenta esta semana. ${bestLook} luce el mejor look de promo.`;

  return {
    challenge: challenge.label,
    results,
    eliminatedNames: [],
    lipsyncNote: `${lipsyncNote} Al ser un capítulo de presentación, no hay reto principal ni eliminación esta semana.`,
  };
}

// --- Lipsync For Your Legacy: las dos mejores puntuadas de la semana hacen lip sync por
// su legado. Si empataron exactamente en puntaje, ambas quedan WIN_TIE (10 puntos cada
// una, gane quien gane el lip sync). Si no hubo empate exacto, la ganadora del lip sync
// se queda con el WIN y la otra queda TOP2 (también 10 puntos, sin poder de eliminación).
// El resto del grupo sigue el reparto normal de fondo+eliminación (las 2 últimas del
// ranking van a lip sync por su vida). ---
function runLipsyncLegacyEpisode(activeNames, db, statsByName, maxElim = Infinity) {
  const challenge = randomChallenge(db.challenges, { requireElim: true });
  const scored = activeNames.map((name) => ({ name, score: challengeScore(name, challenge.stats, db, statsByName) }));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));
  const winStatus = challenge.category === "runway" ? "WIN_RUNWAY" : "WIN";

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

  const { eliminatedNames, lipsyncNote } = assignBottomTwoAndElimination(results, db, statsByName, { maxElim });
  return { challenge: challenge.label, results, eliminatedNames, lipsyncNote: `${legacyNote} ${lipsyncNote}`.trim() };
}

// --- Estreno Porkchop: llegan por parejas, un mini reto decide quién compite esa
// semana en el reto principal (el resto queda a salvo sin competir). ---
function runPorkchopPremiere(activeNames, db, statsByName, maxElim = Infinity) {
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

  if (competing.length < 2) {
    safeFromMini.push(...competing);
    return {
      challenge: "Mini reto Porkchop",
      results: safeFromMini.map((name) => ({ name, score: null, status: "SAFE" })),
      eliminatedNames: [],
      lipsyncNote: `${miniNotes.join(" ")} Reparto demasiado reducido para un reto principal aparte: nadie es eliminada esta semana.`,
    };
  }

  const maxi = runEpisode(competing, db, { maxElim }, statsByName);
  const results = [
    ...safeFromMini.map((name) => ({ name, score: null, status: "SAFE" })),
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
function runTeamsEpisode(activeNames, db, statsByName) {
  const challenge = randomChallenge(db.challenges, { requireElim: true });
  const winStatus = challenge.category === "runway" ? "WIN_RUNWAY" : "WIN";
  const shuffled = shuffle(activeNames);
  const teams = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) teams.push([shuffled[i], shuffled[i + 1]]);
    else teams[teams.length - 1].push(shuffled[i]);
  }

  const teamScores = teams.map((team) => {
    const members = team.map((name) => ({ name, score: challengeScore(name, challenge.stats, db, statsByName) }));
    return { members, teamScore: average(members.map((m) => m.score)) };
  });
  teamScores.sort((a, b) => b.teamScore - a.teamScore || Math.random() - 0.5);

  const results = [];
  teamScores.forEach((t, i) => {
    const sortedMembers = [...t.members].sort((a, b) => b.score - a.score);
    if (i === 0) {
      sortedMembers.forEach((m, j) => results.push({ name: m.name, score: m.score, status: j === 0 ? winStatus : "HIGH" }));
    } else if (i === teamScores.length - 1 && teamScores.length > 1) {
      sortedMembers.forEach((m) => results.push({ name: m.name, score: m.score, status: "BTM" }));
    } else if (i === 1 && teamScores.length > 2) {
      sortedMembers.forEach((m) => results.push({ name: m.name, score: m.score, status: "HIGH_GROUP" }));
    } else {
      sortedMembers.forEach((m) => results.push({ name: m.name, score: m.score, status: "SAFE" }));
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
    const survivorNames = memberNames.filter((n) => n !== loserName);
    const survivorStatus = survivorNames.length > 1 ? "BTM_MULTI" : "BTM";
    survivorNames.forEach((n) => { results.find((r) => r.name === n).status = survivorStatus; });
    eliminatedName = loserName;
    lipsyncNote += ` El equipo peor puntuado hace lip sync entre sí: se salva ${survivorNames.join(", ")}.`;
  } else {
    lipsyncNote += " Reparto demasiado reducido para formar más de un equipo: nadie es eliminada esta semana.";
  }

  return { challenge: challenge.label, results, eliminatedName, lipsyncNote };
}

// --- Lipsync Assassin: la ganadora del reto reta a quien quiera a un lip sync directo,
// sin pasar por el fondo de la clasificación. ---
function runLipsyncAssassinEpisode(activeNames, db, statsByName, relationships = {}) {
  const challenge = randomChallenge(db.challenges, { requireElim: true });
  const scored = activeNames.map((name) => ({ name, score: challengeScore(name, challenge.stats, db, statsByName) }));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const n = scored.length;
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));
  results[0].status = challenge.category === "runway" ? "WIN_RUNWAY" : "WIN";
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

function simulateSeason(contestantNames, formatChoice, db, statsByName = {}) {
  const log = [];
  let active = [...contestantNames];
  let eliminated = [];
  const notes = [];
  const relationships = generateRelationships(contestantNames, statsByName);

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

  if (porkchopPremiere) {
    const maxElim = Math.max(0, active.length - finaleSize);
    const ep = runPorkchopPremiere(active, db, statsByName, maxElim);
    log.push({ label: "Episodio 1 (Porkchop)", ...ep });
    processElimination(ep);
  } else if (doublePremiere) {
    const shuffled = shuffle(active);
    const groupA = shuffled.slice(0, Math.ceil(shuffled.length / 2));
    const groupB = shuffled.slice(Math.ceil(shuffled.length / 2));
    const maxElimA = Math.max(0, active.length - finaleSize);
    const epA = runEpisode(groupA, db, { noElim: noElimPremiere, maxElim: maxElimA }, statsByName);
    log.push({ label: "Episodio 1a (grupo A)", ...epA });
    processElimination(epA);
    const maxElimB = Math.max(0, active.length - finaleSize);
    const epB = runEpisode(groupB, db, { noElim: noElimPremiere, maxElim: maxElimB }, statsByName);
    log.push({ label: "Episodio 1b (grupo B)", ...epB });
    processElimination(epB);
  } else {
    const maxElim = Math.max(0, active.length - finaleSize);
    const ep = runEpisode(active, db, { noElim: noElimPremiere, maxElim }, statsByName);
    log.push({ label: "Episodio 1", ...ep });
    processElimination(ep);
  }

  // --- Temporada regular hasta llegar al tamaño de la final ---
  let episodeNum = 2;
  let teamsEpisodeDone = false;
  while (active.length > finaleSize) {
    let ep;
    const maxElim = Math.max(0, active.length - finaleSize);
    if (formatChoice.season === "SEASON_LIPSYNC_ASSASSIN" && active.length >= 3) {
      ep = runLipsyncAssassinEpisode(active, db, statsByName, relationships);
    } else if (formatChoice.season === "SEASON_LIPSYNC_LEGACY" && active.length >= 3) {
      ep = runLipsyncLegacyEpisode(active, db, statsByName, maxElim);
    } else if (formatChoice.season === "SEASON_TEAMS" && !teamsEpisodeDone && active.length >= 4) {
      ep = runTeamsEpisode(active, db, statsByName);
      teamsEpisodeDone = true;
    } else {
      ep = runEpisode(active, db, { maxElim }, statsByName);
    }
    log.push({ label: `Episodio ${episodeNum}`, ...ep });
    processElimination(ep);

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

  const finalLogEntry = {
    label: "Final",
    challenge: finaleLabel,
    results: finaleScoredForLog.map((f) => ({ name: f.name, score: f.score,
      status: f.name === winnerName ? "WINNER" : f.name === runnerUpName ? "RUNNER_UP" : "SAFE" })),
    eliminatedNames: [],
    lipsyncNote: finaleLipsyncNote,
  };
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

  // Miss Simpatía: se favorece a quien tenga más Carisma (si hay stats), si no, al azar.
  const missCandidates = contestantNames.filter((n) => n !== winnerName);
  const missCongeniality = pickMissCongeniality(missCandidates, statsByName);

  return { log, winnerName, runnerUpName, finalPlacements, missCongeniality, notes, relationships };
}

window.SimEngine = { simulateSeason };
