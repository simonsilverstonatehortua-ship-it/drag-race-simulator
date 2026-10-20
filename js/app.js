let DB = window.RulesStore.loadDB();

const TABS = ["simulate", "challenges", "formats", "roster"];
let currentTab = "simulate";
let simSelection = new Set();
let seasonPlayer = null;
let relationshipSetup = null;
let rosterSeasonTab = {};
let rosterDrawerOpen = {};

const GROUP_LABELS = {
  premiere: "Estreno",
  return: "Regreso",
  season: "Temporada",
  finale: "Final",
};

// Foto por defecto para concursantes personalizadas que no tienen una foto propia puesta.
const NO_IMAGE_URL = "https://myrainboww.github.io/Drag-Race-Simulator/image/queens/noimage.jpg";

// Una misma concursante real puede aparecer en varias temporadas (p.ej. Shangela en su
// temporada numerada y en All Stars): solo UNA de esas entradas en ALL_CONTESTANTS lleva
// foto/stats/ficha (las demás solo llevan name+finalPlacement), así que buscamos la
// entrada por nombre que sí tenga el dato en vez de quedarnos con la primera que aparezca.
//
// Muy rara vez dos personas reales distintas comparten nombre de drag (p.ej. "Moon" en
// Drag Race France y en La Más Draga): en ese caso hay MÁS de una entrada con foto/stats
// propias para el mismo nombre. Si se conoce la temporada de origen (seasonId), se prioriza
// la entrada de esa temporada exacta; si no, se cae a la primera que se encuentre (mismo
// comportamiento de siempre para el 99% de los casos sin colisión de nombre).
function contestantImage(name, seasonId) {
  const matches = window.ALL_CONTESTANTS.filter((c) => c.name === name && c.image);
  const real = (seasonId && matches.find((c) => c.seasonId === seasonId)) || matches[0];
  if (real) return real.image;
  const custom = DB.customContestants.find((c) => c.name === name);
  if (custom) return custom.image || NO_IMAGE_URL;
  return null;
}

// Stats de una concursante: si el usuario editó las de una concursante real, esa
// personalización (guardada en DB.contestantOverrides) gana sobre las de fábrica.
function contestantStats(name, seasonId) {
  if (DB.contestantOverrides[name]) return DB.contestantOverrides[name];
  const matches = window.ALL_CONTESTANTS.filter((c) => c.name === name && c.stats);
  const real = (seasonId && matches.find((c) => c.seasonId === seasonId)) || matches[0];
  if (real) return real.stats;
  const custom = DB.customContestants.find((c) => c.name === name);
  if (custom && custom.stats) return custom.stats;
  return null;
}

// Para buscadores/selectores: una fila por reina real, aunque su nombre aparezca varias
// veces en window.ALL_CONTESTANTS (una vez por temporada en la que compitió). No se debe
// poder buscarla y ver "Alexis Mateo" repetida 3 veces solo porque estuvo en 3 temporadas.
// Excepción: cuando el mismo nombre tiene MÁS de una ficha completa (foto/stats propias),
// es una colisión real entre dos personas distintas (p.ej. las dos "Moon"), así que se
// mantiene una fila por cada una (mismo nombre, pero cada una con su propia foto y stats).
function uniqueRealContestants() {
  const fullRecordsByName = {};
  window.ALL_CONTESTANTS.forEach((c) => {
    if (!c.image) return;
    (fullRecordsByName[c.name] = fullRecordsByName[c.name] || []).push(c);
  });

  const seen = new Set();
  const result = [];
  window.ALL_CONTESTANTS.forEach((c) => {
    const collisions = fullRecordsByName[c.name];
    if (collisions && collisions.length > 1) {
      if (!c.image) return; // stub de una concursante con nombre colisionado: se ignora, ya se listan sus fichas completas
      result.push(c);
      return;
    }
    if (seen.has(c.name)) return;
    seen.add(c.name);
    result.push(c);
  });
  return result;
}

