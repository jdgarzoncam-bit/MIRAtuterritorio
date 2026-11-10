# Estado de Control Administrativo — revisión 2026-11-09

## Alcance de esta etapa

- Repositorio: `jdgarzoncam-bit/MIRAtuterritorio`.
- Rama de trabajo: `feat/landing-reportes-testigos-e14`.
- Base de datos: Neon project `soft-bar-53270058`, branch de producción `br-winter-night-b758ke2j`, database `neondb`.
- Auditoría general de seguridad, permisos, datos y funcionamiento: [AUDITORIA-TRANSVERSAL-2026-11-10.md](./AUDITORIA-TRANSVERSAL-2026-11-10.md).
- Auditoría específica del panel y permisos de Control Administrativo: [CONTROL-ADMINISTRATIVO-AUDITORIA-2026-11-10.md](./CONTROL-ADMINISTRATIVO-AUDITORIA-2026-11-10.md).
- No se integró la rama a `main`, no se creó pull request y no se publicó GitHub Pages.
- Testigos y Auditoría E-14 continúan temporalmente inactivos. El 2026-11-10 se aplicó en producción el bloqueo de servidor: `testigos.active=false`, `has_module_permission()` deniega Testigos incluso al administrador y se revocó INSERT anónimo en `mira.testigos_publicos`.

## Diagnóstico de seguridad existente

Se inspeccionaron las políticas RLS, ACL, funciones y triggers de `mira.user_profiles`, `mira.module_catalog`, `mira.module_permissions` y `mira.admin_audit_log`.

- RLS estaba habilitada en las cuatro tablas.
- La función `mira.is_active_admin()` identifica la cuenta administradora principal y `mira.has_module_permission(module, action)` valida permisos granulares.
- Las políticas de perfiles limitan la consulta general al propio usuario y reservan la lectura, inserción y actualización administrativa a la cuenta principal. La creación/actualización de perfiles no permite asignar el rol `admin` a otra cuenta desde esas políticas.
- `module_permissions` tiene lectura propia o administrativa y escritura administrativa.
- Las tablas de Actividades, Concejal e InfoMIRA ya poseen políticas RLS para consulta, creación, edición y eliminación. Reportes operativos se expone como consulta por permiso; PQRS conserva sus reglas específicas de propietario/administrador.
- Hallazgo importante: `admin_audit_log` tenía una política `ALL` para la cuenta autenticada administradora y grants que le permitían SELECT, INSERT, UPDATE y DELETE. Esto permitía que la propia cuenta administradora modificara o borrara registros históricos desde la API.

## Cambios realizados en la rama

### Control Administrativo

- La matriz ahora muestra Consulta, Crear, Editar y Eliminar para Actividades, Concejal e InfoMIRA, cuyas tablas ya tienen políticas RLS por acción.
- Centro de Operaciones, Reportes y PQRS se muestran con Consulta solamente en esta matriz. No se presentan como protegidas por acciones que no están configuradas de esa manera en la base de datos.
- Testigos se excluye de la matriz y continúa con el bloqueo temporal existente.
- Se agregó una vista de Historial de auditoría con los eventos registrados por los triggers de perfiles y permisos, fecha, actor, objetivo y detalles expandibles.
- Se añadieron estados de carga/error y actualización manual del historial.
- Se protegió la selección de usuarios contra respuestas asíncronas atrasadas que podían mostrar permisos del usuario anterior.
- Las operaciones de aprobación/cambio de rol y de permisos validan el usuario objetivo de la respuesta antes de actualizar la vista. No se presenta un cambio como correcto si Neon no devuelve la fila esperada.

### Identidad y acceso

- El establecimiento de sesión compara el identificador del usuario autenticado con el identificador asociado al perfil.
- Una cuenta con rol `admin` que no corresponde a la cuenta administradora principal se rechaza.
- Una cuenta cuyos únicos permisos de Consulta sean Testigos o Control Administrativo no se considera habilitada para ingresar. La misma regla se refleja en la condición de aprobación del panel.
- Se actualizaron los parámetros de caché de los recursos que cambiaron.

