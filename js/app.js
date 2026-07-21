let DB = window.RulesStore.loadDB();

const TABS = ["simulate", "statuses", "challenges", "formats", "roster"];
let currentTab = "simulate";
let simSelection = new Set();
let lastSimResult = null;
let revealedEpisodes = 1;
let rosterSeasonTab = {};

const GROUP_LABELS = {
  premiere: "Estreno",
  return: "Regreso",
  season: "Temporada",
  finale: "Final",
};

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function contestantImage(name) {
  const real = window.ALL_CONTESTANTS.find((c) => c.name === name);
  if (real && real.image) return real.image;
  const custom = DB.customContestants.find((c) => c.name === name);
  if (custom && custom.image) return custom.image;
  return null;
}

// Stats de una concursante: si el usuario editó las de una concursante real, esa
// personalización (guardada en DB.contestantOverrides) gana sobre las de fábrica.
function contestantStats(name) {
  if (DB.contestantOverrides[name]) return DB.contestantOverrides[name];
  const real = window.ALL_CONTESTANTS.find((c) => c.name === name);
  if (real && real.stats) return real.stats;
  const custom = DB.customContestants.find((c) => c.name === name);
  if (custom && custom.stats) return custom.stats;
  return null;
}

function avatarImg(name, sizeClass) {
  const src = contestantImage(name);
  if (!src) return null;
  const img = el("img", { src, alt: name, class: "avatar" + (sizeClass ? " " + sizeClass : "") });
  img.addEventListener("error", () => { img.remove(); });
  return img;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function render() {
  renderTabs();
  const root = document.getElementById("panel");
  root.innerHTML = "";
  if (currentTab === "simulate") root.appendChild(renderSimulate());
  if (currentTab === "statuses") root.appendChild(renderStatuses());
  if (currentTab === "challenges") root.appendChild(renderChallenges());
  if (currentTab === "formats") root.appendChild(renderFormats());
  if (currentTab === "roster") root.appendChild(renderRoster());
}

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  const labels = { simulate: "Simular", statuses: "Estados", challenges: "Retos", formats: "Formatos", roster: "Roster de prueba" };
  TABS.forEach((tab) => {
    const btn = el("button", {
      class: "tab" + (tab === currentTab ? " tab--active" : ""),
      text: labels[tab],
      onclick: () => { currentTab = tab; render(); },
    });
    nav.appendChild(btn);
  });
}

// ---------- SIMULAR ----------
let formatChoice = {
  premiere: "PREMIERE_NORMAL",
  return: "RETURN_NONE",
  season: "SEASON_REGULAR",
  finale: "FINALE_TOP2",
};

