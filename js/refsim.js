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
    q(names, color, text) { this.blocks.push({ t: "q", names: names.slice(), color, text }); return this; }
    reveal(label, blocks) { this.blocks.push({ t: "reveal", label, blocks }); return this; }
    add(block) { this.blocks.push(block); return this; }
  }

  // ---------- la reina ----------
  class Queen {
    constructor(name, stats) {
      const g = (k) => (stats && typeof stats[k] === "number" ? stats[k] : 7);
      this.name = name;
      this.st = {
        acting: g("acting"), comedy: g("comedy"), dance: g("dance"), design: g("design"),
        improv: g("improv"), runway: g("runway"), lipsync: g("lipsync"),
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
    addTR(placement) { this.trackRecord.push(placement); }
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
    "SAFE": { bg: "white" },
    "LOW": { bg: "pink" },
    "BTM2": { bg: "tomato" },
    "BTM3": { bg: "tomato" },
    "BTM5": { bg: "tomato" },
    "BTM6": { bg: "tomato" },
    "BTM": { bg: "tomato" },
    " BTM2": { text: "BTM2", bg: "hotpink" },
    "ELIM": { bg: "red", bold: true },
    " ELIM ": { text: "ELIM", bg: "darkred", fg: "white", bold: true },
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

  // ======================================================================================
  class Sim {
    constructor(names, statsByName, relNumeric, opts) {
      this.queens = names.map((n) => new Queen(n, statsByName[n]));
      this.byName = new Map(this.queens.map((q) => [q.name, q]));
      this.current = this.queens.slice();
      this.eliminated = [];
      this.total = this.queens.length;
      this.episode = 0;
      this.episodeChallenges = [];
      this.screens = [];
      this.opts = opts || {};
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
    bestSister(queen, cast) {
      const others = cast.filter((q) => q !== queen);
      let best = others[0];
      others.forEach((q) => {
        const r = this.rel(queen, q), rb = this.rel(queen, best);
        if (rb === r) { if (rnd(0, 100) <= 50) best = q; } else if (rb < r) best = q;
      });
      return best;
    }
    worstSister(queen, cast) {
      const others = cast.filter((q) => q !== queen);
      let worst = others[0];
      others.forEach((q) => {
        const r = this.rel(queen, q), rw = this.rel(queen, worst);
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
      while (this.current.length > this.finaleSize) {
        this.playEpisode();
        this.trackRecordScreen(false);
      }
      this.reunion();
      this.finale();
      this.finalScreens();
    }

    // ---------- un episodio ----------
    playEpisode() {
      this.episode++;
      this.topQueens = [];
      this.bottomQueens = [];
      this.top2 = [];
      this.flag.isNoTeam = false;
      this.miniChallenge();
    }

    // ---------- mini reto ----------
    miniChallenge() {
      this.flag.miniHappen = false;
      this.current.forEach((q) => { q.miniWinner = false; });
      const s = this.newScreen("¡Mini reto!", "Ir al maxi reto");
      this.checkForDeptQuit(s);
      this.describeMini(s);
      this.rankMini(s);
      this.createChallenge();
    }

    checkForDeptQuit(s) {
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
      const readingNow = (cast.length === 6 && this.total >= 9 && this.episode > 2 ||
        cast.length === 7 && this.total >= 30 && this.episode > 3) && !this.flag.reading;
      if (readingNow) {
        text = "¡La biblioteca está abierta! En el mini reto de hoy, las reinas se leerán entre ellas.";
        this.miniType = "comedy";
        this.flag.reading = true;
        this.readingBlocks = this.readingChallenge(cast, true);
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
      if (readingNow) this.readingBlocks.forEach((blk) => s.add(blk));
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
    readingChallenge(cast, isCurrent) {
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
          const pool = readuMode ? this.eliminated : cast;
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
      const opening = this.opts.opening;
      let fn;
      if (this.episode === 1) {
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
          if (makeover) {
            s.b("¡Es el reto de transformación! Las reinas convertirán en sus hermanas drag " + pick(D.makeoverPeople) + ".");
            this.episodeChallenges.push("Make Over");
            this.flag.makeover = true;
          } else {
            s.b("¡Las reinas desfilarán por la pasarela! La categoría es: " + pick(D.runwayCategories));
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
          s.b("¡El reto de hoy es... SNATCH GAME! ¡Las reinas harán divertidas imitaciones de famosos!");
          this.episodeChallenges.push(rnd(0, 100) >= 95 ? "Snatch Game of Love" : "Snatch Game");
          s.hr();
          s.big("¡Imitaciones del Snatch Game!");
          cast.forEach((q) => {
            const i = rnd(0, this.sgPool.length - 1);
            s.q([q.name], undefined, `${q.name} imitará a ${this.sgPool[i]}!`);
            this.sgPool.splice(i, 1);
          });
          cast.forEach((q) => q.getSnatch());
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
        this.runway(s);
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
      s.p("La categoría es... " + (cast.length > 4 ? pick(D.runwayCategories) : "¡el mejor drag!"));
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
      const byPerf = () => cast.sort((a, b) => a.performanceScore - b.performanceScore);

      // Normal Premiere (No Elimination): el episodio 1 tiene siempre 3 arriba y 3 abajo.
      if (this.slayNow()) {
        byPerf();
        if (cast[n - 3].performanceScore > 25) {
          for (let i = 0; i < 3; i++) { top.push(cast[i]); bottom.push(cast[n - (i + 1)]); }
        } else {
          for (let i = 0; i < n / 2; i++) top.push(cast[i]);
        }
        return this.judgingScreen();
      }
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
      top.push(cast[0]);
      bottom.push(cast[1], cast[2]);
      return this.winAndBtm2();
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

    // ¿Es el estreno sin eliminación (episodio 1 con ese formato)?
    noElimNow() { return !!this.opts.premiereNoElim && this.episode === 1; }
    slayNow() { return !!this.opts.premiereSlayers && this.episode === 1; }

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
      return this.slayNow() ? this.slayersJudging() : this.winAndBtm2();
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
      const f = this.flag;
      const s = this.newScreen("¡Que vuelvan mis chicas!", "Lip sync por la vida");
      s.b("Chicas, he tomado algunas decisiones...");
      const top = this.topQueens, bottom = this.bottomQueens;
      top.forEach((q) => { q.performanceScore -= (q.runwayScore - q.favoritism); });
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
      } else if ((top.length > 1 && top[0].performanceScore === top[1].performanceScore && rnd(0, 100) < 60) || (f.isPair && rnd(0, 100) < 85)) {
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
      const lowSafe = (count) => {
        const safe = bottom.splice(0, count);
        safe.forEach((q) => { q.addTR("LOW"); q.unfavoritism += 1; q.ppe += 2; });
        const names = safe.map((q) => q.name);
        s.q(names, "pink", `${list(names)}... ${names.length > 1 ? "estáis" : "estás"} a salvo.`);
      };
      if (bottom.length === 5) lowSafe(3);
      else if (bottom.length === 4) lowSafe(2);
      else if (bottom.length === 3 && bottom[0].performanceScore >= 30 && this.current.length > 5 && !this.noElimNow()) {
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
      top.splice(0, 1);
    }

    doubleWin(s, top) {
      const [a, b] = top;
      [a, b].forEach((q) => { q.addTR(" WIN"); q.favoritism += 5; q.ppe += 5; });
      s.q([a.name, b.name], "darkblue", `${a.name}, ${b.name}, condragulations, ¡sois las ganadoras del reto de hoy!`);
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
      top.forEach((q) => { q.performanceScore -= (q.runwayScore - q.favoritism); });
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
      if (score1 < 2 && score2 < 2 && rnd(0, 100) <= 8 && this.current.length > 6) {
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
      queens.forEach((q) => { q.lipsyncScore = q.lipsyncScore + q.favoritism - q.unfavoritism; });
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
      const score1 = bottom[0].lipsyncScore - bottom[0].favoritism + bottom[0].unfavoritism;
      const score2 = bottom[1].lipsyncScore - bottom[1].favoritism + bottom[1].unfavoritism;
      const elim = (q, label = "ELIM", tie) => {
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
      const atFinaleEdge = this.current.length === this.finaleSize + 1;
      if (score1 > 7 && score2 > 7 && rnd(0, 100) <= 50 && !f.doubleShantay) {
        if (atFinaleEdge && (this.finaleSize <= 3 || this.opts.lftc) && rnd(0, 10) >= 6) {
          this.finaleSize++;
          this.opts.lftc = false; // el Lip-Sync For The Crown pasa a ser una final Top 5
        }
        let kandy = false;
        if (rnd(0, 100) >= 95) {
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
      if (score1 < 2 && score2 < 2 && rnd(0, 100) <= 8 && !f.doubleSashay && this.current.length > 6) {
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
      s.reveal("Mostrar relaciones", this.relationshipBlocks());
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
      const wild = typeof raw === "string" && raw.startsWith("RTRN + ");
      const style = CELL_STYLE[wild ? raw.slice(7) : raw] || { text: raw };
      const baseText = style.text !== undefined ? style.text : (wild ? raw.slice(7) : raw);
      const cell = { text: wild ? "REGRESO\n+\n" + baseText : baseText, bg: style.bg, fg: style.fg, bold: style.bold };
      if (queen.miniEpisode.includes(col + 1)) {
        cell.sub = queen.tCaptain.includes(col + 1) ? "Capitana de equipo" : "Ganadora del mini reto";
      }
      // Jury Vote: en la columna de la final se muestran los puntos del jurado.
      if (this.opts.jury && queen.juryPoints !== undefined && col === this.episodeChallenges.length - 1
        && /^(MSCON)?(WIN|RUNUP|ELIMINATED)|^(WINNER|RUNNER UP)$/.test(raw)) {
        cell.sub = `(${queen.juryPoints} puntos)`;
      }
      return cell;
    }

    trData(finale) {
      const columns = this.episodeChallenges.map((c) => TR_LABEL[c] || c);
      const mkRow = (queen, rankHtml) => {
        const cells = [];
        for (let i = 0; i < columns.length; i++) cells.push(this.cellFor(queen.trackRecord[i] !== undefined ? queen.trackRecord[i] : "", queen, i));
        return { name: queen.name, rank: rankHtml, cells, ppe: queen.episodesOn ? (queen.ppe / queen.episodesOn * 2).toFixed(2) : "0.00" };
      };
      const rows = [];
      const cur = this.current;
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
      return { t: "tr", columns, rows };
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
    }

    missCongeniality(s) {
      s.big("¡Las concursantes votarán a Miss Simpatía!");
      const whole = shuffle([...this.current, ...this.eliminated]);
      this.eliminated.forEach((q) => { q.votes = 0; q.trackRecord[q.trackRecord.length - 1] = "GUEST"; });
      this.current.forEach((q) => { q.votes = 0; });
      whole.forEach((q) => {
        q.lipstick = this.bestSister(q, whole);
        s.q([q.name, q.lipstick.name], "aqua", `¡${q.name} votó a ${q.lipstick.name} como Miss Simpatía!`);
        q.lipstick.votes++;
      });
      s.hr();
      whole.sort((a, b) => b.votes - a.votes);
      const winner = whole[0];
      s.q([winner.name], "aqua", `La ganadora de Miss Simpatía de esta temporada es... ¡${winner.name}!`);
      if (this.current.includes(winner)) winner.mxcon = true;
      else winner.trackRecord[winner.trackRecord.length - 1] = "MISS CON";
      winner.minqdd = winner.minqdd ? winner.minqdd + "\n(Miss Simpatía)" : "(Miss Simpatía)";
      this.missCongName = winner.name;
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
      s.add({ t: "lipsyncs", alots: this.alots, blots: this.blots });
      this.finalScreen = s;
    }
  }

  // ======================================================================================
  // API
  // ======================================================================================
  const FINALE_SIZE = { FINALE_TOP2: 2, FINALE_TOP3: 3, FINALE_TOP4: 4, FINALE_TOP5: 5, FINALE_TEAMS: 4, FINALE_LIPSYNC_CROWN: 4, FINALE_LIPSYNC_FINALE: 4, FINALE_JURY_VOTE: 4, FINALE_JURY_TOP5: 5, FINALE_TOP6_AS11: 6, FINALE_TOP8: 8, FINALE_TOP8_LFTC: 8, FINALE_TOP8_WILDCARD: 7 };
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
    return (formatChoice.premiere === "PREMIERE_NORMAL" || formatChoice.premiere === "PREMIERE_NORMAL_NOELIM" || formatChoice.premiere === "PREMIERE_SLAYERS")
      && formatChoice.season === "SEASON_REGULAR"
      && (FINALE_SIZE[formatChoice.finale] || formatChoice.finale === "FINALE_RANDOM")
      && formatChoice.return === "RETURN_NONE"
      && (!formatChoice.twists || formatChoice.twists.length === 0);
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
      premiereNoElim: formatChoice.premiere === "PREMIERE_NORMAL_NOELIM",
      premiereSlayers: formatChoice.premiere === "PREMIERE_SLAYERS",
    });
    sim.play();
    return {
      screens: sim.screens,
      winnerName: sim.winnerName,
      runnerUpName: sim.runnerUpName,
      missCongeniality: sim.missCongName,
    };
  }

  window.RefSim = { canRun, simulate };
})();