### Validación automatizada

- Los workflows de validación y publicación incluyen ahora `node --check mira-admin.js` junto con las comprobaciones que ya existían.
- La sintaxis de `mira-admin.js`, `mira-auth.js` y `mira-data.js` se comprobó mediante análisis sintáctico V8. Para esta comprobación se retiraron únicamente las declaraciones `import`/`export` al compilar el texto, sin ejecutar el código.
- No se ha realizado todavía una prueba funcional visual en navegador ni un flujo real de aprobación de cuentas desde la interfaz. GitHub Actions run #61 finalizó correctamente (`success`) en el commit `a3d6d0d962e70ba15b41a9536ff19c5a89d9eab7`, ejecutando sintaxis y pruebas `node --test tests/*.test.cjs`.
- La sintaxis de `app.js`, `mira-data.js`, `mira-auth.js` y `mira-admin.js` se validó estáticamente con V8 después de los últimos cambios.

## Migración de protección del historial — aplicada en producción

La migración se aprobó y se aplicó el 2026-11-09 en la rama Neon de producción. La rama temporal de prueba fue eliminada:

- Migration ID: `4b29ca1d-f9da-48fa-8aaa-145b9ac874d3`.
- La rama temporal `br-noisy-sound-b7cuqq2g` fue eliminada al completar la migración.
- Cambio propuesto: sustituir la política ALL de `admin_audit_log` por una política SELECT exclusiva del administrador principal; revocar los privilegios directos y conceder solamente SELECT al rol `authenticated`.
- Verificación en la rama temporal: `anonymous` sin SELECT/INSERT/UPDATE/DELETE; `authenticated` con SELECT y sin INSERT/UPDATE/DELETE. RLS continúa habilitada.
- Los triggers `audit_user_profiles_changes` y `audit_module_permissions_changes` permanecen instalados. Su función `mira.audit_admin_changes()` es SECURITY DEFINER y su propietario conserva INSERT, por lo que los eventos automáticos pueden seguir registrándose aunque la cuenta autenticada no pueda escribir directamente en el historial.
- Verificación posterior en producción: política única `admin_audit_log_admin_read` (SELECT, administrador activo); `authenticated` tiene SELECT=true e INSERT/UPDATE/DELETE=false; `anonymous` no tiene los cuatro privilegios; RLS continúa habilitada. Ambos triggers siguen instalados y llaman a `mira.audit_admin_changes()`, función SECURITY DEFINER propiedad de `neondb_owner`.
- El historial conserva 78 eventos después de aplicar el cambio. No se borraron ni alteraron registros existentes.

## Pruebas funcionales en ramas Neon aisladas — 2026-11-09

Se crearon ramas QA a partir de producción. Los perfiles y permisos con prefijo `qa-` existen solamente en estas ramas; no se insertaron usuarios ni perfiles de prueba en producción.

- Se confirmó que el administrador podía consultar perfiles, permisos y auditoría bajo RLS.
- Se reprodujo el fallo real de aprobación: la cuenta `authenticated` no tenía privilegio SQL UPDATE en `mira.user_profiles`; RLS permitía la operación administrativa, pero la capa ACL la impedía antes.
- Con `GRANT UPDATE` aplicado solo en QA, la cuenta administradora pudo aprobar un perfil con correo confirmado y permiso Consulta válido.
- El disparador bloqueó la activación de un perfil con correo no confirmado.
- Se probó que un usuario normal solo consulta su propio perfil; no ve perfiles ajenos ni eventos de auditoría y no puede actualizar su perfil ni sus permisos.
- Se verificó que el administrador puede modificar permisos; la política RLS no permite elevar otro perfil al rol `admin`.
- Se comprobó el registro automático de eventos del administrador en `admin_audit_log`.
- La versión actual del trigger de aprobación aceptó un perfil con permiso Testigos como único acceso, aunque la interfaz lo bloquea. Esto se identificó como una inconsistencia y se probó una versión corregida que exige un permiso Consulta de un módulo activo y disponible, excluyendo Testigos y Control Administrativo.
- En la versión corregida, Actividades activo permite la aprobación; Testigos y Logística (módulo inactivo) como único permiso son rechazados por PostgreSQL.
- Los escenarios se ejecutaron con identidades JWT simuladas y el rol `authenticated` en ramas de prueba, nunca sobre producción.

