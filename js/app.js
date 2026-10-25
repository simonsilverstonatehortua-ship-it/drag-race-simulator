let DB = window.RulesStore.loadDB();

const TABS = ["simulate", "challenges", "formats", "roster"];
let currentTab = "simulate";
let simSelection = new Set();
let simSeasonStats = null; // stats de la temporada precargada con «Simular esta temporada» (las versiones imaginarias solo se usan así)
let randomCount = 12;
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
  document.body.classList.toggle("solid-bg", !!(seasonPlayer && seasonPlayer.solid));
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

  // Añadir de golpe una cantidad elegida de concursantes al azar (se suman a las ya elegidas).
  const remainingCount = allPool.filter((c) => !simSelection.has(c.name)).length;
  const countInput = el("input", { type: "number", class: "name-input", min: "1", max: String(Math.max(1, remainingCount)), value: String(randomCount), style: "width:5.5rem;", "aria-label": "Cantidad de concursantes al azar" });
  countInput.addEventListener("input", () => { randomCount = Math.max(1, Math.floor(Number(countInput.value)) || 1); });
  const addRandomMany = () => {
    const remaining = allPool.filter((c) => !simSelection.has(c.name));
    const n = Math.min(Math.max(1, Math.floor(Number(countInput.value)) || 1), remaining.length);
    for (let i = 0; i < n; i++) {
      const j = Math.floor(Math.random() * remaining.length);
      simSelection.add(remaining.splice(j, 1)[0].name);
    }
    render();
  };
  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start;align-items:center;gap:.5rem;" }, [
    el("span", { class: "muted small", text: "Añadir" }),
    countInput,
    el("span", { class: "muted small", text: "concursantes al azar" }),
    el("button", { class: "btn btn--ghost", text: "🎲 Añadir", onclick: addRandomMany }),
  ]));

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
  let refreshTour = () => {};
  const refNote = el("p", { class: "muted small" });
  const updateRefNote = () => {
    refNote.textContent = window.RefSim && window.RefSim.canRun(formatChoice)
      ? "✓ Este formato usa la copia del simulador de referencia (myrainboww + esopare): mini retos, equipos, Untucked, relaciones, reunión y final paso a paso."
      : "Este formato todavía usa el motor propio. La copia del simulador de referencia cubre todos los estrenos normales y sus variantes (doble, triple, Porkchop, Rate A Queen, UK3, entrada tardía, al azar...), las temporadas Regular, Thailand, por equipos, Lipsync For Your Legacy, Lipsync Assassin, Lipsync for the win, All Winners, Slaysian Royale y Tournament of All Stars, y todas las finales, con regreso «Eligen quién regresa» o sin regresos, y sin opciones extra.";
  };
  // Ajustes del Tournament of All Stars: grupos, episodios por grupo, reinas que pasan y segunda ronda.
  const tourBox = el("div", { class: "section", style: "margin-top:.6rem;" });
  refreshTour = () => {
    tourBox.innerHTML = "";
    if (formatChoice.season !== "SEASON_TOURNAMENT") return;
    let savedColors = [];
    try { savedColors = JSON.parse(localStorage.getItem("tourColors")) || []; } catch (e) { savedColors = []; }
    const t = formatChoice.tournament = formatChoice.tournament || { groups: 3, episodes: 3, passers: 3, second: null, wildcards: 0, merge: "regular", seq: "default", colors: savedColors };
    if (!Array.isArray(t.colors)) t.colors = savedColors;
    const numField = (label, obj, key, min) => {
      const input = el("input", { type: "number", min: String(min), value: String(obj[key]), style: "max-width:90px;" });
      input.addEventListener("change", () => { obj[key] = Math.max(min, parseInt(input.value, 10) || min); input.value = obj[key]; if (key === "groups" && obj === t) refreshTour(); });
      return el("label", { class: "form-row" }, [el("span", { text: label }), input]);
    };
    tourBox.appendChild(el("h4", { text: "Ajustes del torneo" }));
    tourBox.appendChild(el("p", { class: "muted small", text: "Primera ronda: el reparto se divide al azar en grupos; cada grupo juega sus episodios y pasan las que más puntos MVQ tengan. Las que pasan siguen en la temporada regular (o en una segunda ronda de grupos si la activas)." }));
    const row = el("div", { class: "grid grid--formats" });
    row.appendChild(numField("Número de grupos", t, "groups", 2));
    row.appendChild(numField("Episodios por grupo", t, "episodes", 1));
    row.appendChild(numField("Pasan por grupo", t, "passers", 1));
    tourBox.appendChild(row);
    const second = el("input", { type: "checkbox" });
    second.checked = !!t.second;
    second.addEventListener("change", () => { t.second = second.checked ? { groups: 2, episodes: 3, passers: 2 } : null; refreshTour(); });
    tourBox.appendChild(el("label", { class: "form-row form-row--checkbox" }, [second, el("span", { text: "Segunda ronda de grupos" })]));
    if (t.second) {
      const row2 = el("div", { class: "grid grid--formats" });
      row2.appendChild(numField("Grupos (2ª ronda)", t.second, "groups", 2));
      row2.appendChild(numField("Episodios por grupo (2ª ronda)", t.second, "episodes", 1));
      row2.appendChild(numField("Pasan por grupo (2ª ronda)", t.second, "passers", 1));
      tourBox.appendChild(row2);
    }
    // comodín y formato tras la ronda de grupos
    const row3 = el("div", { class: "grid grid--formats" });
    row3.appendChild(numField("Comodines que vuelven (0 = ninguno)", t, "wildcards", 0));
    const mergeSel = el("select", { onchange: (e) => { t.merge = e.target.value; } });
    (window.RefSim.mergeFormats || []).map((m) => [m.id, m.label]).forEach(([v, label]) => {
      const o = el("option", { value: v, text: label });
      if (t.merge === v) o.setAttribute("selected", "selected");
      mergeSel.appendChild(o);
    });
    row3.appendChild(el("label", { class: "form-row" }, [el("span", { text: "Formato tras la ronda de grupos (merge)" }), mergeSel]));
    tourBox.appendChild(row3);
    tourBox.appendChild(el("button", { type: "button", class: "btn btn--ghost", text: "Cargar los ajustes de la temporada 11", onclick: () => {
      formatChoice.tournament = { groups: 3, episodes: 3, passers: 2, second: null, wildcards: 1, merge: "raq", seq: "s11", colors: t.colors };
      refreshTour();
    } }));
    // colores de los grupos (el nombre de cada reina se pinta con el de su grupo en el track record)
    tourBox.appendChild(el("p", { class: "muted small", text: "Colores de los grupos:" }));
    const colorRow = el("div", { class: "chip-list" });
    for (let i = 0; i < t.groups; i++) {
      const fallback = ["#ffd1dc", "#c1e1c1", "#bde0fe", "#fde68a", "#e9d5ff", "#fecaca", "#bfdbfe", "#d9f99d"][i % 8];
      t.colors[i] = t.colors[i] || fallback;
      const picker = el("input", { type: "color", value: t.colors[i] });
      picker.addEventListener("input", () => {
        t.colors[i] = picker.value;
        try { localStorage.setItem("tourColors", JSON.stringify(t.colors)); } catch (e) { /* sin almacenamiento */ }
      });
      colorRow.appendChild(el("label", { class: "form-row form-row--checkbox" }, [picker, el("span", { text: `Grupo ${i + 1}` })]));
    }
    tourBox.appendChild(colorRow);
  };
  const formatGrid = el("div", { class: "grid grid--formats" });
  Object.entries(GROUP_LABELS).forEach(([group, label]) => {
    const options = DB.formats.filter((f) => f.group === group);
    const select = el("select", {
      onchange: (e) => { formatChoice[group] = e.target.value; updateRefNote(); refreshTour(); },
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
  wrap.appendChild(tourBox);
  refreshTour();
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

  // Número de capítulos de la temporada (opcional): si se pide uno distinto del normal, se añaden dobles shantay (más capítulos)
  // o dobles sashay (menos). Sin rellenar no cambia nada.
  const epInfo = window.RefSim && window.RefSim.episodeInfo ? window.RefSim.episodeInfo(formatChoice, simSelection.size) : null;
  if (epInfo) {
    const epInput = el("input", { type: "number", class: "name-input", min: String(epInfo.min), max: String(epInfo.max), placeholder: `Normal: ${epInfo.normal}`, style: "width:8rem;" });
    if (formatChoice.episodes) epInput.value = String(formatChoice.episodes);
    epInput.addEventListener("input", () => {
      const v = Math.floor(Number(epInput.value));
      formatChoice.episodes = v >= epInfo.min && v <= epInfo.max ? v : 0;
    });
    wrap.appendChild(el("label", { class: "form-row", style: "max-width:420px;" }, [
      el("span", { text: `Capítulos de la temporada, con la final (opcional: de ${epInfo.min} a ${epInfo.max}; normal ${epInfo.normal})` }),
      epInput,
    ]));
    wrap.appendChild(el("p", { class: "muted small", text: "Con más capítulos de los normales habrá dobles shantay; con menos, dobles sashay. Déjalo vacío para que todo funcione como siempre." }));
  } else formatChoice.episodes = 0;

  // 2b. Opciones/twists: un panel desplegable con un desplegable por grupo (como en los simuladores de referencia)
  const twistsPanel = el("details", { class: "twist-panel" });
  const twistsTitle = el("summary", { class: "twist-panel__title" });
  twistsPanel.appendChild(twistsTitle);
  const updateTwistsTitle = () => { twistsTitle.textContent = `Opciones y twists${selectedTwists.size ? ` (${selectedTwists.size} activadas)` : ""}`; };
  updateTwistsTitle();
  if (selectedTwists.size) twistsPanel.setAttribute("open", "open");
  const twistsGrid = el("div", { class: "twist-grid" });
  const sections = [];
  DB.twists.forEach((t) => {
    const name = t.section || "Otras";
    let sec = sections.find((x) => x.name === name);
    if (!sec) { sec = { name, items: [] }; sections.push(sec); }
    sec.items.push(t);
  });
  sections.forEach((sec) => {
    const box = el("details", { class: "twist-group" });
    const sum = el("summary", { class: "twist-group__title" });
    box.appendChild(sum);
    const updateSum = () => {
      const n = sec.items.filter((t) => selectedTwists.has(t.id)).length;
      sum.textContent = `${sec.name}${n ? ` (${n})` : ""}`;
      if (n) sum.classList.add("twist-group__title--on"); else sum.classList.remove("twist-group__title--on");
    };
    updateSum();
    if (sec.items.some((t) => selectedTwists.has(t.id))) box.setAttribute("open", "open");
    sec.items.forEach((t) => {
      const checkbox = el("input", { type: "checkbox" });
      checkbox.checked = selectedTwists.has(t.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedTwists.add(t.id); else selectedTwists.delete(t.id);
        formatChoice.twists = [...selectedTwists];
        updateSum(); updateTwistsTitle();
        updateRefNote();
      });
      box.appendChild(el("label", { class: "twist-item", title: t.description }, [checkbox, el("span", { text: t.label })]));
    });
    twistsGrid.appendChild(box);
  });
  twistsPanel.appendChild(twistsGrid);
  wrap.appendChild(twistsPanel);

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
      el("button", { class: "btn btn--ghost", text: "Vaciar selección", onclick: () => { simSelection = new Set(); simSeasonStats = null; render(); } }),
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
  const imaginary = new Set(window.ALL_SEASONS.filter((s) => s.imaginary).map((s) => s.id));
  window.ALL_CONTESTANTS.forEach((c) => { if (c.stats && !imaginary.has(c.seasonId)) map[c.name] = c.stats; });
  if (simSeasonStats) Object.entries(simSeasonStats).forEach(([name, stats]) => { map[name] = stats; }); // temporada precargada (p.ej. una versión imaginaria)
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
  const { names, relationships, groups, returnPick, claims, chocolatePick, badonkaLevers } = relationshipSetup;
  relationshipSetup = null;
  if (window.RefSim && window.RefSim.canRun(formatChoice)) {
    // Estreno normal + regular + Top 2 + sin regresos: copia del simulador de referencia
    // (js/refsim.js), con sus propias pantallas.
    const extra = { claims: claims || {}, chocolatePick: chocolatePick || "", badonkaLevers: (badonkaLevers || []).filter(Boolean) };
    const result = window.RefSim.simulate(names, Object.assign({}, formatChoice, { groupAssign: groups || {}, returnPick: returnPick || [] }, extra), buildStatsByName(), relationships);
    seasonPlayer = {
      result,
      screens: result.screens.map((s) => ({ title: s.title, button: s.button, body: () => renderRefBlocks(s.blocks) })),
      solid: (formatChoice.twists || []).includes("SOLID_BACKGROUND"),
      index: 0,
    };
  } else {
    const result = window.SimEngine.simulateSeason(names, formatChoice, DB, buildStatsByName(), relationships);
    seasonPlayer = { result, screens: buildSeasonScreens(result), index: 0 };
  }
  render();
  window.scrollTo(0, 0);
}

// Panel para decidir qué reinas van en cada grupo (estrenos, grupos del torneo, parejas...). Las que se dejan "Al azar"
// se reparten donde quede sitio.
function groupAssignPanel(setup, plan, refresh) {
  const groups = setup.groups = setup.groups || {};
  const box = el("div", { class: "rel-overview", style: "padding:.8rem 1rem;margin:1rem 0;" });
  box.appendChild(el("h3", { class: "group-title", text: "Grupos" }));
  box.appendChild(el("p", { class: "muted small", text: "Elige en qué grupo juega cada concursante, o déjalo al azar: las que dejes sin elegir se reparten donde quede sitio." }));
  const counts = plan.map(() => 0);
  setup.names.forEach((n) => { const g = groups[n]; if (g >= 1 && g <= plan.length) counts[g - 1]++; });
  const summary = el("div", { class: "toolbar", style: "justify-content:flex-start;flex-wrap:wrap;" });
  plan.forEach((p, i) => {
    const over = counts[i] > p.size;
    summary.appendChild(el("span", { class: "season-name", style: over ? "border-color:#c0392b;color:#c0392b;" : "", text: `${p.title}: ${counts[i]}/${p.size}` }));
  });
  box.appendChild(summary);
  const grid = el("div", { class: "season-names" });
  setup.names.forEach((name) => {
    const row = el("label", { class: "season-name", style: "gap:.4rem;" });
    const avatar = avatarImg(name, "avatar--result");
    if (avatar) row.appendChild(avatar);
    row.appendChild(el("span", { text: name }));
    const sel = el("select", { onchange: (e) => { const v = Number(e.target.value); if (v) groups[name] = v; else delete groups[name]; refresh(); } });
    sel.appendChild(el("option", { value: "0", text: "Al azar" }));
    plan.forEach((p, i) => {
      const o = el("option", { value: String(i + 1), text: p.title });
      if (groups[name] === i + 1) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    });
    row.appendChild(sel);
    grid.appendChild(row);
  });
  box.appendChild(grid);
  box.appendChild(el("button", { type: "button", class: "btn btn--ghost", text: "🎲 Todo al azar", onclick: () => { setup.groups = {}; refresh(); } }));
  return box;
}

function renderRelationshipSetup() {
  const setup = relationshipSetup;
  const levels = window.SimEngine.RELATIONSHIP_LEVELS;
  const others = setup.names.filter((n) => n !== setup.selected);
  // Volver a pintar sin saltar al principio de la página (hay muchos botones que tocar).
  const refresh = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

  const wrap = el("div", { class: "section season-screen" });
  wrap.appendChild(el("h2", { class: "season-screen__title", text: "¡Conoce a las concursantes!" }));
  wrap.appendChild(el("p", { class: "muted", text: "Elige cómo se lleva cada concursante con las demás (la relación es mutua, en 6 estados), o déjalo al azar. Las relaciones influyen en Untucked (pelas, alianzas y enemistades), en los equipos de los retos, en a quién votan para irse a casa, en quién gana Miss Simpatía y en a quién reta la asesina de lip sync." }));

  const plan = window.RefSim && window.RefSim.canRun(formatChoice) && window.RefSim.groupPlan ? window.RefSim.groupPlan(formatChoice, setup.names.length) : null;
  if (plan) wrap.appendChild(groupAssignPanel(setup, plan, refresh));

  // Opciones (twists) que necesitan datos antes de empezar: quién reclama a cada reina, quién tiene la barra de chocolate
  // dorada y cuáles son las palancas ganadoras del Badonka Dunk.
  const tws = formatChoice.twists || [];
  if (window.RefSim && window.RefSim.canRun(formatChoice) && tws.some((t) => ["CLAIM_QUEEN", "CHOCOLATE_CHOOSABLE", "BADONKA_CHOOSABLE"].includes(t))) {
    const tbox = el("div", { class: "rel-overview", style: "padding:.8rem 1rem;margin:1rem 0;" });
    tbox.appendChild(el("h3", { class: "group-title", text: "Opciones de la temporada" }));
    if (tws.includes("CLAIM_QUEEN")) {
      tbox.appendChild(el("p", { class: "muted small", text: "Reclamar una reina: escribe quién (jugador) reclama a cada concursante; su nombre saldrá junto al de la reina en la tabla." }));
      const claims = setup.claims = setup.claims || {};
      const grid = el("div", { class: "season-names" });
      setup.names.forEach((n) => {
        const row = el("label", { class: "season-name", style: "gap:.4rem;" });
        const av = avatarImg(n, "avatar--result");
        if (av) row.appendChild(av);
        row.appendChild(el("span", { text: n }));
        const inp = el("input", { type: "text", class: "name-input", placeholder: "Jugador", value: claims[n] || "", style: "width:8rem;" });
        inp.addEventListener("input", () => { if (inp.value.trim()) claims[n] = inp.value.trim(); else delete claims[n]; });
        row.appendChild(inp);
        grid.appendChild(row);
      });
      tbox.appendChild(grid);
    }
    if (tws.includes("CHOCOLATE_CHOOSABLE")) {
      tbox.appendChild(el("p", { class: "muted small", text: "Barra de chocolate: elige qué concursante tiene la barra dorada." }));
      const sel = el("select", { onchange: (e) => { setup.chocolatePick = e.target.value; } });
      sel.appendChild(el("option", { value: "", text: "Al azar" }));
      setup.names.forEach((n) => { const o = el("option", { value: n, text: n }); if (setup.chocolatePick === n) o.setAttribute("selected", "selected"); sel.appendChild(o); });
      tbox.appendChild(sel);
    }
    if (tws.includes("BADONKA_CHOOSABLE")) {
      tbox.appendChild(el("p", { class: "muted small", text: "Badonka Dunk: elige las dos palancas (de 1 a 10) que salvan a una reina." }));
      const lev = setup.badonkaLevers = setup.badonkaLevers || [];
      for (let i = 0; i < 2; i++) {
        const sel = el("select", { style: "margin-right:.4rem;", onchange: (e) => { lev[i] = e.target.value ? Number(e.target.value) : 0; } });
        sel.appendChild(el("option", { value: "", text: "Al azar" }));
        for (let k = 1; k <= 10; k++) { const o = el("option", { value: String(k), text: `Palanca ${k}` }); if (lev[i] === k) o.setAttribute("selected", "selected"); sel.appendChild(o); }
        tbox.appendChild(sel);
      }
    }
    wrap.appendChild(tbox);
  }

  const pickCount = { RETURN_CHOOSE: 1, RETURN_CHOOSE2: 2, RETURN_CHOOSE5: 5 }[formatChoice.return];
  if (pickCount && window.RefSim && window.RefSim.canRun(formatChoice)) {
    const rbox = el("div", { class: "rel-overview", style: "padding:.8rem 1rem;margin:1rem 0;" });
    rbox.appendChild(el("h3", { class: "group-title", text: "Regreso" }));
    rbox.appendChild(el("p", { class: "muted small", text: `Elige ${pickCount === 1 ? "qué concursante quieres que regrese" : `qué ${pickCount} concursantes quieres que regresen`} a la competición. Volverán cuando las eliminen (en un episodio al azar, y seguro al quedar 5 reinas); las que no elijas o no lleguen a ser eliminadas se sustituyen por eliminadas al azar.` }));
    const picks = setup.returnPick = Array.isArray(setup.returnPick) ? setup.returnPick : (setup.returnPick ? [setup.returnPick] : []);
    for (let i = 0; i < pickCount; i++) {
      const rsel = el("select", { style: "margin:.2rem .4rem .2rem 0;", onchange: (e) => { picks[i] = e.target.value; } });
      rsel.appendChild(el("option", { value: "", text: "Al azar" }));
      setup.names.forEach((n) => {
        const o = el("option", { value: n, text: n });
        if (picks[i] === n) o.setAttribute("selected", "selected");
        rsel.appendChild(o);
      });
      rbox.appendChild(rsel);
    }
    wrap.appendChild(rbox);
  }

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

  wrap.appendChild(el("h3", { class: "group-title", text: `Cómo se lleva ${setup.selected} con las demás` }));
  wrap.appendChild(el("div", { class: "toolbar", style: "justify-content:flex-start;" }, [
    el("button", { class: "btn btn--ghost", text: `🎲 Solo ${setup.selected} al azar`, onclick: () => {
      const generated = window.SimEngine.generateRelationships(setup.names, buildStatsByName());
      others.forEach((o) => { setup.relationships[setup.selected][o] = generated[setup.selected][o]; setup.relationships[o][setup.selected] = generated[setup.selected][o]; });
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
        onclick: () => { setup.relationships[setup.selected][other] = level; setup.relationships[other][setup.selected] = level; refresh(); },
      }));
    });
    row.appendChild(options);
    wrap.appendChild(row);
  });

  wrap.appendChild(el("p", { class: "muted small", text: "+++ se llevan de maravilla · ++ muy bien · + bien · • normal · − mal · −− fatal" }));

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
  "se llevan de maravilla": { symbol: "+++", color: "#2F8F7E" },
  "se llevan muy bien": { symbol: "++", color: "#3FA796" },
  "se llevan bien": { symbol: "+", color: "#4FD1C5" },
  "normal": { symbol: "•", color: "#7C8CA6" },
  "se llevan mal": { symbol: "−", color: "#E08A3E" },
  "se llevan fatal": { symbol: "−−", color: "#C24E4E" },
};

function relationshipsTable(names, relationships) {
  const tableWrap = el("div", { class: "table-wrap" });
  const table = el("table", { class: "stats-table trackrecord-table relationships-table" });
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", { text: "Relación" }));
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

  const legend = el("p", { class: "muted small", text: "+++ se llevan de maravilla · ++ muy bien · + bien · • normal · − mal · −− fatal" });
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
  // Aspecto copiado de los simuladores de referencia: tabla clara y todas las casillas (y la
  // foto) del mismo tamaño, en rectángulos verticales.
  const tableWrap = el("div", { class: "table-wrap rtr-wrap" });
  // Diseño fijo: cada columna de episodio mide siempre 64 px, sin importar lo larga que sea la
  // palabra del reto (así todas son rectángulos verticales idénticos).
  const colWidths = [108, 96, 64, ...block.columns.map(() => 64), ...(block.mvq ? [64] : []), 64];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const table = el("table", { class: "rtr", id: "trackRecord", style: `width:${tableWidth}px;min-width:${tableWidth}px;` });
  const colgroup = el("colgroup");
  colWidths.forEach((w) => colgroup.appendChild(el("col", { style: `width:${w}px;` })));
  table.appendChild(colgroup);
  const thead = el("thead");
  const head = el("tr");
  ["Rank", "Concursante", "Foto"].forEach((t) => head.appendChild(el("th", { text: t, rowspan: "2" })));
  block.columns.forEach((_, i) => head.appendChild(el("th", { text: `Ep. ${i + 1}` })));
  if (block.mvq) head.appendChild(el("th", { text: "MVQ\n(pts)", rowspan: "2", class: "ppeTR" }));
  head.appendChild(el("th", { text: "PPE\n(/10)", rowspan: "2", class: "ppeTR" }));
  thead.appendChild(head);
  const challengeRow = el("tr");
  block.columns.forEach((c) => challengeRow.appendChild(el("th", { text: c, class: "episodeTR" })));
  thead.appendChild(challengeRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  block.rows.forEach((row) => {
    const tr = el("tr");
    const rank = el("td", { class: "rtr-rank" });
    refTextWithBreaks(rank, row.rank);
    tr.appendChild(rank);
    const nameTd = el("td", { class: "rtr-name", text: row.name });
    if (row.bracket) {
      // Torneo: el nombre lleva el color de su grupo y "(Grupo N)" debajo, como en esopare
      nameTd.style.background = row.bracketColor;
      nameTd.style.color = readableTextColor(row.bracketColor) || "#202122";
      let groupText = row.bracketLabel || `(Grupo ${row.bracket})`;
      if (row.bracket2) {
        // Pasó a la segunda ronda: la casilla se parte en diagonal en dos triángulos, uno por cada grupo
        nameTd.style.background = `linear-gradient(135deg, ${row.bracketColor} 50%, ${row.bracket2Color} 50%)`;
        nameTd.style.color = "#fff";
        nameTd.style.textShadow = "0 0 3px #000, 0 0 3px #000";
        groupText = `(Grupo ${row.bracket})
(Grupo ${row.bracket2})`;
      }
      nameTd.appendChild(document.createElement("br"));
      nameTd.appendChild(el("small", { class: "rtr-sub", text: groupText }));
    }
    if (row.claimedBy) {
      nameTd.appendChild(document.createElement("br"));
      nameTd.appendChild(el("small", { class: "rtr-sub", text: `🖈 ${row.claimedBy}` }));
    }
    tr.appendChild(nameTd);
    const src = contestantImage(row.name);
    tr.appendChild(el("td", {
      class: "placement rtr-photo",
      style: src ? `background-image:url("${String(src).replace(/"/g, "%22")}");` : "",
    }));
    row.cells.forEach((cell) => {
      let style = "";
      if (cell.bg) style += `background:${cell.bg};`;
      if (cell.fg) style += `color:${cell.fg};`;
      if (cell.bold) style += "font-weight:700;";
      if (cell.immune) style += `box-shadow:inset 0 0 0 3px ${IMMUNITY_BORDER_COLOR};`;
      if (cell.border) style += `border:${cell.border};box-sizing:border-box;`;
      const td = el("td", { class: "placement", style });
      refTextWithBreaks(td, cell.text);
      if (cell.sub) {
        td.appendChild(document.createElement("br"));
        td.appendChild(el("small", { class: "rtr-sub", text: cell.sub }));
      }
      tr.appendChild(td);
    });
    if (block.mvq) tr.appendChild(el("td", { class: "placement rtr-ppe", text: String(row.mvq || 0), style: "font-size:15px;font-weight:700;" }));
    tr.appendChild(el("td", { class: "placement rtr-ppe", text: row.ppe }));
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

// ---- Bloques copiados de la sección "Contestants" de la wiki (All Stars 10 y 11) ----

// Tarjetas con el reparto: marco redondeado del color del grupo, foto y nombre en una etiqueta.
function refCards(block) {
  const wrap = el("div", { class: "rcards" });
  block.groups.forEach((g) => {
    const group = el("div", { class: "rcards__group" });
    group.appendChild(el("div", { class: "rcards__title", text: g.title, style: `background:${g.color};color:${readableTextColor(g.color) || "#fff"};` }));
    const row = el("div", { class: "rcards__row" });
    g.names.forEach((name) => {
      const src = contestantImage(name);
      const card = el("div", { class: "rcard", style: `background:${g.color};` });
      card.appendChild(el("div", { class: "rcard__photo", style: src ? `background-image:url("${String(src).replace(/"/g, "%22")}");` : "" }));
      card.appendChild(el("span", { class: "rcard__name", text: name, style: `background:${g.color};color:${readableTextColor(g.color) || "#fff"};` }));
      row.appendChild(card);
    });
    group.appendChild(row);
    wrap.appendChild(group);
  });
  return wrap;
}

// Leyenda de colores del track record ("█ La concursante ...").
function refLegend(block) {
  const box = el("div", { class: "rlegend" });
  block.items.forEach((it) => {
    const row = el("div", { class: "rlegend__row" });
    row.appendChild(el("span", { class: "rlegend__sq", style: `background:${it.color};` }));
    row.appendChild(el("span", { text: it.text }));
    box.appendChild(row);
  });
  return box;
}

// Tabla de puntos MVQ / estrellas: un cuadro por grupo (cabecera del color del grupo) y separadores negros.
function refMvq(block) {
  const outer = el("div", { class: "rmvq-wrap" });
  outer.appendChild(el("h3", { class: "group-title", text: "Puntos del torneo (MVQ)" }));
  const scroll = el("div", { class: "rmvq-scroll" });
  block.groups.forEach((g, gi) => {
    const table = el("table", { class: "rmvq" });
    const head = el("tr");
    head.appendChild(el("th", { text: g.title, colspan: String(g.cols.length * 2 + 2), style: `background:${g.color};color:${readableTextColor(g.color) || "#fff"};` }));
    table.appendChild(head);
    const head2 = el("tr");
    head2.appendChild(el("th", { text: "Concursante" }));
    g.cols.forEach((c) => head2.appendChild(el("th", { text: c, colspan: "2" })));
    head2.appendChild(el("th", { text: "Puntos\ntotales" }));
    table.appendChild(head2);
    g.rows.forEach((r) => {
      const tr = el("tr");
      tr.appendChild(el("td", { class: "rmvq__name", text: r.name }));
      r.cells.forEach((c) => {
        const mainStyle = c.main >= 3 ? "background:royalblue;color:#fff;" : c.main === 2 ? "background:deepskyblue;color:#000;" : c.main === 1 ? "background:lightblue;color:#000;" : "";
        tr.appendChild(el("td", { text: c.main ? `+${c.main}` : "—", style: mainStyle + (c.main ? "font-weight:700;" : "") }));
        tr.appendChild(el("td", { text: c.gift ? `+${c.gift}` : "—", style: c.gift ? "background:lightblue;color:#000;font-weight:700;" : "" }));
      });
      tr.appendChild(el("td", { text: String(r.total), style: "font-weight:700;" }));
      table.appendChild(tr);
    });
    if (gi) scroll.appendChild(el("div", { class: "rmvq-sep" }));
    scroll.appendChild(table);
  });
  outer.appendChild(scroll);
  outer.appendChild(el("p", { class: "muted small", text: "Primera columna de cada episodio: puntos del reto y del lip sync. Segunda columna: punto MVQ recibido de otra reina." }));
  if (block.history && block.history.length) {
    const d = el("details", { class: "rel-overview" });
    d.appendChild(el("summary", { text: "Historial de puntos MVQ regalados" }));
    const byEp = {};
    block.history.forEach((h) => { (byEp[h.ep] = byEp[h.ep] || []).push(h.text); });
    Object.keys(byEp).forEach((ep) => {
      d.appendChild(el("p", { class: "season-line", text: `Ep. ${ep}` }));
      byEp[ep].forEach((t) => d.appendChild(el("p", { class: "muted small", text: t })));
    });
    outer.appendChild(d);
  }
  return outer;
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
    else if (b.t === "cards") wrap.appendChild(refCards(b));
    else if (b.t === "legend") wrap.appendChild(refLegend(b));
    else if (b.t === "mvq") wrap.appendChild(refMvq(b));
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
    actions.appendChild(el("span", { class: "muted small", text: "Tip: usa la flecha → del teclado" }));
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
  simSeasonStats = {};
  season.contestants.forEach((c) => { if (c.stats) simSeasonStats[c.name] = c.stats; });
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

// Flechas del teclado para pasar de pantalla en una temporada (como en los simuladores de
// referencia): → avanza. Solo actúan mientras se está viendo una temporada.
document.addEventListener("keydown", (e) => {
  if (!seasonPlayer || e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = (e.target && e.target.tagName) || "";
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
  const { screens, index } = seasonPlayer;
  if (e.key === "ArrowRight" && index < screens.length - 1) {
    seasonPlayer.index = index + 1;
  } else return;
  e.preventDefault();
  render();
  window.scrollTo(0, 0);
});
