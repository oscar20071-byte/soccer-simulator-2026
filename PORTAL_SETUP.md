# Portal privado y comunidades · Soccer Simulator 2026

Este repositorio es **oscar20071-byte/soccer-simulator-2026**. Estos archivos pertenecen únicamente a este proyecto.

## Estado real

La aplicación actual es estática y guarda el simulador en el navegador mediante `localStorage`. GitHub Pages puede publicar la interfaz, pero no ofrece por sí solo cuentas privadas, sesiones seguras ni una base de datos compartida.

La base preparada aquí usa **Supabase** para autenticación y datos compartidos. La clave pública `anon/publishable` puede configurarse en el navegador con las políticas RLS activas. **Nunca** colocar `service_role`, contraseñas de base de datos ni secretos en `index.html`, archivos JavaScript o GitHub Pages.

## Preparar el backend

1. Crear un proyecto Supabase propio.
2. Abrir **SQL Editor** en Supabase.
3. Copiar y ejecutar el contenido de `backend/supabase/schema.sql`.
4. En **Authentication → Providers**, habilitar el proveedor de correo que se vaya a usar y revisar los ajustes de confirmación.
5. En **Project Settings → API**, copiar el Project URL y la clave publicable (o anon key heredada).
6. La interfaz podrá conectarse cuando se añadan esos dos valores de configuración. No compartir claves secretas en el chat ni subirlas al repositorio.

## Modelo de permisos

- **owner**: propietario de la comunidad.
- **admin**: administra comunidad y miembros.
- **moderator**: puede publicar el estado del simulador.
- **member**: puede consultar la comunidad.
- Cada comunidad tiene un estado de simulación independiente.
- La entrada se realiza mediante invitaciones con caducidad y límite de usos.
- Las políticas Row Level Security (RLS) controlan el acceso en la base de datos; ocultar botones en la interfaz no es una medida de seguridad.

## Importante antes de activar

El esquema SQL es la base del backend, no una integración terminada de la interfaz. Hasta conectar y probar el proyecto Supabase, el simulador seguirá funcionando en modo local. No introduzcas datos privados o reales en un portal que todavía no esté conectado al backend.

## Funciones del simulador ya presentes en la interfaz

La versión actual ya contiene páginas de alineaciones, lesiones y sanciones, estadísticas, premios, estadios, historial, ajustes de simulación, tácticas y respaldos. El trabajo siguiente debe integrar esas funciones con el estado de cada comunidad, no duplicarlas ni reemplazarlas.