function renderSimulate() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h2", { text: "Simular temporada" }),
    el("p", { class: "muted", text: "Elige concursantes y formato, y genera una temporada completa episodio a episodio. Las concursantes con estadísticas definidas (ver pestaña Roster) puntúan sesgado hacia sus puntos fuertes; el resto puntúa totalmente al azar." }),
  ]));

  // Selección de concursantes: buscador con filtrado en vivo (al estilo de
  // myrainboww.github.io/Drag-Race-Simulator y esopare.github.io/esoteric-drag-race-simulator)
  // sobre todo el roster cargado (temporadas reales + personalizadas), mezclando de
  // cualquier origen en un mismo reparto. El botón "Al azar" añade una concursante al azar
  // cada vez que se pulsa (no rellena un cupo fijo de golpe). No se muestra el roster
  // completo de fondo: los resultados del buscador solo aparecen mientras se escribe.
  const allPool = [...window.ALL_CONTESTANTS, ...DB.customContestants];
  const addOne = (name) => { simSelection.add(name); render(); };
  const addRandomOne = () => {
    const remaining = allPool.filter((c) => !simSelection.has(c.name));
    if (!remaining.length) return;
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    addOne(pick.name);
  };

  // 1. Buscador
  wrap.appendChild(el("h3", { class: "group-title", text: "Buscar concursantes" }));
  wrap.appendChild(el("p", { class: "muted small", text: "Escribe el nombre de una concursante y haz click en el resultado para añadirla, o pulsa \"Al azar\" para añadir una al azar." }));

  const searchRow = el("div", { class: "toolbar", style: "justify-content:flex-start;" });
  const searchInput = el("input", { type: "text", class: "name-input", placeholder: "Buscar concursante..." });
  searchRow.appendChild(searchInput);
  searchRow.appendChild(el("button", { class: "btn btn--ghost", text: "🎲 Al azar", onclick: addRandomOne }));
  wrap.appendChild(searchRow);

  const resultsWrap = el("div", { class: "search-results" });
  wrap.appendChild(resultsWrap);

  const renderResults = (query) => {
    resultsWrap.innerHTML = "";
    const q = query.trim().toLowerCase();
    if (!q) return;
    const pool = allPool.filter((c) => !simSelection.has(c.name));
    const matches = pool.filter((c) => c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    if (!matches.length) {
      resultsWrap.appendChild(el("span", { class: "muted small", text: "Sin resultados." }));
      return;
    }
    matches.forEach((c) => {
      const item = el("button", { type: "button", class: "search-result",
        onclick: () => { addOne(c.name); searchInput.value = ""; renderResults(""); searchInput.focus(); } });
      const avatar = avatarImg(c.name, "avatar--result");
      if (avatar) item.appendChild(avatar);
      item.appendChild(el("span", { text: c.name }));
      resultsWrap.appendChild(item);
    });
  };
  searchInput.addEventListener("input", () => renderResults(searchInput.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = searchInput.value.trim().toLowerCase();
    const first = allPool.find((c) => !simSelection.has(c.name) && c.name.toLowerCase().includes(q));
    if (first) { addOne(first.name); searchInput.value = ""; renderResults(""); }
  });

  // 2. Formato
  wrap.appendChild(el("h3", { class: "group-title", text: "Formato" }));
  const formatGrid = el("div", { class: "grid grid--formats" });
  Object.entries(GROUP_LABELS).forEach(([group, label]) => {
    const options = DB.formats.filter((f) => f.group === group);
    const select = el("select", {
      onchange: (e) => { formatChoice[group] = e.target.value; },
    });
    options.forEach((f) => {
      const opt = el("option", { value: f.id, text: f.label });
      if (f.id === formatChoice[group]) opt.setAttribute("selected", "selected");
      select.appendChild(opt);
    });
    formatGrid.appendChild(el("label", { class: "form-row" }, [el("span", { text: label }), select]));
  });
  wrap.appendChild(formatGrid);

  // 3. Concursantes elegidas
  wrap.appendChild(el("h3", { class: "group-title", text: `Concursantes elegidas (${simSelection.size})` }));
  wrap.appendChild(el("p", { class: "muted small", text: "Haz click en una chip para quitarla." }));

  const chipsWrap = el("div", { class: "chip-list" });
  if (!simSelection.size) chipsWrap.appendChild(el("span", { class: "muted small", text: "Ninguna concursante seleccionada todavía." }));
  [...simSelection].forEach((name) => {
    const chip = el("button", { type: "button", class: "name-chip", title: "Quitar",
      onclick: () => { simSelection.delete(name); render(); } });
    const avatar = avatarImg(name, "avatar--result");
    if (avatar) chip.appendChild(avatar);
    chip.appendChild(el("span", { text: name }));
    chip.appendChild(el("span", { class: "name-chip__remove", text: "×" }));
    chipsWrap.appendChild(chip);
  });
  wrap.appendChild(chipsWrap);

  if (simSelection.size) {
    wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start;" }, [
      el("button", { class: "btn btn--ghost", text: "Vaciar selección", onclick: () => { simSelection = new Set(); render(); } }),
    ]));
  }

  // 4. Simular
  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:1rem;" }, [
    el("button", { class: "btn btn--accent", text: "▶ Simular temporada", onclick: runSimulation }),
  ]));

  if (lastSimResult) wrap.appendChild(renderSimResult(lastSimResult, revealedEpisodes));

  return wrap;
}

function buildStatsByName() {
  const map = {};
  window.ALL_CONTESTANTS.forEach((c) => { if (c.stats) map[c.name] = c.stats; });
  DB.customContestants.forEach((c) => { if (c.stats) map[c.name] = c.stats; });
  Object.entries(DB.contestantOverrides).forEach(([name, stats]) => { map[name] = stats; });
  return map;
}

function runSimulation() {
  const names = [...simSelection];
  if (names.length < 3) return alert("Selecciona al menos 3 concursantes.");
  const result = window.SimEngine.simulateSeason(names, formatChoice, DB, buildStatsByName());
  lastSimResult = result;
  revealedEpisodes = 1;
  render();
}

// Agrupa el log de la temporada en columnas de trackrecord (solo los episodios que
// reparten estados por concursante; los regresos/LaLaParUza quedan como texto aparte) y
// en filas por concursante con su historial de casillas, al estilo de una hoja TRACKRECORDS.
function buildTrackRecord(result) {
  const indexed = result.log.map((ep, idx) => ({ ep, idx }));
  const columns = indexed.filter(({ ep }) => ep.results && ep.results.length > 0);

  const names = new Set();
  columns.forEach(({ ep }) => ep.results.forEach((r) => names.add(r.name)));

  const rows = [...names].map((name) => {
    const cells = columns.map(({ ep }) => ep.results.find((r) => r.name === name) || null);
    let eliminatedAtCol = null;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i]) { eliminatedAtCol = cells[i].status === "ELIM" ? i : null; break; }
    }
    return { name, cells, eliminatedAtCol };
  });

  return { columns, rows, indexed };
}

function statusCountsForPoints(status) {
  return status.countsForPoints !== undefined ? status.countsForPoints : status.type === "weekly";
}

function shortEpisodeLabel(label) {
  if (label === "Final") return "Final";
  const m = /Episodio (\w+)/.exec(label);
  return m ? "Ep. " + m[1] : label;
}

const RELATIONSHIP_STYLE = {
  "le cae muy bien": { symbol: "++", color: "#3FA796" },
  "le cae bien": { symbol: "+", color: "#4FD1C5" },
  "normal": { symbol: "•", color: "#7C8CA6" },
  "le cae mal": { symbol: "−", color: "#E08A3E" },
  "le cae muy mal": { symbol: "−−", color: "#C24E4E" },
};

