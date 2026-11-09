# Estado de Control Administrativo — revisión 2026-11-09

## Alcance de esta etapa

- Repositorio: `jdgarzoncam-bit/MIRAtuterritorio`.
- Rama de trabajo: `feat/landing-reportes-testigos-e14`.
- Base de datos: Neon project `soft-bar-53270058`, branch de producción `br-winter-night-b758ke2j`, database `neondb`.
- No se integró la rama a `main`, no se creó pull request y no se publicó GitHub Pages.
- Testigos y Auditoría E-14 continúan temporalmente bloqueados. No se modificaron sus políticas, grants ni datos de producción.

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
- No se ha realizado todavía una prueba funcional visual en navegador ni una ejecución CI del HEAD actual. El workflow de validación se dispara en pull requests a `main`, y el de Pages en `main`; no se creó PR ni se publicó esta rama.
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
- Las inserciones anónimas detectadas están limitadas a flujos públicos: `pqrs`, `reportes_ciudadanos`, `reportes_operativos` y `testigos_publicos`. La tabla `testigos_publicos` mantiene actualmente INSERT anónimo, aunque sus pantallas web están temporalmente desactivadas. Por tanto, su desactivación aún no es un bloqueo completo del lado del servidor.
- Las tablas de Actividades, Asistencias, Concejal, Personas e InfoMIRA conceden privilegios SQL de escritura a `authenticated`, pero sus políticas RLS invocan `mira.has_module_permission` con las acciones correspondientes. La cuenta autenticada no obtiene acceso efectivo solo por tener el GRANT.
- Las tablas `module_catalog` y `module_permissions` tienen grants de escritura para `authenticated`, pero sus políticas de escritura requieren `mira.is_active_admin()`.
- Las funciones `SECURITY DEFINER` del esquema `mira` revisadas tienen `search_path` fijado.
- Neon Auth: registro por correo y contraseña habilitado; confirmación de correo requerida con OTP; el registro público está habilitado y la aplicación exige aprobación del administrador después de confirmar el correo. La configuración indica que el restablecimiento de contraseña no revoca otras sesiones (`revoke_sessions_on_password_reset=false`) y que localhost está permitido. No se cambió ninguna opción de Neon Auth durante esta revisión.
- La política de lectura de PQRS está limitada al propietario o al administrador; asignar Consulta en la matriz no amplía por sí solo la lectura de PQRS ajenas.

## Próximas etapas sugeridas

1. Cerrar Control Administrativo: completar pruebas de navegador y CI; los dos ajustes de base de datos ya están aplicados y verificados en producción.
2. Cierre de servidor para Testigos temporalmente inactivo: bloquear también las rutas/API y el INSERT anónimo de `testigos_publicos`, sin borrar datos ni reconstruir todavía el módulo.
3. Revisión de autorización efectiva: comprobar, módulo por módulo, que los permisos de la interfaz y las políticas RLS coincidan; reforzar `has_module_permission` para que respete el estado activo del catálogo.
4. Blindaje de formularios públicos: validar límites, abuso automatizado, trazabilidad y retención de PQRS y reportes ciudadanos, manteniendo los formularios públicos que sí deben funcionar.
5. Pruebas funcionales de los módulos operativos: Actividades/Asistencias, Concejal, InfoMIRA, Centro de Operaciones, Reportes y PQRS, incluyendo permisos de consulta/creación/edición/eliminación.
6. Continuidad y privacidad de datos: respaldos, exportación controlada, recuperación, retención de datos personales y pruebas de restauración.
7. Integración y publicación: actualizar esta rama desde `main` (actualmente está 13 commits por detrás), resolver conflictos, abrir PR, ejecutar CI, revisar y solo entonces integrar y desplegar Pages.

## Límites pendientes

1. Probar visualmente la interfaz en escritorio y móvil, incluidos estados vacíos, errores de red, actualización del historial y cambio rápido entre usuarios.
2. Ejecutar CI mediante un pull request de validación antes de cualquier integración.
3. Verificar los flujos en la aplicación desplegada después de integrar a `main`; esta rama no se ha desplegado.
4. No declarar Control Administrativo completamente certificado hasta completar las pruebas de navegador y el flujo real de inicio de sesión.