function avatarImg(name, sizeClass, seasonId) {
  const src = contestantImage(name, seasonId);
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
  if (seasonPlayer) return renderSeasonScreen();
  if (relationshipSetup) return renderRelationshipSetup();
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
  const allPool = [...uniqueRealContestants(), ...DB.customContestants];
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
      const avatar = avatarImg(c.name, "avatar--result", c.seasonId);
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
  // Aviso: con Estreno normal + Regular + Top 2 + sin regresos ni opciones, la temporada se
  // juega con la copia del simulador de referencia (js/refsim.js).
  const refNote = el("p", { class: "muted small" });
  const updateRefNote = () => {
    refNote.textContent = window.RefSim && window.RefSim.canRun(formatChoice)
      ? "✓ Este formato usa la copia del simulador de referencia (myrainboww + esopare): mini retos, equipos, Untucked, relaciones, reunión y final paso a paso."
      : "Este formato todavía usa el motor propio; la copia del simulador de referencia está hecha solo para: estreno normal + temporada regular + final Top 2 o Top 3 + sin regresos ni opciones.";
  };
  const formatGrid = el("div", { class: "grid grid--formats" });
  Object.entries(GROUP_LABELS).forEach(([group, label]) => {
    const options = DB.formats.filter((f) => f.group === group);
    const select = el("select", {
      onchange: (e) => { formatChoice[group] = e.target.value; updateRefNote(); },
    });
    options.forEach((f) => {
      const opt = el("option", { value: f.id, text: f.label });
      if (f.id === formatChoice[group]) opt.setAttribute("selected", "selected");
      select.appendChild(opt);
    });
    formatGrid.appendChild(el("label", { class: "form-row" }, [el("span", { text: label }), select]));
  });
  wrap.appendChild(formatGrid);
  wrap.appendChild(refNote);
  updateRefNote();

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
      updateRefNote();
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
    el("button", { class: "btn btn--accent", text: "▶ Simular temporada", onclick: startRelationshipSetup }),
  ]));

  return wrap;
}

function buildStatsByName() {
  const map = {};
  window.ALL_CONTESTANTS.forEach((c) => { if (c.stats) map[c.name] = c.stats; });
  DB.customContestants.forEach((c) => { if (c.stats) map[c.name] = c.stats; });
  Object.entries(DB.contestantOverrides).forEach(([name, stats]) => { map[name] = stats; });
  return map;
}

// Paso previo a la temporada: "Conoce a las concursantes", donde se eligen las relaciones
// entre ellas o se dejan al azar. Empiezan ya generadas al azar (según la Estrategia de cada
// una), así que continuar sin tocar nada funciona como antes.
function startRelationshipSetup() {
  const names = [...simSelection];
  if (names.length < 3) return alert("Selecciona al menos 3 concursantes.");
  relationshipSetup = {
    names,
    relationships: window.SimEngine.generateRelationships(names, buildStatsByName()),
    selected: names[0],
  };
  render();
  window.scrollTo(0, 0);
}

function runSimulation() {
  const { names, relationships } = relationshipSetup;
  relationshipSetup = null;
  if (window.RefSim && window.RefSim.canRun(formatChoice)) {
    // Estreno normal + regular + Top 2 + sin regresos: copia del simulador de referencia
    // (js/refsim.js), con sus propias pantallas.
    const result = window.RefSim.simulate(names, formatChoice, buildStatsByName(), relationships);
    seasonPlayer = {
      result,
      screens: result.screens.map((s) => ({ title: s.title, button: s.button, body: () => renderRefBlocks(s.blocks) })),
      index: 0,
    };
  } else {
    const result = window.SimEngine.simulateSeason(names, formatChoice, DB, buildStatsByName(), relationships);
    seasonPlayer = { result, screens: buildSeasonScreens(result), index: 0 };
  }
  render();
  window.scrollTo(0, 0);
}