function relationshipsTable(names, relationships) {
  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "stats-table trackrecord-table relationships-table" });
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", { text: "¿Quién opina?" }));
  names.forEach((name) => headRow.appendChild(el("th", { text: name })));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  names.forEach((rowName) => {
    const tr = el("tr");
    const nameCell = el("td", { class: "trackrecord-name" });
    const avatar = avatarImg(rowName, "avatar--chip");
    if (avatar) nameCell.appendChild(avatar);
    nameCell.appendChild(el("span", { text: rowName }));
    tr.appendChild(nameCell);
    names.forEach((colName) => {
      if (rowName === colName) { tr.appendChild(el("td", { class: "trackrecord-cell", text: "—" })); return; }
      const level = relationships[rowName] && relationships[rowName][colName];
      const style = RELATIONSHIP_STYLE[level];
      tr.appendChild(el("td", { class: "trackrecord-cell", text: style ? style.symbol : "?",
        title: level || "", style: style ? `background:${style.color};` : "" }));
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const legend = el("p", { class: "muted small", text: "++ le cae muy bien · + le cae bien · • normal · − le cae mal · −− le cae muy mal" });
  const wrapAll = el("div", {});
  wrapAll.appendChild(tableWrap);
  wrapAll.appendChild(legend);
  return wrapAll;
}

function trackRecordTable(track, shown, result) {
  const sortedRows = [...track.rows].sort((a, b) => {
    const aOut = a.eliminatedAtCol !== null && a.eliminatedAtCol <= shown - 1;
    const bOut = b.eliminatedAtCol !== null && b.eliminatedAtCol <= shown - 1;
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (aOut && bOut) return b.eliminatedAtCol - a.eliminatedAtCol;
    return 0;
  });

  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "stats-table trackrecord-table" });
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", { text: "Rank" }));
  headRow.appendChild(el("th", { text: "Concursante" }));
  track.columns.slice(0, shown).forEach(({ ep }) => headRow.appendChild(el("th", { text: shortEpisodeLabel(ep.label) })));
  headRow.appendChild(el("th", { text: "PPE" }));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  sortedRows.forEach((row) => {
    const tr = el("tr");
    const isOut = row.eliminatedAtCol !== null && row.eliminatedAtCol <= shown - 1;
    const revealedAll = shown >= track.columns.length;
    const rankText = (isOut || revealedAll) ? (result.finalPlacements[row.name] || "TBA") : "TBA";
    tr.appendChild(el("td", { text: rankText }));

    const nameCell = el("td", { class: "trackrecord-name" });
    const avatar = avatarImg(row.name, "avatar--chip");
    if (avatar) nameCell.appendChild(avatar);
    nameCell.appendChild(el("span", { text: row.name }));
    tr.appendChild(nameCell);

    let pointsSum = 0, pointsCount = 0;
    row.cells.slice(0, shown).forEach((cell) => {
      if (!cell) { tr.appendChild(el("td", { class: "trackrecord-cell", text: "—" })); return; }
      const status = DB.statuses.find((s) => s.id === cell.status);
      tr.appendChild(el("td", { class: "trackrecord-cell", text: cell.status,
        style: status ? `background:${status.color};` : "" }));
      if (status && statusCountsForPoints(status)) { pointsSum += status.points; pointsCount++; }
    });

    tr.appendChild(el("td", { text: pointsCount ? (pointsSum / pointsCount).toFixed(2) : "–" }));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  return tableWrap;
}

function renderSimResult(result, revealedCount) {
  const wrap = el("div", { class: "sim-result" });
  const track = buildTrackRecord(result);
  const totalCols = track.columns.length;
  const shown = Math.min(revealedCount, totalCols);

  wrap.appendChild(el("h3", { class: "group-title", text: "Resultado" }));

  if (result.notes.length) {
    const notesBox = el("div", { class: "notes-box" });
    result.notes.forEach((n) => notesBox.appendChild(el("p", { class: "muted small", text: "⚠ " + n })));
    wrap.appendChild(notesBox);
  }

  if (result.relationships) {
    wrap.appendChild(el("h3", { class: "group-title", text: "Relaciones antes de empezar" }));
    wrap.appendChild(el("p", { class: "muted small", text: "Quién opina qué de quién (fila = quién opina, columna = sobre quién). Cuanta más Estrategia tenga una concursante, más marcadas son sus opiniones." }));
    wrap.appendChild(relationshipsTable(Object.keys(result.relationships), result.relationships));
  }

  wrap.appendChild(trackRecordTable(track, shown, result));

  // Narrativa (reto + nota de lip sync) de los episodios ya revelados, incluyendo
  // regresos/LaLaParUza que no forman su propia columna en la tabla.
  const cutoff = shown <= 0 ? -1 : (track.columns[shown] ? track.columns[shown].idx : track.indexed.length) - 1;
  result.log.slice(0, cutoff + 1).forEach((ep) => {
    const epBox = el("div", { class: "episode" });
    epBox.appendChild(el("div", { class: "episode__head" }, [
      el("strong", { text: ep.label }),
      ep.challenge ? el("span", { class: "muted small", text: " · " + ep.challenge }) : null,
    ]));
    if (ep.lipsyncNote) epBox.appendChild(el("p", { class: "muted small", text: ep.lipsyncNote }));
    wrap.appendChild(epBox);
  });

  if (shown < totalCols) {
    wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:1rem;" }, [
      el("button", { class: "btn btn--accent", text: "▶ Siguiente episodio", onclick: () => { revealedEpisodes = shown + 1; render(); } }),
      el("button", { class: "btn btn--ghost", text: "Revelar todo", onclick: () => { revealedEpisodes = totalCols; render(); } }),
    ]));
  } else {
    wrap.appendChild(el("h3", { class: "group-title", text: "Clasificación final" }));
    const podium = el("div", { class: "grid" });
    Object.entries(result.finalPlacements)
      .sort((a, b) => placementRank(a[1]) - placementRank(b[1]))
      .forEach(([name, place]) => {
        const card = el("div", { class: "card card--queen" });
        const avatar = avatarImg(name, "avatar--podium");
        if (avatar) card.appendChild(avatar);
        card.appendChild(el("strong", { text: name }));
        card.appendChild(el("div", { class: "muted small", text: place }));
        if (name === result.missCongeniality) card.appendChild(el("div", { class: "badge", text: "Miss Simpatía" }));
        podium.appendChild(card);
      });
    wrap.appendChild(podium);
  }

  return wrap;
}

