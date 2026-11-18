# MIRA TU TERRITORIO — Plan de trabajo de Base de datos general
**Fecha de control:** 2026-11-18  
**Rama de código:** `preview/neon-qa-control-admin`  
**Rama Neon QA compartida:** `br-wild-surf-b74rsbpz`  
**Regla:** no intervenir `main` ni producción sin autorización expresa. Las migraciones se ensayan primero en una rama Neon aislada y solo pasan a QA compartida con autorización.

## Objetivo
Completar la funcionalidad de Base de datos general sin reconstruir el módulo ni alterar o perder registros, geometrías o relaciones con otros módulos.

## Bloques de intervención

| Bloque | Alcance | Estado |
|---|---|---|
| 1. Integridad de Personas | Esquema, normalización de cédula, cliente de altas/ediciones, confirmación de escritura, unicidad y concurrencia | Implementación y pruebas técnicas en QA; falta validación funcional con sesión real |
| 2. Consulta y paginación | Paginación completa de pendientes, filtros de servidor, estados de carga/error/vacío | Implementado en QA; CI aprobado; pendiente validación funcional con sesión real |
| 3. Edición y gestión de fichas | Formularios unificados, validación, detalle, archivado y recuperación controlada | Pendiente |
| 4. Auditoría y permisos | Roles, RLS/API directa, cobertura de auditoría y minimización de datos | Pendiente |
| 5. Exportación y calidad | Columnas, límites, errores, calidad Personas/InfoMIRA y conciliación sin borrado | Pendiente |
| 6. Interfaz y cierre | Escritorio/móvil, estados, navegación, regresión, documentación y entrega QA | Pendiente |

## Bloque 1 — criterios de aceptación
1. La tabla mantiene cédula original y cédula normalizada consistente.
2. PostgreSQL normaliza en cada INSERT/UPDATE, incluso si la operación no viene del formulario.
3. La aplicación exige exactamente una fila devuelta para confirmar alta o edición.
4. Cédulas sin dígitos se rechazan y las cédulas duplicadas se rechazan mediante la restricción UNIQUE.
5. Las escrituras concurrentes quedan protegidas por el índice/constraint UNIQUE de PostgreSQL.
6. Los 587 registros existentes permanecen intactos y consistentes.
7. RLS, permisos, auditoría y demás columnas de Personas permanecen operativos.

## Evidencia inicial
- Personas en QA: 587.
- Cédulas normalizadas vacías: 0.
- Cédulas con diferencia frente a los dígitos de `cedula`: 0.
- Documentos normalizados distintos: 587.
- La tabla ya tenía `personas_cedula_unica`; la migración conserva esa restricción.
- La tabla tiene auditoría central y auditoría específica. Ambas se mantienen porque registran en destinos distintos.

## Intervención en curso
- Rama Neon aislada: `qa-personas-integrity-2026-11-18` (`br-autumn-math-b7vc7hc7`), derivada de QA compartida.
- Migración aplicada primero en rama aislada y posteriormente en QA compartida `br-wild-surf-b74rsbpz` con autorización expresa.
- Verificación QA: 587 personas, 0 cédulas nulas/vacías/inconsistentes, 587 documentos normalizados distintos; trigger, NOT NULL, CHECK validado, UNIQUE y RLS activos.
- Prueba SQL: alta, búsqueda con/sin puntuación, actualización de cédula y teléfono, reconsulta de persistencia y limpieza del registro sintético.
- Cliente `mira-data.js`: altas y ediciones requieren exactamente una fila devuelta; edición valida ID y rechaza cédula sin dígitos.
- CI del commit `4d51c6bd83ab04dda7aa46e19a71ffaee1294dd1`: 87 pruebas aprobadas, 0 fallos.
- Falta validar desde navegador con sesión real alta, búsqueda y edición. No cerrar el bloque hasta esa comprobación.

## Protección de datos
No ejecutar depuración masiva, borrados, merges de personas ni conciliaciones automáticas de InfoMIRA dentro de este bloque. Cualquier registro dudoso se conserva para revisión posterior.

## Bloque 2 — avance técnico (2026-11-18)
- La bandeja de pendientes ya no carga las primeras 1.000 personas para filtrar en el navegador. Usa listPendingPeople con filtro OR en Neon y páginas de 25 registros (consulta 26 para detectar siguiente página).
- El filtro servidor considera datos_pendientes=true, teléfono nulo/vacío o barrio nulo/vacío. En QA, la comparación con el criterio anterior basado en btrim arrojó 587 pendientes en ambos métodos y 0 casos de teléfono/barrio compuesto solo por espacios que el filtro nuevo omitiera.
- La búsqueda del explorador de Personas incluye cedula_normalizada y añade comparación exacta por dígitos al buscar un documento con o sin puntuación.
- La paginación usa orden secundario por id para evitar resultados inestables cuando varias filas comparten timestamp.
- La bandeja y el explorador muestran carga, error y estado vacío; las respuestas antiguas se descartan mediante versión de solicitud.
- CI: 87 pruebas aprobadas, 0 fallos en el commit 4d51c6bd83ab04dda7aa46e19a71ffaee1294dd1.
- Pendiente: validación funcional con sesión y permisos reales. No se ha modificado main ni producción.

## Bloque 3 — avance técnico QA (2026-11-18)
- `mira-data.js`: se añade `getPersonById(id)` con verificación de ficha única; `listExplorerRows` filtra Personas por activas, archivadas o todas; `archivePerson` y `restorePerson` aplican cambios lógicos mediante `updatePerson` y exigen confirmación de una fila.
- `app.js`: el explorador de Personas permite seleccionar estado Activas/Archivadas/Todas, consultar el detalle básico de una ficha, archivar y recuperar. La bandeja de pendientes conserva su formulario de edición.
- Archivado no ejecuta DELETE y no elimina relaciones ni datos; actualiza `activo`.
- RLS de QA se verificó en PostgreSQL: SELECT exige `personas:view`; UPDATE exige `personas:edit` tanto en USING como en WITH CHECK. No se alteraron políticas ni se aplicaron migraciones.
- CI del commit `c8727e89326eb87b2fc22dacd5541f7693816daf`: sintaxis JavaScript y pruebas de seguridad aprobadas. Run: https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/44333614796
- Pendiente validación real de navegador: detalle, edición desde pendientes, archivado, recuperación, persistencia tras refresco y denegación a cuentas sin `personas:edit`. El bloque no se declara cerrado.