## Ajustes de aprobación de perfiles — aplicados en producción

El usuario autorizó ambos ajustes el 2026-11-09. Los cambios se aplicaron en la rama Neon de producción `br-winter-night-b758ke2j`, database `neondb`.

### A. Privilegio UPDATE para perfiles

- Migration ID: `4bbb1033-4517-4c05-bdeb-43c0248f9810`.
- Se aplicó `GRANT UPDATE ON TABLE mira.user_profiles TO authenticated`.
- Se verificó en producción: `authenticated` tiene UPDATE=true; `anonymous` UPDATE=false.
- La política RLS `profile_admin_update_non_admin` permanece: `USING` y `WITH CHECK` requieren `mira.is_active_admin()` y `role <> 'admin'`. Por ello la operación sigue limitada a la cuenta principal y no permite promover otra cuenta al rol `admin`.
- El rol autenticado no recibió INSERT ni DELETE sobre `user_profiles`.

### B. Regla de aprobación de cuentas a nivel de PostgreSQL

- Se reemplazó en producción la función `mira.enforce_profile_activation_requirements()`.
- Se conserva `SECURITY DEFINER`, el propietario `neondb_owner` y `search_path=pg_catalog,mira`.
- Para activar cualquier cuenta distinta al administrador principal, exige `email_verified=true` y al menos un permiso Consulta (`view`) habilitado en un módulo cuyo catálogo tenga `active=true`.
- Excluye expresamente `testigos` y `control_administrativo`; módulos inactivos, como Logística, tampoco pueden habilitar el ingreso.
- Antes de producción se probó en rama aislada: Actividades activa permite la aprobación; Testigos únicamente y Logística únicamente son rechazados por el trigger; correo sin confirmar es rechazado.

### Verificación posterior en producción

- `anonymous`: no tiene SELECT, INSERT, UPDATE ni DELETE en `user_profiles` ni permisos de escritura en `admin_audit_log`.
- `authenticated`: puede SELECT y UPDATE perfiles; no puede INSERT ni DELETE perfiles y no puede insertar, actualizar o borrar el historial.
- Las políticas RLS de perfiles permanecen y no se eliminaron ni ampliaron para otros roles.
- El historial de auditoría conserva 78 eventos.
- La política `admin_audit_log_admin_read` se mantiene en solo lectura para el administrador activo.
- E-14 conserva 0 filas; no se reactivó ni se modificó.
- No se crearon usuarios de prueba en producción.



## Revisión transversal de seguridad de Neon — solo lectura

- Se inspeccionaron las 16 tablas base del esquema `mira`: las 16 tienen RLS habilitada.
- Ninguna tabla concede SELECT al rol `anonymous`.
- Las inserciones anónimas se mantienen únicamente para flujos públicos: `pqrs`, `reportes_ciudadanos` y `reportes_operativos`. El INSERT anónimo en `testigos_publicos` fue revocado el 2026-11-10 y su política `witnesses_public_insert` fue eliminada.
- Las tablas de Actividades, Asistencias, Concejal, Personas e InfoMIRA conceden privilegios SQL de escritura a `authenticated`, pero sus políticas RLS invocan `mira.has_module_permission` con las acciones correspondientes. La cuenta autenticada no obtiene acceso efectivo solo por tener el GRANT.
- Las tablas `module_catalog` y `module_permissions` tienen grants de escritura para `authenticated`, pero sus políticas de escritura requieren `mira.is_active_admin()`.
- Las funciones `SECURITY DEFINER` del esquema `mira` revisadas tienen `search_path` fijado.
- Neon Auth: registro por correo y contraseña habilitado; confirmación de correo requerida con OTP; el registro público está habilitado y la aplicación exige aprobación del administrador después de confirmar el correo. La configuración indica que el restablecimiento de contraseña no revoca otras sesiones (`revoke_sessions_on_password_reset=false`) y que localhost está permitido. No se cambió ninguna opción de Neon Auth durante esta revisión.
- La política de lectura de PQRS está limitada al propietario o al administrador; asignar Consulta en la matriz no amplía por sí solo la lectura de PQRS ajenas.

