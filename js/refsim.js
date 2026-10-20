// Simulador "estilo myrainboww": copia paso a paso del simulador de referencia
// https://myrainboww.github.io/Drag-Race-Simulator/ (sus reglas, sus pantallas y su
// aleatoriedad), con todos los textos traducidos al español.
//
// Por ahora cubre este formato: estreno normal + temporada regular + final Top 2 + sin regresos
// (ver RefSim.canRun). El resto de formatos sigue usando js/engine.js.
//
// No toca el DOM: devuelve una lista de pantallas { title, button, blocks }, que app.js pinta
// con renderRefBlocks. Una pantalla copia lo que el simulador de referencia muestra entre dos
// pulsaciones de "Proceed"; las puntuaciones salen de las 7 estadísticas básicas de cada
// reina (acting, comedy, dance, design, improv, runway, lipsync), con la misma fórmula que el
// original: puntuación = aleatorio - estadística (menor es mejor), etc.

(function () {
  "use strict";

  const D = window.REF_DATA;
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
    getTalentShow() { this.performanceScore = this.calc(15, 35, rnd(1, 35)); }
    getFinale() { this.finaleScore = this.favoritism - this.unfavoritism; }
    getRunway() { this.runwayScore = this.calc(12, 35, this.st.runway); }
    getLipsync() { this.lipsyncScore = this.calc(0, this.st.lipsync, this.unfavoritism) + this.favoritism; }
    getASLipsync() { this.lipsyncScore = this.calc(0, this.st.lipsync); }
    addTR(placement) { this.trackRecord.push(placement); }
  }

  // Etiquetas de reto en la cabecera del track record.
  const TR_LABEL = {
    "Design": "Diseño", "Acting": "Actuación", "Stand Up": "Stand Up", "Roast": "Roast", "Advert": "Anuncio",
    "Dance": "Baile", "Choreo": "Coreo", "Improv": "Improvisación", "Runway": "Pasarela", "Make Over": "Transformación",
    "Snatch Game": "Snatch Game", "Snatch Game of Love": "Snatch Game of Love", "Rusical": "Rusical", "Ball": "Ball",
    "Talent Show": "Show de talentos", "Girl Group": "Girl Group", "Music Video": "Videoclip", "Finale": "Final",
  };

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
    "WINNER": { text: "GANADORA", bg: "yellow", bold: true },
    "RUNNER UP": { text: "SUBCAMPEONA", bg: "silver", bold: true },
    "MSCONWIN": { text: "MISS SIMPATÍA\n+\nGANADORA", bg: "#80FF80", bold: true },
    "MSCONRUNUP": { text: "MISS SIMPATÍA\n+\nSUBCAMPEONA", bg: "#9DCECB", bold: true },
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
      this.cnt = { acting: 0, comedy: 0, marketing: 0, dance: 0, design: 0, improv: 0 };
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
      while (this.current.length > 2) {
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
      let text;
      const readingNow = ((this.total >= 10 && cast.length === 7 && this.episode > 3) ||
        (this.total >= 9 && cast.length === 6 && this.episode > 2)) && !this.flag.reading;
      if (readingNow) {
        text = "¡La biblioteca está abierta! En el mini reto de hoy, las reinas se leerán entre ellas.";
        this.flag.reading = true;
        this.readingBlocks = this.readingChallenge(cast, true);
      } else if (this.total !== 5 && cast.length === 5) {
        text = "¡Que salgan los títeres! Las reinas se parodiarán entre ellas usando títeres.";
      } else if (rnd(0, 100) >= 80) {
        text = "Hoy no hay mini reto, ¡vamos directas al maxi reto!";
        this.flag.miniHappen = true;
      } else {
        text = "En el mini reto de hoy, las reinas harán " + D.miniKinds[rnd(0, 7)] + D.miniObjects[rnd(0, 6)];
      }
      s.b(text);
      s.hr();
      if (readingNow) this.readingBlocks.forEach((blk) => s.add(blk));
    }

    rankMini(s) {
      if (this.flag.miniHappen) return;
      const cast = this.current;
      if (rnd(0, 100) <= 90) {
        const winner = cast[rnd(0, cast.length - 1)];
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
      } else if (this.total >= 12 && n === 9 && !this.flag.snatch) fn = "snatch";
      else if (this.total < 12 && !this.flag.snatch && (n === rnd(7, 9) || n === 7)) fn = "snatch";
      else if (this.total >= 12 && (n === this.total - 3 || n === this.total - 4) && !this.flag.ball) fn = "ball";
      else if (this.total < 12 && ((n === 8 && rnd(0, 100) <= 10 && !this.flag.ball) || (n === 3 && !this.flag.ball))) fn = "ball";
      else if (((this.total >= 12 && (n === 8 || n === 9)) || (this.total < 12 && n === 6)) && !this.flag.girlGroup && rnd(0, 100) >= 50) fn = "girlgroup";
      else if (((this.total >= 12 && (n === 11 || n === 9)) || (this.total < 12 && n === 7)) && !this.flag.rusical && rnd(0, 100) >= 50) fn = "rusical";
      else if (!this.flag.snatch && n <= 5) fn = "snatch"; // el Snatch Game sale en todas las temporadas
      else fn = this.randomMaxi();
      this.maxi(fn);
    }

    randomMaxi() {
      const total = this.total;
      let challenges = [
        { type: "acting", times: this.cnt.acting }, { type: "improv", times: this.cnt.improv },
        { type: "marketing", times: this.cnt.marketing }, { type: "dance", times: this.cnt.dance },
        { type: "design", times: this.cnt.design }, { type: "comedy", times: this.cnt.comedy },
        { type: "runway", times: this.flag.runway ? 1 : 0 },
      ];
      if (this.flag.runway) challenges = challenges.filter((c) => c.type !== "runway");
      const cap = (type, max) => { if (this.cnt[type] >= max) challenges = challenges.filter((c) => c.type !== type); };
      cap("acting", 3); cap("comedy", 3); cap("marketing", 3); cap("improv", 3); cap("design", 3);
      cap("dance", total > 15 ? 2 : 3);
      // nunca el mismo reto dos episodios seguidos
      const notLast = challenges.filter((c) => c.type !== this.lastChallenge);
      if (notLast.length) challenges = notLast;
      this.restChall++;
      challenges.sort((a, b) => b.times - a.times);
      const unused = challenges.filter((c) => c.times < challenges[0].times);
      let chosen;
      if (this.restChall === 1) chosen = challenges[rnd(0, Math.min(3, challenges.length - 1))];
      else if (unused.length) chosen = pick(unused);
      else chosen = pick(challenges);
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
          const makeover = (cast.length === 6 || cast.length === 5) && !this.flag.makeover;
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
          break;
        }
        case "snatch": {
          s.b("¡El reto de hoy es... SNATCH GAME! ¡Las reinas harán divertidas imitaciones de famosos!");
          this.episodeChallenges.push(rnd(0, 100) >= 95 ? "Snatch Game of Love" : "Snatch Game");
          s.hr();
          s.big("Las concursantes harán...");
          cast.forEach((q) => {
            const i = rnd(0, this.sgPool.length - 1);
            s.q([q.name], undefined, `${q.name} hará una imitación de ${this.sgPool[i]}!!`);
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
        case "girlgroup": {
          s.b(`Las reinas restantes grabarán las voces y actuarán en un número de Girl Group con la canción original «${pick(D.girlGroupSongs)}».`);
          this.runTeamable(s, rnd(0, 100) >= 50 && this.episode > 3, "getRumix");
          this.episodeChallenges.push("Girl Group");
          this.flag.girlGroup = true;
          break;
        }
        case "talent": {
          s.b("¡Las concursantes se pondrán a prueba en un show de talentos, donde darán todo lo que tienen!");
          s.hr();
          s.big("Las concursantes actuarán...");
          cast.forEach((q) => s.q([q.name], undefined, `${q.name} hará una actuación de ${pick(D.talents)}!!`));
          cast.forEach((q) => q.getTalentShow());
          cast.sort((a, b) => a.performanceScore - b.performanceScore);
          this.episodeChallenges.push("Talent Show");
          this.flag.talent = true;
          break;
        }
        default: break;
      }
      this.queensPerformances(s);
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
      s.big("Actuaciones de las reinas...");
      cast.forEach((q) => {
        if (q.adv != null) { q.performanceScore -= q.adv; q.adv = undefined; }
      });
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
      if (f.isNoTeam) {
        s.b("Esta semana habéis competido por equipos. Pero esta noche se os juzgará de forma individual.");
        s.hr();
        f.isNoTeam = false;
      }
      s.b("Basándonos en las actuaciones de esta noche...");
      shuffle(this.bottomQueens);
      shuffle(this.topQueens);
      const judged = shuffle([...this.topQueens, ...this.bottomQueens]).map((q) => q.name);
      s.q(judged, "cyan", `${list(judged)}, representáis los tops y bottoms de la semana.`);
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
      return this.winAndBtm2();
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
      else if (bottom.length === 3 && bottom[0].performanceScore >= 30 && this.current.length > 5) {
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
      s.q(judged, "cyan", `${list(judged)}, representáis los tops y bottoms de la semana.`);
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
      const s = this.newScreen("Ha llegado la hora...", "Mostrar el resultado");
      s.b("Para que hagáis lip sync... ¡por vuestras vidas! Buena suerte, y no la caguéis.");
      const song = this.pickSong(s);
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
        }
      }
      this.episodeChallenges.push("LaLaPaRUza Smackdown");
      this.episode++;
    }

    // ======================================================================================
    // LIP SYNC
    // ======================================================================================
    pickSong(s) {
      if (!this.songs.length) this.songs = D.songs.slice();
      const i = rnd(0, this.songs.length - 1);
      const song = this.songs[i];
      this.songs.splice(i, 1);
      s.b(`La canción del lip sync es... ${song}!`);
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
      const s = this.newScreen("Ha llegado la hora...", "Mostrar el resultado");
      bottom.forEach((q) => {
        q.getLipsync();
        q.lipsyncScore = (q.lipsyncScore - q.favoritism) + q.unfavoritism;
      });
      s.b("Para que hagáis lip sync... ¡por vuestras vidas! Buena suerte, y no la caguéis.");
      const song = this.pickSong(s);
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
      };
      const stay = (q, label = "BTM2") => { q.addTR(label); q.unfavoritism += 3; q.ppe += 1; };
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
      // (Con 3 reinas no hay doble shantay: en el original eso podía convertir la final en un
      // Top 3, y esa final aún no está copiada.)
      if (score1 > 7 && score2 > 7 && rnd(0, 100) <= 50 && !f.doubleShantay && this.current.length !== 3) {
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
      if (cast.length < 21) howMany = rnd(3, 7);
      if (cast.length < 12) howMany = rnd(2, 5);
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
      const style = CELL_STYLE[raw] || { text: raw };
      const cell = { text: style.text !== undefined ? style.text : raw, bg: style.bg, fg: style.fg, bold: style.bold };
      if (queen.miniEpisode.includes(col + 1)) {
        cell.sub = queen.tCaptain.includes(col + 1) ? "Capitana de equipo" : "Ganadora del mini reto";
      }
      return cell;
    }

    trData(finale) {
      const columns = this.episodeChallenges.map((c) => TR_LABEL[c] || c);
      const mkRow = (queen, rankHtml) => {
        const cells = [];
        for (let i = 0; i < columns.length; i++) cells.push(this.cellFor(queen.trackRecord[i] !== undefined ? queen.trackRecord[i] : "", queen, i));
        return { name: queen.name, rank: rankHtml, cells, ppe: queen.episodesOn ? (queen.ppe / queen.episodesOn).toFixed(2) : "0.00" };
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
        if (q.rankP === 2) rank = "2º\n(Subcampeona)";
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

    finale() {
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
      cast.forEach((q) => q.getRunway());
      const by = (lo, hi) => cast.filter((q) => q.runwayScore >= lo && q.runwayScore < hi);
      this.describeGroups(r, [
        [by(-Infinity, 6), "darkblue", (l, pl) => `¡${l} ${pl ? "arrasaron" : "arrasó"} en la pasarela!`],
        [by(6, 16), "royalblue", (l, pl) => `¡${l} ${pl ? "tuvieron" : "tuvo"} una gran pasarela!`],
        [by(16, 26), undefined, (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una buena pasarela.`],
        [by(26, Infinity), "pink", (l, pl) => `${l} ${pl ? "tuvieron" : "tuvo"} una mala pasarela...`],
      ]);
      // los minutos finales
      this.episode++;
      this.episodeChallenges.push("Music Video");
      this.eliminated.forEach((q) => { q.trackRecord.splice(q.trackRecord.length - 1, 0, ""); });
      cast.forEach((q) => q.addTR("TOP " + cast.length));
      const j = this.newScreen("Los minutos finales...", "Ver a la ganadora");
      j.b("Chicas, es hora de decidir a la próxima Superestrella Drag, y...");
      j.hr();
      const finalists = shuffle(cast.slice()).map((q) => q.name);
      j.q(finalists.slice(0, 2), "silver", `${finalists[0]}, ${finalists[1]}, esta es vuestra última oportunidad para demostrar lo que valéis. Es hora de que hagáis lip sync... ¡por la CORONA!`);
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
        s.b("¡Ahora a hacer prance, mis reinas!");
        cast[1].rankP = 1;
        cast[0].addTR(label(cast[0], true));
        cast[1].addTR(label(cast[1], true));
        this.addSong([cast[0], cast[1]], [], this.songUsed);
        this.eliminated.unshift(cast[1]);
        cast.splice(1, 1);
        this.winnerName = cast[0].name;
        this.runnerUpName = this.eliminated[0].name;
      } else {
        this.addSong([cast[0]], [cast[1]], this.songUsed);
        s.q([cast[0].name], "yellow", `¡¡${cast[0].name}!!`);
        s.b("¡Ahora a hacer prance, mi reina!");
        cast[0].addTR(label(cast[0], true));
        cast[1].addTR(label(cast[1], false));
        cast[1].rankP = 2;
        this.eliminated.unshift(cast[1]);
        cast.splice(1, 1);
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
  const LEVEL_VALUE = { "le cae muy bien": 10, "le cae bien": 5, "normal": 0, "le cae mal": -5, "le cae muy mal": -10 };

  // El formato que copia este simulador: estreno normal + temporada regular + final Top 2 +
  // sin regresos y sin opciones extra.
  function canRun(formatChoice) {
    return formatChoice.premiere === "PREMIERE_NORMAL"
      && formatChoice.season === "SEASON_REGULAR"
      && formatChoice.finale === "FINALE_TOP2"
      && formatChoice.return === "RETURN_NONE"
      && (!formatChoice.twists || formatChoice.twists.length === 0);
  }

  function simulate(names, formatChoice, statsByName, relationships) {
    const relNumeric = (a, b) => {
      const ab = LEVEL_VALUE[relationships && relationships[a] && relationships[a][b]] || 0;
      const ba = LEVEL_VALUE[relationships && relationships[b] && relationships[b][a]] || 0;
      return Math.round((ab + ba) / 2);
    };
    const sim = new Sim(names, statsByName, relNumeric, { opening: formatChoice.openingChallenge });
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
