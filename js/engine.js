// Motor de simulación. Fase 2 + ampliaciones de Fase "formatos avanzados".
//
// Implementado de verdad: estreno normal / doble / Porkchop, sin regreso / regreso al
// azar / LaLaParUza, temporada regular / por equipos / Lipsync Assassin,
// final Top2 / Top3 / Top4 / voto del jurado / Lip Sync For The Crown por rondas.
// Los demás formatos (entrada tardía, Rate a Queen, Lip Sync Smackdown, Lipsync For
// Your Legacy, All Winners...) siguen seleccionables en la UI pero de momento caen en
// el comportamiento "regular" (se anota en el log de la temporada con una nota
// "(no implementado aún)").

const IMPLEMENTED_PREMIERE = ["PREMIERE_NORMAL", "PREMIERE_NORMAL_NOELIM", "PREMIERE_DOUBLE", "PREMIERE_DOUBLE_NOELIM", "PREMIERE_PORKCHOP"];
const IMPLEMENTED_RETURN = ["RETURN_NONE", "RETURN_RANDOM", "RETURN_LALAPARUZA"];
const IMPLEMENTED_SEASON = ["SEASON_REGULAR", "SEASON_TEAMS", "SEASON_LIPSYNC_ASSASSIN"];
const IMPLEMENTED_FINALE = ["FINALE_TOP2", "FINALE_TOP3", "FINALE_TOP4", "FINALE_JURY_VOTE", "FINALE_LIPSYNC_CROWN"];

const FINALE_SIZE = {
  FINALE_TOP2: 2,
  FINALE_TOP3: 3,
  FINALE_TOP4: 4,
  FINALE_JURY_VOTE: 3,
  FINALE_LIPSYNC_CROWN: 4,
};

function randomScore(scoreScale) {
  const values = scoreScale.map((s) => s.value);
  return values[Math.floor(Math.random() * values.length)];
}

function randomChallenge(challenges) {
  const maxis = challenges.filter((c) => c.category !== "runway");
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

// Dado un grupo en el fondo de la clasificación, decide el índice de quien PIERDE el
// lip sync (se va a casa). El peso favorece ligeramente a quien puntuó más alto dentro
// del grupo, igual que en el reto regular.
function weightedLoserIndex(candidates) {
  const weights = candidates.map((c) => c.score + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let idx = candidates.length - 1;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { idx = i; break; }
  }
  return idx;
}

function lipsyncWinner(nameA, nameB, db) {
  const scoreA = randomScore(db.scoreScale);
  const scoreB = randomScore(db.scoreScale);
  if (scoreA === scoreB) return Math.random() < 0.5 ? nameA : nameB;
  return scoreA > scoreB ? nameA : nameB;
}

// Simula un único reto entre un grupo de concursantes activas.
// Devuelve { results: [{name, score, status}], eliminatedName, notes }
function runEpisode(activeNames, db, { noElim = false, bottomCount = 2 } = {}) {
  const challenge = randomChallenge(db.challenges);
  const scored = activeNames.map((name) => ({ name, score: randomScore(db.scoreScale) }));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  const n = scored.length;
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));

  results[0].status = "WIN";
  if (n >= 6) results[1].status = "HIGH";
  if (!noElim && n >= 6) results[n - 2].status = "LOW";

  let eliminatedName = null;
  let lipsyncNote = "";
  if (!noElim) {
    const bottomN = Math.min(bottomCount, n - 1);
    const bottomSlice = results.slice(n - bottomN);
    bottomSlice.forEach((r) => (r.status = "BTM"));
    const loserIdx = weightedLoserIndex(bottomSlice);
    const loser = bottomSlice[loserIdx];
    eliminatedName = loser.name;
    loser.status = "ELIM";
    lipsyncNote = `Lip sync: se salva ${bottomSlice.filter((r) => r.name !== loser.name).map((r) => r.name).join(", ")}.`;
  }

  return { challenge: challenge.label, results, eliminatedName, lipsyncNote };
}

// --- Estreno Porkchop: llegan por parejas, un mini reto decide quién compite esa
// semana en el reto principal (el resto queda a salvo sin competir). ---
function runPorkchopPremiere(activeNames, db) {
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
    const scored = pair.map((name) => ({ name, score: randomScore(db.scoreScale) }));
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
      eliminatedName: null,
      lipsyncNote: `${miniNotes.join(" ")} Reparto demasiado reducido para un reto principal aparte: nadie es eliminada esta semana.`,
    };
  }

  const maxi = runEpisode(competing, db, {});
  const results = [
    ...safeFromMini.map((name) => ({ name, score: null, status: "SAFE" })),
    ...maxi.results,
  ];
  return {
    challenge: `Mini reto Porkchop + ${maxi.challenge}`,
    results,
    eliminatedName: maxi.eliminatedName,
    lipsyncNote: `${miniNotes.join(" ")} ${competing.length} concursantes compiten por sus vidas en el reto principal ("${maxi.challenge}"). ${maxi.lipsyncNote}`,
  };
}

