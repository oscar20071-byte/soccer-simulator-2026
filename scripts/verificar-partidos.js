const fs = require("fs");
const crypto = require("crypto");

const archivo = "data/partidos.json";

if (!fs.existsSync(archivo)) {
  console.error("No existe el registro de partidos.");
  process.exit(1);
}

const registro = JSON.parse(fs.readFileSync(archivo, "utf8"));
if (registro.version !== 1) {
  console.error("Versión del registro inválida.");
  process.exit(1);
}
if (!Array.isArray(registro.partidos)) {
  console.error("Formato de registro inválido.");
  process.exit(1);
}

const ids = new Set();
const { execFileSync } = require("child_process");

function verificarHistorialAnterior() {
  try {
    const anterior = execFileSync(
      "git",
      ["show", "HEAD:data/partidos.json"],
      { encoding: "utf8" }
    );

    const registroAnterior = JSON.parse(anterior);

    for (const partidoAnterior of registroAnterior.partidos) {
      const partidoActual = registro.partidos.find(
        partido => partido.id === partidoAnterior.id
      );

      if (
        !partidoActual ||
        JSON.stringify(partidoActual) !== JSON.stringify(partidoAnterior)
      ) {
        throw new Error(
          `Se modificó o eliminó un partido: ${partidoAnterior.id}`
        );
      }
    }
  } catch (error) {
    if (error.message.includes("Se modificó o eliminó")) {
      throw error;
    }

    console.log("No hay una versión anterior disponible para comparar.");
  }
}

verificarHistorialAnterior();

for (const partido of registro.partidos) {
  if (!partido.id || !partido.home || !partido.away) {
    console.error("Partido incompleto.");
    process.exit(1);
  }

  if (ids.has(partido.id)) {
    console.error(`ID duplicado: ${partido.id}`);
    process.exit(1);
  }

  ids.add(partido.id);

  if (
    !Number.isInteger(partido.golesHome) ||
    !Number.isInteger(partido.golesAway) ||
    partido.golesHome < 0 ||
    partido.golesAway < 0
  ) {
    console.error(`Resultado inválido: ${partido.id}`);
    process.exit(1);
  }

  const contenido = {
    id: partido.id,
    home: partido.home,
    away: partido.away,
    golesHome: partido.golesHome,
    golesAway: partido.golesAway,
    fecha: partido.fecha,
    eventos: partido.eventos || []
  };

  const huella = crypto
    .createHash("sha256")
    .update(JSON.stringify(contenido))
    .digest("hex");

  if (!partido.huella || partido.huella !== huella) {
    console.error(`¡Huella incorrecta! Partido: ${partido.id}`);
    process.exit(1);
  }
}

console.log(`Verificación correcta: ${ids.size} partidos.`);
