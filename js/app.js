let DB = window.RulesStore.loadDB();

const HISTORY_KEY = "dragRaceSimulator.history.v1";

const TABS = ["simulate", "stats", "statuses", "challenges", "formats", "roster"];
let currentTab = "simulate";
let simSelection = new Set(window.ALL_SEASONS[0].contestants.map((c) => c.name));
let lastSimResult = null;

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
  if (currentTab === "stats") root.appendChild(renderStats());
  if (currentTab === "statuses") root.appendChild(renderStatuses());
  if (currentTab === "challenges") root.appendChild(renderChallenges());
  if (currentTab === "formats") root.appendChild(renderFormats());
  if (currentTab === "roster") root.appendChild(renderRoster());
}

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  const labels = { simulate: "Simular", stats: "Estadísticas", statuses: "Estados", challenges: "Retos", formats: "Formatos", roster: "Roster de prueba" };
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

  // Selección de concursantes: se escribe el nombre (con autocompletado) o se elige un
  // número al azar entre todo el roster cargado (temporadas reales + personalizadas),
  // mezclando de cualquier origen en un mismo reparto.
  const allPool = [...window.ALL_CONTESTANTS, ...DB.customContestants];
  wrap.appendChild(el("h3", { class: "group-title", text: `Concursantes (${simSelection.size} seleccionadas)` }));
  wrap.appendChild(el("p", { class: "muted small", text: "Escribe el nombre de una concursante (autocompleta con todo el roster cargado) o pulsa \"Elegir al azar\". Haz click en una chip para quitarla." }));

  const chipsWrap = el("div", { class: "chip-list" });
  if (!simSelection.size) chipsWrap.appendChild(el("span", { class: "muted small", text: "Ninguna concursante seleccionada todavía." }));
  [...simSelection].forEach((name) => {
    const chip = el("span", { class: "name-chip" });
    chip.appendChild(el("span", { text: name }));
    chip.appendChild(el("button", { type: "button", class: "name-chip__remove", text: "×", title: "Quitar",
      onclick: () => { simSelection.delete(name); render(); } }));
    chipsWrap.appendChild(chip);
  });
  wrap.appendChild(chipsWrap);

  const addByName = (nameInput) => {
    const typed = nameInput.value.trim();
    if (!typed) return;
    const match = allPool.find((c) => c.name.toLowerCase() === typed.toLowerCase());
    if (!match) return alert(`No se encontró ninguna concursante llamada "${typed}". Revisa el roster o créala como personalizada en la pestaña Roster.`);
    simSelection.add(match.name);
    render();
  };

  const addRow = el("div", { class: "toolbar", style: "justify-content:flex-start;" });
  const nameInput = el("input", { type: "text", list: "contestant-options", class: "name-input", placeholder: "Nombre de la concursante..." });
  const datalist = el("datalist", { id: "contestant-options" });
  allPool.forEach((c) => datalist.appendChild(el("option", { value: c.name })));
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addByName(nameInput); nameInput.value = ""; nameInput.focus(); } });
  addRow.appendChild(nameInput);
  addRow.appendChild(datalist);
  addRow.appendChild(el("button", { class: "btn btn--accent", text: "+ Añadir", onclick: () => addByName(nameInput) }));
  wrap.appendChild(addRow);

  const randomRow = el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:0.6rem;" });
  const countInput = el("input", { type: "number", min: "3", max: String(allPool.length), value: String(Math.min(9, allPool.length)), class: "name-input name-input--count" });
  randomRow.appendChild(countInput);
  randomRow.appendChild(el("button", { class: "btn btn--ghost", text: "🎲 Elegir al azar", onclick: () => {
    const count = Math.max(3, Math.min(allPool.length, Number(countInput.value) || 9));
    const shuffled = [...allPool].sort(() => Math.random() - 0.5).slice(0, count);
    simSelection = new Set(shuffled.map((c) => c.name));
    render();
  } }));
  randomRow.appendChild(el("button", { class: "btn btn--ghost", text: "Vaciar selección", onclick: () => { simSelection = new Set(); render(); } }));
  wrap.appendChild(randomRow);

  // Selección de formatos
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

  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:1rem;" }, [
    el("button", { class: "btn btn--accent", text: "▶ Simular temporada", onclick: runSimulation }),
  ]));

  if (lastSimResult) wrap.appendChild(renderSimResult(lastSimResult));

  return wrap;
}

function buildStatsByName() {
  const map = {};
  window.ALL_CONTESTANTS.forEach((c) => { if (c.stats) map[c.name] = c.stats; });
  DB.customContestants.forEach((c) => { if (c.stats) map[c.name] = c.stats; });
  return map;
}