// --- LaLaParUza: lip sync grupal en bracket entre eliminadas; la ganadora regresa. ---
function runLaLaParUza(pool, db) {
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
      const winner = lipsyncWinner(a, b, db);
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
function runTeamsEpisode(activeNames, db) {
  const challenge = randomChallenge(db.challenges);
  const shuffled = shuffle(activeNames);
  const teams = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) teams.push([shuffled[i], shuffled[i + 1]]);
    else teams[teams.length - 1].push(shuffled[i]);
  }

  const teamScores = teams.map((team) => {
    const members = team.map((name) => ({ name, score: randomScore(db.scoreScale) }));
    return { members, teamScore: average(members.map((m) => m.score)) };
  });
  teamScores.sort((a, b) => b.teamScore - a.teamScore || Math.random() - 0.5);

  const results = [];
  teamScores.forEach((t, i) => {
    const sortedMembers = [...t.members].sort((a, b) => b.score - a.score);
    if (i === 0) {
      sortedMembers.forEach((m, j) => results.push({ name: m.name, score: m.score, status: j === 0 ? "WIN" : "HIGH" }));
    } else if (i === teamScores.length - 1 && teamScores.length > 1) {
      sortedMembers.forEach((m) => results.push({ name: m.name, score: m.score, status: "BTM" }));
    } else {
      sortedMembers.forEach((m) => results.push({ name: m.name, score: m.score, status: "SAFE" }));
    }
  });

  const teamsDesc = teams.map((t, i) => `Equipo ${i + 1} (${t.join(" y ")})`).join("; ");
  let eliminatedName = null;
  let lipsyncNote = `Reto por equipos: ${teamsDesc}.`;

  const worstTeam = teamScores[teamScores.length - 1];
  if (teamScores.length > 1 && worstTeam.members.length >= 2) {
    const bottomSlice = worstTeam.members;
    const loserIdx = weightedLoserIndex(bottomSlice);
    const loser = bottomSlice[loserIdx];
    eliminatedName = loser.name;
    results.find((r) => r.name === loser.name).status = "ELIM";
    lipsyncNote += ` El equipo peor puntuado hace lip sync entre sí: se salva ${bottomSlice.filter((m) => m.name !== loser.name).map((m) => m.name).join(", ")}.`;
  } else {
    lipsyncNote += " Reparto demasiado reducido para formar más de un equipo: nadie es eliminada esta semana.";
  }

  return { challenge: challenge.label, results, eliminatedName, lipsyncNote };
}