## Limpieza de entorno de pruebas — 2026-11-09

- Tras finalizar las pruebas, se eliminó la rama Neon temporal `qa-admin-control-2026-11-09` (`br-dark-heart-b79coo8b`), que contenía los perfiles ficticios y permisos de QA.
- Se confirmó que la búsqueda de ramas por ese nombre ya no devuelve resultados.
- Las ramas temporales de migración anteriores también fueron eliminadas por el proceso de finalización de cada migración.
- La rama de producción `br-winter-night-b758ke2j` no se eliminó ni se cambió de nombre.
- El código del proyecto permanece en `feat/landing-reportes-testigos-e14`; `main` no fue modificado y no hay publicación nueva de GitHub Pages.

## Bloqueo reforzado de Testigos y permisos por módulo — aplicado en producción 2026-11-10

### Migración preparada, probada y aplicada

- Migration ID: `ac69dbd6-3cf5-4cc5-82aa-d3d01764d4a7`.
- Rama temporal de validación: `br-dry-snow-b704rkb5`; rama padre: producción `br-winter-night-b758ke2j`.
- La función `mira.has_module_permission(module, action)` propuesta comprueba primero que la acción sea válida y que el módulo exista y esté activo en `mira.module_catalog`; solo después permite el bypass del administrador principal o evalúa el permiso del usuario. Testigos se bloquea expresamente incluso para el administrador, hasta que se reconstruya y valide.
- La migración marca `testigos` como inactivo, revoca INSERT al rol `anonymous` en `mira.testigos_publicos` y elimina la política `witnesses_public_insert`. No elimina registros ni desactiva formularios públicos de otros módulos.
- Pruebas en la rama temporal: `testigos.active=false`; privilegio INSERT anónimo=false; política pública ausente; permisos de Testigos false sin identidad y también con el JWT simulado del administrador principal; Actividades y Control Administrativo siguen habilitados para el administrador; Logística (inactivo) y acciones no permitidas devuelven false.
- Se confirmó que la función mantiene `SECURITY DEFINER` y `search_path=pg_catalog,mira,auth`.
- El resultado de prueba conserva 0 filas tanto en `mira.testigos_publicos` como en `mira.evidencias_e14`. No se insertaron registros de prueba.
- **Aplicación en producción confirmada el 2026-11-10.** Migration ID `ac69dbd6-3cf5-4cc5-82aa-d3d01764d4a7`; Neon confirmó que la migración se aplicó a `br-winter-night-b758ke2j` y eliminó la rama temporal `br-dry-snow-b704rkb5`.

### Servicio E-14 antiguo identificado

- La rama de producción `br-winter-night-b758ke2j` no tiene un deployment Neon Function llamado `e14secure`.
- Se encontró un deployment activo `e14secure` (deployment 2, Node.js 24) en la rama antigua `br-lucky-boat-b70mmt53` (`mcp-migration-2026-11-03T22-29-59`). Su URL apunta a esa rama, no a producción.
- La rama antigua contiene 0 filas de `mira.evidencias_e14` y 0 filas de `mira.testigos_publicos` en la inspección realizada; el catálogo de esa copia todavía marca Testigos activo.
- Las herramientas disponibles exponen metadatos del deployment, pero no su paquete fuente ni configuración. No se invocó, modificó ni eliminó el deployment ni la rama antigua. El cierre definitivo de ese endpoint requiere una decisión expresa, porque eliminar la rama también elimina su copia de base de datos.

### Barrera adicional en el cliente y pruebas automatizadas

