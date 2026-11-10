# Auditoría transversal de MIRA TU TERRITORIO
**Corte:** 10 de noviembre de 2026  
**Repositorio:** `jdgarzoncam-bit/MIRAtuterritorio`  
**Rama revisada:** `feat/landing-reportes-testigos-e14`  
**Base de datos:** Neon `soft-bar-53270058` · `production` · `neondb`

## 1. Resumen ejecutivo

La revisión confirma una base de seguridad razonablemente estructurada: las 16 tablas del esquema `mira` tienen RLS habilitada, no hay SELECT anónimo en esas tablas, las funciones privilegiadas revisadas fijan `search_path`, y el historial administrativo ya no permite escritura directa al rol `authenticated`. El cierre temporal de Testigos/E-14 también quedó aplicado en producción el 10 de noviembre de 2026.

Sin embargo, la plataforma todavía no está lista para integración y publicación. Se encontraron **tres errores funcionales prioritarios** y varios riesgos de coherencia entre interfaz, permisos y datos:

1. Las altas de personas desde el cliente no persisten `cedula_normalizada`, aunque las búsquedas posteriores consultan precisamente ese campo.
2. El portal de Actividades permite seleccionar actividades finalizadas; solo excluye las canceladas.
3. Los reportes del formulario operativo se insertan en `mira.reportes_operativos`, pero no se encontró una bandeja que consulte esa tabla. La bandeja existente de reportes ciudadanos trabaja con otra tabla y está asociada al permiso Concejal.

También se identificaron inconsistencias en permisos Reportes/PQRS, datos repetidos en el directorio InfoMIRA, controles limitados contra automatización de formularios públicos y asuntos de auditoría, sesión y privacidad que requieren decisiones.

**Alcance:** este documento registra hallazgos del código, RLS, ACL, funciones, triggers, esquema y datos productivos. No ejecuta depuración de datos ni cambios adicionales de producción. Los casos que necesitan prueba visual o confirmación del flujo real están marcados como riesgos, no como errores demostrados.

## 2. Controles que sí están funcionando

| Control | Resultado comprobado |
|---|---|
| RLS en tablas de `mira` | 16 de 16 tablas base con RLS habilitada |
| Lectura anónima | Ninguna tabla de `mira` concede SELECT a `anonymous` |
| Testigos en catálogo | `active=false` en producción |
| Permisos de Testigos | `has_module_permission` los deniega incluso al administrador principal |
| Inserción pública de Testigos | INSERT anónimo revocado; política `witnesses_public_insert` eliminada |
| Conservación de datos Testigos/E-14 | 0 filas en ambas tablas; no se eliminó información |
| Actividades / Control Administrativo | Administrador conserva acceso |
| Módulos inactivos / acciones inválidas | Logística inactiva y acciones no reconocidas se deniegan |
| Historial administrativo | `admin_audit_log` es de solo lectura para el rol autenticado; escritura directa no concedida |
| Funciones privilegiadas | Las funciones `SECURITY DEFINER` revisadas fijan `search_path` |
| Integridad de asistencia | FK a persona y actividad; asistencia única por persona/actividad |
| Integridad actual de personas | 586 filas; 0 cédulas normalizadas ausentes; 0 desajustes; 0 cédulas normalizadas duplicadas |

Las inserciones anónimas que permanecen corresponden a los formularios que están diseñados para recepción pública: PQRS, reportes ciudadanos y reportes operativos. Están limitadas por validaciones de longitud y valores permitidos en PostgreSQL; no se encontró lectura anónima.

## 3. Hallazgos prioritarios

### P1 — Alta de personas: no se guarda el identificador normalizado
**Estado:** error de implementación confirmado; riesgo futuro sobre altas nuevas.

En `mira-data.js`, `listPeople({cedula})` busca por `cedula_normalizada`. En cambio, `createPerson()` y `updatePerson()` eliminan ese campo del payload y solo envían `cedula`. El esquema no tiene un trigger que complete automáticamente `cedula_normalizada`; la columna permite NULL y la unicidad está aplicada sobre esa columna.

**Impacto:** una persona nueva puede quedar sin identificador normalizado y no ser encontrada por una búsqueda posterior de cédula. La restricción UNIQUE no evita múltiples NULL, por lo que puede haber duplicados de personas nuevas. El conjunto productivo actual está sano (586/586 normalizadas), pero eso no elimina el defecto del código.

**Corrección recomendada:** normalizar la cédula en cliente y, como regla definitiva, en PostgreSQL con un trigger `BEFORE INSERT OR UPDATE` que genere solo dígitos. Después validar registros repetidos y considerar `NOT NULL`. Probar altas, edición, búsqueda y concurrencia antes de aplicar a producción.

