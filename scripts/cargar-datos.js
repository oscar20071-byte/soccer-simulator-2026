async function cargarDatosCompartidos() {
  try {
    const respuesta = await fetch(
      "./data/simulador.json",
      { cache: "no-store" }
    );

    if (!respuesta.ok) {
      throw new Error("No se pudieron cargar los datos.");
    }

    const datos = await respuesta.json();

    console.log("Datos compartidos cargados:", datos);

    return datos;
  } catch (error) {
    console.error("Error de conexión:", error);
    return null;
  }
}
