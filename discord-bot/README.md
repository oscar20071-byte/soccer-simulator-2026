# Bot de estadísticas multi-servidor de Discord

El bot puede atender muchos servidores con una sola instalación. Cada servidor se registra como una comunidad independiente en Supabase y sus estadísticas quedan separadas.

## Qué mide
- Cantidad de mensajes por día (no lee ni guarda el contenido).
- Minutos acumulados en canales de voz visibles para el bot.
- Ranking de actividad y consulta individual.

## Comandos
- `/configurar-servidor`: lo ejecuta un administrador para registrar su servidor.
- `/actividad`: consulta las estadísticas propias en ese servidor.
- `/ranking`: muestra el ranking de ese servidor.
- `/privacidad`: explica los datos registrados.
- `/desactivar-estadisticas` y `/activar-estadisticas`: controla el registro futuro.
- `/borrar-mis-estadisticas`: elimina el historial personal de ese servidor y desactiva el registro.

## Privacidad y separación
- No registra textos, archivos, enlaces, mensajes directos ni presencia en línea.
- La preferencia de privacidad se aplica por separado en cada servidor.
- Los datos se consultan usando el identificador interno de la comunidad asociada al servidor; el bot no mezcla rankings entre servidores.
- Publica un aviso de privacidad en cada servidor antes de activar el registro.
- Los minutos de voz se contabilizan al salir del canal y se asignan al día UTC de salida. Una desconexión del bot puede afectar la precisión de una sesión en curso.

## Instalación

1. Crea una aplicación y un bot en Discord Developer Portal.
2. Invítalo a los servidores con los scopes `bot` y `applications.commands`, y permisos para ver canales y enviar respuestas. Debe poder ver los canales de voz que se medirán.
3. Activa los intents Guilds, GuildMessages y GuildVoiceStates. No habilites Message Content Intent.
4. En Supabase SQL Editor, ejecuta en este orden:
   - `backend/supabase/schema.sql` (solo si aún no se había ejecutado).
   - `backend/supabase/discord_activity.sql` (solo si aún no se había ejecutado).
   - `backend/supabase/discord_multi_server.sql` (nueva migración).
5. En el host privado, configura `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` usando las variables de `.env.example`.
6. Mantén `SUPABASE_SERVICE_ROLE_KEY` como secreto privado del host. Nunca la publiques en GitHub, GitHub Pages, el navegador ni Discord.
7. Instala y ejecuta: `npm install` y `npm start`.
8. Invita el bot a cada servidor. Un administrador ejecuta `/configurar-servidor` una vez en cada servidor.

Los comandos se registran globalmente en Discord; su aparición puede tardar un poco en propagarse. Un servidor sin configurar no registra actividad.

## Alojamiento
El bot necesita un host que mantenga un proceso Node.js activo. GitHub Pages solo aloja la web y no puede ejecutar este bot.
