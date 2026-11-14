# Bot de estadísticas de Discord

Este bot registra únicamente métricas agregadas para una comunidad de Soccer Simulator 2026.

## Qué mide
- Mensajes enviados en canales de texto del servidor (solo cuenta; no lee ni guarda el contenido).
- Minutos en canales de voz visibles para el bot.
- Ranking por cantidad de mensajes, mostrando también minutos de voz.
- Consulta individual con `/actividad`.

## Privacidad
- No registra contenido de mensajes, adjuntos, enlaces, mensajes directos ni presencia/estado en línea.
- `/privacidad` explica los datos guardados.
- Cada miembro puede usar `/desactivar-estadisticas` y `/activar-estadisticas`. Desactivar detiene el registro futuro; las estadísticas anteriores permanecen. `/borrar-mis-estadisticas` elimina sus estadísticas históricas y desactiva el registro.
- Publica un aviso en las reglas del servidor antes de activar el bot. El propietario debe cumplir las reglas y requisitos de privacidad de Discord y las normas aplicables a su comunidad.
- Los minutos de voz se calculan al salir del canal y se asignan al día UTC de salida. Si el bot está desconectado, el cálculo de esa sesión puede ser impreciso.

## Configuración

1. Crea una aplicación y un bot en Discord Developer Portal.
2. Invítalo al servidor con los scopes `bot` y `applications.commands`, y permisos View Channels y Send Messages. Asegúrate de que pueda ver los canales de voz que quieras medir.
3. No habilites Message Content Intent: este bot no necesita leer el contenido de los mensajes. Usa los intents Guilds, GuildMessages y GuildVoiceStates.
4. En Supabase, ejecuta primero `backend/supabase/schema.sql` y luego `backend/supabase/discord_activity.sql`.
5. Crea un archivo de entorno basado en `.env.example` en el host privado donde ejecutarás el bot. Completa token, client ID, guild ID, URL/clave de Supabase y el UUID de la comunidad.
6. Configura `SUPABASE_SERVICE_ROLE_KEY` como secreto privado del host, nunca en GitHub Pages, en el navegador ni en este repositorio.
7. Ejecuta `npm install` y `npm start`.

Al iniciar, el bot registra sus comandos de servidor. En Discord estarán disponibles `/actividad`, `/ranking`, `/privacidad`, `/desactivar-estadisticas`, `/activar-estadisticas` y `/borrar-mis-estadisticas`.

## Límites
El bot debe mantenerse encendido en un host que admita procesos Node.js. GitHub Pages no puede alojarlo. Esta carpeta contiene el código, no una instalación ni un bot ya conectado. Una comunidad de Discord se vincula a una comunidad del portal mediante `COMMUNITY_ID`.
