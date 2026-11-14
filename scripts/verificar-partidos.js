"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");
const integridad = require("./integridad-partidos");

const archivo = "data/partidos.json";
if (!fs.existsSync(archivo)) {
  throw new Error("No existe el registro de partidos.");
}

const actual = JSON.parse(fs.readFileSync(archivo, "utf8"));
const resultado = integridad.verificarRegistro(actual);
const baseRef = process.env.BASE_REF || "HEAD";

function obtenerRegistroBase() {
  try {
    const contenido = execFileSync(
      "git",
      ["show", baseRef + ":" + archivo],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    return JSON.parse(contenido);
  } catch (error) {
    // Es válido que el archivo aún no existiera en la rama base.
    return null;
  }
}

function compararHistorialAnterior() {
  const anterior = obtenerRegistroBase();
  if (!anterior) return;

  const verificacionAnterior = integridad.verificarRegistro(anterior);
  if (actual.partidos.length < anterior.partidos.length) {
    throw new Error("No se permite eliminar partidos del historial.");
  }

  for (let i = 0; i < anterior.partidos.length; i++) {
    const viejo = anterior.partidos[i];
    const nuevo = actual.partidos[i];
    if (!nuevo || nuevo.id !== viejo.id) {
      throw new Error("Se reordenó o eliminó el partido histórico: " + viejo.id);
    }

    if (anterior.version === 1 && actual.version === 2) {
      const camposViejos = integridad.contenidoCanonico(viejo);
      const camposNuevos = integridad.contenidoCanonico(nuevo);
      if (JSON.stringify(camposViejos) !== JSON.stringify(camposNuevos)) {
        throw new Error("Se modificó un partido histórico: " + viejo.id);
      }
    } else if (JSON.stringify(nuevo) !== JSON.stringify(viejo)) {
      throw new Error("Se modificó un partido histórico: " + viejo.id);
    }
  }

  console.log("Historial anterior preservado:", verificacionAnterior.cantidad, "partidos.");
}

compararHistorialAnterior();
console.log("Integridad correcta:", resultado.cantidad, "partidos verificados.");
console.log("Última huella de la cadena:", resultado.ultimoHash);
