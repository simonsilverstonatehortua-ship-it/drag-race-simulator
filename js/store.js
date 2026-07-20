// Store muy simple basado en localStorage. Nada de backend: todo vive en el navegador
// del usuario, y se puede exportar/importar como JSON para compartir o respaldar.

const STORAGE_KEY = "dragRaceSimulator.rulesDB.v1";

// Refresca en `list` las entradas NO personalizadas (custom:false) con los valores por
// defecto actuales (por si esta versión trae ajustes, p.ej. nuevos puntos). Lo que el
// usuario haya editado o creado (custom:true) se respeta tal cual.
function refreshUntouchedDefaults(list, defaults) {
  if (!Array.isArray(list)) return;
  defaults.forEach((def) => {
    const idx = list.findIndex((x) => x.id === def.id && x.custom === false);
    if (idx >= 0) list[idx] = structuredClone(def);
  });
}

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const db = JSON.parse(raw);
      if (!db.customContestants) db.customContestants = [];
      refreshUntouchedDefaults(db.statuses, window.DEFAULT_STATUSES);
      refreshUntouchedDefaults(db.challenges, window.DEFAULT_CHALLENGES);
      refreshUntouchedDefaults(db.formats, window.DEFAULT_FORMATS);
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
