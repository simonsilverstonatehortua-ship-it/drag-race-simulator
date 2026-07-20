// Store muy simple basado en localStorage. Nada de backend: todo vive en el navegador
// del usuario, y se puede exportar/importar como JSON para compartir o respaldar.

const STORAGE_KEY = "dragRaceSimulator.rulesDB.v1";

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const db = JSON.parse(raw);
      if (!db.customContestants) db.customContestants = [];
      return db;
    } catch (e) {
      console.warn("No se pudo leer la base de datos guardada, se reinicia.", e);
    }
  }
  return {
    statuses: structuredClone(window.DEFAULT_STATUSES),
    challenges: structuredClone(window.DEFAULT_CHALLENGES),
    formats: structuredClone(window.DEFAULT_FORMATS),
    scoreScale: structuredClone(window.DEFAULT_SCORE_SCALE),
    customContestants: [],
  };
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db, null, 2));
}

function resetDB() {
  localStorage.removeItem(STORAGE_KEY);
  return loadDB();
}

window.RulesStore = { loadDB, saveDB, resetDB, STORAGE_KEY };