function renderRelationshipSetup() {
  const setup = relationshipSetup;
  const levels = window.SimEngine.RELATIONSHIP_LEVELS;
  const others = setup.names.filter((n) => n !== setup.selected);
  // Volver a pintar sin saltar al principio de la página (hay muchos botones que tocar).
  const refresh = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

  const wrap = el("div", { class: "section season-screen" });
  wrap.appendChild(el("h2", { class: "season-screen__title", text: "¡Conoce a las concursantes!" }));
  wrap.appendChild(el("p", { class: "muted", text: "Elige qué opina cada concursante de las demás, o déjalo al azar. Las relaciones influyen en Untucked (pelas, alianzas y enemistades), en los equipos de los retos, en a quién votan para irse a casa, en quién gana Miss Simpatía y en a quién reta la asesina de lip sync." }));

  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start;" }, [
    el("button", { class: "btn btn--ghost", text: "🎲 Randomizar todo", onclick: () => {
      setup.relationships = window.SimEngine.generateRelationships(setup.names, buildStatsByName());
      refresh();
    } }),
    el("button", { class: "btn btn--ghost", text: "Reiniciar todo (normal)", onclick: () => {
      setup.names.forEach((a) => setup.names.forEach((b) => { if (a !== b) setup.relationships[a][b] = "normal"; }));
      refresh();
    } }),
  ]));

  // Selector de concursante: se editan sus opiniones sobre todas las demás.
  const picker = el("div", { class: "season-names" });
  setup.names.forEach((name) => {
    const chip = el("button", { type: "button", class: "season-name season-name--btn" + (name === setup.selected ? " season-name--active" : ""),
      onclick: () => { setup.selected = name; refresh(); } });
    const avatar = avatarImg(name, "avatar--result");
    if (avatar) chip.appendChild(avatar);
    chip.appendChild(el("span", { text: name }));
    picker.appendChild(chip);
  });
  wrap.appendChild(picker);

  wrap.appendChild(el("h3", { class: "group-title", text: `Qué opina ${setup.selected} de las demás` }));
  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start;" }, [
    el("button", { class: "btn btn--ghost", text: `🎲 Solo ${setup.selected} al azar`, onclick: () => {
      const generated = window.SimEngine.generateRelationships(setup.names, buildStatsByName());
      setup.relationships[setup.selected] = generated[setup.selected];
      refresh();
    } }),
  ]));

  others.forEach((other) => {
    const row = el("div", { class: "rel-row" });
    const who = el("span", { class: "rel-row__name" });
    const avatar = avatarImg(other, "avatar--result");
    if (avatar) who.appendChild(avatar);
    who.appendChild(el("span", { text: other }));
    row.appendChild(who);
    const options = el("div", { class: "rel-options" });
    levels.forEach((level) => {
      const style = RELATIONSHIP_STYLE[level];
      const active = setup.relationships[setup.selected][other] === level;
      options.appendChild(el("button", {
        type: "button",
        class: "rel-btn" + (active ? " rel-btn--active" : ""),
        title: level,
        style: active ? `background:${style.color};border-color:${style.color};` : "",
        text: style.symbol,
        onclick: () => { setup.relationships[setup.selected][other] = level; refresh(); },
      }));
    });
    row.appendChild(options);
    wrap.appendChild(row);
  });

  wrap.appendChild(el("p", { class: "muted small", text: "++ le cae muy bien · + le cae bien · • normal · − le cae mal · −− le cae muy mal" }));

  const overview = el("details", { class: "rel-overview" });
  overview.appendChild(el("summary", { text: "Ver la tabla completa de relaciones" }));
  overview.appendChild(relationshipsTable(setup.names, setup.relationships));
  wrap.appendChild(overview);

  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:1.2rem;" }, [
    el("button", { class: "btn btn--accent", text: "▶ Empezar la temporada", onclick: runSimulation }),
    el("button", { class: "btn btn--ghost", text: "Volver", onclick: () => { relationshipSetup = null; render(); window.scrollTo(0, 0); } }),
  ]));
  return wrap;
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

// ---------- REPRODUCTOR DE TEMPORADA (capítulo a capítulo) ----------
// Al simular, la temporada ya viene calculada entera (result.log). Aquí solo se presenta
// pantalla a pantalla, como los simuladores de referencia: cada pantalla sustituye a la
// anterior y se avanza con un botón. Cada capítulo recorre: reto → jurado → (lip sync →
// decisión) → track record con PPE hasta ese momento.

const TIER_LABELS = {
  great: "Actuación genial",
  good: "Buena actuación",
  ok: "Actuación correcta",
  bad: "Mala actuación",
  flop: "Un desastre (flop)",
  skip: "Pasan directas (ganaron su mini reto)",
};
const LIPSYNC_STATUSES = ["BTM", "BTM_MULTI", "ELIM", "ELIM_MULTI"];

// Nivel de actuación de cada reina en una parte del episodio (el reto o la pasarela), según
// su puntuación en esa parte frente a las demás: el 20% mejor es "genial", el siguiente 25%
// "buena", otro 25% "correcta", el siguiente 20% "mala" y el 10% peor "desastre". Las
// empatadas comparten nivel. Devuelve { nombre: nivel } solo para quienes tienen esa
// puntuación (en Porkchop, por ejemplo, no todas compiten en el reto principal).
function tiersByScore(results, field) {
  const scored = results.filter((r) => r[field] != null).sort((a, b) => b[field] - a[field]);
  const tiers = {};
  let groupStart = 0;
  scored.forEach((r, i) => {
    if (i > 0 && r[field] !== scored[i - 1][field]) groupStart = i;
    const p = groupStart / scored.length;
    tiers[r.name] = p < 0.2 ? "great" : p < 0.45 ? "good" : p < 0.7 ? "ok" : p < 0.9 ? "bad" : "flop";
  });
  return tiers;
}

// Una parte del episodio (reto o pasarela) en pantalla: las reinas agrupadas por nivel.
function performanceBody(intro, results, field) {
  const wrap = el("div", {});
  wrap.appendChild(el("p", { class: "muted", text: intro }));
  const tiers = tiersByScore(results, field);
  ["great", "good", "ok", "bad", "flop"].forEach((tier) => {
    const names = results.filter((r) => tiers[r.name] === tier).map((r) => r.name);
    if (names.length) wrap.appendChild(seasonRow(TIER_LABELS[tier], names));
  });
  const skipped = results.filter((r) => r.score == null).map((r) => r.name);
  if (field !== "runwayScore" && skipped.length) wrap.appendChild(seasonRow(TIER_LABELS.skip, skipped));
  return wrap;
}

