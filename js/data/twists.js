// Catálogo de "opciones"/twists de la temporada: a diferencia de Estreno/Regreso/
// Temporada/Final (donde eliges una sola opción de cada lista), aquí puedes activar
// varias a la vez, al estilo de la pestaña "Twists" de esopare.github.io y
// myrainboww.github.io. El motor de simulación (js/engine.js) las aplica cuando están
// activas en formatChoice.twists.

const DEFAULT_TWISTS = [
  { id: "IMMUNITY", label: "Inmunidad", custom: false,
    description: "La ganadora (o ganadoras empatadas) del reto de la semana no puede estar en el fondo de la clasificación la semana siguiente, sea cual sea su puntaje esa semana. En la tabla se marca con el borde rosa característico (#FE4EDA), igual que en la hoja de la Temporada 1 del fandom wiki." },
];

window.DEFAULT_TWISTS = DEFAULT_TWISTS;