function placementRank(place) {
  if (place === "WINNER") return 0;
  if (place === "RUNNER_UP") return 1;
  const m = /^(\d+)º/.exec(place);
  if (m) return Number(m[1]);
  const m2 = /Eliminada #(\d+)/.exec(place);
  if (m2) return 100 - Number(m2[1]);
  return 999;
}

// ---------- ESTADOS ----------
function renderStatuses() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h2", { text: "Catálogo de estados" }),
    el("p", { class: "muted", text: "Resultados semanales y colocaciones finales. Los \"puntos\" son el valor que usará el motor de estadísticas." }),
    el("button", { class: "btn btn--accent", text: "+ Nuevo estado", onclick: () => openStatusForm() }),
  ]));

  ["weekly", "final"].forEach((type) => {
    const groupLabel = type === "weekly" ? "Semanales (por reto)" : "Colocación final";
    wrap.appendChild(el("h3", { class: "group-title", text: groupLabel }));
    const grid = el("div", { class: "grid" });
    DB.statuses.filter((s) => s.type === type).forEach((s) => grid.appendChild(statusCard(s)));
    wrap.appendChild(grid);
  });

  return wrap;
}

function statusCard(s) {
  const card = el("div", { class: "card", style: `border-left-color:${s.color}` });
  card.appendChild(el("div", { class: "card__top" }, [
    el("span", { class: "chip", style: `background:${s.color}`, text: s.id }),
    s.custom ? el("span", { class: "badge", text: "personalizado" }) : null,
  ]));
  card.appendChild(el("strong", { text: s.label }));
  card.appendChild(el("p", { class: "muted small", text: s.description }));
  card.appendChild(el("div", { class: "card__meta", text: `Puntos: ${s.points}${statusCountsForPoints(s) ? " (cuenta para PPE)" : ""}` }));
  card.appendChild(el("div", { class: "card__actions" }, [
    el("button", { class: "btn btn--ghost", text: "Editar", onclick: () => openStatusForm(s) }),
    el("button", { class: "btn btn--ghost btn--danger", text: "Eliminar", onclick: () => deleteItem("statuses", s.id) }),
  ]));
  return card;
}

function openStatusForm(existing) {
  const isNew = !existing;
  const data = existing || { id: "", label: "", type: "weekly", color: "#E4136B", points: 0, countsForPoints: true, description: "", custom: true };
  const currentCounts = data.countsForPoints !== undefined ? data.countsForPoints : data.type === "weekly";
  openModal(isNew ? "Nuevo estado" : `Editar ${data.id}`, [
    field("Código (ID)", "id", data.id, isNew ? "" : "disabled"),
    field("Nombre", "label", data.label),
    selectField("Tipo", "type", data.type, [["weekly", "Semanal"], ["final", "Colocación final"]]),
    field("Color", "color", data.color, "", "color"),
    field("Puntos", "points", data.points, "", "number"),
    selectField("Cuenta para el promedio (PPE)", "countsForPoints", String(currentCounts), [["true", "Sí"], ["false", "No"]]),
    textareaField("Descripción", "description", data.description),
  ], (values) => {
    const item = {
      id: values.id.trim().toUpperCase().replace(/\s+/g, "_"),
      label: values.label,
      type: values.type,
      color: values.color,
      points: Number(values.points) || 0,
      countsForPoints: values.countsForPoints === "true",
      description: values.description,
      custom: true,
    };
    if (!item.id) return alert("El código no puede estar vacío.");
    upsertItem("statuses", item, isNew);
  });
}

