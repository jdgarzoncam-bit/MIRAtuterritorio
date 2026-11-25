# Auditoría integral — Actividades y Registrar participante
Fecha: 2026-11-25
Alcance: rama QA `preview/neon-qa-control-admin` y entorno Neon QA `qa-role-capabilities-2026-11-10`. No modificar `main` ni producción en esta fase.

## Decisiones que se conservan
- Mantener el enlace original **Registrar participante** y su ruta `actividad.html`.
- Mantener el módulo interno **Actividades** dentro del Centro de Operaciones.
- No crear un segundo PIN: reutilizar la autorización central compartida.
- PIN central con sesión de 45 minutos y bloqueo tras 5 intentos fallidos durante 15 minutos.
- En Registro participante: seleccionar actividad antes de consultar cédula; recuperar ficha; comprobar duplicados; bloquear personas inactivas; exigir consentimiento.
- Mantener los campos **Inscrito a InfoMIRA** y **Tiene la App InfoMIRA**.
- No modificar `main`, no promover QA a producción, no ejecutar migraciones ni eliminar ramas sin aprobación.
- Testigos permanece bloqueado por renovación.

## Hallazgos confirmados

### 1. Causa de la lista parcial de participantes
En Neon producción, Data API tenía `db_max_rows=100`. El `app.js` desplegado pedía páginas de 1.000 y detenía la paginación cuando la respuesta era menor a 1.000. Por tanto, solo cargaba las primeras 100 fichas, aunque las asistencias estuvieran relacionadas correctamente.

En producción se verificó:
- Actividad: `Adulto mayor noviembre`.
- Asistencias: 36.
- Las 36 asistencias tienen `persona_id` válido y las 36 personas existen.
- No hay asistencias huérfanas.
- Las 594 fichas personales permanecen en la tabla.

Esto explica los nombres/cédulas parciales del Excel y los valores falsos de “No” que aparecían cuando no se había recuperado la ficha.

### 2. Diferencia entre producción y QA
- Producción Neon: 36 asistencias en la actividad, nombre `Adulto mayor noviembre`.
- QA Neon: 19 asistencias en la actividad renombrada y 21 asistencias totales en la rama.
- QA tiene el cambio de nombre auditado el 2026-11-25 a las 18:13:32 UTC, con `changed_fields=['nombre']`.
- El título que está guardado literalmente en QA es `Inscripción Adulto maayor evento 28 nov` (la palabra “maayor” tiene doble “a”).
- Producción no tiene ese cambio: su `updated_at` coincide con la creación y no hay evento de renombrado en su auditoría.

El usuario estaba viendo GitHub Pages/main con Neon producción, mientras que el cambio de nombre y otras mejoras existían solo en la rama de QA. Esa separación explica la regresión aparente. No copiar el nombre ni los datos a producción sin aprobación.

### 3. Cambios preparados en esta rama QA
- El módulo obtiene primero los IDs de persona asociados a las asistencias y consulta esas fichas mediante `listPeopleByIds`, en vez de descargar las 594 personas para resolver 36 registros.
- `listPeopleByIds` consulta en lotes de hasta 100, respetando el límite duro de Neon Data API.
- La paginación de actividades/asistencias usa páginas de 100.
- Si faltan fichas asociadas, el módulo muestra una advertencia cuantificada en lugar de ocultar silenciosamente el problema.
- La carpeta muestra Persona, Cédula, Teléfono, Inscrito a InfoMIRA, Tiene la App InfoMIRA, Tipo de participante, Fecha y Acciones.
- Excel incluye también Tipo de participante y ya no convierte una ficha no recuperada en “No” para InfoMIRA.
- Se conserva el botón **Renombrar** en la carpeta y se usa `updateActivity` con confirmación de Neon.
- Registro participante bloquea visualmente personas inactivas, conserva la comprobación de duplicados y muestra correctamente el estado de la ficha.
- Se aclara el texto de privacidad: la consulta de ficha se hace después de validar el PIN central.

### 4. Enlace Registro participante
- `mira-quick-modules.js` mantiene una única navegación al archivo `actividad.html`.
- `actividad.html` carga `activity-portal.js`.
- El portal reutiliza el token de `sessionStorage` emitido por el PIN central; no pide un PIN adicional.
- `mira-data.js` en QA apunta al endpoint Neon QA `ep-mute-grass-b7qan4n6`, no al endpoint de producción.
- Las RPC de QA verificadas son `public_activity_options_v2`, `public_lookup_participant`, `public_check_activity_participant`, `public_register_activity_participant_v2` y `public_verify_participant_pin`.
- La consulta de persona y la comprobación de duplicado validan que el token corresponda al actor y no esté vencido.
- El registro exige consentimiento y el servidor rechaza fichas inactivas.

### 5. Configuración QA
Neon Auth QA ya tenía como trusted origins GitHub Pages, `http://localhost:8000` y `http://127.0.0.1:8000`. Se alineó la configuración CORS de la Data API QA con esos mismos orígenes y se fijó `db_max_rows=100`. Se verificó que el esquema expuesto sigue siendo `mira`, el rol anónimo `anonymous` y el modo OpenAPI `disabled`.

## Pendiente antes de producción
1. Probar en localhost:8000 el menú, el PIN central, consulta de ficha, duplicados, persona inactiva, guardar asistencia y volver a módulos.
2. Confirmar que los 19 registros de QA aparecen completos y que el Excel contiene las mismas 19 filas con los campos correctos.
3. Validar el botón Renombrar y confirmar el texto definitivo del nombre (QA actualmente contiene el posible error tipográfico “maayor”).
4. Revisar una migración SQL de la RPC de registro: cuando una persona ya existe, el bloque de actualización no persiste nombres/apellidos corregidos; además, la política actual de actualización de `info_mira` conserva el valor previo si no es NULL. No se ejecuta esa migración sin autorización.
5. Solo después de aprobar QA, planear sincronización controlada de código y migraciones entre QA y producción. Nunca copiar datos de prueba de QA sobre producción.

## Estado de cambios
- Esta rama es exclusivamente QA.
- No se modificó `main`.
- No se modificó la base de datos de producción.
- No se ejecutaron migraciones SQL.
- No se borraron personas ni actividades adicionales.
