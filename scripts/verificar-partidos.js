const fs = require("fs");
const crypto = require("crypto");

const archivo = "data/partidos.json";

if (!fs.existsSync(archivo)) {
  console.error("No existe el registro de partidos.");
  process.exit(1);
}

const registro = JSON.parse(fs.readFileSync(archivo, "utf8"));

if (!Array.isArray(registro.partidos)) {
  console.error("Formato de registro inválido.");
  process.exit(1);
}

const ids = new Set();

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
