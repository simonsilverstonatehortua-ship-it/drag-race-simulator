// Motor de estadísticas. Fase 3.
//
// Lee el historial de temporadas guardado en localStorage (dragRaceSimulator.history.v1,
// ver saveHistory() en app.js) y calcula agregados por concursante y por temporada,
// reutilizando los "puntos" del catálogo de Estados (js/data/statuses.js) tal como se
// hacía en la hoja de Excel original.

function computeStats(history, db) {
  const statusById = {};
  db.statuses.forEach((s) => { statusById[s.id] = s; });
  const pointsByStatus = {};
  db.statuses.forEach((s) => { pointsByStatus[s.id] = s.points; });
  const countsForPoints = (status) =>
    status && (status.countsForPoints !== undefined ? status.countsForPoints : status.type === "weekly");

  const perContestant = {};
  function ensure(name) {
    if (!perContestant[name]) {
      perContestant[name] = {
        name,
        seasons: 0,
        wins: 0,
        runnerUps: 0,
        missCongeniality: 0,
        statusCounts: {},
        weeklyPoints: 0,
        weeklyEpisodes: 0,
        careerPoints: 0,
      };
    }
    return perContestant[name];
  }

  history.forEach((entry) => {
    const namesThisSeason = new Set();

    (entry.log || []).forEach((ep) => {
      (ep.results || []).forEach((r) => {
        const c = ensure(r.name);
        namesThisSeason.add(r.name);
        c.statusCounts[r.status] = (c.statusCounts[r.status] || 0) + 1;
        const status = statusById[r.status];
        if (countsForPoints(status)) {
          c.weeklyPoints += status.points;
          c.weeklyEpisodes += 1;
          c.careerPoints += status.points;
        }
      });
    });

    Object.entries(entry.finalPlacements || {}).forEach(([name, place]) => {
      const c = ensure(name);
      namesThisSeason.add(name);
      if (place === "WINNER") { c.wins += 1; c.careerPoints += pointsByStatus.WINNER ?? 0; }
      if (place === "RUNNER_UP") { c.runnerUps += 1; c.careerPoints += pointsByStatus.RUNNER_UP ?? 0; }
    });

    if (entry.missCongeniality) {
      const c = ensure(entry.missCongeniality);
      namesThisSeason.add(entry.missCongeniality);
      c.missCongeniality += 1;
      c.careerPoints += pointsByStatus.MISS_CONGENIALITY ?? 0;
    }

    namesThisSeason.forEach((name) => { perContestant[name].seasons += 1; });
  });

  const contestants = Object.values(perContestant).map((c) => ({
    ...c,
    avgWeeklyPoints: c.weeklyEpisodes ? c.weeklyPoints / c.weeklyEpisodes : 0,
  }));

  return { contestants, totalSeasons: history.length };
}

window.StatsEngine = { computeStats };
