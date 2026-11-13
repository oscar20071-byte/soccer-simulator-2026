
const fs = require("fs");
const crypto = require("crypto");

const archivo = "data/partidos.json";

const home = process.env.EQUIPO_LOCAL?.trim();
const away = process.env.EQUIPO_VISITANTE?.trim();
const partidoId = process.env.PARTIDO_ID?.trim();

// Validar identificador
if (!partidoId) {
  throw new Error("Falta el identificador único del partido.");
}

if (!/^[a-zA-Z0-9_-]+$/.test(partidoId)) {
  throw new Error("El ID solo puede contener letras, números, guiones y guiones bajos.");
}

// Validar equipos
if (!home || !away || home === away) {
  throw new Error("Los equipos no son válidos.");
}

// Validar resultado
const golesHome = Number(process.env.GOLES_LOCAL);
const golesAway = Number(process.env.GOLES_VISITANTE);

if (
  !Number.isInteger(golesHome) ||
  !Number.isInteger(golesAway) ||
  golesHome < 0 ||
  golesAway < 0
) {
  throw new Error("El resultado no es válido.");
}

// Comprobar archivo
if (!fs.existsSync(archivo)) {
  throw new Error("No existe el registro de partidos.");
}

const registro = JSON.parse(
  fs.readFileSync(archivo, "utf8")
);

if (!Array.isArray(registro.partidos)) {
  throw new Error("El formato del registro no es válido.");
}

// Evitar duplicados
if (registro.partidos.some(p => p.id === partidoId)) {
  throw new Error("Este partido ya fue registrado. No se permiten duplicados.");
}

// Crear partido
const partido = {
  id: partidoId,
  home,
  away,
  golesHome,
  golesAway,
  fecha: new Date().toISOString(),
  eventos: []
};

// Calcular huella
const contenido = {
  id: partido.id,
  home: partido.home,
  away: partido.away,
  golesHome: partido.golesHome,
  golesAway: partido.golesAway,
  fecha: partido.fecha,
  eventos: partido.eventos
};

partido.huella = crypto
  .createHash("sha256")
  .update(JSON.stringify(contenido))
  .digest("hex");

// Guardar
registro.partidos.push(partido);

fs.writeFileSync(
  archivo,
  JSON.stringify(registro, null, 2) + "\n"
);

console.log("Partido registrado correctamente.");
console.log("ID:", partido.id);
console.log("Huella:", partido.huella);