- `mira-data.js` incorpora `assertTestigosEnabled()` en las rutas `listPublicWitnesses`, `updatePublicWitness`, `listWitnessFiles`, `e14Request`, `listE14Evidence`, `uploadE14Evidence` y `getE14Download`. Si la bandera temporal no es exactamente `false`, la operación falla antes de pedir un token o iniciar una petición de red.
- Se añadió `tests/testigos-inactive.test.cjs` para verificar las siete rutas, el comportamiento cerrado por defecto y que Actividades sigue pudiendo realizar consultas cuando Testigos se habilita explícitamente.
- `.github/workflows/validate.yml` ahora ejecuta `node --test tests/*.test.cjs` además de `node --check`, tanto al actualizar esta rama como en los pull requests hacia `main`.
- Se actualizó el parámetro de caché de `mira-data.js` en `index.html`.
- GitHub Actions run #59 finalizó correctamente (`success`) sobre el HEAD documental `b646148cb8dd053fdceae9a2a182d179a272cb53`, incluyendo `node --check` de los módulos JavaScript y `node --test tests/*.test.cjs`: https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/42718784604.
- No se pudo hacer una prueba visual de Control Administrativo: la aplicación no estaba abierta en el navegador disponible y esta rama aún no está publicada en GitHub Pages.

## Próximas etapas sugeridas

1. Corregir el alta/actualización de personas para generar `cedula_normalizada` y reforzar esa regla también en PostgreSQL; probar búsquedas y deduplicación en Actividades.
2. Limitar el portal de Actividades a eventos `activa` y bloquear en servidor la asistencia a actividades finalizadas o canceladas.
3. Resolver el flujo de reportes: conectar `reportes_operativos` a una bandeja interna o unificarlo de forma controlada con `reportes_ciudadanos`; aclarar el permiso `reportes` en la matriz.
4. Completar pruebas de Control Administrativo en navegador e inicio de sesión real: aprobación, suspensión, cambio de rol, matriz de permisos, historial y cambios rápidos de usuario.
5. Resolver inconsistencias entre matriz y RLS para Reportes y PQRS; añadir control de abuso para los formularios públicos y auditoría de cambios al catálogo de módulos.
6. Revisar calidad de datos del directorio InfoMIRA, contratos de almacenamiento y permisos por módulo; no eliminar ni fusionar registros hasta reconciliar el origen.
7. Revisar `e14secure` en la rama antigua `br-lucky-boat-b70mmt53` y decidir la limpieza menos destructiva. Después, probar respaldos/restauración y sincronizar la rama con `main` (13 commits por detrás y 40 por delante), abrir PR, ejecutar CI, revisar e integrar solo tras validación.


## Acuerdos de configuración del mapa oficial y modelo de cuentas — 2026-11-10

### Mapa 3D oficial del proyecto

El usuario confirma que el archivo `.maps3d.json` fue construido manualmente y de forma estudiada/profesional, con fuentes adaptadas a la estructura de cada edificio y cada vivienda. Se considera la configuración oficial de referencia del mapa de MIRA TU TERRITORIO; no debe sustituirse por un mapa genérico ni por geometrías aproximadas. El archivo original debe conservarse sin sobrescritura.

La captura de referencia suministrada el 2026-11-10 muestra el resultado visual del modelo y los filtros activos en la pestaña **Capas**:
- Imágenes: activadas.
- Edificios: activados y visibles.
- Carreteras: activadas y visibles.
- Agua: activada y visible.
- Cobertura del suelo: activada y visible.
- Árboles: activados y visibles.
- Curvas de nivel: activadas y visibles.
- Catastro: activado y visible.
- Cuadrícula del terreno visible.
- Vista de impresión mostrada: 191 mm × 220 mm × 15 mm; escala 1:28797; resolución aproximada de 38,1 m de terreno y 0,2 m vertical.

El JSON asociado registra, entre otros parámetros, el área delimitada aproximadamente entre NE 4.84004, -74.32652 y SW 4.78275, -74.37598; imagen `satlas-superes-2023`; terreno de elevación `mapterhorn-global`; exageración vertical 1; edificios OSM con alturas configuradas entre 3 y 25 m y etiquetas activas; carreteras extruidas; agua extruida; categorías de cobertura de suelo WOOD, GRASS, FARMLAND, WETLAND, SAND, ICE, ROCK y URBAN; parcelas/catastro, curvas de nivel y árboles activos. Los marcadores y tracks están vacíos en el archivo de referencia.

