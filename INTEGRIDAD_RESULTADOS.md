# Integridad del historial de resultados

## Cómo funciona
- Cada partido contiene una huella SHA-256 calculada sobre sus datos canónicos y la huella del partido anterior.
- La cadena comienza con 64 ceros y cada nuevo partido enlaza con el hash anterior.
- El registro conserva el último hash en `cadena.ultimoHash`.
- El verificador comprueba campos, IDs duplicados, huellas, continuidad de la cadena y preservación del historial que ya existía en la rama base.
- Los registros de versión 1 se validan con el formato antiguo y se migran a versión 2 al registrar el siguiente partido.

## Pruebas
Ejecutar con Node.js 22:
```sh
node --test tests/integridad-partidos.test.js
node scripts/verificar-partidos.js
```

## Límites importantes
SHA-256 no es una firma digital ni autentica quién registró un resultado. Una persona con permiso para modificar el registro y recalcular todos los hashes podría reconstruir la cadena. La protección depende también de las reglas de rama, revisión de pull requests y controles de acceso de GitHub. Mantén protegida `main`; no publiques tokens ni secretos en el repositorio.

El workflow de registro crea un pull request, no publica directamente en `main`. El workflow de verificación se ejecuta en pull requests que cambien el registro o sus scripts.