function joinNames(names) {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return names.join(" y ");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function seasonNames(names) {
  const row = el("div", { class: "season-names" });
  names.forEach((name) => {
    const chip = el("span", { class: "season-name" });
    const avatar = avatarImg(name, "avatar--result");
    if (avatar) chip.appendChild(avatar);
    chip.appendChild(el("span", { text: name }));
    row.appendChild(chip);
  });
  return row;
}

function seasonRow(label, names) {
  return el("div", { class: "season-row" }, [
    el("div", { class: "season-row__label", text: label }),
    seasonNames(names),
  ]);
}

// Avisos del motor (formatos que aún no están implementados). Solo hay pantalla de aviso
// si hay algo que avisar; las relaciones ya se eligieron antes de empezar.
function introScreen(result) {
  return {
    title: "Antes de empezar",
    button: "Empezar la temporada",
    body: () => {
      const notesBox = el("div", { class: "notes-box" });
      result.notes.forEach((n) => notesBox.appendChild(el("p", { class: "muted small", text: "⚠ " + n })));
      return notesBox;
    },
  };
}

function hasRunwayPart(ep) {
  return ep.results.some((r) => r.runwayScore != null);
}

// Mini reto previo al reto principal (solo narrativa por ahora: la ganadora no cambia los
// resultados de la semana).
function miniScreen(ep) {
  return {
    title: `${ep.label}: mini reto — ${ep.mini.challenge}`,
    button: "Ir al reto principal",
    body: () => {
      const wrap = performanceBody("Antes del reto principal, las reinas se juegan un mini reto...", ep.mini.results, "score");
      wrap.appendChild(seasonRow("🏆 Ganadora del mini reto", [ep.mini.winner]));
      return wrap;
    },
  };
}

function challengeScreen(ep) {
  const field = ep.results.some((r) => r.challengeScore != null) ? "challengeScore" : "score";
  return {
    title: `${ep.label}: ${ep.challenge}`,
    button: hasRunwayPart(ep) ? "Ir a la pasarela" : "Ir al jurado",
    body: () => performanceBody("Las reinas dan todo en el reto de hoy...", ep.results, field),
  };
}

function runwayScreen(ep) {
  return {
    title: `${ep.label}: la pasarela`,
    button: "Ir al jurado",
    body: () => performanceBody("Y ahora, la pasarela de la semana...", ep.results, "runwayScore"),
  };
}

function judgingScreen(ep, button) {
  return {
    title: "Las jueces han decidido",
    button,
    body: () => {
      const by = (...ids) => ep.results.filter((r) => ids.includes(r.status)).map((r) => r.name);
      const wrap = el("div", {});
      wrap.appendChild(el("p", { class: "muted small", text: hasRunwayPart(ep)
        ? "Resultado de la semana: 70% reto + 30% pasarela."
        : "En este reto no hay pasarela aparte: el resultado sale solo del reto." }));
      const rows = [
        ["Ganadora del reto", by("WIN", "WIN_TIE")],
        ["Top 2", by("TOP2")],
        ["Tops del reto", by("HIGH", "HIGH_GROUP")],
        ["A salvo", by("SAFE")],
        ["En el bottom, a salvo de la eliminación", by("LOW")],
        ["Al lip sync por su vida", by(...LIPSYNC_STATUSES)],
      ];
      rows.forEach(([label, names]) => { if (names.length) wrap.appendChild(seasonRow(label, names)); });
      return wrap;
    },
  };
}

function lipsyncScreen(group) {
  return {
    title: "Lip sync por la vida",
    button: "Mostrar resultado",
    body: () => {
      const wrap = el("div", {});
      wrap.appendChild(el("p", { class: "muted", text: "Ha llegado la hora... de hacer lip sync por vuestras vidas. ¡Buena suerte!" }));
      wrap.appendChild(seasonNames(group.map((r) => r.name)));
      return wrap;
    },
  };
}

function decisionScreen(ep, group) {
  return {
    title: group.length ? "La decisión" : "Un momento especial",
    button: "Ver el track record",
    body: () => {
      const wrap = el("div", {});
      const eliminated = group.filter((r) => r.status === "ELIM" || r.status === "ELIM_MULTI").map((r) => r.name);
      const stays = group.filter((r) => r.status === "BTM").map((r) => r.name);
      const doubleShantay = group.filter((r) => r.status === "BTM_MULTI").map((r) => r.name);
      if (doubleShantay.length) wrap.appendChild(el("p", { class: "season-line", text: `${joinNames(doubleShantay)}: doble shantay, nadie se va a casa esta semana.` }));
      if (stays.length) wrap.appendChild(el("p", { class: "season-line", text: `${joinNames(stays)}, shantay, ${stays.length > 1 ? "os quedáis" : "te quedas"}.` }));
      if (eliminated.length) wrap.appendChild(el("p", { class: "season-line season-line--out", text: `${joinNames(eliminated)}, sashay away...` }));
      if (ep.lipsyncNote) wrap.appendChild(el("p", { class: "muted small", text: ep.lipsyncNote }));
      return wrap;
    },
  };
}

function trackRecordScreen(ep, track, result, shownColumns) {
  return {
    title: `Track record · ${ep.label}`,
    button: "Continuar",
    body: () => trackRecordTable(track, shownColumns, result),
  };
}

function noteScreen(ep) {
  return {
    title: ep.label,
    button: "Continuar",
    body: () => el("p", { text: ep.lipsyncNote }),
  };
}

function finalPerformanceScreen(ep) {
  return {
    title: `${ep.label}: ${ep.challenge}`,
    button: "Ver la decisión",
    body: () => {
      const wrap = el("div", {});
      wrap.appendChild(el("p", { class: "muted", text: "Las finalistas dan su última actuación..." }));
      const tiers = ["great", "good", "ok", "bad"];
      const groups = {};
      ep.results.filter((r) => r.score != null).forEach((r, i) => {
        const tier = tiers[Math.min(i, tiers.length - 1)];
        (groups[tier] = groups[tier] || []).push(r.name);
      });
      tiers.forEach((tier) => { if (groups[tier]) wrap.appendChild(seasonRow(TIER_LABELS[tier], groups[tier])); });
      const guests = ep.results.filter((r) => r.status === "GUEST" || r.status === "MISS_CONGENIALITY").map((r) => r.name);
      if (guests.length) wrap.appendChild(seasonRow("Las eliminadas vuelven como invitadas", guests));
      return wrap;
    },
  };
}

function finalDecisionScreen(ep) {
  return {
    title: "La corona",
    button: "Ver la clasificación final",
    body: () => el("p", { text: ep.lipsyncNote }),
  };
}

function finalClassificationScreen(result, track) {
  return {
    title: `¡${result.winnerName} es la ganadora!`,
    button: "Volver a simular",
    body: () => {
      const wrap = el("div", {});
      wrap.appendChild(el("h3", { class: "group-title", text: "Track record completo" }));
      wrap.appendChild(trackRecordTable(track, track.columns.length, result));
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
    },
  };
}

function buildSeasonScreens(result) {
  const track = buildTrackRecord(result);
  const columnOfLogIndex = new Map(track.columns.map((c, i) => [c.idx, i]));
  const screens = result.notes.length ? [introScreen(result)] : [];

  result.log.forEach((ep, idx) => {
    const hasResults = ep.results && ep.results.length > 0;
    if (!hasResults) { if (ep.lipsyncNote) screens.push(noteScreen(ep)); return; }
    if (ep.label === "Reunión") { screens.push(noteScreen({ label: "La reunión", lipsyncNote: ep.lipsyncNote })); return; }
    if (ep.label === "Final") { screens.push(finalPerformanceScreen(ep), finalDecisionScreen(ep)); return; }

    const group = ep.results.filter((r) => LIPSYNC_STATUSES.includes(r.status));
    const hasLipsync = group.length >= 2;
    const hasDecision = group.length > 0 || !!ep.lipsyncNote;
    if (ep.mini) screens.push(miniScreen(ep));
    screens.push(challengeScreen(ep));
    if (hasRunwayPart(ep)) screens.push(runwayScreen(ep));
    screens.push(judgingScreen(ep, hasLipsync ? "Lip sync por la vida" : (hasDecision ? "Continuar" : "Ver el track record")));
    if (hasLipsync) screens.push(lipsyncScreen(group));
    if (hasDecision) screens.push(decisionScreen(ep, group));
    screens.push(trackRecordScreen(ep, track, result, columnOfLogIndex.get(idx) + 1));
  });

  screens.push(finalClassificationScreen(result, track));
  return screens;
}

// ---------- Pantallas del simulador "estilo myrainboww" (js/refsim.js) ----------
// refsim.js devuelve cada pantalla como una lista de bloques (texto, filas de reinas, tabla de
// track record...); aquí se pintan.
function refQueensRow(block) {
  const row = el("div", { class: "ref-row" });
  const pics = el("div", { class: "ref-row__pics" });
  (block.names || []).forEach((n) => {
    const img = avatarImg(n, "avatar--ref");
    if (!img) return;
    if (block.color) img.style.borderColor = block.color;
    pics.appendChild(img);
  });
  if (pics.childNodes.length) row.appendChild(pics);
  if (block.text) row.appendChild(el("div", { class: "ref-row__text", text: block.text }));
  return row;
}

function refTextWithBreaks(node, text) {
  String(text).split("\n").forEach((line, i) => {
    if (i) node.appendChild(document.createElement("br"));
    node.appendChild(document.createTextNode(line));
  });
}

function refTrackRecord(block) {
  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "stats-table trackrecord-table" });
  const thead = el("thead");
  const head = el("tr");
  ["Rank", "Concursante", "Foto"].forEach((t) => head.appendChild(el("th", { text: t, rowspan: "2", class: "trackrecord-th--span" })));
  block.columns.forEach((_, i) => head.appendChild(el("th", { text: `Ep. ${i + 1}` })));
  head.appendChild(el("th", { text: "PPE", rowspan: "2", class: "trackrecord-th--span" }));
  thead.appendChild(head);
  const challengeRow = el("tr", { class: "trackrecord-challenge-row" });
  block.columns.forEach((c) => challengeRow.appendChild(el("th", { text: c })));
  thead.appendChild(challengeRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  block.rows.forEach((row) => {
    const tr = el("tr");
    const rank = el("td", { class: "ref-tr-rank" });
    refTextWithBreaks(rank, row.rank);
    tr.appendChild(rank);
    tr.appendChild(el("td", { class: "ref-tr-name", text: row.name }));
    const photo = el("td", { class: "ref-tr-photo" });
    const avatar = avatarImg(row.name, "avatar--tr");
    if (avatar) photo.appendChild(avatar);
    tr.appendChild(photo);
    row.cells.forEach((cell) => {
      let style = "";
      if (cell.bg) style += `background:${cell.bg};`;
      if (cell.fg) style += `color:${cell.fg};`;
      if (cell.bold) style += "font-weight:800;";
      const td = el("td", { class: "trackrecord-cell", style });
      refTextWithBreaks(td, cell.text);
      if (cell.sub) {
        td.appendChild(document.createElement("br"));
        td.appendChild(el("small", { class: "ref-tr-sub", text: cell.sub }));
      }
      tr.appendChild(td);
    });
    tr.appendChild(el("td", { class: "trackrecord-cell", style: "background:lightgray;font-weight:800;", text: row.ppe }));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  const box = el("div", {});
  box.appendChild(tableWrap);
  box.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:0.6rem;" }, [
    el("button", { class: "btn btn--ghost", text: "Descargar track record (PNG)", onclick: (e) => downloadRefTrackRecord(table, e.target) }),
  ]));
  return box;
}