### P1 — Registro de asistencia: se permiten actividades finalizadas
**Estado:** error funcional confirmado.

`activity-portal.js` filtra actividades con `estado !== 'cancelada'`; también acepta una actividad siempre que no esté cancelada. Por tanto, permite actividades `finalizada` y otros estados no activos.

En producción hay tres actividades: una cancelada y dos finalizadas. Las finalizadas tienen asistencias registradas. El portal puede seguir ofreciéndolas como opción para nuevos registros.

**Impacto:** una persona puede quedar registrada en una jornada que ya terminó o no debería recibir más asistencias.

**Corrección recomendada:** mostrar y aceptar exclusivamente `estado='activa'`; al enviar, volver a validar la actividad. Reforzar en PostgreSQL con un trigger o regla transaccional que impida insertar o cambiar una asistencia cuando la actividad no esté activa. No borrar las asistencias históricas existentes.

### P1 — Reportes operativos: no se encontró una bandeja de gestión
**Estado:** brecha funcional confirmada en el código revisado.

El formulario `reporte-publico.js` inserta en `mira.reportes_operativos`. `mira-data.js` ofrece `listOperationalReports()`, pero la revisión no encontró una llamada desde la interfaz interna. La tabla solo concede SELECT a `authenticated` mediante `reportes:view`; no tiene políticas/grants de UPDATE para que un operador actualice el estado. La tabla tiene estados `recibido`, `en_revision` y `cerrado`.

Existe otra tabla, `mira.reportes_ciudadanos`, y una bandeja visual en `reportes.js`; esa pantalla consulta `reportes_ciudadanos` y está integrada al módulo Concejal con permisos `concejal:view/edit`. No consulta `reportes_operativos`.

**Impacto:** el formulario puede recibir reportes sin que el equipo tenga una pantalla para consultarlos y darles curso. Los dos flujos usan el mismo concepto de “reportes ciudadanos”, pero almacenan datos distintos.

**Decisión necesaria:** definir si los dos formularios tienen propósitos diferentes o si debe existir una sola fuente oficial. Luego crear la bandeja y las políticas por acción que correspondan. No fusionar tablas sin analizar la información y el flujo institucional.

### P1 — Permisos Reportes y PQRS no reflejan con claridad las pantallas reales
**Estado:** inconsistencia confirmada entre matriz, rutas y RLS.

- La matriz administrativa presenta `reportes:view`, pero `MODULE_TARGETS` no tiene una ruta de menú para el módulo `reportes`.
- La bandeja encontrada de reportes ciudadanos está dentro de Concejal y verifica `concejal:view/edit`, no `reportes:view/edit`.
- La matriz muestra `pqrs:view`, pero la bandeja de administración de PQRS solo se muestra a la cuenta administradora principal. Además, la política SELECT de PQRS limita la lectura al remitente o al administrador; el permiso `pqrs:view` no da acceso a las solicitudes de otras personas.

**Impacto:** un usuario puede recibir un permiso en la matriz que no desbloquea una tarea real, o la interfaz puede sugerir capacidad de consulta que la política RLS no concede.

**Corrección recomendada:** definir una relación explícita entre permiso, tabla, acción y pantalla. Ocultar en la matriz permisos todavía no implementados o implementar sus rutas y políticas antes de concederlos.

## 4. Calidad e integridad de datos

### P2 — Directorio InfoMIRA: repetición y registros sin cédula
En producción, `mira.infomira_red` tiene 636 filas:
- 34 grupos de cédula normalizada repetida; cada grupo aparece dos veces.
- Los 34 grupos repetidos apuntan a una sola persona relacionada; no se detectaron grupos que relacionen una misma cédula con más de una persona.
- 18 filas no tienen cédula ni vínculo a `personas`.
- No hay referencias rotas a personas.
- Las 586 filas de `personas` mantienen cédula normalizada completa, coincidente con la cédula en dígitos y única.

**Impacto:** consultas, conteos y resultados del directorio pueden contar repetido a alguien o dejar 18 registros sin asociación.

**Corrección recomendada:** reconciliar contra el archivo/lote de origen y la ficha central. Determinar si las 34 repeticiones son duplicados de importación legítimos; definir tratamiento para las 18 filas sin cédula. No eliminar filas automáticamente.

