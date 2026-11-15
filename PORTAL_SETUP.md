# Portal privado y comunidades · Soccer Simulator 2026

Este repositorio es **oscar20071-byte/soccer-simulator-2026**. Estos archivos pertenecen únicamente a este proyecto.

## Estado real

La aplicación actual es estática y guarda el simulador en el navegador mediante `localStorage`. GitHub Pages puede publicar la interfaz, pero no ofrece por sí solo cuentas privadas, sesiones seguras ni una base de datos compartida.

La base preparada aquí usa **Supabase** para autenticación y datos compartidos. La clave pública `anon/publishable` puede configurarse en el navegador con las políticas RLS activas. **Nunca** colocar `service_role`, contraseñas de base de datos ni secretos en `index.html`, archivos JavaScript o GitHub Pages.

## Preparar el backend

1. Crear un proyecto Supabase propio.
2. Abrir **SQL Editor** en Supabase.
3. Copiar y ejecutar el contenido de `backend/supabase/schema.sql`.
4. En **Authentication → Providers → Email**, mantener habilitado Email/Password. En los ajustes de autenticación, desactivar **Confirm email**: el portal utiliza un identificador interno no enrutable, no una dirección real. No se enviarán correos de confirmación ni habrá recuperación por correo.
5. En **Project Settings → API Keys**, copiar el Project URL y la clave publicable (`sb_publishable_...`) o la clave pública heredada `anon`.
6. La interfaz podrá conectarse cuando se añadan esos dos valores de configuración. No compartir claves secretas en el chat ni subirlas al repositorio.

## Modelo de permisos

- **owner**: propietario de la comunidad.
- **admin**: administra la comunidad y sus invitaciones.
- **moderator**: puede publicar el estado del simulador.
- La gestión de altas/bajas de miembros queda reservada al propietario en esta primera versión; así se evita que un administrador se eleve permisos o quite al propietario.
- **member**: puede consultar la comunidad.
- Cada comunidad tiene un estado de simulación independiente.
- La entrada se realiza mediante invitaciones con caducidad y límite de usos.
- Las políticas Row Level Security (RLS) controlan el acceso en la base de datos; ocultar botones en la interfaz no es una medida de seguridad.

## Importante antes de activar

El esquema SQL es la base del backend, no una integración terminada de la interfaz. Hasta conectar y probar el proyecto Supabase, el simulador seguirá funcionando en modo local. No introduzcas datos privados o reales en un portal que todavía no esté conectado al backend.

## Funciones del simulador ya presentes en la interfaz

La versión actual ya contiene páginas de alineaciones, lesiones y sanciones, estadísticas, premios, estadios, historial, ajustes de simulación, tácticas y respaldos. El trabajo siguiente debe integrar esas funciones con el estado de cada comunidad, no duplicarlas ni reemplazarlas.

## Estadísticas de actividad de Discord

Se incluye un bot opcional en `discord-bot/` y una migración SQL en `backend/supabase/discord_activity.sql`. El bot registra cantidades de mensajes y minutos en voz, sin guardar el contenido de los mensajes. Ofrece los comandos `/actividad`, `/ranking`, `/privacidad`, `/desactivar-estadisticas` y `/activar-estadisticas`.

Para activarlo, ejecuta primero el esquema principal y después la migración de Discord; configura y aloja el bot Node.js por separado usando las instrucciones de `discord-bot/README.md`. El token de Discord y la clave `service_role` de Supabase deben permanecer como secretos en el host del bot. GitHub Pages no puede ejecutar el bot. Informa a los miembros antes de habilitar el registro y respeta sus opciones de privacidad.

El código queda preparado, pero no estará conectado hasta que el administrador cree la aplicación de Discord, configure los secretos y ejecute el bot en un host privado.


## Registro y creación de comunidades

Se añadió `portal.html` como primera pantalla de autenticación y gestión de comunidades.

1. En Supabase, confirma que **Authentication → Providers → Email** esté habilitado.
2. En Supabase → Project Settings → API Keys, copia la **Publishable key** (normalmente empieza por `sb_publishable_`). También puede usarse la clave pública heredada `anon`.
3. Abre `scripts/supabase-config.js` y reemplaza únicamente `PEGA_AQUI_TU_PROJECT_URL` y `PEGA_AQUI_TU_PUBLISHABLE_KEY`.
4. Publica los cambios y abre `/portal.html`.
5. Crea una cuenta con un nombre de usuario único (3–20 caracteres: letras minúsculas, números y guion bajo) y una contraseña de al menos 8 caracteres. El portal convierte internamente el usuario en un identificador técnico `@accounts.ss26.invalid`; no es una dirección real ni se utiliza para enviar mensajes.
6. Crea una comunidad. El portal crea el perfil, registra la comunidad y el trigger SQL añade automáticamente al creador como `owner` e inicializa su estado.
7. El UUID de la comunidad aparece en pantalla y se puede usar como `COMMUNITY_ID` en el host privado del bot.

El acceso visible es únicamente con nombre de usuario y contraseña. No se solicita correo y no existe recuperación de contraseña en esta versión. Si alguien pierde su contraseña, no podrá recuperar esa cuenta. La clave Publishable/anon está diseñada para uso público con RLS activado. **No introducir jamás `sb_secret_`, `service_role`, tokens ni contraseñas en el archivo de configuración del navegador o en GitHub.**

La pantalla nueva es una primera integración de autenticación y comunidades; todavía no sincroniza automáticamente el estado completo del simulador (clubes, jugadores, partidos) con `community_state`. Esa integración queda como siguiente fase.