// ---------- RETOS ----------
function renderChallenges() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h2", { text: "Catálogo de tipos de reto" }),
    el("p", { class: "muted", text: "Los maxi challenges, mini retos y pasarelas disponibles para tus temporadas." }),
    el("button", { class: "btn btn--accent", text: "+ Nuevo reto", onclick: () => openChallengeForm() }),
  ]));
  const grid = el("div", { class: "grid" });
  DB.challenges.forEach((c) => grid.appendChild(challengeCard(c)));
  wrap.appendChild(grid);

  wrap.appendChild(el("h3", { class: "group-title", text: "Escala de puntuación por reto" }));
  const scaleWrap = el("div", { class: "scale" });
  DB.scoreScale.forEach((s) => {
    scaleWrap.appendChild(el("div", { class: "scale__item" }, [
      el("span", { class: "scale__value", text: s.value }),
      el("span", { class: "scale__label", text: s.label }),
    ]));
  });
  wrap.appendChild(scaleWrap);

  return wrap;
}

function challengeCard(c) {
  const catLabel = { maxi: "Maxi challenge", mini: "Mini reto", runway: "Pasarela" }[c.category] || c.category;
  const card = el("div", { class: "card" });
  card.appendChild(el("div", { class: "card__top" }, [
    el("span", { class: "chip chip--outline", text: catLabel }),
    c.custom ? el("span", { class: "badge", text: "personalizado" }) : null,
  ]));
  card.appendChild(el("strong", { text: c.label }));
  card.appendChild(el("p", { class: "muted small", text: c.description }));
  card.appendChild(el("div", { class: "muted small", text: c.stats && c.stats.length
    ? "Estadísticas: " + c.stats.map((k) => window.STAT_LABELS[k]).join(", ")
    : "Sin estadísticas asignadas (puntúa con el promedio de todas)." }));
  card.appendChild(el("div", { class: "card__actions" }, [
    el("button", { class: "btn btn--ghost", text: "Editar", onclick: () => openChallengeForm(c) }),
    el("button", { class: "btn btn--ghost btn--danger", text: "Eliminar", onclick: () => deleteItem("challenges", c.id) }),
  ]));
  return card;
}

function openChallengeForm(existing) {
  const isNew = !existing;
  const data = existing || { id: "", label: "", category: "maxi", description: "", stats: [], custom: true };
  openModal(isNew ? "Nuevo reto" : `Editar ${data.id}`, [
    field("Código (ID)", "id", data.id, isNew ? "" : "disabled"),
    field("Nombre", "label", data.label),
    selectField("Categoría", "category", data.category, [["maxi", "Maxi challenge"], ["mini", "Mini reto"], ["runway", "Pasarela"]]),
    checkboxGroupField("Estadísticas relevantes", "stats", data.stats || [], window.STAT_KEYS.map((k) => [k, window.STAT_LABELS[k]])),
    textareaField("Descripción", "description", data.description),
  ], (values) => {
    const item = {
      id: values.id.trim().toUpperCase().replace(/\s+/g, "_"),
      label: values.label,
      category: values.category,
      stats: values.stats,
      description: values.description,
      custom: true,
    };
    if (!item.id) return alert("El código no puede estar vacío.");
    upsertItem("challenges", item, isNew);
  });
}

// ---------- FORMATOS ----------
function renderFormats() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h2", { text: "Catálogo de formatos" }),
    el("p", { class: "muted", text: "Formatos de estreno, regreso, temporada y final, listos para el motor de simulación." }),
    el("button", { class: "btn btn--accent", text: "+ Nuevo formato", onclick: () => openFormatForm() }),
  ]));
  Object.keys(GROUP_LABELS).forEach((group) => {
    wrap.appendChild(el("h3", { class: "group-title", text: GROUP_LABELS[group] }));
    const grid = el("div", { class: "grid" });
    DB.formats.filter((f) => f.group === group).forEach((f) => grid.appendChild(formatCard(f)));
    wrap.appendChild(grid);
  });
  return wrap;
}

function formatCard(f) {
  const card = el("div", { class: "card" });
  card.appendChild(el("div", { class: "card__top" }, [
    el("span", { class: "chip chip--outline", text: GROUP_LABELS[f.group] }),
    f.custom ? el("span", { class: "badge", text: "personalizado" }) : null,
  ]));
  card.appendChild(el("strong", { text: f.label }));
  card.appendChild(el("p", { class: "muted small", text: f.description }));
  card.appendChild(el("div", { class: "card__actions" }, [
    el("button", { class: "btn btn--ghost", text: "Editar", onclick: () => openFormatForm(f) }),
    el("button", { class: "btn btn--ghost btn--danger", text: "Eliminar", onclick: () => deleteItem("formats", f.id) }),
  ]));
  return card;
}

function openFormatForm(existing) {
  const isNew = !existing;
  const data = existing || { id: "", label: "", group: "season", description: "", custom: true };
  openModal(isNew ? "Nuevo formato" : `Editar ${data.id}`, [
    field("Código (ID)", "id", data.id, isNew ? "" : "disabled"),
    field("Nombre", "label", data.label),
    selectField("Grupo", "group", data.group, Object.entries(GROUP_LABELS).map(([k, v]) => [k, v])),
    textareaField("Descripción / reglas", "description", data.description),
  ], (values) => {
    const item = {
      id: values.id.trim().toUpperCase().replace(/\s+/g, "_"),
      label: values.label,
      group: values.group,
      description: values.description,
      custom: true,
    };
    if (!item.id) return alert("El código no puede estar vacío.");
    upsertItem("formats", item, isNew);
  });
}