**Regla de implementación:** conservar el archivo original como maestro, adaptar su configuración al visor y a los datos/servicios existentes de MIRA, y mantener estos filtros como estado inicial reproducible. Cualquier cambio futuro debe partir de una copia/versionado y registrar los parámetros modificados. No degradar el nivel de detalle ni afirmar precisión catastral/registral sin validación de las fuentes y licencias. La captura de pantalla es referencia visual adicional; el JSON es el archivo de configuración que se debe preservar.

### Cuentas y correo electrónico

El usuario confirma que las cuentas se gestionarán mediante correo electrónico, sin nombres de usuario independientes. El proyecto es interno, para un grupo reducido de personas y sin presupuesto adicional. Priorizar Neon Auth ya integrado y servicios gratuitos ya disponibles; no proponer servicios pagos como requisito. La verificación por correo y la aprobación administrativa se mantienen como barreras distintas. El remitente actual de Neon es compartido; el uso de una dirección institucional propia dependerá de si se dispone de SMTP institucional sin costo adicional.

### Roles — estado y propuesta funcional pendiente de aprobación

El código actual reconoce `admin`, `operator`, `viewer` y `witness`. La cuenta `admin` está reservada al identificador de la persona administradora principal. Para las demás cuentas, el acceso real se decide por `module_permissions` y RLS; hoy `operator`, `viewer` y `witness` no imponen por sí mismos una matriz de capacidades diferente. El selector de rol guarda la etiqueta en `user_profiles.role`, mientras que la matriz granular guarda los permisos efectivos.

