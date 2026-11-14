"use strict";

const fs = require("fs");
const integridad = require("./integridad-partidos");

const archivo = "data/partidos.json";

const home = process.env.EQUIPO_LOCAL?.trim();
const away = process.env.EQUIPO_VISITANTE?.trim();
const partidoId = process.env.PARTIDO_ID?.trim();

if (!partidoId) {
  throw new Error("Falta el identificador único del partido.");
}
if (!/^[a-zA-Z0-9_-]+$/.test(partidoId)) {
  throw new Error("El ID solo puede contener letras, números, guiones y guiones bajos.");
}
if (!home || !away || home === away) {
  throw new Error("Los equipos no son válidos o son iguales.");
}

const golesHome = Number(process.env.GOLES_LOCAL);
const golesAway = Number(process.env.GOLES_VISITANTE);
if (
  process.env.GOLES_LOCAL === undefined ||
  process.env.GOLES_VISITANTE === undefined ||
  !Number.isInteger(golesHome) ||
  !Number.isInteger(golesAway) ||
  golesHome < 0 ||
  golesAway < 0
) {
  throw new Error("El resultado debe contener goles enteros iguales o superiores a cero.");
}

if (!fs.existsSync(archivo)) {
  throw new Error("No existe data/partidos.json. El registro inicial debe estar versionado.");
}

let registro = JSON.parse(fs.readFileSync(archivo, "utf8"));
registro = integridad.migrarRegistroLegado(registro);

if (registro.partidos.some(partido => partido.id === partidoId)) {
  throw new Error("Este partido ya fue registrado. No se permiten duplicados.");
}

const partido = integridad.crearPartido({
  id: partidoId,
  home,
  away,
  golesHome,
  golesAway,
  fecha: new Date().toISOString(),
  eventos: []
}, registro.cadena.ultimoHash);

registro.partidos.push(partido);
registro.cadena.ultimoHash = partido.huella;

integridad.verificarRegistro(registro);
fs.writeFileSync(archivo, JSON.stringify(registro, null, 2) + "\n");

console.log("Partido registrado correctamente.");
console.log("ID:", partido.id);
console.log("Huella SHA-256:", partido.huella);
console.log("Huella anterior:", partido.huellaAnterior);