### P2 — Actividad y datos relacionados
En producción hay 3 actividades, 3 asistencias, 1 actividad de Concejal y 2 compromisos. La FK de asistencias usa `ON DELETE RESTRICT`, lo que evita borrar personas o actividades referenciadas. La unicidad persona/actividad evita duplicar asistencia a una misma actividad. Son protecciones útiles; deben conservarse en las pruebas de CRUD.

## 5. Formularios públicos y resistencia al abuso

Los formularios públicos de PQRS y reportes ciudadanos/operativos aceptan inserciones anónimas. PostgreSQL valida longitud, tipos y estados; eso reduce datos mal formados, pero no evita por sí solo automatización o envíos masivos.

- El formulario operativo tiene un campo honeypot y confirmación de privacidad en el cliente. Un control solo del lado del navegador puede omitirse si se llama directamente a la API.
- No se encontró CAPTCHA/Turnstile ni rate limiting del lado servidor en los flujos revisados.
- En PQRS y reportes ciudadanos no se encontró honeypot ni un límite de frecuencia implementado en el cliente.
- Las tablas públicas de PQRS, reportes ciudadanos y reportes operativos tenían 0 registros al momento de la consulta; no se observó evidencia de spam en sus filas.

**Prioridad:** agregar control de frecuencia del lado servidor, protección contra automatización y trazabilidad de origen sin impedir el acceso legítimo de la ciudadanía. Evitar confiar exclusivamente en validaciones del navegador.

## 6. Auditoría, autenticación y gestión de sesiones

### P2 — Cambios al catálogo de módulos no quedan auditados
Los triggers de auditoría cubren perfiles y permisos, pero no existe trigger sobre `mira.module_catalog`. Activar/desactivar un módulo o cambiar sus atributos no genera evento en `admin_audit_log`.

**Impacto:** los cambios que afectan permisos globales no tendrían la misma trazabilidad que los cambios de usuarios y permisos.

**Recomendación:** auditar UPDATE/INSERT/DELETE del catálogo con actor, módulo y valores anteriores/nuevos. No añadir escritura directa del rol autenticado al historial.

### P2 — Sesiones tras cambio de contraseña
La configuración Neon Auth indica `revoke_sessions_on_password_reset=false`. Un restablecimiento de contraseña no revoca automáticamente las sesiones anteriores.

**Impacto:** si una sesión fue robada, cambiar contraseña por sí solo puede no cerrar esa sesión.

**Recomendación:** evaluar revocación de sesiones y hacer pruebas de recuperación de cuenta y cierre global de sesiones. La configuración de Auth no se cambió durante esta auditoría.

### P2 — Requisitos de contraseña inconsistentes
El registro exige al menos 10 caracteres en el HTML. La página de restablecimiento declara mínimo 8 caracteres. La política efectiva de Neon Auth debe prevalecer, pero la interfaz debe presentar el mismo requisito en ambos flujos.

### P3 — Índices de auditoría
`admin_audit_log` se consulta ordenando por `created_at DESC`, pero no tiene índice por fecha. `reportes_operativos` tampoco tiene índice por `created_at`. El volumen actual es bajo; revisar con métricas antes de agregar índices.

## 7. Datos locales, repositorio y privacidad

- La aplicación conserva el antiguo almacenamiento local `faca_evidencias_testigos` en `localStorage`. Si contiene fotos históricas codificadas, pueden permanecer en dispositivos aunque Testigos esté desactivado. No se borró el almacenamiento local; debe revisarse retención, respaldo y eliminación controlada al reconstruir el módulo.
- El repositorio es público. Se detectaron en archivos GeoJSON de barrios atributos como población estimada, grupos etarios, indicadores categóricos y campos de JAC/liderazgo. En los valores muestreados, varios campos de liderazgo aparecían como “Por registrar”; no se identificó una lista de nombres personales en esos campos. Aun así, el uso y publicación de variables de religión y perfiles poblacionales debe contar con autorización y revisión de finalidad.
- Los GeoJSON `barrios.geojson` y `barrios_poligonos_borrador_no_oficial.geojson` no se encontraron referenciados por `app.js`; el archivo activo de polígonos contiene solo nombre/fuente/estado/tipo/estilo. Revisar si los archivos de borrador deben mantenerse públicos.
- El barrido de secretos no se completó de forma exhaustiva por una limitación de la sesión de inspección. En los archivos individuales revisados no se observó una contraseña ni cadena de conexión PostgreSQL; esto no debe interpretarse como certificación integral de secretos del repositorio.

## 8. CRUD y experiencia de uso

En `mira-data.js`, algunas operaciones validan estrictamente que Neon devuelva una fila (`updateUserProfile`, `setModulePermission`, `deleteActivity`), pero otras actualizaciones y eliminaciones no usan el mismo control (`updatePerson`, `updateActivity`, `updateAttendance`, `deleteAttendance`, operaciones de Concejal y `updatePQRS`).