Modelo funcional autorizado e implementado en la rama de trabajo:
- **Consulta (`viewer`)**: límite máximo de solo lectura (`view`).
- **Operador (`operator`)**: límite máximo de consulta, creación y edición (`view/create/edit)); no puede eliminar, exportar ni administrar.
- **Testigo (`witness`)**: reservado y no asignable mientras Testigos/E-14 siga inactivo; el inicio de sesión de ese rol queda bloqueado.
- **Administrador (`admin`)**: solo la cuenta principal; no asignable desde el panel.

El rol no concede acceso automático a módulos. La matriz granular define dónde se habilita cada acción y el rol establece el límite máximo. Los permisos guardados que excedan el límite del rol se conservan, pero no son efectivos. Centro de Operaciones sigue siendo exclusivamente Consulta o sin permiso. Cambiar de rol no borra asignaciones personalizadas.

## Límites pendientes

1. Probar visualmente la interfaz en escritorio y móvil, incluidos estados vacíos, errores de red, actualización del historial y cambio rápido entre usuarios.
2. Verificar el flujo real de inicio de sesión, aprobación, suspensión, cambio de rol y matriz de permisos con cuentas de prueba controladas.
3. Ejecutar CI mediante un pull request de validación antes de cualquier integración.
4. Verificar los flujos en la aplicación desplegada después de integrar a `main`; esta rama no se ha desplegado.
5. No declarar Control Administrativo completamente certificado hasta completar pruebas de navegador y de identidad real.



## Modelo funcional de roles — implementación en rama y validación QA 2026-11-10

El usuario autorizó implementar el modelo de roles y pidió que pueda retirarse si no resulta útil. Los cambios se trabajan primero en `feat/landing-reportes-testigos-e14` y se validan en la rama Neon aislada `qa-role-capabilities-2026-11-10` (`br-wild-surf-b74rsbpz`), derivada de producción. No se aplicó esta lógica a producción ni se cambió `main`.

### Capacidades efectivas
- `viewer` (Consulta): solo `view`.
- `operator` (Operador): `view`, `create`, `edit`; no `delete`, `export` ni `manage`.
- `witness`: reservado; no se puede asignar mientras Testigos/E-14 siga inactivo. Un perfil histórico con ese rol no obtiene acceso a módulos operativos.
- `admin`: reservado a la cuenta principal identificada por `beef5bf3-82a8-4c35-a12c-17771be59da1`.

Los permisos por módulo siguen siendo necesarios: el rol no concede automáticamente acceso a todos los módulos. Centro de Operaciones conserva solo Consulta. Los permisos guardados fuera del límite del rol no se borran; permanecen almacenados, pero no son efectivos. La interfaz deshabilita las acciones que el rol no permite y lo explica al administrador. Cambiar de rol no elimina personalizaciones.

### Botón Guardar rol
El botón existente `Guardar rol` utiliza `updateUserProfile` para persistir `role` en `mira.user_profiles`, valida la fila devuelta por Neon y actualiza el panel solo después de recibir confirmación. Los roles asignables desde la interfaz son Consulta y Operador. Testigo se muestra solo si existe un perfil histórico con ese valor, y permanece deshabilitado.

### Protección PostgreSQL probada en QA
- `mira.has_module_permission` ahora aplica el límite del rol además del permiso individual, estado activo/verificado del perfil y catálogo activo del módulo; conserva el bloqueo absoluto de Testigos y el bypass exclusivo del administrador principal.
- El trigger `user_profiles_role_model_guard` impide asignar `admin` a otra cuenta y bloquea nuevas asignaciones de `witness`.
- Se ajustó el gate de activación para que la comprobación de correo y permiso se ejecute al crear/activar una cuenta, no al guardar cambios de rol con `active=true` sin transición de estado. La aprobación sigue exigiendo correo confirmado y al menos un permiso Consulta efectivo de un módulo activo.
- Pruebas con JWT simulado en la rama QA: para `viewer`, `view=true`, `create=false`, `delete=false` incluso con permiso create almacenado; para `operator`, `view=true`, `create=true` cuando el permiso individual está concedido, `edit=false` sin permiso individual, `delete=false`, y Testigos siempre false.
- La rama QA se creó a partir de producción y contiene únicamente pruebas aisladas. No se ha limpiado todavía; eliminarla al terminar la validación completa.

### Reversibilidad
La reversión se hará en una migración versionada que restaure la definición anterior de `mira.has_module_permission`, retire el trigger `user_profiles_role_model_guard` y restaure la función anterior de activación. Los valores de `role` y los permisos individuales no se borran ni se convierten automáticamente. En el cliente, revertir los cambios de `mira-admin.js`, `mira-data.js` y sus versiones de caché. No se debe revertir directamente en producción sin autorización expresa.

### Pendiente antes de producción
- Completar pruebas de Guardar rol desde interfaz real, aprobación, suspensión y permisos con cuentas controladas.
- Revisar las políticas RLS de cada módulo para confirmar que todas invocan `mira.has_module_permission` donde corresponda.
- En QA se revocó UPDATE a nivel de tabla y se concedió UPDATE únicamente sobre `active` y `role`; la verificación confirmó `table_update=false`, `active_update=true`, `role_update=true`, `email_update=false` y `email_verified_update=false`. Aplicar esta reducción a producción solo con migración aprobada.
- No aplicar aún esta migración a producción ni publicar el código hasta superar QA y sincronizar la rama con `main`.


### Prueba adicional de guardado y permisos por columna en QA
- Un UPDATE de perfil en la rama QA guardó correctamente el rol `viewer` y devolvió la fila actualizada.
- Intentar asignar `witness` fue rechazado por `user_profiles_role_model_guard` con SQLSTATE `23514` y mensaje de rol reservado.
- Se probó el límite de privilegios SQL por columna: authenticated conserva UPDATE únicamente sobre `active` y `role`, sin UPDATE sobre `email` ni `email_verified`.
- La prueba de actualización como rol SQL `authenticated` no pudo ejecutarse con el conector porque la conexión solicitó credenciales de contraseña; no se presenta como prueba funcional PostgREST. La escritura fue verificada con el propietario en QA y los privilegios por columna se verificaron mediante catálogo PostgreSQL.
- Las pruebas de navegador y CI del nuevo commit siguen pendientes de confirmación; el flujo no se considera certificado todavía.
