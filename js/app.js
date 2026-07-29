let DB = window.RulesStore.loadDB();

const TABS = ["simulate", "challenges", "formats", "roster"];
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
  if (currentTab === "challenges") root.appendChild(renderChallenges());
  if (currentTab === "formats") root.appendChild(renderFormats());
  if (currentTab === "roster") root.appendChild(renderRoster());
}

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  const labels = { simulate: "Simular", challenges: "Retos", formats: "Formatos", roster: "Roster" };
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
  openingChallenge: "",
  twists: [],
};

// Opciones/twists: a diferencia de Estreno/Regreso/Temporada/Final (una sola opción de
// cada lista), aquí se pueden activar varias a la vez (checkboxes), al estilo de la
// pestaña "Twists" de esopare.github.io / myrainboww.github.io.
let selectedTwists = new Set();

// Reto de estreno: opcional, fuerza qué reto abre la temporada (episodio 1) en vez de
// sortearlo, al estilo de "First Episode" de esopare.github.io. No aplica al estreno
// Meet the Queens, que tiene su propia mecánica fija sin sortear reto. Si se deja en "Al
// azar", js/engine.js sortea entre esos mismos 4 (window.OPENING_CHALLENGE_IDS, definida
// ahí para no declarar el mismo identificador dos veces en el ámbito global compartido).

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

  wrap.appendChild(el("p", { class: "muted small", text: "Reto de estreno: con qué reto empieza la temporada (episodio 1), o al azar. No aplica al estreno Meet the Queens." }));
  const openingSelect = el("select", {
    onchange: (e) => { formatChoice.openingChallenge = e.target.value; },
  });
  const azarOpt = el("option", { value: "", text: "Al azar" });
  if (!formatChoice.openingChallenge) azarOpt.setAttribute("selected", "selected");
  openingSelect.appendChild(azarOpt);
  window.OPENING_CHALLENGE_IDS.forEach((id) => {
    const challenge = DB.challenges.find((c) => c.id === id);
    if (!challenge) return;
    const opt = el("option", { value: id, text: challenge.label });
    if (formatChoice.openingChallenge === id) opt.setAttribute("selected", "selected");
    openingSelect.appendChild(opt);
  });
  wrap.appendChild(el("label", { class: "form-row", style: "max-width:260px;" }, [el("span", { text: "Reto de estreno" }), openingSelect]));

  // 2b. Opciones/twists (multi-selección, a diferencia de los desplegables de arriba)
  wrap.appendChild(el("h3", { class: "group-title", text: "Opciones" }));
  wrap.appendChild(el("p", { class: "muted small", text: "Puedes activar varias a la vez." }));
  const twistsWrap = el("div", { class: "chip-list" });
  DB.twists.forEach((t) => {
    const checkbox = el("input", { type: "checkbox" });
    checkbox.checked = selectedTwists.has(t.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedTwists.add(t.id); else selectedTwists.delete(t.id);
      formatChoice.twists = [...selectedTwists];
    });
    const labelEl = el("label", { class: "form-row form-row--checkbox", title: t.description }, [checkbox, el("span", { text: t.label })]);
    twistsWrap.appendChild(labelEl);
  });
  wrap.appendChild(twistsWrap);

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

// Elige texto blanco o el oscuro por defecto de .trackrecord-cell según el brillo del
// color de fondo del estado, para que los estados con fondos muy oscuros (p.ej. #00008b,
// #8b0000) sigan siendo legibles.
function readableTextColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "";
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? "#ffffff" : "";
}

function statusCountsForPoints(status) {
  return status.countsForPoints !== undefined ? status.countsForPoints : status.type === "weekly";
}

function shortEpisodeLabel(label) {
  if (label === "Final") return "Final";
  const m = /Episodio (\w+)/.exec(label);
  return m ? "Ep. " + m[1] : label;
}

// Abreviaturas de nombres de reto solo para la fila de retos del trackrecord (el nombre
// completo se mantiene en el resto de la app, p.ej. la pestaña Retos).
const TRACKRECORD_CHALLENGE_ABBR = { "Meet the Queens": "MTQ" };
function shortChallengeLabel(label) {
  return TRACKRECORD_CHALLENGE_ABBR[label] || label;
}

// Texto abreviado de ciertas casillas del trackrecord (el color de cada estado ya las
// distingue; el nombre completo se mantiene en el resto de la app, p.ej. la pestaña Estados).
const TRACKRECORD_CELL_TEXT_OVERRIDES = { WIN_TIE: "WIN", MISS_CONGENIALITY: "MISS CON" };

// Borde de la casilla de trackrecord cuando la concursante lleva inmunidad esa semana
// (twist de Inmunidad), igual que en la tabla de la Temporada 1 del fandom wiki.
const IMMUNITY_BORDER_COLOR = "#FE4EDA";

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

// Convierte un puesto final ("WINNER", "RUNNER_UP", "5º lugar"...) en un número para
// ordenar el trackrecord: siempre 1ª, 2ª, 3ª... de mejor a peor, nunca al azar.
function placementRank(placement) {
  if (placement === "WINNER") return 1;
  if (placement === "RUNNER_UP") return 2;
  const m = /^(\d+)º lugar$/.exec(placement || "");
  return m ? parseInt(m[1], 10) : Infinity;
}