// ---------- ROSTER (temporadas reales de solo lectura + concursantes personalizadas) ----------
function renderRoster() {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h2", { text: "Roster" }),
    el("p", { class: "muted", text: "Temporadas reales cargadas, extraídas de tu hoja TRACKRECORDS / fandom wiki. En la pestaña Simular puedes mezclar concursantes de cualquiera de ellas (o personalizadas) en un mismo reparto." }),
  ]));

  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h3", { class: "group-title", text: "Concursantes personalizadas" }),
    el("button", { class: "btn btn--accent", text: "+ Nueva concursante", onclick: () => openCustomQueenForm() }),
  ]));
  if (!DB.customContestants.length) {
    wrap.appendChild(el("p", { class: "muted small", text: "Todavía no has creado ninguna. Crea una con sus 7 estadísticas (Acting/Comedy/Dance/Design/Improv/Runway/Lip Sync) para usarla en el simulador." }));
  } else {
    const customGrid = el("div", { class: "grid" });
    DB.customContestants.forEach((c) => {
      const card = el("div", { class: "card card--queen" });
      const avatar = avatarImg(c.name, "avatar--card");
      if (avatar) card.appendChild(avatar);
      card.appendChild(el("strong", { text: c.name }));
      card.appendChild(el("div", { class: "muted small", text: statsSummaryLine(contestantStats(c.name)) }));
      card.appendChild(el("div", { class: "card__actions" }, [
        el("button", { class: "btn btn--ghost", text: "Editar", onclick: () => openCustomQueenForm(c) }),
        el("button", { class: "btn btn--ghost btn--danger", text: "Eliminar", onclick: () => deleteCustomContestant(c.name) }),
      ]));
      customGrid.appendChild(card);
    });
    wrap.appendChild(customGrid);
  }

  // Agrupa las temporadas por franquicia (p.ej. "Estados Unidos") en un <details>
  // colapsable por franquicia, y dentro cada temporada en su propia sección, con las
  // concursantes ordenadas alfabéticamente (no por orden de eliminación/colocación).
  const franchises = [];
  window.ALL_SEASONS.forEach((season) => {
    const key = season.franchise || "Otras";
    let group = franchises.find((f) => f.name === key);
    if (!group) { group = { name: key, seasons: [] }; franchises.push(group); }
    group.seasons.push(season);
  });

  franchises.forEach((franchise) => {
    const totalContestants = franchise.seasons.reduce((sum, s) => sum + s.contestants.length, 0);
    const flag = window.FRANCHISE_FLAGS[franchise.name] || "";
    const details = el("details", { class: "franchise-drawer", open: "open" });
    const summary = el("summary", { class: "franchise-drawer__summary" });
    summary.appendChild(el("span", { class: "franchise-drawer__title", text: `${flag} ${franchise.name}`.trim() }));
    summary.appendChild(el("span", { class: "muted small", text: ` ${franchise.seasons.length} temporada(s) · ${totalContestants} concursantes` }));
    details.appendChild(summary);

    // Pestañas por temporada dentro de la franquicia: solo se muestra el roster de la
    // temporada activa, para no tener que desplazarte por todas las anteriores si quieres
    // editar, p.ej., la Temporada 9.
    const activeSeasonId = rosterSeasonTab[franchise.name] || franchise.seasons[0].id;
    const activeSeason = franchise.seasons.find((s) => s.id === activeSeasonId) || franchise.seasons[0];

    const seasonTabs = el("div", { class: "season-tabs" });
    franchise.seasons.forEach((season) => {
      const num = season.id.replace(/^\D+/, "") || season.seasonName;
      seasonTabs.appendChild(el("button", {
        type: "button",
        class: "tab tab--sm" + (season.id === activeSeason.id ? " tab--active" : ""),
        text: num,
        title: season.seasonName,
        onclick: () => { rosterSeasonTab[franchise.name] = season.id; render(); },
      }));
    });
    details.appendChild(seasonTabs);

    details.appendChild(el("h4", { class: "season-title", text: activeSeason.seasonName }));
    const grid = el("div", { class: "grid" });
    const sortedContestants = [...activeSeason.contestants].sort((a, b) => a.name.localeCompare(b.name));
    sortedContestants.forEach((c) => {
      const card = el("div", { class: "card card--queen" });
      const avatar = avatarImg(c.name, "avatar--card");
      if (avatar) card.appendChild(avatar);
      card.appendChild(el("strong", { text: c.name }));
      card.appendChild(el("div", { class: "muted small", text: placementLabel(c.finalPlacement) }));
      card.appendChild(el("div", { class: "muted small", text: statsSummaryLine(contestantStats(c.name)) }));
      if (DB.contestantOverrides[c.name]) card.appendChild(el("span", { class: "badge", text: "stats personalizadas" }));
      card.appendChild(el("a", { class: "link", href: c.link, target: "_blank", rel: "noopener", text: "Ficha ↗" }));
      card.appendChild(el("div", { class: "card__actions" }, [
        el("button", { class: "btn btn--ghost", text: "Editar stats", onclick: () => openRealStatsForm(c) }),
      ]));
      grid.appendChild(card);
    });
    details.appendChild(grid);

    wrap.appendChild(details);
  });
  return wrap;
}

function placementLabel(code) {
  const s = DB.statuses.find((s) => s.id === code);
  return s ? s.label : code;
}

