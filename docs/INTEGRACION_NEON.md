# Integración Neon — MIRA TU TERRITORIO (estado verificado 2026-11-25)

## Fuente de verdad de producción

- Repositorio: https://github.com/jdgarzoncam-bit/MIRAtuterritorio
- Rama de código: `main`
- Neon project: `soft-bar-53270058` (my-first-project)
- Neon branch: `production` (`br-winter-night-b758ke2j`, rama por defecto)
- Base de datos: `neondb`
- Esquema de datos: `mira`

## Endpoints activos en el código de main

Los dos clientes usan el mismo endpoint de proyecto y región:

- Neon Auth: `https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth`
- Neon Data API: `https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1`

Archivos que los declaran:
- `mira-auth.js`: Auth URL y Data API URL para validación del perfil.
- `mira-data.js`: Data API URL para consultas y operaciones CRUD.
- `activity-portal.js` y `mira-quick-modules.js`: importan el cliente compartido `mira-data.js`; no deben declarar un endpoint alternativo.

No guardar contraseñas, DATABASE_URL, API keys, JWT ni PIN en el repositorio.

## Datos verificados en producción (2026-11-25)

Después de eliminar las dos actividades de prueba:
- `mira.actividades`: 1 fila, Adulto mayor noviembre.
- `mira.asistencias`: 36 filas, todas asociadas a Adulto mayor noviembre.
- `mira.personas`: 594 filas. Se conservaron; no se borraron fichas personales.

Las actividades de prueba eliminadas fueron Jornada y Jornada embellecimiento, junto con sus tres asistencias.

## Ramas Neon y sincronización

La rama `qa-role-capabilities-2026-11-10` no es una copia idéntica de producción:
- QA no contiene `mira.reportes_operativos`, que sí existe en producción.
- QA conserva 21 asistencias mientras producción tiene 36 después de la limpieza.
- Por tanto, no copiar datos QA sobre producción ni promover QA a producción sin comparar esquema, funciones, permisos, triggers y datos. Los ambientes deben sincronizarse mediante migraciones revisadas, no mediante sustitución indiscriminada de datos.

## Seguridad y permisos observados

- RLS está habilitado en las tablas de negocio.
- Las tablas `participant_access_attempts`, `participant_access_pin_config` y `participant_access_sessions` no tienen RLS habilitado; actualmente no conceden SELECT/INSERT/UPDATE/DELETE a los roles Data API `anonymous` ni `authenticated`. Revisar antes de conceder permisos.
- `mira.has_module_permission` bloquea explícitamente el módulo `testigos` y restringe InfoMIRA a consulta.
- La Data API no concede lectura anónima a `personas`, `actividades` ni `asistencias`.
- Los formularios públicos tienen permisos de inserción limitados por políticas RLS.

## Publicación GitHub Pages

Workflow: `.github/workflows/pages.yml`
URL del sitio: https://jdgarzoncam-bit.github.io/MIRAtuterritorio/

El commit `5c4ecad6adf4b4b71d398347dca44a5f3c493603` renovó la versión de caché de `app.js`. La validación de sintaxis fue correcta, pero GitHub Pages devolvió `Deployment failed, try again later` al crear/consultar el deployment. No declarar la publicación como exitosa hasta que Actions informe `success` y el sitio sirva la versión nueva.

## Procedimiento obligatorio antes de migrar

1. Confirmar proyecto y rama destino por ID, no solo por nombre.
2. Comparar tablas/columnas, funciones y firmas, triggers, constraints, índices, grants y políticas RLS.
3. Revisar conteos y relaciones de datos antes y después.
4. Ejecutar cambios de esquema en una rama de QA aislada.
5. Probar lectura/escritura por rol y flujos públicos con JWT anónimo.
6. Crear backup/snapshot y plan de reversión.
7. Promover únicamente migraciones aprobadas; nunca copiar datos de QA a producción por defecto.
8. Verificar GitHub Actions y smoke tests del sitio después de publicar.

## Fuentes de verdad

- Código de conexión: `mira-auth.js`, `mira-data.js`.
- Políticas y estado real: PostgreSQL en Neon `production`.
- Historial de despliegue: GitHub Actions, workflow `pages.yml`.
- Este documento es un registro operativo; no reemplaza las políticas activas ni autoriza ejecutar SQL.
