// Simulador "estilo myrainboww + esopare": copia paso a paso de los dos simuladores de
// referencia, https://myrainboww.github.io/Drag-Race-Simulator/ (la base: sus reglas, sus
// pantallas y su aleatoriedad) y https://esopare.github.io/esoteric-drag-race-simulator/ (una
// versión ampliada de ese: mini retos con nombre y puntuados, retos principales nuevos, panel
// de jurado con críticas, Untucked de las reinas a salvo, frases de salida, discurso de la
// ganadora...), con todos los textos traducidos al español.
//
// Por ahora cubre este formato: estreno normal + temporada regular + final Top 2, Top 3, Top 4, Top 5 o por equipos + sin
// regresos (ver RefSim.canRun). El resto de formatos sigue usando js/engine.js.
//
// No toca el DOM: devuelve una lista de pantallas { title, button, blocks }, que app.js pinta
// con renderRefBlocks. Una pantalla copia lo que el simulador de referencia muestra entre dos
// pulsaciones de "Proceed"; las puntuaciones salen de las 7 estadísticas básicas de cada
// reina (acting, comedy, dance, design, improv, runway, lipsync), con la misma fórmula que el
// original: puntuación = aleatorio - estadística (menor es mejor), etc.

(function () {
  "use strict";

  const D = window.REF_DATA;
  const E = window.REF_DATA_ESO;
  const READS = window.REF_READS;

  // ---------- utilidades ----------
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[rnd(0, arr.length - 1)];
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function list(names) {
    if (names.length <= 1) return names.join("");
    if (names.length === 2) return `${names[0]} y ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  }
  const plural = (names) => names.length > 1;
  const fill = (tpl, ...names) => tpl.replace(/\{(\d)\}/g, (_, i) => names[Number(i) - 1]);
  const ordinal = (n) => `${n}º`;

  // ---------- pantallas ----------
  class Screen {
    constructor(title, button = "Continuar") {
      this.title = title;
      this.button = button;
      this.blocks = [];
    }
    p(text, cls) { this.blocks.push({ t: "p", text, cls }); return this; }
    b(text) { this.blocks.push({ t: "b", text }); return this; }
    big(text) { this.blocks.push({ t: "big", text }); return this; }
    hr() { this.blocks.push({ t: "hr" }); return this; }
    // Una fila de reinas (avatares con borde de color) con un texto debajo.
    q(names, color, text) { this.blocks.push({ t: "q", names: names.flatMap((n) => Screen.teamMap.get(n) || [n]), color, text }); return this; }
    reveal(label, blocks) { this.blocks.push({ t: "reveal", label, blocks }); return this; }
    add(block) { this.blocks.push(block); return this; }
  }

  Screen.teamMap = new Map(); // nombre de equipo -> nombres de sus reinas (formato Teams)

  // ---------- la reina ----------
  class Queen {
    constructor(name, stats) {
      const g = (k) => (stats && typeof stats[k] === "number" ? stats[k] : 7);
      this.name = name;
      this.st = {
        acting: g("acting"), comedy: g("comedy"), dance: g("dance"), design: g("design"),
        improv: g("improv"), runway: g("runway"), lipsync: g("lipsync"), strategy: g("strategy"),
      };
      this.trackRecord = [];
      this.miniEpisode = [];
      this.tCaptain = [];
      this.sisters = new Map();
      this.friends = new Set();
      this.allies = new Set();
      this.enemies = new Set();
      this.runwayScore = 0;
      this.lipsyncScore = 0;
      this.performanceScore = 0;
      this.finaleScore = 0;
      this.favoritism = 0;
      this.unfavoritism = 0;
      this.ppe = 0;
      this.episodesOn = 0;
      this.votes = 0;
      this.rankP = 0;
      this.minqdd = "";
      this.mxcon = false;
      this.queenDisqOrDept = false;
      this.miniWinner = false;
      this.adv = undefined;
      this.immPotion = false;
      this.immuneCols = [];
      this.stars = 0;
      this.starLog = []; // puntos MVQ / estrellas ganados en cada columna del track record
      this.starMain = []; // ... ganados por el reto y el lip sync
      this.starGift = []; // ... recibidos de otra reina
      this.bracket = 0;
      this.retCols = []; // columnas del track record en las que regresó a la competición
      this.ogPlace = 0; // puesto con el que se fue antes de regresar
      this.blocked = false;
      this.lipstick = null;
    }
    calc(min, max, stat = 0) { return rnd(min, max) - stat; }
    getActing() { this.performanceScore = this.calc(15, 35, this.st.acting); }
    getComedy() { this.performanceScore = this.calc(15, 35, this.st.comedy); }
    getMarketing() { this.performanceScore = this.calc(25, 45, this.st.comedy + this.st.acting); }
    getDance() { this.performanceScore = this.calc(15, 35, this.st.dance); }
    getDesign() { this.performanceScore = this.calc(15, 35, this.st.design); }
    getRunwayChallenge() { this.performanceScore = this.calc(15, 35, this.st.runway); }
    getImprov() { this.performanceScore = this.calc(15, 35, this.st.improv); }
    getSnatch() { this.performanceScore = this.calc(25, 45, this.st.improv + this.st.comedy); }
    getRusical() { this.performanceScore = this.calc(25, 45, this.st.dance + this.st.lipsync); }
    getBall() { this.performanceScore = this.calc(25, 45, this.st.design + this.st.runway); }
    getRumix() { this.performanceScore = this.calc(25, 45, this.st.dance + this.st.improv); }
    // Del simulador de esopare:
    getPhotoshoot() { this.performanceScore = this.calc(25, 45, this.st.improv + this.st.runway); }
    getRappinRoast() { this.performanceScore = this.calc(25, 45, this.st.comedy + this.st.lipsync); }
    getLipsyncChallenge() { this.performanceScore = this.calc(15, 35, this.st.lipsync); }
    getTalentShow() { this.performanceScore = this.calc(15, 35, rnd(1, 35)); }
    getFinale() { this.finaleScore = this.favoritism - this.unfavoritism; }
    getRunway() { this.runwayScore = this.calc(12, 35, this.st.runway); }
    getLipsync() { this.lipsyncScore = this.calc(0, this.st.lipsync, this.unfavoritism) + this.favoritism; }
    getASLipsync() { this.lipsyncScore = this.calc(0, this.st.lipsync); }
    addTR(placement) {
      // Thailand: tras un maxi reto ganado, el resultado del jurado se une a la misma casilla (WIN + HIGH...)
      if (this.maxiT) {
        this.maxiT = false;
        this.trackRecord[this.trackRecord.length - 1] += String(placement).trim();
        return;
      }
      this.trackRecord.push(placement);
    }
  }

  // ---------- el equipo (formato Teams): dos reinas que compiten juntas con la media de sus estadísticas ----------
  class Team extends Queen {
    constructor(a, b) {
      const fa = a.name.split(" ")[0], fb = b.name.split(" ")[0];
      let name;
      if (fa.length === 3 && fb.length > 3) name = "Team " + fa + fb.slice(-4);
      else if (fa.length > 3 && fb.length === 3) name = "Team " + fa.slice(0, 4) + fb;
      else if (fa.length === 3 && fb.length === 3) name = "Team " + fa + fb;
      else name = "Team " + fa.slice(0, 4) + fb.slice(-4);
      const avg = {};
      Object.keys(a.st).forEach((k) => { avg[k] = k === "lipsync" ? 0 : (a.st[k] + b.st[k]) / 2; });
      super(name, avg);
      this.QueenA = a;
      this.QueenB = b;
      this.isTeam = true;
    }
    addTR(p) { this.trackRecord.push(p); this.QueenA.addTR(p); this.QueenB.addTR(p); }
  }

  // Etiquetas de reto en la cabecera del track record: siempre en inglés (como en los originales).
  // Las que no aparecen aquí se muestran tal cual; el salto de línea separa retos de dos partes.
  const TR_LABEL = {
    "Char. Design": "Character Design", "Talent Show/Runway": "Talent Show\nRunway", "Roast/Rumix": "Roast\nRumix",
    "Make Over/Girl Groups": "Make Over\nGirl Groups", "LaLaPaRUza Smackdown": "LaLaPaRUza\nSmackdown",
  };

  // Canciones del reto Rumix (Lip-Sync For The Crown).
  const RUMIX_SONGS = [
    "Read U Wrote U", "Category Is", "Kitty Girl", "American", "Super Queen", "Queens Everywhere",
    "Rock It (To The Moon)", "I Made It / Mirror Song / Losing is the New Winning", "Clap Back", "U Wear It Well",
    "A Little Bit of Love", "Lucky", "I'm a Winner, Baby", "This Is Our Country", "Hey Sis, It's Christmas",
    "Queen of the North",
  ];

  // Estilos de las casillas del track record (los mismos colores que el simulador de referencia).
  const CELL_STYLE = {
    "WIN": { bg: "royalblue", fg: "white", bold: true },
    " WIN": { text: "WIN", bg: "darkblue", fg: "white", bold: true },
    "HIGH": { bg: "lightblue" },
    "HIGH TEAM": { bg: "aquamarine" },
    "SAFE": { bg: "#f9f9ff" },
    "LOW": { bg: "pink" },
    "BTM2": { bg: "tomato" },
    "BTM3": { bg: "tomato" },
    "SBTM2": { text: "BTM2", bg: "hotpink" },
    "SBTM3": { text: "BTM3", bg: "hotpink" },
    "BTM5": { bg: "tomato" },
    "BTM6": { bg: "tomato" },
    "BTM": { bg: "tomato" },
    " BTM2": { text: "BTM2", bg: "hotpink" },
    "ELIM": { bg: "red", bold: true },
    "RUN ": { text: "RUN", bg: "#D3FFB5", fg: "#000", bold: true },
    "WIN ": { text: "WIN", bg: "deepskyblue", bold: true },
    "BTM4": { bg: "tomato" },
    " WIN ": { text: "WIN", bg: "lightskyblue", bold: true },
    "LOSS": { bg: "#ff9e9e" },
    "LOSS ": { text: "LOSS", bg: "orange" },
    "RTRN ": { text: "RTRN", bg: "orange", bold: true },
    "CHOC": { text: "CHOC", bg: "#fcea7c", bold: true },
    "SAFEFAME": { text: "SAFE", bg: "#fce5cd" },
    "WINFAME": { text: "WIN", bg: "blue", fg: "#fff", bold: true },
    "LOSSFAME": { text: "WIN", bg: "#00e5ff", bold: true },
    "FAME GAMES WINNER": { text: "FAME GAMES\nWINNER", bg: "#50A996", fg: "#fff", bold: true },
    "FAME GAMES CON": { text: "FAME GAMES\nMISS CON", bg: "#50A996", fg: "#fff", bold: true },
    "GBOOT": { text: "GOLDEN BOOT", bg: "gold", bold: true },
    "FANFAV": { text: "FAN FAVORITE", bg: "hotpink", bold: true },
    "VILLAIN": { text: "MISS VILLAIN", bg: "#8B0000", fg: "#fff", bold: true },
    "ROBBED": { text: "MISS ROBBED", bg: "#39FF14", fg: "#fff", bold: true },
    "POPSTAR": { text: "DRAG POPSTAR", bg: "hotpink", fg: "#000", bold: true },
    "FASHION MOGUL": { text: "FASHION MOGUL", bg: "#C8A2FF", fg: "#fff", bold: true },
    "WORSTLOOK": { text: "MISS WORST LOOK", bg: "#556B2F", fg: "#fff", bold: true },
    "LOSTLOOK": { text: "MISS LOST LOOK", bg: "gold", bold: true },
    "BRICK": { text: "MISS BRICK", bg: "#A0522D", fg: "#fff", bold: true },
    "BDNK": { text: "BDNK", bg: "hotpink", border: "3px solid #FFD700" },
    "GBEAV": { text: "LOW", bg: "pink", border: "3px solid #FFD700" },
    "OUT ": { text: "OUT", bg: "purple", fg: "#fff" },
    "QUIT ": { text: "QUIT", bg: "#C86666" },
    "ADV": { bg: "#90ee90" },
    "SAFE ": { text: "SAFE", bg: "palegreen", fg: "#000" },
    " ELIM": { text: "ELIM\n(falsa)", bg: "orange", bold: true },
    " ELIM ": { text: "ELIM", bg: "darkred", fg: "white", bold: true },
    "WINWIN": { text: "WIN", bg: "mediumblue", fg: "white", bold: true },
    "WINHIGH": { text: "WIN+HIGH", bg: "cornflowerblue", bold: true },
    "WINLOW": { text: "WIN+LOW", bg: "#ee82ee", bold: true },
    "WINBTM2": { text: "WIN+BTM2", bg: "mediumorchid", bold: true },
    "WINBTM3": { text: "WIN+BTM3", bg: "mediumorchid", bold: true },
    "WINELIM": { text: "WIN+ELIM", bg: "#9400d3", fg: "white", bold: true },
    "OUT": { text: "OUT", bg: "purple", fg: "white", bold: true },
    "LOST 1ST ROUND ": { text: "PERDIÓ\nRONDA 1", bg: "#75975E", bold: true },
    "LOST 3RD ROUND ": { text: "PERDIÓ\nRONDA 3", bg: "#A3C585", bold: true },
    "WINNER ": { text: "REINA\nSDADHH", bg: "#C7DDB5", bold: true },
    "TOP3": { text: "TOP 3", bg: "lightgreen", bold: true },
    "BEAV": { text: "GOLDEN\nBALUT", bg: "gold", bold: true },
    "TOP2": { bg: "deepskyblue" },
    "TOP 2": { bg: "lightgreen", bold: true },
    "SAFE<br>R1": { text: "SAFE\n(Ronda 1)", bg: "lightcoral", fg: "white" },
    "SAFE<br>R2": { text: "SAFE\n(Ronda 2)", bg: "indianred", fg: "white" },
    "SAFE<br>R3": { text: "SAFE\n(Ronda 3)", bg: "crimson", fg: "white" },
    " SAFE": { text: "SAFE", bg: "magenta", fg: "white" },
    "TOP 3": { bg: "lightgreen", bold: true },
    "ELIMINATED": { text: "ELIM", bg: "sienna", fg: "white", bold: true },
    "MSCONELIMINATED": { text: "MISS SIMPATÍA\n+\nELIM", bg: "#50a996", bold: true },
    "WINNER": { text: "GANADORA", bg: "yellow", bold: true },
    "RUNNER UP": { text: "SUB-\nCAMPEONA", bg: "silver", bold: true },
    "MSCONWIN": { text: "MISS SIMPATÍA\n+\nGANADORA", bg: "#80FF80", bold: true },
    "MSCONRUNUP": { text: "MISS SIMPATÍA\n+\nSUB-\nCAMPEONA", bg: "#9DCECB", bold: true },
    "TOP 3 R1": { text: "TOP 3\nGanó ronda 1", bg: "#ffd100", fg: "#000", bold: true },
    "TOP 3 R2": { text: "TOP 3\nGanó ronda 2", bg: "#ffae00", fg: "#000", bold: true },
    "TOP 3 R3": { text: "TOP 3\nGanó ronda 3", bg: "#ff7c00", fg: "#000", bold: true },
    "LOST 1ST ROUND": { text: "PERDIÓ\nRONDA 1", bg: "#FF7C00", bold: true },
    "LOST 2ND ROUND": { text: "PERDIÓ\nRONDA 2", bg: "#FFAE00", bold: true },
    "LOST 3RD ROUND": { text: "PERDIÓ\nRONDA 3", bg: "#FFD100", bold: true },
    "MSCONL1R": { text: "MISS SIMPATÍA\n+\nPERDIÓ\nRONDA 1", bg: "#80BE80", bold: true },
    "MSCONL2R": { text: "MISS SIMPATÍA\n+\nPERDIÓ\nRONDA 2", bg: "#80D780", bold: true },
    "MSCONL3R": { text: "MISS SIMPATÍA\n+\nPERDIÓ\nRONDA 3", bg: "#80E880", bold: true },
    "GUEST": { text: "INVITADA", bg: "lightgrey" },
    "MISS CON": { text: "MISS SIMPATÍA", bg: "aqua", bold: true },
    "DISQ": { text: "DESCALIF.", bg: "black", fg: "white", bold: true },
    "DEPT": { text: "BAJA", bg: "plum", bold: true },
    "QUIT": { text: "ABANDONO", bg: "palevioletred", bold: true },
    "BTM2+QUIT": { text: "BTM2\n+\nABANDONO", bg: "firebrick", fg: "white" },
    "": { text: "", bg: "gray" },
  };

  // Casillas de Drag Race Thailand copiadas de la wiki (temporada 1 y 2). Devuelve null si la casilla no es de las
  // que cambian: "WIN" suelto = ganó solo la pasarela; "WIN + X" = ganó también el maxi reto.
  function ThaiCell(raw) {
    const k = String(raw).trim().replace("HIGH TEAM", "HIGH");
    const pal = {
      WIN: { bg: "deepskyblue", fg: "#000" },
      WINSAFE: { bg: "darkblue", fg: "white" },
      WINHIGH: { bg: "cornflowerblue", fg: "#000" },
      WINLOW: { bg: "violet", fg: "#000" },
      WINWIN: { bg: "mediumblue", fg: "white" },
      WINBTM2: { bg: "mediumorchid", fg: "#000" },
      WINBTM3: { bg: "mediumorchid", fg: "#000" },
      WINELIM: { bg: "#9400D3", fg: "white" },
    };
    if (k === "LOW") return { text: "LOW", bg: "lightpink", fg: "#000", bold: false };
    const m = k.match(/^WIN(SAFE|HIGH|LOW|WIN|BTM\d|TOP2|ELIM|QUIT)$/);
    if (k === "WIN" || m) {
      const p = pal[k] || { bg: /BTM/.test(k) ? "mediumorchid" : "cornflowerblue", fg: "#000" };
      return { text: k === "WIN" || k === "WINSAFE" ? "WIN" : "WIN\n+\n" + k.slice(3), bg: p.bg, fg: p.fg, bold: true };
    }
    return null;
  }

  // ======================================================================================
  class Sim {
    constructor(names, statsByName, relNumeric, opts) {
      this.statsByName = statsByName;
      this.queens = names.map((n) => new Queen(n, statsByName[n]));
      this.byName = new Map(this.queens.map((q) => [q.name, q]));
      this.queens.forEach((q) => { q.claimedBy = ((opts && opts.claims) || {})[q.name] || ""; });
      this.current = this.queens.slice();
      this.eliminated = [];
      this.total = this.queens.length;
      this.episode = 0;
      this.episodeChallenges = [];
      this.screens = [];
      this.opts = opts || {};
      this.alliances = [];
      this.plan = null;
      this.tw = new Set((opts && opts.twists) || []);
      this.songs = D.songs.slice();
      this.sgPool = D.snatchCharacters.slice();
      this.reads = { general: READS.general.slice(), byQueen: {} };
      Object.keys(READS.byQueen || {}).forEach((k) => { this.reads.byQueen[k] = READS.byQueen[k].slice(); });
      this.alots = [];   // lip syncs de la temporada: { episode, winner, loser, song }
      this.blots = [];   // lip syncs memorables
      // relaciones numéricas simétricas
      this.queens.forEach((a) => this.queens.forEach((b) => {
        if (a !== b) a.sisters.set(b, relNumeric(a.name, b.name));
      }));
      // contadores y banderas del original
      this.finaleSize = (opts && opts.finaleSize) || 2;
      this.cnt = {
        acting: 0, comedy: 0, marketing: 0, dance: 0, design: 0, improv: 0, runway: 0,
        roomMakeover: 0, photoshoot: 0, pageant: 0, singing: 0, characterDesign: 0, rdrLive: 0, lasVegas: 0,
        makeoverGirlGroup: 0, bookMemoir: 0, talentPageant: 0, whoWoreItBest: 0, roastBattles: 0, monologues: 0,
        rappinRoast: 0, untuckedActing: 0,
      };
      this.panel = [];
      this.guestJudge = null;
      this.flag = {
        runway: false, rusical: false, ball: false, talent: false, girlGroup: false, makeover: false, snatch: false,
        reading: false, floppers: false, floppersCheck: false, slayers: false, slayersCheck: false,
        bottom6: false, bottom6Check: false, s14: false, s14Check: false, disqOrDept: false,
        doubleSashay: false, doubleShantay: false, thirdqueen: false, kandy: false, isTeam: false, isPair: false,
        isNoTeam: false, isDesign: false, miniHappen: false,
      };
      this.restChall = 0;
      this.lastChallenge = null;
      this.homeTrigger = 0;
      this.topQueens = [];
      this.bottomQueens = [];
      this.top2 = [];
      this.readReu = [];
      this.teams = [];
      this.nameOfGroups = [];
      this.songUsed = "";
    }

    // ---------- helpers de pantallas ----------
    newScreen(title, button) {
      const s = new Screen(title, button);
      this.screens.push(s);
      return s;
    }

    // ---------- relaciones ----------
    rel(a, b) { return a.sisters.get(b) || 0; }
    addRel(a, b, d) {
      a.sisters.set(b, (a.sisters.get(b) || 0) + d);
      b.sisters.set(a, (b.sisters.get(a) || 0) + d);
    }
    modRelation(type, qs) {
      const d = { 1: 1, 2: 3, 3: -1, 4: -3, 5: 0 }[type];
      if (!d) return;
      for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) this.addRel(qs[i], qs[j], d);
    }
    checkFriend(a, b) {
      const r = this.rel(a, b);
      if (r >= 6 && r <= 8) { a.friends.add(b); b.friends.add(a); }
      else if (r > 8) { a.allies.add(b); b.allies.add(a); }
      else if (r <= -6) { a.enemies.add(b); b.enemies.add(a); }
    }
    // ---------- Alianzas (según la Estrategia de cada reina) ----------
    // Cuanta más Estrategia tenga una reina, más alianzas hace. Las aliadas se prefieren entre ellas (se salvan, se votan
    // bien) y votan juntas contra su objetivo (con quien peor se llevan), perjudicando a quien se lleva mal con ellas.
    allianceOf(q) { return this.alliances.find((a) => a.members.includes(q)) || null; }

    allied(a, b) { const al = this.allianceOf(a); return !!al && al.members.includes(b); }

    allianceTick(s) {
      if (this.opts.teams) return;
      const cast = this.current;
      this.alliances.forEach((a) => { a.members = a.members.filter((m) => cast.includes(m)); });
      this.alliances = this.alliances.filter((a) => a.members.length >= 2);
      const fresh = [];
      shuffle(cast.slice()).forEach((q) => {
        const strat = q.st && typeof q.st.strategy === "number" ? q.st.strategy : 7;
        if (cast.length < 4 || rnd(0, 100) >= strat * 3.2) return; // más estrategia, más probabilidad de aliarse
        const own = this.allianceOf(q);
        const free = cast.filter((o) => o !== q && !this.allianceOf(o) && this.rel(q, o) >= 2);
        if (!own) {
          if (!free.length) return;
          const partner = this.bestSister(q, free);
          const al = { members: [q, partner], target: null };
          this.alliances.push(al); fresh.push(al);
        } else if (own.members.length < 4 && free.length) {
          const cand = this.bestSister(q, free);
          if (own.members.every((m) => this.rel(cand, m) >= 0)) { own.members.push(cand); if (!fresh.includes(own)) fresh.push(own); }
        }
      });
      this.alliances.forEach((a) => {
        // el objetivo es la reina con la que peor se lleva la alianza
        if (!a.target || !cast.includes(a.target) || a.members.includes(a.target)) {
          const rivals = cast.filter((o) => !a.members.includes(o));
          a.target = rivals.length ? rivals.slice().sort((x, y) => a.members.reduce((t, m) => t + this.rel(m, x), 0) - a.members.reduce((t, m) => t + this.rel(m, y), 0))[0] : null;
        }
        // las aliadas se llevan cada vez mejor y peor con su objetivo
        for (let i = 0; i < a.members.length; i++) for (let j = i + 1; j < a.members.length; j++) this.addRel(a.members[i], a.members[j], 1);
        if (a.target) a.members.forEach((m) => this.addRel(m, a.target, -1));
      });
      if (fresh.length) {
        s.hr();
        s.big("Alianzas");
        fresh.forEach((a) => s.q(a.members.map((m) => m.name), "slateblue", `${list(a.members.map((m) => m.name))} forman una alianza${a.target ? ` (su objetivo: ${a.target.name})` : ""}.`));
      }
    }

    bestSister(queen, cast) {
      const others = cast.filter((q) => q !== queen);
      let best = others[0];
      const eff = (q) => this.rel(queen, q) + (this.allied(queen, q) ? 8 : 0);
      others.forEach((q) => {
        const r = eff(q), rb = eff(best);
        if (rb === r) { if (rnd(0, 100) <= 50) best = q; } else if (rb < r) best = q;
      });
      return best;
    }
    worstSister(queen, cast) {
      const others = cast.filter((q) => q !== queen);
      // la alianza vota unida contra su objetivo (con un pequeño margen para la traición de las más estratégicas)
      const al = this.allianceOf(queen);
      if (al && al.target && others.includes(al.target) && rnd(0, 100) < 85) return al.target;
      let worst = others[0];
      const eff = (q) => this.rel(queen, q) + (this.allied(queen, q) ? 12 : 0);
      others.forEach((q) => {
        const r = eff(q), rw = eff(worst);
        if (rw === r) { if (rnd(0, 100) <= 50) worst = q; } else if (rw > r) worst = q;
      });
      if (this.rel(queen, worst) > -3) {
        let pickQ;
        do {
          if (rnd(0, 100) >= 96) pickQ = cast.slice().sort((a, b) => b.favoritism - a.favoritism)[0];
          else if (rnd(0, 100) >= 50) pickQ = cast.slice().sort((a, b) => b.unfavoritism - a.unfavoritism)[0];
          else pickQ = cast[rnd(0, cast.length - 1)];
        } while (pickQ === queen);
        worst = pickQ;
      }
      return worst;
    }

    // ======================================================================================
    // TEMPORADA
    // ======================================================================================
    play() {
      this.twistSetup();
      if (this.opts.randomSeasonLabel) this.newScreen("Formato al azar", "Empezar").p(`Formato aleatorio: esta temporada se juega con «${this.opts.randomSeasonLabel}».`);
      if (this.opts.tournament && this.current.length >= 6) this.playTournament();
      else this.opts.tournament = null;
      if (this.opts.winners && this.current.length >= 6) {
        // All Winners: temporada de estrellas sin eliminaciones y con una final de las 4 con más estrellas.
        const eps = this.winnersEpisodes();
        this.newScreen("¡Las ganadoras!", "Empezar").add(this.cardsBlock([{ title: "All Winners", color: "#8203D0", names: this.current.map((q) => q.name) }]));
        for (let i = 0; i < eps; i++) {
          this.playEpisode();
          this.trackRecordScreen(false);
        }
        this.finaleWinners();
        this.finalScreens();
        return;
      }
      this.opts.winners = false;
      if (this.opts.teams && this.current.length % 2 === 0 && this.current.length >= 6) {
        // Parejas al azar para toda la temporada ("¡Hora de formar parejas!").
        const s = this.newScreen("¡Hora de formar parejas!", "Empezar");
        s.p("Tras entrar en el taller, ¡las reinas deben elegir a sus parejas!");
        s.hr();
        const pairs = this.dealGroups(this.current, Array.from({ length: this.current.length / 2 }, () => 2));
        const teams = [];
        Screen.teamMap = new Map();
        while (pairs.length) {
          const pr = pairs.shift();
          const t = new Team(pr[0], pr[1]);
          teams.push(t);
          Screen.teamMap.set(t.name, [t.QueenA.name, t.QueenB.name]);
          s.q([t.QueenA.name, t.QueenB.name], "royalblue", `${t.QueenA.name} y ${t.QueenB.name} forman ${t.name}.`);
        }
        this.current = teams;
        this.total = teams.length;
        this.finaleSize = 2;
      } else {
        this.opts.teams = false;
        Screen.teamMap = new Map();
      }
      if (this.opts.randomPremiereLabel) this.newScreen("Estreno al azar", "Empezar").p(`Estreno aleatorio: esta temporada empieza con «${this.opts.randomPremiereLabel}».`);
      if (this.opts.lateEntry && this.current.length > 5) {
        this.late = pick(this.current);
        this.current = this.current.filter((q) => q !== this.late);
      }
      if (this.opts.split && this.current.length >= 9 && this.current.length >= this.finaleSize + 8) this.playSplit();
      // Triple estreno (12 o más reinas): tres grupos al azar hacen los episodios 1, 2 y 3, cada uno con su
      // eliminación; en el episodio 4 siguen todas las que quedan.
      if (this.opts.triple && this.current.length >= 12) {
        const n3 = this.current.length;
        const a = Math.floor(n3 / 3), b = Math.floor((n3 - a) / 2);
        const groups = this.dealGroups(this.current, [a, b, n3 - a - b]);
        this.premiereHalf = true;
        const left = [];
        groups.forEach((g, k) => {
          groups.forEach((o, j) => { if (j !== k) (j < k ? left[j] : o).forEach((q) => q.addTR("")); });
          this.current = g;
          this.playEpisode();
          this.flag.isTeam = false; this.flag.isPair = false;
          left[k] = this.current;
          if (k < groups.length - 1) {
            this.current = left.slice(0, k + 1).flat();
            this.trackRecordScreen(false);
          }
        });
        this.premiereHalf = false;
        this.current = left.flat();
        this.trackRecordScreen(false);
      }
      // Doble estreno: la mitad del reparto (al azar) hace el episodio 1 y la otra mitad el 2, cada
      // grupo con su eliminación; después sigue la temporada con todas las que quedan.
      if ((this.opts.doublePremiere || this.opts.doubleNoElim || this.opts.doubleTalent || this.opts.doubleGG || this.opts.porkchop || this.opts.raq || this.opts.globalAS) && this.current.length >= 10) {
        let all = shuffle(this.current.slice());
        let first, second;
        if (this.opts.porkchop) {
          this.porkchopLipsyncs();
          this.trackRecordScreen(false);
          first = this.porkGroups.first; second = this.porkGroups.second;
        } else {
          [first, second] = this.dealGroups(all, [Math.floor(all.length / 2), all.length - Math.floor(all.length / 2)]);
        }
        this.premiereHalf = true;
        second.forEach((q) => q.addTR(this.opts.globalAS ? "RUN " : ""));
        this.current = first;
        this.playEpisode();
        this.trackRecordScreen(false);
        if (this.opts.doubleNoElim || this.opts.doubleGG) { this.flag.isTeam = false; this.flag.isPair = false; }
        const firstLeft = this.current;
        firstLeft.forEach((q) => q.addTR(this.opts.globalAS ? "RUN " : ""));
        this.current = second;
        this.playEpisode();
        this.premiereHalf = false;
        if (this.opts.doubleNoElim && !this.opts.porkchop) this.flag.girlGroup = false;
        this.flag.isTeam = false; this.flag.isPair = false;
        this.current = [...firstLeft, ...this.current];
        this.trackRecordScreen(false);
        if (this.opts.doubleTalent) {
          // "Eliminación falsa": las eliminadas de los dos estrenos vuelven a la competición.
          const s = this.newScreen("¡Vuelven a la competición!", "Continuar");
          const back = this.eliminated.slice();
          back.forEach((q) => {
            q.trackRecord.pop();
            const i = q.trackRecord.findIndex((c) => c === "ELIM" || c === " ELIM ");
            if (i >= 0) q.trackRecord[i] = " ELIM";
            q.rankP = 0;
            q.minqdd = "(Elim. falsa)";
            this.current.push(q);
          });
          this.eliminated = [];
          if (back.length) {
            s.q(back.map((q) => q.name), "orange", `¡${list(back.map((q) => q.name))} ${back.length > 1 ? "vuelven" : "vuelve"} a la competición!`);
            s.p("¡Las eliminaciones de los estrenos no eran definitivas!");
          }
        }
      }
this.plan = this.makePlan();
      while (this.current.length > this.finaleSize) {
        this.playEpisode();
        this.trackRecordScreen(false);
        this.returnHook();
        if (this.tw.has("FAME_GAMES") && !this.flag.fgCheck && this.current.length === this.finaleSize && this.eliminated.filter((q) => !q.queenDisqOrDept).length >= 2 && !this.opts.teams) this.fameEpisode();
      }
      // Capítulos extra con doble shantay antes de la final (aunque hubiera final elegida: puede que tras eliminar a la
      // quinta haya un capítulo en el que las dos de abajo se salvan y entonces se pasa a la final).
      if (this.standardSeason() && this.finaleSize >= 3 && this.current.length === this.finaleSize) {
        let extras = this.plan ? this.plan.s : (rnd(0, 100) < 12 ? 1 : 0);
        while (extras-- > 0) {
          this.flag.forceShantay = true;
          this.playEpisode();
          this.flag.forceShantay = false;
          if (this.plan) this.plan.s--;
          this.trackRecordScreen(false);
          if (this.current.length !== this.finaleSize) break;
        }
      }
      if (this.opts.teams) {
        // Quedan dos equipos: pasan a ser cuatro reinas individuales (ordenadas por la puntuación final de su equipo).
        this.current.forEach((t) => t.getFinale());
        this.current.sort((a, b) => b.finaleScore - a.finaleScore);
        this.current = this.teamsFlat();
      }
      if (this.tw.has("REUNION_SMACKDOWN")) { this.reunionSmackdown(); this.reunion(); }
      else if (!this.tw.has("DISABLE_REUNION")) this.reunion();
      if (this.tw.has("FAME_GAMES") && !this.opts.teams) this.fameWinnerScreen();
      this.finale();
      this.finalScreens();
    }

    // ======================================================================================
    // REGRESOS (copia de los formatos de regreso de myrainboww y esopare). Se llama tras cada episodio:
    // decide si toca un regreso y, si es así, lo juega (una sola vez por temporada).
    // ======================================================================================
    returnHook() {
      const mode = this.opts.return;
      if (!mode || mode === "RETURN_NONE" || this.returned || this.opts.teams || this.opts.winners) return;
      const elim = this.eliminated.filter((q) => !q.queenDisqOrDept);
      const total = this.queens.length;
      const cur = this.current.length;
      // "chance": 5% x nº de episodio, y seguro al quedar 5 reinas (CheckForReturning del original)
      const chance = () => cur === 5 || rnd(0, 100) < 5 * this.episode;
      const picks = [].concat(this.opts.returnPick || []).filter(Boolean);
      if (mode === "RETURN_CHOOSE" || mode === "RETURN_RANDOM" || mode === "RETURN_VOTE" || mode === "RETURN_CHOOSE2" || mode === "RETURN_CHOOSE5") {
        const need = mode === "RETURN_CHOOSE2" ? 2 : mode === "RETURN_CHOOSE5" ? 5 : 1;
        if (this.eliminated.length < need || elim.length < need || cur >= total - 3) return;
        // con reinas elegidas de antemano, se espera a que las eliminen (salvo que se llegue a 5 reinas)
        const want = picks.map((n) => elim.find((q) => q.name === n)).filter(Boolean);
        const waiting = picks.length > 0 && want.length < Math.min(picks.length, need) && picks.some((n) => this.current.some((q) => q.name === n));
        if (!(cur === 5 || (!waiting && rnd(0, 100) < 5 * this.episode))) return;
        this.returned = true;
        if (mode === "RETURN_VOTE") return this.returnByVote(elim);
        const chosen = want.slice(0, need);
        while (chosen.length < need) chosen.push(pick(elim.filter((q) => !chosen.includes(q))));
        const s = this.newScreen("Una grata sorpresa...", "Continuar");
        if (need === 1) s.b("He decidido que una de mis reinas se ha ido demasiado pronto... Me gustaría dar la bienvenida de nuevo a...");
        else s.b(`He decidido que ${need === 2 ? "dos" : "cinco"} de mis reinas se han ido demasiado pronto... Me gustaría dar la bienvenida de nuevo a...`);
        chosen.forEach((q) => { this.bringBack(q); s.q([q.name], "aquamarine", `¡${q.name}!`); });
        // Regreso al azar: con un 5% de probabilidad vuelve una segunda reina
        if (mode === "RETURN_RANDOM" && rnd(0, 1000) >= 950) {
          const rest = this.eliminated.filter((e) => !e.queenDisqOrDept);
          if (rest.length) {
            const q2 = pick(rest);
            s.b("¡Todavía no he acabado, dad la bienvenida también a...!");
            this.bringBack(q2);
            s.q([q2.name], "aquamarine", `¡${q2.name}!`);
          }
        }
        return;
      }
      if (mode === "RETURN_SMACKDOWN" || mode === "RETURN_HELLBOUND") {
        if (cur !== this.finaleSize || elim.length < 2) return;
        this.returned = true;
        return this.smackdown(mode === "RETURN_HELLBOUND");
      }
      if (mode === "RETURN_LALAPARUZA") {
        const d = cur - this.eliminated.length;
        const allStars = this.opts.legacy || this.opts.assassin;
        if (!(d >= (allStars ? 1 : 0) && d < 3) || elim.length < 1) return;
        this.returned = true;
        return this.lalaparuzaReturn(elim);
      }
      // los que ocurren a la mitad de la temporada
      if (cur === Math.round(total / 2) && total > 8 && cur > this.finaleSize && elim.length >= 2) {
        if (mode === "RETURN_READING" || (mode === "RETURN_QOC" && elim.length < 4) || (mode === "RETURN_REINAS" && elim.length < 5)) return;
        this.returned = true;
        if (mode === "RETURN_CONJOINED") return this.conjoinedReturn(elim);
        if (mode === "RETURN_QOC" || mode === "RETURN_REINAS") return this.comedyReturn(mode === "RETURN_REINAS", elim);
        if (mode === "RETURN_KITTY" || mode === "RETURN_ATTENTION") return this.girlGroupReturn(mode === "RETURN_ATTENTION", elim);
      }
    }

    // Saca a una eliminada de la lista de eliminadas y la devuelve a la competición (con su puesto original anotado).
    // `mark`: si es true, su primera casilla de vuelta lleva el prefijo RTRN+ (los regresos con casilla propia de regreso no lo usan).
    bringBack(q, mark = true) {
      q.ogPlace = this.current.length + 1 + this.eliminated.indexOf(q);
      this.eliminated.splice(this.eliminated.indexOf(q), 1);
      if (q.rankP === "tie1" || q.rankP === "tie2") {
        const other = this.eliminated.find((e) => e.rankP === (q.rankP === "tie1" ? "tie2" : "tie1"));
        if (other) other.rankP = 0;
      }
      q.rankP = 0;
      while (q.trackRecord.length < this.episodeChallenges.length) q.addTR("");
      q.trackRecord.length = this.episodeChallenges.length; // fuera la casilla vacía de la próxima columna
      if (mark) q.retCols.push(this.episodeChallenges.length);
      this.current.push(q);
    }

    // Nueva columna extra del track record (un "episodio" que no es un reto normal): devuelve su índice.
    extraColumn(label, countEpisode = true) {
      this.episodeChallenges.push(label);
      if (countEpisode) this.episode++;
      return this.episodeChallenges.length - 1;
    }

    // Pone el valor de una casilla de una columna concreta (las eliminadas ya tienen su casilla vacía preparada).
    setCell(q, col, value) {
      while (q.trackRecord.length < col) q.addTR("");
      q.trackRecord[col] = value;
    }

    // Lip sync entre varias reinas: devuelve la canción; las puntuaciones "crudas" quedan en lipsyncScore.
    duelLipsync(s, group) {
      group.forEach((q) => q.getASLipsync());
      const song = this.pickSong(s);
      s.hr();
      this.lipsyncEvent(s, group);
      const raw = group.map((q) => q.lipsyncScore);
      this.lipsyncGroups(s, group, song);
      group.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      return song;
    }

    // Eliminación de una reina que sigue en la competición (en un regreso).
    eliminateNow(q, col, label = "ELIM") {
      this.setCell(q, col, label);
      q.unfavoritism += 5; q.votes = 0;
      this.eliminated.unshift(q);
      this.current.splice(this.current.indexOf(q), 1);
    }

    // Conjoined Queens Makeover: a mitad de temporada el siguiente episodio es un cambio de look en el que cada reina que
    // sigue elige a una eliminada como pareja; si la reina gana el reto, su pareja vuelve (el resto de eliminadas se queda "OUT ").
    conjoinedReturn(elim) {
      this.conj = { elim: elim.slice(), pairs: [], pending: true };
    }

    conjoinedFinish() {
      const col = this.episodeChallenges.length - 1;
      const c = this.conj;
      const won = (q) => /^\s*WIN/.test(String(q.trackRecord[col] || "")) && !/ELIM|QUIT|DISQ/.test(String(q.trackRecord[col]));
      const back = c.pairs.filter(([q]) => this.current.includes(q) && won(q)).map(([, p]) => p);
      this.eliminated.forEach((q) => this.setCell(q, col, back.includes(q) ? "RTRN " : (q.queenDisqOrDept ? "" : "OUT ")));
      const s = this.newScreen("¡Vuelven a la competición!", "Continuar");
      if (!back.length) s.p("Ninguna de las parejas ha conseguido ganar el reto: nadie vuelve a la competición.");
      back.forEach((q) => {
        const partner = c.pairs.find(([, p]) => p === q)[0];
        this.bringBack(q, false);
        s.q([q.name, partner.name], "orange", `${q.name}, tu pareja ${partner.name} ha ganado el reto: ¡estás de vuelta en la competición!`);
      });
      this.conj = null;
    }

    // Queens of Comedy / Reinas de la Comedia: a mitad de temporada el siguiente episodio es un reto de comedia en parejas en
    // el que cada eliminada elige (de la última a la primera) a una reina que sigue como compañera. Las dos mejores parejas
    // (Queens of Comedy) hacen que sus eliminadas se enfrenten en un lip sync por volver; en Reinas de la Comedia vuelve la
    // eliminada de la pareja ganadora y las tres peores parejas hacen lip sync por su vida.
    comedyReturn(reinas, elim) {
      this.qoc = { reinas, pending: true, pairs: [], solo: null };
    }

    comedyMaxi(s, cast) {
      const q = this.qoc;
      q.pending = false; q.active = true;
      s.b(q.reinas
        ? "Todas las concursantes eliminadas tienen la oportunidad de volver a la competición. Volverá una concursante y tres se enfrentarán en un lip sync por su vida, mientras las demás se quedan a un paso de la eliminación."
        : "Todas las All Stars eliminadas tienen la oportunidad de volver a la competición. Las reinas deben hacer un número de monólogos de humor en directo ante un público de críticos implacables.");
      s.hr();
      s.b("Las reinas que vuelven eligen a su pareja... empezando por la última eliminada...");
      const free = cast.slice();
      q.pairs = []; q.solo = null;
      this.eliminated.filter((e) => !e.queenDisqOrDept).forEach((e) => {
        if (!free.length) return;
        let p = this.bestSister(e, free);
        if (!free.includes(p)) p = pick(free);
        free.splice(free.indexOf(p), 1);
        e.getComedy(); p.getComedy();
        q.pairs.push({ A: e, B: p, score: e.performanceScore + p.performanceScore });
        s.q([e.name, p.name], undefined, `${e.name} ha elegido a ${p.name}`);
      });
      free.forEach((f) => {
        f.getComedy();
        s.q([f.name], undefined, `${f.name} trabajará sola como presentadora del show.`);
      });
      q.solo = free.length === 1 ? free[0] : null;
      q.extra = free.slice(q.solo ? 1 : 0);
      q.pairs.sort((a, b) => a.score - b.score);
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      this.flag.isDesign = true;
      this.episodeChallenges.push(q.reinas ? "Reinas de la Comedia" : "Queens of Comedy");
    }

    qocJudging() {
      const q = this.qoc;
      const col = this.episodeChallenges.length - 1;
      const pairs = q.pairs;
      const n = pairs.length;
      const s = this.newScreen(q.reinas ? "Reinas de la Comedia: el jurado" : "Queens of Comedy: el jurado", "Continuar");
      const outs = (list_) => list_.forEach((e) => this.setCell(e, col, "OUT "));
      // las eliminadas que no tienen pareja (por ser pocas reinas) y las descalificadas
      this.eliminated.forEach((e) => { if (!pairs.some((p) => p.A === e)) this.setCell(e, col, ""); });
      // la reina sola se compara con las peores parejas
      const swapIdx = q.reinas ? n - 3 : n - 2;
      if (q.solo && swapIdx > 1 && q.solo.performanceScore > pairs[swapIdx].B.performanceScore) {
        const old = pairs[swapIdx].B;
        pairs[swapIdx].B = q.solo;
        q.solo = old;
      }
      const topBs = [];
      if (q.reinas) {
        const w = pairs[0], h = pairs[1];
        s.q([w.A.name, w.B.name], "aquamarine", `${w.A.name}, ${w.B.name}. Sois las ganadoras del reto de hoy.`);
        this.setCell(w.A, col, "RTRN+WIN"); w.A.favoritism += 5; w.A.ppe += 5; w.A.episodesOn++;
        this.setCell(w.B, col, " WIN"); w.B.favoritism += 5; w.B.ppe += 5;
        s.q([w.A.name], "#299eb9", `${w.A.name}, vuelves a la competición.`);
        this.bringBack(w.A, false);
        s.q([h.B.name], "lightblue", `${h.B.name}, buen trabajo esta semana, estás a salvo.`);
        this.setCell(h.B, col, "HIGH"); h.B.favoritism += 1; h.B.ppe += 4;
        outs([h.A]);
        topBs.push(w.B, h.B);
      } else {
        const t = [pairs[0], pairs[1]];
        s.q(t.flatMap((p) => [p.A.name, p.B.name]), "aquamarine", `${t[0].A.name}, ${t[0].B.name}, ${t[1].A.name} y ${t[1].B.name}. Sois las All Stars top de la semana.`);
        t.forEach((p) => { this.setCell(p.B, col, "  WIN"); p.B.favoritism += 5; p.B.ppe += 5; topBs.push(p.B); });
      }
      const bottomCount = q.reinas ? 3 : 2;
      const midStart = q.reinas ? 2 : 2;
      const safe = [];
      for (let i = midStart; i < n - bottomCount; i++) {
        this.setCell(pairs[i].B, col, "SAFE"); pairs[i].B.ppe += 3; safe.push(pairs[i].B);
        outs([pairs[i].A]);
      }
      if (q.solo) { this.setCell(q.solo, col, "SAFE"); q.solo.ppe += 3; safe.push(q.solo); }
      (q.extra || []).forEach((x) => { this.setCell(x, col, "SAFE"); x.ppe += 3; safe.push(x); });
      if (safe.length) s.q(safe.map((x) => x.name), undefined, `${list(safe.map((x) => x.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
      s.hr();
      const bottomPairs = pairs.slice(n - bottomCount);
      const bottom = bottomPairs.map((p) => p.B);
      outs(bottomPairs.map((p) => p.A));
      s.q(bottom.map((x) => x.name), "red", `${list(bottom.map((x) => x.name))}, lo siento, queridas, pero estáis en peligro de eliminación.`);
      this.topQueens = []; this.bottomQueens = [];
      if (q.reinas) {
        // las tres peores parejas: lip sync normal por la vida del bottom
        bottom.forEach((b) => this.bottomQueens.push(b));
        this.qoc = null;
        return this.lipsyncDesc();
      }
      // Queens of Comedy: las eliminadas de las dos mejores parejas eligen pintalabios y hacen lip sync por volver
      const top2 = [pairs[0].A, pairs[1].A];
      s.hr();
      s.big("Tras deliberar...");
      top2.forEach((a) => {
        a.lipstick = rnd(0, 100) <= 45 ? bottom[bottom.length - 1] : bottom[rnd(0, bottom.length - 1)];
        s.q([a.name, a.lipstick.name], "cyan", `¡${a.name} eligió el pintalabios de ${a.lipstick.name}!`);
      });
      const r = this.newScreen("Es la hora de la revelación...", "Ver el resultado");
      r.p("Ha llegado la hora... ¡de que hagáis lip sync por vuestra VIDA! Buena suerte, y no la caguéis.");
      r.q(top2.map((a) => a.name), "tomato", `${top2[0].name} y ${top2[1].name} harán lip sync por volver a la competición...`);
      const song = this.duelLipsync(r, top2);
      top2.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const d = this.newScreen("Reinas, he tomado mi decisión...", "Continuar");
      const gone = [];
      if (top2[0].lipsyncScore === top2[1].lipsyncScore && top2[0].lipsyncScore > 6 && top2[1].lipsyncScore > 6 && this.current.length > 5) {
        this.addSong(top2, [], song);
        d.q(top2.map((a) => a.name), "darkblue", "¡Condragulations, sois las dos ganadoras, baby!");
        top2.forEach((a) => { a.favoritism += 5; a.ppe += 5; a.episodesOn++; this.setCell(a, col, "RTRN+WIN"); });
        if (top2[0].lipstick === top2[1].lipstick) gone.push(top2[0].lipstick);
        else { top2[0].lipstick.rankP = "tie1"; top2[1].lipstick.rankP = "tie2"; gone.push(top2[0].lipstick, top2[1].lipstick); }
        top2.forEach((a) => this.bringBack(a, false));
      } else {
        this.addSong([top2[0]], [top2[1]], song);
        d.q([top2[0].name], "royalblue", `${top2[0].name}, ¡eres una ganadora, baby!`);
        top2[0].favoritism += 5; top2[0].ppe += 5; top2[0].episodesOn++;
        this.setCell(top2[0], col, "RTRN+WIN");
        this.setCell(top2[1], col, "OUT"); top2[1].ppe += 5;
        d.q([top2[1].name], "red", `${top2[1].name}, sashay away.`);
        gone.push(top2[0].lipstick);
        this.bringBack(top2[0], false);
      }
      d.hr();
      gone.forEach((g) => {
        d.q([g.name], "red", `${g.name}, siempre serás una All Star, ahora... sashay away...`);
        this.exitLine(d, g);
        this.eliminateNow(g, col);
        bottom.splice(bottom.indexOf(g), 1);
      });
      bottom.forEach((b) => { this.setCell(b, col, bottom.length >= 2 ? "BTM3" : "BTM2"); b.unfavoritism += 3; b.ppe += 1; });
      this.qoc = null;
      return this.untucked();
    }

    // Kitty Girl Group / Attention Girl Group: a mitad de temporada el siguiente episodio es un grupo de chicas (Rumix) en el que
    // compiten las reinas que siguen contra las eliminadas. Las ganadoras eligen qué eliminada vuelve (Kitty) o la peor de las que
    // siguen hace lip sync contra la mejor eliminada (Attention).
    girlGroupReturn(attention, elim) {
      this.ggr = { attention, pending: true };
    }

    ggrMaxi(s, cast) {
      const g = this.ggr;
      g.pending = false; g.active = true;
      g.cur = cast.slice();
      g.elim = this.eliminated.filter((e) => !e.queenDisqOrDept);
      if (g.attention) {
        s.b("¡Es la hora del espectáculo! Las reinas actúan en un grupo de chicas contra las concursantes eliminadas.");
      } else {
        s.b("Las reinas eliminadas vuelven a la competición para vengarse. Pero antes, las reinas deben hacer una audición para el nuevo grupo de chicas de RuPaul, ¡las Kitty Girls!");
      }
      s.hr();
      s.big(`Grupo 1: las ${g.cur.length} reinas que siguen`);
      s.q(g.cur.map((q) => q.name), "black");
      s.big("Grupo 2: las reinas eliminadas");
      s.q(g.elim.map((q) => q.name), "black");
      g.cur.forEach((q) => q.getRumix());
      g.elim.forEach((q) => q.getRumix());
      // las eliminadas también salen en las descripciones del reto
      const allq = g.cur.concat(g.elim);
      s.hr();
      s.big("Actuaciones de las reinas...");
      const by = (lo, hi) => allq.filter((q) => q.performanceScore >= lo && q.performanceScore < hi);
      this.describeGroups(s, [
        [by(-Infinity, 6), "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en el reto!`],
        [by(6, 16), "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran actuación!`],
        [by(16, 26), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena actuación.`],
        [by(26, 31), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala actuación...`],
        [by(31, Infinity), "tomato", (l, pl) => `${l} ${pl ? "fracasaron" : "fracasó"} en el reto...`],
      ]);
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      this.flag.isDesign = true;
      this.skipPerfDescription = true;
      this.episodeChallenges.push(g.attention ? "Attention Girl Group" : "Kitty Girl Group");
    }

    // etiqueta del bottom según cuántas reinas siguen en él
    btmLabel(n) {
      return n >= 6 ? "BTM" : n === 5 ? "BTM6" : n === 4 ? "BTM5" : n === 3 ? "BTM4" : n === 2 ? "BTM3" : "BTM2";
    }

    ggrJudging() {
      const g = this.ggr;
      const col = this.episodeChallenges.length - 1;
      const byScore = (a, b) => a.performanceScore - b.performanceScore;
      const A = g.cur.slice().sort(byScore);
      const E = g.elim.slice().sort(byScore);
      const s = this.newScreen("¡El jurado!", "Continuar");
      const outRest = (except) => g.elim.forEach((e) => { if (!except.includes(e)) this.setCell(e, col, "OUT "); });
      this.topQueens = []; this.bottomQueens = [];
      // ---- Attention Girl Group ----
      if (g.attention) {
        const worst = A[A.length - 1];
        const best = E[0];
        const top = A.slice(0, Math.min(4, A.length - 1));
        const winner = top[0];
        s.q([winner.name], "royalblue", `${winner.name}, condragulations, ¡eres la ganadora del reto de hoy!`);
        this.setCell(winner, col, "WIN"); winner.favoritism += 5; winner.ppe += 5;
        const highs = top.slice(1);
        if (highs.length) {
          highs.forEach((q) => { this.setCell(q, col, "HIGH"); q.favoritism += 1; q.ppe += 4; });
          s.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
        }
        const safe = A.filter((q) => !top.includes(q) && q !== worst);
        safe.forEach((q) => { this.setCell(q, col, "SAFE"); q.ppe += 3; });
        if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
        s.hr();
        s.q([worst.name, best.name], "tomato", `${worst.name}, lo siento, querida, pero estás en peligro de eliminación. Y tendrás que hacer lip sync contra...`);
        s.q([best.name], "orange", `¡${best.name}!`);
        const r = this.newScreen("Es la hora de la revelación...", "Ver el resultado");
        r.p("Ha llegado la hora... ¡de que hagáis lip sync por vuestra VIDA! Buena suerte, y no la caguéis.");
        const two = [worst, best];
        const song = this.duelLipsync(r, two);
        two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        const d = this.newScreen("He tomado mi decisión...", "Continuar");
        const ret = (q, cell) => { this.setCell(q, col, cell); this.bringBack(q, false); };
        if (two[0].lipsyncScore >= two[1].lipsyncScore && two[0].lipsyncScore > 6 && two[1].lipsyncScore > 6) {
          this.addSong(two, [], song);
          d.q(two.map((q) => q.name), "darkblue", "¡Condragulations, shantay, las dos os quedáis!");
          this.setCell(worst, col, "BTM1"); worst.unfavoritism += 3; worst.ppe += 1;
          this.setCell(best, col, "RTRN "); this.bringBack(best, false);
          outRest([best]);
        } else if (two[0] === best) {
          this.addSong([best], [worst], song);
          d.q([best.name], "blue", `${best.name}, ¡eres una ganadora, baby! ¡Estás de vuelta en el juego!`);
          this.setCell(best, col, "RTRN "); this.bringBack(best, false);
          d.q([worst.name], "red", `${worst.name}, sashay away.`);
          this.eliminateNow(worst, col);
          outRest([best]);
        } else {
          this.addSong([worst], [best], song);
          d.q([worst.name], "blue", `${worst.name}, shantay, te quedas.`);
          d.q([best.name], "red", `${best.name}, lo siento, querida, pero este no es tu momento... sashay away.`);
          this.setCell(worst, col, "BTM1"); worst.unfavoritism += 3; worst.ppe += 1;
          this.setCell(best, col, "OUT"); outRest([best]);
        }
        this.ggr = null;
        return this.untucked();
      }
      // ---- Kitty Girl Group ----
      const sum = (arr) => arr.reduce((t, q) => t + q.performanceScore, 0);
      const currentWins = sum(A) <= sum(E);
      const lipstickOf = (list_) => (rnd(0, 100) <= 45 ? list_[list_.length - 1] : list_[rnd(Math.max(0, list_.length - 2), list_.length - 1)]);
      let top2, bottom;
      if (currentWins) {
        s.b(`Mis ${A.length} reinas, condragulations, ¡sois el equipo ganador!`);
        top2 = [A[0], A[1]];
        s.q(top2.map((q) => q.name), "cyan", `${top2[0].name} y ${top2[1].name}, sois las dos All Stars top de la semana.`);
        if (this.total > 10) {
          const safe = A.slice(2, A.length - 2);
          safe.forEach((q) => { this.setCell(q, col, "SAFE"); q.ppe += 3; });
          if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
          bottom = A.slice(A.length - 2);
        } else bottom = A.slice(2);
        s.q(bottom.map((q) => q.name), "red", `${list(bottom.map((q) => q.name))}... lo siento, queridas, pero estáis en peligro de eliminación.`);
        top2.forEach((q) => { q.lipstick = lipstickOf(A); });
      } else {
        s.b("Mis reinas eliminadas, condragulations, ¡sois el equipo ganador!");
        top2 = [E[0], E[1]];
        s.q(top2.map((q) => q.name), "cyan", `${top2[0].name} y ${top2[1].name}, sois las dos All Stars top de la semana.`);
        E.slice(2).forEach((e) => this.setCell(e, col, "OUT "));
        bottom = A.slice();
        s.q(bottom.map((q) => q.name), "red", "Estáis todas en peligro de eliminación.");
        top2.forEach((q) => { q.lipstick = rnd(0, 100) <= 45 ? A[A.length - 1] : pick(A); });
      }
      s.hr();
      s.big("Tras deliberar...");
      top2.forEach((q) => s.q([q.name, q.lipstick.name], "cyan", `¡${q.name} eligió el pintalabios de ${q.lipstick.name}!`));
      const r = this.newScreen("Es la hora de la revelación...", "Ver el resultado");
      r.p(`Ha llegado la hora... ¡de que hagáis lip sync por vuestro ${currentWins ? "LEGADO" : "regreso"}! Buena suerte, y no la caguéis.`);
      r.q(top2.map((q) => q.name), "tomato", `${top2[0].name} y ${top2[1].name} harán lip sync...`);
      const song = this.duelLipsync(r, top2);
      top2.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const d = this.newScreen("He tomado mi decisión...", "Continuar");
      const both = top2[0].lipsyncScore === top2[1].lipsyncScore && top2[0].lipsyncScore > 6 && top2[1].lipsyncScore > 6;
      const gone = [];
      const winners = both ? top2 : [top2[0]];
      if (both) {
        this.addSong(top2, [], song);
        d.q(top2.map((q) => q.name), "darkblue", "¡Condragulations, sois las dos ganadoras, baby!");
        if (top2[0].lipstick === top2[1].lipstick) gone.push(top2[0].lipstick);
        else { top2[0].lipstick.rankP = "tie1"; top2[1].lipstick.rankP = "tie2"; gone.push(top2[0].lipstick, top2[1].lipstick); }
      } else {
        this.addSong([top2[0]], [top2[1]], song);
        d.q([top2[0].name], "royalblue", `${top2[0].name}, ¡eres una ganadora, baby!`);
        gone.push(top2[0].lipstick);
      }
      winners.forEach((w) => { w.favoritism += 5; w.ppe += 5; });
      if (currentWins) {
        if (both) top2.forEach((w) => this.setCell(w, col, " WIN"));
        else { this.setCell(top2[0], col, "WIN"); this.setCell(top2[1], col, "WIN "); top2[1].ppe += 5; }
      } else {
        winners.forEach((w) => { w.episodesOn++; this.setCell(w, col, "RTRN+WIN"); });
        if (!both) { this.setCell(top2[1], col, "OUT"); top2[1].ppe += 5; top2[1].episodesOn++; d.q([top2[1].name], "red", `${top2[1].name}, sashay away.`); }
      }
      d.hr();
      gone.forEach((q) => {
        d.q([q.name], "red", `${q.name}, siempre serás una All Star, ahora... sashay away...`);
        this.exitLine(d, q);
        this.eliminateNow(q, col);
        bottom.splice(bottom.indexOf(q), 1);
      });
      if (currentWins) {
        // las ganadoras eligen qué eliminada vuelve
        d.hr();
        d.b(both ? "Ahora... ¿qué reinas habéis elegido para volver a la competición?" : "Ahora... ¿qué reina has elegido para volver a la competición?");
        const picks = [];
        winners.forEach((w) => {
          let p = this.bestSister(w, E);
          if (!E.includes(p)) p = pick(E);
          picks.push(p);
          d.q([w.name, p.name], "green", `${w.name} ha elegido a ${p.name} para volver a la competición.`);
        });
        const backs = picks.filter((p, i) => picks.indexOf(p) === i);
        backs.forEach((p) => this.setCell(p, col, "RTRN "));
        E.forEach((e) => { if (!backs.includes(e)) this.setCell(e, col, "OUT "); });
        backs.forEach((p) => this.bringBack(p, false));
      } else {
        winners.forEach((w) => this.bringBack(w, false));
        E.forEach((e) => { if (e.trackRecord[col] === undefined || e.trackRecord[col] === "") this.setCell(e, col, "OUT "); });
      }
      bottom.forEach((b) => { this.setCell(b, col, this.btmLabel(bottom.length)); b.unfavoritism += 3; b.ppe += 1; });
      this.ggr = null;
      return this.untucked();
    }

    // "Contestants Votes": las reinas que siguen votan cuál de las eliminadas vuelve.
    returnByVote(elim) {
      const s = this.newScreen("Una grata sorpresa...", "Continuar");
      elim.forEach((q) => { q.votes = 0; });
      s.p("He decidido que una de mis reinas merece una segunda oportunidad... ¡vosotras votaréis cuál de las eliminadas vuelve!");
      s.hr();
      s.b("Las reinas votan...");
      this.current.forEach((q) => {
        q.lipstick = this.bestSister(q, elim);
        q.lipstick.votes++;
        s.q([q.name, q.lipstick.name], "black", `¡${q.name} votó a ${q.lipstick.name}!`);
      });
      elim.slice().sort((a, b) => b.votes - a.votes).forEach((q) => s.b(`${q.name}: ${q.votes} votos`));
      s.hr();
      const winner = elim.slice().sort((a, b) => b.votes - a.votes)[0];
      this.bringBack(winner);
      winner.votes = 0;
      s.q([winner.name], "aquamarine", `¡${winner.name} vuelve a la competición!`);
    }

    // Lip-Sync Smackdown / Hellbound Showdown: justo antes de la final, las eliminadas se enfrentan en una cadena de lip syncs
    // (la más antigua contra la siguiente, y la que gana sigue) y la que gane el último vuelve (las dos si empatan alto).
    smackdown(hell) {
      const T = hell ? {
        label: "The Last Supper", title: "¡Bienvenidas al Hellbound Showdown!",
        intro: "Esta noche, vuestros fracasos os han arrastrado al Hellbound Showdown, donde competiréis en un floorshow junto a vuestros compañeros monstruos muertos. El monstruo con mejor pasarela saldrá arrastrándose del infierno. Garras fuera. Dientes al aire. Haced lo que haga falta.",
        vs: "mostrarán su pasarela infernal...", go: "Es la hora del FLOOR SHOW... Garras fuera. Dientes al aire. Templad los nervios. Mostradnos la desesperación, la furia y el miedo que alimentan vuestra supervivencia. ¡La lucha empieza ahora!",
        decide: "Escuchad con atención.", both: "Las ghouls caídas han salido arrastrándose de la tumba... ¡bienvenidas de vuelta, monstruos!",
        win: (n) => `${n}, desde la propia muerte, un monstruo se ha alzado para reclamar su lugar.`, lose: (n) => `${n}, has luchado duro, pero el inframundo siempre exige un sacrificio.`,
        decline: (a, b) => `${a}, parece que la monstruo eliminada la semana pasada, ${b}, ha rechazado la invitación a salir arrastrándose del infierno.`,
        adv: (a) => `${a}, ahora eres la campeona actual del Hellbound Showdown y pasas a la siguiente ronda.`, solo: (a) => `${a} mostrará su pasarela en solitario.`,
      } : {
        label: "Lipsync Smackdown", title: "¡Que empiece el Lipsync Smackdown!",
        intro: "Las concursantes eliminadas vuelven para competir en un épico Lipsync Smackdown y tener una oportunidad de regresar a la competición.",
        vs: "harán lip sync...", go: "Ha llegado la hora de que hagáis lip sync... ¡por vuestra redención! Buena suerte, y no la caguéis.",
        decide: "He tomado mi decisión.", both: "¡Shantay, las dos os quedáis, baby!",
        win: (n) => `${n}, shantay, te quedas.`, lose: (n) => `${n}, sashay away.`,
        decline: (a, b) => `${a}, parece que la reina eliminada la semana pasada, ${b}, ha rechazado la invitación a volver para su redención.`,
        adv: (a) => `${a}, avanzas en el smackdown de redención por la corona.`, solo: (a) => `${a} hará lip sync en solitario de todos modos.`,
      };
      const colA = this.extraColumn(T.label);
      const s0 = this.newScreen(T.title, "Empezar");
      s0.p(T.intro);
      const smack = this.eliminated.filter((q) => !q.queenDisqOrDept).reverse(); // las más antiguas primero
      const eliminated = this.eliminated.slice();
      this.current.forEach((q) => this.setCell(q, colA, "RUN "));
      eliminated.forEach((q) => this.setCell(q, colA, q.trackRecord[colA] === undefined ? "" : q.trackRecord[colA]));
      let champ = smack[0];
      const rest = smack.slice(1);
      let finalists = [champ];
      let double = false;
      let duel = 0;
      while (rest.length) {
        duel++;
        const challengers = [rest.shift()];
        if (rest.length && (challengers[0].rankP === "tie1" || challengers[0].rankP === "tie2") && rest[0].rankP === (challengers[0].rankP === "tie1" ? "tie2" : "tie1")) challengers.push(rest.shift());
        const group = [champ, ...challengers];
        const isFinal = rest.length === 0;
        const r = this.newScreen(isFinal ? (hell ? "Hellbound Showdown: la ronda final" : "Smackdown: el lip sync final") : `${hell ? "Hellbound Showdown" : "Smackdown"}: ronda ${duel}`, "Continuar");
        r.q(group.map((q) => q.name), undefined, `${list(group.map((q) => q.name))} ${T.vs}`);
        if (rnd(0, 1000) >= 999 && !this.flag.disqOrDept && challengers.length === 1) {
          // la retadora rechaza la invitación
          this.flag.disqOrDept = true;
          r.p(T.decline(champ.name, challengers[0].name));
          r.q([champ.name], "lightgreen", T.adv(champ.name));
          if (rnd(0, 1000) >= 950) { r.q([champ.name], "lightgreen", T.solo(champ.name)); if (!isFinal) this.setCell(champ, colA, "SOLO"); } else if (!isFinal) this.setCell(champ, colA, "ADV");
          this.setCell(challengers[0], colA, "QUIT ");
          challengers[0].queenDisqOrDept = true;
          if (isFinal) finalists = [champ];
          continue;
        }
        r.p(T.go);
        const song = this.duelLipsync(r, group);
        r.p(T.decide);
        group.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        if (isFinal && group[0].lipsyncScore >= group[1].lipsyncScore && group[0].lipsyncScore > 7 && group[1].lipsyncScore > 7) {
          this.addSong(group, [], song);
          r.q([group[0].name, group[1].name], "darkblue", T.both);
          double = true;
          finalists = [group[0], group[1]];
        } else {
          this.addSong([group[0]], group.slice(1), song);
          r.q([group[0].name], "royalblue", T.win(group[0].name));
          if (!isFinal) {
            this.setCell(group[0], colA, " WIN ");
            group.slice(1).forEach((q) => this.setCell(q, colA, "LOSS"));
          }
          group.slice(1).forEach((q) => { r.q([q.name], "#FF9E9E", T.lose(q.name)); if (!hell) this.exitLine(r, q); });
          champ = group[0];
          finalists = [champ];
        }
      }
      // segunda columna: quién vuelve y quién se queda fuera
      const colB = this.extraColumn("Regreso", false);
      this.current.forEach((q) => this.setCell(q, colB, ""));
      eliminated.forEach((q) => this.setCell(q, colB, finalists.includes(q) ? "RTRN " : (hell ? "" : "OUT ")));
      const f = this.newScreen(hell ? "¡Las monstruos regresan!" : "¡Vuelven a la competición!", "Continuar");
      finalists.forEach((q) => { this.bringBack(q, false); f.q([q.name], "orange", `¡${q.name} vuelve a la competición!`); });
      this.trackRecordScreen(false);
    }

    // LaLaPaRUza (regreso): cada eliminada hace lip sync contra una reina de las que siguen; la que gana se queda, la perdedora se va.
    // Las ganadoras del reto de la semana anterior tienen inmunidad.
    lalaparuzaReturn(elim) {
      const col = this.extraColumn("LaLaPaRUza");
      const s = this.newScreen("¡LaLaPaRUza!", "Empezar");
      s.p("Todas las concursantes eliminadas tienen una oportunidad de volver a la competición. Pero antes tienen que mandar a casa a una de las que siguen, en un lip sync smackdown de media temporada.");
      const eliminated = this.eliminated.slice();
      eliminated.forEach((q) => this.setCell(q, col, ""));
      const smack = elim.slice().reverse(); // las más antiguas primero
      const pool = this.current.slice();
      const winOf = (q) => ["WIN", " WIN", "WIN "].includes(q.trackRecord[col - 1]);
      pool.slice().forEach((q) => {
        if (winOf(q)) {
          s.q([q.name], "magenta", `${q.name}, como ganadora del reto de la semana pasada, tienes inmunidad.`);
          this.setCell(q, col, "RUN");
          pool.splice(pool.indexOf(q), 1);
        }
      });
      const back = (q) => { this.setCell(q, col, "RTRN "); back.list.push(q); };
      back.list = [];
      const used = new Set();
      for (let i = 0; i < smack.length; i++) {
        const q1 = smack[i];
        if (used.has(q1) || !pool.length) continue;
        const q2 = this.worstSister(q1, pool);
        const nextQ = smack.slice(i + 1).find((q) => !used.has(q));
        let q3 = null;
        if (pool.length === 1 && nextQ) q3 = nextQ; // dos eliminadas contra una de las que siguen
        else if (pool.length > 1 && !nextQ) { const others = pool.filter((q) => q !== q2); q3 = pick(others); } // una eliminada contra dos de las que siguen
        const r = this.newScreen(`LaLaPaRUza: ronda ${i + 1}`, "Continuar");
        used.add(q1);
        if (q3) used.add(q3);
        const group = q3 ? [q1, q2, q3] : [q1, q2];
        r.q(group.map((q) => q.name), undefined, `${list(group.map((q) => q.name))} harán lip sync...`);
        r.p("Ha llegado la hora de que hagáis lip sync... ¡por vuestras vidas! Buena suerte, y no la caguéis.");
        const eliminatedOnes = group.filter((q) => eliminated.includes(q));
        group.forEach((q) => q.getASLipsync());
        eliminatedOnes.forEach((q) => { q.lipsyncScore -= 4; });
        const song = this.pickSong(r);
        r.hr();
        this.lipsyncEvent(r, group);
        const raw = group.map((q) => q.lipsyncScore);
        this.lipsyncGroups(r, group, song);
        group.forEach((q, k) => { q.lipsyncScore = raw[k]; });
        group.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        r.p("He tomado mi decisión.");
        const stays = [], goes = [];
        const lim = group.length === 3 ? 7 : 6;
        if (group.length === 2) {
          if (group[0].lipsyncScore >= group[1].lipsyncScore && group[0].lipsyncScore > lim && group[1].lipsyncScore > lim) { stays.push(...group); r.q(group.map((q) => q.name), "darkblue", "¡Shantay, las dos os quedáis, baby!"); }
          else { stays.push(group[0]); goes.push(group[1]); r.q([group[0].name], "royalblue", `${group[0].name}, shantay, te quedas.`); }
        } else if (group.length === 3 && group[0].lipsyncScore >= group[1].lipsyncScore && group[0].lipsyncScore > 7 && group[1].lipsyncScore > 7 && group[2].lipsyncScore > 7) {
          stays.push(...group); r.q(group.map((q) => q.name), "darkblue", "¡Shantay, las tres os quedáis, baby!");
        } else if (group.length === 3 && group[0].lipsyncScore >= group[1].lipsyncScore && group[0].lipsyncScore > 7 && group[1].lipsyncScore > 7) {
          stays.push(group[0], group[1]); goes.push(group[2]);
          r.q([group[0].name, group[1].name], "darkblue", `${group[0].name}, ${group[1].name}. ¡Shantay, las dos os quedáis, baby!`);
        } else if (group.length === 3) {
          stays.push(group[0]); goes.push(group[1], group[2]);
          r.q([group[0].name], "royalblue", `${group[0].name}, shantay, te quedas.`);
        }
        this.addSong(stays, goes, song);
        // consecuencias: las eliminadas que se quedan vuelven; las que pierden salen otra vez; las de la competición que pierden se van
        group.forEach((q) => {
          const wasElim = eliminated.includes(q);
          const stay = stays.includes(q);
          if (wasElim) {
            if (stay) back(q);
            else { this.setCell(q, col, "OUT "); r.q([q.name], "red", `${q.name}, sashay away...`); }
          } else if (stay) this.setCell(q, col, "SAFE ");
          else { r.q([q.name], "red", `${q.name}, sashay away...`); this.exitLine(r, q); this.eliminateNow(q, col); }
        });
        group.forEach((q) => { const k = pool.indexOf(q); if (k >= 0) pool.splice(k, 1); });
      }
      // las que no participaron en ningún lip sync y siguen sin casilla
      this.current.forEach((q) => { if (q.trackRecord[col] === undefined) this.setCell(q, col, "RUN"); });
      const f = this.newScreen("¡Vuelven a la competición!", "Continuar");
      if (back.list.length) back.list.forEach((q) => { this.bringBack(q, false); f.q([q.name], "orange", `¡${q.name} vuelve a la competición!`); });
      else f.p("Ninguna eliminada ha conseguido volver.");
      this.trackRecordScreen(false);
    }

    // ======================================================================================
    // TWISTS / OPCIONES (copiados de la esquina "Twists" de esopare y "Options" de myrainboww)
    // ======================================================================================
    // Riggory de reto: gana quien mejor lo haga en el reto y la pasarela (sin favoritismo).
    rigAdj(q) {
      q.performanceScore -= this.tw.has("RIGGORY") ? q.runwayScore : (q.runwayScore - q.favoritism);
    }

    // Pantallas previas a la temporada: barra de chocolate dorada y palancas del Badonka Dunk Tank.
    twistSetup() {
      const tw = this.tw;
      if (tw.has("CHOCOLATE_RANDOM") || tw.has("CHOCOLATE_CHOOSABLE")) {
        const s = this.newScreen("Elección de la barra de chocolate", "Empezar");
        s.b("Esta temporada hacemos las cosas un poco distinto: cuando se trata de salvar reinas, lo dejo en manos de los dioses del drag.");
        s.b("Ahora, todas podéis elegir una barra, una a una.");
        let holder = null;
        const pickName = tw.has("CHOCOLATE_CHOOSABLE") ? this.opts.chocolatePick : "";
        if (pickName) holder = this.queens.find((q) => q.name === pickName) || null;
        this.queens.forEach((q) => {
          s.q([q.name], "gold", `${q.name} elige su barra de chocolate...`);
          if (!holder && !pickName && rnd(0, 100) >= 90) holder = q;
        });
        if (!holder) holder = pick(this.queens);
        holder.chocolate = true;
        this.chocolateHolder = holder;
        this.chocolateUsed = false;
        if (tw.has("CHOCOLATE_CHOOSABLE")) s.p(`${holder.name} tiene la barra de chocolate dorada.`);
      }
      if (tw.has("BADONKA_RANDOM") || tw.has("BADONKA_CHOOSABLE")) {
        const s = this.newScreen("El Badonka Dunk", "Empezar");
        s.b("Esta temporada, cuando una reina pierda un lip sync...");
        s.b("tendrá una última oportunidad: tirar de una palanca del Badonka Dunk Tank.");
        s.b("Dos de las diez palancas dejarán caer a Michelle Visage al agua y salvarán a una reina.");
        let levers = [].concat(tw.has("BADONKA_CHOOSABLE") ? (this.opts.badonkaLevers || []) : []).map(Number).filter((n) => n >= 1 && n <= 10);
        levers = levers.filter((n, i) => levers.indexOf(n) === i).slice(0, 2);
        while (levers.length < 2) { const l = rnd(1, 10); if (!levers.includes(l)) levers.push(l); }
        this.badonkaWinning = levers;
        this.badonkaUsed = [];
        this.badonkaDone = false;
        if (tw.has("BADONKA_CHOOSABLE")) s.p(`Las palancas ganadoras son la ${levers[0]} y la ${levers[1]}.`);
      }
    }

    // Tira de una palanca del Badonka Dunk Tank: devuelve { success, lever }.
    badonkaPull() {
      const available = [];
      for (let i = 1; i <= 10; i++) if (!this.badonkaUsed.includes(i)) available.push(i);
      const lever = available[rnd(0, available.length - 1)];
      this.badonkaUsed.push(lever);
      const success = this.badonkaWinning.includes(lever);
      if (success) {
        this.badonkaWinning.splice(this.badonkaWinning.indexOf(lever), 1);
        if (!this.badonkaWinning.length) this.badonkaDone = true;
      }
      return { success, lever };
    }

    // Si una reina de la que se va por el lip sync se salva por la barra de chocolate o el Badonka Dunk, devuelve true
    // (y deja su casilla marcada y la pantalla con la explicación); si no, false y se va como siempre.
    fateSave(s, q) {
      const tw = this.tw;
      if ((tw.has("CHOCOLATE_RANDOM") || tw.has("CHOCOLATE_CHOOSABLE")) && !this.chocolateUsed) {
        s.p(`Pero espera... ${q.name}, ahora tu destino está en manos de los dioses del drag.`);
        s.p("Si tienes la barra de chocolate dorada, estarás a salvo.");
        if (q.chocolate) {
          s.q([q.name], "gold", "¡¡TIENES LA BARRA DORADA!! ¡Los dioses han hablado!");
          s.p(`${q.name}, ¡condragulations, estás a salvo para seguir brillando!`);
          q.addTR("CHOC"); q.unfavoritism += 3; q.ppe += 1;
          this.chocolateUsed = true;
          return true;
        }
        s.p("Es chocolate.");
        return false;
      }
      if ((tw.has("BADONKA_RANDOM") || tw.has("BADONKA_CHOOSABLE")) && !this.badonkaDone) {
        s.p(`Pero espera... ${q.name}, ahora tu destino está en manos de los dioses del drag.`);
        s.p("Si tiras de la palanca correcta, estarás a salvo.");
        const r = this.badonkaPull();
        s.p(`${q.name} se acerca al Badonka Dunk Tank... y tira de la palanca nº ${r.lever}...`);
        if (r.success) {
          s.p("¡SPLASH! ¡Michelle Visage ha caído al agua!");
          s.q([q.name], "gold", "¡¡HAS ELEGIDO LA PALANCA CORRECTA!! ¡Los dioses han hablado!");
          s.p(`${q.name}, ¡condragulations, estás a salvo para seguir brillando!`);
          q.addTR("BDNK"); q.unfavoritism += 3; q.ppe += 1;
          return true;
        }
        s.p("No pasa nada...");
        return false;
      }
      return false;
    }

    // Una reina descalificada que tenía la barra de chocolate la pierde (o gasta una palanca del Badonka).
    fateLost(q) {
      if ((this.tw.has("CHOCOLATE_RANDOM") || this.tw.has("CHOCOLATE_CHOOSABLE")) && !this.chocolateUsed && q.chocolate) this.chocolateUsed = true;
      else if ((this.tw.has("BADONKA_RANDOM") || this.tw.has("BADONKA_CHOOSABLE")) && !this.badonkaDone) this.badonkaPull();
    }

    // Inmunidad: las ganadoras de las primeras semanas no pueden estar en el bottom la semana siguiente.
    giveImmunity() {
      if (this.premiereHalf) return false;
      const t = this.total, ep = this.episode;
      const limit = t <= 10 ? 4 : t <= 15 ? 5 : 6;
      this.current.forEach((q) => { if (!q.immuneEps || !q.immuneEps.includes(ep - 1)) q.immune = false; });
      return ep < limit;
    }

    stillImmune() {
      if (this.premiereHalf) return false;
      const t = this.total, ep = this.episode;
      return t <= 10 ? ep < 5 : t <= 15 ? ep < 6 : ep < 7;
    }

    stillBeaver() {
      const t = this.total, ep = this.episode;
      return t <= 10 ? ep < 6 : t <= 15 ? ep < 7 : ep < 8;
    }

    // Gana una reina el reto: si hay inmunidad, la gana para la semana siguiente.
    twistWinner(s, w) {
      if (this.tw.has("IMMUNITY") && this.giveImmunity()) {
        w.immune = true;
        w.immuneEps = (w.immuneEps || []).concat(this.episode);
        w.immuneCols.push(this.episodeChallenges.length - 1);
        s.p(`${w.name}, ¡además de ganar el reto has conseguido la inmunidad para el próximo reto!`);
      }
    }

    // Inmunidad y Golden Beaver sobre el bottom de la semana (antes de decidir quién hace lip sync).
    twistBottom(s, bottom) {
      const tw = this.tw;
      if (tw.has("IMMUNITY") && this.stillImmune()) {
        for (let i = 0; i < bottom.length; i++) {
          if (bottom[i].immune && bottom.length > 2) {
            const q = bottom[i];
            s.q([q.name], "magenta", `${q.name}, tienes inmunidad, estás a salvo.`);
            q.addTR("LOW"); q.unfavoritism += 1; q.ppe += 2; q.immune = false;
            bottom.splice(i, 1);
            break;
          }
        }
      }
      if (tw.has("BEAVER") && this.stillBeaver() && this.gbm && !tw.has("IMMUNITY") && bottom.length > 2) {
        const giver = this.gbm[0];
        const beaver = this.bestSister(giver, bottom);
        s.hr();
        s.q([giver.name, beaver.name], "gold", `¡${giver.name} le ha dado el Golden Beaver a... ${beaver.name}!`);
        beaver.addTR("GBEAV"); beaver.unfavoritism += 1; beaver.ppe += 2;
        this.modRelation(2, [giver, beaver]);
        bottom.splice(bottom.indexOf(beaver), 1);
      }
    }

    // ---------- Retos de lip sync (twists) ----------
    // ¿Toca el reto "LaLaPaRUza Smackdown" esta semana? (cuando se ha ido la mitad de las reinas que se tienen que ir antes de la final)
    lscNow() {
      return this.tw.has("LIPSYNC_CHALLENGE") && !this.flag.lsc && !this.opts.teams && !this.opts.winners && !this.tour
        && this.eliminated.length > 0 && this.eliminated.length === Math.floor((this.total - this.finaleSize) / 2);
    }

    // ¿Toca el "Slay Off Extravaganza" esta semana? (con 8 reinas)
    slayOffNow() {
      return this.tw.has("SLAY_OFF") && !this.flag.slayoffCheck && !this.opts.teams && !this.opts.winners && !this.tour && this.current.length === 8;
    }

    // Maxi reto "Lip Sync" (LaLaPaRUza Smackdown): torneo de lip syncs en el que las ganadoras de cada ronda se salvan y
    // la última que queda se va a casa.
    lipsyncBracket() {
      this.flag.lsc = true;
      const col = this.extraColumn("Lip Sync", false);
      const s0 = this.newScreen("¡Maxi reto: el torneo de lip syncs!", "Empezar");
      s0.b("Esta semana el maxi reto es un lip sync: en cada ronda las ganadoras se salvan... y la última que quede se va a casa.");
      let order = shuffle(this.current.slice());
      let rounds = order.length, count = 0, extra = false;
      do {
        if (rounds % 2 !== 0) extra = true;
        rounds = Math.floor(rounds / 2);
        if (extra) { rounds++; extra = false; }
        count++;
      } while (rounds !== 1);
      const safe = (q, r) => { this.setCell(q, col, `SAFE<br>R${r}`); q.ppe += 3; };
      for (let r = 1; r <= count; r++) {
        const R = this.newScreen(r === count ? "Ronda final" : `Ronda ${r}`, "Continuar");
        if (r === count) {
          if (order.length === 3) {
            const saved = order[0];
            R.q([saved.name], "#DD3075", `${saved.name} se salva por votación de sus compañeras.`);
            safe(saved, r);
            order.splice(0, 1);
          }
          const pair = order.slice(0, 2);
          R.q(pair.map((q) => q.name), undefined, `${pair[0].name} y ${pair[1].name} harán lip sync...`);
          R.p("Ha llegado la hora de que hagáis lip sync... ¡por vuestra vida! Buena suerte, y no la caguéis.");
          const song = this.duelLipsync(R, pair);
          pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
          R.p("He tomado mi decisión.");
          if (pair[0].lipsyncScore >= pair[1].lipsyncScore && pair[0].lipsyncScore > 7 && pair[1].lipsyncScore > 7 && !this.tw.has("DISABLE_DOUBLE")) {
            this.addSong(pair, [], song);
            R.q(pair.map((q) => q.name), "darkblue", "¡Shantay, las dos os quedáis, baby!");
            pair.forEach((q) => safe(q, r));
          } else {
            this.addSong([pair[0]], [pair[1]], song);
            R.q([pair[0].name], "royalblue", `${pair[0].name}, shantay, te quedas.`);
            safe(pair[0], r);
            const loser = pair[1];
            if (!this.fateSave(R, loser)) {
              R.q([loser.name], "red", `${loser.name}, sashay away.`);
              this.exitLine(R, loser);
              this.eliminateNow(loser, col, " ELIM ");
            }
          }
        } else {
          const groups = [];
          const pool = order.slice();
          while (pool.length) groups.push(pool.length === 3 ? pool.splice(0, 3) : pool.splice(0, 2));
          groups.forEach((g) => {
            if (g.length === 1) { R.q([g[0].name], undefined, `${g[0].name} pasa de ronda sin hacer lip sync.`); return; }
            R.q(g.map((q) => q.name), undefined, `${list(g.map((q) => q.name))} harán lip sync...`);
            const song = this.duelLipsync(R, g);
            g.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
            this.addSong([g[0]], g.slice(1), song);
            R.q([g[0].name], "royalblue", `${g[0].name}, shantay, te quedas.`);
            R.q(g.slice(1).map((q) => q.name), "darkred", `${list(g.slice(1).map((q) => q.name))}, seguís en peligro de eliminación...`);
            safe(g[0], r);
            order.splice(order.indexOf(g[0]), 1);
            R.hr();
          });
          order = shuffle(order);
          if (order.length === 3) count--;
        }
      }
      this.current.forEach((q) => { if (q.trackRecord[col] === undefined) this.setCell(q, col, "SAFE"); });
      return this.untucked();
    }

    // Slay Off Extravaganza (con 8 reinas): en vez del reto normal hay dos rondas de lip syncs; las ganadoras de la final son
    // WIN y TOP2, las dos del medio salvadas con HIGH y las perdedoras de la primera ronda quedan en el bottom.
    slayOffEpisode() {
      this.flag.slayoffCheck = true;
      const col = this.extraColumn("Lip Sync", false);
      const s0 = this.newScreen("¡Maxi reto: Lip Sync Slay Off Extravaganza!", "Empezar");
      s0.b("Esta semana el maxi reto es el Lip Sync Slay Off Extravaganza: las reinas se enfrentan en dos rondas de lip syncs y la última pareja se juega la victoria.");
      let order = shuffle(this.current.slice());
      const bottom = [];
      for (let r = 1; r <= 2; r++) {
        const R = this.newScreen(`Ronda ${r}`, "Continuar");
        const next = [];
        for (let i = 0; i + 1 < order.length; i += 2) {
          const pair = [order[i], order[i + 1]];
          R.q(pair.map((q) => q.name), undefined, `${pair[0].name} y ${pair[1].name} harán lip sync...`);
          const song = this.duelLipsync(R, pair);
          pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
          this.addSong([pair[0]], [pair[1]], song);
          R.q([pair[0].name], "royalblue", `${pair[0].name}, condragulations, pasas a la siguiente ronda.`);
          next.push(pair[0]);
          if (r === 1) { R.q([pair[1].name], "darkred", `${pair[1].name}, lo siento, querida, estás en peligro de eliminación.`); bottom.push(pair[1]); }
          else { R.q([pair[1].name], "darkred", `${pair[1].name}, excelente trabajo, estás a salvo.`); this.setCell(pair[1], col, "HIGH"); pair[0].favoritism += 1; pair[1].ppe += 4; }
          R.hr();
        }
        order = shuffle(next);
      }
      const F = this.newScreen("Ronda final", "Continuar");
      const fin = order.slice(0, 2);
      F.q(fin.map((q) => q.name), undefined, `${fin[0].name} y ${fin[1].name} harán lip sync...`);
      const song = this.duelLipsync(F, fin);
      fin.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      this.addSong([fin[0]], [fin[1]], song);
      F.q([fin[0].name], "royalblue", `${fin[0].name}, condragulations, ¡eres la ganadora del Lip Sync Slay Off Extravaganza!`);
      this.setCell(fin[0], col, "WIN"); fin[0].favoritism += 5; fin[0].ppe += 5;
      F.q([fin[1].name], "darkred", `${fin[1].name}, increíble trabajo, estás a salvo.`);
      this.setCell(fin[1], col, "TOP2"); fin[1].ppe += 4.5;
      F.hr();
      this.gbm = [fin[0]];
      this.topQueens = []; this.bottomQueens = bottom;
      this.twistBottom(F, bottom);
      if (bottom.length === 4) {
        shuffle(bottom);
        F.b("¡Ronda extra!");
        for (let i = 0; i < 2; i++) {
          const pair = [bottom[i], bottom[i + 1]];
          F.q(pair.map((q) => q.name), undefined, `${pair[0].name} y ${pair[1].name} harán lip sync...`);
          const sg = this.duelLipsync(F, pair);
          pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
          this.addSong([pair[0]], [pair[1]], sg);
          F.q([pair[0].name], "royalblue", `${pair[0].name}, condragulations, estás a salvo.`);
          this.setCell(pair[0], col, "LOW"); pair[0].unfavoritism += 1; pair[0].ppe += 2;
          bottom.splice(bottom.indexOf(pair[0]), 1);
          F.q([pair[1].name], "darkred", `${pair[1].name}, lo siento, querida, estás en peligro de eliminación...`);
          F.hr();
        }
      }
      F.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, lo siento, queridas, pero estáis en riesgo de eliminación.`);
      return this.lipsyncDesc();
    }

    // Reunion Smackdown: antes de la reunión, todas las eliminadas hacen un torneo de lip syncs por el título de
    // "She Done Already Done Had Herses".
    reunionSmackdown() {
      const col = this.extraColumn("Lip Sync");
      const s0 = this.newScreen("¡Lip Sync Smackdown de la reunión!", "Empezar");
      s0.p("Todas las reinas eliminadas vuelven para pelear en un LaLaPaRUza Smackdown por el título de Reina de She Done Already Done Had Herses.");
      this.current.forEach((q) => this.setCell(q, col, "RUN "));
      const players = this.eliminated.filter((q) => !q.queenDisqOrDept);
      this.eliminated.forEach((q) => { if (q.queenDisqOrDept) this.setCell(q, col, ""); });
      let bowl = shuffle(players.slice());
      const nth = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH"];
      let r = 0;
      while (bowl.length > 1) {
        const R = this.newScreen(bowl.length <= 3 ? "Ronda final" : `Ronda ${r + 1}`, "Continuar");
        const groups = [];
        const pool = bowl.slice();
        while (pool.length) groups.push(pool.length === 3 ? pool.splice(0, 3) : pool.splice(0, 2));
        const winners = [];
        groups.forEach((g) => {
          R.q(g.map((q) => q.name), undefined, `${list(g.map((q) => q.name))} harán lip sync...`);
          const song = this.duelLipsync(R, g);
          g.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
          this.addSong([g[0]], g.slice(1), song);
          R.q([g[0].name], "royalblue", `${g[0].name}, condragulations, ¡eres una ganadora, baby!`);
          R.q(g.slice(1).map((q) => q.name), "darkred", `${list(g.slice(1).map((q) => q.name))}, gracias por una temporada inolvidable.`);
          g.slice(1).forEach((q) => this.setCell(q, col, `LOST ${nth[Math.min(r, nth.length - 1)]} ROUND `));
          winners.push(g[0]);
          R.hr();
        });
        bowl = shuffle(winners);
        r++;
      }
      if (bowl.length === 1) {
        const w = bowl[0];
        this.setCell(w, col, "WINNER ");
        w.minqdd = w.minqdd ? w.minqdd + "\n(Reina de SDADHH)" : "(Reina de SDADHH)";
        const F = this.newScreen("La Reina de She Done Already Done Had Herses", "Ir a la reunión");
        F.q([w.name], "royalblue", `¡La Reina de She Done Already Done Had Herses es... ${w.name}!`);
      }
      this.trackRecordScreen(false);
    }

    // ---------- Fame Games ----------
    // Mientras las demás compiten, las eliminadas hacen una pasarela cada semana (en Untucked) para ganar votos de los fans.
    fameShowcase(s) {
      const last = this.episodeChallenges[this.episodeChallenges.length - 1];
      if (this.eliminated.length <= 1 || last === "Design" || last === "Talent Show") return;
      const col = this.episodeChallenges.length - 1;
      s.hr();
      s.big("Pasarela de los Fame Games");
      s.p("La categoría es... " + (this.famCat || "¡el mejor drag!"));
      const queens = this.eliminated.filter((q) => !q.queenDisqOrDept && !["ELIM", " ELIM", " ELIM ", "  ELIM "].includes(q.trackRecord[col]));
      queens.forEach((q) => q.getRunway());
      const by = (lo, hi) => queens.filter((q) => q.runwayScore >= lo && q.runwayScore < hi);
      this.describeGroups(s, [
        [by(-Infinity, 6), "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en la pasarela!`],
        [by(6, 16), "royalblue", (l, pl) => `¡${l} ${pl ? "estuvieron" : "estuvo"} genial en la pasarela!`],
        [by(16, 26), undefined, (l, pl) => `${l} ${pl ? "estuvieron" : "estuvo"} bien en la pasarela.`],
        [by(26, Infinity), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} dificultades en la pasarela...`],
      ]);
      s.big("¿Quién será coronada Reina de los Fame Games?");
    }

    // Episodio previo a la final de los Fame Games: todas las eliminadas vuelven al escenario; las dos mejores hacen lip sync
    // para multiplicar sus votos de los fans y las demás se quedan a salvo.
    fameEpisode() {
      this.flag.fgCheck = true;
      const col = this.extraColumn("Fame Games");
      const all = this.current.concat(this.eliminated.filter((q) => !q.queenDisqOrDept));
      const s = this.newScreen("¡Fame Games: todas están de vuelta!", "Continuar");
      s.b("¡Todas están de vuelta! Y la biblioteca está abierta: en el mini reto de hoy, las reinas se leerán entre ellas.");
      this.readingChallenge(all, false).forEach((blk) => s.add(blk));
      const players = this.eliminated.filter((q) => !q.queenDisqOrDept);
      this.eliminated.forEach((q) => { if (q.queenDisqOrDept) this.setCell(q, col, ""); });
      players.forEach((q) => q.getRunway());
      players.sort((a, b) => b.runwayScore - a.runwayScore);
      this.current.forEach((q) => this.setCell(q, col, "RUN "));
      const j = this.newScreen("¡El jurado!", "Ir al lip sync");
      j.b("Mis mejores concursantes... La semana que viene la presión es máxima porque competiréis por el gran premio. Pero esta noche...");
      j.q(this.current.map((q) => q.name), "#D3FFB5", `${list(this.current.map((q) => q.name))}, podéis dejar el escenario...`);
      j.hr();
      const top2 = players.slice(0, 2);
      players.slice(2).forEach((q) => { this.setCell(q, col, "SAFEFAME"); q.ppe += 3; });
      j.b("Esta noche buscamos a las dos mejores concursantes de la semana... que harán lip sync para multiplicar el total de sus votos de los fans.");
      j.q(top2.map((q) => q.name), "blue", `Las dos mejores de la semana son... ¡${top2[0].name} y ${top2[1].name}!`);
      const r = this.newScreen("Reinas, he tomado mi decisión...", "Continuar");
      const song = this.duelLipsync(r, top2);
      top2.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      top2.forEach((q) => { q.favoritism += 5; q.ppe += 5; });
      const mult = rnd(2, 5);
      this.setCell(top2[0], col, "WINFAME");
      if (top2[0].lipsyncScore === top2[1].lipsyncScore && top2[0].lipsyncScore > 6 && top2[1].lipsyncScore > 6) {
        this.addSong(top2, [], song);
        const mult2 = rnd(2, 5);
        r.q(top2.map((q) => q.name), "blue", "¡Condragulations, sois las dos ganadoras, baby!");
        this.setCell(top2[1], col, "WINFAME");
        top2[0].mult = mult; top2[1].mult = mult2;
        r.p(`${top2[0].name}, tu total de votos de los fans se multiplicará por ${mult}.`);
        r.p(`${top2[1].name}, tu total de votos de los fans se multiplicará por ${mult2}.`);
      } else {
        this.addSong([top2[0]], [top2[1]], song);
        r.q([top2[0].name], "blue", "¡Condragulations, eres una ganadora, baby!");
        r.q([top2[1].name], "#00e5ff", "¡Gracias por participar!");
        this.setCell(top2[1], col, "LOSSFAME");
        top2[0].mult = mult;
        r.p(`${top2[0].name}, tu total de votos de los fans se multiplicará por ${mult}.`);
      }
      this.trackRecordScreen(false);
    }

    // La Reina de los Fame Games la eligen los fans entre las eliminadas (votos al azar x multiplicador).
    fameWinnerScreen() {
      const s = this.newScreen("¡Reina de los Fame Games!", "Ir a la final");
      s.b("¡Es la hora de saber a quién han votado los fans para ser coronada Reina de los Fame Games!");
      const pool = this.eliminated.filter((q) => !q.queenDisqOrDept);
      if (!pool.length) return;
      pool.forEach((q) => { q.votes = rnd(10, 100) * (q.mult || 1); });
      pool.sort((a, b) => b.votes - a.votes);
      const w = pool[0];
      s.hr();
      s.q([w.name], "#50A996", `La Reina de los Fame Games es... ¡${w.name}!`);
      w.minqdd = w.minqdd ? w.minqdd + "\n(Reina de los Fame Games)" : "(Reina de los Fame Games)";
      const lastCell = w.trackRecord[w.trackRecord.length - 1];
      w.trackRecord[w.trackRecord.length - 1] = lastCell === "MISS CON" ? "FAME GAMES CON" : "FAME GAMES WINNER";
      this.fameQueen = w;
    }

    // ---------- Pick Your Poison (CAN6) ----------
    // Una vez por temporada (con 9 reinas o más) la mitad de la clase hace el Snatch Game y la otra mitad un diseño; cada
    // grupo tiene su ganadora, sus altas y sus bajas, y la peor de cada grupo hace lip sync por su vida.
    pypNow() {
      return this.tw.has("PICK_POISON") && !this.flag.pyp && !this.opts.teams && !this.opts.winners && !this.tour
        && this.current.length >= 9 && this.episode > 1 && !this.premiereHalf;
    }

    pypMaxi(s, cast) {
      this.flag.pyp = true;
      this.pyp = { snatch: [], design: [], active: true };
      s.b("Las concursantes deben elegir entre competir en el Snatch Game o crear un look con materiales poco convencionales. ¡Elige tu veneno!");
      s.hr();
      s.big("¡Las pociones están elegidas!");
      const pool = cast.slice();
      while (pool.length) {
        this.pyp.snatch.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
        if (pool.length) this.pyp.design.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
      }
      this.pyp.snatch.forEach((q) => q.getSnatch());
      this.pyp.design.forEach((q) => q.getDesign());
      s.b("Las concursantes del Snatch Game son...");
      s.q(this.pyp.snatch.map((q) => q.name), undefined);
      s.b("Las concursantes del reto de diseño son...");
      s.q(this.pyp.design.map((q) => q.name), undefined);
      s.hr();
      const describe = (q) => (q.performanceScore < 6 ? `¡${q.name} arrasó en el reto!` : q.performanceScore < 16 ? `¡${q.name} hizo una gran actuación!`
        : q.performanceScore < 26 ? `${q.name} hizo una buena actuación.` : q.performanceScore < 31 ? `${q.name} tuvo dificultades con el reto.` : `${q.name} hizo una mala actuación...`);
      s.big("¡El Snatch Game!");
      this.pyp.snatch.forEach((q) => s.b(describe(q)));
      s.big("¡El reto de diseño!");
      this.pyp.design.forEach((q) => s.b(describe(q)));
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      this.flag.isDesign = true;
      this.episodeChallenges.push("Snatch Game\nDiseño");
    }

    pypJudging() {
      const col = this.episodeChallenges.length - 1;
      const g = this.pyp;
      this.pyp = null;
      const s = this.newScreen("¡Que vuelvan mis chicas!", "Lip sync por la vida");
      s.b("Chicas, he tomado algunas decisiones...");
      const split = (cast) => {
        const sorted = cast.slice().sort((a, b) => a.performanceScore - b.performanceScore);
        return { top: sorted.length >= 5 ? [sorted[0], sorted[1], sorted[2]] : [sorted[0], sorted[1]], bottom: [sorted[sorted.length - 2], sorted[sorted.length - 1]] };
      };
      const sg = split(g.snatch), dg = split(g.design);
      const winners = [sg.top[0], dg.top[0]];
      winners.forEach((w, i) => {
        w.addTR(" WIN"); w.favoritism += 5; w.ppe += 5;
        s.q([w.name], "royalblue", `${w.name}, condragulations, ¡eres la ganadora del ${i === 0 ? "Snatch Game" : "reto de diseño"}!`);
      });
      this.gbm = winners;
      const highs = sg.top.slice(1).concat(dg.top.slice(1)).filter((q) => !winners.includes(q));
      if (highs.length) {
        highs.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        s.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
      }
      s.hr();
      const bAdj = (q) => q.performanceScore - (this.tw.has("RIGGORY") ? q.runwayScore : q.runwayScore - q.favoritism);
      const sBottom = sg.bottom.filter((q) => !winners.includes(q) && !highs.includes(q)).sort((a, b) => bAdj(a) - bAdj(b));
      const dBottom = dg.bottom.filter((q) => !winners.includes(q) && !highs.includes(q)).sort((a, b) => bAdj(a) - bAdj(b));
      let bottom;
      if (!this.tw.has("BEAVER")) {
        s.big("Snatch Game");
        const sLow = sBottom[0]; sLow.addTR("LOW"); sLow.unfavoritism += 1; sLow.ppe += 2;
        s.q([sLow.name], "pink", `${sLow.name}... estás a salvo.`);
        s.q([sBottom[1].name], "tomato", `${sBottom[1].name}... estás en peligro de eliminación.`);
        s.big("Reto de diseño");
        const dLow = dBottom[0]; dLow.addTR("LOW"); dLow.unfavoritism += 1; dLow.ppe += 2;
        s.q([dLow.name], "pink", `${dLow.name}... estás a salvo.`);
        s.q([dBottom[1].name], "tomato", `${dBottom[1].name}... estás en peligro de eliminación.`);
        bottom = [sBottom[1], dBottom[1]];
      } else {
        s.q(sBottom.concat(dBottom).map((q) => q.name), "pink", `${list(sBottom.concat(dBottom).map((q) => q.name))} son las bottoms del Snatch Game y del diseño.`);
        bottom = [sBottom[0], sBottom[1], dBottom[0], dBottom[1]];
        if (this.stillBeaver() && !this.tw.has("IMMUNITY")) {
          for (const w of winners) {
            if (bottom.length <= 2) break;
            const beaver = this.bestSister(w, bottom);
            s.hr();
            s.q([w.name, beaver.name], "gold", `¡${w.name} le ha dado el Golden Beaver a... ${beaver.name}!`);
            beaver.addTR("GBEAV"); beaver.unfavoritism += 1; beaver.ppe += 2;
            this.modRelation(2, [w, beaver]);
            bottom.splice(bottom.indexOf(beaver), 1);
          }
        }
        while (bottom.length > 2) { const q = bottom.shift(); q.addTR("LOW"); q.unfavoritism += 1; q.ppe += 2; }
      }
      const safe = this.current.filter((q) => !winners.includes(q) && !highs.includes(q) && !sBottom.includes(q) && !dBottom.includes(q));
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
      s.hr();
      s.q(bottom.map((q) => q.name), "tomato", `${bottom[0].name}, ${bottom[1].name}, lo siento, queridas, pero estáis en riesgo de eliminación.`);
      this.bottomQueens = bottom;
      this.lipsyncDesc();
    }

    // ¿La temporada usa el juicio y el lip sync normales (donde caben los dobles shantay/sashay forzados)?
    standardSeason() {
      const o = this.opts;
      return !(o.assassin || o.legacy || o.fatal || o.thailand || o.slaysian || o.teams || o.winners || this.raqMerge || this.tw.has("DISABLE_DOUBLE"));
    }

    // Número de capítulos pedido por el usuario (incluida la final): calcula cuántos dobles shantay (capítulos de más)
    // o dobles sashay (capítulos de menos) hacen falta. Sin número pedido no hay plan y todo funciona como siempre.
    makePlan() {
      const want = Math.floor(Number(this.opts.episodes));
      if (!want || !this.standardSeason()) return null;
      const base = this.current.length - this.finaleSize;
      const extra = (want - 1 - this.episode) - base;
      if (!extra) return null;
      return extra > 0 ? { s: Math.min(extra, Math.max(1, base)), d: 0 } : { s: 0, d: Math.min(-extra, Math.max(0, base - 1)) };
    }

    // Split Format: tres estrenos con un tercio del reparto cada uno (cada grupo con su eliminación) y después
    // dos rondas de dos grupos (A y B) que juegan por separado; la que no juega ese episodio no puntúa.
    // Después siguen todas las que quedan, como en una temporada normal.
    playSplit() {
      const colors = ["#FE5007", "#EA00B7", "#8203D0"];
      let alive = this.current.slice();
      const a = Math.ceil(alive.length / 3), b = Math.floor((alive.length - a) / 2);
      const premieres = this.dealGroups(alive, [a, b, alive.length - a - b]);
      const intro = this.newScreen("¡Estrenos divididos!", "Empezar");
      intro.p("El reparto se divide en tres grupos: cada uno tiene su propio estreno, con su eliminación.");
      intro.add(this.cardsBlock(premieres.map((g, i) => ({ title: `Estreno ${i + 1}`, color: colors[i], names: g.map((q) => q.name) }))));
      this.splitNow = true;
      // un episodio de un subgrupo; el resto de reinas vivas se quedan con la casilla en blanco
      const run = (group) => {
        group = group.filter((q) => alive.includes(q));
        if (group.length < 3 || alive.length <= this.finaleSize + 1) return false;
        alive.filter((q) => !group.includes(q)).forEach((q) => q.addTR(""));
        const members = group.slice();
        this.current = group;
        this.playEpisode();
        this.flag.isTeam = false; this.flag.isPair = false;
        const left = this.current;
        alive = alive.filter((q) => !members.includes(q) || left.includes(q));
        this.current = alive.slice();
        this.trackRecordScreen(false);
        return true;
      };
      premieres.forEach((g) => run(g));
      // dos rondas de grupos A y B (el segundo reparto es nuevo y al azar)
      for (let round = 0; round < 2; round++) {
        const mix = shuffle(alive.slice());
        const A = [], B = [];
        mix.forEach((q) => { (A.length <= B.length ? A : B).push(q); });
        if (alive.length <= this.finaleSize + 3) break;
        const s = this.newScreen(round ? "¡Los grupos se mezclan!" : "¡Se forman los grupos!", "Empezar");
        s.p(round ? "Las reinas se reparten en dos nuevos grupos que vuelven a jugar por separado." : "Las reinas restantes se reparten en dos grupos que jugarán por separado.");
        s.add(this.cardsBlock([{ title: "Grupo A", color: colors[0], names: A.map((q) => q.name) }, { title: "Grupo B", color: colors[2], names: B.map((q) => q.name) }]));
        run(A);
        run(B);
      }
      this.splitNow = false;
      this.current = alive;
    }

    // ---------- un episodio ----------
    playEpisode() {
      this.episode++;
      this.topQueens = [];
      this.bottomQueens = [];
      this.top2 = [];
      this.flag.isNoTeam = false;
      this.miniChallenge();
      if (this.conj && this.conj.active) { const c = this.conj; this.conjoinedFinish(); this.conj = null; void c; }
    }

    // ---------- mini reto ----------
    miniChallenge() {
      this.flag.miniHappen = false;
      this.current.forEach((q) => { q.miniWinner = false; });
      const s = this.newScreen("¡Mini reto!", "Ir al maxi reto");
      if (this.opts.teams) { this.teamMini(s); return this.createChallenge(); }
      this.checkForDeptQuit(s);
      this.describeMini(s);
      this.rankMini(s);
      this.createChallenge();
    }

    checkForDeptQuit(s) {
      if (this.opts.winners || this.tour) return;
      if (rnd(0, 1000) >= 999 && !this.flag.disqOrDept && this.current.length > 6) {
        const quitter = this.current[rnd(0, this.current.length - 1)];
        if (rnd(0, 10) >= 5) {
          s.q([quitter.name], "plum", `Por consejo médico, la increíble y talentosa ${quitter.name} no continuará en la competición...`);
          quitter.addTR("DEPT");
          quitter.minqdd = "(Baja)";
        } else {
          s.q([quitter.name], "palevioletred", `${quitter.name} decidió que su salud mental no estaba en buen momento para seguir en la competición...`);
          quitter.addTR("QUIT");
          quitter.minqdd = "(Abandono)";
        }
        s.hr();
        quitter.unfavoritism += 5;
        quitter.queenDisqOrDept = true;
        this.eliminated.unshift(quitter);
        this.current.splice(this.current.indexOf(quitter), 1);
        this.flag.disqOrDept = true;
      }
    }

    describeMini(s) {
      const cast = this.current;
      // Anfitriona (versión de esopare): RuPaul abre cada episodio.
      s.b("¡¡RuPaul!!");
      s.big("Hola, hola, hola, mis reinas...");
      s.hr();
      let text;
      this.miniType = null;
      this.readingBlocks = null;
      const readingNow = (cast.length === 6 && this.total >= 9 && this.episode > 2 ||
        cast.length === 7 && this.total >= 30 && this.episode > 3 || (this.opts.legacy || this.opts.assassin || this.opts.slaysian) && this.episode === 1 && !(this.opts.return === "RETURN_READING" && !this.opts.slaysian)) && !this.flag.reading && !this.opts.winners;
      if (this.lscNow() || this.slayOffNow()) {
        text = "Hoy no hay mini reto, ¡vamos directas al maxi reto!";
        this.flag.miniHappen = true;
      } else if (readingNow) {
        text = "¡La biblioteca está abierta! En el mini reto de hoy, las reinas se leerán entre ellas.";
        this.miniType = "comedy";
        this.flag.reading = true;
        const readingIF = this.opts.return === "RETURN_READING" && !this.returned && this.episode > 1 && !this.opts.teams && this.eliminated.some((q) => !q.queenDisqOrDept);
        this.readingIFNow = readingIF;
        if (readingIF) text = "¡La biblioteca está abierta! En el mini reto de hoy, las reinas eliminadas leerán a las que siguen... ¡y la mejor lectora vuelve a la competición!";
        this.readingBlocks = this.readingChallenge(readingIF ? this.eliminated.filter((q) => !q.queenDisqOrDept) : cast, !readingIF, readingIF ? cast : null);
      } else if (this.total !== 5 && cast.length === 5) {
        text = "¡Que salgan los títeres! Las reinas se parodiarán entre ellas usando títeres.";
        this.miniType = "comedy";
      } else if (rnd(0, 100) >= 80) {
        text = "Hoy no hay mini reto, ¡vamos directas al maxi reto!";
        this.flag.miniHappen = true;
      } else {
        const [name, type] = pick(window.REF_DATA_ESO.miniChallenges);
        text = `En el mini reto de hoy, las reinas participarán en: ${name}.`;
        this.miniType = type;
      }
      s.b(text);
      s.hr();
      if (this.readingBlocks) this.readingBlocks.forEach((blk) => s.add(blk));
    }

    // Puntúa el mini reto con la habilidad de su tipo y muestra cómo le fue a cada reina.
    scoreMini(s) {
      const cast = this.current;
      const getter = {
        acting: "getActing", comedy: "getComedy", dance: "getDance", design: "getDesign", improv: "getImprov",
        runway: "getRunwayChallenge", marketing: "getMarketing", photoshoot: "getPhotoshoot",
        lipsync: "getLipsyncChallenge",
      }[this.miniType] || "getComedy";
      cast.forEach((q) => q[getter]());
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const by = (lo, hi) => cast.filter((q) => q.performanceScore >= lo && q.performanceScore < hi);
      this.describeGroups(s, [
        [by(-Infinity, 6), "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en el mini reto!`],
        [by(6, 16), "royalblue", (l, pl) => `¡${l} ${pl ? "lo hicieron" : "lo hizo"} genial en el mini reto!`],
        [by(16, 26), undefined, (l, pl) => `${l} ${pl ? "lo hicieron" : "lo hizo"} bien en el mini reto.`],
        [by(26, 31), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} dificultades en el mini reto...`],
        [by(31, Infinity), "tomato", (l, pl) => `${l} ${pl ? "fracasaron" : "fracasó"} en el mini reto...`],
      ]);
      s.hr();
    }

    rankMini(s) {
      if (this.flag.miniHappen) return;
      const cast = this.current;
      this.scoreMini(s);
      if (this.readingIFNow) {
        // Reading is Fundamental: la ganadora de la lectura (una eliminada) vuelve a la competición en este mismo episodio
        this.readingIFNow = false;
        this.returned = true;
        const winner = pick(this.eliminated.filter((q) => !q.queenDisqOrDept));
        this.bringBack(winner);
        winner.miniEpisode.push(this.episode);
        winner.miniWinner = true;
        s.q([winner.name], "royalblue", `¡${winner.name} ganó el reto de lectura y vuelve a la competición!`);
        return;
      }
      if (rnd(0, 100) <= 90) {
        const winner = cast[0];
        const roll = rnd(0, 10);
        let text = `¡${winner.name} ganó el mini reto!`;
        if (roll >= 10) { text += " ¡Y tendrá una enorme ventaja para el maxi reto!"; winner.adv = 3; }
        else if (roll >= 8) { text += " ¡Y tendrá una ventaja para el maxi reto!"; winner.adv = 2; }
        else if (roll >= 5) { text += " ¡Y tendrá una pequeña ventaja para el maxi reto!"; winner.adv = 1; }
        s.q([winner.name], "royalblue", text);
        winner.miniEpisode.push(this.episode);
        winner.miniWinner = true;
      } else {
        const a = rnd(0, cast.length - 1);
        let b;
        do { b = rnd(0, cast.length - 1); } while (b === a);
        s.q([cast[a].name, cast[b].name], "royalblue", `¡${cast[a].name} y ${cast[b].name} ganaron el mini reto!`);
        [cast[a], cast[b]].forEach((q) => { q.miniEpisode.push(this.episode); q.miniWinner = true; });
      }
    }

    // ---------- la biblioteca (mini reto de lectura y reunión) ----------
    readingChallenge(cast, isCurrent, targets) {
      const blocks = [];
      if (isCurrent && this.eliminated.length > 0) this.readReu = this.eliminated.slice();
      const readuMode = cast === this.readReu;
      cast.forEach((queen, a) => {
        let first;
        if (a === 0) blocks.push({ t: "q", names: [queen.name], color: "black", text: `Primera... ¡${queen.name}!` });
        else if (a === cast.length - 1) blocks.push({ t: "q", names: [queen.name], color: "black", text: `Y por último, pero no menos importante... ¡${queen.name}!` });
        else blocks.push({ t: "q", names: [queen.name], color: "black", text: `Le toca a... ¡${queen.name}!` });
        let numberOfReads = readuMode ? 1 : 2;
        for (let i = 0; i < numberOfReads; i++) {
          const pool = targets || (readuMode ? this.eliminated : cast);
          const candidates = pool.filter((q) => q !== queen && q !== first);
          if (!candidates.length) break;
          const readTarget = pick(candidates);
          blocks.push({ t: "q", names: [readTarget.name], color: "lightgreen", text: `Para: ${readTarget.name}` });
          let source = this.reads.byQueen[readTarget.name];
          if (!source || !source.length) source = this.reads.general;
          if (!source.length) source = (this.reads.general = READS.general.slice());
          const idx = rnd(0, source.length - 1);
          blocks.push({ t: "b", text: source[idx] });
          source.splice(idx, 1);
          if (i === 0) first = readTarget;
          if (rnd(0, 100) >= 99) numberOfReads++;
        }
        blocks.push({ t: "hr" });
      });
      return blocks;
    }

    // ---------- elección del maxi reto ----------
    createChallenge() {
      this.current.forEach((q) => { q.episodesOn++; });
      const cast = this.current;
      const n = cast.length;
      if (this.lscNow()) return this.lipsyncBracket();
      if (this.slayOffNow()) return this.slayOffEpisode();
      if ((this.opts.slaysian || (this.tw.has("SLAYSIAN_LALA") && !this.tour && !this.opts.winners && !this.opts.teams)) && n === 6 && !this.flag.slaysianDone) return this.slaysianLalaparuza();
      const opening = this.opts.opening;
      let fn;
      if (this.conj && this.conj.pending) { this.conj.pending = false; this.conj.active = true; fn = "conjoined"; }
      else if (this.qoc && this.qoc.pending) fn = "qoc";
      else if (this.ggr && this.ggr.pending) fn = "ggr";
      else if (this.pypNow()) fn = "pyp";
      else if (this.tour) fn = this.tournamentChallenge();
      else if (this.opts.winners) fn = this.winnersChallenge();
      else if (this.opts.teams) fn = this.teamChallenge();
      else if (this.premiereHalf) fn = this.opts.doubleNoElim || this.opts.doubleGG || this.opts.porkchop ? "girlgroup" : this.opts.doubleTalent || this.opts.raq || this.opts.globalAS ? "talent" : this.randomMaxi();
      else if (this.lateNow() || this.uk3Now()) fn = "runway";
      else if ((this.opts.legacy || this.opts.assassin || this.opts.slaysian) && this.episode === 1) fn = "talent";
      else if (this.episode === 1) {
        fn = { DESIGN: "design", RUNWAY: "runway", TALENT_SHOW: "talent", GIRL_GROUP: "girlgroup" }[opening] || pick(["design", "runway", "talent", "girlgroup"]);
      } else if (this.opts.lftc && n === 5 && !this.flag.rumix) fn = "rumix"; // Lip-Sync For The Crown: Rumix con 5 reinas
      else if (this.total >= 12 && !this.flag.snatch && (this.finaleSize >= 4 ? (n === 10 || n === 8) : n === 9)) fn = "snatch";
      else if (this.total < 12 && !this.flag.snatch && (n === rnd(7, 9) || n === 7)) fn = "snatch";
      else if (!this.flag.snatch && n <= this.finaleSize + 3) fn = "snatch"; // el Snatch Game sale en todas las temporadas
      // Ball: con el Top 2, con 3 reinas (o muy pronto en repartos grandes); con el Top 3, con 4.
      else if (!this.flag.ball && this.total >= 12 && (this.finaleSize === 2 || this.finaleSize === 5 || this.finaleSize === 6 || this.finaleSize === 7 || this.finaleSize === 8 || this.opts.teamsFinale || this.opts.lftc || this.opts.canFinale || this.opts.jury) && (n === this.total - 3 || n === this.total - 4)) fn = "ball";
      else if (!this.flag.ball && this.finaleSize <= 4 && !this.opts.teamsFinale && !this.opts.lftc && !this.opts.canFinale && !this.opts.jury && n === this.finaleSize + 1) fn = "ball";
      else if (!this.flag.ball && this.total < 12 && n === 8 && rnd(0, 100) <= 10) fn = "ball";
      else if (((this.total >= 12 && (n === 8 || n === 9)) || (this.total < 12 && n === 6)) && !this.flag.girlGroup && rnd(0, 100) >= 50) fn = "girlgroup";
      else if (((this.total >= 12 && (n === 11 || n === 9)) || (this.total < 12 && n === 7)) && !this.flag.rusical && rnd(0, 100) >= 50) fn = "rusical";
      // Transformación (con el Top 3, con 5 reinas)
      else if (((this.finaleSize === 3 && n === 5) || (this.finaleSize >= 4 && this.finaleSize <= 5 && n === 6) || (this.finaleSize >= 6 && n === this.finaleSize + 1)) && !this.flag.makeover) fn = "runway";
      else fn = this.randomMaxi();
      this.maxi(fn);
    }

    // Reto aleatorio: reserva ponderada del simulador de esopare (los retos "de siempre" pesan
    // 150 y los especiales menos); cada reto tiene un tope de veces y nunca se repite seguido.
    randomMaxi() {
      const total = this.total;
      const even = this.current.length % 2 === 0;
      const defs = [
        ["acting", 150, 3], ["improv", 150, 3], ["marketing", 150, 3], ["dance", 150, total > 15 ? 2 : 2],
        ["design", 150, 3], ["comedy", 150, 3], ["runway", 150, 99],
        ["roomMakeover", 50, 1], ["photoshoot", 85, 1], ["pageant", 40, 1], ["singing", 85, 1],
        ["characterDesign", 30, 1], ["rdrLive", 45, 1], ["lasVegas", 35, 1], ["makeoverGirlGroup", 20, 1],
        ["bookMemoir", 50, 1], ["talentPageant", 15, 1], ["whoWoreItBest", 25, 1], ["roastBattles", 25, 1],
        ["monologues", 35, 1], ["rappinRoast", 30, 1], ["untuckedActing", 25, 1],
      ];
      if (this.opts.teams) defs.length = 7;
      let pool = defs
        .filter(([type, , cap]) => this.cnt[type] < cap)
        .filter(([type]) => type !== "whoWoreItBest" || even)
        .filter(([type]) => type !== this.lastChallenge)
        .map(([type, weight]) => ({ type, weight, times: this.cnt[type] }));
      if (!pool.length) pool = defs.map(([type, weight]) => ({ type, weight, times: this.cnt[type] }));
      const weighted = [];
      pool.forEach((c) => { for (let i = 0; i < c.weight; i++) weighted.push(c); });
      weighted.sort((a, b) => b.times - a.times);
      this.restChall++;
      const unused = weighted.filter((c) => c.times < weighted[0].times);
      let chosen;
      if (this.restChall === 1) chosen = weighted[rnd(0, 3)];
      else if (unused.length) chosen = pick(unused);
      else chosen = pick(weighted);
      this.lastChallenge = chosen.type;
      return chosen.type;
    }

    // ---------- el maxi reto: pantalla con descripción + actuaciones (+ pasarela) ----------
    maxi(fn) {
      this.lastChallenge = fn; // para no repetir el mismo reto dos episodios seguidos
      const s = this.newScreen("¡Maxi reto!", "");
      this.maxiScreen = s;
      const cast = this.current;
      this.flag.isDesign = false;
      let teamPossible = false;
      switch (fn) {
        case "acting": {
          s.b("Las reinas actuarán en " + D.actingKinds[rnd(0, 4)] + D.actingTitles[rnd(0, D.actingTitles.length - 1)]);
          teamPossible = rnd(0, 100) >= 50;
          this.runTeamable(s, teamPossible, "getActing");
          this.cnt.acting++;
          this.episodeChallenges.push("Acting");
          break;
        }
        case "comedy": {
          const standUp = cast.length > 8;
          this.episodeChallenges.push(standUp ? "Stand Up" : "Roast");
          s.b("Las reinas participarán en " + (standUp ? "una rutina de comedia sobre " : "un roast sobre ") + D.comedyTopics[rnd(0, D.comedyTopics.length - 1)]);
          if (rnd(0, 100) >= 60 && cast.length === 10 && !this.flag.isPair) {
            this.flag.isPair = true;
            this.pairMaking(s);
          }
          cast.forEach((q) => q.getComedy());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.comedy++;
          break;
        }
        case "marketing": {
          s.b("Las reinas participarán en " + pick(D.marketingKinds) + D.marketingTopics[rnd(0, D.marketingTopics.length - 1)]);
          this.episodeChallenges.push("Advert");
          this.runTeamable(s, rnd(0, 100) >= 60, "getMarketing");
          this.cnt.marketing++;
          break;
        }
        case "dance": {
          s.b("Las reinas participarán en un número de baile sobre " + D.danceTopics[rnd(0, D.danceTopics.length - 1)]);
          this.episodeChallenges.push(rnd(0, 100) >= 50 ? "Dance" : "Choreo");
          this.runTeamable(s, rnd(0, 100) >= 70, "getDance");
          this.cnt.dance++;
          break;
        }
        case "design": {
          s.b("Las reinas harán looks con " + D.designMaterials[rnd(0, D.designMaterials.length - 1)]);
          if (rnd(0, 100) >= 60 && cast.length === 10 && !this.flag.isPair && this.episode >= 2) {
            this.flag.isPair = true;
            this.pairMaking(s);
          }
          cast.forEach((q) => q.getDesign());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.cnt.design++;
          this.episodeChallenges.push("Design");
          break;
        }
        case "qoc": this.comedyMaxi(s, cast); break;
        case "ggr": this.ggrMaxi(s, cast); break;
        case "pyp": this.pypMaxi(s, cast); break;
        case "conjoined": {
          // Conjoined Queens Makeover: cada reina que sigue elige a una eliminada como pareja de cambio de look
          const elim = this.conj.elim.slice();
          s.b("Las reinas eliminadas se emparejarán con las concursantes actuales en un reto de gemelas drag conjuntas, luchando por una oportunidad de volver al juego.");
          s.hr();
          s.b("Las concursantes actuales eligen a su pareja...");
          this.conj.pairs = [];
          cast.forEach((q) => {
            if (!elim.length) {
              s.q([q.name], undefined, `Eso significa que ${q.name} hará el cambio de look de una de las del equipo de boxes.`);
            } else {
              let partner = this.bestSister(q, elim);
              if (!elim.includes(partner)) partner = pick(elim);
              elim.splice(elim.indexOf(partner), 1);
              this.conj.pairs.push([q, partner]);
              s.q([q.name, partner.name], undefined, `${q.name} ha elegido a ${partner.name}`);
            }
            q.getDesign();
          });
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.episodeChallenges.push("Conjoined Makeover");
          break;
        }
        case "improv": {
          const idx = rnd(0, D.improvShows.length - 1);
          s.b("Las reinas improvisarán en " + D.improvShows[idx][0]);
          this.episodeChallenges.push(D.improvShows[idx][1]);
          this.runTeamable(s, rnd(0, 100) >= 50, "getImprov");
          this.cnt.improv++;
          break;
        }
        case "runway": {
          const makeover = (cast.length === 6 || cast.length === 5 || (this.finaleSize >= 6 && cast.length === this.finaleSize + 1)) && !this.flag.makeover;
          if (this.lateNow() || this.uk3Now()) {
            s.b("¡Las reinas desfilarán por la pasarela y presentarán no uno, sino dos looks!");
            this.episodeChallenges.push("Runway");
            this.flag.runway = true;
          } else if (makeover) {
            s.b("¡Es el reto de transformación! Las reinas convertirán en sus hermanas drag " + pick(D.makeoverPeople) + ".");
            this.episodeChallenges.push("Make Over");
            this.flag.makeover = true;
          } else {
            s.b("¡Las reinas desfilarán por la pasarela! La categoría es: " + (this.famCat = pick(D.runwayCategories)));
            this.episodeChallenges.push("Runway");
            this.flag.runway = true;
          }
          cast.forEach((q) => q.getRunwayChallenge());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.cnt.runway++;
          break;
        }
        case "snatch": {
          const rus = this.tw.has("SNATCH_RUSICAL");
          s.b(rus ? "¡El reto de hoy es... SNATCH GAME: EL RUSICAL! Las reinas imitarán a una famosa y protagonizarán un rusical basado en el clásico Snatch Game."
            : "¡El reto de hoy es... SNATCH GAME! ¡Las reinas harán divertidas imitaciones de famosos!");
          this.episodeChallenges.push(rus ? "Snatch Game\nRusical" : rnd(0, 100) >= 95 ? "Snatch Game of Love" : "Snatch Game");
          if (rus) this.flag.rusical = true;
          s.hr();
          s.big("¡Imitaciones del Snatch Game!");
          cast.forEach((q) => {
            const i = rnd(0, this.sgPool.length - 1);
            s.q([q.name], undefined, `${q.name} imitará a ${this.sgPool[i]}!`);
            this.sgPool.splice(i, 1);
          });
          if (rus) cast.forEach((q) => { q.getComedy(); q.getRusical(); }); else cast.forEach((q) => q.getSnatch());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.snatch = true;
          break;
        }
        case "rusical": {
          s.b("¡El reto de hoy es... EL RUSICAL! Las reinas participarán en " + D.rusicals[rnd(0, D.rusicals.length - 1)]);
          cast.forEach((q) => q.getRusical());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.rusical = true;
          this.episodeChallenges.push("Rusical");
          break;
        }
        case "ball": {
          if (rnd(0, 100) >= 35) {
            const ball = pick(D.balls);
            s.b(`¡El reto de hoy es... EL BALL! ¡El ${ball.name}! Y los temas son: ${ball.themes}.`);
          } else {
            s.b("¡El reto de hoy es... EL BALL! ¡Las reinas llevarán tres looks a la pasarela! Los temas son: " +
              pick(D.ballThemes1) + pick(D.ballThemes2) + pick(D.ballThemes3));
          }
          cast.forEach((q) => q.getBall());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.flag.ball = true;
          this.episodeChallenges.push("Ball");
          break;
        }
        case "rumix": {
          s.b("¡El reto de hoy es... el Rumix! Las reinas escribirán un verso y una coreografía para «" + pick(RUMIX_SONGS) + "».");
          cast.forEach((q) => q.getRumix());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.rumix = true;
          this.episodeChallenges.push("Rumix");
          break;
        }
        case "girlgroup": {
          s.b(`Las reinas restantes grabarán las voces y actuarán en un número de Girl Group con la canción original «${pick(D.girlGroupSongs)}».`);
          this.runTeamable(s, rnd(0, 100) >= 50 && this.episode > 3, "getRumix");
          this.episodeChallenges.push("Girl Group");
          this.flag.girlGroup = true;
          break;
        }
        case "talent": {
          s.b("¡Las concursantes se pondrán a prueba en un show de talentos, donde darán todo lo que tienen!");
          this.talentList(s);
          cast.forEach((q) => q.getTalentShow());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.episodeChallenges.push("Talent Show");
          this.flag.talent = true;
          break;
        }
        // ---- retos del simulador de esopare ----
        case "roomMakeover": {
          s.b("Las reinas transformarán habitaciones en lujosas habitaciones de fantasía de inspiración drag y las presentarán al jurado.");
          this.runTeamable(s, rnd(0, 100) >= 50 && this.episode > 3, "getImprov");
          this.cnt.roomMakeover++;
          this.episodeChallenges.push("Room Design");
          break;
        }
        case "photoshoot": {
          s.b("Las reinas participarán en una sesión de fotos con " + pick(E.photoshootThemes));
          cast.forEach((q) => q.getPhotoshoot());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.photoshoot++;
          this.episodeChallenges.push("Photo Shoot");
          break;
        }
        case "pageant": {
          s.b("Las concursantes presentarán " + pick(E.pageantIntros));
          s.hr();
          s.big("Certamen Miss Shutacca: preguntas y respuestas");
          cast.forEach((q) => {
            s.hr();
            s.q([q.name], undefined, q.name);
            s.p("Pregunta: " + pick(E.pageantQuestions));
            s.p("Respuesta: «" + pick(E.pageantAnswers) + "»");
          });
          s.hr();
          cast.forEach((q) => q.getComedy());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.cnt.pageant++;
          this.episodeChallenges.push("Pageant");
          break;
        }
        case "singing": {
          const idx = rnd(0, E.singingShows.length - 1);
          s.b("Las reinas cantarán en directo en " + E.singingShows[idx]);
          this.runTeamable(s, rnd(0, 100) >= 40, "getRusical");
          this.cnt.singing++;
          this.episodeChallenges.push(idx === 7 ? "Drag Idol" : idx === 13 ? "RuVision" : "Singing");
          break;
        }
        case "rdrLive": {
          s.b("Desde Tuckahoe, ¡es RDR Live! Las concursantes protagonizarán un divertidísimo programa de sketches de comedia en directo.");
          cast.forEach((q) => q.getComedy());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.rdrLive++;
          this.episodeChallenges.push("RDR Live!");
          break;
        }
        case "characterDesign": {
          s.b("Las concursantes diseñarán un personaje con sus looks e inventarán una historia para sus propias muñecas basadas en sus personajes drag.");
          cast.forEach((q) => q.getComedy());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.cnt.characterDesign++;
          this.episodeChallenges.push("Char. Design");
          break;
        }
        case "talentPageant": {
          s.b("Las concursantes presentarán sus mejores looks de bañador y de noche y harán un número de talento en el Certamen Miss Carisma, Singularidad, Nervio y Talento.");
          this.talentList(s);
          cast.forEach((q) => q.getTalentShow());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.talentPageant++;
          this.episodeChallenges.push("Talent Show/Runway");
          break;
        }
        case "monologues": {
          s.b("Las concursantes compartirán historias divertidas y emotivas mientras las representan mediante un baile interpretativo.");
          cast.forEach((q) => q.getDance());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.monologues++;
          this.episodeChallenges.push("Monologues");
          break;
        }
        case "untuckedActing": {
          s.b("Las concursantes protagonizarán un episodio de Untucked improvisado, con drama, confesionarios, enfrentamientos e inolvidables momentos entre bambalinas, interpretando " + pick(E.untuckedScenes));
          this.runTeamable(s, rnd(0, 100) >= 40, "getActing");
          this.cnt.untuckedActing++;
          this.episodeChallenges.push("Untucked Acting");
          break;
        }
        case "roastBattles": {
          s.b("Las concursantes se enfrentarán una a una en épicas batallas de roast.");
          cast.forEach((q) => q.getComedy());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.roastBattles++;
          this.episodeChallenges.push("Roast Battles");
          break;
        }
        case "rappinRoast": {
          s.b("Las concursantes escribirán e interpretarán versos de diss track en los que se ponen verdes unas a otras en un Rappin' Roast.");
          cast.forEach((q) => q.getRappinRoast());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.rappinRoast++;
          this.episodeChallenges.push("Roast/Rumix");
          break;
        }
        case "whoWoreItBest": {
          s.b("Las concursantes trabajarán en parejas para crear looks coordinados inspirados en distintas festividades. Aunque trabajen juntas, solo una reina de cada pareja podrá demostrar... ¿Quién lo lleva mejor?");
          this.whoWoreItBestPairs(s);
          cast.forEach((q) => q.getDesign());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.flag.isDesign = true;
          this.flag.wwib = true;
          this.cnt.whoWoreItBest++;
          this.episodeChallenges.push("Who Wore It Best");
          break;
        }
        case "bookMemoir": {
          s.b("Las concursantes escribirán historias de su vida para unas memorias, posarán en una sesión de fotos para la portada de su libro y participarán en una entrevista.");
          cast.forEach((q) => q.getComedy());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.bookMemoir++;
          this.episodeChallenges.push("Book Memoir");
          break;
        }
        case "lasVegas": {
          s.b("¿Qué tal tu número de cabecera? Las concursantes harán una audición para unirse a RuPaul's Drag Race LIVE! en el Flamingo de Las Vegas. Empezarán con una sesión de fotos impactante y un vídeo promocional dirigido por ellas mismas, después tendrán una entrevista íntima y terminarán con un baile en el escenario principal.");
          cast.forEach((q) => q.getActing());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.cnt.lasVegas++;
          this.episodeChallenges.push("Las Vegas");
          break;
        }
        case "makeoverGirlGroup": {
          s.b(`Las concursantes transformarán ${pick(E.makeoverGroups)} y escribirán e interpretarán versos originales sobre «${pick(E.makeoverGirlGroupSongs)}».`);
          this.runTeamable(s, rnd(0, 100) >= 50 && this.episode > 3, "getDance");
          this.cnt.makeoverGirlGroup++;
          this.episodeChallenges.push("Make Over/Girl Groups");
          break;
        }
        default: break;
      }
      this.queensPerformances(s);
    }

    // Lista de talentos del show de talentos (versión de esopare).
    talentList(s) {
      s.hr();
      s.big("¡Las reinas actúan en un show de variedades!...");
      this.current.forEach((q) => s.q([q.name], undefined, `${q.name} hizo una actuación de ${pick(D.talents)}!!`));
    }

    // "¿Quién lo lleva mejor?": parejas con tema festivo (la ganadora del mini reto elige pareja).
    whoWoreItBestPairs(s) {
      const holidays = E.holidays.slice();
      const queens = this.current.slice();
      let first = queens.find((q) => q.miniWinner);
      s.hr();
      if (first) {
        s.q([first.name], undefined, `${first.name}, como ganadora del mini reto de esta semana, elegirás a tu pareja. Y asignarás cada pareja y su tema.`);
        s.hr();
      } else first = queens[rnd(0, queens.length - 1)];
      queens.splice(queens.indexOf(first), 1);
      const partner = queens.splice(rnd(0, queens.length - 1), 1)[0];
      const takeHoliday = () => (holidays.length ? holidays.splice(rnd(0, holidays.length - 1), 1)[0] : pick(E.holidays));
      this.wwibPairs = [{ q1: first, q2: partner, theme: takeHoliday() }];
      while (queens.length > 1) {
        const q1 = queens.splice(rnd(0, queens.length - 1), 1)[0];
        const q2 = queens.splice(rnd(0, queens.length - 1), 1)[0];
        this.wwibPairs.push({ q1, q2, theme: takeHoliday() });
      }
      s.big("Parejas de ¿Quién lo lleva mejor?");
      this.wwibPairs.forEach((p) => {
        s.q([p.q1.name, p.q2.name], undefined, `${p.q1.name} y ${p.q2.name}`);
        s.b("Tema festivo: " + p.theme);
        s.hr();
      });
    }

    // Retos que pueden jugarse en equipos (si hay entre 6 y 15 reinas).
    runTeamable(s, wantsTeam, getter) {
      const cast = this.current;
      if (this.opts.teams) { cast.forEach((q) => q[getter]()); cast.sort((a, b) => a.performanceScore - b.performanceScore); return; }
      if (wantsTeam && cast.length >= 6 && cast.length <= 15 && !this.flag.isTeam) {
        this.flag.isTeam = true;
        this.teamMaking(s);
      } else {
        this.flag.isTeam = false;
      }
      cast.forEach((q) => q[getter]());
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
    }

    // ---------- equipos y parejas ----------
    teamMaking(s) {
      const cast = this.current;
      let team1 = [], team2 = [], team3 = [];
      const captains = [];
      let castTeams = cast.slice();
      if (this.flag.miniHappen) {
        if (cast.length >= 9) {
          const a = cast[rnd(0, cast.length - 1)];
          let b;
          do { b = cast[rnd(0, cast.length - 1)]; } while (b === a);
          captains.push(a, b);
          castTeams = castTeams.filter((q) => q !== a && q !== b);
        } else {
          const a = cast[rnd(0, cast.length - 1)];
          captains.push(a);
          castTeams = castTeams.filter((q) => q !== a);
        }
      } else {
        cast.forEach((q) => {
          if (q.miniWinner) {
            captains.push(q);
            q.miniWinner = false;
            castTeams = castTeams.filter((x) => x !== q);
          }
        });
      }
      const take = (cap, count) => {
        const out = [];
        for (let i = 0; i < count && castTeams.length; i++) {
          const m = this.bestSister(cap, castTeams);
          out.push(m);
          castTeams = castTeams.filter((x) => x !== m);
        }
        return out;
      };
      s.hr();
      s.big("Equipos");
      const lbl = (names) => names.map((q) => q.name);
      let threeTeams = false;
      if (captains.length === 1) {
        const cap = captains[0];
        team1.push(cap);
        cap.tCaptain.push(this.episode);
        s.q([cap.name], "blue", this.flag.miniHappen
          ? `${cap.name}, puedes elegir a tu equipo para el reto de hoy`
          : `${cap.name}, como ganadora del mini reto puedes elegir a tu equipo para el reto de hoy`);
        if (cast.length <= 8) {
          let k = 2;
          if (cast.length === 7) k = rnd(0, 10) <= 5 ? 2 : 3;
          if (cast.length === 8) k = 3;
          team1.push(...take(cap, k));
          team2 = castTeams.slice();
        } else {
          threeTeams = true;
          const number = Math.floor(castTeams.length / 3);
          team1.push(...take(cap, number));
          shuffle(castTeams);
          team2 = castTeams.splice(0, Math.floor(castTeams.length / 2));
          team3 = castTeams.slice();
        }
        s.big("Equipo 1");
        const chosen = team1.slice(1).map((q) => q.name);
        s.q(lbl(team1), "blue", `${cap.name} eligió a ${list(chosen)}. ¡Y eso os convierte en el Equipo 1!`);
        s.p(cast.length <= 8 ? "Esto significa..." : "Y estos son los otros equipos...");
        s.big("Equipo 2");
        s.q(lbl(team2), "pink", `${list(lbl(team2))}. ¡Sois el equipo 2!`);
        if (threeTeams) {
          s.big("Equipo 3");
          s.q(lbl(team3), "green", `${list(lbl(team3))}. ¡Sois el equipo 3!`);
        }
      } else {
        const [c1, c2] = captains;
        team1.push(c1); team2.push(c2);
        c1.tCaptain.push(this.episode); c2.tCaptain.push(this.episode);
        s.q([c1.name, c2.name], "blue", this.flag.miniHappen
          ? `${c1.name} y ${c2.name}, podéis elegir a vuestros equipos para el reto de hoy`
          : `${c1.name} y ${c2.name}, como ganadoras del mini reto podéis elegir a vuestros equipos para el reto de hoy`);
        s.hr();
        let number = cast.length <= 8 ? Math.floor(castTeams.length / 2) : Math.floor(castTeams.length / 3);
        if (cast.length === 7) number++;
        for (let i = 0; i < number; i++) {
          let m = this.bestSister(c1, castTeams);
          team1.push(m); castTeams = castTeams.filter((x) => x !== m);
          s.q([c1.name, m.name], "blue", `¡${c1.name} eligió a ${m.name}!`);
          if (castTeams.length) {
            m = this.bestSister(c2, castTeams);
            team2.push(m); castTeams = castTeams.filter((x) => x !== m);
            s.q([c2.name, m.name], "pink", `¡${c2.name} eligió a ${m.name}!`);
          }
        }
        s.big("Equipo 1");
        s.q(lbl(team1), "blue", `${list(lbl(team1))}. ¡Sois el equipo 1!`);
        s.big("Equipo 2");
        s.q(lbl(team2), "pink", `${list(lbl(team2))}. ¡Sois el equipo 2!`);
        if (cast.length >= 9) {
          threeTeams = true;
          team3 = castTeams.slice();
          s.p("Las que no fueron elegidas formarán un equipo...");
          s.big("Equipo 3");
          s.q(lbl(team3), "green", `${list(lbl(team3))}. ¡Sois el equipo 3!`);
        }
      }
      this.teams = threeTeams ? [team1, team2, team3] : [team1, team2];
    }

    pairMaking(s) {
      const pool = this.current.slice();
      const pairs = [[], [], [], [], []];
      for (let r = 0; r < 2; r++) {
        pairs.forEach((p) => {
          const i = rnd(0, pool.length - 1);
          p.push(pool[i]);
          pool.splice(i, 1);
        });
      }
      s.hr();
      s.big("Parejas");
      pairs.forEach((p) => s.q(p.map((q) => q.name), undefined, `${p[0].name} y ${p[1].name} forman pareja.`));
      this.teams = pairs;
    }

    // ---------- actuaciones del reto (y pasarela) ----------
    queensPerformances(s) {
      const cast = this.current;
      s.hr();
      s.big(this.flag.wwib ? "¿Quién lo lleva mejor?" : "Actuaciones de las reinas...");
      cast.forEach((q) => {
        if (q.adv != null) { q.performanceScore -= q.adv; q.adv = undefined; }
      });
      if (this.flag.wwib) {
        this.flag.wwib = false;
        const describe = (q) => {
          const p = q.performanceScore;
          s.b(p < 6 ? `¡${q.name} arrasó en el reto!` : p < 16 ? `¡${q.name} hizo una gran actuación!`
            : p < 26 ? `${q.name} hizo una buena actuación.` : p < 31 ? `${q.name} tuvo dificultades con el reto.`
            : `${q.name} hizo una mala actuación...`);
        };
        (this.wwibPairs || []).forEach((pair) => {
          s.hr();
          s.b(pair.theme);
          const [w, l] = pair.q1.performanceScore < pair.q2.performanceScore ? [pair.q1, pair.q2] : [pair.q2, pair.q1];
          s.q([pair.q1.name, pair.q2.name], undefined, `${pair.q1.name} vs ${pair.q2.name}`);
          s.b(`¡${w.name} lo lleva mejor!`);
          describe(w);
          describe(l);
        });
      } else if (this.skipPerfDescription) {
        this.skipPerfDescription = false;
      } else {
        const by = (lo, hi) => cast.filter((q) => q.performanceScore >= lo && q.performanceScore < hi);
        const slay = by(-Infinity, 6), great = by(6, 16), good = by(16, 26), bad = by(26, 31), flop = by(31, Infinity);
        this.describeGroups(s, [
          [slay, "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en el reto!`],
          [great, "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran actuación!`],
          [good, undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena actuación.`],
          [bad, "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala actuación...`],
          [flop, "tomato", (l, pl) => `${l} ${pl ? "fracasaron" : "fracasó"} en el reto...`],
        ]);
        this.checkForSpecialEvents(slay, great, good, bad, flop);
      }
      if (this.flag.isDesign) {
        // Diseño, pasarela, Ball y transformación: no hay pasarela aparte.
        cast.forEach((q) => { q.runwayScore = 0; });
        s.button = "Ir al jurado";
        this.finishMaxi();
      } else {
        s.button = "Ir a la pasarela";
        if (this.opts.thailand) this.thaiRunway(s); else this.runway(s);
      }
    }

    describeGroups(s, groups) {
      groups.forEach(([qs, color, fmt]) => {
        if (!qs.length) return;
        shuffle(qs);
        const names = qs.map((q) => q.name);
        s.q(names, color, fmt(list(names), plural(names)));
      });
    }

    checkForSpecialEvents(slay, great, good, bad, flop) {
      if (this.opts.teams) return;
      const n = this.current.length, f = this.flag;
      if (slay.length === 0 && great.length === 0 && n >= 8 && !f.floppersCheck && rnd(0, 100) >= 80) f.floppers = true;
      if (slay.length === n && !f.slayersCheck) f.slayers = true;
      else if (slay.length + great.length === n && !f.slayersCheck && rnd(0, 100) >= 80) f.slayers = true;
      if (flop.length + bad.length >= 5 && flop.length + bad.length < 7 && n >= 9 && !f.bottom6Check && rnd(0, 100) >= 70) f.bottom6 = true;
      if (flop.length + bad.length >= 7 && great.length + slay.length + good.length > 0 && n > 7 && n < 10 && !f.s14Check && rnd(0, 100) >= 30) f.s14 = true;
    }

    runway(maxiScreen) {
      const s = this.newScreen("¡Maxi reto!", "Ir al jurado");
      s.blocks = maxiScreen.blocks.slice();
      s.hr();
      s.big("¡Pasarela!");
      const cast = this.current;
      s.p("¡Las reinas desfilarán por la pasarela!");
      s.p("La categoría es... " + (this.famCat = cast.length > 4 ? pick(D.runwayCategories) : "¡el mejor drag!"));
      cast.forEach((q) => q.getRunway());
      const by = (lo, hi) => cast.filter((q) => q.runwayScore >= lo && q.runwayScore < hi);
      const slay = by(-Infinity, 6), great = by(6, 16), good = by(16, 26), bad = by(26, Infinity);
      slay.forEach((q) => { q.runwayScore = 7; });
      great.forEach((q) => { q.runwayScore = 3; });
      good.forEach((q) => { q.runwayScore = 0; });
      bad.forEach((q) => { q.runwayScore = -3; });
      this.describeGroups(s, [
        [slay, "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en la pasarela!`],
        [great, "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran pasarela!`],
        [good, undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena pasarela.`],
        [bad, "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala pasarela...`],
      ]);
      this.finishMaxi();
    }

    // ---- Formato Thailand (temporadas 1 y 2): cada episodio tiene un maxi reto (solo se elige a la ganadora)
    // y luego un reto de pasarela que es el que se juzga (tops, bottoms, lip sync y eliminación). La casilla
    // del episodio combina las dos cosas ("WIN + HIGH", "WIN + BTM2"...). ----
    thaiRunway(maxiS) {
      const cast = this.current;
      maxiS.button = "Ir a la ganadora del maxi reto";
      const w = this.newScreen("¡Ganadora del maxi reto!", "Ir al reto de pasarela");
      w.b("Basándonos en las actuaciones de esta noche...");
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const winners = (cast[0].performanceScore === cast[1].performanceScore && rnd(0, 100) < 60) ? [cast[0], cast[1]] : [cast[0]];
      winners.forEach((q) => { q.trackRecord.push(winners.length > 1 ? " WIN" : "WIN"); q.favoritism += 4; q.maxiT = true; });
      if (winners.length > 1) w.q(winners.map((q) => q.name), "darkblue", `${winners[0].name}, ${winners[1].name}, condragulations, ¡sois las ganadoras del maxi reto de esta semana!`);
      else w.q([winners[0].name], "cyan", `${winners[0].name}, condragulations, ¡eres la ganadora del maxi reto de esta semana!`);

      const r = this.newScreen("¡Reto de pasarela!", "Ir al jurado");
      const makeover = (cast.length === 6 || cast.length === 5) && !this.flag.makeover;
      if (makeover) {
        r.b("¡Es el reto de transformación! Las reinas convertirán en sus hermanas drag " + pick(D.makeoverPeople) + ".");
        this.flag.makeover = true;
      } else {
        r.b("¡Las reinas desfilarán por la pasarela! La categoría es: " + (this.famCat = pick(D.runwayCategories)));
      }
      cast.forEach((q) => q.getRunwayChallenge());
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      cast.forEach((q) => { q.runwayScore = 0; });
      const by = (lo, hi) => cast.filter((q) => q.performanceScore >= lo && q.performanceScore < hi);
      this.describeGroups(r, [
        [by(-Infinity, 6), "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en la pasarela!`],
        [by(6, 16), "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran pasarela!`],
        [by(16, 26), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena pasarela.`],
        [by(26, Infinity), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala pasarela...`],
      ]);
      this.finishMaxi();
    }

    // Jurado de Thailand: sin panel de jueces ni críticas; el maxi ganador que queda SAFE conserva solo su "WIN".
    thaiJudgingScreen() {
      const s = this.newScreen("¡El jurado!", "Ver las decisiones");
      s.b("Basándonos en la pasarela de esta noche...");
      const judged = shuffle([...this.topQueens, ...this.bottomQueens]).map((q) => q.name);
      s.q(judged, "cyan", `${list(judged)}, representáis los tops y bottoms de la semana.`);
      s.hr();
      const safe = this.current.filter((q) => !this.topQueens.includes(q) && !this.bottomQueens.includes(q));
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
      return this.winAndBtm2();
    }

    finishMaxi() { this.judging(); }

    // ======================================================================================
    // JURADO
    // ======================================================================================
    judging() {
      const f = this.flag;
      const cast = this.current;
      const n = cast.length;
      if (f.isTeam && rnd(0, 100) >= 85) { f.isTeam = false; f.isNoTeam = true; }
      const top = this.topQueens, bottom = this.bottomQueens;
      // Rate-A-Queen (T16), episodio 3: los de arriba y los de abajo salen del ranking entre las reinas.
      let raqOrder = null;
      if (this.opts.raq && this.episode === 3 && n > 6) {
        const rs = this.newScreen("Rate-A-Queen", "Ir al jurado");
        rs.b("Esta semana, vuestro destino está en manos de vuestras competidoras: os toca puntuar a vuestras compañeras.");
        rs.hr();
        raqOrder = this.raqRanking(rs, cast);
      }
      const byPerf = () => (raqOrder
        ? cast.sort((a, b) => raqOrder.indexOf(a) - raqOrder.indexOf(b))
        : cast.sort((a, b) => a.performanceScore - b.performanceScore));

      // Normal Premiere (No Elimination): el episodio 1 tiene siempre 3 arriba y 3 abajo.
      if (this.qoc && this.qoc.active) return this.qocJudging();
      if (this.ggr && this.ggr.active) return this.ggrJudging();
      if (this.pyp && this.pyp.active) return this.pypJudging();
      if (this.premiereHalf && this.opts.raq) return this.raqPremiereJudging();
      if (this.premiereHalf && !this.opts.porkchopElim && (this.opts.doubleNoElim || this.opts.globalAS)) return this.doubleNoElimJudging();
      if (this.lateNow()) return this.lateJudging();
      if (this.uk3Now()) {
        byPerf();
        for (let i = 0; i < 3; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        return this.judgingScreen();
      }
      if (this.slayNow()) {
        byPerf();
        if (cast[n - 3].performanceScore > 25) {
          for (let i = 0; i < 3; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        } else {
          for (let i = 0; i < n / 2; i++) top.push(cast[i]);
        }
        return this.judgingScreen();
      }
      if (this.opts.lftw && n >= 4 && !this.slayNow() && !this.noElimNow() && !this.premiereHalf && !this.splitNow) {
        // Lipsync for the win: cada semana un Top 2 (o 3) y un Bottom 2 (o 3, 4) como en el estreno UK3
        byPerf();
        f.isTeam = false; f.isPair = false; f.isNoTeam = false;
        const r = rnd(0, 100);
        const tc = n >= 10 && r < 25 ? 4 : n >= 7 && r < 65 ? 3 : n >= 5 && r < 35 ? 3 : 2;
        const rb = rnd(0, 100);
        let bc = rb < 30 ? 2 : rb < 70 ? 3 : 4;
        bc = Math.min(bc, n <= 6 ? 3 : 4, n - tc - (n <= 4 ? 0 : 0));
        for (let i = 0; i < tc; i++) top.push(cast[i]);
        for (let i = 0; i < bc; i++) bottom.push(cast[n - (i + 1)]);
        f.lftwJ = { threeWay: tc === 3 && rnd(0, 100) < 25 };
        return this.judgingScreen();
      }
      if (this.tour) return this.tournamentJudging();
      if (this.raqMerge && this.current.length > 3) return this.raqMergeJudging();
      if (this.opts.winners) return this.winnersJudging();
      if (this.opts.teams) return this.teamJudging();
      if (this.noElimNow()) {
        byPerf();
        for (let i = 0; i < 3; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        return this.judgingScreen();
      }
      if (f.isPair && n === 10 && this.teams.length === 5) {
        const arr = this.teams.map((pairQueens) => ({
          queens: pairQueens,
          score: pairQueens.reduce((s, q) => s + q.performanceScore, 0) / pairQueens.length,
        })).sort((a, b) => a.score - b.score);
        arr[0].queens.forEach((q) => top.push(q));
        arr[1].queens.forEach((q) => top.push(q));
        arr[4].queens.forEach((q) => bottom.push(q));
        arr[3].queens.forEach((q) => bottom.push(q));
        byPerf();
        return this.judgingScreen();
      }
      if (f.isTeam && n >= 6 && this.teams.length >= 2) {
        const arr = this.teams.map((ts) => ({
          queens: ts,
          score: ts.reduce((s, q) => s + q.performanceScore, 0) / ts.length,
        })).sort((a, b) => a.score - b.score);
        const topTeam = arr[0], bottomTeam = arr[arr.length - 1];
        topTeam.queens.forEach((q) => top.push(q));
        const worst = bottomTeam.queens.slice().sort((a, b) => b.performanceScore - a.performanceScore);
        worst.slice(0, 3).forEach((q) => bottom.push(q));
        byPerf();
        return this.judgingScreen();
      }
      if (n >= 10 && f.bottom6 && !f.bottom6Check) {
        byPerf();
        for (let i = 0; i < 3; i++) top.push(cast[i]);
        for (let i = 0; i < 6; i++) bottom.push(cast[n - (i + 1)]);
        f.bottom6 = false;
        return this.judging6Way();
      }
      if (n >= 8 && f.floppers && !f.floppersCheck) {
        byPerf();
        for (let i = 0; i < 3; i++) bottom.push(cast[n - (i + 1)]);
        f.floppers = false;
        return this.judgingFloppers();
      }
      if (n >= 4 && f.slayers && !f.slayersCheck) {
        byPerf();
        cast.forEach((q) => top.push(q));
        f.slayers = false;
        return this.judgingSlayers();
      }
      if (n >= 8 && n < 10 && f.s14 && !f.s14Check) {
        byPerf();
        top.push(cast[0]);
        for (let i = 1; i < n; i++) bottom.push(cast[i]);
        f.s14 = false;
        return this.judgingLaLaPaRUZa();
      }
      if (this.opts.thailand && n > 6) {
        byPerf();
        const k = n > 13 ? 4 : 3;
        for (let i = 0; i < k; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        return this.judgingScreen();
      }
      if (n > 13) {
        byPerf();
        for (let i = 0; i < 4; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        if (cast[3].performanceScore > 17) top.splice(top.indexOf(cast[3]), 1);
        else if (cast[4].performanceScore < 10) top.push(cast[4]);
        if (cast[n - 4].performanceScore < 16) bottom.splice(bottom.indexOf(cast[n - 4]), 1);
        return this.judgingScreen();
      }
      if (n > 6) {
        byPerf();
        for (let i = 0; i < 3; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        if (cast[2].performanceScore > 17) top.splice(top.indexOf(cast[2]), 1);
        else if (cast[3].performanceScore < 10) top.push(cast[3]);
        if (cast[n - 3].performanceScore < 16) bottom.splice(bottom.indexOf(cast[n - 3]), 1);
        return this.judgingScreen();
      }
      if (n === 6) {
        byPerf();
        for (let i = 0; i < 3; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        if (cast[3].performanceScore < 10) {
          top.push(cast[3]);
          bottom.splice(bottom.indexOf(cast[n - 3]), 1);
        }
        let showJudging = false;
        if (cast[n - 3].performanceScore < 16 && cast[n - 3].performanceScore >= 10) {
          bottom.splice(bottom.indexOf(cast[n - 3]), 1);
          showJudging = true;
        }
        if (showJudging) this.markSafeOnly(); // el único "safe" de la semana; no hay pantalla de jurado
        return this.winAndBtm2();
      }
      if ((this.opts.assassin || this.opts.fatal) && n <= 4) {
        byPerf();
        top.push(cast[0]);
        cast.slice(1).forEach((q) => bottom.push(q));
        return this.winAndBtm2();
      }
      if (n === 5) {
        byPerf();
        top.push(cast[0], cast[1]);
        if (cast[2].performanceScore < 16) top.push(cast[2]); else bottom.push(cast[2]);
        bottom.push(cast[3], cast[4]);
        return this.winAndBtm2();
      }
      if (n === 4) {
        byPerf();
        top.push(cast[0], cast[1]);
        bottom.push(cast[2], cast[3]);
        return this.winAndBtm2();
      }
      byPerf(); // 3 reinas
      if (this.opts.legacy) { top.push(cast[0], cast[1]); bottom.push(cast[2]); return this.winAndBtm2(); }
      top.push(cast[0]);
      bottom.push(cast[1], cast[2]);
      return this.winAndBtm2();
    }

    // UK3 Premiere / Normal Premiere (Top 2 & Bottom 2): reto de pasarela con dos looks; 3 arriba y 3
    // abajo. La tercera de arriba es HIGH, las dos primeras hacen lip sync por la victoria (WIN / TOP2);
    // de las tres de abajo la mejor se salva (LOW) y las otras dos hacen lip sync por su vida.
    uk3Judging() {
      const top = this.topQueens.sort((a, b) => a.performanceScore - b.performanceScore);
      const bottom = this.bottomQueens;
      const s = this.newScreen("¡Traed de vuelta a mis chicas!", "Ir al lip sync");
      s.b("Chicas, he tomado algunas decisiones...");
      const high = top[2];
      high.addTR("HIGH"); high.favoritism += 1; high.ppe += 4;
      s.q([high.name], "lightblue", `${high.name}, buen trabajo esta semana, estás a salvo.`);
      const two = [top[0], top[1]];
      s.q(two.map((q) => q.name), "cyan", `${two[0].name}, ${two[1].name}, condragulations, ¡sois el Top 2 de la semana!`);
      s.hr();
      s.b("¡El Top 2 hará ahora lip sync... por la victoria!");
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(s);
      s.hr();
      this.lipsyncEvent(s, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(s, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);

      const r = this.newScreen("He tomado mi decisión.", "Continuar");
      this.addSong([two[0]], [two[1]], song);
      r.q([two[0].name], "royalblue", `${two[0].name}, ¡eres una ganadora, baby!`);
      r.q([two[1].name], "deepskyblue", `${two[1].name}, estás a salvo.`);
      two[0].addTR("WIN"); two[0].favoritism += 5; two[0].ppe += 5;
      two[1].addTR("TOP2"); two[1].favoritism += 2; two[1].ppe += 4.5;
      r.hr();
      r.b("Ahora...");
      r.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, sois las peores de la semana...`);
      bottom.forEach((q) => { q.performanceScore -= q.runwayScore; });
      bottom.sort((a, b) => a.performanceScore - b.performanceScore);
      const safe = bottom.shift();
      safe.addTR("LOW"); safe.unfavoritism += 1; safe.ppe += 2;
      r.q([safe.name], "pink", `${safe.name}... estás a salvo.`);
      r.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, lo siento, queridas, pero estáis en riesgo de eliminación.`);
      this.topQueens = [];
      return this.lipsyncDesc();
    }

    // Lipsync for the win: como el UK3 pero cada semana. Las dos (o tres) mejores hacen lip sync por la victoria (puede
    // ganar una sola, ganar las dos o haber una tercera en HIGH) y las peores hacen lip sync por su vida: dos, tres a la vez
    // (con 1 o 2 eliminadas) o cuatro en el bottom (las dos mejores se salvan con LOW). Nada de esto cambia el lip sync de
    // abajo: se reutiliza el de siempre (doble shantay, doble sashay, etc.).
    lftwJudging() {
      const f = this.flag, cfg = f.lftwJ;
      f.lftwJ = null;
      const top = this.topQueens;
      const bottom = this.bottomQueens;
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      const s = this.newScreen("¡Traed de vuelta a mis chicas!", "Ir al lip sync");
      s.b("Chicas, he tomado algunas decisiones...");
      let contenders = top.slice(0, 2);
      if (top.length >= 3) {
        if (cfg.threeWay) contenders = top.slice();
        else {
          const highs = top.slice(2);
          highs.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
          s.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, buen trabajo esta semana, ${highs.length > 1 ? "estáis" : "estás"} a salvo.`);
        }
      }
      s.q(contenders.map((q) => q.name), "cyan", `${list(contenders.map((q) => q.name))}, condragulations, ¡${contenders.length === 3 ? "sois el Top 3" : "sois el Top 2"} de la semana!`);
      s.hr();
      s.b(`¡${contenders.length === 3 ? "Las tres" : "Las dos"} haréis ahora lip sync... por la victoria!`);
      contenders.forEach((q) => q.getASLipsync());
      const song = this.pickSong(s);
      s.hr();
      this.lipsyncEvent(s, contenders);
      const raw = contenders.map((q) => q.lipsyncScore);
      this.lipsyncGroups(s, contenders, song);
      contenders.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      contenders.sort((a, b) => b.lipsyncScore - a.lipsyncScore);

      const r = this.newScreen("He tomado mi decisión.", "Continuar");
      const doubleOk = !this.tw.has("DISABLE_DOUBLE") && contenders[0].lipsyncScore > 5 && contenders[1].lipsyncScore > 5;
      const dbl = doubleOk && rnd(0, 100) < (contenders.length === 3 ? 20 : 30);
      if (dbl) {
        const pair = contenders.slice(0, 2);
        this.addSong(pair, contenders.slice(2), song);
        pair.forEach((q) => { q.addTR(" WIN"); q.favoritism += 5; q.ppe += 5; });
        r.q(pair.map((q) => q.name), "darkblue", `${pair[0].name}, ${pair[1].name}, condragulations, ¡las dos habéis ganado el reto de hoy!`);
        this.gbm = pair;
      } else {
        const w = contenders[0];
        this.addSong([w], contenders.slice(1), song);
        w.addTR("WIN"); w.favoritism += 5; w.ppe += 5;
        r.q([w.name], "royalblue", `${w.name}, ¡eres una ganadora, baby!`);
        this.gbm = [w];
        this.twistWinner(r, w);
      }
      contenders.slice(dbl ? 2 : 1).forEach((q) => {
        q.addTR("TOP2"); q.favoritism += 2; q.ppe += 4.5;
        r.q([q.name], "deepskyblue", `${q.name}, estás a salvo.`);
      });
      r.hr();
      r.b("Ahora...");
      r.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, sois las peores de la semana...`);
      bottom.forEach((q) => { q.performanceScore -= q.runwayScore; });
      bottom.sort((a, b) => a.performanceScore - b.performanceScore);
      this.twistBottom(r, bottom);
      const lowSafe = (count) => {
        const safe = bottom.splice(0, count);
        safe.forEach((q) => { q.addTR("LOW"); q.unfavoritism += 1; q.ppe += 2; });
        r.q(safe.map((q) => q.name), "pink", `${list(safe.map((q) => q.name))}... ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
      };
      if (bottom.length >= 4) lowSafe(bottom.length - 2);
      else if (bottom.length === 3) {
        if (this.current.length > 5 && rnd(0, 100) < 45) { f.thirdqueen = true; r.b("... nadie está a salvo."); }
        else lowSafe(1);
      }
      r.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, lo siento, queridas, pero ${bottom.length > 1 ? "estáis" : "estás"} en riesgo de eliminación.`);
      this.topQueens = [];
      return this.lipsyncDesc();
    }

    // Normal Premiere (Slayers / Top 2): en el episodio 1 nadie se va. Con 3 reinas flojas abajo hay
    // 3 arriba y 3 abajo (las de abajo se salvan con LOW); si no, la mitad mejor está arriba. Las dos
    // mejores hacen lip sync por la victoria (WIN / TOP2) y el resto de las de arriba son HIGH.
    slayersJudging() {
      const top = this.topQueens.sort((a, b) => a.performanceScore - b.performanceScore);
      const bottom = this.bottomQueens;
      const s = this.newScreen("¡Traed de vuelta a mis chicas!", "Ir al lip sync");
      s.b("Chicas, he tomado algunas decisiones...");
      const highs = bottom.length ? [top[2]] : top.slice(2);
      highs.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
      if (highs.length) s.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
      s.hr();
      if (bottom.length) {
        bottom.forEach((q) => { q.addTR("LOW"); q.unfavoritism += 1; q.ppe += 2; });
        s.q(bottom.map((q) => q.name), "pink", `${list(bottom.map((q) => q.name))}, sois las peores de la semana... pero estáis a salvo.`);
        s.hr();
      }
      const two = [top[0], top[1]];
      s.q(two.map((q) => q.name), "cyan", `${two[0].name}, ${two[1].name}, condragulations, ¡sois el Top 2 de la semana! Haréis lip sync por la victoria.`);

      const e = this.newScreen("Ha llegado la hora...", "Ver el resultado");
      e.b("Para que hagáis lip sync... ¡por la VICTORIA! Buena suerte, y no la caguéis.");
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);

      const r = this.newScreen("He tomado mi decisión.", "Continuar");
      this.addSong([two[0]], [two[1]], song);
      r.q([two[0].name], "royalblue", `${two[0].name}, ¡eres una ganadora, baby!`);
      r.q([two[1].name], "deepskyblue", `${two[1].name}, estás a salvo.`);
      two[0].addTR("WIN"); two[0].favoritism += 5; two[0].ppe += 5;
      two[1].addTR("TOP2"); two[1].favoritism += 2; two[1].ppe += 4.5;
      this.topQueens = []; this.bottomQueens = [];
      return this.untucked();
    }

    // Normal Premiere (Late Entry): en el episodio 1 falta una reina (elegida al azar). Hay un reto de
    // pasarela con dos looks, 3 reinas arriba, nadie abajo y nadie se va; luego la reina tardía entra.
    lateJudging() {
      const cast = this.current;
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const top = cast.slice(0, 3);
      const s = this.newScreen("¡El jurado!", "Continuar");
      s.p("En este estreno, por primera vez en la herstory de Drag Race... ¡nadie se va a casa esta noche!");
      s.b("Ahora, basándonos en las actuaciones de esta noche...");
      s.hr();
      s.q(top.map((q) => q.name), "cyan", `${list(top.map((q) => q.name))}, representáis los tops de la semana.`);
      s.hr();
      const safe = cast.filter((q) => !top.includes(q));
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo...`);
      s.hr();
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      let rest = top;
      if (top[0].performanceScore === top[1].performanceScore && rnd(0, 100) < 60) {
        top.slice(0, 2).forEach((q) => { q.addTR(" WIN"); q.favoritism += 5; q.ppe += 5; });
        s.q([top[0].name, top[1].name], "darkblue", `${top[0].name}, ${top[1].name}, condragulations, ¡sois las ganadoras del reto de hoy!`);
        rest = top.slice(2);
      } else {
        top[0].addTR("WIN"); top[0].favoritism += 5; top[0].ppe += 5;
        s.q([top[0].name], "royalblue", `${top[0].name}, condragulations, ¡eres la ganadora del reto de hoy!`);
        rest = top.slice(1);
      }
      rest.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
      if (rest.length) s.q(rest.map((q) => q.name), "lightblue", `${list(rest.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);

      const w = this.newScreen("¡Esperad un momento, esperad un momento!", "Continuar");
      w.big("¡Tengo un último anuncio!");
      w.b("La verdadera competición está a punto de empezar... ¡voy a presentar a una nueva reina en la carrera!");
      w.b(`Por favor, dad la bienvenida a la carrera a... ¡¡${this.late.name}!!`);
      w.q([this.late.name], "royalblue");
      this.late.addTR("");
      this.current.push(this.late);
      this.lateDone = true;
      this.topQueens = []; this.bottomQueens = [];
    }

    lateNow() { return !!this.late && !this.lateDone && this.episode === 1; }

    // Double Premiere (No Elimination) / (Top 2): cada mitad hace un reto de Girl Group; 2 reinas arriba
    // (lip sync por la victoria), 2 HIGH, 2 LOW y el resto SAFE. Nadie se va.
    doubleNoElimJudging() {
      const cast = this.current;
      const n = cast.length;
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const top = [cast[0], cast[1]];
      let highs = [], lows = [];
      if (this.opts.globalAS) highs = cast.slice(2);
      else if (n >= 6) { highs = [cast[2], cast[3]]; lows = [cast[n - 2], cast[n - 1]]; }
      const safe = cast.filter((q) => !top.includes(q) && !highs.includes(q) && !lows.includes(q));
      highs.forEach((q) => { q.addTR("HIGH"); q.ppe += 4; });
      lows.forEach((q) => { q.addTR("LOW"); q.ppe += 2; });
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      top.forEach((q) => { q.ppe += this.opts.globalAS ? 4 : 3; });
      const s = this.newScreen("¡Traed de vuelta a mis chicas!", "Ir al lip sync");
      s.b("Chicas, he tomado algunas decisiones...");
      s.q(top.map((q) => q.name), "cyan", `${top[0].name}, ${top[1].name}, condragulations, ¡sois el Top 2 de la semana!`);
      s.p("¡Nadie se va a casa esta noche!");
      s.hr();
      if (highs.length) s.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, buen trabajo, estáis a salvo.`);
      if (lows.length) s.q(lows.map((q) => q.name), "pink", `${list(lows.map((q) => q.name))}, no fue vuestra mejor semana, pero estáis a salvo.`);
      if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
      s.hr();
      const e = this.newScreen("¡El Top 2 hará lip sync por la victoria!", "Ver el resultado");
      top.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, top);
      const raw = top.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, top, song);
      top.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      top.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const r = this.newScreen("He tomado mi decisión.", "Continuar");
      this.addSong([top[0]], [top[1]], song);
      r.q([top[0].name], "royalblue", `${top[0].name}, ¡eres una ganadora, baby!`);
      r.q([top[1].name], "deepskyblue", `${top[1].name}, estás a salvo.`);
      top[0].addTR("WIN"); top[0].favoritism += 5; top[0].ppe += 2;
      top[1].addTR("TOP2"); top[1].favoritism += 2; top[1].ppe += 1.5;
      this.topQueens = []; this.bottomQueens = [];
    }

    // Porkchop Premiere: episodio 1 solo de lip syncs. Todas se emparejan al azar (la última pareja es
    // un trío con un reparto impar); la ganadora de cada lip sync pasa al primer grupo y la/s perdedora/s
    // "se llevan la chuleta" y pasan al segundo, que vota a una de las suyas para cambiarla al primero.
    porkchopLipsyncs() {
      this.episode++;
      this.episodeChallenges.push("Lipsync");
      const s = this.newScreen("Ha llegado la hora...", "Continuar");
      s.p("Tras entrar en el taller, es hora de que las reinas hagan lip sync... ¡por sus vidas!");
      const pool = shuffle(this.current.slice());
      const first = [], second = [];
      const groups = [];
      while (pool.length) groups.push(pool.length === 3 ? pool.splice(0, 3) : pool.splice(0, 2));
      groups.forEach((g) => {
        s.hr();
        s.q(g.map((q) => q.name), "royalblue", `${list(g.map((q) => q.name))} harán lip sync...`);
        g.forEach((q) => q.getASLipsync());
        const song = this.pickSong(s);
        this.lipsyncEvent(s, g);
        g.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        this.addSong([g[0]], g.slice(1), song);
        s.q([g[0].name], "green", `${g[0].name}, ¡shantay, te quedas!`);
        g[0].favoritism += 1;
        g[0].addTR(" WIN ");
        first.push(g[0]);
        const out = g.slice(1);
        s.q(out.map((q) => q.name), "orange", `${list(out.map((q) => q.name))}, os lleváis la chuleta...`);
        out.forEach((q) => { q.addTR("LOSS"); second.push(q); });
      });
      s.hr();
      s.big("Las reinas de la chuleta votarán para sacar a una de su grupo...");
      second.forEach((q) => { q.votes = 0; });
      const vote = (voters, cands, intro) => {
        voters.forEach((v) => {
          const c = pick(cands.filter((x) => x !== v));
          c.votes++;
          s.p(`¡${v.name} votó a ${c.name}!`);
        });
      };
      vote(second, second);
      s.hr();
      s.b("¡Los resultados están aquí..!");
      second.forEach((q) => s.b(`${q.name}: ${q.votes} votos`));
      s.hr();
      second.sort((a, b) => b.votes - a.votes);
      let chosen = second[0];
      if (second.length > 1 && second[0].votes === second[1].votes) {
        s.b(`Hay un empate: las reinas deben votar otra vez entre ${second[0].name} y ${second[1].name}!!`);
        const tied = [second[0], second[1]];
        tied.forEach((q) => { q.votes = 0; });
        second.forEach((v) => {
          const c = pick(tied.filter((x) => x !== v));
          c.votes++;
          s.p(`¡${v.name} votó a ${c.name}!`);
        });
        tied.sort((a, b) => b.votes - a.votes);
        chosen = tied[0];
      }
      s.q([chosen.name], "orange", `¡La reina que se lleva la chuleta es... ${chosen.name}!`);
      chosen.trackRecord.pop();
      chosen.addTR("LOSS ");
      first.push(chosen);
      second.splice(second.indexOf(chosen), 1);
      second.forEach((q) => { q.votes = 0; });
      this.porkGroups = { first, second };
    }

    // Rate-A-Queen: cada reina ordena a las demás (por su último reto o al azar, corregido por las
    // relaciones) y la media de puestos decide el orden (la media más baja es la mejor).
    raqRanking(s, cast) {
      cast.forEach((q) => { q.votes = 0; });
      shuffle(cast.slice()).forEach((v) => {
        const others = cast.filter((q) => q !== v);
        const byPerformance = rnd(0, 100) <= 50;
        const key = (q) => {
          let k = byPerformance ? q.performanceScore : rnd(10, 40);
          k -= this.rel(v, q) * 1.5;
          if (v.allies.has(q)) k -= 5; else if (v.friends.has(q)) k -= 2; else if (v.enemies.has(q)) k += 5;
          return k + rnd(-3, 3);
        };
        const scored = new Map(others.map((q) => [q, key(q)]));
        const ranked = others.sort((a, b) => scored.get(a) - scored.get(b));
        s.q([v.name], undefined, `${v.name} ha ordenado:`);
        ranked.forEach((q, j) => { s.p(`${j + 1}: ${q.name}`); q.votes += j + 1; });
        s.hr();
      });
      cast.forEach((q) => { q.votes /= (cast.length - 1); });
      const order = cast.slice().sort((a, b) => a.votes - b.votes);
      s.b("Y ese es... el chisme.");
      cast.forEach((q) => { q.votes = 0; });
      return order;
    }

    // Premiere Rate-A-Queen (T16): en los dos estrenos las reinas se puntúan entre sí y las dos mejor
    // valoradas hacen lip sync por la victoria; el resto SAFE. Nadie se va.
    raqPremiereJudging() {
      const cast = this.current;
      const s = this.newScreen("Rate-A-Queen", "Ir al lip sync");
      s.b("Esta semana, vuestro destino está en manos de vuestras competidoras: os toca puntuar a vuestras compañeras.");
      s.hr();
      s.b("Los puestos ya están aquí...");
      const order = this.raqRanking(s, cast);
      const top = [order[0], order[1]];
      cast.forEach((q) => { q.ppe += 3; if (!top.includes(q)) q.addTR("SAFE"); });
      s.hr();
      s.q(top.map((q) => q.name), "cyan", `${top[0].name}, ${top[1].name}, condragulations, ¡sois el Top 2 de la semana! ¡Nadie se va a casa esta noche!`);
      const e = this.newScreen("¡El Top 2 hará lip sync por la victoria!", "Ver el resultado");
      top.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, top);
      const raw = top.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, top, song);
      top.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      top.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const r = this.newScreen("He tomado mi decisión.", "Continuar");
      this.addSong([top[0]], [top[1]], song);
      if (this.episode <= 2) { top[0].immPotion = true; r.q([top[0].name], "royalblue", `${top[0].name}, ¡eres una ganadora, baby! ¡Has ganado inmunidad contra una futura eliminación!`); }
      else r.q([top[0].name], "royalblue", `${top[0].name}, ¡eres una ganadora, baby!`);
      r.q([top[1].name], "deepskyblue", `${top[1].name}, estás a salvo.`);
      top[0].addTR("WIN"); top[0].favoritism += 5; top[0].ppe += 2;
      top[1].addTR("TOP2"); top[1].favoritism += 2; top[1].ppe += 1.5;
      this.topQueens = []; this.bottomQueens = [];
    }

    // ---- Pociones de inmunidad (temporada 16 / Rate-A-Queen): copia de drinkornot, usePotion y potionChoice ----
    stills16() {
      const t = this.total, n = this.current.length;
      return (t <= 10 && t > 7 && n >= 6) || (t > 10 && n >= 7);
    }

    usePotion(q) {
      const sorted = this.current.slice().sort((a, b) => a.performanceScore - b.performanceScore);
      const t = this.total, n = sorted.length;
      const idx = sorted.indexOf(q), position = n - idx;
      if (((t <= 10 && t > 7 && n === 6) || (t > 10 && n === 7)) && rnd(0, 100) >= 5) return true;
      if (position <= 3 && rnd(0, 100) >= 5) return true;
      if (position > 3 && idx <= 3 && rnd(0, 100) <= 5) return false;
      if (position > 3 && position < 6 && idx > 2 && rnd(0, 100) <= 15) return true;
      return false;
    }

    potionChoice(q) {
      const sorted = this.current.slice().sort((a, b) => a.performanceScore - b.performanceScore);
      const t = this.total, n = sorted.length;
      const idx = sorted.indexOf(q), position = n - idx;
      if (position <= 3 || (position > 3 && position < 6 && idx > 2)) return q;
      const friends = [...q.friends].filter((x) => this.current.includes(x));
      if (((t <= 10 && t > 7 && n === 6) || (t > 10 && n === 7 && !friends.length)) || !friends.length) return this.bestSister(q, this.current);
      return this.bestSister(q, friends.length > 1 ? friends : [q, friends[0]]);
    }

    // Una reina con poción puede usarla en el jurado para salvarse a sí misma o regalársela a otra.
    drinkOrNot(s) {
      if (!this.stills16()) return;
      const top = this.topQueens, bottom = this.bottomQueens;
      const col = this.episode - 1;
      const removeFromJudged = (q) => {
        q.immPotion = false;
        q.immuneCols.push(col);
        if (top.includes(q)) top.splice(top.indexOf(q), 1);
        else if (bottom.includes(q)) {
          bottom.splice(bottom.indexOf(q), 1);
          if (bottom.length < 2) {
            const sorted = this.current.slice().sort((a, b) => a.performanceScore - b.performanceScore);
            for (let y = sorted.length - 1; y >= 0; y--) {
              if (!(sorted[y].immuneCols.includes(col) || bottom.includes(sorted[y]))) { bottom.push(sorted[y]); break; }
            }
          }
        }
      };
      this.current.slice().forEach((q) => {
        if (!q.immPotion || this.current.length < 6) return;
        s.hr();
        const t = this.total;
        const last = (t <= 10 && t > 7 && this.episode > 2 && this.current.length === 6) || (t > 10 && this.current.length === 7);
        s.q([q.name], "magenta", last
          ? `${q.name}, esta es tu última oportunidad antes de que caduque. ¿Quieres usar tu poción de inmunidad esta semana?`
          : `${q.name}, ¿quieres usar tu poción de inmunidad esta semana?`);
        if (!this.usePotion(q)) { s.p(`${q.name} dijo que no.`); s.hr(); return; }
        s.p(`${q.name} dijo que sí.`);
        s.hr();
        s.b(`${q.name}, ¿quieres salvarte a ti misma o a una de tus competidoras?`);
        const target = this.potionChoice(q);
        if (target === q) {
          s.p(`${q.name} quiere salvarse a sí misma.`);
          s.hr();
          s.q([q.name], "black", `${q.name}, estás a salvo para brillar otro día.`);
          s.hr();
          removeFromJudged(q);
        } else {
          s.q([q.name, target.name], "magenta", `${q.name} quiere salvar a ${target.name}.`);
          this.modRelation(2, [q, target]);
          s.hr();
          s.b(`${target.name}, ¿aceptas el regalo de inmunidad de ${q.name}?`);
          if (this.usePotion(q)) {
            s.p(`${target.name} dijo que sí.`);
            s.hr();
            s.q([target.name], undefined, `${target.name}, estás a salvo para brillar otro día.`);
            s.hr();
            q.immPotion = false;
            removeFromJudged(target);
          } else {
            s.p(`${target.name} dijo que no.`);
            s.hr();
          }
        }
      });
    }

    // ======================================================================================
    // FORMATO TEAMS: parejas fijas durante toda la temporada
    // ======================================================================================
    teamsFlat() { return this.current.flatMap((t) => (t.isTeam ? [t.QueenA, t.QueenB] : [t])); }

    // suma (o resta) favoritismo, desfavoritismo y PPE al equipo y a sus dos reinas
    tAdd(team, { fav = 0, unfav = 0, ppe = 0 }) {
      [team, team.QueenA, team.QueenB].forEach((q) => { q.favoritism += fav; q.unfavoritism += unfav; q.ppe += ppe; });
    }

    teamMini(s) {
      s.b("¡El mini reto de hoy pone a prueba a las parejas!");
      const w = pick(this.current);
      s.q([w.QueenA.name, w.QueenB.name], "royalblue", `¡${w.name} ha ganado el mini reto!`);
      [w, w.QueenA, w.QueenB].forEach((q) => q.miniEpisode.push(this.episode));
    }

    teamChallenge() {
      const n = this.current.length;
      if (this.episode === 1) return pick(["design", "runway"]);
      if (!this.flag.snatch && n <= 5) return "snatch";
      if (!this.flag.ball && n === 3) return "ball";
      if (n > 5 && !this.flag.rusical && rnd(0, 20) >= 19) return "rusical";
      return this.randomMaxi();
    }

    teamJudging() {
      const cast = this.current;
      const n = cast.length;
      cast.forEach((t) => { t.QueenA.episodesOn++; t.QueenB.episodesOn++; });
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const top = [], bottom = [];
      if (n === 3) { top.push(cast[0]); bottom.push(cast[2], cast[1]); }
      else if (n === 4) { top.push(cast[0], cast[1]); bottom.push(cast[3], cast[2]); }
      else { top.push(cast[0], cast[1]); bottom.push(cast[n - 1], cast[n - 2], cast[n - 3]); }
      const names = (ts) => ts.flatMap((t) => [t.QueenA.name, t.QueenB.name]);
      const s = this.newScreen("¡El jurado!", "Ver las decisiones");
      s.b("Basándonos en las actuaciones de esta noche...");
      const judged = shuffle([...top, ...bottom]);
      s.q(names(judged), "cyan", `${list(judged.map((t) => t.name))}, representáis los tops y bottoms de la semana.`);
      s.hr();
      const safe = cast.filter((t) => !top.includes(t) && !bottom.includes(t));
      safe.forEach((t) => { t.addTR("SAFE"); this.tAdd(t, { ppe: 3 }); });
      if (safe.length) s.q(names(safe), undefined, `${list(safe.map((t) => t.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);

      // ganadores y bottoms
      const w = this.newScreen("¡Traed de vuelta a mis reinas!", "Ir al lip sync");
      w.b("Chicas, he tomado algunas decisiones...");
      top.forEach((t) => this.rigAdj(t));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      top[0].addTR("WIN"); this.tAdd(top[0], { fav: 5, ppe: 5 });
      w.q([top[0].QueenA.name, top[0].QueenB.name], "royalblue", `${top[0].name}, condragulations, ¡sois las ganadoras del reto de esta semana!`);
      if (top[1]) {
        top[1].addTR("HIGH"); this.tAdd(top[1], { fav: 1, ppe: 4 });
        w.q([top[1].QueenA.name, top[1].QueenB.name], "cyan", `${top[1].name}, buen trabajo esta semana, estáis a salvo.`);
      }
      w.hr();
      if (bottom.length > 2) {
        w.p(`${list(bottom.map((t) => t.name))}, sois las peores de la semana...`);
        bottom.forEach((t) => { t.performanceScore -= t.runwayScore; });
        bottom.sort((a, b) => a.performanceScore - b.performanceScore);
        const low = bottom.shift();
        low.addTR("LOW"); this.tAdd(low, { unfav: 1, ppe: 2 });
        w.q([low.QueenA.name, low.QueenB.name], "pink", `${low.name}, estáis a salvo.`);
      }
      w.q(names(bottom), "tomato", `${bottom[0].name}, ${bottom[1].name}, lo siento, queridas, pero estáis en riesgo de eliminación.`);
      this.teamLipsync(bottom);
    }

    // Lip sync entre los dos equipos de abajo: de cada equipo hace lip sync una de las dos reinas (al azar).
    teamLipsync(bottom) {
      const e = this.newScreen("Ha llegado la hora...", "Ver el resultado");
      e.b("Para que hagáis lip sync... ¡por vuestras vidas! Buena suerte, y no la caguéis.");
      const lips = bottom.map((t) => (rnd(0, 100) <= 50 ? t.QueenA : t.QueenB));
      e.q(lips.map((q) => q.name), "silver", `${lips[0].name} y ${lips[1].name} harán lip sync.`);
      const song = this.pickSong(e);
      e.hr();
      lips.forEach((q) => q.getLipsync());
      bottom.forEach((t, i) => { t.lipsyncScore = lips[i].lipsyncScore + t.favoritism - t.unfavoritism; });
      const before = lips.map((q) => q.lipsyncScore);
      this.lipsyncEvent(e, lips);
      bottom.forEach((t, i) => { t.lipsyncScore += lips[i].lipsyncScore - before[i]; });
      const by = (lo, hi) => lips.filter((q) => q.lipsyncScore >= lo && q.lipsyncScore < hi);
      this.describeGroups(e, [
        [by(12, Infinity), undefined, (l, pl) => `¡¡${l} ${pl ? "arrasaron" : "arrasó"} en el lip sync!!`],
        [by(8, 12), undefined, (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} un gran lip sync!`],
        [by(4, 8), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} un buen lip sync.`],
        [by(2, 4), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} un mal lip sync...`],
        [by(-Infinity, 2), undefined, (l, pl) => `${l} ${pl ? "fracasaron" : "fracasó"} en el lip sync...`],
      ]);
      // "botón de she-mergency": la compañera del equipo sale a hacer el lip sync en su lugar
      bottom.forEach((t, i) => {
        if (rnd(0, 100) >= 98) {
          const other = lips[i] === t.QueenA ? t.QueenB : t.QueenA;
          e.q([other.name], "red", `¡¡OMG!! ¡${other.name} pulsa el botón de she-mergency y ahora hará ella el lip sync!!`);
          lips[i] = other;
        }
      });
      this.noteBlot(lips, song);
      const idx = bottom.map((t, i) => i).sort((a, b) => bottom[b].lipsyncScore - bottom[a].lipsyncScore);
      const win = bottom[idx[0]], lose = bottom[idx[1]];
      const winQ = lips[idx[0]], loseQ = lips[idx[1]];
      const r = this.newScreen("Chicas, he tomado mi decisión...", "Continuar");
      r.q([winQ.name], "pink", `${winQ.name}, shantay, te quedas.`);
      r.q([loseQ.name], "red", `${loseQ.name}, siempre serás una All Star, ahora... sashay away...`);
      this.addSong([winQ], [loseQ], song);
      win.addTR("BTM2"); this.tAdd(win, { unfav: 3, ppe: 1 });
      lose.QueenA.addTR("ELIM"); lose.QueenB.addTR("ELIM");
      lose.QueenA.rankP = "tie1"; lose.QueenB.rankP = "tie2";
      this.tAdd(lose, { unfav: 5 });
      this.eliminated.unshift(lose.QueenA);
      this.eliminated.unshift(lose.QueenB);
      this.current.splice(this.current.indexOf(lose), 1);
      this.exitLine(r, loseQ);
    }

    // Final por equipos: quedan dos equipos (cuatro reinas). O se va una reina de cada equipo y las
    // otras dos hacen lip sync por la corona, o se va el equipo peor y hace el lip sync el mejor.
    finaleTeamSeason() {
      const cast = this.current;
      const s = this.newScreen("¡La gran final!", "Ir a los minutos finales");
      s.q(cast.map((q) => q.name), "black");
      s.p("¡Nuestro Top 4 participará en un videoclip del nuevo single de RuPaul!");
      cast.forEach((q) => q.getFinale());
      const j = this.newScreen("Los minutos finales...", "Ver a la ganadora");
      j.b("Chicas, es hora de decidir a la próxima Superestrella Drag, y...");
      j.hr();
      let finalists, out;
      if (rnd(0, 100) >= 45) {
        out = [cast[1], cast[3]];
        finalists = [cast[0], cast[2]];
      } else {
        out = [cast[2], cast[3]];
        finalists = [cast[0], cast[1]];
        if (rnd(0, 100) <= 80) finalists[1].finaleScore += 1;
      }
      j.q(out.map((q) => q.name), "sienna", `${out[0].name}, ${out[1].name}. Lo siento, queridas, pero no es vuestro momento. Debo pediros que hagáis sashay away...`);
      out.forEach((q) => {
        q.addTR(q.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
        q.rankP = 34;
        this.eliminated.unshift(q);
      });
      j.hr();
      j.q(finalists.map((q) => q.name), "silver", `${finalists[0].name} y ${finalists[1].name}, esta es vuestra última oportunidad para demostrar lo que valéis. Es hora de que hagáis lip sync... ¡por la CORONA!`);
      const song = this.pickSong(j);
      finalists.forEach((q) => q.getASLipsync());
      j.hr();
      this.lipsyncEvent(j, finalists);
      this.lipsyncGroups(j, finalists, song);
      j.hr();
      this.current = finalists.sort((a, b) => b.finaleScore - a.finaleScore);
      this.threeWay = false;
      this.fourWay = false;
      this.winnerScreen();
    }

    // ---- Lipsync For Your Legacy (All Stars): el Top 2 hace lip sync por su legado y la ganadora elimina a la
    // reina del bottom cuyo pintalabios eligió (la perdedora del lip sync se salva). ----
    legacyJudging() {
      const top = this.topQueens, bottom = this.bottomQueens;
      const s = this.newScreen("¡Traed de vuelta a mis All Stars!", "Ir al lip sync");
      s.b("Chicas, he tomado algunas decisiones...");
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      const two = [top[0], top[1]];
      top.splice(0, 2);
      s.q(two.map((q) => q.name), "cyan", `${two[0].name}, ${two[1].name}, condragulations, ¡sois el Top 2 de la semana!`);
      if (top.length) {
        top.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        s.q(top.map((q) => q.name), "lightblue", `${list(top.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
      }
      s.hr();
      s.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, lo siento, queridas, pero sois las peores de la semana.`);
      bottom.sort((a, b) => a.performanceScore - b.performanceScore);
      const safe = bottom.find((q) => q.performanceScore < 25);
      if (bottom.length > 2 && safe) {
        s.q([safe.name], "pink", `${safe.name}, estás a salvo.`);
        safe.addTR("LOW"); safe.unfavoritism += 1; safe.ppe += 2;
        bottom.splice(bottom.indexOf(safe), 1);
      }
      s.hr();
      s.big("Tras deliberar...");
      two.forEach((q) => {
        q.lipstick = this.worstSister(q, bottom);
        if (!bottom.includes(q.lipstick)) q.lipstick = pick(bottom);
        bottom.forEach((o) => { if (o !== q.lipstick) this.modRelation(1, [q, o]); });
        s.q([q.name, q.lipstick.name], "cyan", `¡${q.name} eligió el pintalabios de ${q.lipstick.name}!`);
        if (rnd(0, 100) >= 80) {
          this.modRelation(4, [q, q.lipstick]);
          s.p(`${q.lipstick.name} se sintió muy dolida.`);
        } else {
          this.modRelation(3, [q, q.lipstick]);
          s.p(`${q.lipstick.name} se lo tomó bien, no estaba muy enfadada.`);
        }
      });

      const e = this.newScreen("Ha llegado la hora...", "Ver el resultado");
      e.b("Para que hagáis lip sync... ¡por vuestro legado! Buena suerte, y no la caguéis.");
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);

      const r = this.newScreen("Chicas, he tomado mi decisión...", "Continuar");
      let btm3 = false;
      const out = (q, label = "ELIM", tie) => {
        if (this.fateSave(r, q)) return;
        q.addTR(label); q.unfavoritism += 5;
        if (tie) q.rankP = tie;
        this.eliminated.unshift(q);
        bottom.splice(bottom.indexOf(q), 1);
        this.current.splice(this.current.indexOf(q), 1);
      };
      if (two[0].lipsyncScore === two[1].lipsyncScore && two[0].lipsyncScore > 6 && this.current.length > 6) {
        this.addSong(two, [], song);
        r.q(two.map((q) => q.name), "darkblue", "Condragulations, ¡sois las dos ganadoras, baby!");
        two.forEach((q) => { q.favoritism += 5; q.ppe += 5; q.addTR(" WIN"); });
        if (two[0].lipstick === two[1].lipstick) {
          r.q([two[0].lipstick.name], "red", `${two[0].lipstick.name}, siempre serás una All Star, ahora... sashay away...`);
          this.exitLine(r, two[0].lipstick);
          out(two[0].lipstick);
        } else {
          r.q([two[0].lipstick.name, two[1].lipstick.name], "red", `${two[0].lipstick.name}, ${two[1].lipstick.name}, siempre seréis All Stars, ahora... sashay away...`);
          this.exitLine(r, two[0].lipstick);
          out(two[0].lipstick, " ELIM ", "tie1");
          out(two[1].lipstick, " ELIM ", "tie2");
          this.flag.doubleSashay = true;
          btm3 = true;
        }
      } else {
        this.addSong([two[0]], [two[1]], song);
        two[0].favoritism += 5; two[0].ppe += 5; two[0].addTR("WIN");
        r.q([two[0].name], "royalblue", `${two[0].name}, ¡eres una ganadora, baby!`);
        two[1].addTR("WIN "); two[1].favoritism += 4; two[1].ppe += 5;
        r.q([two[1].name], "cyan", `${two[1].name}, estás a salvo.`);
        r.hr();
        const gone = two[0].lipstick;
        r.q([gone.name], "red", `${gone.name}, siempre serás una All Star, ahora... sashay away...`);
        this.exitLine(r, gone);
        out(gone);
      }
      bottom.forEach((q) => {
        const n = bottom.length;
        q.addTR(n === 3 ? "BTM4" : (n === 2 || (n === 1 && btm3) || this.current.length === 4) ? "BTM3" : "BTM2");
        q.unfavoritism += 3; q.ppe += 1;
      });
      this.topQueens = []; this.bottomQueens = [];
      return this.untucked();
    }

    // ---- Lipsync Assassin: la reina que gana el reto y todas las demás eligen el pintalabios de una reina
    // del bottom; una "asesina" misteriosa de fuera del reparto hace lip sync contra la ganadora y la que
    // gane decide quién se va (si gana la asesina, se va la más votada por el grupo). ----
    pickAssassin() {
      if (!this.assassinPool) this.assassinPool = Object.keys(this.statsByName || {}).filter((n) => !this.queens.some((q) => q.name === n));
      if (!this.assassinPool.length) return null;
      const i = rnd(0, this.assassinPool.length - 1);
      const name = this.assassinPool.splice(i, 1)[0];
      return new Queen(name, this.statsByName[name]);
    }

    // ======================================================================================
    // FORMATO FATAL SELECTION: las reinas del bottom eligen pintalabios; la ganadora elige a quién enfrenta a una
    // asesina del lip sync. Si la elegida gana, se va la reina de su pintalabios; si gana la asesina, se va la elegida.
    // ======================================================================================
    fatalJudging() {
      const assassin = this.pickAssassin();
      if (!assassin) return false;
      const top = this.topQueens, bottom = this.bottomQueens;
      const s = this.newScreen("Fatal Selection", "Continuar");
      s.b("Chicas, he tomado algunas decisiones...");
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      const winner = top.shift();
      winner.addTR("WIN"); winner.favoritism += 5; winner.ppe += 5;
      s.q([winner.name], "royalblue", `${winner.name}, condragulations, ¡eres la ganadora del reto de esta semana!`);
      if (top.length) {
        top.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        s.q(top.map((q) => q.name), "lightblue", `${list(top.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
      }
      s.hr();
      s.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, estáis en peligro de eliminación.`);
      s.hr();
      s.big("Antes de deliberar...");
      s.p("cada reina del bottom debe elegir el pintalabios de la reina que quiere eliminar.");

      // pintalabios de las reinas del bottom
      const l = this.newScreen("Fatal Selection", "Continuar");
      l.big("Las reinas del bottom eligen sus pintalabios...");
      bottom.forEach((q) => {
        const choices = bottom.filter((o) => o !== q);
        q.lipstick = choices.length === 1 ? choices[0] : this.worstSister(q, choices);
        if (!choices.includes(q.lipstick)) q.lipstick = pick(choices);
        l.b(`${q.name} ha elegido un pintalabios.`);
      });

      // la asesina y la elegida de la ganadora
      const chosen = this.worstSister(winner, bottom);
      const a = this.newScreen("¡Pero espera, hay más!", "Continuar");
      a.b("Es la hora de presentar a la ASESINA del lip sync de esta semana... ¡¡¡QUE SE REVELE!!!");
      a.q([assassin.name], "royalblue", `La asesina del lip sync de esta semana es... ¡${assassin.name}!`);
      a.hr();
      a.q([winner.name], "cyan", `${winner.name}, como ganadora del reto de esta semana, debes elegir a una reina del bottom para que se enfrente a la asesina por su VIDA.`);
      a.p("Si la asesina gana el lip sync, la reina elegida será eliminada. Pero si gana la reina elegida, la reina cuyo nombre lleve escrito en su pintalabios será... ELIMINADA.");
      a.reveal("Revelar la elección", [
        { t: "hr" },
        { t: "q", names: [chosen.name], color: "tomato", text: `${winner.name} ha elegido a ${chosen.name} para enfrentarse a la asesina del lip sync.` },
      ]);

      // lip sync
      const two = [chosen, assassin];
      const e = this.newScreen("Es la hora de la revelación...", "Ver el resultado");
      e.q(two.map((q) => q.name), "tomato", `${chosen.name}, te han elegido para hacer lip sync por tu vida contra la asesina de esta semana...`);
      e.p("Poneos frente a mí.");
      e.p("Ha llegado la hora... ¡de que hagáis lip sync por vuestra VIDA! Buena suerte, y no la caguéis.");
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });

      const r = this.newScreen("He tomado mi decisión...", "Continuar");
      let gone;
      let survived = false;
      if ((chosen.lipsyncScore || 0) > (assassin.lipsyncScore || 0)) {
        survived = true;
        this.addSong([chosen], [assassin], song);
        r.q([chosen.name], "green", `${chosen.name}, shantay, te quedas. ¡Has luchado con éxito por tu vida!`);
        r.q([assassin.name], "royalblue", `${assassin.name}, gracias por tu maravilloso tiempo.`);
        chosen.favoritism += 3; chosen.ppe += 1;
        const remaining = bottom.filter((q) => q !== chosen);
        gone = remaining.includes(chosen.lipstick) ? chosen.lipstick : pick(remaining);
        r.hr();
        r.p("Un gran poder conlleva una gran responsabilidad... ¿a qué reina has elegido para que reciba el hachazo?");
        r.q([gone.name], "red", `${chosen.name} ha elegido a ${gone.name} para ser eliminada.`);
      } else {
        this.addSong([assassin], [chosen], song);
        r.q([assassin.name], "royalblue", `${assassin.name}, ¡eres una ganadora, baby!`);
        r.hr();
        r.p("Eso significa...");
        r.q([chosen.name], "red", `${chosen.name}, siempre serás una All Star... ahora, sashay away...`);
        this.exitLine(r, chosen);
        gone = chosen;
      }
      const saved = this.fateSave(r, gone);
      if (!saved) {
        gone.addTR("ELIM"); gone.unfavoritism += 5; gone.votes = 0;
        this.eliminated.unshift(gone);
        bottom.splice(bottom.indexOf(gone), 1);
        this.current.splice(this.current.indexOf(gone), 1);
      }
      const label = this.current.length > 4 ? "BTM3" : "BTM2";
      bottom.forEach((q) => {
        if (q === gone) return;
        q.addTR(q === chosen && survived ? "S" + label : label);
        q.unfavoritism += 2; q.ppe += 1; q.votes = 0;
      });
      this.topQueens = []; this.bottomQueens = [];
      return this.untucked();
    }

    assassinJudging() {
      const top = this.topQueens, bottom = this.bottomQueens;
      const cast = this.current;
      const s = this.newScreen("¡Traed de vuelta a mis All Stars!", "Mostrar el resultado");
      s.b("Chicas, he tomado algunas decisiones...");
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      const winner = top.shift();
      s.q([winner.name], "royalblue", `${winner.name}, condragulations, ¡eres la Top All Star de la semana!`);
      if (top.length) {
        top.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        s.q(top.map((q) => q.name), "lightblue", `${list(top.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
      }
      s.hr();
      s.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, lo siento, queridas, pero sois las peores de la semana.`);
      bottom.sort((a, b) => a.performanceScore - b.performanceScore);
      if (bottom.length >= 3 && cast.length > 4) {
        const low = bottom.shift();
        low.addTR("LOW"); low.unfavoritism += 1; low.ppe += 2;
        s.q([low.name], "pink", `${low.name}... estás a salvo.`);
      }
      s.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, estáis en riesgo de eliminación.`);
      s.hr();
      s.big("Tras deliberar...");

      // pintalabios de la ganadora
      bottom.forEach((q) => { q.votes = 0; });
      winner.lipstick = this.worstSister(winner, bottom);
      if (!bottom.includes(winner.lipstick)) winner.lipstick = pick(bottom);
      bottom.forEach((o) => { if (o !== winner.lipstick) this.modRelation(1, [winner, o]); });
      s.q([winner.name, winner.lipstick.name], "cyan", `¡${winner.name} eligió el pintalabios de ${winner.lipstick.name}!`);
      if (rnd(0, 100) <= 80) { this.modRelation(4, [winner, winner.lipstick]); s.p(`${winner.lipstick.name} se sintió muy dolida.`); }
      else { this.modRelation(3, [winner, winner.lipstick]); s.p(`${winner.lipstick.name} se lo tomó bien, no estaba muy enfadada.`); }

      // pintalabios del resto del grupo (se muestran al pulsar el botón)
      s.hr();
      s.big("Las reinas eligen un pintalabios...");
      const votes = [];
      cast.forEach((q) => {
        if (q === winner || (bottom.length === 1 && bottom[0] === q)) return;
        q.lipstick = this.worstSister(q, bottom);
        if (!bottom.includes(q.lipstick)) q.lipstick = pick(bottom);
        bottom.forEach((o) => { if (rnd(0, 100) <= 60 && q.lipstick !== o) this.modRelation(1, [q, o]); });
        votes.push({ t: "q", names: [q.name, q.lipstick.name], color: "red", text: `¡${q.name} votó a ${q.lipstick.name}!` });
        q.lipstick.votes++;
        if (rnd(0, 100) >= 90) { this.modRelation(4, [q, q.lipstick]); votes.push({ t: "p", text: `${q.lipstick.name} se sintió muy dolida.` }); }
        else { this.modRelation(3, [q, q.lipstick]); votes.push({ t: "p", text: `${q.lipstick.name} se lo tomó bien, no estaba muy enfadada.` }); }
      });
      s.reveal("Mostrar los pintalabios", votes);
      s.hr();
      bottom.sort((a, b) => b.votes - a.votes);
      bottom.forEach((q) => s.b(`${q.name}: ${q.votes} votos`));

      // revelación de la asesina y lip sync
      const assassin = this.pickAssassin();
      const two = assassin ? [winner, assassin] : [winner];
      const e = this.newScreen("Es la hora de la revelación...", "Ver el resultado");
      if (assassin) {
        e.q([assassin.name], "royalblue", `Es la hora de presentar a la ASESINA del lip sync de esta semana... ¡¡¡${assassin.name}!!!`);
        e.p("Reinas, poneos frente a mí.");
        e.p("Ha llegado la hora... ¡de que hagáis lip sync por vuestro LEGADO! Buena suerte, y no la caguéis.");
      }
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });

      const r = this.newScreen("Estoy lista para decidir...", "Continuar");
      let backToWinner = false;
      let assassinLipstick;
      if (bottom.length > 1 && bottom[0].votes === bottom[1].votes) { backToWinner = true; assassinLipstick = winner.lipstick; }
      else assassinLipstick = bottom[0];
      if (assassin) assassin.lipstick = assassinLipstick;
      two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      let btm3 = false;
      const out = (q, label = "ELIM", tie) => {
        if (this.fateSave(r, q)) return;
        q.addTR(label); q.unfavoritism += 5; q.votes = 0;
        if (tie) q.rankP = tie;
        this.eliminated.unshift(q);
        bottom.splice(bottom.indexOf(q), 1);
        this.current.splice(this.current.indexOf(q), 1);
      };
      if (two.length === 2 && two[0].lipsyncScore === two[1].lipsyncScore && two[0].lipsyncScore > 7 && cast.length > 6 && !this.flag.doubleSashay) {
        this.addSong(two, [], song);
        r.q(two.map((q) => q.name), "darkblue", "Condragulations, ¡sois las dos ganadoras, baby!");
        winner.addTR(" WIN"); winner.favoritism += 5; winner.ppe += 5;
        if (two[0].lipstick === two[1].lipstick) {
          const g = two[0].lipstick;
          r.q([g.name], "red", `${g.name}, siempre serás una All Star, ahora... sashay away...`);
          this.exitLine(r, g);
          out(g);
        } else {
          const [g1, g2] = [two[0].lipstick, two[1].lipstick];
          r.q([g1.name, g2.name], "red", `${g1.name}, ${g2.name}, siempre seréis All Stars, ahora... sashay away...`);
          this.exitLine(r, g1);
          out(g1, " ELIM ", "tie1");
          out(g2, " ELIM ", "tie2");
          this.flag.doubleSashay = true;
          btm3 = true;
        }
      } else {
        const w = two[0];
        this.addSong([w], two.slice(1), song);
        if (w === assassin) {
          r.q([w.name], "darkblue", `${w.name}, ¡eres una ganadora, baby!`);
          r.q([winner.name], "cyan", `${winner.name}, estás a salvo.`);
          winner.addTR("WIN "); winner.favoritism += 5; winner.ppe += 5;
        } else {
          r.q([w.name], "darkblue", `${w.name}, ¡eres una ganadora, baby!`);
          if (assassin) r.p(`${assassin.name}, gracias por participar.`);
          winner.addTR("WIN"); winner.favoritism += 5; winner.ppe += 5;
        }
        if (backToWinner && w === assassin) r.b("¡Como ha habido un empate en la votación, el poder vuelve a la ganadora del reto!");
        r.hr();
        const gone = w.lipstick;
        r.q([gone.name], "red", `${gone.name}, siempre serás una All Star, ahora... sashay away...`);
        this.exitLine(r, gone);
        out(gone);
      }
      bottom.forEach((q) => {
        const n = bottom.length;
        q.addTR(n === 4 ? "BTM5" : n === 3 ? "BTM4" : (n === 2 || (n === 1 && btm3)) ? "BTM3" : "BTM2");
        q.unfavoritism += 2; q.ppe += 1; q.votes = 0;
      });
      this.topQueens = []; this.bottomQueens = [];
      return this.untucked();
    }

    // ======================================================================================
    // FORMATO ALL WINNERS: nadie se va durante la temporada; las reinas juntan estrellas
    // ======================================================================================
    winnersEpisodes() { return this.queens.length <= 10 ? 11 : 14; }

    winnersChallenge() {
      const ep = this.episode, last = this.winnersEpisodes();
      if (ep === 1) return "rumix";
      if (ep === 2) return "snatch";
      if (ep === 3) return "ball";
      if (ep === 6) return "girlgroup";
      if (ep === last) return "talent";
      return this.randomMaxi();
    }

    // Juzgado: las 4 (o 5 con más de 10 reinas) mejores están arriba y el resto SAFE; el Top 2 gana estrellas.
    winnersJudging() {
      const cast = this.current;
      const n = cast.length;
      const last = this.winnersEpisodes();
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const k = n <= 10 ? 4 : 5;
      const top = cast.slice(0, k);
      const blockQueens = cast.slice(k);
      const s = this.newScreen("¡El jurado!", "Ver las decisiones");
      s.b("Basándonos en las actuaciones de esta noche...");
      s.q(top.map((q) => q.name), "cyan", `${list(top.map((q) => q.name))}, representáis los tops de la semana.`);
      s.hr();
      blockQueens.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });

      const w = this.newScreen("¡Traed de vuelta a mis ganadoras!", "Ir al lip sync");
      w.b("Chicas, he tomado algunas decisiones...");
      if (rnd(0, 100) >= 98 || (this.episode === 5 && !this.gsFlag)) {
        this.gs = true; this.gsFlag = true;
        w.b("Esta semana, el Top 2 regalará una estrella a una de sus compañeras...");
      } else this.gs = false;
      let threeStars = false;
      if (this.episode === last && this.episodeChallenges[last - 1] === "Talent Show" && !this.flagThree) {
        w.b("Esta semana, el Top 2 recibe 3 estrellas en lugar de 1...");
        threeStars = true;
      }
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      const two = [top[0], top[1]];
      const highs = top.slice(2);
      w.q(two.map((q) => q.name), "cyan", `${two[0].name}, ${two[1].name}, condragulations, ¡sois el Top 2 de la semana!`);
      if (highs.length) {
        highs.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; blockQueens.push(q); });
        w.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, buen trabajo esta semana, estáis a salvo.`);
      }
      w.hr();
      // estrellas del Top 2 (las bloqueadas de la semana pasada no reciben)
      const star = (q, n) => this.addStars(q, n);
      const free = two.filter((q) => !q.blocked);
      const blockedTop = two.filter((q) => q.blocked);
      if (blockedTop.length === 2) {
        w.q(two.map((q) => q.name), "red", `${two[0].name} y ${two[1].name} no reciben estrella porque están bloqueadas.`);
      } else if (blockedTop.length === 1) {
        w.q([blockedTop[0].name, free[0].name], "pink", `${blockedTop[0].name} no recibe estrella porque está bloqueada. ¡Mientras que ${free[0].name} sí recibe una!`);
        if (threeStars && !this.flagThree) { star(free[0], 3); this.flagThree = true; } else star(free[0], 1);
      } else {
        w.q(two.map((q) => q.name), "pink", `¡${two[0].name} y ${two[1].name} recibirán una estrella!`);
        if (threeStars && !this.flagThree) { two.forEach((q) => star(q, 3)); this.flagThree = true; } else two.forEach((q) => star(q, 1));
      }
      cast.forEach((q) => { q.blocked = false; });

      // lip sync por el legado
      const e = this.newScreen("Ha llegado la hora...", "Ver el resultado");
      e.b("Para que hagáis lip sync... ¡por vuestro legado! Buena suerte, y no la caguéis.");
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);

      const r = this.newScreen("He tomado mi decisión...", "Continuar");
      const noBlock = this.episode >= last - 1;
      const plunger = (giver, targets) => {
        const t = this.worstSister(giver, targets);
        r.q([giver.name, t.name], "red", `¡${giver.name} ha dado el desatascador de platino a... ${t.name}!`);
        t.blocked = true;
        if (t.trackRecord.length) t.trackRecord[t.trackRecord.length - 1] += "+BLOCKED";
        if (rnd(0, 100) >= 80) { this.modRelation(4, [giver, t]); r.p(`${t.name} se sintió muy dolida.`); }
        else { this.modRelation(3, [giver, t]); r.p(`${t.name} se lo tomó bien, no estaba muy enfadada.`); }
      };
      if (two[0].lipsyncScore === two[1].lipsyncScore && two[0].lipsyncScore > 7 && n > 5) {
        this.addSong(two, [], song);
        r.q(two.map((q) => q.name), "darkblue", "Condragulations, ¡sois las dos ganadoras, baby!");
        two.forEach((q) => { q.favoritism += 5; q.ppe += 5; q.addTR(" WIN"); });
        r.hr();
        if (noBlock) r.b("¡Esta noche no bloquean a nadie!");
        else two.forEach((q) => plunger(q, blockQueens));
      } else {
        this.addSong([two[0]], [two[1]], song);
        two[0].favoritism += 5; two[0].ppe += 5; two[0].addTR("WIN");
        r.q([two[0].name], "royalblue", `${two[0].name}, ¡eres una ganadora, baby!`);
        two[1].addTR("WIN "); two[1].favoritism += 4; two[1].ppe += 5;
        r.q([two[1].name], "cyan", `${two[1].name}, estás a salvo.`);
        r.hr();
        if (noBlock) r.b("¡Esta noche no bloquean a nadie!");
        else plunger(two[0], blockQueens);
      }
      if (this.gs) {
        r.hr();
        two.forEach((q) => {
          const g = this.bestSister(q, blockQueens);
          r.q([q.name, g.name], "gold", `¡${q.name} ha dado su estrella a... ${g.name}!`);
          this.addStars(g, 1, "gift");
          (this.mvqHistory = this.mvqHistory || []).push({ ep: this.episodeChallenges.length, text: `${q.name} dio su estrella a ${g.name}` });
          if (rnd(0, 100) >= 80) { this.modRelation(2, [q, g]); r.p(`${g.name} se sintió muy agradecida.`); }
          else { this.modRelation(1, [q, g]); r.p(`${g.name} dio las gracias.`); }
        });
      }
      this.topQueens = []; this.bottomQueens = [];
      return this.untucked();
    }

    // Final de All Winners: pasan a la gran final las 4 con más estrellas (si hay empate, la primera elige);
    // las reinas 5ª-8ª juegan "She Done Already Done Had Herses" (un cuadro de lip syncs entre eliminadas)
    // y las 4 primeras hacen el Lip-Sync For The Crown.
    finaleWinners() {
      const cast = this.current.slice();
      const s = this.newScreen("El fin...", "Ir a She Done Already Done Had Herses");
      s.b("¡Las 4 reinas con más estrellas pasarán a la gran final!");
      s.hr();
      cast.sort((a, b) => b.stars - a.stars || rnd(-1, 1));
      const cut = cast[3].stars;
      const above = cast.filter((q) => q.stars > cut);
      const tied = cast.filter((q) => q.stars === cut);
      const slots = 4 - above.length;
      let four;
      if (tied.length > slots) {
        if (above.length === 0) {
          s.b("Como hay un empate... las reinas que he elegido para la gran final son...");
          four = shuffle(tied.slice()).slice(0, 4);
        } else {
          s.b(`${above[0].name}, ¡debes elegir a cuál de tus hermanas quieres invitar a la gran final!`);
          s.b(`¿Será... ${list(tied.map((q) => q.name))}?`);
          const pool = tied.slice();
          const chosen = [];
          for (let i = 0; i < slots; i++) {
            const pickQ = this.bestSister(above[0], pool);
            s.q([above[0].name, pickQ.name], "black", `${above[0].name} eligió a ${pickQ.name}.`);
            chosen.push(pickQ);
            pool.splice(pool.indexOf(pickQ), 1);
          }
          s.hr();
          s.b("Las reinas que pasan a la gran final son...");
          four = [...above, ...chosen];
        }
      } else {
        s.b("Las reinas que pasan a la gran final son...");
        four = [...above, ...tied.slice(0, slots)];
      }
      four.forEach((q) => s.q([q.name], "gold", `${q.name} con ${q.stars} estrellas!`));
      s.hr();
      const rest = cast.filter((q) => !four.includes(q)).sort((a, b) => b.stars - a.stars);
      const sd = rest.slice(0, 4), others = rest.slice(4);
      s.b("Estrellas de la temporada:");
      cast.sort((a, b) => b.stars - a.stars).forEach((q) => s.p(`${q.name}: ${q.stars} ${q.stars === 1 ? "estrella" : "estrellas"}`));
      others.forEach((q) => { q.addTR("ELIMINATED"); });
      s.q(rest.map((q) => q.name), "sienna", `${list(rest.map((q) => q.name))}, lo siento, queridas, no es vuestro momento... sashay away.`);

      // She Done Already Done Had Herses: las reinas 5ª-8ª se juegan un título de consolación
      let sdWinner = null;
      if (sd.length >= 2) {
        const h = this.newScreen("She Done Already Done Had Herses", "Ir a la gran final");
        h.q(sd.map((q) => q.name), "#75975E");
        h.p("Nuestras reinas eliminadas participarán en un lip sync smackdown por la corona. Se decidirán las preliminares...");
        const pool = shuffle(sd.slice());
        const pairs = [];
        while (pool.length >= 2) pairs.push([pool.shift(), pool.shift()]);
        if (pool.length) pairs[pairs.length - 1].push(pool.shift());
        const advancing = [];
        const sdLosers = [];
        pairs.forEach((p) => {
          h.q(p.map((q) => q.name), "#87AB69", p.map((q) => q.name).join(" vs. "));
          const { win, lose } = this.duel(p.length > 2 ? p.slice(0, 2) : p, "Preliminares de SDADHH", `${p[0].name} y ${p[1].name} hacen lip sync...`, "Continuar");
          win && advancing.push(win);
          lose.addTR(lose.mxcon ? "MSCONL1R" : "LOST 1ST ROUND ");
          sdLosers.push(lose);
          if (p.length > 2) advancing.push(p[2]);
        });
        let finalPair = advancing.slice(0, 2);
        advancing.slice(2).forEach((q) => { q.addTR("LOST 1ST ROUND "); sdLosers.push(q); });
        if (finalPair.length === 2) {
          const { win, lose } = this.duel(finalPair.slice(), "La final de SDADHH", `${finalPair[0].name} y ${finalPair[1].name} harán lip sync por la corona de SDADHH...`, "Continuar");
          win.addTR("WINNER ");
          win.minqdd = win.minqdd ? win.minqdd + "\n(Reina de SDADHH)" : "(Reina de SDADHH)";
          lose.addTR("LOST 3RD ROUND ");
          sdWinner = win;
          sdLosers.push(lose);
        } else if (finalPair.length === 1) { finalPair[0].addTR("WINNER "); sdWinner = finalPair[0]; }
        const ordered = [sdWinner, ...sdLosers.reverse()].filter(Boolean);
        ordered.forEach((q) => { q.rankP = 58; });
        this.sdOrder = ordered;
      } else this.sdOrder = sd;
      // lista de eliminadas (la mejor primero): SDADHH y luego el resto
      this.eliminated = [...this.sdOrder, ...others];
      this.current = four;
      this.finaleLFTC();
    }

    // ---- Slaysian Royale (solo esopare): como el Legacy hasta que quedan 6 reinas; entonces se juega el
    // "Top 6 Lip Sync LaLaPaRUza" tipo torneo: tres lip syncs en los que la reina elegida escoge a su rival,
    // un lip sync a tres entre las ganadoras y, con el Golden Balut, la ganadora salva a una de las tres
    // perdedoras; las otras dos hacen lip sync por su vida. ----
    slaysianLalaparuza() {
      this.flag.slaysianDone = true;
      this.episodeChallenges.push("Lip Sync");
      const cast = this.current;
      const s = this.newScreen("¡Top 6 Lip Sync LaLaPaRUza!", "Empezar");
      s.q(cast.map((q) => q.name), "cyan", cast.map((q) => q.name).join(" • "));
      s.hr();
      s.b("Reinas, ¡bienvenidas al Lip Sync LaLaPaRUza Slaysian Smackdown!");
      s.b("Este reto es un torneo de lip syncs. Se sacará una reina al azar de un tambiolo con los nombres de todas las que quedan; la primera elegida tendrá el poder de escoger a su rival entre sus compañeras.");
      s.b("Las perdedoras de cada lip sync vuelven al taller y la ganadora se queda en el escenario.");
      s.b("¡Que comience el Lip Sync LaLaPaRUza Smackdown!");
      let remaining = shuffle(cast.slice());
      const winners = [], losers = [];
      const fight = (chooser, opp, label) => {
        const r = this.newScreen(label, "Continuar");
        r.q([chooser.name, opp.name], undefined, `${chooser.name} elige a ${opp.name}!`);
        r.b("Ha llegado la hora de que hagáis lip sync... ¡Buena suerte, y no la caguéis!");
        const pair = [chooser, opp];
        pair.forEach((q) => q.getASLipsync());
        const song = this.pickSong(r);
        r.hr();
        this.lipsyncEvent(r, pair);
        const raw = pair.map((q) => q.lipsyncScore);
        this.lipsyncGroups(r, pair, song);
        pair.forEach((q, i) => { q.lipsyncScore = raw[i]; });
        pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        this.addSong([pair[0]], [pair[1]], song);
        r.hr();
        r.q([pair[0].name], "royalblue", `${pair[0].name}, shantay, te quedas. Eres libre para brillar otro día.`);
        r.q([pair[1].name], "darkred", `${pair[1].name}, no te preocupes, tendrás una oportunidad más para redimirte. Pero de momento, vuelve al taller.`);
        winners.push(pair[0]); losers.push(pair[1]);
      };
      for (let i = 0; i < 2; i++) {
        const chooser = remaining[rnd(0, remaining.length - 1)];
        const options = remaining.filter((q) => q !== chooser);
        const opp = this.worstSister(chooser, options) || pick(options);
        fight(chooser, opp, `Ronda 1 (lip sync ${i + 1})`);
        remaining = remaining.filter((q) => q !== chooser && q !== opp);
      }
      fight(remaining[0], remaining[1], "Ronda 1 (lip sync 3)");

      const t = this.newScreen("Lip sync del Top 3", "Ir al lip sync");
      t.b("Reinas, condragulations por ganar vuestros lip syncs del LaLaPaRUza.");
      t.b("Ahora toca el lip sync por la VICTORIA: decidirá quién es la ganadora del Slaysian Lip Sync LaLaPaRUza.");
      t.q(winners.map((q) => q.name), "cyan");
      t.b("La ganadora tendrá el poder del GOLDEN BALUT: podrá salvar a una de las perdedoras de lip sync por su vida.");
      const f = this.newScreen("Lip sync del Top 3", "Ir al Golden Balut");
      winners.forEach((q) => q.getASLipsync());
      const song = this.pickSong(f);
      f.hr();
      this.lipsyncEvent(f, winners);
      const raw = winners.map((q) => q.lipsyncScore);
      this.lipsyncGroups(f, winners, song);
      winners.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      winners.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const champ = winners[0];
      this.addSong([champ], winners.slice(1), song);
      f.hr();
      f.q([champ.name], "royalblue", `${champ.name}, condragulations, ¡eres la ganadora del Slaysian Lip Sync LaLaPaRUza!`);

      const g = this.newScreen("Golden Balut", "Continuar");
      g.q([champ.name], "royalblue", `${champ.name}, pesada es la mano que sostiene el Golden Balut: ¿a qué reina salvas de hacer lip sync por su vida?`);
      g.q(losers.map((q) => q.name));
      const saved = this.bestSister(champ, losers);
      g.hr();
      g.q([champ.name, saved.name], "gold", `¡${champ.name} decide darle el Golden Balut a ${saved.name}!`);
      champ.addTR("WIN"); champ.favoritism += 5; champ.ppe += 5;
      winners.slice(1).forEach((q) => { q.addTR("TOP3"); q.favoritism += 4; q.ppe += 4; });
      saved.addTR("BEAV");
      const bottom = losers.filter((q) => q !== saved);
      g.q(bottom.map((q) => q.name), "tomato", `${bottom[0].name} y ${bottom[1].name}, eso significa que las dos estáis en riesgo de eliminación.`);
      this.bottomQueens = bottom;
      return this.lipsyncDesc();
    }

    // ======================================================================================
    // TOURNAMENT OF ALL STARS (esopare, con brackets a medida): el reparto se divide en grupos que juegan
    // varios episodios cada uno; dentro de un grupo se juntan puntos MVQ y pasan las que más tengan.
    // Opcionalmente hay una segunda ronda de grupos y luego el resto de la temporada es regular.
    // ======================================================================================
    // Reparte las reinas en grupos de los tamaños dados respetando las que el usuario ha asignado a mano
    // (opts.assign: nombre -> nº de grupo); las demás se reparten al azar donde quede sitio.
    dealGroups(queens, sizes, ignoreAssign = false) {
      const assign = ignoreAssign ? {} : (this.opts.assign || {});
      const groups = sizes.map(() => []);
      const rest = [];
      shuffle(queens.slice()).forEach((q) => {
        const g = assign[q.name];
        if (g >= 1 && g <= sizes.length && groups[g - 1].length < sizes[g - 1]) groups[g - 1].push(q); else rest.push(q);
      });
      groups.forEach((gr, i) => { while (gr.length < sizes[i] && rest.length) gr.push(rest.shift()); });
      rest.forEach((q) => groups[groups.length - 1].push(q));
      return groups;
    }

    tourSizes(n, groups) {
      const base = Math.floor(n / groups), extra = n % groups;
      return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
    }

    playTournament() {
      const cfg = this.opts.tournament;
      let queens = this.current.slice();
      const rounds = [cfg].concat(cfg.second ? [cfg.second] : []);
      this.tourAlive = queens.slice();
      this.tourEpisodes = 0;
      rounds.forEach((rc, ri) => {
        const entering = queens.slice();
        const groups = Math.max(2, Math.min(rc.groups, Math.floor(entering.length / 2)));
        const sizes = this.tourSizes(entering.length, groups);
        const dealt = this.dealGroups(entering, sizes, ri > 0);
        const intro = this.newScreen(ri === 0 ? "¡Comienza el torneo!" : "¡Segunda ronda del torneo!", "Empezar");
        intro.b(`${entering.length} reinas se dividen en ${groups} grupos. Cada grupo juega ${rc.episodes} ${rc.episodes === 1 ? "episodio" : "episodios"} y pasan ${rc.passers} de cada uno.`);
        const bracketList = [];
        sizes.forEach((sz, gi) => {
          const g = dealt[gi];
          bracketList.push(g);
          intro.hr();
          intro.big(`Grupo ${gi + 1}`);
          intro.q(g.map((q) => q.name), undefined, g.map((q) => q.name).join(" • "));
        });
        intro.add(this.cardsBlock(bracketList.map((g, gi) => ({ title: (ri === 0 ? "Grupo " : "2ª ronda · Grupo ") + (gi + 1), color: (cfg.colors[gi] || TOUR_COLORS[gi % TOUR_COLORS.length]), names: g.map((q) => q.name) }))));
        const advancers = [];
        const losers = [];
        const wildCands = [];
        bracketList.forEach((group, gi) => {
          group.forEach((q) => { q.stars = 0; if (ri === 0) q.bracket = gi + 1; else q.bracket2 = gi + 1; });
          const gcols = [];
          const passers = Math.max(1, Math.min(rc.passers, group.length - 1));
          for (let e = 0; e < rc.episodes; e++) {
            this.tourAlive.filter((q) => !group.includes(q)).forEach((q) => q.addTR(""));
            this.current = group.slice();
            this.tour = { round: ri + 1, bracket: gi + 1, ep: e + 1 };
            this.playEpisode();
            this.tourEpisodes++;
            this.flag.isTeam = false; this.flag.isPair = false;
            gcols.push(this.episodeChallenges.length - 1);
            this.trackRecordScreen(false);
          }
          this.tour = null;
          (this.tourGroups = this.tourGroups || []).push({ title: (ri === 0 ? "Grupo " : "2ª ronda · Grupo ") + (gi + 1), color: (cfg.colors[gi] || TOUR_COLORS[gi % TOUR_COLORS.length]), cols: gcols, queens: group.slice() });
          // resultado del grupo
          const r = this.newScreen(`Resultado del grupo ${gi + 1}`, "Continuar");
          group.sort((a, b) => b.stars - a.stars || b.ppe - a.ppe);
          const adv = group.slice(0, passers);
          const cutoff = adv[passers - 1].stars;
          const tied = group.slice(passers).filter((q) => q.stars === cutoff);
          if (tied.length) {
            if (rnd(1, 100) === 21) {
              r.b("Hay un empate... basándonos en vuestras actuaciones, el empate no se rompe: todas pasáis.");
              tied.forEach((q) => adv.push(q));
            } else {
              r.b("Hay un empate... basándonos en vuestras actuaciones de esta noche y de toda la temporada...");
              const contenders = [adv[passers - 1], ...tied].sort((a, b) => b.ppe - a.ppe);
              adv[passers - 1] = contenders[0];
            }
          }
          r.b("Las reinas que pasan son...");
          adv.forEach((q) => {
            this.tourMark(q, "+ADV");
            r.q([q.name], "gold", `${q.name} con ${q.stars} ${q.stars === 1 ? "punto" : "puntos"} MVQ`);
          });
          r.hr();
          r.b("El resto...");
          const out = group.filter((q) => !adv.includes(q));
          out.forEach((q) => {
            this.tourMark(q, "+ELIM");
            r.q([q.name], "red", `${q.name}, tienes ${q.stars} ${q.stars === 1 ? "punto" : "puntos"}. Lo siento, querida, no avanzas... sashay away.`);
            losers.push(q);
          });
          if (ri === 0 && cfg.wildcards > 0 && out.length) wildCands.push(out.slice().sort((a, b) => b.ppe - a.ppe)[0]); // la mejor PPE de cada grupo
          advancers.push(...adv);
        });
        // Comodines: de cada grupo se elige a la eliminada con mejor PPE y se sortean los comodines que vuelven
        if (ri === 0 && cfg.wildcards > 0 && wildCands.length) {
          const w = this.newScreen("El comodín", "Continuar");
          w.b("De cada grupo se ha elegido a una reina eliminada según su rendimiento general.");
          wildCands.forEach((q) => w.q([q.name], "gold", q.name));
          w.hr();
          w.b(cfg.wildcards > 1 ? "Girando la lotería de los comodines..." : "Girando la lotería del comodín...");
          const winners = shuffle(wildCands.slice()).slice(0, Math.min(cfg.wildcards, wildCands.length));
          winners.forEach((wild) => {
            w.q([wild.name], "royalblue", `${wild.name}, condragulations, ¡eres comodín y vuelves a la competición!`);
            losers.splice(losers.indexOf(wild), 1);
            advancers.push(wild);
            for (let i = wild.trackRecord.length - 1; i >= 0; i--) {
              if (/\+ELIM$/.test(wild.trackRecord[i])) { wild.trackRecord[i] = "RTRN+" + wild.trackRecord[i].replace(/\+ELIM$/, ""); break; }
            }
          });
          // las candidatas que no vuelven quedan como "OUT" (morado), como en la wiki
          wildCands.filter((q) => !winners.includes(q)).forEach((q) => {
            for (let i = q.trackRecord.length - 1; i >= 0; i--) {
              if (/\+ELIM$/.test(q.trackRecord[i])) { q.trackRecord[i] = "OUT"; break; }
            }
          });
        }
        // las eliminadas de esta ronda: puestos compartidos
        const lo = advancers.length + 1, hi = entering.length;
        losers.forEach((q) => { q.rankP = `rng:${lo}-${hi}`; });
        losers.reverse().forEach((q) => { this.eliminated.unshift(q); });
        this.tourAlive = advancers.slice();
        queens = advancers.slice();
      });
      this.tourAlive = null;
      this.raqMerge = cfg.merge === "raq";
      this.current = queens;
      this.total = queens.length;
      // el resto de formatos de temporada también pueden seguir a la ronda de grupos (merge)
      const mf = MERGE_FORMATS.find((m) => m.id === cfg.merge && m.opt);
      if (mf) {
        const ok = mf.opt === "teams" ? queens.length % 2 === 0 && queens.length >= 6 : queens.length >= 6;
        if (ok) {
          this.opts[mf.opt] = true;
          if (mf.opt === "winners") queens.forEach((q) => { q.stars = 0; });
        }
      }
    }

    // añade un marcador a la última casilla del grupo ("WIN" -> "WIN+ADV")
    // suma puntos MVQ / estrellas a una reina y los anota en la columna actual del track record
    addStars(q, n, kind = "main") {
      q.stars += n;
      const col = Math.max(0, this.episodeChallenges.length - 1);
      q.starLog[col] = (q.starLog[col] || 0) + n;
      const arr = kind === "gift" ? q.starGift : q.starMain;
      arr[col] = (arr[col] || 0) + n;
    }

    tourMark(q, mark) {
      if (q.trackRecord.length) q.trackRecord[q.trackRecord.length - 1] += mark;
    }

    tournamentChallenge() {
      const cfg = this.opts.tournament;
      if (cfg && cfg.seq === "s11") return this.tourEpisodes < 3 ? ["rumix", "design", "marketing"][this.tourEpisodes] : this.randomMaxi();
      const seq = ["rumix", "improv", "runway", "design", "comedy", "rusical", "design", "girlgroup", "improv"];
      return seq[this.tourEpisodes % seq.length];
    }

    // Juzgado del torneo: 3 arriba (el Top 2 gana 2 puntos MVQ, la tercera es HIGH), el resto SAFE; el Top 2
    // hace lip sync por un punto extra y las demás regalan su punto MVQ a la reina que prefieran.
    tournamentJudging() {
      const cast = this.current;
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const k = Math.min(3, cast.length);
      const top = cast.slice(0, k);
      const s = this.newScreen("¡El jurado!", "Ver a las ganadoras");
      s.b("Basándonos en las actuaciones de esta noche...");
      s.q(top.map((q) => q.name), "cyan", `${list(top.map((q) => q.name))}, representáis los tops de la semana.`);
      s.hr();
      cast.filter((q) => !top.includes(q)).forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      const two = top.slice(0, Math.min(2, top.length));
      const highs = top.slice(two.length);
      const w = this.newScreen("¡Las dos mejores!", "Ir al lip sync");
      w.q(two.map((q) => q.name), "cyan", `${list(two.map((q) => q.name))}, condragulations, habéis ganado 2 puntos MVQ cada una.`);
      two.forEach((q) => { this.addStars(q, 2); q.favoritism += 5; });
      highs.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
      if (highs.length) w.q(highs.map((q) => q.name), "lightblue", `${list(highs.map((q) => q.name))}, podéis retiraros al fondo del escenario.`);

      const e = this.newScreen("¡Lip sync por la victoria!", "Ver el resultado");
      e.b("Reinas, es vuestra oportunidad de impresionarme, ganar y llevaros un codiciado punto extra en el Tournament of All Stars.");
      e.b("Ha llegado la hora... ¡de hacer lip sync por vuestro LEGADO! ¡Suerte, y no la caguéis!");
      two.forEach((q) => q.getASLipsync());
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, two);
      const raw = two.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, two, song);
      two.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      two.sort((a, b) => b.lipsyncScore - a.lipsyncScore);

      const r = this.newScreen("He tomado mi decisión...", "Los puntos MVQ de las demás");
      if (two.length === 2 && two[0].lipsyncScore === two[1].lipsyncScore && two[0].lipsyncScore > 7 && cast.length > 5) {
        this.addSong(two, [], song);
        r.q(two.map((q) => q.name), "royalblue", "Condragulations, ¡sois las dos ganadoras, baby!");
        two.forEach((q) => { this.addStars(q, 1); q.addTR(" WIN"); q.favoritism += 5; q.ppe += 5; });
      } else {
        this.addSong([two[0]], two.slice(1), song);
        this.addStars(two[0], 1);
        r.q([two[0].name], "royalblue", `${two[0].name}, ¡eres una ganadora, baby! Has ganado un punto extra, así que tienes ${two[0].stars} puntos.`);
        two[0].addTR("WIN"); two[0].favoritism += 5; two[0].ppe += 5;
        if (two[1]) {
          r.q([two[1].name], "cyan", `${two[1].name}, condragulations, tienes ${two[1].stars} puntos.`);
          two[1].addTR("WIN "); two[1].favoritism += 4; two[1].ppe += 5;
        }
      }

      // las demás regalan su punto MVQ
      const g = this.newScreen("Puntos MVQ", "Continuar");
      g.b("Las reinas a salvo darán ahora su punto MVQ a la concursante que prefieran.");
      cast.filter((q) => !two.includes(q)).forEach((v) => {
        const choices = cast.filter((q) => q !== v);
        const chosen = this.bestSister(v, choices) || pick(choices);
        this.addStars(chosen, 1, "gift");
        (this.mvqHistory = this.mvqHistory || []).push({ ep: this.episodeChallenges.length, text: `${v.name} dio su punto MVQ a ${chosen.name}` });
        g.q([v.name, chosen.name], "gold", `${v.name} da su punto MVQ a ${chosen.name}.`);
        this.modRelation(1, [v, chosen]);
      });
      g.hr();
      g.b("Puntos MVQ actuales");
      cast.slice().sort((a, b) => b.stars - a.stars || b.ppe - a.ppe).forEach((q, i) => g.p(`${i + 1}. ${q.name} — ${q.stars} ${q.stars === 1 ? "punto" : "puntos"} MVQ`));
      this.topQueens = []; this.bottomQueens = [];
      return this.untucked();
    }

    // Tras el torneo S11: la ganadora del reto está a salvo y el resto se puntúa entre sí (Rate-A-Queen);
    // las dos peor valoradas hacen lip sync por su vida.
    raqMergeJudging() {
      const cast = this.current;
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      cast.forEach((q) => this.rigAdj(q));
      cast.sort((a, b) => a.performanceScore - b.performanceScore);
      const winner = cast[0];
      const s = this.newScreen("Rate-A-Queen", "Ir al lip sync");
      s.q([winner.name], "royalblue", `${winner.name}, condragulations, ¡eres la ganadora del reto de hoy!`);
      winner.addTR("WIN"); winner.favoritism += 5; winner.ppe += 5;
      s.b("La ganadora del reto está a salvo de la eliminación.");
      s.q([winner.name], "royalblue", `${winner.name} no participará en el Rate-A-Queen.`);
      s.hr();
      const voters = cast.filter((q) => q !== winner);
      voters.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      const order = this.raqRanking(s, voters);
      const bottom = order.slice(-2);
      bottom.forEach((q) => { if (q.trackRecord[q.trackRecord.length - 1] === "SAFE") { q.trackRecord.pop(); q.ppe -= 3; } });
      s.q(bottom.map((q) => q.name), "tomato", `${bottom[0].name} y ${bottom[1].name}, sois las peor valoradas: haréis lip sync por vuestras vidas.`);
      this.topQueens = []; this.bottomQueens = bottom;
      return this.lipsyncDesc();
    }

    // ---- Bloques de presentación copiados de la wiki (secciones "Contestants" de All Stars 10 y 11) ----
    // Leyenda de colores bajo el track record: solo los resultados que han salido en la temporada.
    legendBlock() {
      const all = [
        ["WINNER", "La concursante ganó la temporada."],
        ["RUNNER UP", "La concursante fue subcampeona."],
        ["LOST 3RD ROUND", "La concursante perdió la tercera ronda del Lip Sync For The Crown."],
        ["LOST 2ND ROUND", "La concursante perdió la segunda ronda del Lip Sync For The Crown."],
        ["LOST 1ST ROUND", "La concursante perdió la primera ronda del Lip Sync For The Crown."],
        ["WIN", "La concursante ganó el reto (o el lip sync por su legado)."],
        [" WIN", "La concursante ganó el reto junto a otra reina (doble victoria)."],
        ["WIN ", "La concursante ganó el reto, pero perdió el lip sync por su legado."],
        ["TOP2", "La concursante estuvo en el Top 2 sin ganar."],
        ["HIGH", "La concursante estuvo arriba, pero no ganó el reto."],
        ["SAFE", "La concursante estuvo a salvo."],
        ["LOW", "La concursante estuvo abajo, pero se salvó."],
        ["BTM2", "La concursante estuvo en peligro de eliminación y ganó el lip sync por su vida."],
        ["ELIM", "La concursante estuvo en peligro, perdió el lip sync por su vida y fue eliminada."],
        ["ELIMINATED", "La concursante fue eliminada en la final."],
        ["+ADV", "La concursante pasó a la siguiente ronda del torneo."],
        ["+ELIM", "La concursante fue eliminada del torneo por la puntuación."],
        ["RTRN+", "La concursante había sido eliminada, pero volvió como comodín (RTRN+resultado)."],
        ["OUT", "La concursante fue candidata a comodín, pero no la eligieron para volver."],
        ["MISS CON", "La concursante fue Miss Simpatía."],
        ["GUEST", "La concursante fue invitada en la final."],
      ];
      const used = new Set();
      this.queens.forEach((q) => q.trackRecord.forEach((c) => {
        if (typeof c !== "string") return;
        used.add(c);
        const m = c.match(/^(.*?)(\+ADV|\+ELIM|\+BLOCKED)$/);
        if (c.startsWith("RTRN+")) used.add("RTRN+");
        if (m) { used.add(m[1]); used.add(m[2]); }
      }));
      const items = [];
      all.forEach(([label, text]) => {
        const hit = label.startsWith("+") || label === "RTRN+" ? used.has(label) : used.has(label) || (label === "ELIM" && used.has("ELIM"));
        if (!hit) return;
        const style = CELL_STYLE[label === "RTRN+" ? "WIN" : label.startsWith("+") ? (label === "+ADV" ? "WIN" : "ELIMINATED") : label];
        items.push({ color: (style && style.bg) || "white", text });
      });
      if (this.opts.thailand) {

        const win = items.find((i) => i.text.startsWith("La concursante ganó el reto"));
        if (win) { win.text = "La concursante ganó la pasarela (pero no el maxi reto)."; win.color = "deepskyblue"; }
        [["WINSAFE", "WIN + SAFE", "Ganó el maxi reto y quedó a salvo en la pasarela."], ["WINHIGH", "WIN + HIGH", "Ganó el maxi reto y estuvo arriba en la pasarela."],
          ["WINLOW", "WIN + LOW", "Ganó el maxi reto y estuvo abajo, pero se salvó."], ["WINWIN", "WIN + WIN", "Ganó el maxi reto y también la pasarela."],
          ["WINBTM2", "WIN + BTM2", "Ganó el maxi reto, pero estuvo en peligro de eliminación y ganó el lip sync."], ["WINBTM3", "WIN + BTM3", "Ganó el maxi reto, pero estuvo en peligro de eliminación y se salvó."],
          ["WINELIM", "WIN + ELIM", "Ganó el maxi reto, pero perdió el lip sync y fue eliminada."]].forEach(([code, , text]) => {
          if (used.has(code)) items.push({ color: ThaiCell(code).bg, text });
        });
      }
      return { t: "legend", items };
    }

    // Tabla de puntos MVQ / estrellas: un cuadro por grupo con los puntos de cada episodio (dos columnas:
    // los ganados en el reto y los recibidos de otra reina) y el total.
    mvqBlock() {
      const groups = [];
      const cols = (q) => q.starMain.length > q.starGift.length ? q.starMain.length : q.starGift.length;
      const make = (title, color, colIdx, queens) => ({
        title, color,
        cols: colIdx.map((c) => `Ep. ${c + 1}`),
        rows: queens.map((q) => {
          const cells = colIdx.map((c) => ({ main: q.starMain[c] || 0, gift: q.starGift[c] || 0 }));
          return { name: q.name, cells, total: cells.reduce((a, x) => a + x.main + x.gift, 0) };
        }).sort((a, b) => b.total - a.total),
      });
      if (this.tourGroups && this.tourGroups.length) {
        this.tourGroups.forEach((g) => groups.push(make(g.title, g.color, g.cols, g.queens)));
      } else if (this.opts.winners) {
        const n = this.winnersEpisodes();
        groups.push(make("All Winners", "#8203D0", Array.from({ length: n }, (_, i) => i), this.queens));
      }
      return { t: "mvq", groups, history: this.mvqHistory || [] };
    }

    // Tarjetas con el reparto, con el color de cada grupo (como la foto de cada concursante en la wiki).
    cardsBlock(groups) { return { t: "cards", groups }; }

    // ¿Es el estreno sin eliminación (episodio 1 con ese formato)?
    noElimNow() { return !!this.opts.premiereNoElim && this.episode === 1; }
    slayNow() { return !!this.opts.premiereSlayers && this.episode === 1; }
    uk3Now() { return !!this.opts.uk3 && this.episode === 1; }

    // Quien no está arriba ni abajo recibe SAFE (sin mostrar la pantalla del jurado).
    markSafeOnly() {
      this.current.forEach((q) => {
        if (!this.topQueens.includes(q) && !this.bottomQueens.includes(q)) {
          q.addTR("SAFE");
          q.ppe += 3;
        }
      });
    }

    judgingScreen() {
      if (this.opts.thailand && !this.slayNow()) return this.thaiJudgingScreen();
      const f = this.flag;
      const s = this.newScreen("¡El jurado!", "Ver las decisiones");
      // Presentación del jurado (versión de esopare): RuPaul, 3 jueces del panel y un invitado.
      s.b("¡¡RuPaul!!");
      s.big("Bienvenidas al escenario principal de RuPaul's Drag Race...");
      s.hr();
      s.big("Os presento al fabuloso panel de jueces...");
      this.panel = shuffle(E.panel.filter((j, i, arr) => arr.indexOf(j) === i)).slice(0, 3);
      this.panel.forEach((j) => s.b(`¡¡${j}!!`));
      s.hr();
      s.big("Y, como invitado especial de esta semana...");
      this.guestJudge = pick(E.guests);
      s.b(`¡¡${this.guestJudge}!!`);
      s.hr();
      if (f.isNoTeam) {
        s.b("Esta semana habéis competido por equipos. Pero esta noche se os juzgará de forma individual.");
        s.hr();
        f.isNoTeam = false;
      }
      s.b("Basándonos en las actuaciones de esta noche...");
      if (this.opts.raq) this.drinkOrNot(s);
      shuffle(this.bottomQueens);
      shuffle(this.topQueens);
      const judged = shuffle([...this.topQueens, ...this.bottomQueens]).map((q) => q.name);
      const slay1 = this.slayNow();
      s.q(judged, "cyan", `${list(judged)}, representáis los tops${slay1 && !this.bottomQueens.length ? "" : " y bottoms"} de la semana.`);
      if (slay1) s.b("¡Nadie se va a casa esta semana!");
      s.hr();
      const safe = this.current.filter((q) => !this.topQueens.includes(q) && !this.bottomQueens.includes(q));
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      if (safe.length) s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, ${safe.length > 1 ? "estáis" : "estás"} a salvo.`);
      if (this.current.length <= 10 && this.episode > 3) {
        if ((this.current.length <= 10 && rnd(0, 10) === 7 && this.homeTrigger < 2) || this.homeTrigger === 0) {
          this.homeTrigger++;
          this.whoShouldGoHomeTonight(s);
        }
      }
      this.safeUntucked();
      this.judgingCritiques();
      if (f.lftwJ) return this.lftwJudging();
      return this.uk3Now() ? this.uk3Judging() : this.slayNow() ? this.slayersJudging() : this.winAndBtm2();
    }

    // Las reinas a salvo se van entre bambalinas mientras el jurado delibera (esopare).
    safeUntucked() {
      const safe = this.current.filter((q) => !this.topQueens.includes(q) && !this.bottomQueens.includes(q));
      if (safe.length < 2) return;
      const s = this.newScreen("Las reinas a salvo se relajan en Untucked...", "Ir a las críticas del jurado");
      s.b("Las reinas a salvo se van entre bambalinas mientras el jurado delibera.");
      s.b("Empiezan a comentar quién creen que está en el top... y quién está en apuros.");
      s.hr();
      let howMany;
      if (safe.length >= 8) howMany = rnd(3, 5);
      else if (safe.length >= 5) howMany = rnd(2, 4);
      else if (safe.length >= 3) howMany = rnd(2, 3);
      else howMany = 1;
      for (let i = 0; i < howMany; i++) {
        let hm = rnd(2, 4);
        if (safe.length === 2) hm = 2;
        else if (safe.length === 3) hm = rnd(2, 3);
        else if (safe.length === 4) hm = rnd(2, 4);
        hm = Math.min(hm, safe.length);
        this.interaction(s, shuffle(safe.slice()).slice(0, hm));
        s.hr();
      }
    }

    // Críticas del jurado a las reinas del top y del bottom (esopare).
    judgingCritiques() {
      const s = this.newScreen("Críticas del jurado", "Ver las decisiones");
      s.b("El panel de jurado de esta semana es...");
      s.b(["RuPaul", ...this.panel, this.guestJudge].filter(Boolean).join(", "));
      s.hr();
      const judged = shuffle([...this.topQueens, ...this.bottomQueens]);
      s.q(judged.map((q) => q.name), undefined, `${list(judged.map((q) => q.name))} representan los tops y bottoms de la semana.`);
      s.hr();
      s.b("Ahora es el momento de las críticas del jurado.");
      s.hr();
      const intros = ["Siguiente...", "Pasando a...", "Nuestra siguiente reina...", "Da un paso al frente...", "La siguiente concursante..."];
      judged.forEach((queen, i) => {
        const top = this.topQueens.includes(queen);
        s.b(i === 0 ? "Primera..." : pick(intros));
        s.q([queen.name], undefined, queen.name);
        if (rnd(1, 100) <= 80) s.b(`RuPaul: «${pick(top ? E.ruPositive : E.ruNegative)}»`);
        shuffle(this.panel.slice()).slice(0, rnd(1, this.panel.length)).forEach((j) => {
          s.b(`${j}: «${pick(top ? E.judgePositive : E.judgeNegative)}»`);
        });
        if (this.guestJudge && rnd(1, 100) <= 50) s.b(`${this.guestJudge}: «${pick(top ? E.judgePositive : E.judgeNegative)}»`);
        s.hr();
      });
    }

    whoShouldGoHomeTonight(s) {
      s.hr();
      s.b("Muy bien. Quiero oíros. ¿Quién debería irse a casa esta noche? ¿Y por qué?");
      const all = shuffle([...this.topQueens, ...this.bottomQueens]);
      all.forEach((q) => {
        if (rnd(0, 10) === 7) q.lipstick = this.worstSister(q, this.current);
        else q.lipstick = this.worstSister(q, this.bottomQueens.length > 1 ? this.bottomQueens : this.current);
        if (!this.bottomQueens.includes(q.lipstick)) q.lipstick = this.bottomQueens[rnd(0, this.bottomQueens.length - 1)];
        let reason;
        if (q.enemies.has(q.lipstick)) reason = pick(D.whoWhyRelation);
        else if (rnd(0, 100) >= 95) reason = pick(D.whoWhyRelation);
        else reason = pick(D.whoWhyCompetition);
        s.q([q.name, q.lipstick.name], "red", `${q.name} dijo ${q.lipstick.name} ${reason}.`);
        if (q.lipstick !== q) {
          if (rnd(0, 100) >= 80) {
            this.modRelation(4, [q, q.lipstick]);
            s.p(`${q.lipstick.name} se sintió muy dolida.`, "italic");
          } else {
            this.modRelation(3, [q, q.lipstick]);
            s.p(`${q.lipstick.name} se lo tomó muy bien, no se enfadó demasiado.`, "italic");
          }
        }
      });
    }

    // ---------- "¡Que vuelvan mis chicas!": ganadora, tops y bottoms ----------
    winAndBtm2() {
      if (this.opts.assassin || this.opts.fatal || this.opts.legacy || (this.opts.slaysian && this.current.length > 6)) { this.flag.isTeam = false; this.flag.isPair = false; } // estos juicios no usan equipos: no dejar la bandera puesta
      if (this.opts.assassin) return this.assassinJudging();
      if (this.opts.fatal) { const fr = this.fatalJudging(); if (fr !== false) return fr; }
      if (this.opts.legacy || (this.opts.slaysian && this.current.length > 6)) return this.legacyJudging();
      const f = this.flag;
      const s = this.newScreen("¡Que vuelvan mis chicas!", "Lip sync por la vida");
      s.b("Chicas, he tomado algunas decisiones...");
      this.gbm = null;
      const top = this.topQueens, bottom = this.bottomQueens;
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      if (f.isTeam) {
        const lastLabel = this.episodeChallenges[this.episodeChallenges.length - 1];
        if (lastLabel === "Girl Group" && rnd(0, 100) >= 65) {
          const names = top.map((q) => q.name);
          top.forEach((q) => { q.addTR(" WIN"); q.favoritism += 5; q.ppe += 5; });
          s.q(names, "royalblue", `${list(names)}. ¡Condragulations, sois el equipo ganador del reto de hoy!`);
          top.splice(0);
          f.isTeam = false;
        } else if (top.length > 1 && top[0].performanceScore === top[1].performanceScore && rnd(0, 100) < 60) {
          this.doubleWin(s, top);
        } else {
          this.singleWin(s, top);
        }
      } else if ((top.length > 1 && top[0].performanceScore === top[1].performanceScore && rnd(0, 100) < 60) || (f.isPair && top.length > 1 && rnd(0, 100) < 85)) {
        this.doubleWin(s, top);
      } else {
        this.singleWin(s, top);
      }
      if (top.length > 0) {
        if (f.isPair) f.isPair = false;
        const names = top.map((q) => q.name);
        if (f.isTeam) {
          f.isTeam = false;
          top.forEach((q) => { q.addTR("HIGH TEAM"); q.favoritism += 1; q.ppe += 4; });
        } else {
          top.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        }
        s.q(names, "lightblue", `${list(names)}, buen trabajo esta semana, ${names.length > 1 ? "estáis" : "estás"} a salvo.`);
      }
      s.hr();
      if (bottom.length >= 3) {
        const names = bottom.map((q) => q.name);
        s.q(names, "tomato", `${list(names)}, sois las bottoms de la semana...`);
      }
      bottom.forEach((q) => { q.performanceScore -= q.runwayScore; });
      bottom.sort((a, b) => a.performanceScore - b.performanceScore);
      this.twistBottom(s, bottom);
      const lowSafe = (count) => {
        const safe = bottom.splice(0, count);
        safe.forEach((q) => { q.addTR("LOW"); q.unfavoritism += 1; q.ppe += 2; });
        const names = safe.map((q) => q.name);
        s.q(names, "pink", `${list(names)}... ${names.length > 1 ? "estáis" : "estás"} a salvo.`);
      };
      if (bottom.length === 5) lowSafe(3);
      else if (bottom.length === 4) lowSafe(2);
      else if (bottom.length === 3 && bottom[0].performanceScore >= (this.opts.thailand ? 35 : 30) && this.current.length > 5 && !this.noElimNow()) {
        f.thirdqueen = true;
        s.b("... nadie está a salvo.");
      } else if (bottom.length === 3) lowSafe(1);
      const names = bottom.map((q) => q.name);
      s.q(names, "tomato", `${list(names)}, lo siento, queridas, pero ${names.length > 1 ? "estáis" : "estás"} en riesgo de eliminación.`);
      this.lipsyncDesc();
    }

    singleWin(s, top) {
      const w = top[0];
      w.addTR("WIN");
      w.favoritism += 5;
      w.ppe += 5;
      s.q([w.name], "royalblue", `${w.name}, condragulations, ¡eres la ganadora del reto de hoy!`);
      this.gbm = [w];
      this.twistWinner(s, w);
      top.splice(0, 1);
    }

    doubleWin(s, top) {
      const [a, b] = top;
      [a, b].forEach((q) => { q.addTR(" WIN"); q.favoritism += 5; q.ppe += 5; });
      s.q([a.name, b.name], "darkblue", `${a.name}, ${b.name}, condragulations, ¡sois las ganadoras del reto de hoy!`);
      this.gbm = [a, b];
      top.splice(0, 2);
    }

    // ---------- Jurado: eventos especiales ----------
    judgingFloppers() {
      const f = this.flag;
      f.floppersCheck = true;
      const s = this.newScreen("¡El jurado!", "Lip sync por la vida");
      const cast = this.current;
      s.b("Preparaos, porque Drag Race se va a poner serio...");
      s.b("Basándonos en las actuaciones de esta noche... Esta semana no habrá ganadoras.");
      s.q(cast.map((q) => q.name), "black");
      s.b("Estoy muy, muy decepcionada. Nadie está a salvo y dos de vosotras haréis lip sync por vuestra vida...");
      s.hr();
      const safe = cast.filter((q) => !this.bottomQueens.includes(q));
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, estáis todas a salvo. Y mientras os ponéis al fondo del escenario, tened una cosa en mente: ESPABILAD.`);
      s.hr();
      const bottom = this.bottomQueens;
      bottom.forEach((q) => { q.performanceScore -= q.runwayScore; });
      bottom.sort((a, b) => a.performanceScore - b.performanceScore);
      const low = bottom.splice(0, 1)[0];
      low.addTR("LOW"); low.unfavoritism += 1; low.ppe += 2;
      s.q([low.name], "pink", `${low.name}... estás a salvo.`);
      const names = bottom.map((q) => q.name);
      s.q(names, "tomato", `${list(names)}, lo siento, queridas, pero estáis en riesgo de eliminación.`);
      this.lipsyncDesc();
    }

    judging6Way() {
      this.flag.bottom6Check = true;
      const s = this.newScreen("¡El jurado!", "Ver las decisiones");
      const top = this.topQueens, bottom = this.bottomQueens;
      s.b("Basándonos en las actuaciones de esta noche...");
      const judged = [];
      top.forEach((q, i) => judged.push(q.name, bottom[i * 2].name, bottom[i * 2 + 1].name));
      const slay1 = this.slayNow();
      s.q(judged, "cyan", `${list(judged)}, representáis los tops${slay1 && !this.bottomQueens.length ? "" : " y bottoms"} de la semana.`);
      if (slay1) s.b("¡Nadie se va a casa esta semana!");
      s.hr();
      const safe = this.current.filter((q) => !top.includes(q) && !bottom.includes(q));
      safe.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
      s.q(safe.map((q) => q.name), undefined, `${list(safe.map((q) => q.name))}, estáis a salvo.`);
      // ganadora y bottoms
      const w = this.newScreen("¡Que vuelvan mis chicas!", "Lip sync por la vida");
      w.b("Chicas, he tomado algunas decisiones...");
      top.forEach((q) => this.rigAdj(q));
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      if (top.length > 1 && top[0].performanceScore === top[1].performanceScore && rnd(0, 100) < 60) this.doubleWin(w, top);
      else this.singleWin(w, top);
      if (top.length > 0) {
        top.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        const names = top.map((q) => q.name);
        w.q(names, "lightblue", `${list(names)}, buen trabajo esta semana, ${names.length > 1 ? "estáis" : "estás"} a salvo.`);
      }
      w.hr();
      const names = bottom.map((q) => q.name);
      w.q(names, "tomato", `${list(names)}, tenéis que espabilar...`);
      w.b("Por primera vez en la herstory de Drag Race, todas vosotras haréis lip sync por vuestra vida.");
      // lip sync de seis
      this.bottom6Lipsync();
    }

    bottom6Lipsync() {
      const bottom = this.bottomQueens;
      bottom.forEach((q) => { q.getLipsync(); q.lipsyncScore = (q.lipsyncScore - q.favoritism) + q.unfavoritism; });
      bottom.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const s = this.newScreen("Reinas, poneos frente a mí...", "Mostrar el resultado");
      const song = this.pickSong(s);
      s.b("Ha llegado la hora de que hagáis lip sync... ¡por vuestras vidas! Buena suerte, y no la caguéis.");
      s.hr();
      this.lipsyncEvent(s, bottom);
      this.lipsyncGroups(s, bottom, song);
      const r = this.newScreen("He tomado mi decisión.", "Continuar");
      const last = bottom[bottom.length - 1], prev = bottom[bottom.length - 2];
      const score1 = prev.lipsyncScore - prev.favoritism + prev.unfavoritism;
      const score2 = last.lipsyncScore - last.favoritism + last.unfavoritism;
      const safe = bottom.slice(0, bottom.length - 2);
      safe.forEach((q) => {
        r.q([q.name], "tomato", `${q.name}, shantay, te quedas.`);
        q.addTR(bottom.length === 5 ? "BTM5" : "BTM6");
        q.unfavoritism += 3; q.ppe += 1;
      });
      if (score1 < 2 && score2 < 2 && rnd(0, 100) <= 8 && this.current.length > 6 && !this.tw.has("DISABLE_DOUBLE")) {
        r.b("Lo siento, pero ninguna de las dos ha mostrado el fuego que hace falta para quedarse. Las dos... sashay away.");
        this.flag.doubleSashay = true;
        [prev, last].forEach((q, i) => {
          q.addTR(" ELIM "); q.unfavoritism += 5; q.rankP = i === 0 ? "tie1" : "tie2";
          this.eliminated.unshift(q);
          this.current.splice(this.current.indexOf(q), 1);
          this.exitLine(r, q);
        });
        this.addSong(safe, [prev, last], song);
      } else {
        r.q([prev.name], "tomato", `${prev.name}, shantay, te quedas.`);
        prev.addTR(bottom.length === 5 ? "BTM5" : "BTM6");
        prev.unfavoritism += 3; prev.ppe += 1;
        r.q([last.name], "red", `${last.name}, sashay away...`);
        last.addTR("ELIM"); last.unfavoritism += 5;
        this.eliminated.unshift(last);
        this.current.splice(this.current.indexOf(last), 1);
        this.exitLine(r, last);
        this.addSong([...safe, prev], [last], song);
      }
      this.untucked();
    }

    judgingSlayers() {
      const f = this.flag;
      f.slayersCheck = true;
      const s = this.newScreen("¡El jurado!", "Continuar");
      const top = this.topQueens;
      s.b("Basándonos en las actuaciones de esta noche...");
      if (this.current.length > 8) {
        const lastThree = top.slice(-3);
        s.q(lastThree.map((q) => q.name), "black", `${list(lastThree.map((q) => q.name))}, estáis a salvo.`);
        lastThree.forEach((q) => { q.addTR("SAFE"); q.ppe += 3; });
        top.splice(top.length - 3, 3);
        s.hr();
      }
      s.q(top.map((q) => q.name), "cyan", `${list(top.map((q) => q.name))}, representáis los tops de la semana.`);
      s.p("¡Esta noche nadie se va a casa!");
      s.hr();
      top.forEach((q) => { q.performanceScore -= q.runwayScore; });
      top.sort((a, b) => a.performanceScore - b.performanceScore);
      this.top2 = [top[0], top[1]];
      top.splice(0, 2);
      s.q(this.top2.map((q) => q.name), "cyan", `${this.top2[0].name}, ${this.top2[1].name}, condragulations, ¡sois el Top 2 de la semana!`);
      if (top.length > 0) {
        top.forEach((q) => { q.addTR("HIGH"); q.favoritism += 1; q.ppe += 4; });
        s.q(top.map((q) => q.name), "lightblue", `${list(top.map((q) => q.name))}, buen trabajo esta semana, estáis todas a salvo.`);
      }
      s.hr();
      s.b("¡El Top 2 hará ahora lip sync... por la victoria!");
      const song = this.pickSong(s);
      this.top2.forEach((q) => q.getASLipsync());
      this.top2.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const [t0, t1] = this.top2;
      if (t0.lipsyncScore === t1.lipsyncScore && t0.lipsyncScore > 7 && t1.lipsyncScore > 7) {
        s.q([t0.name, t1.name], "darkblue", "Condragulations, ¡las dos sois ganadoras, baby!");
        [t0, t1].forEach((q) => { q.favoritism += 5; q.ppe += 5; q.addTR(" WIN"); });
        this.addSong([t0, t1], [], song);
      } else {
        s.q([t0.name], "royalblue", `${t0.name}, ¡eres una ganadora, baby!`);
        t0.addTR("WIN"); t0.favoritism += 5; t0.ppe += 5;
        t1.addTR("TOP2"); t1.favoritism += 2; t1.ppe += 4.5;
        this.addSong([t0], [t1], song);
      }
      this.noteBlot(this.top2, song);
      s.hr();
    }

    judgingLaLaPaRUZa() {
      const f = this.flag;
      f.s14Check = true;
      const s = this.newScreen("¡El jurado!", "Empezar el Smackdown");
      const top = this.topQueens, bottom = this.bottomQueens;
      s.b("Basándonos en las actuaciones de esta noche...");
      s.hr();
      top[0].addTR("WIN"); top[0].favoritism += 5; top[0].ppe += 5;
      s.q([top[0].name], "royalblue", `${top[0].name}, condragulations, ¡eres la ganadora del reto de hoy!`);
      s.hr();
      s.q(bottom.map((q) => q.name), "tomato", `${list(bottom.map((q) => q.name))}, esperaba mucho más de vosotras...`);
      s.b("Lo siento, queridas, pero todas estáis en riesgo de eliminación. Necesito veros hacer lip sync a todas...");
      bottom.forEach((q) => { q.addTR("BTM"); q.unfavoritism += 3; q.ppe += 1; });
      this.lalaparuzaSmackdown();
    }

    lalaparuzaSmackdown() {
      const top = this.topQueens, bottom = this.bottomQueens;
      const s = this.newScreen("¡Lipsync LaLaPaRUza Smackdown!!", "Continuar");
      s.b("Si ganáis vuestro lip sync, estaréis a salvo de la eliminación... Si perdéis, seguiréis enfrentándoos hasta que queden dos reinas... Al final, una de ellas se irá a casa.");
      s.q([top[0].name], undefined, `${top[0].name}, tú eres la excepción. ¡Esta noche estás a salvo de la eliminación!`);
      top[0].addTR(" SAFE");
      s.b("¡Ahora que comience el Lipsync LaLaPaRUza Smackdown!!");
      let order = shuffle(bottom.slice());
      const duel = (a, b, round) => {
        s.q([a.name, b.name], undefined, `${a.name} y ${b.name} harán lip sync...`);
        s.b("Ha llegado la hora de que hagáis lip sync... ¡por vuestra vida! Buena suerte, y no la caguéis.");
        const song = this.pickSong(s);
        s.b("He tomado mi decisión.");
        [a, b].forEach((q) => q.getASLipsync());
        const sorted = [a, b].sort((x, y) => y.lipsyncScore - x.lipsyncScore);
        this.addSong([sorted[0]], [sorted[1]], song);
        return { win: sorted[0], lose: sorted[1], song, sorted };
      };
      // ronda 1 y 2: el que gana se salva; el que pierde sigue en riesgo
      for (let round = 1; round <= 2; round++) {
        if (round === 2) { s.hr(); s.b("¡Siguiente ronda!"); }
        order = shuffle(order);
        const next = [];
        for (let i = 0; i + 1 < order.length; i += 2) {
          const r = duel(order[i], order[i + 1], round);
          s.q([r.win.name], "royalblue", `${r.win.name}, ¡shantay, te quedas!`);
          s.p(`${r.lose.name}, sigues en riesgo de eliminación.`);
          r.win.addTR(`SAFE<br>R${round}`);
          next.push(r.lose);
        }
        if (order.length % 2 === 1) next.push(order[order.length - 1]);
        order = next;
        if (order.length <= 2) break;
      }
      s.hr();
      s.b("¡Ronda final!");
      order = shuffle(order);
      const survivors = order.slice();
      if (survivors.length >= 2) {
        const [a, b] = survivors;
        const r = duel(a, b, 3);
        if (r.sorted[0].lipsyncScore > 6 && r.sorted[1].lipsyncScore > 6 && r.sorted[0].lipsyncScore >= r.sorted[1].lipsyncScore) {
          s.q([a.name, b.name], "darkblue", "¡Shantay, las dos os quedáis, baby!");
          a.addTR("SAFE<br>R3"); b.addTR("SAFE<br>R3");
        } else {
          s.q([r.win.name], "royalblue", `${r.win.name}, ¡shantay, te quedas!`);
          r.win.addTR("SAFE<br>R3");
          s.b(`${r.lose.name}, sashay away.`);
          r.lose.addTR(" ELIM "); r.lose.unfavoritism += 2;
          this.eliminated.unshift(r.lose);
          this.current.splice(this.current.indexOf(r.lose), 1);
          this.exitLine(s, r.lose);
        }
      }
      this.episodeChallenges.push("LaLaPaRUza Smackdown");
      this.episode++;
    }

    // ======================================================================================
    // LIP SYNC
    // ======================================================================================
    // Frase de despedida de la eliminada (esopare).
    exitLine(s, queen) {
      s.hr();
      s.q([queen.name], "red", `${queen.name}: «${pick(E.exitLines)}»`);
    }

    // Discurso de la ganadora (esopare).
    winSpeech(s, queens) {
      s.hr();
      s.b("Querida, ¿hay algo que quieras decir?");
      queens.forEach((q) => s.q([q.name], "yellow", `${q.name}: «${pick(E.winSpeeches)}»`));
      s.hr();
    }

    pickSong(s) {
      if (!this.songs.length) this.songs = D.songs.slice();
      const i = rnd(0, this.songs.length - 1);
      const song = this.songs[i];
      this.songs.splice(i, 1);
      s.b(`Antes de esta noche, se os pidió que prepararais una actuación de lip sync con... ${song}!`);
      this.songUsed = song;
      return song;
    }

    songParts(song) {
      const k = song.indexOf(" by ");
      return k < 0 ? { name: song, by: "" } : { name: song.slice(0, k), by: song.slice(k + 1) };
    }

    addSong(win, lose, song) {
      this.alots.push({ episode: this.episode, win: win.map((q) => q.name), lose: lose.map((q) => q.name), song });
    }

    noteBlot(queens, song) {
      const avg = queens.reduce((s, q) => s + q.lipsyncScore, 0) / queens.length;
      if (avg >= 8 || avg <= 1) this.blots.push({ episode: this.episode, queens: queens.map((q) => q.name), score: avg, song });
    }

    lipsyncEvent(s, queens) {
      const queen = queens[rnd(0, queens.length - 1)];
      if (rnd(0, 1000) >= 900) {
        let ev = D.lipsyncEventsBad[rnd(0, D.lipsyncEventsBad.length - 2)];
        if (rnd(0, 1000) === 777) ev = D.lipsyncEventsBad[10];
        if (queen.unfavoritism > 8 && queen.favoritism < 5 && rnd(0, 100) >= 70) ev = D.lipsyncEventsBad[11];
        s.q([queen.name], "red", `¡Oh, no! ${queen.name} ${ev.text}`);
        queen.lipsyncScore += ev.points;
      } else if (rnd(0, 1000) >= 900) {
        const ev = pick(D.lipsyncEventsGood);
        s.q([queen.name], "green", `${queen.name} ${ev.text}`);
        queen.lipsyncScore += ev.points;
      }
    }

    lipsyncGroups(s, queens, song) {
      const by = (lo, hi) => queens.filter((q) => q.lipsyncScore >= lo && q.lipsyncScore < hi);
      const slay = by(12, Infinity), great = by(8, 12), good = by(4, 8), bad = by(2, 4), flop = by(-Infinity, 2);
      this.noteBlot(queens, song);
      // la reputación (favoritismo) vuelve a pesar al decidir quién gana
      if (!this.tw.has("RIGGORY_LIPSYNC")) queens.forEach((q) => { q.lipsyncScore = q.lipsyncScore + q.favoritism - q.unfavoritism; });
      this.describeGroups(s, [
        [slay, undefined, (l, pl) => `¡¡${l} ${pl ? "arrasaron" : "arrasó"} en el lip sync!!`],
        [great, undefined, (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} un gran lip sync!`],
        [good, undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} un buen lip sync.`],
        [bad, undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} un mal lip sync...`],
        [flop, undefined, (l, pl) => `${l} ${pl ? "fracasaron" : "fracasó"} en el lip sync...`],
      ]);
    }

    lipsyncDesc() {
      const bottom = this.bottomQueens;
      const s = this.newScreen("Reinas, poneos frente a mí...", "Mostrar el resultado");
      bottom.forEach((q) => {
        if (this.tw.has("RIGGORY_LIPSYNC")) { q.getASLipsync(); return; }
        q.getLipsync();
        q.lipsyncScore = (q.lipsyncScore - q.favoritism) + q.unfavoritism;
      });
      const song = this.pickSong(s);
      s.b("Ha llegado la hora de que hagáis lip sync... ¡por vuestras vidas! Buena suerte, y no la caguéis.");
      s.hr();
      if (rnd(0, 1000) >= 999 && !this.flag.disqOrDept && bottom.length === 2) return this.quitInLipsync(s, song);
      this.lipsyncEvent(s, bottom);
      this.lipsyncGroups(s, bottom, song);
      this.lipsyncResult(song);
    }

    quitInLipsync(s, song) {
      const bottom = this.bottomQueens;
      const quitter = bottom[rnd(0, bottom.length - 1)];
      const other = bottom.find((q) => q !== quitter);
      s.q([quitter.name], "red", `${quitter.name}, sorprendentemente, ha abandonado la pasarela: ha decidido que no hará el lip sync.`);
      quitter.addTR("QUIT"); quitter.unfavoritism += 5; quitter.queenDisqOrDept = true; quitter.minqdd = "(Abandono)";
      other.addTR("BTM2"); other.unfavoritism += 3; other.ppe += 1;
      this.addSong([other], [], song);
      this.eliminated.unshift(quitter);
      this.current.splice(this.current.indexOf(quitter), 1);
      this.flag.disqOrDept = true;
      this.untucked();
    }

    lipsyncResult(song) {
      const f = this.flag;
      const bottom = this.bottomQueens;
      bottom.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const s = this.newScreen("He tomado mi decisión.", "Continuar");
      const rigL = this.tw.has("RIGGORY_LIPSYNC");
      const score1 = rigL ? bottom[0].lipsyncScore : bottom[0].lipsyncScore - bottom[0].favoritism + bottom[0].unfavoritism;
      const score2 = rigL ? bottom[1].lipsyncScore : bottom[1].lipsyncScore - bottom[1].favoritism + bottom[1].unfavoritism;
      const elim = (q, label = "ELIM", tie) => {
        if (this.fateSave(s, q)) return;
        q.addTR(label); q.unfavoritism += 5;
        if (tie) q.rankP = tie;
        this.eliminated.unshift(q);
        this.current.splice(this.current.indexOf(q), 1);
        this.exitLine(s, q);
      };
      const stay = (q, label = "BTM2") => { q.addTR(label); q.unfavoritism += 3; q.ppe += 1; };
      if (this.noElimNow()) {
        // Estreno sin eliminación: las dos de abajo se quedan siempre.
        if (bottom[0].lipsyncScore <= 3 && bottom[1].lipsyncScore <= 3) {
          s.b(`${bottom[0].name}, ${bottom[1].name}. Este lip sync no estuvo al nivel de Drag Race...`);
          s.hr();
          s.p("Os voy a dar una segunda oportunidad... a las dos...");
        }
        s.q([bottom[0].name, bottom[1].name], "hotpink", "Shantay, las dos os quedáis...");
        stay(bottom[0], " BTM2"); stay(bottom[1], " BTM2");
        this.addSong(bottom, [], song);
        return this.untucked();
      }
      if (f.thirdqueen && this.current.length > 5) {
        f.thirdqueen = false;
        if (score1 > 3 && score2 > 3 && rnd(0, 100) <= 90) {
          this.addSong([bottom[0], bottom[1]], [bottom[2]], song);
          s.q([bottom[0].name], "tomato", `${bottom[0].name}, shantay, te quedas.`);
          s.q([bottom[1].name], "tomato", `${bottom[1].name}, shantay, te quedas.`);
          stay(bottom[0], "BTM3"); stay(bottom[1], "BTM3");
          s.q([bottom[2].name], "red", `${bottom[2].name}, sashay away...`);
          elim(bottom[2]);
        } else {
          this.addSong([bottom[0]], [bottom[1], bottom[2]], song);
          s.q([bottom[0].name], "tomato", `${bottom[0].name}, shantay, te quedas.`);
          stay(bottom[0], "BTM3");
          s.q([bottom[1].name], "red", `${bottom[1].name}, sashay away...`);
          s.q([bottom[2].name], "red", `${bottom[2].name}, sashay away...`);
          elim(bottom[1], "ELIM", "tie1"); elim(bottom[2], "ELIM", "tie2");
        }
        return this.untucked();
      }
      // Con una reina más que las de la final, un doble shantay puede ampliar la final en una
      // reina (Top 2 -> Top 3 -> Top 4), como en los originales.
      // Número de capítulos pedido (opcional): los dobles shantay / sashay que faltan se reparten por la temporada.
      const plan = this.plan;
      const left = this.current.length - this.finaleSize; // episodios de eliminación que quedan
      let forceShantay = !!f.forceShantay, forceSashay = false;
      if (plan && !this.premiereHalf && !forceShantay) {
        if (plan.s > 0 && left >= 1 && Math.random() < plan.s / Math.max(1, this.finaleSize >= 3 ? left - plan.d + plan.s : left)) forceShantay = true;
        else if (plan.d > 0 && left >= 2 && Math.random() < plan.d / Math.max(1, left - plan.d + plan.s)) forceSashay = true;
      }
      const atFinaleEdge = !this.premiereHalf && !this.splitNow && this.current.length === this.finaleSize + 1;
      if (forceShantay || (!plan && score1 > 7 && score2 > 7 && rnd(0, 100) <= 50 && !f.doubleShantay && !this.tw.has("DISABLE_DOUBLE"))) {
        if (forceShantay && plan && !f.forceShantay) plan.s--;
        f.forceShantay = false;
        if (!forceShantay && atFinaleEdge && (this.finaleSize <= 3 || this.opts.lftc) && rnd(0, 10) >= 6) {
          this.finaleSize++;
          this.opts.lftc = false; // el Lip-Sync For The Crown pasa a ser una final Top 5
        }
        let kandy = false;
        if (!forceShantay && rnd(0, 100) >= 95) {
          s.q([bottom[0].name], "tomato", `${bottom[0].name}, shantay, te quedas.`);
          s.q([bottom[1].name], "red", `${bottom[1].name}, sashay away...`);
          kandy = true;
        } else {
          s.q([bottom[0].name, bottom[1].name], "magenta", "Condragulations, ¡las dos os quedáis, shantay!");
          stay(bottom[0], " BTM2"); stay(bottom[1], " BTM2");
          f.doubleShantay = true;
        }
        this.addSong(bottom, [], song);
        return kandy ? this.kandyFO() : this.untucked();
      }
      if (forceSashay || (!plan && score1 < 2 && score2 < 2 && rnd(0, 100) <= 8 && !f.doubleSashay && this.current.length > 6 && !this.tw.has("DISABLE_DOUBLE"))) {
        if (forceSashay) plan.d--;
        s.q([bottom[0].name, bottom[1].name], "darkred");
        this.addSong([], bottom, song);
        s.b("Lo siento, pero ninguna de las dos ha mostrado el fuego que hace falta para quedarse. Las dos... sashay away.");
        f.doubleSashay = true;
        elim(bottom[0], " ELIM ", "tie1"); elim(bottom[1], " ELIM ", "tie2");
        return this.untucked();
      }
      if (rnd(0, 1000) >= 999 && !f.disqOrDept) {
        const dq = this.current[rnd(0, this.current.length - 1)];
        s.q([dq.name], "red", `${dq.name}, ha llegado a mi conocimiento que has roto las reglas de esta competición. Debo pedirte que te marches: sashay away.`);
        if (dq === bottom[0]) { this.addSong([bottom[1]], [bottom[0]], song); bottom[1].addTR("BTM2"); }
        else if (dq === bottom[1]) { this.addSong([bottom[0]], [bottom[1]], song); bottom[0].addTR("BTM2"); }
        else { this.addSong(bottom, [], song); bottom[0].addTR(" BTM2"); bottom[1].addTR(" BTM2"); dq.trackRecord.pop(); }
        bottom[0].unfavoritism += 3; bottom[0].ppe += 1; bottom[1].unfavoritism += 3; bottom[1].ppe += 1;
        dq.minqdd = "(Descalificada)";
        dq.addTR("DISQ"); dq.queenDisqOrDept = true;
        this.eliminated.unshift(dq);
        this.current.splice(this.current.indexOf(dq), 1);
        f.disqOrDept = true;
        return this.untucked();
      }
      if (rnd(0, 1000) >= 999 && !f.disqOrDept) {
        const injured = this.current[rnd(0, this.current.length - 1)];
        s.q([injured.name], "red", `${injured.name}, por favor, da un paso al frente.`);
        s.b("Hemos hablado con el médico. Necesitas tiempo para recuperarte. No puedo permitir que continúes en la competición.");
        s.b("Debo pedirte que te marches: sashay away.");
        let ogpl = "BTM2";
        if (injured === bottom[0]) { this.addSong([bottom[1]], [], song); bottom[1].addTR("BTM2"); }
        else if (injured === bottom[1]) { this.addSong([bottom[0]], [], song); bottom[0].addTR("BTM2"); }
        else { this.addSong(bottom, [], song); bottom[0].addTR(" BTM2"); bottom[1].addTR(" BTM2"); ogpl = injured.trackRecord.pop(); }
        bottom[0].unfavoritism += 3; bottom[0].ppe += 1; bottom[1].unfavoritism += 3; bottom[1].ppe += 1;
        injured.minqdd = "(Baja)";
        injured.addTR("DEPT"); injured.queenDisqOrDept = true; injured.ogpl = ogpl;
        this.eliminated.unshift(injured);
        this.current.splice(this.current.indexOf(injured), 1);
        f.disqOrDept = true;
        return this.untucked();
      }
      // lo normal: una se queda y la otra se va
      this.addSong([bottom[0]], [bottom[1]], song);
      if (bottom[0].lipsyncScore < 2 && rnd(0, 10) >= 6) { s.b("Meh..."); s.hr(); }
      s.q([bottom[0].name], "tomato", `${bottom[0].name}, shantay, te quedas.`);
      stay(bottom[0]);
      s.q([bottom[1].name], "red", `${bottom[1].name}, sashay away...`);
      elim(bottom[1]);
      this.untucked();
    }

    kandyFO() {
      const bottom = this.bottomQueens;
      const s = this.newScreen("¡ESPERA!, espera", "Continuar");
      s.q([bottom[1].name], "hotpink", `${bottom[1].name}, no estoy preparada para que te vayas a casa... shantay, te quedas.`);
      bottom[0].addTR(" BTM2"); bottom[0].unfavoritism += 3; bottom[0].ppe += 1;
      bottom[1].addTR(" BTM2"); bottom[1].unfavoritism += 3; bottom[1].ppe += 1;
      this.flag.doubleShantay = true;
      this.untucked();
    }

    // ======================================================================================
    // UNTUCKED
    // ======================================================================================
    untucked() {
      const s = this.newScreen("¡Untucked!!", "Continuar");
      const cast = this.current;
      s.b("Al terminar el episodio, las reinas se sientan a hablar de sus sentimientos sobre este episodio.");
      s.hr();
      let howMany = 0;
      if (cast.length < 50) howMany = rnd(3, 7);
      if (cast.length < 12) howMany = rnd(5, 6);
      if (cast.length < 6) howMany = rnd(2, 3);
      if (cast.length === 2) howMany = 1;
      for (let i = 0; i < howMany; i++) {
        let hm = rnd(0, 100);
        hm = hm <= 75 ? 2 : hm <= 95 ? 3 : 4;
        if (cast.length < 6) hm = rnd(2, 3);
        if (cast.length === 2) hm = 2;
        if (hm > cast.length) hm = cast.length;
        const group = shuffle(cast.slice()).slice(0, hm);
        this.interaction(s, group);
      }
this.allianceTick(s);
      s.reveal("Mostrar relaciones", this.relationshipBlocks());
      if (this.tw.has("FAME_GAMES")) this.fameShowcase(s);
    }

    twoTypeEvent(a, b) {
      const random = rnd(0, 10);
      const r = this.rel(a, b);
      const table = (r >= 6) ? [[6, 1], [3, 2], [2, 3], [1, 4], [0, 5]]
        : (r >= 2) ? [[7, 1], [5, 2], [2, 3], [1, 4], [0, 5]]
        : (r >= -1) ? [[8, 1], [6, 2], [3, 3], [1, 4], [0, 5]]
        : (r >= -5) ? [[9, 1], [8, 2], [3, 3], [1, 4], [0, 5]]
        : [[10, 1], [9, 2], [4, 3], [1, 4], [0, 5]];
      for (const [min, type] of table) if (random >= min) return type;
      return 5;
    }

    interaction(s, group) {
      const names = group.map((q) => q.name);
      const U = D.untucked;
      if (group.length === 2) {
        const type = this.twoTypeEvent(group[0], group[1]);
        const tpl = type === 1 ? pick(U.two.friendSmall)
          : type === 2 ? pick(U.two.friendBig)
          : type === 3 ? pick(rnd(0, 1) ? U.two.badSmall : U.two.badSmall2)
          : type === 4 ? pick(rnd(0, 1) ? U.two.badBig : U.two.badBig2)
          : pick(U.two.neutral);
        s.q(names, undefined, fill(tpl, ...names));
        this.modRelation(type, group);
        this.checkFriend(group[0], group[1]);
        return;
      }
      const type = rnd(1, 4);
      const pool = group.length === 3 ? U.three : U.four;
      s.q(names, undefined, fill(pick(pool[type - 1]), ...names));
      this.modRelation(type, group);
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) this.checkFriend(group[i], group[j]);
    }

    relationshipBlocks() {
      const blocks = [];
      const cast = this.current;
      // que las relaciones que ya no se cumplen se rompan
      const lost = [];
      cast.forEach((a) => {
        [...a.sisters.keys()].forEach((b) => {
          const r = this.rel(a, b);
          if (a.friends.has(b)) {
            if (r < 6) { a.friends.delete(b); b.friends.delete(a); lost.push({ names: [a.name, b.name], color: "lightgreen", text: `${a.name} y ${b.name} ya no son amigas!` }); }
          } else if (a.allies.has(b)) {
            if (r < 9) { a.allies.delete(b); b.allies.delete(a); lost.push({ names: [a.name, b.name], color: "lightblue", text: `${a.name} y ${b.name} ya no tienen una alianza!` }); }
          } else if (a.enemies.has(b)) {
            if (r > -6) { a.enemies.delete(b); b.enemies.delete(a); lost.push({ names: [a.name, b.name], color: "lightcoral", text: `${a.name} y ${b.name} ya no son enemigas!` }); }
          } else this.checkFriend(a, b);
        });
      });
      blocks.push({ t: "hr" }, { t: "big", text: "Relaciones" });
      const seen = new Set();
      let any = false;
      lost.forEach((l) => { blocks.push({ t: "q", names: l.names, color: l.color, text: l.text }); any = true; });
      cast.forEach((a) => {
        [...a.sisters.keys()].forEach((b) => {
          if (!cast.includes(b)) return;
          const key = [a.name, b.name].sort().join("|");
          if (seen.has(key)) return;
          if (a.enemies.has(b)) {
            seen.add(key); any = true;
            blocks.push({ t: "q", names: [a.name, b.name], color: "red", text: `${a.name} y ${b.name} son enemigas!` });
          } else if (a.friends.has(b) || a.allies.has(b)) {
            seen.add(key); any = true;
            if (this.rel(a, b) > 7) blocks.push({ t: "q", names: [a.name, b.name], color: "blue", text: `${a.name} y ${b.name} tienen una alianza!` });
            else blocks.push({ t: "q", names: [a.name, b.name], color: "green", text: `${a.name} y ${b.name} son amigas!` });
          }
        });
      });
      if (!any) blocks.push({ t: "p", text: "No hay momentos destacados." });
      return blocks;
    }

    // ======================================================================================
    // TRACK RECORD
    // ======================================================================================
    cellFor(raw, queen, col) {
      // "RTRN + X": la reina comodín que regresó (el estilo es el de X con el prefijo "REGRESO +")
      // Resultados combinados al estilo de la wiki: una sola línea "WIN+ELIM", "SAFE+ADV", "RTRN+SAFE"...
      const blockedCell = typeof raw === "string" && raw.endsWith("+BLOCKED"); // All Winners: bloqueada por el desatascador
      if (blockedCell) raw = raw.slice(0, -8);
      const tourMark = typeof raw === "string" && (raw.endsWith("+ADV") || raw.endsWith("+ELIM")) ? (raw.endsWith("+ADV") ? "ADV" : "ELIM") : null; // Torneo
      if (tourMark) raw = raw.slice(0, -(tourMark.length + 1));
      if (queen.retCols && queen.retCols.includes(col) && typeof raw === "string" && raw !== "" && !raw.startsWith("RTRN")) raw = "RTRN+" + raw; // primer episodio tras regresar
      const returned = typeof raw === "string" && raw.startsWith("RTRN+"); // comodín que vuelve
      if (returned) raw = raw.slice(5);
      const wild = typeof raw === "string" && raw.startsWith("RTRN + ");
      const style = CELL_STYLE[wild ? raw.slice(7) : raw] || { text: raw };
      let baseText = style.text !== undefined ? style.text : (wild ? raw.slice(7) : raw);
      let bg = style.bg, fg = style.fg, bold = style.bold;
      if (returned) { baseText = "RTRN+" + baseText; bg = { SAFE: "orange", LOW: "#ffb18a", HIGH: "#a0eeb4", BTM2: "#FF7D2B", BTM3: "#FF7D2B", BTM4: "#FF7D2B" }[raw] || bg; }
      if (blockedCell) { baseText += "+BLOCKED"; bg = "#f4a6a6"; fg = "#202122"; bold = true; }
      if (tourMark === "ADV") { baseText += "+ADV"; bold = true; }
      if (tourMark === "ELIM") {
        baseText += "+ELIM";
        bg = /^WIN/.test(String(raw).trim()) ? (style.bg === "deepskyblue" ? "#C64FFF" : "#9400D3") : "sienna";
        fg = "#FFF"; bold = true;
      }
      // Thailand (wiki de las temporadas 1 y 2): la ganadora del maxi reto lleva "WIN + resultado" apilado y la que solo
      // gana la pasarela, un "WIN" celeste; si queda a salvo, su "WIN" es azul oscuro.
      if (this.opts.thailand && typeof raw === "string") {
        const t = ThaiCell(raw);
        if (t) {
          if (returned) { baseText = "RTRN+" + t.text; } else baseText = t.text;
          bg = returned ? bg : t.bg; fg = t.fg; bold = t.bold;
        }
      }
      const cell = { text: wild ? "REGRESO\n+\n" + baseText : baseText, bg, fg, bold, border: style.border };
      if (queen.starLog[col]) cell.sub = `+${queen.starLog[col]} MVQ`;
      if (queen.immuneCols.includes(col)) cell.immune = true; // salvada por una poción de inmunidad
      if (queen.miniEpisode.includes(col + 1)) {
        const mini = queen.tCaptain.includes(col + 1) ? "Capitana de equipo" : "Ganadora del mini reto";
        cell.sub = cell.sub ? `${mini} · ${cell.sub}` : mini;
      }
      // Jury Vote: en la columna de la final se muestran los puntos del jurado.
      if (this.opts.jury && queen.juryPoints !== undefined && col === this.episodeChallenges.length - 1
        && /^(MSCON)?(WIN|RUNUP|ELIMINATED)|^(WINNER|RUNNER UP)$/.test(raw)) {
        cell.sub = `(${queen.juryPoints} puntos)`;
      }
      return cell;
    }

    trData(finale) {
      const mvq = !!(this.opts.winners || this.opts.tournament || this.hadTournament);
      const columns = this.episodeChallenges.map((c) => TR_LABEL[c] || c);
      const mkRow = (queen, rankHtml) => {
        const cells = [];
        for (let i = 0; i < columns.length; i++) cells.push(this.cellFor(queen.trackRecord[i] !== undefined ? queen.trackRecord[i] : "", queen, i));
        if (queen.ogPlace) rankHtml += `\n(Orig. ${ordinal(queen.ogPlace)})`;
        const row = { name: queen.name, claimedBy: queen.claimedBy || "", rank: rankHtml, cells, ppe: queen.episodesOn ? (queen.ppe / queen.episodesOn * 2).toFixed(2) : "0.00" };
        if (mvq) row.mvq = queen.starLog.reduce((a, b) => a + (b || 0), 0);
        if (this.opts.tournament && queen.bracket) {
          row.bracket = queen.bracket;
          if (queen.bracket2) {
            row.bracket2 = queen.bracket2;
            row.bracket2Color = (this.opts.tournament.colors || [])[queen.bracket2 - 1] || TOUR_COLORS[(queen.bracket2 - 1) % TOUR_COLORS.length];
          }
          row.bracketColor = (this.opts.tournament.colors || [])[queen.bracket - 1] || TOUR_COLORS[(queen.bracket - 1) % TOUR_COLORS.length];
        }
        return row;
      };
      const rows = [];
      const cur = this.tourAlive ? this.tourAlive.slice() : this.teamsFlat();
      if (finale) {
        const winner = cur[0];
        rows.push(mkRow(winner, "1º\n(Ganadora)" + (winner.minqdd ? "\n" + winner.minqdd : "")));
      } else {
        cur.forEach((q) => rows.push(mkRow(q, "TBA" + (q.minqdd ? "\n" + q.minqdd : ""))));
      }
      const base = cur.length;
      this.eliminated.forEach((q, i) => {
        let rank;
        if (q.rankP === 1) rank = "1º\n(Ganadora)";
        else if (q.rankP === 2) rank = "2º\n(Subcampeona)";
        else if (q.rankP === 32) rank = "3º\n(Subcampeona)";
        else if (q.rankP === 345) rank = "3º-5º";
        else if (q.rankP === 38) rank = "3º-8º";
        else if (q.rankP === 5678) rank = "5º-8º";
        else if (q.rankP === 58) rank = "5º-8º";
        else if (typeof q.rankP === "string" && q.rankP.startsWith("rng:")) { const [lo, hi] = q.rankP.slice(4).split("-"); rank = `${lo}º-${hi}º`; }
        else if (q.rankP === 56) rank = "5º/6º";
        else if (q.rankP === 34) rank = "3º/4º";
        else if (q.rankP === 234) rank = "2º-4º\n(Subcampeona)";
        else if (q.rankP === 432) rank = "3º/4º\n(Subcampeona)";
        else if (q.rankP === 23) rank = "2º/3º\n(Subcampeona)";
        else if (q.rankP === "tie1") rank = `${base + i}º/${base + 1 + i}º`;
        else if (q.rankP === "tie2") rank = `${base + 1 + i}º/${base + 2 + i}º`;
        else rank = ordinal(base + 1 + i);
        if (q.minqdd) rank += "\n" + q.minqdd;
        rows.push(mkRow(q, rank));
      });
      return { t: "tr", columns, rows, mvq };
    }

    trackRecordScreen(finale) {
      const s = this.newScreen("Progreso de las concursantes", "Continuar");
      s.add(this.trData(finale));
      // las eliminadas reciben una casilla vacía para la siguiente columna (como en el original)
      this.eliminated.forEach((q) => { while (q.trackRecord.length < this.episodeChallenges.length + 1) q.addTR(""); });
    }

    // ======================================================================================
    // REUNIÓN Y FINAL
    // ======================================================================================
    reunion() {
      const s = this.newScreen("¡La reunión!", "Ir a la final");
      if (this.opts.randomLabel) s.p(`Final aleatorio: esta temporada acaba con «${this.opts.randomLabel}».`);
      if (this.readReu.length > 0) {
        s.big("¡La biblioteca está abierta!");
        s.b("¡Pero solo para las concursantes que no tuvieron ocasión de leer a sus compañeras durante la temporada!");
        this.readingChallenge(this.readReu, false).forEach((blk) => s.add(blk));
        s.hr();
      }
      this.missCongeniality(s);
      this.titlesBlock(s);
    }

    // Títulos extra de la reunión (Miss Villain, Fan Favorite, Golden Boot, Fashion Mogul, Miss Robbed, Miss Worst Look,
    // Drag Popstar, Miss Lost Look y Miss Brick): cada uno marca la casilla de la ganadora si ya estaba eliminada.
    titlesBlock(s) {
      const tw = this.tw;
      const mark = (winner, code, label) => {
        if (this.eliminated.includes(winner)) winner.trackRecord[winner.trackRecord.length - 1] = code;
        winner.minqdd = winner.minqdd ? winner.minqdd + `\n(${label})` : `(${label})`;
      };
      const whole = () => this.current.concat(this.eliminated);
      const voteFor = (title, color, pickTarget) => {
        const all = shuffle(whole());
        this.eliminated.forEach((q) => { q.votes = 0; q.trackRecord[q.trackRecord.length - 1] = "GUEST"; });
        this.current.forEach((q) => { q.votes = 0; });
        all.forEach((q) => {
          q.lipstick = pickTarget(q, all);
          s.q([q.name, q.lipstick.name], "black", `¡${q.name} votó a ${q.lipstick.name} para ser ${title}!`);
          q.lipstick.votes++;
        });
        s.hr();
        all.sort((a, b) => b.votes - a.votes);
        s.q([all[0].name], color, `La ganadora de ${title} de esta temporada es... ¡${all[0].name}!`);
        return all[0];
      };
      if (tw.has("TITLE_VILLAIN")) {
        s.big("¡Las concursantes votarán a Miss Villana!");
        mark(voteFor("Miss Villana", "red", (q, all) => this.worstSister(q, all)), "VILLAIN", "Miss Villana");
        s.hr();
      }
      if (tw.has("TITLE_FAN_FAVORITE")) {
        s.big("¡Premio a la Favorita del público! 💖");
        const pts = (tr) => (tr.includes("WIN") ? 6 : tr.includes("TOP2") ? 6 : tr.includes("HIGH") ? 5 : tr.includes("SAFE") ? 5 : tr.includes("LOW") ? 1 : tr.includes("BTM") ? 8 : tr.includes("ELIM") ? 20 : 0);
        const scores = whole().map((q) => ({ q, score: q.trackRecord.reduce((a, tr) => a + (typeof tr === "string" ? pts(tr) : 0), 0) })).sort((a, b) => b.score - a.score);
        const w = scores[0].q;
        s.q([w.name], "hotpink", `El premio a la Favorita del público es para... ¡${w.name}!`);
        mark(w, "FANFAV", "Favorita del público");
        s.hr();
      }
      if (tw.has("TITLE_GOLDEN_BOOT")) {
        s.big("¡Premio Bota de Oro! 👢");
        const c = this.eliminated.filter((q) => q.trackRecord.includes("SAFE") || q.trackRecord.includes("LOW") || q.trackRecord.includes("BTM"));
        if (!c.length) s.b("¡Esta temporada no se ha podido dar la Bota de Oro!");
        else {
          c.sort((a, b) => b.runwayScore - a.runwayScore);
          s.q([c[0].name], "gold", `El premio Bota de Oro es para... ¡${c[0].name}!`);
          mark(c[0], "GBOOT", "Bota de Oro");
        }
        s.hr();
      }
      if (tw.has("TITLE_MOGUL")) {
        s.big("¡Premio Magnate de la Moda! 💜");
        const c = whole().sort((a, b) => b.st.design - a.st.design);
        s.q([c[0].name], "plum", `El premio Magnate de la Moda es para... ¡${c[0].name}!`);
        mark(c[0], "FASHION MOGUL", "Magnate de la Moda");
        s.hr();
      }
      if (tw.has("TITLE_ROBBED")) {
        s.big("¡Premio Miss Robada! 😭");
        const c = this.eliminated.filter((q) => ["SAFE", "HIGH", "WIN", "ELIM", "TOP2"].some((k) => q.trackRecord.includes(k)));
        if (!c.length) s.b("¡Esta temporada no se ha podido dar Miss Robada!");
        else {
          const pts = (tr) => (tr.includes("WIN") ? 10 : tr.includes("TOP2") ? 7 : tr.includes("HIGH") ? 9 : tr.includes("SAFE") ? 8 : tr.includes("LOW") ? 2 : tr.includes("BTM") ? 1 : tr.includes("ELIM") ? 35 : 0);
          const w = c.map((q) => ({ q, score: q.trackRecord.reduce((a, tr) => a + (typeof tr === "string" ? pts(tr) : 0), 0) })).sort((a, b) => b.score - a.score)[0].q;
          s.q([w.name], "deepskyblue", `El premio Miss Robada es para... ¡${w.name}!`);
          mark(w, "ROBBED", "Miss Robada");
        }
        s.hr();
      }
      if (tw.has("TITLE_WORST_LOOK")) {
        s.big("¡Premio Miss Peor Look! 💀");
        const c = this.eliminated.slice().sort((a, b) => a.runwayScore - b.runwayScore);
        if (!c.length) s.b("¡Esta temporada no se ha podido dar Miss Peor Look!");
        else { s.q([c[0].name], "gray", `El premio Miss Peor Look es para... ¡${c[0].name}!`); mark(c[0], "WORSTLOOK", "Miss Peor Look"); }
        s.hr();
      }
      if (tw.has("TITLE_POPSTAR")) {
        s.big("¡Premio Estrella del Pop Drag! 🎤");
        const c = whole().sort((a, b) => b.st.dance - a.st.dance);
        s.q([c[0].name], "hotpink", `El premio Estrella del Pop Drag es para... ¡${c[0].name}!`);
        mark(c[0], "POPSTAR", "Estrella del Pop Drag");
        s.hr();
      }
      if (tw.has("TITLE_LOST_LOOK")) {
        s.big("¡Premio Miss Look Perdido! ✨");
        const c = this.eliminated.slice().sort((a, b) => b.runwayScore - a.runwayScore);
        if (!c.length) s.b("¡Esta temporada no se ha podido dar Miss Look Perdido!");
        else { s.q([c[0].name], "deepskyblue", `El premio Miss Look Perdido es para... ¡${c[0].name}!`); mark(c[0], "LOSTLOOK", "Miss Look Perdido"); }
        s.hr();
      }
      if (tw.has("TITLE_BRICK")) {
        s.big("¡Las concursantes votarán a Miss Ladrillo!");
        const w = voteFor("Miss Ladrillo", "sienna", (q, all) => pick(all.filter((o) => o !== q).sort((a, b) => a.runwayScore - b.runwayScore).slice(0, 3)));
        mark(w, "BRICK", "Miss Ladrillo");
        s.hr();
      }
    }

    missCongeniality(s) {
      s.big("¡Las concursantes votarán a Miss Simpatía! (solo se puede votar a las eliminadas)");
      const whole = shuffle([...this.current, ...this.eliminated]);
      this.eliminated.forEach((q) => { q.votes = 0; q.trackRecord[q.trackRecord.length - 1] = "GUEST"; });
      this.current.forEach((q) => { q.votes = 0; });
      whole.forEach((q) => {
        const options = this.eliminated.filter((e) => e !== q);
        q.lipstick = this.bestSister(q, options.length ? options : whole);
        s.q([q.name, q.lipstick.name], "aqua", `¡${q.name} votó a ${q.lipstick.name} como Miss Simpatía!`);
        q.lipstick.votes++;
      });
      s.hr();
      whole.sort((a, b) => b.votes - a.votes);
      const top = Math.max(...whole.filter((q) => this.eliminated.includes(q)).map((q) => q.votes), 0);
      const winners = whole.filter((q) => this.eliminated.includes(q) && q.votes === top);
      const names = winners.map((q) => q.name);
      s.q(names, "aqua", winners.length > 1
        ? `Hay un empate: las ganadoras de Miss Simpatía de esta temporada son... ¡${list(names)}!`
        : `La ganadora de Miss Simpatía de esta temporada es... ¡${names[0]}!`);
      winners.forEach((winner) => {
        winner.trackRecord[winner.trackRecord.length - 1] = "MISS CON";
        winner.minqdd = winner.minqdd ? winner.minqdd + "\n(Miss Simpatía)" : "(Miss Simpatía)";
      });
      this.missCongName = names.join(" y ");
      s.hr();
    }

    // Final del Top 5 (los dos simuladores): cinco actuaciones individuales; las dos mejores
    // pasan al lip sync final y las otras tres se van ("3º-5º").
    finaleTop5() {
      const cast = this.current;
      const s = this.newScreen("¡La gran final!", "Ir a los minutos finales");
      s.q(cast.map((q) => q.name));
      s.b(cast.length === 8 ? "Las ocho finalistas harán actuaciones individuales de espectáculo." : "Las cinco finalistas harán actuaciones individuales de espectáculo.");
      cast.forEach((q) => q.getASLipsync());
      s.hr();
      const by = (lo, hi) => cast.filter((q) => q.lipsyncScore >= lo && q.lipsyncScore < hi);
      this.describeGroups(s, [
        [by(12, Infinity), "darkblue", (l, pl) => `¡¡${l} ${pl ? "arrasaron" : "arrasó"} en la actuación final!!`],
        [by(8, 12), "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran actuación final!`],
        [by(4, 8), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena actuación final.`],
        [by(2, 4), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala actuación final...`],
        [by(-Infinity, 2), "tomato", (l, pl) => `${l} ${pl ? "fracasaron" : "fracasó"} en la actuación final...`],
      ]);
      cast.forEach((q) => { q.lipsyncScore += (q.favoritism - q.unfavoritism) / 3; });
      cast.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      this.episodeChallenges.push("Finale");

      const j = this.newScreen("Los minutos finales...", "Ir al lip sync final");
      j.hr();
      j.big("Las que pasan al lip sync final son...");
      const [a, b] = [cast[0], cast[1]];
      j.q([a.name, b.name], "silver", `${a.name} y ${b.name}, condragulations, id a preparar vuestro lip sync final.`);
      const out = cast.slice(2);
      j.q(out.map((q) => q.name), "sienna", `${list(out.map((q) => q.name))}, lo siento, queridas, pero no es vuestro momento. Debo pediros que hagáis sashay away...`);
      out.forEach((q) => {
        q.addTR(q.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
        q.rankP = cast.length === 8 ? 38 : 345;
        this.eliminated.unshift(q);
        this.exitLine(j, q);
      });
      this.crownDuel([a, b]);
    }

    // Lip sync por la corona entre las dos finalistas (Top 5 y Top 5 Jury Vote): su puntuación final
    // es la reputación más la mitad del lip sync.
    crownDuel(finalLS, opts = {}) {
      const [a, b] = finalLS;
      this.current = [];

      const e = this.newScreen("El final...", "Ver a la ganadora");
      finalLS.forEach((q) => { q.getASLipsync(); q.getFinale(); });
      e.q(finalLS.map((q) => q.name), "silver", `${a.name} y ${b.name} harán lip sync por la corona...!`);
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, finalLS);
      const rawLip = finalLS.map((q) => q.lipsyncScore); // el lip sync final no cuenta la reputación
      this.lipsyncGroups(e, finalLS, song);
      this.crownWinner(finalLS, song, rawLip, true, opts);
    }

    // Pantalla final entre dos finalistas: gana la de mayor puntuación final (si rawLip, se le suma
    // antes la mitad del lip sync); si empatan, un 50 % de que ganen las dos.
    crownWinner(finalLS, song, rawLip, lipsyncFinal, opts = {}) {
      const w = this.newScreen("El fin.", "Ver el track record");
      w.b("Chicas, he tomado mi decisión. La próxima Superestrella Drag es...");
      w.hr();
      if (rawLip) finalLS.forEach((q, i) => { q.finaleScore += rawLip[i] / 2; });
      finalLS.sort((x, y) => y.finaleScore - x.finaleScore);
      const label = (q, win) => (q.wildcard ? "RTRN + " + (win ? "WINNER" : (opts.lostLabel || "RUNNER UP")) : q.mxcon ? (win ? "MSCONWIN" : "MSCONRUNUP") : (win ? "WINNER" : (opts.lostLabel || "RUNNER UP")));
      if (!opts.noTie && finalLS[0].finaleScore === finalLS[1].finaleScore && rnd(0, 100) >= 50) {
        this.addSong(finalLS, [], song);
        w.b("Por PRIMERA VEZ en la herstory de Drag Race, sois las dos ganadoras, baby");
        w.q([finalLS[0].name, finalLS[1].name], "yellow", `¡¡${finalLS[0].name} y ${finalLS[1].name}!!`);
        this.winSpeech(w, finalLS);
        w.b("¡Ahora a hacer prance, mis reinas!");
        finalLS[0].addTR(label(finalLS[0], true));
        finalLS[1].addTR(label(finalLS[1], true));
        finalLS[1].rankP = 1;
        if (lipsyncFinal) this.eliminated[0].rankP = 432;
        if (lipsyncFinal && this.eliminated[1]) this.eliminated[1].rankP = 432;
        this.eliminated.unshift(finalLS[1]);
        this.winnerName = finalLS[0].name;
        this.runnerUpName = finalLS[1].name;
        this.current = [finalLS[0]];
      } else {
        let win = 0;
        this.addSong([finalLS[0]], [finalLS[1]], song);
        if (lipsyncFinal && rnd(0, 100) >= 95) { win = 1; this.alots.pop(); this.addSong([finalLS[1]], [finalLS[0]], song); }
        const loser = finalLS[1 - win];
        w.q([finalLS[win].name], "yellow", `¡¡${finalLS[win].name}!!`);
        this.winSpeech(w, [finalLS[win]]);
        w.b("¡Ahora a hacer prance, mi reina!");
        finalLS[win].addTR(label(finalLS[win], true));
        loser.addTR(label(loser, false));
        loser.rankP = 2;
        this.eliminated.unshift(loser);
        this.winnerName = finalLS[win].name;
        this.runnerUpName = loser.name;
        this.current = [finalLS[win]];
      }
    }

    // "Teams Finale / Top 4 to Top 2" (myrainboww) o "Teams Finale" (esopare), con una temporada
    // sin equipos: las cuatro finalistas, sin pasarela ni actuaciones, se ordenan por su
    // reputación; las dos últimas se van (3º/4º) y las dos primeras hacen lip sync por la corona.
    finaleTeams() {
      const cast = this.current;
      cast.forEach((q) => q.getFinale());
      cast.sort((a, b) => b.finaleScore - a.finaleScore);
      const s = this.newScreen("¡La gran final!", "Ir a los minutos finales");
      s.q(cast.map((q) => q.name), "black");
      s.p("¡Nuestro Top 4 participará en un videoclip del nuevo single de RuPaul!");

      const j = this.newScreen("Los minutos finales...", "Ver a la ganadora");
      j.b("Chicas, es hora de decidir a la próxima Superestrella Drag, y...");
      j.hr();
      const finalists = shuffle(cast.slice());
      const out = [cast[2], cast[3]];
      j.q(out.map((q) => q.name), "sienna", `${out[0].name}, ${out[1].name}. Lo siento, queridas, pero no es vuestro momento. Debo pediros a las dos que hagáis sashay away...`);
      j.hr();
      out.forEach((q) => {
        q.addTR(q.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
        q.rankP = 34;
        this.eliminated.unshift(q);
        finalists.splice(finalists.indexOf(q), 1);
      });
      cast.splice(2, 2);
      j.q(finalists.map((q) => q.name), "silver", `${finalists[0].name} y ${finalists[1].name}, esta es vuestra última oportunidad para demostrar lo que valéis. Es hora de que hagáis lip sync... ¡por la CORONA!`);
      const song = this.pickSong(j);
      cast.forEach((q) => q.getASLipsync());
      j.hr();
      this.lipsyncEvent(j, cast);
      this.lipsyncGroups(j, cast, song);
      j.hr();
      this.threeWay = false;
      this.fourWay = false;
      this.winnerScreen();
    }

    // "Lip-Sync For The Crown" (myrainboww) o "Top 4 Lip-Sync For The Crown" (esopare): las cuatro
    // finalistas se reparten al azar en dos parejas; la perdedora de cada pareja se va (3º/4º) y
    // las dos que pasan hacen lip sync por la corona. Si una pareja empata con un lip sync bueno,
    // pasan las dos (final a tres y, si empatan las dos parejas, a cuatro).
    finaleLFTC() {
      const cast = this.current;
      const s = this.newScreen("¡La gran final!", "Ir a las preliminares");
      s.q(cast.map((q) => q.name), "royalblue");
      s.p("Nuestro Top 4 participará en un lip sync smackdown por la corona. ¡Ahora se decidirán las preliminares...!");
      s.hr();
      const pool = cast.slice();
      const first = [], second = [];
      for (let i = 0; i < 2; i++) {
        first.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
        second.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
      }
      s.big("Las preliminares serán:");
      s.q(first.map((q) => q.name), "darkblue", `${first[0].name} vs. ${first[1].name}`);
      s.p("y");
      s.q(second.map((q) => q.name), "darkred", `${second[0].name} vs. ${second[1].name}`);
      this.episodeChallenges.push("Finale");

      const finalLS = [];
      let threeWay = false, fourWay = false;
      // una ronda preliminar: lip sync de la pareja y resultado (la mejor pasa, la otra se va)
      const round = (pair, n) => {
        const e = this.newScreen(n === 1 ? "¡Que comience la batalla!" : "Los lip syncs...", "Ver el resultado");
        pair.forEach((q) => q.getASLipsync());
        e.q(pair.map((q) => q.name), "silver", `${pair[0].name} y ${pair[1].name} harán lip sync${n === 1 ? " por un puesto en la final" : ""}...`);
        const song = this.pickSong(e);
        e.hr();
        this.lipsyncEvent(e, pair);
        const raw = pair.map((q) => q.lipsyncScore); // las preliminares no cuentan la reputación
        this.lipsyncGroups(e, pair, song);
        pair.forEach((q, i) => { q.lipsyncScore = raw[i]; });
        const r = this.newScreen("He tomado mi decisión...", n === 1 ? "Siguiente lip sync" : "Ir al lip sync final");
        pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        if (pair[0].lipsyncScore === pair[1].lipsyncScore && pair[0].lipsyncScore > 6) {
          this.addSong(pair, [], song);
          r.q(pair.map((q) => q.name), "silver", `${pair[0].name}, ${pair[1].name}, shantay, las dos os quedáis.`);
          finalLS.push(pair[0], pair[1]);
          if (!threeWay) threeWay = true; else fourWay = true;
          return;
        }
        const [stay, out] = pair;
        this.addSong([stay], [out], song);
        finalLS.push(stay);
        out.addTR(out.mxcon ? `MSCONL${n}R` : `LOST ${n === 1 ? "1ST" : "2ND"} ROUND`);
        if (n === 1 || !threeWay) out.rankP = 34;
        this.eliminated.unshift(out);
        r.q([stay.name], "silver", `${stay.name}, shantay, te quedas.`);
        r.q([out.name], "sienna", `${out.name}, sashay away...`);
        this.exitLine(r, out);
      };
      round(first, 1);
      round(second, 2);

      // lip sync final
      const e = this.newScreen("El fin...", "Mostrar el resultado");
      finalLS.forEach((q) => { q.getASLipsync(); q.getFinale(); });
      const names = finalLS.map((q) => q.name);
      e.q(names, "silver", `${list(names)} harán lip sync por la corona...!`);
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, finalLS);
      const rawLip = finalLS.map((q) => q.lipsyncScore); // el lip sync final tampoco cuenta la reputación
      this.lipsyncGroups(e, finalLS, song);

      const w = this.newScreen("El fin.", "Ver el track record");
      w.b("Chicas, he tomado mi decisión. La próxima Superestrella Drag es...");
      w.hr();
      finalLS.forEach((q, i) => { q.finaleScore += rawLip[i] / 2; });
      finalLS.sort((x, y) => y.finaleScore - x.finaleScore);
      const lostLabel = (q) => (q.mxcon ? "MSCONL3R" : "LOST 3RD ROUND");
      const winLabel = (q) => (q.mxcon ? "MSCONWIN" : "WINNER");
      if (!threeWay && !fourWay && finalLS[0].finaleScore === finalLS[1].finaleScore && rnd(0, 100) >= 50) {
        this.addSong(finalLS, [], song);
        w.b("Por PRIMERA VEZ en la herstory de Drag Race, sois las dos ganadoras, baby");
        w.q([finalLS[0].name, finalLS[1].name], "yellow", `¡¡${finalLS[0].name} y ${finalLS[1].name}!!`);
        this.winSpeech(w, finalLS);
        w.b("¡Ahora a hacer prance, mis reinas!");
        finalLS[0].addTR(winLabel(finalLS[0]));
        finalLS[1].addTR(winLabel(finalLS[1]));
        finalLS[1].rankP = 1;
        this.eliminated[0].rankP = 432;
        if (this.eliminated[1]) this.eliminated[1].rankP = 432;
        this.eliminated.unshift(finalLS[1]);
        this.winnerName = finalLS[0].name;
        this.runnerUpName = finalLS[1].name;
        this.current = [finalLS[0]];
        return;
      }
      let win = 0;
      if (fourWay && rnd(0, 100) >= 95) win = rnd(1, 3);
      else if (threeWay && !fourWay && rnd(0, 100) >= 95) win = rnd(1, 2);
      const champion = finalLS[win];
      const losers = finalLS.filter((q) => q !== champion);
      this.addSong([champion], losers, song);
      w.q([champion.name], "yellow", `¡¡${champion.name}!!`);
      this.winSpeech(w, [champion]);
      w.b("¡Ahora a hacer prance, mi reina!");
      champion.addTR(winLabel(champion));
      // con tres o cuatro finalistas, el 4º puesto (el de la preliminar) no comparte puesto con ellas
      if (threeWay && !fourWay && this.eliminated[0]) this.eliminated[0].rankP = 0;
      losers.forEach((q) => {
        q.addTR(lostLabel(q));
        q.rankP = fourWay ? 234 : (threeWay ? 23 : 2);
        this.eliminated.unshift(q);
      });
      this.winnerName = champion.name;
      this.runnerUpName = losers[0].name;
      this.current = [champion];
    }

    // "Lip Sync for the Finale" (el final de la temporada 2 de Canadá en los dos simuladores): tras la
    // reunión, el Top 4 se reparte en dos parejas; las ganadoras pasan a la final (Top 3) y las
    // dos perdedoras se enfrentan en una tercera ronda, de la que sale la tercera finalista.
    lipsyncForTheFinale() {
      const cast = this.current;
      this.episode++;
      const s = this.newScreen("Nuestro Top 4 está a punto de convertirse en un Top 3...", "Ir al primer lip sync");
      s.q(cast.map((q) => q.name), "royalblue");
      s.b(`${list(cast.map((q) => q.name))}, ¡las cuatro participaréis en una batalla real de lip syncs!!`);
      s.hr();
      const pool = cast.slice();
      const first = [], second = [];
      for (let i = 0; i < 2; i++) {
        first.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
        second.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
      }
      s.big("Los lip syncs serán:");
      s.q(first.map((q) => q.name), "darkblue", `${first[0].name} vs. ${first[1].name}`);
      s.p("y");
      s.q(second.map((q) => q.name), "darkred", `${second[0].name} vs. ${second[1].name}`);
      this.episodeChallenges.push("Lipsync For The Finale");

      const winners = [], losers = [];
      // una ronda: lip sync de la pareja y resultado (sin empates ni doble shantay, como el original)
      const round = (pair, n) => {
        const e = this.newScreen(n === 1 ? "¡Que comience la batalla!" : "Los lip syncs...", "Ver el resultado");
        pair.forEach((q) => q.getASLipsync());
        e.q(pair.map((q) => q.name), "silver", `${pair[0].name} y ${pair[1].name} harán lip sync por la final...!`);
        const song = this.pickSong(e);
        e.hr();
        this.lipsyncEvent(e, pair);
        const raw = pair.map((q) => q.lipsyncScore);
        this.lipsyncGroups(e, pair, song);
        pair.forEach((q, i) => { q.lipsyncScore = raw[i]; });
        pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
        const r = this.newScreen("He tomado mi decisión...", n === 3 ? "Ir a la gran final" : "Siguiente lip sync");
        const [win, lose] = pair;
        this.addSong([win], [lose], song);
        win.addTR(`TOP 3 R${n}`);
        winners.unshift(win);
        r.q([win.name], "silver", `${win.name}, shantay, te quedas. ¡Te veremos en la final!!`);
        if (n < 3) {
          losers.push(lose);
          r.q([lose.name], "sienna", `${lose.name}, tendrás una oportunidad más para redimirte...`);
        } else {
          lose.addTR(lose.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
          this.eliminated.unshift(lose);
          r.q([lose.name], "sienna", `${lose.name}, sashay away...`);
        }
      };
      round(first, 1);
      round(second, 2);
      round(losers, 3);
      this.current = winners;
      // la columna de la final: las eliminadas reciben una casilla vacía (luego será "Invitada")
      this.eliminated.forEach((q) => q.addTR(""));
    }

    // Puntúa y describe la pasarela de la final ("el mejor drag").
    finalRunway(r, cast) {
      cast.forEach((q) => q.getRunway());
      const by = (lo, hi) => cast.filter((q) => q.runwayScore >= lo && q.runwayScore < hi);
      this.describeGroups(r, [
        [by(-Infinity, 6), "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en la pasarela!`],
        [by(6, 16), "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran pasarela!`],
        [by(16, 26), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena pasarela.`],
        [by(26, Infinity), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala pasarela...`],
      ]);
    }

    // Votación del jurado de las eliminadas: cada una da 2 puntos a su primera opción y 1 a la
    // segunda entre las finalistas. Devuelve las finalistas ordenadas por puntos (las dos primeras
    // pasan a la final); si hay empate por el segundo puesto, las eliminadas votan de nuevo.
    juryVote(s, finalists) {
      const jury = this.eliminated.slice();
      finalists.forEach((q) => { q.votes = 0; });
      s.b("Tras las reuniones de las finalistas con las eliminadas... ¡las eliminadas votan!!");
      jury.forEach((j) => {
        const pool = finalists.slice();
        const first = this.bestSister(j, pool);
        first.votes += 2;
        pool.splice(pool.indexOf(first), 1);
        s.q([j.name, first.name], "yellow", `¡${j.name} votó a ${first.name}! Como primera opción.`);
        const second = this.bestSister(j, pool);
        second.votes += 1;
        s.q([j.name, second.name], "silver", `¡${j.name} votó a ${second.name}! Como segunda opción.`);
      });
      s.hr();
      s.b("¡Los resultados están aquí..!!");
      finalists.sort((a, b) => b.votes - a.votes);
      finalists.forEach((q) => s.b(`${q.name}: ${q.votes} puntos`));
      s.hr();
      if (finalists[1].votes === finalists[2].votes) {
        const tied = [finalists[1], finalists[2]];
        s.b(`Hay un empate: las eliminadas deben votar otra vez entre ${tied[0].name} y ${tied[1].name}!!`);
        const og = tied[0].votes;
        tied.forEach((q) => { q.votes = 0; });
        jury.forEach((j) => {
          const pick = this.bestSister(j, tied);
          pick.votes++;
          s.q([j.name, pick.name], "yellow", `¡${j.name} votó a ${pick.name}! Para estar en la final.`);
        });
        s.hr();
        s.b("¡Los resultados están aquí..!");
        tied.forEach((q) => s.b(`${q.name}: ${q.votes} puntos`));
        tied.sort((a, b) => b.votes - a.votes);
        s.b(`¡¡${tied[0].name} pasa a la final!!`);
        tied.forEach((q) => { q.votes = og; });
        finalists[1] = tied[0];
        finalists[2] = tied[1];
      }
      finalists.forEach((q) => { q.juryPoints = q.votes; });
      return finalists;
    }

    // "Jury Vote" (myrainboww) / "Top 4 Jury Vote" (esopare): el Top 4 hace pasarela, las eliminadas
    // votan, las dos más votadas pasan al lip sync final y las otras dos se van (3º/4º). Gana la de
    // mayor puntuación final (reputación de la temporada).
    finaleJury4() {
      const cast = this.current;
      cast.forEach((q) => q.getFinale());
      cast.sort((a, b) => b.finaleScore - a.finaleScore);
      const s = this.newScreen("¡La gran final!", "Ir a la pasarela");
      s.q(cast.map((q) => q.name));
      s.p("¡Nuestro Top 4 creará versos y una coreografía para una nueva canción original!");
      const r = this.newScreen("¡La gran final!", "Ir al jurado");
      r.blocks = s.blocks.slice();
      r.hr(); r.big("¡Pasarela!");
      r.p("¡Las reinas desfilarán por la pasarela!");
      r.p("La categoría es... ¡el mejor drag!");
      this.finalRunway(r, cast);

      const j = this.newScreen("¡El jurado!", "Ver a la ganadora");
      j.p("¡Las eliminadas vuelven, vuelven, vuelven otra vez!");
      j.hr();
      j.q(cast.map((q) => q.name));
      const ranked = this.juryVote(j, cast.slice());
      const top2 = [ranked[0], ranked[1]];
      j.b(`¡¡${top2[0].name} y ${top2[1].name} son el Top 2 de la temporada!!`);
      ranked.slice(2).reverse().forEach((q) => {
        q.addTR(q.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
        q.rankP = 34;
        this.eliminated.unshift(q);
      });
      top2.forEach((q) => q.getASLipsync());
      const song = this.pickSong(j);
      j.hr();
      this.lipsyncEvent(j, top2);
      this.lipsyncGroups(j, top2, song);
      j.hr();
      this.current = top2;
      this.crownWinner(top2, song, null, false);
      this.episodeChallenges.push("Finale");
    }

    // "Top 5 Jury Vote" (solo esopare): los cinco finalistas defienden su caso ante las eliminadas,
    // que votan; las dos más votadas hacen lip sync por la corona y las otras tres se van (3º-5º).
    finaleJury5() {
      const cast = this.current;
      const s = this.newScreen("¡La gran final!", "Ir al jurado");
      s.q(cast.map((q) => q.name));
      s.b("Las cinco finalistas defenderán su caso ante las eliminadas.");
      s.p("Tras escucharlas, las eliminadas votarán a las dos reinas que creen que merecen pasar al lip sync final por la corona.");
      this.episodeChallenges.push("Finale");

      const j = this.newScreen("¡El jurado!", "Ir al lip sync final");
      j.p("¡Las eliminadas vuelven, vuelven, vuelven otra vez!");
      j.hr();
      j.q(cast.map((q) => q.name));
      const ranked = this.juryVote(j, cast.slice());
      j.big("Las que pasan al lip sync final son...");
      j.q([ranked[0].name, ranked[1].name], "silver", `${ranked[0].name} y ${ranked[1].name}, condragulations, ¡habéis recibido más votos del jurado!`);
      const out = ranked.slice(2);
      j.q(out.map((q) => q.name), "sienna", `${list(out.map((q) => q.name))}, lo siento, queridas, pero el jurado ha hablado. Ahora, sashay away...`);
      out.reverse().forEach((q) => {
        q.addTR(q.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
        q.rankP = 345;
        this.eliminated.unshift(q);
      });
      this.crownDuel([ranked[0], ranked[1]]);
    }

    // Un lip sync de eliminatoria entre dos reinas (sin contar la reputación, como el original):
    // describe la actuación y el resultado; devuelve la ganadora, la perdedora y la pantalla del resultado.
    duel(pair, title, text, button) {
      const e = this.newScreen(title, "Ver el resultado");
      pair.forEach((q) => q.getASLipsync());
      e.q(pair.map((q) => q.name), "silver", text);
      const song = this.pickSong(e);
      e.hr();
      this.lipsyncEvent(e, pair);
      const raw = pair.map((q) => q.lipsyncScore);
      this.lipsyncGroups(e, pair, song);
      pair.forEach((q, i) => { q.lipsyncScore = raw[i]; });
      pair.sort((a, b) => b.lipsyncScore - a.lipsyncScore);
      const r = this.newScreen("He tomado mi decisión...", button);
      const [win, lose] = pair;
      this.addSong([win], [lose], song);
      r.q([win.name], "silver", `${win.name}, shantay, te quedas.`);
      r.q([lose.name], "sienna", `${lose.name}, sashay away.`);
      this.exitLine(r, lose);
      return { win, lose };
    }

    // "Top 6 All Stars 11" (solo esopare): la ganadora del último episodio y la de mayor PPE pasan
    // directas a la ronda 2; las otras cuatro hacen dos lip syncs de la ronda 1 (pierde 5º/6º). En la
    // ronda 2 hay dos lip syncs más (pierde 3º/4º) y las dos ganadoras hacen el lip sync por la corona.
    finaleTop6() {
      const cast = this.current;
      const bye = cast.find((q) => q.trackRecord[q.trackRecord.length - 1] === "WIN")
        || cast.slice().sort((a, b) => b.ppe - a.ppe)[0];
      const ppeQueen = cast.filter((q) => q !== bye).sort((a, b) => b.ppe - a.ppe)[0];
      const bracket = cast.filter((q) => q !== bye && q !== ppeQueen);
      const first = [bracket[0], bracket[1]], second = [bracket[2], bracket[3]];

      const s = this.newScreen("¡La gran final!", "Ir a la ronda 1");
      s.q(cast.map((q) => q.name));
      s.p(`¡${bye.name} ganó el reto de la semana pasada y pasa automáticamente a la ronda 2!`);
      s.p(`¡${ppeQueen.name} es una de las mejor puntuadas y también pasa automáticamente a la ronda 2!`);
      s.hr();
      s.big("Ronda 1");
      s.q(first.map((q) => q.name), "royalblue", `${first[0].name} vs. ${first[1].name}`);
      s.p("vs");
      s.q(second.map((q) => q.name), "darkred", `${second[0].name} vs. ${second[1].name}`);
      this.episodeChallenges.push("Finale");

      const out = (q, n, rank, r) => {
        q.addTR(q.mxcon ? `MSCONL${n}R` : `LOST ${n === 1 ? "1ST" : "2ND"} ROUND`);
        q.rankP = rank;
        this.eliminated.unshift(q);
      };
      const round1 = (pair) => {
        const { win, lose } = this.duel(pair, "Ronda 1", `${pair[0].name} y ${pair[1].name} harán lip sync por un puesto en la ronda 2!`, "Continuar");
        out(lose, 1, 56);
        return win;
      };
      const w1 = round1(first);
      const w2 = round1(second);

      const t = this.newScreen("Ronda 2", "Ir al primer lip sync");
      t.big("1er lip sync");
      t.q([w1.name, w2.name], "silver", `${w1.name} vs. ${w2.name}`);
      t.hr();
      t.big("2º lip sync");
      t.q([bye.name, ppeQueen.name], "gold", `${bye.name} vs. ${ppeQueen.name}`);
      const semi = (pair) => {
        const { win, lose } = this.duel(pair, "Ronda 2", `${pair[0].name} y ${pair[1].name} harán lip sync por un puesto en el Top 2!`, "Continuar");
        out(lose, 2, 34);
        return win;
      };
      const f1 = semi([w1, w2]);
      const f2 = semi([bye, ppeQueen]);
      this.crownDuel([f1, f2], { noTie: true, lostLabel: "LOST 3RD ROUND" });
    }

    // "Top 8 Lip-Sync For The Crown" (solo esopare): primero se hace el Rate-A-Queen (cada finalista
    // ordena a las demás y la media decide el cabeza de serie) y luego un cuadro de eliminatorias solo
    // de lip syncs: cuartos (1º-8º, 2º-7º, 3º-6º, 4º-5º), semifinales y lip sync final por la corona.
    finaleTop8LFTC() {
      // Wildcard: con 7 finalistas, una eliminada al azar regresa como comodín y son 8.
      if (this.opts.top8return && this.current.length === 7 && this.eliminated.length) {
        const w = this.newScreen("¡La gran final!", "Ir al Rate-A-Queen");
        const wild = this.eliminated[rnd(0, this.eliminated.length - 1)];
        const last = wild.trackRecord[wild.trackRecord.length - 1];
        if (last === "GUEST" || last === "MISS CON") {
          wild.trackRecord.pop();
          if (last === "MISS CON") wild.mxcon = true;
        }
        wild.wildcard = true;
        this.eliminated.splice(this.eliminated.indexOf(wild), 1);
        this.current.push(wild);
        w.big("¡Un giro comodín!");
        w.q([wild.name], "gold", `¡${wild.name} regresa a la competición!`);
      }
      const cast = this.current;
      const r = this.newScreen("Rate-A-Queen", "Ir a la gran final");
      r.b("Antes del Lip-Sync Smackdown por la corona, las finalistas se han puntuado entre sí.");
      r.hr();
      cast.forEach((q) => { q.votes = 0; });
      const voters = shuffle(cast.slice());
      voters.forEach((v) => {
        const others = cast.filter((q) => q !== v);
        // Las relaciones pesan: se puntúa a cada rival por su último reto (o al azar, la mitad de las
        // veces) y se resta/suma según la relación; las aliadas suben y las enemigas bajan aún más.
        const byPerformance = rnd(0, 100) <= 50;
        const key = (q) => {
          let k = byPerformance ? q.performanceScore : rnd(10, 40);
          k -= this.rel(v, q) * 1.5;
          if (v.allies.has(q)) k -= 5;
          else if (v.friends.has(q)) k -= 2;
          else if (v.enemies.has(q)) k += 5;
          return k + rnd(-3, 3);
        };
        const scored = new Map(others.map((q) => [q, key(q)]));
        const ranked = others.sort((a, b) => scored.get(a) - scored.get(b));
        r.q([v.name], undefined, `${v.name} ha ordenado:`);
        ranked.forEach((q, j) => { r.p(`${j + 1}. ${q.name}`); q.votes += j + 1; });
        const ally = ranked.find((q) => v.allies.has(q) && ranked.indexOf(q) <= 1);
        const enemy = ranked.find((q) => v.enemies.has(q) && ranked.indexOf(q) >= ranked.length - 2);
        if (ally) r.q([v.name, ally.name], "blue", `${v.name} ha puesto muy arriba a su aliada ${ally.name}.`);
        if (enemy) r.q([v.name, enemy.name], "red", `${v.name} ha relegado a su enemiga ${enemy.name} a los últimos puestos.`);
        r.hr();
      });
      cast.forEach((q) => { q.votes /= (cast.length - 1); });
      const seeds = cast.slice().sort((a, b) => a.votes - b.votes);
      r.big("La clasificación final");
      seeds.forEach((q, i) => r.q([q.name], undefined, `${i + 1}. ${q.name}`));
      cast.forEach((q) => { q.votes = 0; });

      const s = this.newScreen("¡La gran final!", "Ir a los cuartos de final");
      s.q(seeds.map((q) => q.name), "royalblue");
      s.p("¡Nuestro Top 8 participará en un Lip-Sync Smackdown por la corona!");
      s.hr();
      const matches = [[seeds[0], seeds[7]], [seeds[1], seeds[6]], [seeds[2], seeds[5]], [seeds[3], seeds[4]]];
      s.big("El cuadro de cuartos de final");
      const colors = ["darkblue", "darkred", "purple", "green"];
      matches.forEach((m, i) => {
        if (i) s.p("vs");
        s.q(m.map((q) => q.name), colors[i], `${m[0].name} vs. ${m[1].name}`);
      });
      this.episodeChallenges.push("Finale");

      const out = (q, n, rank) => {
        const lab = `LOST ${n === 1 ? "1ST" : "2ND"} ROUND`;
        q.addTR(q.wildcard ? "RTRN + " + lab : q.mxcon ? `MSCONL${n}R` : lab);
        q.rankP = rank;
        this.eliminated.unshift(q);
      };
      const stage = (pair, title, text, n, rank) => {
        const { win, lose } = this.duel(pair, title, text, "Continuar");
        out(lose, n, rank);
        return win;
      };
      const quarters = matches.map((m) => stage(m, "Cuartos de final", `${m[0].name} y ${m[1].name} harán lip sync por un puesto en el Top 4!`, 1, 5678));
      const semis = [[quarters[0], quarters[1]], [quarters[2], quarters[3]]].map((m) =>
        stage(m, "Semifinales", `${m[0].name} y ${m[1].name} harán lip sync por un puesto en la gran final!`, 2, 34));
      this.crownDuel(semis, { noTie: true, lostLabel: "LOST 3RD ROUND" });
    }

    finale() {
      if (this.opts.teams) return this.finaleTeamSeason();
      if ((this.opts.top8lftc && this.current.length === 8) || (this.opts.top8return && this.current.length === 7)) return this.finaleTop8LFTC();
      if (this.opts.top6 && this.current.length === 6) return this.finaleTop6();
      if (this.opts.jury && this.current.length === 4) return this.finaleJury4();
      if (this.opts.jury && this.current.length === 5) return this.finaleJury5();
      if (this.opts.canFinale && this.current.length === 4) this.lipsyncForTheFinale();
      if (this.opts.lftc && this.current.length === 4) return this.finaleLFTC();
      if (this.opts.teamsFinale) return this.finaleTeams();
      if (this.current.length === 5 || (this.opts.top8 && this.current.length === 8)) return this.finaleTop5();
      const cast = this.current;
      cast.forEach((q) => q.getFinale());
      const s = this.newScreen("¡La gran final!", "Ir a la pasarela");
      s.q(cast.map((q) => q.name));
      cast.sort((a, b) => b.finaleScore - a.finaleScore);
      if (cast[0].finaleScore - cast[1].finaleScore <= 5 && rnd(0, 100) <= 25) cast[1].finaleScore = cast[0].finaleScore + 1;
      cast.sort((a, b) => b.finaleScore - a.finaleScore);
      s.p(`Nuestro Top ${cast.length} participará en un videoclip del nuevo single de RuPaul.`);
      // pasarela de la final
      const r = this.newScreen("¡La gran final!", "Ir a los minutos finales");
      r.blocks = s.blocks.slice();
      r.hr(); r.big("¡Pasarela!");
      r.p("¡Las reinas desfilarán por la pasarela!");
      r.p("La categoría es... ¡el mejor drag!");
      this.finalRunway(r, cast);
      // los minutos finales
      // Con "Lip Sync for the Finale" no hay columna de videoclip: las eliminadas pasan a "Invitada".
      const canFinale = this.opts.canFinale;
      if (canFinale) {
        this.eliminated.forEach((q) => { q.trackRecord[q.trackRecord.length - 1] = "GUEST"; });
      } else {
        this.episode++;
        this.episodeChallenges.push("Music Video");
        this.eliminated.forEach((q) => { q.trackRecord.splice(q.trackRecord.length - 1, 0, ""); });
      }
      const j = this.newScreen("Los minutos finales...", "Ver a la ganadora");
      j.b("Chicas, es hora de decidir a la próxima Superestrella Drag, y...");
      j.hr();
      const finalists = shuffle(cast.slice()).map((q) => q.name);
      this.threeWay = false;
      this.fourWay = false;
      if (cast.length === 4) {
        // Top 4: si la cuarta va muy por detrás, se va antes y las tres restantes hacen lip sync;
        // si no, las cuatro hacen lip sync por sus vidas.
        if (cast[0].finaleScore - cast[3].finaleScore >= 10 && cast[3].finaleScore < 5) {
          const fourth = cast[3];
          j.q([fourth.name], "sienna", `${fourth.name}, lo siento, querida, pero no es tu momento. Debo pedirte que hagas sashay away...`);
          fourth.addTR(fourth.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
          fourth.addTR("GUEST");
          this.eliminated.unshift(fourth);
          finalists.splice(finalists.indexOf(fourth.name), 1);
          cast.splice(3, 1);
          this.exitLine(j, fourth);
          cast.forEach((q) => q.addTR("TOP " + cast.length));
          j.q(finalists, "silver", `${list(finalists)}, esta es vuestra última oportunidad para demostrar lo que valéis. Es hora de que hagáis lip sync... ¡por la CORONA!`);
          this.threeWay = true;
        } else {
          cast.forEach((q) => q.addTR("TOP " + cast.length));
          j.b("¡Por primera vez en la herstory de Drag Race, vamos a romper todas las reglas!");
          j.hr();
          j.q(finalists, "silver", `${list(finalists)}, ¡las cuatro haréis lip sync por vuestras vidas!`);
          this.fourWay = true;
        }
      } else if (cast.length === 3) {
        if (!canFinale) cast.forEach((q) => q.addTR("TOP " + cast.length));
        // Top 3: si están igualadas, las tres hacen lip sync; si no, la tercera se va antes.
        if (cast[0].finaleScore - cast[2].finaleScore <= 10 && cast[2].finaleScore > 5) {
          j.q(finalists, "silver", `${list(finalists)}, ¡las tres haréis lip sync por vuestras vidas!`);
          this.threeWay = true;
        } else {
          const third = cast[2];
          j.q([third.name], "sienna", `${third.name}, lo siento, querida, este no es tu momento... Ahora, sashay away.`);
          third.addTR(third.mxcon ? "MSCONELIMINATED" : "ELIMINATED");
          this.eliminated.unshift(third);
          cast.splice(2, 1);
          this.exitLine(j, third);
          // (como en el original, la perdedora de la tercera ronda pasa a "ELIM" en su casilla)
          const r3 = this.eliminated[1];
          if (canFinale && r3 && !r3.mxcon) r3.trackRecord[r3.trackRecord.length - 2] = "ELIM";
          const two = shuffle(cast.slice()).map((q) => q.name);
          j.q(two, "silver", `${two[0]} y ${two[1]}, ¡haréis lip sync por vuestras vidas!`);
        }
      } else {
        cast.forEach((q) => q.addTR("TOP " + cast.length));
        j.q(finalists.slice(0, 2), "silver", `${finalists[0]}, ${finalists[1]}, esta es vuestra última oportunidad para demostrar lo que valéis. Es hora de que hagáis lip sync... ¡por la CORONA!`);
      }
      const song = this.pickSong(j);
      cast.forEach((q) => q.getASLipsync());
      j.hr();
      this.lipsyncEvent(j, cast);
      this.lipsyncGroups(j, cast, song);
      j.hr();
      this.winnerScreen();
    }

    winnerScreen() {
      const cast = this.current;
      const s = this.newScreen("El fin.", "Ver el track record");
      s.b("Chicas, he tomado mi decisión. La próxima Superestrella Drag es...");
      s.hr();
      const label = (q, win) => (q.mxcon ? (win ? "MSCONWIN" : "MSCONRUNUP") : (win ? "WINNER" : "RUNNER UP"));
      if (cast[0].finaleScore === cast[1].finaleScore && rnd(0, 100) >= 50) {
        s.b("Por PRIMERA VEZ en la herstory de Drag Race, sois las dos ganadoras, baby");
        s.q([cast[0].name, cast[1].name], "yellow", `¡¡${cast[0].name} y ${cast[1].name}!!`);
        this.winSpeech(s, [cast[0], cast[1]]);
        s.b("¡Ahora a hacer prance, mis reinas!");
        if (this.threeWay) {
          const third = cast[2];
          third.addTR(third.mxcon ? "MSCONRUNUP" : "RUNNER UP");
          third.rankP = 32;
          this.eliminated.unshift(third);
          cast.splice(2, 1);
        } else if (this.fourWay) {
          [cast[2], cast[3]].forEach((q) => {
            q.addTR(q.mxcon ? "MSCONRUNUP" : "RUNNER UP");
            q.rankP = 432;
            this.eliminated.unshift(q);
          });
          cast.splice(2, 2);
        }
        cast[1].rankP = 1;
        cast[0].addTR(label(cast[0], true));
        cast[1].addTR(label(cast[1], true));
        this.addSong([cast[0], cast[1]], this.threeWay ? [this.eliminated[0]] : [], this.songUsed);
        this.eliminated.unshift(cast[1]);
        cast.splice(1, 1);
        this.winnerName = cast[0].name;
        this.runnerUpName = this.eliminated[0].name;
      } else {
        this.addSong([cast[0]], cast.slice(1), this.songUsed);
        s.q([cast[0].name], "yellow", `¡¡${cast[0].name}!!`);
        this.winSpeech(s, [cast[0]]);
        s.b("¡Ahora a hacer prance, mi reina!");
        cast[0].addTR(label(cast[0], true));
        if (this.fourWay) {
          // con cuatro finalistas, las tres que no ganan comparten el 2º-4º puesto
          [cast[1], cast[2], cast[3]].forEach((q) => {
            q.addTR(label(q, false));
            q.rankP = 234;
            this.eliminated.unshift(q);
          });
          cast.splice(1, 3);
          this.winnerName = cast[0].name;
          this.runnerUpName = this.eliminated[0].name;
          this.episodeChallenges.push("Finale");
          return;
        }
        cast[1].addTR(label(cast[1], false));
        // con tres finalistas, las dos que no ganan comparten el 2º/3º puesto
        cast[1].rankP = this.threeWay ? 23 : 2;
        this.eliminated.unshift(cast[1]);
        cast.splice(1, 1);
        if (this.threeWay && cast.length === 2) {
          cast[1].addTR(label(cast[1], false));
          cast[1].rankP = 23;
          this.eliminated.unshift(cast[1]);
          cast.splice(1, 1);
        }
        this.winnerName = cast[0].name;
        this.runnerUpName = this.eliminated[0].name;
      }
      this.episodeChallenges.push("Finale");
    }

    finalScreens() {
      const s = this.newScreen("Progreso de las concursantes", "Volver a simular");
      s.add(this.trData(true));
      s.add(this.legendBlock());
      if (this.opts.tournament || this.opts.winners) s.add(this.mvqBlock());
      s.add({ t: "lipsyncs", alots: this.alots, blots: this.blots });
      this.finalScreen = s;
    }
  }

  // ======================================================================================
  // API
  // ======================================================================================
  const FINALE_SIZE = { FINALE_TOP2: 2, FINALE_TOP3: 3, FINALE_TOP4: 4, FINALE_TOP5: 5, FINALE_TEAMS: 4, FINALE_LIPSYNC_CROWN: 4, FINALE_LIPSYNC_FINALE: 4, FINALE_JURY_VOTE: 4, FINALE_JURY_TOP5: 5, FINALE_TOP6_AS11: 6, FINALE_TOP8: 8, FINALE_TOP8_LFTC: 8, FINALE_TOP8_WILDCARD: 7 };
  // [id, mínimo de reinas, nombre] de los estrenos que puede sortear "Estreno al azar".
  // Formato de temporada al azar: [id, mínimo de reinas, etiqueta]; "Por equipos" necesita un número par.
  const RANDOM_SEASONS = [
    ["SEASON_REGULAR", 3, "Regular"], ["SEASON_THAILAND", 6, "Thailand (temporadas 1 y 2)"], ["SEASON_TEAMS", 6, "Por equipos"],
    ["SEASON_LIPSYNC_LEGACY", 6, "Lipsync For Your Legacy"], ["SEASON_LIPSYNC_ASSASSIN", 6, "Lipsync Assassin"], ["SEASON_ALL_WINNERS", 6, "All Winners"],
    ["SEASON_SLAYSIAN", 8, "Slaysian Royale"], ["SEASON_SPLIT", 12, "Split Format"], ["SEASON_FATAL", 4, "Fatal Selection"], ["SEASON_LFTW", 6, "Lipsync for the win"], ["SEASON_TOURNAMENT", 12, "Tournament of All Stars"],
  ];
  // Twists copiados (los demás twists de la lista siguen con el motor propio)
  const IMPLEMENTED_TWISTS = ["DISABLE_DOUBLE", "DISABLE_REUNION", "RIGGORY", "RIGGORY_LIPSYNC", "CLAIM_QUEEN", "IMMUNITY", "BEAVER", "CHOCOLATE_RANDOM", "CHOCOLATE_CHOOSABLE", "BADONKA_RANDOM", "BADONKA_CHOOSABLE", "SOLID_BACKGROUND", "TITLE_GOLDEN_BOOT", "TITLE_FAN_FAVORITE", "TITLE_VILLAIN", "TITLE_ROBBED", "TITLE_POPSTAR", "TITLE_MOGUL", "TITLE_WORST_LOOK", "TITLE_LOST_LOOK", "TITLE_BRICK", "LIPSYNC_CHALLENGE", "SLAY_OFF", "SLAYSIAN_LALA", "REUNION_SMACKDOWN", "FAME_GAMES", "PICK_POISON", "SNATCH_RUSICAL"];
  // Regresos copiados (el resto de regresos de la lista siguen con el motor propio)
  const IMPLEMENTED_RETURNS = ["RETURN_NONE", "RETURN_CHOOSE", "RETURN_CHOOSE2", "RETURN_CHOOSE5", "RETURN_RANDOM", "RETURN_VOTE", "RETURN_SMACKDOWN", "RETURN_HELLBOUND", "RETURN_LALAPARUZA", "RETURN_RANDOM_PICK", "RETURN_READING", "RETURN_CONJOINED", "RETURN_QOC", "RETURN_REINAS", "RETURN_KITTY", "RETURN_ATTENTION"];
  // "Random return" (ranop): se sortea entre los regresos copiados (menos Hellbound), como en el original
  const RANDOM_RETURN_POOL = ["RETURN_RANDOM", "RETURN_CHOOSE", "RETURN_VOTE", "RETURN_CONJOINED", "RETURN_LALAPARUZA", "RETURN_SMACKDOWN", "RETURN_READING", "RETURN_QOC", "RETURN_KITTY", "RETURN_REINAS", "RETURN_ATTENTION", "RETURN_CHOOSE2", "RETURN_CHOOSE5"];
  const RANDOM_PREMIERES = [
    ["PREMIERE_NORMAL", 3, "Estreno normal"], ["PREMIERE_NORMAL_NOELIM", 3, "Estreno normal (sin eliminación)"],
    ["PREMIERE_SLAYERS", 3, "Estreno normal (Slayers / Top 2)"], ["PREMIERE_UK3", 4, "Estreno UK3 (Top 2 y Bottom 2)"],
    ["PREMIERE_LATE_ENTRY", 6, "Estreno normal (entrada tardía)"], ["PREMIERE_DOUBLE", 10, "Doble estreno"],
    ["PREMIERE_DOUBLE_NOELIM", 10, "Doble estreno (sin eliminación)"], ["PREMIERE_DOUBLE_TALENT", 10, "Doble estreno (Talent Show / eliminación falsa)"],
    ["PREMIERE_DOUBLE_GG", 10, "Doble estreno (Girl Groups)"], ["PREMIERE_GLOBAL_AS", 10, "Doble estreno (Global All Stars)"],
    ["PREMIERE_PORKCHOP", 10, "Reto Porkchop"], ["PREMIERE_PORKCHOP_ELIM", 10, "Reto Porkchop (con eliminación)"],
    ["PREMIERE_RATE_A_QUEEN", 10, "Rate A Queen"], ["PREMIERE_TRIPLE", 12, "Triple estreno"],
  ];
  // Colores por defecto de los grupos del torneo (se pueden cambiar en los ajustes).
  const TOUR_COLORS = ["#FE5007", "#EA00B7", "#8203D0", "#0AA5FF", "#00A86B", "#FFB400", "#E63946", "#2A9D8F"];
  const RANDOM_FINALES = ["FINALE_TOP5", "FINALE_TOP4", "FINALE_TOP3", "FINALE_TEAMS", "FINALE_LIPSYNC_CROWN",
    "FINALE_LIPSYNC_FINALE", "FINALE_JURY_VOTE", "FINALE_TOP2", "FINALE_TOP8", "FINALE_TOP8_LFTC", "FINALE_JURY_TOP5",
    "FINALE_TOP8_WILDCARD", "FINALE_TOP6_AS11"];
  const FINALE_NAME = {
    FINALE_TOP2: "Top 2", FINALE_TOP3: "Top 3", FINALE_TOP4: "Top 4", FINALE_TOP5: "Top 5",
    FINALE_TEAMS: "Teams Finale", FINALE_LIPSYNC_CROWN: "Lip-Sync For The Crown", FINALE_LIPSYNC_FINALE: "Lip Sync for the Finale",
    FINALE_JURY_VOTE: "Jury Vote (Top 4)", FINALE_JURY_TOP5: "Top 5 Jury Vote", FINALE_TOP6_AS11: "Top 6 All Stars 11",
    FINALE_TOP8: "Top 8", FINALE_TOP8_LFTC: "Top 8 Lip-Sync For The Crown", FINALE_TOP8_WILDCARD: "Top 8 Lip-Sync For The Crown (Wildcard)",
  };
  const LEVEL_VALUE = { "se llevan de maravilla": 10, "se llevan muy bien": 5, "se llevan bien": 3, "normal": 0, "se llevan mal": -5, "se llevan fatal": -10 };

  // El formato que copia este simulador: estreno normal + temporada regular + final Top 2 +
  // sin regresos y sin opciones extra.
  function canRun(formatChoice) {
    return (formatChoice.premiere === "PREMIERE_NORMAL" || formatChoice.premiere === "PREMIERE_NORMAL_NOELIM" || formatChoice.premiere === "PREMIERE_SLAYERS" || formatChoice.premiere === "PREMIERE_UK3" || formatChoice.premiere === "PREMIERE_LATE_ENTRY" || formatChoice.premiere === "PREMIERE_DOUBLE" || formatChoice.premiere === "PREMIERE_DOUBLE_NOELIM" || formatChoice.premiere === "PREMIERE_DOUBLE_TALENT" || formatChoice.premiere === "PREMIERE_DOUBLE_GG" || formatChoice.premiere === "PREMIERE_PORKCHOP" || formatChoice.premiere === "PREMIERE_RATE_A_QUEEN" || formatChoice.premiere === "PREMIERE_GLOBAL_AS" || formatChoice.premiere === "PREMIERE_PORKCHOP_ELIM" || formatChoice.premiere === "PREMIERE_TRIPLE" || formatChoice.premiere === "PREMIERE_RANDOM")
      && (formatChoice.season === "SEASON_REGULAR" || formatChoice.season === "SEASON_THAILAND" || formatChoice.season === "SEASON_TEAMS" || formatChoice.season === "SEASON_LIPSYNC_LEGACY" || formatChoice.season === "SEASON_LIPSYNC_ASSASSIN" || formatChoice.season === "SEASON_ALL_WINNERS" || formatChoice.season === "SEASON_SLAYSIAN" || formatChoice.season === "SEASON_SPLIT" || formatChoice.season === "SEASON_FATAL" || formatChoice.season === "SEASON_LFTW" || formatChoice.season === "SEASON_RANDOM" || formatChoice.season === "SEASON_TOURNAMENT")
      && (FINALE_SIZE[formatChoice.finale] || formatChoice.finale === "FINALE_RANDOM")
      && IMPLEMENTED_RETURNS.includes(formatChoice.return)
      && (formatChoice.twists || []).every((t) => IMPLEMENTED_TWISTS.includes(t));
  }

  // Capítulos de la temporada (incluida la final): el normal con este reparto y el mínimo y máximo que se pueden pedir
  // (más capítulos = dobles shantay; menos = dobles sashay). null si el formato no admite elegirlos.
  function episodeInfo(fc, n) {
    const fin = FINALE_SIZE[fc.finale];
    if (!fin || n <= fin + 1) return null;
    if (["SEASON_THAILAND", "SEASON_TEAMS", "SEASON_LIPSYNC_LEGACY", "SEASON_LIPSYNC_ASSASSIN", "SEASON_ALL_WINNERS", "SEASON_SLAYSIAN", "SEASON_FATAL", "SEASON_RANDOM", "SEASON_TOURNAMENT"].includes(fc.season)) return null;
    const base = n - fin;
    return { normal: base + 1, min: 2, max: base * 2 + 1 };
  }

  // Grupos que el formato elegido va a formar con este número de reinas (para que el usuario pueda decidir quién va en cada
  // uno). Devuelve null si el formato no forma grupos.
  function groupPlan(fc, n) {
    const fin = FINALE_SIZE[fc.finale] || 2;
    const even = (k) => { const b = Math.floor(n / k), x = n % k; return Array.from({ length: k }, (_, i) => b + (i < x ? 1 : 0)); };
    if (fc.season === "SEASON_TOURNAMENT") {
      const cfg = tournamentCfg(fc.tournament);
      if (n < 6) return null;
      return even(Math.max(2, Math.min(cfg.groups, Math.floor(n / 2)))).map((size, i) => ({ title: `Grupo ${i + 1}`, size }));
    }
    if (fc.season === "SEASON_SPLIT") {
      if (n < 9 || n < fin + 8) return null;
      const a = Math.ceil(n / 3), b = Math.floor((n - a) / 2);
      return [a, b, n - a - b].map((size, i) => ({ title: `Estreno ${i + 1}`, size }));
    }
    if (fc.season === "SEASON_TEAMS") {
      if (n < 6 || n % 2) return null;
      return Array.from({ length: n / 2 }, (_, i) => ({ title: `Pareja ${i + 1}`, size: 2 }));
    }
    if (fc.premiere === "PREMIERE_TRIPLE" && n >= 12) {
      const a = Math.floor(n / 3), b = Math.floor((n - a) / 2);
      return [a, b, n - a - b].map((size, i) => ({ title: `Estreno ${i + 1}`, size }));
    }
    if (["PREMIERE_DOUBLE", "PREMIERE_DOUBLE_NOELIM", "PREMIERE_DOUBLE_TALENT", "PREMIERE_DOUBLE_GG", "PREMIERE_RATE_A_QUEEN", "PREMIERE_GLOBAL_AS"].includes(fc.premiere) && n >= 10) {
      const a = Math.floor(n / 2);
      return [a, n - a].map((size, i) => ({ title: `Estreno ${i + 1}`, size }));
    }
    return null;
  }

  // Formatos que pueden seguir a la ronda de grupos del torneo. Para añadir uno nuevo basta con una entrada aquí
  // (si es una temporada con su propia bandera `opts.<opt>`, se activa sola al terminar los grupos).
  const MERGE_FORMATS = [
    { id: "regular", label: "Regular (eliminación normal)" },
    { id: "raq", label: "Rate-A-Queen (S11: se puntúan entre ellas)" },
    { id: "thailand", label: "Thailand (temporadas 1 y 2)", opt: "thailand" },
    { id: "teams", label: "Por equipos (parejas)", opt: "teams" },
    { id: "legacy", label: "Lipsync For Your Legacy", opt: "legacy" },
    { id: "assassin", label: "Lipsync Assassin", opt: "assassin" },
    { id: "winners", label: "All Winners (estrellas, sin eliminaciones)", opt: "winners" },
    { id: "slaysian", label: "Slaysian Royale", opt: "slaysian" },
    { id: "split", label: "Split Format (estrenos y grupos separados)", opt: "split" },
    { id: "fatal", label: "Fatal Selection (asesina del lip sync y pintalabios)", opt: "fatal" },
  ];

  // Ajustes del torneo (grupos, episodios por grupo, reinas que pasan y segunda ronda opcional).
  function tournamentCfg(t) {
    const num = (v, d, min) => Math.max(min, Math.floor(Number(v)) || d);
    const base = t || {};
    const cfg = { groups: num(base.groups, 3, 2), episodes: num(base.episodes, 3, 1), passers: num(base.passers, 3, 1), second: null, wildcards: Math.max(0, Math.floor(Number(base.wildcards)) || 0), merge: MERGE_FORMATS.some((m) => m.id === base.merge) ? base.merge : "regular", seq: base.seq === "s11" ? "s11" : "default", colors: Array.isArray(base.colors) ? base.colors : [] };
    if (base.second && base.second.groups) cfg.second = { groups: num(base.second.groups, 2, 2), episodes: num(base.second.episodes, 3, 1), passers: num(base.second.passers, 2, 1) };
    return cfg;
  }

  function simulate(names, formatChoice, statsByName, relationships) {
    const relNumeric = (a, b) => {
      const ab = LEVEL_VALUE[relationships && relationships[a] && relationships[a][b]] || 0;
      const ba = LEVEL_VALUE[relationships && relationships[b] && relationships[b][a]] || 0;
      return Math.round((ab + ba) / 2);
    };
    // Random Finale (esopare): el final se sortea entre los 13 formatos, sin pasarse del tamaño del reparto.
    let finale = formatChoice.finale;
    let randomLabel = null;
    if (finale === "FINALE_RANDOM") {
      const pool = RANDOM_FINALES.filter((id) => FINALE_SIZE[id] < names.length);
      finale = pool.length ? pool[rnd(0, pool.length - 1)] : "FINALE_TOP2";
      randomLabel = FINALE_NAME[finale];
    }
    // Formato de temporada al azar: se sortea entre los formatos copiados que caben en el reparto y en la final.
    let randomSeasonLabel = null;
    if (formatChoice.season === "SEASON_RANDOM") {
      const fin = FINALE_SIZE[finale] || 2;
      const fits = RANDOM_SEASONS.filter(([id, min]) => names.length >= min
        && (id !== "SEASON_TEAMS" || names.length % 2 === 0)
        && (id !== "SEASON_SPLIT" || names.length >= fin + 8));
      const [sid, , slabel] = pick(fits);
      formatChoice = Object.assign({}, formatChoice, { season: sid });
      randomSeasonLabel = slabel;
    }
    // Estreno al azar: se sortea entre los estrenos copiados que caben en el reparto.
    let premiere = formatChoice.season === "SEASON_TOURNAMENT" ? "PREMIERE_NORMAL" : formatChoice.premiere;
    let randomPremiereLabel = null;
    if (premiere === "PREMIERE_RANDOM") {
      const options = RANDOM_PREMIERES.filter(([, min]) => names.length >= min);
      const [id, , label] = pick(options);
      premiere = id;
      randomPremiereLabel = label;
    }
    const sim = new Sim(names, statsByName, relNumeric, {
      opening: formatChoice.openingChallenge,
      finaleSize: FINALE_SIZE[finale] || 2,
      teamsFinale: finale === "FINALE_TEAMS",
      lftc: finale === "FINALE_LIPSYNC_CROWN",
      canFinale: finale === "FINALE_LIPSYNC_FINALE",
      top6: finale === "FINALE_TOP6_AS11",
      top8: finale === "FINALE_TOP8",
      top8lftc: finale === "FINALE_TOP8_LFTC",
      top8return: finale === "FINALE_TOP8_WILDCARD",
      jury: finale === "FINALE_JURY_VOTE" || finale === "FINALE_JURY_TOP5",
      randomLabel,
      randomPremiereLabel,
      randomSeasonLabel,
      triple: premiere === "PREMIERE_TRIPLE",
      premiereNoElim: premiere === "PREMIERE_NORMAL_NOELIM",
      premiereSlayers: premiere === "PREMIERE_SLAYERS",
      thailand: formatChoice.season === "SEASON_THAILAND",
      teams: formatChoice.season === "SEASON_TEAMS",
      legacy: formatChoice.season === "SEASON_LIPSYNC_LEGACY",
      assassin: formatChoice.season === "SEASON_LIPSYNC_ASSASSIN",
      slaysian: formatChoice.season === "SEASON_SLAYSIAN",
      split: formatChoice.season === "SEASON_SPLIT",
      fatal: formatChoice.season === "SEASON_FATAL",
      lftw: formatChoice.season === "SEASON_LFTW",
      assign: formatChoice.groupAssign || {},
      twists: formatChoice.twists || [],
      episodes: formatChoice.episodes || 0,
      chocolatePick: formatChoice.chocolatePick || "",
      badonkaLevers: formatChoice.badonkaLevers || [],
      claims: (formatChoice.twists || []).includes("CLAIM_QUEEN") ? (formatChoice.claims || {}) : {},
      return: formatChoice.return === "RETURN_RANDOM_PICK" ? (formatChoice.season === "SEASON_TEAMS" || formatChoice.season === "SEASON_ALL_WINNERS" ? "RETURN_NONE" : pick(RANDOM_RETURN_POOL)) : formatChoice.return,
      returnPick: formatChoice.returnPick || "",
      winners: formatChoice.season === "SEASON_ALL_WINNERS",
      tournament: formatChoice.season === "SEASON_TOURNAMENT" ? tournamentCfg(formatChoice.tournament) : null,
      uk3: premiere === "PREMIERE_UK3",
      lateEntry: premiere === "PREMIERE_LATE_ENTRY",
      doublePremiere: premiere === "PREMIERE_DOUBLE",
      doubleNoElim: premiere === "PREMIERE_DOUBLE_NOELIM" || premiere === "PREMIERE_PORKCHOP",
      porkchopElim: premiere === "PREMIERE_PORKCHOP_ELIM",
      porkchop: premiere === "PREMIERE_PORKCHOP" || premiere === "PREMIERE_PORKCHOP_ELIM",
      doubleTalent: premiere === "PREMIERE_DOUBLE_TALENT",
      doubleGG: premiere === "PREMIERE_DOUBLE_GG",
      globalAS: premiere === "PREMIERE_GLOBAL_AS",
      raq: premiere === "PREMIERE_RATE_A_QUEEN",
    });
    sim.play();
    return {
      screens: sim.screens,
      winnerName: sim.winnerName,
      runnerUpName: sim.runnerUpName,
      missCongeniality: sim.missCongName,
    };
  }

  window.RefSim = { canRun, simulate, groupPlan, episodeInfo, mergeFormats: MERGE_FORMATS.map((m) => ({ id: m.id, label: m.label })) };
})();
