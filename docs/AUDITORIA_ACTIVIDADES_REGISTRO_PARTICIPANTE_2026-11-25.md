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


## Actualización de correcciones — 2026-11-25, segunda pasada

### Nombre confirmado por el responsable
El nombre definitivo en QA es exactamente **`Inscripción Adulto maayor evento 28 nov`**. Se conserva la doble “a” porque el responsable confirmó que así lo nombró intencionalmente. No normalizar ni corregir ortografía.

### Hallazgos adicionales corregidos en código QA
- Se encontró y eliminó una asignación suelta de `currentPersonBlocked` antes de su declaración en `activity-portal.js`. En módulos ES eso podía detener la inicialización del portal con un error de referencia.
- El menú rápido cargaba `mira-data.js` con una versión de caché distinta a la usada por `index.html` y `actividad.html`. Se unificó el identificador de versión para compartir una sola instancia del cliente.
- Se actualizó la navegación a `actividad.html` para forzar la nueva versión del portal.
- El botón Renombrar está presente y persiste mediante `MIRA_DATA.updateActivity`; se conserva la confirmación de respuesta de Neon antes de actualizar la interfaz.
- Se amplió la validación automatizada para ejecutar la suite completa del repositorio, no solo comprobaciones de sintaxis.

### Hallazgo de seguridad SQL pendiente de migración
En QA se detectó un overload heredado de `public_register_activity_participant_v2` con ocho argumentos que no recibe token de autorización. Su función permite crear asistencias con rol SECURITY DEFINER. También se detectó que la función interna no bloqueaba por sí sola a una persona inactiva y no actualizaba nombres/apellidos de personas existentes.

Se preparó `migrations/20261125_fix_public_participant_registration_integrity.sql` para:
- Actualizar nombres, apellidos, teléfono, InfoMIRA, Tiene la App InfoMIRA y tipo de participante a partir del formulario confirmado.
- No modificar campos personales que el formulario no captura.
- Rechazar en PostgreSQL las fichas inactivas, aunque se intente saltar la validación del navegador.
- Revocar ejecución directa de la función interna y del overload heredado sin token.
- Mantener ejecutable por el rol anónimo únicamente el wrapper de registro que recibe el token central.

**La migración está preparada, revisada estáticamente y NO ha sido ejecutada.** Debe aplicarse primero en QA, probar altas de persona nueva, actualización de persona existente, rechazo de persona inactiva y duplicado, y después considerar producción.

### Estado de cambios y protección
- No se modificó `main`.
- No se modificó Neon producción.
- No se ejecutó ninguna migración SQL en QA ni en producción.
- Se conserva la rama QA y el PR abierto.
- La promoción a producción permanece bloqueada hasta que la suite completa esté verde y se realicen pruebas funcionales en localhost.


### Verificación automatizada y estado de datos tras la segunda pasada
- GitHub Actions ejecutó la suite completa: **136 pruebas aprobadas, 0 fallidas**.
- La validación de sintaxis JavaScript terminó correctamente.
- Neon QA conserva el nombre exacto `Inscripción Adulto maayor evento 28 nov` y devuelve 19 asistencias, 19 personas relacionadas y 0 fichas sin nombres/apellidos.
- Neon producción permanece sin cambios: `Adulto mayor noviembre`, 36 asistencias y 36 personas relacionadas.
- La migración SQL descrita arriba sigue pendiente de ejecución en QA; por ello el bloqueo de persona inactiva está protegido en la interfaz, pero la defensa final del servidor quedará efectiva solo después de aplicar y probar esa migración.
- La validación automatizada es estática/estructural. Aún falta la prueba manual de navegador en localhost:8000 (PIN, alta nueva, actualización existente, duplicado, inactiva, renombrar, edición y Excel) antes de promoción.


## Rectificación de estado y segunda verificación de Neon — 2026-11-25, tercera pasada

Esta sección prevalece sobre las notas anteriores que indicaban que la migración SQL estaba pendiente. Se consultó directamente Neon QA después de la actualización del PR:

- La migración `20261125_fix_public_participant_registration_integrity.sql` **sí está aplicada en Neon QA**. La función interna `public_register_activity_participant` y el overload heredado de ocho argumentos de `public_register_activity_participant_v2` no tienen EXECUTE para `anonymous` ni `authenticated`. El wrapper de siete argumentos que recibe `p_access_token` tiene EXECUTE para `anonymous`.
- La función de PIN está habilitada en QA y producción. La definición verificada conserva 45 minutos de autorización y bloqueo de 15 minutos después de cinco intentos incorrectos. No se realizó un intento real de PIN en navegador.
- QA tiene 3 actividades, 21 asistencias y 594 personas. La actividad `Inscripción Adulto maayor evento 28 nov` tiene 19 asistencias y 19 relaciones persona-asistencia válidas; no hay personas huérfanas.
- En esas 19 fichas, 15 guardan el nombre completo en la columna `nombres` y dejan `apellidos` vacío; cuatro tienen nombres y apellidos separados. No son 15 fichas ausentes. Los datos de cédula y teléfono están presentes en las 19. Algunos valores InfoMIRA/App son NULL y deben mostrarse como desconocidos, no como “No”.
- Producción tiene 594 personas y la actividad `Adulto mayor noviembre` conserva 36 asistencias y 36 relaciones válidas. No se copiaron registros de QA a producción.

### Hallazgos adicionales del archivo de Actividades
- El archivo de QA filtraba la vista “Todas las actividades” a estado activo, ocultando carpetas canceladas y finalizadas. Se corrige para mostrar todos los estados en el archivo; el selector de inscripción sigue ofreciendo solo actividades activas.
- La tabla “Registro en vivo” recortaba la visualización a las primeras 10 filas. Se corrige para mostrar todas las filas cargadas, conservando el contador y el buscador.
- La separación automática de apellidos a partir de palabras del campo `nombres` no es fiable para nombres compuestos. Se corrige para conservar literalmente el nombre histórico completo cuando la columna `apellidos` está vacía, sin inventar una división.

### Límites de validación
- GitHub Actions: 136/136 pruebas aprobadas en el commit anterior a esta tercera pasada. Se deben volver a ejecutar después de estos cambios.
- La comprobación SQL confirma integridad de relaciones y privilegios; no sustituye el recorrido de navegador.
- Sigue pendiente una prueba funcional real en `http://localhost:8000` y en GitHub Pages para login, PIN correcto/incorrecto, alta nueva, actualización, duplicado, persona inactiva, renombrar, edición y descarga del Excel.
- El código de esta rama continúa sin fusionar. GitHub Pages continúa consumiendo el código de la rama publicada, no estas correcciones de QA.
