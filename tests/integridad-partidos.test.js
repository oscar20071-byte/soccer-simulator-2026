"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const integridad = require("../scripts/integridad-partidos");

function registroVacio() {
  return {
    version: 2,
    cadena: {
      algoritmo: "SHA-256",
      hashInicial: integridad.ROOT_HASH,
      ultimoHash: integridad.ROOT_HASH
    },
    partidos: []
  };
}

function agregar(registro, id) {
  const anterior = registro.cadena.ultimoHash;
  const partido = integridad.crearPartido({
    id,
    home: "Equipo A",
    away: "Equipo B",
    golesHome: 2,
    golesAway: 1,
    fecha: "2026-11-14T12:00:00.000Z",
    eventos: []
  }, anterior);
  registro.partidos.push(partido);
  registro.cadena.ultimoHash = partido.huella;
}

test("acepta un registro vacío y una cadena válida", () => {
  const registro = registroVacio();
  agregar(registro, "partido-1");
  agregar(registro, "partido-2");
  assert.equal(integridad.verificarRegistro(registro).cantidad, 2);
});

test("detecta cambios en un resultado", () => {
  const registro = registroVacio();
  agregar(registro, "partido-1");
  registro.partidos[0].golesHome = 9;
  assert.throws(() => integridad.verificarRegistro(registro), /Huella SHA-256 incorrecta/);
});

test("detecta ruptura o reordenamiento de la cadena", () => {
  const registro = registroVacio();
  agregar(registro, "partido-1");
  agregar(registro, "partido-2");
  registro.partidos.reverse();
  assert.throws(() => integridad.verificarRegistro(registro));
});

test("rechaza IDs duplicados", () => {
  const registro = registroVacio();
  agregar(registro, "partido-1");
  const duplicado = { ...registro.partidos[0] };
  registro.partidos.push(duplicado);
  assert.throws(() => integridad.verificarRegistro(registro), /ID duplicado/);
});

test("migra registros de versión 1 después de validar sus huellas", () => {
  const antiguo = {
    id: "partido-antiguo",
    home: "Equipo A",
    away: "Equipo B",
    golesHome: 1,
    golesAway: 0,
    fecha: "2026-11-13T12:00:00.000Z",
    eventos: []
  };
  antiguo.huella = integridad.huellaLegada(antiguo);
  const migrado = integridad.migrarRegistroLegado({ version: 1, partidos: [antiguo] });
  assert.equal(migrado.version, 2);
  assert.equal(integridad.verificarRegistro(migrado).cantidad, 1);
});