// --- Lipsync Assassin: la ganadora del reto reta a quien quiera a un lip sync directo,
// sin pasar por el fondo de la clasificación. ---
function runLipsyncAssassinEpisode(activeNames, db) {
  const challenge = randomChallenge(db.challenges);
  const scored = activeNames.map((name) => ({ name, score: randomScore(db.scoreScale) }));
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  const n = scored.length;
  const results = scored.map((s) => ({ ...s, status: "SAFE" }));
  results[0].status = "WIN";
  if (n >= 6) results[1].status = "HIGH";
  if (n >= 6) results[n - 1].status = "LOW";

  const assassin = results[0].name;
  const candidates = results.slice(1);
  // El asesino tiende a retar a quien puntuó más bajo, pero puede retar a cualquiera.
  const weights = candidates.map((c) => 11 - c.score);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let targetIdx = candidates.length - 1;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { targetIdx = i; break; }
  }
  const target = candidates[targetIdx].name;

  const winner = lipsyncWinner(assassin, target, db);
  let eliminatedName = null;
  let lipsyncNote = `${assassin} gana el reto y se convierte en la Lipsync Assassin: reta a ${target} a un lip sync sin red.`;
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
function runJuryFinale(finalists, eliminatedPool, db) {
  const finaleScored = finalists.map((name) => ({ name, score: randomScore(db.scoreScale) }));
  finaleScored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  const votes = {};
  finalists.forEach((n) => (votes[n] = 0));
  eliminatedPool.forEach(() => {
    // El jurado tiende a premiar la mejor actuación de la final, pero no siempre.
    const votedFor = Math.random() < 0.65
      ? finaleScored[0].name
      : finalists[Math.floor(Math.random() * finalists.length)];
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
function runLipsyncCrownFinale(finalists, db) {
  const finaleScored = finalists.map((name) => ({ name, score: randomScore(db.scoreScale) }));
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
      const winner = lipsyncWinner(a, b, db);
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

function simulateSeason(contestantNames, formatChoice, db) {
  const log = [];
  let active = [...contestantNames];
  let eliminated = [];
  const notes = [];

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
    const ep = runPorkchopPremiere(active, db);
    log.push({ label: "Episodio 1 (Porkchop)", ...ep });
    if (ep.eliminatedName) {
      active = active.filter((n) => n !== ep.eliminatedName);
      eliminated.push(ep.eliminatedName);
    }
  } else if (doublePremiere) {
    const shuffled = shuffle(active);
    const groupA = shuffled.slice(0, Math.ceil(shuffled.length / 2));
    const groupB = shuffled.slice(Math.ceil(shuffled.length / 2));
    const epA = runEpisode(groupA, db, { noElim: noElimPremiere });
    const epB = runEpisode(groupB, db, { noElim: noElimPremiere });
    log.push({ label: "Episodio 1a (grupo A)", ...epA });
    log.push({ label: "Episodio 1b (grupo B)", ...epB });
    [epA, epB].forEach((ep) => {
      if (ep.eliminatedName) {
        active = active.filter((n) => n !== ep.eliminatedName);
        eliminated.push(ep.eliminatedName);
      }
    });
  } else {
    const ep = runEpisode(active, db, { noElim: noElimPremiere });
    log.push({ label: "Episodio 1", ...ep });
    if (ep.eliminatedName) {
      active = active.filter((n) => n !== ep.eliminatedName);
      eliminated.push(ep.eliminatedName);
    }
  }

  // --- Temporada regular hasta llegar al tamaño de la final ---
  let episodeNum = 2;
  let teamsEpisodeDone = false;
  while (active.length > finaleSize) {
    let ep;
    if (formatChoice.season === "SEASON_LIPSYNC_ASSASSIN" && active.length >= 3) {
      ep = runLipsyncAssassinEpisode(active, db);
    } else if (formatChoice.season === "SEASON_TEAMS" && !teamsEpisodeDone && active.length >= 4) {
      ep = runTeamsEpisode(active, db);
      teamsEpisodeDone = true;
    } else {
      ep = runEpisode(active, db);
    }
    log.push({ label: `Episodio ${episodeNum}`, ...ep });
    if (ep.eliminatedName) {
      active = active.filter((n) => n !== ep.eliminatedName);
      eliminated.push(ep.eliminatedName);
    }

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
      const laLa = runLaLaParUza(pool, db);
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
    const jury = runJuryFinale(finalists, eliminated, db);
    winnerName = jury.winnerName; runnerUpName = jury.runnerUpName; restNames = jury.rest;
    finaleScoredForLog = jury.finaleScored; finaleLabel = jury.label; finaleLipsyncNote = jury.lipsyncNote;
  } else if (formatChoice.finale === "FINALE_LIPSYNC_CROWN") {
    const crown = runLipsyncCrownFinale(finalists, db);
    winnerName = crown.winnerName; runnerUpName = crown.runnerUpName; restNames = crown.rest;
    finaleScoredForLog = crown.finaleScored; finaleLabel = crown.label; finaleLipsyncNote = crown.lipsyncNote;
  } else {
    const finaleScored = finalists.map((name) => ({ name, score: randomScore(db.scoreScale) }));
    finaleScored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
    const [a, b] = finaleScored;
    const winnerIsA = Math.random() < 0.5;
    winnerName = winnerIsA ? a.name : b.name;
    runnerUpName = winnerIsA ? b.name : a.name;
    restNames = finaleScored.slice(2).map((f) => f.name);
    finaleScoredForLog = finaleScored;
    finaleLabel = "Lip Sync por la corona";
    finaleLipsyncNote = `${winnerName} gana el lip sync final y se corona.`;
  }

  log.push({
    label: "Final",
    challenge: finaleLabel,
    results: finaleScoredForLog.map((f) => ({ name: f.name, score: f.score,
      status: f.name === winnerName ? "WINNER" : f.name === runnerUpName ? "RUNNER_UP" : "SAFE" })),
    eliminatedName: null,
    lipsyncNote: finaleLipsyncNote,
  });

  const finalPlacements = { [winnerName]: "WINNER", [runnerUpName]: "RUNNER_UP" };
  restNames.forEach((name, i) => { finalPlacements[name] = `${i + 3}º lugar`; });
  [...eliminated].reverse().forEach((name, i) => {
    if (!finalPlacements[name]) finalPlacements[name] = `Eliminada #${eliminated.length - i}`;
  });

  // Miss Simpatía: al azar entre quienes no ganaron
  const missCandidates = contestantNames.filter((n) => n !== winnerName);
  const missCongeniality = missCandidates[Math.floor(Math.random() * missCandidates.length)];

  return { log, winnerName, runnerUpName, finalPlacements, missCongeniality, notes };
}

window.SimEngine = { simulateSeason };