// Descarga la tabla de track record como imagen (como el botón "Download" del simulador de
// referencia). html2canvas se carga solo al pulsar el botón.
function downloadRefTrackRecord(table, button) {
  const load = () => new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => resolve(window.html2canvas);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const original = button.textContent;
  button.textContent = "Generando imagen...";
  load().then((h2c) => h2c(table, { useCORS: true, backgroundColor: "#141019" })).then((canvas) => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "TrackRecord.png";
    a.click();
  }).catch(() => alert("No se pudo generar la imagen del track record."))
    .finally(() => { button.textContent = original; });
}

function refSongCell(song) {
  const k = song.indexOf(" by ");
  const cell = el("td", { class: "ref-song" });
  cell.appendChild(document.createTextNode(k < 0 ? song : song.slice(0, k)));
  if (k >= 0) {
    cell.appendChild(document.createElement("br"));
    cell.appendChild(el("small", { text: song.slice(k + 1).replace(/^by /, "de ") }));
  }
  return cell;
}

function refLipsyncTables(block) {
  const wrap = el("div", {});
  // Todos los lip syncs de la temporada
  const all = el("details", { class: "rel-overview" });
  all.appendChild(el("summary", { text: "Lip syncs de la temporada" }));
  const t1 = el("table", { class: "stats-table ref-lipsync-table" });
  const h1 = el("tr");
  ["#", "Episodio", "Ganadora del lip sync", "Perdedora del lip sync", "Canción"].forEach((t) => h1.appendChild(el("th", { text: t })));
  t1.appendChild(el("thead", {}, [h1]));
  const b1 = el("tbody");
  if (!block.alots.length) {
    b1.appendChild(el("tr", {}, [el("td", { colspan: "5", text: "No hubo lip syncs esta temporada." })]));
  }
  block.alots.forEach((l, i) => {
    b1.appendChild(el("tr", {}, [
      el("td", { text: String(i + 1) }), el("td", { text: String(l.episode) }),
      el("td", { class: "ref-win", text: l.win.join(" & ") }), el("td", { class: "ref-lose", text: l.lose.join(" & ") }),
      refSongCell(l.song),
    ]));
  });
  t1.appendChild(b1);
  all.appendChild(el("div", { class: "table-wrap" }, [t1]));
  wrap.appendChild(all);

  // Los más memorables (los mejores y los peores)
  const mem = el("details", { class: "rel-overview" });
  mem.appendChild(el("summary", { text: "Lip syncs memorables" }));
  const t2 = el("table", { class: "stats-table ref-lipsync-table" });
  const h2 = el("tr");
  ["Episodio", "Lip sync", "Canción"].forEach((t) => h2.appendChild(el("th", { text: t })));
  t2.appendChild(el("thead", {}, [h2]));
  const b2 = el("tbody");
  const blots = block.blots.slice().sort((a, b) => b.score - a.score);
  if (!blots.length) b2.appendChild(el("tr", {}, [el("td", { colspan: "3", text: "No hubo lip syncs memorables esta temporada." })]));
  blots.forEach((l) => {
    const cls = l.score > 5 ? "ref-win" : "ref-lose";
    b2.appendChild(el("tr", {}, [
      el("td", { class: cls, text: String(l.episode) }), el("td", { class: cls, text: l.queens.join(" vs ") }), refSongCell(l.song),
    ]));
  });
  t2.appendChild(b2);
  mem.appendChild(el("div", { class: "table-wrap" }, [t2]));
  wrap.appendChild(mem);
  return wrap;
}

