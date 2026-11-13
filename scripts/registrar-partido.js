const fs = require("fs");
const crypto = require("crypto");

const archivo = "data/partidos.json";

const home = process.env.EQUIPO_LOCAL?.trim();
const away = process.env.EQUIPO_VISITANTE?.trim();
const partidoId = process.env.PARTIDO_ID?.trim();

if (!partidoId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(partidoId)) {
  throw new Error("El ID solo puede contener letras, números, guiones y guiones bajos.");
}
  throw new Error("Falta el identificador único del partido.");
}
const golesHome = Number(process.env.GOLES_LOCAL);
const golesAway = Number(process.env.GOLES_VISITANTE);

if (!home || !away || home === away) {
  throw new Error("Los equipos no son válidos.");
}

if (
  !Number.isInteger(golesHome) ||
  !Number.isInteger(golesAway) ||
  golesHome < 0 ||
  golesAway < 0
) {
  throw new Error("El resultado no es válido.");
}

const registro = JSON.parse(
  fs.readFileSync(archivo, "utf8")
);
if (registro.partidos.some(partido => partido.id === partidoId)) {
  throw new Error("Este partido ya fue registrado. No se permiten duplicados.");
}
const partido = {
  id: partidoId,
  home,
  away,
  golesHome,
  golesAway,
  fecha: new Date().toISOString(),
  eventos: []
};

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

registro.partidos.push(partido);

fs.writeFileSync(
  archivo,
  JSON.stringify(registro, null, 2) + "\n"
);

console.log("Partido registrado correctamente.");
console.log("ID:", partido.id);
console.log("Huella:", partido.huella);