**Riesgo:** la interfaz podría interpretar una respuesta vacía como éxito aunque no se haya modificado ninguna fila. Se recomienda estandarizar la confirmación de filas afectadas y probar respuesta 0-row, timeout, duplicado, error de red y permisos revocados.

Se encontraron usos de `innerHTML` para construir listas y paneles. En las áreas inspeccionadas con datos variables se observó uso de funciones de escape o `textContent`; no se confirma una vulnerabilidad XSS. Aun así, conviene realizar pruebas con texto hostil en nombres, descripciones, barrios y asuntos antes de publicar.

## 9. Testigos y E-14: asuntos que deberán resolverse antes de reactivar

El bloqueo actual ya está aplicado en PostgreSQL y en el cliente. Permanecen cinco permisos antiguos de Testigos en registros de `module_permissions`; el hard-deny de la función impide que otorguen acceso mientras el módulo esté inactivo. Antes de reactivar, depurar o volver a asignar esos permisos según el nuevo modelo, no simplemente retirar el hard-deny.

La rama histórica `br-lucky-boat-b70mmt53` mantiene un deployment `e14secure` (Node.js 24, deployment 2). Producción no tiene ese deployment y el endpoint antiguo apunta a la rama histórica. No se eliminó el deployment ni la rama. La herramienta de inspección disponible expone metadatos pero no el paquete fuente. Eliminar la rama completa borraría también su copia de base de datos; cualquier limpieza debe escoger el recurso mínimo y preservar evidencia/respaldo.

Antes de reactivar E-14 también se debe resolver el backend real, la identidad JWT `sub`, los objetos huérfanos si una carga falla al confirmar metadatos, la eliminación coordinada, el borrado autorizado, la paginación y las pruebas de carga/descarga con datos de prueba.

## 10. Plan de corrección recomendado

| Prioridad | Trabajo | Criterio de cierre |
|---|---|---|
| P0 | Testigos bloqueado en servidor y en cliente | Ya aplicado y verificado en producción |
| P1 | Corregir normalización de cédula | Altas/ediciones garantizan valor normalizado; búsquedas sin duplicados |
| P1 | Restringir asistencia a actividades activas | Portal y PostgreSQL rechazan actividad finalizada/cancelada |
| P1 | Resolver bandeja de reportes operativos | Cada formulario llega a una bandeja y tiene estados/roles definidos |
| P1 | Alinear matriz, menús y RLS de Reportes/PQRS | Cada permiso habilita una tarea comprobable y autorizada |
| P1 | Protección de abuso en formularios públicos | Rate limiting del lado servidor y control de automatización probado |
| P2 | Reconciliar directorio InfoMIRA | 34 grupos repetidos y 18 filas sin cédula revisados contra fuente |
| P2 | Auditar cambios de catálogo | Activaciones/desactivaciones generan eventos de auditoría |
| P2 | Estandarizar confirmación CRUD | Cero falsos éxitos cuando Neon no modifica filas |
| P2 | Sesiones y contraseñas | Política coherente y pruebas de recuperación/revocación |
| P2 | Revisar variables territoriales publicadas | Finalidad, origen y autorización documentados |
| P2 | Resolver deployment histórico E-14 | Endpoint legado cerrado con respaldo y sin destruir la rama por accidente |
| P3 | Índices y desempeño | Justificación con volumen/planes de consulta |

## 11. Límites de esta auditoría

- No se ejecutó prueba visual/manual de Control Administrativo, Actividades, Concejal, InfoMIRA, PQRS o Reportes en el navegador.
- No se probaron altas reales nuevas de personas ni se insertaron datos de ensayo en producción.
- No se ejecutaron envíos de formularios públicos, CAPTCHA, cargas/descargas E-14 ni pruebas de abuso.
- No se eliminaron ni fusionaron registros de InfoMIRA.
- No se modificó la configuración Neon Auth ni el deployment histórico `e14secure`.
- No se integró la rama a `main` ni se publicó GitHub Pages.
- Los resultados describen la rama de código indicada y el esquema/datos de producción observados al 2026-11-10; deben volver a validarse después de nuevas modificaciones.

## 12. Estado de integración

La comparación consultada el 2026-11-10 muestra la rama de trabajo divergente respecto de `main`: 40 commits por delante y 13 por detrás. No hay PR abierto. La integración y la publicación deben esperar a las correcciones P1, revisión visual, pruebas de cuenta real y CI sobre el candidato final.
