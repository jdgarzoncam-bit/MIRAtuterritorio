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
| 5. Exportación y calidad | Columnas, límites, errores, calidad Personas/InfoMIRA y conciliación sin borrado | Implementado en QA compartida; migración aplicada y verificada, CI aprobado; pendiente prueba funcional con sesión real |
| 6. Interfaz y cierre | Escritorio/móvil, estados, navegación, regresión, documentación y entrega QA | Implementado en QA; 93 pruebas automatizadas aprobadas; listo para validación funcional del usuario |

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


## Bloque 4 — auditoría y permisos (2026-11-18)
- Auditoría de esquema QA: RLS habilitada en personas, personas_change_audit, audit_events y admin_audit_log.
- RLS de personas: SELECT requiere personas:view; INSERT requiere personas:create; UPDATE requiere personas:edit tanto en USING como WITH CHECK. La política de module_permissions permite escrituras solo a la cuenta administradora activa.
- audit_events: lectura mediante política que exige base_datos_general:view y permiso view del módulo de cada evento (salvo administrador activo); clientes authenticated no tienen INSERT/UPDATE/DELETE directos. list_audit_events es SECURITY INVOKER, por lo que conserva RLS; no se concede ejecución a anonymous.
- Funciones de trigger audit_row_change y audit_persona_changes tienen EXECUTE revocado a PUBLIC/anonymous/authenticated.
- Los cambios de user_profiles y module_permissions alimentan tanto admin_audit_log como audit_events mediante triggers distintos y destinos diferentes. No son duplicados idénticos: uno es auditoría administrativa específica y otro es transversal.
- Hallazgos de cobertura: evidencias_e14, testigo_archivos y testigos_publicos no tienen trigger de auditoría central en QA. Testigos está inactivo por decisión del proyecto; evidencias E14 debe revisarse con el módulo Testigos antes de reactivarlo. No se añadió auditoría a tablas inactivas en este bloque.
- La consulta actual de auditoría muestra 18 eventos; 9 no tienen actor_auth_user_id. Debe distinguirse operación SQL/administrativa de una acción de usuario; la interfaz ahora lo rotula como “Sistema / operación SQL” en vez de atribuirla a una persona.
- `app.js`: corregido el estado de error del historial. Si falla la RPC, ya no queda la tabla indefinidamente en “Consultando”; muestra error, conserva el control de reintento por filtros y evita respuestas fuera de orden.
- Se añadieron pruebas de regresión de UI/RLS/auditoría en `tests/role-capabilities.test.cjs`. CI del commit `51888537c15e915b3323b0f323aa731fe428ac58` estaba ejecutándose al registrar esta actualización.
- Pendiente de validación funcional: sesión de operador con permisos de Base de datos general y módulos, cuenta sin permisos, filtros de auditoría y denegación de escrituras directas; confirmar CI verde. No modificar datos de producción.


## Bloque 5 — avance técnico inicial (2026-11-18)
- Diagnóstico de solo lectura en Neon QA compartida: Personas 587 (523 activas, 64 archivadas); cédulas normalizadas duplicadas 0; teléfonos vacíos 33; barrios vacíos 587; indicador datos_pendientes inconsistente con teléfono/barrio 586; nombres/apellidos vacíos o espacios 583; teléfonos con formato atípico 2.
- InfoMIRA: 636 filas; 618 vinculadas y 18 sin vincular/sin documento; 213 sin barrio; 34 grupos de cédula repetida (68 filas involucradas); 0 cédulas discordantes entre fila vinculada y Persona. Los duplicados son hallazgos, no instrucciones de fusión.
- Asistencias: 3 filas (1 activa, 2 anuladas); 0 grupos duplicados por persona/actividad; 0 vínculos huérfanos a Persona o Actividad.
- Exportación existente usa RPC SECURITY DEFINER con permisos validados en servidor, pero no devolvía total real ni bandera de truncamiento; además la exportación de Personas no distinguía Activas/Archivadas/Todas y la búsqueda por documento no incluía de forma garantizada la cédula normalizada.
- Nueva migración `migrations/20261118_block5_export_quality.sql`: RPC de exportación devuelve `count`, `total_count`, `truncated`; orden determinista por fecha e id; búsqueda y filtro de cédula normalizada; estado de Personas; RPC `get_data_quality_summary()` SECURITY INVOKER con métricas agregadas y controles de permiso por módulo. No actualiza ni elimina registros.
- `mira-data.js` incorpora los parámetros de estado y el método de diagnóstico; `app.js` incorpora pantalla de diagnóstico y bloquea la descarga si el servidor informa truncamiento; `index.html` actualiza el cache-buster; se añadieron pruebas de regresión.
- La migración se ejecutó en la rama Neon aislada `br-polished-mode-b7a0k5jx`, derivada de QA compartida. Se verificaron firmas, permisos (sin PUBLIC/anonymous, authenticated autorizado), SECURITY INVOKER para diagnóstico, y conteos sin cambios: 587 Personas y 636 filas InfoMIRA.
- CI aprobado: run https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/44358047019, commit `c48168c6ce521b4dc267f911e25a1d2f1bef5b04`. Incluye 91 pruebas, 0 fallos.
- Migración aplicada en Neon QA compartida: `mira.export_dataset(text,text,text,text,integer,text)` y `mira.get_data_quality_summary()`. Permisos verificados: PUBLIC/anonymous sin EXECUTE; authenticated con EXECUTE; diagnóstico SECURITY INVOKER. RLS de Personas permanece habilitada.
- Conteos después de migración: Personas 587 (523 activas, 64 archivadas); InfoMIRA 636. Consultas no autenticadas a ambas RPC denegadas con SQLSTATE 42501.
- El usuario autorizó la migración a Neon QA compartida y fue aplicada el 2026-11-18. Se verificaron funciones, permisos y conservación de datos; producción no fue modificada.
- Pendiente de prueba funcional: sesión real, permisos por rol, exportaciones completas/filtradas, Excel, estados de Personas y comparación filas/total_count. Conciliación y correcciones de datos siguen fuera de alcance hasta aprobación específica.


## Bloque 6 — cierre técnico y entrega QA (2026-11-18)
- `app.js`: el diagnóstico tiene región accesible con etiqueta, foco y anuncio de cambios (`aria-live`).
- `style.css`: ajustes responsivos del espacio Base de datos general; acciones reacomodadas en móvil; tablas del diagnóstico legibles; foco visible para teclado; estados disabled distinguibles.
- `index.html`: cache-buster actualizado a `20261118-block6-closeout-1`.
- Se añadió `docs/QA-BASE-DATOS-GENERAL-BLOQUES-1-6.md` con matriz de pruebas de Bloques 1–6, pasos de ejecución local, controles de seguridad y criterios de cierre.
- CI final de código/plan: https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/44360464618 — 93 pruebas aprobadas, 0 fallos (91 previas + 2 de accesibilidad/responsive).
- CI del protocolo de pruebas: https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/44360538634 (pendiente al registrar este renglón).
- Bloques 5 y 6 están listos a nivel de implementación QA y pruebas automatizadas. No se declara completada la validación funcional de navegador: se ejecutará con la sesión QA del usuario, siguiendo el protocolo. No promover a producción sin autorización expresa.