function statsSummaryLine(stats) {
  if (!stats) return "Sin estadísticas (puntúa totalmente al azar).";
  return window.STAT_KEYS.map((k) => `${window.STAT_LABELS[k]} ${stats[k]}`).join(" · ");
}

// ---------- CONCURSANTES PERSONALIZADAS ----------
function openCustomQueenForm(existing) {
  const isNew = !existing;
  const data = existing || { name: "", image: "", stats: window.randomStats() };

  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = "";
  overlay.classList.add("visible");
  const modal = el("div", { class: "modal" });
  modal.appendChild(el("h3", { text: isNew ? "Nueva concursante personalizada" : `Editar ${data.name}` }));

  const nameRow = el("label", { class: "form-row" }, [el("span", { text: "Nombre" })]);
  const nameInput = el("input", { type: "text" });
  nameInput.value = data.name;
  if (!isNew) nameInput.setAttribute("disabled", "disabled");
  nameRow.appendChild(nameInput);
  modal.appendChild(nameRow);

  const imageRow = el("label", { class: "form-row" }, [el("span", { text: "Foto (URL, opcional)" })]);
  const imageInput = el("input", { type: "text", placeholder: "https://..." });
  imageInput.value = data.image || "";
  imageRow.appendChild(imageInput);
  modal.appendChild(imageRow);

  const statInputs = {};
  const statsGrid = el("div", { class: "stats-grid" });
  window.STAT_KEYS.forEach((key) => {
    const row = el("div", { class: "stats-grid__item" });
    row.appendChild(el("span", { class: "stats-grid__label", text: window.STAT_LABELS[key] }));
    const input = el("input", { type: "number", min: "0", max: "15" });
    input.value = data.stats[key];
    statInputs[key] = input;
    row.appendChild(input);
    statsGrid.appendChild(row);
  });
  modal.appendChild(statsGrid);

  modal.appendChild(el("div", { style: "margin: 0.6rem 0;" }, [
    el("button", { class: "btn btn--ghost", text: "🎲 Aleatorizar stats", onclick: () => {
      const randomized = window.randomStats();
      window.STAT_KEYS.forEach((key) => { statInputs[key].value = randomized[key]; });
    } }),
  ]));

  const actions = el("div", { class: "modal__actions" }, [
    el("button", { class: "btn btn--ghost", text: "Cancelar", onclick: closeModal }),
    el("button", { class: "btn btn--accent", text: "Guardar", onclick: () => {
      const name = nameInput.value.trim();
      if (!name) return alert("El nombre no puede estar vacío.");
      const stats = {};
      window.STAT_KEYS.forEach((key) => {
        stats[key] = Math.max(0, Math.min(15, Number(statInputs[key].value) || 0));
      });
      const image = imageInput.value.trim();
      const exists = DB.customContestants.some((c) => c.name === name);
      if (isNew) {
        if (exists) return alert("Ya existe una concursante personalizada con ese nombre.");
        DB.customContestants.push({ name, image, stats });
      } else {
        const idx = DB.customContestants.findIndex((c) => c.name === data.name);
        if (idx < 0) return alert("No se encontró la concursante a editar.");
        DB.customContestants[idx] = { name, image, stats };
      }
      window.RulesStore.saveDB(DB);
      closeModal();
      render();
    } }),
  ]);
  modal.appendChild(actions);
  overlay.appendChild(modal);
}

function deleteCustomContestant(name) {
  if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
  DB.customContestants = DB.customContestants.filter((c) => c.name !== name);
  simSelection.delete(name);
  window.RulesStore.saveDB(DB);
  render();
}

// ---------- EDITAR STATS DE UNA CONCURSANTE REAL ----------
function openRealStatsForm(contestant) {
  const hasOverride = !!DB.contestantOverrides[contestant.name];
  const data = DB.contestantOverrides[contestant.name] || contestant.stats || window.randomStats();

  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = "";
  overlay.classList.add("visible");
  const modal = el("div", { class: "modal" });
  modal.appendChild(el("h3", { text: `Editar stats: ${contestant.name}` }));
  if (hasOverride) modal.appendChild(el("p", { class: "muted small", text: "Estas stats ya están personalizadas por ti." }));

  const statInputs = {};
  const statsGrid = el("div", { class: "stats-grid" });
  window.STAT_KEYS.forEach((key) => {
    const row = el("div", { class: "stats-grid__item" });
    row.appendChild(el("span", { class: "stats-grid__label", text: window.STAT_LABELS[key] }));
    const input = el("input", { type: "number", min: "0", max: "15" });
    input.value = data[key] ?? 0;
    statInputs[key] = input;
    row.appendChild(input);
    statsGrid.appendChild(row);
  });
  modal.appendChild(statsGrid);

  modal.appendChild(el("div", { style: "margin: 0.6rem 0;" }, [
    el("button", { class: "btn btn--ghost", text: "🎲 Aleatorizar stats", onclick: () => {
      const randomized = window.randomStats();
      window.STAT_KEYS.forEach((key) => { statInputs[key].value = randomized[key]; });
    } }),
  ]));

  const actions = [
    el("button", { class: "btn btn--ghost", text: "Cancelar", onclick: closeModal }),
  ];
  if (hasOverride) {
    actions.push(el("button", { class: "btn btn--ghost btn--danger", text: "Restablecer original", onclick: () => {
      delete DB.contestantOverrides[contestant.name];
      window.RulesStore.saveDB(DB);
      closeModal();
      render();
    } }));
  }
  actions.push(el("button", { class: "btn btn--accent", text: "Guardar", onclick: () => {
    const stats = {};
    window.STAT_KEYS.forEach((key) => {
      stats[key] = Math.max(0, Math.min(15, Number(statInputs[key].value) || 0));
    });
    DB.contestantOverrides[contestant.name] = stats;
    window.RulesStore.saveDB(DB);
    closeModal();
    render();
  } }));
  modal.appendChild(el("div", { class: "modal__actions" }, actions));
  overlay.appendChild(modal);
}