function renderRefBlocks(blocks) {
  const wrap = el("div", { class: "ref-screen" });
  blocks.forEach((b) => {
    if (b.t === "p") wrap.appendChild(el("p", { class: "muted" + (b.cls === "italic" ? " ref-italic" : ""), text: b.text }));
    else if (b.t === "b") wrap.appendChild(el("p", { class: "season-line", text: b.text }));
    else if (b.t === "big") wrap.appendChild(el("h3", { class: "group-title", text: b.text }));
    else if (b.t === "hr") wrap.appendChild(el("hr", { class: "ref-hr" }));
    else if (b.t === "q") wrap.appendChild(refQueensRow(b));
    else if (b.t === "tr") wrap.appendChild(refTrackRecord(b));
    else if (b.t === "lipsyncs") wrap.appendChild(refLipsyncTables(b));
    else if (b.t === "reveal") {
      const d = el("details", { class: "rel-overview" });
      d.appendChild(el("summary", { text: b.label }));
      d.appendChild(renderRefBlocks(b.blocks));
      wrap.appendChild(d);
    }
  });
  return wrap;
}

function exitSeason() {
  seasonPlayer = null;
  render();
  window.scrollTo(0, 0);
}

function renderSeasonScreen() {
  const { screens, index } = seasonPlayer;
  const screen = screens[index];
  const isLast = index === screens.length - 1;
  const go = (to) => { seasonPlayer.index = to; render(); window.scrollTo(0, 0); };

  const wrap = el("div", { class: "section season-screen" });
  wrap.appendChild(el("div", { class: "season-screen__step muted small", text: `Pantalla ${index + 1} de ${screens.length}` }));
  wrap.appendChild(el("h2", { class: "season-screen__title", text: screen.title }));
  wrap.appendChild(screen.body());

  const actions = el("div", { class: "toolbar", style: "justify-content:flex-start; margin-top:1.2rem;" });
  actions.appendChild(el("button", { class: "btn btn--accent", text: screen.button, onclick: isLast ? exitSeason : () => go(index + 1) }));
  if (!isLast) {
    actions.appendChild(el("button", { class: "btn btn--ghost", text: "Saltar al final", onclick: () => go(screens.length - 1) }));
    actions.appendChild(el("button", { class: "btn btn--ghost", text: "Salir", onclick: exitSeason }));
  }
  wrap.appendChild(actions);
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
    // Las temporadas "All Stars" propias de un país (p.ej. Drag Race España: All Stars,
    // dentro de la franquicia "España") son casi enteramente reinas repetidas de las
    // temporadas numeradas de ese mismo país (con ficha completa ahí, no aquí), así que no
    // se cuentan en el total de concursantes para no inflarlo con duplicados. Esto no aplica
    // a las franquicias "All Stars" y "Global All Stars" en sí mismas, que son All Stars por
    // definición.
    const isCountryAllStars = (s) => franchise.name !== "All Stars" && franchise.name !== "Global All Stars" && /All Stars/.test(s.seasonName);
    const totalContestants = franchise.seasons
      .filter((s) => !isCountryAllStars(s))
      .reduce((sum, s) => sum + s.contestants.length, 0);
    const flag = window.FRANCHISE_FLAGS[franchise.name] || "";
    // Si el usuario colapsó manualmente esta franquicia (p.ej. cerró "Estados Unidos" para
    // no tener que hacer scroll mientras mira "All Stars"), respeta eso en el siguiente
    // render: antes esto se ignoraba y la franquicia se reabría sola en cada render (al
    // cambiar de temporada, editar stats, etc.), lo que empujaba todo el contenido de abajo
    // y daba la sensación de "me manda de vuelta a Estados Unidos".
    const isOpen = franchise.name in rosterDrawerOpen ? rosterDrawerOpen[franchise.name] : true;
    const detailsAttrs = { class: "franchise-drawer" };
    if (isOpen) detailsAttrs.open = "open";
    const details = el("details", detailsAttrs);
    details.addEventListener("toggle", () => { rosterDrawerOpen[franchise.name] = details.open; });
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
      const num = season.tabLabel || season.id.replace(/^\D+/, "") || season.seasonName;
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
      const avatar = avatarImg(c.name, "avatar--card", activeSeason.id);
      if (avatar) card.appendChild(avatar);
      card.appendChild(el("strong", { text: c.name }));
      card.appendChild(el("div", { class: "muted small", text: statsSummaryLine(contestantStats(c.name, activeSeason.id)) }));
      if (DB.contestantOverrides[c.name]) card.appendChild(el("span", { class: "badge", text: "stats personalizadas" }));
      card.appendChild(el("div", { class: "card__actions" }, [
        el("button", { class: "btn btn--ghost", text: "Editar stats", onclick: () => openRealStatsForm(c, activeSeason.id) }),
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
  seasonPlayer = null;
  relationshipSetup = null;
  simSelection = new Set(season.contestants.map((c) => c.name));
  selectedTwists = new Set((season.preset && season.preset.twists) || []);
  formatChoice.twists = [...selectedTwists];
  currentTab = "simulate";
  render();
  window.scrollTo(0, 0);
}

// ---------- FRANQUICIAS (inventadas por el usuario) ----------
// Buscador + botón "Al azar" + chips de seleccionadas, igual que en Simular, pero
// autocontenido y parametrizado por callback: cada temporada de una franquicia tiene su
// propio reparto independiente de simSelection.
function contestantPicker(currentNames, onChange) {
  const wrap = el("div", {});
  const selection = new Set(currentNames);
  const allPool = [...uniqueRealContestants(), ...DB.customContestants];

  const addOne = (name) => { selection.add(name); onChange([...selection]); };
  const removeOne = (name) => { selection.delete(name); onChange([...selection]); };
  const addRandomOne = () => {
    const remaining = allPool.filter((c) => !selection.has(c.name));
    if (!remaining.length) return;
    addOne(remaining[Math.floor(Math.random() * remaining.length)].name);
  };

  const searchRow = el("div", { class: "toolbar", style: "justify-content:flex-start;" });
  const searchInput = el("input", { type: "text", class: "name-input", placeholder: "Buscar concursante..." });
  searchRow.appendChild(searchInput);
  searchRow.appendChild(el("button", { class: "btn btn--ghost", type: "button", text: "🎲 Al azar", onclick: addRandomOne }));
  wrap.appendChild(searchRow);

  const resultsWrap = el("div", { class: "search-results" });
  wrap.appendChild(resultsWrap);

  const renderResults = (query) => {
    resultsWrap.innerHTML = "";
    const q = query.trim().toLowerCase();
    if (!q) return;
    const pool = allPool.filter((c) => !selection.has(c.name));
    const matches = pool.filter((c) => c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    if (!matches.length) { resultsWrap.appendChild(el("span", { class: "muted small", text: "Sin resultados." })); return; }
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
    const first = allPool.find((c) => !selection.has(c.name) && c.name.toLowerCase().includes(q));
    if (first) { addOne(first.name); searchInput.value = ""; renderResults(""); }
  });

  const chipsWrap = el("div", { class: "chip-list" });
  if (!selection.size) chipsWrap.appendChild(el("span", { class: "muted small", text: "Ninguna concursante seleccionada todavía." }));
  [...selection].forEach((name) => {
    const chip = el("button", { type: "button", class: "name-chip", title: "Quitar", onclick: () => removeOne(name) });
    const avatar = avatarImg(name, "avatar--result");
    if (avatar) chip.appendChild(avatar);
    chip.appendChild(el("span", { text: name }));
    chip.appendChild(el("span", { class: "name-chip__remove", text: "×" }));
    chipsWrap.appendChild(chip);
  });
  wrap.appendChild(chipsWrap);

  if (selection.size) {
    wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start;" }, [
      el("button", { class: "btn btn--ghost", type: "button", text: "Vaciar selección", onclick: () => onChange([]) }),
    ]));
  }

  return wrap;
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
function openRealStatsForm(contestant, seasonId) {
  const hasOverride = !!DB.contestantOverrides[contestant.name];
  const data = contestantStats(contestant.name, seasonId) || window.randomStats();

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

document.addEventListener("DOMContentLoaded", () => {
  render();
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
});