function runSimulation() {
  const names = [...simSelection];
  if (names.length < 3) return alert("Selecciona al menos 3 concursantes.");
  const result = window.SimEngine.simulateSeason(names, formatChoice, DB, buildStatsByName());
  lastSimResult = result;
  saveHistory(result);
  render();
}

function renderSimResult(result) {
  const wrap = el("div", { class: "sim-result" });
  wrap.appendChild(el("h3", { class: "group-title", text: "Resultado" }));

  if (result.notes.length) {
    const notesBox = el("div", { class: "notes-box" });
    result.notes.forEach((n) => notesBox.appendChild(el("p", { class: "muted small", text: "⚠ " + n })));
    wrap.appendChild(notesBox);
  }

  result.log.forEach((ep) => {
    const epBox = el("div", { class: "episode" });
    epBox.appendChild(el("div", { class: "episode__head" }, [
      el("strong", { text: ep.label }),
      ep.challenge ? el("span", { class: "muted small", text: " · " + ep.challenge }) : null,
    ]));
    if (ep.results && ep.results.length) {
      const table = el("div", { class: "episode__results" });
      ep.results.forEach((r) => table.appendChild(statusChip(r.name, r.status, r.score)));
      epBox.appendChild(table);
    }
    if (ep.lipsyncNote) epBox.appendChild(el("p", { class: "muted small", text: ep.lipsyncNote }));
    wrap.appendChild(epBox);
  });

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

function statusChip(name, statusId, score) {
  const status = DB.statuses.find((s) => s.id === statusId) || { label: statusId, color: "#7C8CA6" };
  const chip = el("div", { class: "status-chip", style: `border-color:${status.color}` });
  const avatar = avatarImg(name, "avatar--chip");
  if (avatar) chip.appendChild(avatar);
  chip.appendChild(el("span", { class: "status-chip__name", text: name }));
  chip.appendChild(el("span", { class: "status-chip__status", style: `color:${status.color}`, text: status.label }));
  if (typeof score === "number") chip.appendChild(el("span", { class: "status-chip__score", text: score }));
  return chip;
}

function saveHistory(result) {
  const history = loadHistory();
  history.push({
    date: new Date().toISOString(),
    winner: result.winnerName,
    runnerUp: result.runnerUpName,
    missCongeniality: result.missCongeniality,
    notes: result.notes,
    log: result.log,
    finalPlacements: result.finalPlacements,
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (e) {
    console.warn("No se pudo leer el historial, se ignora.", e);
    return [];
  }
}

function clearHistory() {
  if (!confirm("¿Borrar todo el historial de temporadas simuladas? Esta acción no se puede deshacer.")) return;
  localStorage.removeItem(HISTORY_KEY);
  render();
}

// ---------- ESTADÍSTICAS ----------
let statsSeasonDetail = null;

function renderStats() {
  const wrap = el("div", { class: "section" });
  const history = loadHistory();

  wrap.appendChild(el("div", { class: "section__head" }, [
    el("h2", { text: "Estadísticas" }),
    el("p", { class: "muted", text: `Basado en ${history.length} temporada(s) simulada(s) y guardada(s) en este navegador.` }),
    history.length ? el("button", { class: "btn btn--ghost btn--danger", text: "Borrar historial", onclick: clearHistory }) : null,
  ]));

  if (!history.length) {
    wrap.appendChild(el("p", { class: "muted", text: "Todavía no has simulado ninguna temporada. Ve a la pestaña \"Simular\" para generar la primera." }));
    return wrap;
  }

  const stats = window.StatsEngine.computeStats(history, DB);

  wrap.appendChild(el("h3", { class: "group-title", text: "Ranking de concursantes" }));
  wrap.appendChild(el("p", { class: "muted small", text: "\"Puntos/ep.\" es el promedio de puntos por episodio semanal (WIN/HIGH/SAFE/LOW/BTM/ELIM), igual que en tu Excel. \"Puntos totales\" suma también la colocación final." }));
  wrap.appendChild(statsTable(stats.contestants));

  wrap.appendChild(el("h3", { class: "group-title", text: "Historial de temporadas" }));
  const seasonsList = el("div", { class: "grid" });
  history.forEach((entry, i) => {
    const card = el("div", { class: "card card--queen" });
    card.appendChild(el("strong", { text: entry.winner ? `👑 ${entry.winner}` : "Temporada" }));
    card.appendChild(el("div", { class: "muted small", text: new Date(entry.date).toLocaleString() }));
    card.appendChild(el("div", { class: "muted small", text: `${Object.keys(entry.finalPlacements || {}).length} concursantes · ${(entry.log || []).length} episodios` }));
    if (entry.runnerUp) card.appendChild(el("div", { class: "muted small", text: `Runner-up: ${entry.runnerUp}` }));
    card.appendChild(el("div", { class: "card__actions" }, [
      el("button", { class: "btn btn--ghost", text: statsSeasonDetail === i ? "Ocultar detalle" : "Ver detalle",
        onclick: () => { statsSeasonDetail = statsSeasonDetail === i ? null : i; render(); } }),
    ]));
    seasonsList.appendChild(card);
  });
  wrap.appendChild(seasonsList);

  if (statsSeasonDetail !== null && history[statsSeasonDetail]) {
    const entry = history[statsSeasonDetail];
    wrap.appendChild(el("h3", { class: "group-title", text: "Detalle de la temporada" }));
    wrap.appendChild(renderSimResult({
      log: entry.log || [],
      notes: entry.notes || [],
      finalPlacements: entry.finalPlacements || {},
      missCongeniality: entry.missCongeniality,
    }));
  }

  return wrap;
}

function statsTable(contestants) {
  const sorted = [...contestants].sort((a, b) =>
    b.wins - a.wins || b.careerPoints - a.careerPoints || a.name.localeCompare(b.name));

  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "stats-table" });
  const thead = el("thead");
  const headRow = el("tr");
  ["Concursante", "Temp.", "WIN", "HIGH", "SAFE", "LOW", "BTM", "ELIM", "Coronas", "Runner-up", "Miss Simpatía", "Puntos/ep.", "Puntos totales"]
    .forEach((h) => headRow.appendChild(el("th", { text: h })));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  sorted.forEach((c) => {
    const row = el("tr");
    [
      c.name, c.seasons,
      c.statusCounts.WIN || 0, c.statusCounts.HIGH || 0, c.statusCounts.SAFE || 0,
      c.statusCounts.LOW || 0, c.statusCounts.BTM || 0, c.statusCounts.ELIM || 0,
      c.wins, c.runnerUps, c.missCongeniality,
      c.avgWeeklyPoints.toFixed(2), c.careerPoints,
    ].forEach((v) => row.appendChild(el("td", { text: String(v) })));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  return tableWrap;
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
  card.appendChild(el("div", { class: "card__meta", text: `Puntos: ${s.points}` }));
  card.appendChild(el("div", { class: "card__actions" }, [
    el("button", { class: "btn btn--ghost", text: "Editar", onclick: () => openStatusForm(s) }),
    el("button", { class: "btn btn--ghost btn--danger", text: "Eliminar", onclick: () => deleteItem("statuses", s.id) }),
  ]));
  return card;
}

function openStatusForm(existing) {
  const isNew = !existing;
  const data = existing || { id: "", label: "", type: "weekly", color: "#E4136B", points: 0, description: "", custom: true };
  openModal(isNew ? "Nuevo estado" : `Editar ${data.id}`, [
    field("Código (ID)", "id", data.id, isNew ? "" : "disabled"),
    field("Nombre", "label", data.label),
    selectField("Tipo", "type", data.type, [["weekly", "Semanal"], ["final", "Colocación final"]]),
    field("Color", "color", data.color, "", "color"),
    field("Puntos", "points", data.points, "", "number"),
    textareaField("Descripción", "description", data.description),
  ], (values) => {
    const item = {
      id: values.id.trim().toUpperCase().replace(/\s+/g, "_"),
      label: values.label,
      type: values.type,
      color: values.color,
      points: Number(values.points) || 0,
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
      card.appendChild(el("div", { class: "muted small", text: statsSummaryLine(c.stats) }));
      card.appendChild(el("div", { class: "card__actions" }, [
        el("button", { class: "btn btn--ghost", text: "Editar", onclick: () => openCustomQueenForm(c) }),
        el("button", { class: "btn btn--ghost btn--danger", text: "Eliminar", onclick: () => deleteCustomContestant(c.name) }),
      ]));
      customGrid.appendChild(card);
    });
    wrap.appendChild(customGrid);
  }

  window.ALL_SEASONS.forEach((season) => {
    wrap.appendChild(el("h3", { class: "group-title", text: season.seasonName }));
    const grid = el("div", { class: "grid" });
    season.contestants.forEach((c) => {
      const card = el("div", { class: "card card--queen" });
      const avatar = avatarImg(c.name, "avatar--card");
      if (avatar) card.appendChild(avatar);
      card.appendChild(el("strong", { text: c.name }));
      card.appendChild(el("div", { class: "muted small", text: placementLabel(c.finalPlacement) }));
      card.appendChild(el("div", { class: "muted small", text: statsSummaryLine(c.stats) }));
      card.appendChild(el("a", { class: "link", href: c.link, target: "_blank", rel: "noopener", text: "Ficha ↗" }));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
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