// ---------- CRUD helpers ----------
function upsertItem(collection, item, isNew) {
  const list = DB[collection];
  const idx = list.findIndex((x) => x.id === item.id);
  if (isNew) {
    if (idx >= 0) return alert("Ya existe un elemento con ese código.");
    list.push(item);
  } else {
    if (idx < 0) return alert("No se encontró el elemento a editar.");
    list[idx] = item;
  }
  window.RulesStore.saveDB(DB);
  closeModal();
  render();
}

function deleteItem(collection, id) {
  if (!confirm(`¿Eliminar "${id}"? Esta acción no se puede deshacer.`)) return;
  DB[collection] = DB[collection].filter((x) => x.id !== id);
  window.RulesStore.saveDB(DB);
  render();
}

// ---------- Modal genérico ----------
function field(label, name, value, extra = "", type = "text") {
  return { label, name, value, extra, type, kind: "input" };
}
function selectField(label, name, value, options) {
  return { label, name, value, options, kind: "select" };
}
function textareaField(label, name, value) {
  return { label, name, value, kind: "textarea" };
}
function checkboxGroupField(label, name, selected, options) {
  return { label, name, selected, options, kind: "checkboxgroup" };
}

function openModal(title, fields, onSubmit) {
  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = "";
  overlay.classList.add("visible");
  const modal = el("div", { class: "modal" });
  modal.appendChild(el("h3", { text: title }));

  const inputs = {};
  fields.forEach((f) => {
    if (f.kind === "checkboxgroup") {
      const row = el("div", { class: "form-row" }, [el("span", { text: f.label })]);
      const group = el("div", { class: "checkbox-group" });
      const boxes = {};
      f.options.forEach(([val, label]) => {
        const boxLabel = el("label", { class: "checkbox-group__item" });
        const box = el("input", { type: "checkbox" });
        box.checked = f.selected.includes(val);
        boxes[val] = box;
        boxLabel.appendChild(box);
        boxLabel.appendChild(el("span", { text: label }));
        group.appendChild(boxLabel);
      });
      inputs[f.name] = boxes;
      row.appendChild(group);
      modal.appendChild(row);
      return;
    }

    const row = el("label", { class: "form-row" }, [el("span", { text: f.label })]);
    let input;
    if (f.kind === "select") {
      input = el("select", { name: f.name });
      f.options.forEach(([val, label]) => {
        const opt = el("option", { value: val, text: label });
        if (val === f.value) opt.setAttribute("selected", "selected");
        input.appendChild(opt);
      });
    } else if (f.kind === "textarea") {
      input = el("textarea", { name: f.name, rows: "3" });
      input.value = f.value || "";
    } else {
      input = el("input", { name: f.name, type: f.type || "text" });
      if (f.extra === "disabled") input.setAttribute("disabled", "disabled");
      input.value = f.value ?? "";
    }
    inputs[f.name] = input;
    row.appendChild(input);
    modal.appendChild(row);
  });

  const actions = el("div", { class: "modal__actions" }, [
    el("button", { class: "btn btn--ghost", text: "Cancelar", onclick: closeModal }),
    el("button", { class: "btn btn--accent", text: "Guardar", onclick: () => {
      const values = {};
      fields.forEach((f) => {
        if (f.kind === "checkboxgroup") {
          values[f.name] = f.options.filter(([val]) => inputs[f.name][val].checked).map(([val]) => val);
        } else {
          values[f.name] = inputs[f.name].value;
        }
      });
      onSubmit(values);
    } }),
  ]);
  modal.appendChild(actions);
  overlay.appendChild(modal);
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("visible");
  overlay.innerHTML = "";
}

// ---------- Export / Import ----------
function exportJSON() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: "reglas-drag-race-simulator.json" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.statuses || !parsed.challenges || !parsed.formats) {
        throw new Error("El archivo no tiene el formato esperado.");
      }
      DB = parsed;
      if (!DB.customContestants) DB.customContestants = [];
      if (!DB.contestantOverrides) DB.contestantOverrides = {};
      window.RulesStore.saveDB(DB);
      render();
    } catch (e) {
      alert("No se pudo importar el archivo: " + e.message);
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm("Esto borrará tus cambios personalizados y volverá a los catálogos por defecto. ¿Continuar?")) return;
  DB = window.RulesStore.resetDB();
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("btn-reset").addEventListener("click", resetAll);
  document.getElementById("file-import").addEventListener("change", (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
});
