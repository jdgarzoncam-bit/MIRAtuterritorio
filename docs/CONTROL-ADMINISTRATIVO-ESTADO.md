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

## Migración pendiente de aprobación — habilitar aprobación de perfiles

Se preparó una nueva migración para producción, aún no aplicada:

- Migration ID: `4bbb1033-4517-4c05-bdeb-43c0248f9810`.
- Rama temporal: `br-cool-shadow-b7dlb4no`, parent `br-winter-night-b758ke2j`.
- Script preparado: `GRANT UPDATE ON TABLE mira.user_profiles TO authenticated`.
- ACL verificada en la rama: `authenticated` puede ejecutar UPDATE; `anonymous` no puede. La fila sigue sujeta a la política RLS `profile_admin_update_non_admin`, que limita la actualización a la cuenta administradora principal y no permite promover otro perfil a `admin`.
- En esa misma rama temporal se probó la nueva definición de `mira.enforce_profile_activation_requirements()`, pero esa definición se ejecutó como una prueba independiente y no forma parte del script de migración preparado. Para producción requerirá una instrucción SQL separada después de aprobación explícita.
- Producción conserva todavía el ACL original sin UPDATE sobre `user_profiles` y la versión histórica del trigger de activación. La interfaz está corregida, pero la aprobación no quedará operativa hasta autorizar los dos cambios de base de datos.

## Límites pendientes

1. Autorizar o rechazar la migración ACL pendiente y la actualización del trigger de activación.
2. Completar pruebas de desaprobación/suspensión y cambio de rol normal en la rama temporal.
3. Probar visualmente la interfaz en escritorio y móvil, incluidos estados vacíos, errores de red, actualización del historial y cambio rápido entre usuarios.
4. Ejecutar CI mediante un pull request de validación antes de cualquier integración.
5. Verificar los flujos en la aplicación desplegada después de integrar a `main`; esta rama no se ha desplegado.
6. No declarar Control Administrativo completamente certificado hasta completar la migración aprobada y las pruebas de navegador.


