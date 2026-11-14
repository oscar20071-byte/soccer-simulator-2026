"use strict";

const crypto = require("crypto");

const ROOT_HASH = "0".repeat(64);

function contenidoCanonico(partido) {
  return {
    id: partido.id,
    home: partido.home,
    away: partido.away,
    golesHome: partido.golesHome,
    golesAway: partido.golesAway,
    fecha: partido.fecha,
    eventos: Array.isArray(partido.eventos) ? partido.eventos : []
  };
}

function huellaLegada(partido) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(contenidoCanonico(partido)))
    .digest("hex");
}

function calcularHuella(partido, huellaAnterior) {
  return crypto.createHash("sha256")
    .update(huellaAnterior + "\n" + JSON.stringify(contenidoCanonico(partido)))
    .digest("hex");
}

function validarCampos(partido) {
  if (!partido || typeof partido !== "object" ||
      typeof partido.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(partido.id) ||
      typeof partido.home !== "string" || !partido.home.trim() ||
      typeof partido.away !== "string" || !partido.away.trim() ||
      partido.home === partido.away ||
      !Number.isInteger(partido.golesHome) || partido.golesHome < 0 ||
      !Number.isInteger(partido.golesAway) || partido.golesAway < 0 ||
      typeof partido.fecha !== "string" || Number.isNaN(Date.parse(partido.fecha)) ||
      !Array.isArray(partido.eventos)) {
    throw new Error("Hay un partido con campos inválidos.");
  }
}

function verificarRegistro(registro) {
  if (!registro || !Array.isArray(registro.partidos)) {
    throw new Error("Formato de registro inválido.");
  }

  if (registro.version === 1) {
    const ids = new Set();
    for (const partido of registro.partidos) {
      validarCampos(partido);
      if (ids.has(partido.id)) throw new Error("ID duplicado: " + partido.id);
      ids.add(partido.id);
      if (partido.huella !== huellaLegada(partido)) {
        throw new Error("Huella SHA-256 legada incorrecta: " + partido.id);
      }
    }
    return { cantidad: ids.size, ultimoHash: null, version: 1 };
  }

  if (registro.version !== 2) throw new Error("Versión del registro no compatible.");
  if (!registro.cadena || registro.cadena.algoritmo !== "SHA-256" ||
      registro.cadena.hashInicial !== ROOT_HASH) {
    throw new Error("Metadatos de la cadena de integridad inválidos.");
  }

  const ids = new Set();
  let anterior = ROOT_HASH;
  for (const partido of registro.partidos) {
    validarCampos(partido);
    if (ids.has(partido.id)) throw new Error("ID duplicado: " + partido.id);
    ids.add(partido.id);
    if (partido.huellaAnterior !== anterior) {
      throw new Error("Cadena interrumpida antes del partido: " + partido.id);
    }
    const esperada = calcularHuella(partido, anterior);
    if (partido.huella !== esperada) {
      throw new Error("Huella SHA-256 incorrecta: " + partido.id);
    }
    anterior = esperada;
  }

  if (registro.cadena.ultimoHash !== anterior) {
    throw new Error("El último hash de la cadena no coincide.");
  }
  return { cantidad: ids.size, ultimoHash: anterior, version: 2 };
}

function migrarRegistroLegado(registro) {
  if (registro.version === 2) {
    verificarRegistro(registro);
    return registro;
  }
  if (registro.version !== 1) throw new Error("No se puede migrar esta versión del registro.");
  verificarRegistro(registro);

  let anterior = ROOT_HASH;
  const partidos = registro.partidos.map(original => {
    const partido = { ...original, eventos: original.eventos || [] };
    partido.huellaAnterior = anterior;
    partido.huella = calcularHuella(partido, anterior);
    anterior = partido.huella;
    return partido;
  });

  return {
    version: 2,
    cadena: {
      algoritmo: "SHA-256",
      hashInicial: ROOT_HASH,
      ultimoHash: anterior
    },
    partidos
  };
}

function crearPartido(datos, huellaAnterior) {
  const partido = {
    id: datos.id,
    home: datos.home,
    away: datos.away,
    golesHome: datos.golesHome,
    golesAway: datos.golesAway,
    fecha: datos.fecha,
    eventos: datos.eventos || [],
    huellaAnterior
  };
  validarCampos(partido);
  partido.huella = calcularHuella(partido, huellaAnterior);
  return partido;
}

module.exports = {
  ROOT_HASH,
  contenidoCanonico,
  huellaLegada,
  calcularHuella,
  verificarRegistro,
  migrarRegistroLegado,
  crearPartido
};