function trackRecordTable(track, shown, result) {
  const sortedRows = [...track.rows].sort((a, b) =>
    placementRank(result.finalPlacements[a.name]) - placementRank(result.finalPlacements[b.name])
  );

  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "stats-table trackrecord-table" });
  // Rank/Concursante/PPE ocupan las 2 filas de encabezado (número de episodio + reto de
  // la semana), centradas verticalmente en medio, al estilo de las tablas de trackrecord
  // de la wiki fandom.
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", { text: "Rank", rowspan: "2", class: "trackrecord-th--span" }));
  headRow.appendChild(el("th", { text: "Concursante", rowspan: "2", class: "trackrecord-th--span" }));
  // El capítulo final (y la reunión, si es su propio capítulo) también son un número de
  // episodio más, así que en vez de literalmente "Final"/"Reunión" arriba, se muestra su
  // número de capítulo real; el nombre del lip sync final (jurado, rondas, por la
  // corona...) se simplifica a "Final" abajo, en la fila del reto.
  track.columns.slice(0, shown).forEach(({ ep }, i) => headRow.appendChild(el("th", {
    text: (ep.label === "Final" || ep.label === "Reunión") ? `Ep. ${i + 1}` : shortEpisodeLabel(ep.label),
  })));
  headRow.appendChild(el("th", { text: "PPE", rowspan: "2", class: "trackrecord-th--span" }));
  thead.appendChild(headRow);

  // Fila con el reto de cada capítulo, justo debajo del número de episodio (al estilo de
  // las tablas de trackrecord de la wiki fandom, del Excel y de otros simuladores).
  const challengeRow = el("tr", { class: "trackrecord-challenge-row" });
  track.columns.slice(0, shown).forEach(({ ep }) => challengeRow.appendChild(el("th", {
    text: ep.label === "Final" ? "Final" : shortChallengeLabel(ep.challenge || ""),
  })));
  thead.appendChild(challengeRow);

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
      // ELIM y RUN siempre en negro, sin importar el brillo del fondo (a pedido: se
      // sacrifica el contraste automático solo para estas casillas).
      const textColor = (cell.status === "ELIM" || cell.status === "RUN") ? "#000000" : (status ? readableTextColor(status.color) : "");
      // WIN_TIE se muestra como "WIN" a secas, y Miss Simpatía abreviada como "MISS CON"
      // (el color de cada una sigue distinguiéndolas del resto).
      const cellText = TRACKRECORD_CELL_TEXT_OVERRIDES[cell.status] || cell.status;
      // Inmunidad (twist activo): borde rosa característico de la tabla de la Temporada 1
      // del fandom wiki, encima del color normal del estado.
      const immuneBorder = cell.immune ? `border:3px solid ${IMMUNITY_BORDER_COLOR};` : "";
      tr.appendChild(el("td", { class: "trackrecord-cell", text: cellText,
        style: status ? `background:${status.color};${textColor ? `color:${textColor};` : ""}${immuneBorder}` : immuneBorder }));
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

  // Regresos/LaLaParUza: no forman su propia columna en la tabla (no reparten estados),
  // así que se anotan aparte. El reto de cada capítulo normal ya sale en la tabla, debajo
  // del número de episodio.
  const cutoff = shown <= 0 ? -1 : (track.columns[shown] ? track.columns[shown].idx : track.indexed.length) - 1;
  result.log.slice(0, cutoff + 1).forEach((ep) => {
    if (ep.results && ep.results.length > 0) return;
    if (!ep.lipsyncNote) return;
    const epBox = el("div", { class: "episode" });
    epBox.appendChild(el("div", { class: "episode__head" }, [el("strong", { text: ep.label })]));
    epBox.appendChild(el("p", { class: "muted small", text: ep.lipsyncNote }));
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

    const seasonHeadRow = el("div", { class: "toolbar", style: "justify-content:space-between; margin-top:0.6rem;" }, [
      el("h4", { class: "season-title", text: activeSeason.seasonName }),
      el("button", { class: "btn btn--accent", text: "▶ Simular esta temporada",
        title: "Precarga a estas concursantes (y las reglas propias de esta temporada, si tiene) en la pestaña Simular.",
        onclick: () => simulateSeasonPreset(activeSeason) }),
    ]);
    details.appendChild(seasonHeadRow);
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

// "Simular esta temporada" (Roster): precarga a las concursantes de esa temporada en la
// pestaña Simular, junto con las reglas propias de la temporada si las tiene (p.ej. la
// Inmunidad de la Temporada 1), al estilo de "Predefined Casts" de esopare.github.io /
// myrainboww.github.io. No cambia Estreno/Regreso/Temporada/Final: solo el reparto y las
// opciones/twists.
function simulateSeasonPreset(season) {
  simSelection = new Set(season.contestants.map((c) => c.name));
  selectedTwists = new Set((season.preset && season.preset.twists) || []);
  formatChoice.twists = [...selectedTwists];
  currentTab = "simulate";
  render();
  window.scrollTo(0, 0);
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
