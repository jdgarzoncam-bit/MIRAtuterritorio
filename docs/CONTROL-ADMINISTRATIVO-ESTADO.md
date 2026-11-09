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
- No se ha realizado todavía una prueba funcional en navegador ni una ejecución CI del HEAD actual. El workflow de validación se dispara en pull requests a `main`, y el de Pages en `main`; no se creó PR ni se publicó esta rama.

## Migración preparada y verificada en Neon temporal

Se preparó una migración aislada, sin aplicarla a producción:

- Migration ID: `4b29ca1d-f9da-48fa-8aaa-145b9ac874d3`.
- Rama temporal: `br-noisy-sound-b7cuqq2g`.
- Cambio propuesto: sustituir la política ALL de `admin_audit_log` por una política SELECT exclusiva del administrador principal; revocar los privilegios directos y conceder solamente SELECT al rol `authenticated`.
- Verificación en la rama temporal: `anonymous` sin SELECT/INSERT/UPDATE/DELETE; `authenticated` con SELECT y sin INSERT/UPDATE/DELETE. RLS continúa habilitada.
- Los triggers `audit_user_profiles_changes` y `audit_module_permissions_changes` permanecen instalados. Su función `mira.audit_admin_changes()` es SECURITY DEFINER y su propietario conserva INSERT, por lo que los eventos automáticos pueden seguir registrándose aunque la cuenta autenticada no pueda escribir directamente en el historial.
- Producción no ha sido modificada. La migración está pendiente de aprobación explícita antes de aplicarse.

## Límites pendientes

1. Aplicar la migración de auditoría únicamente después de aprobación explícita.
2. Probar en un entorno controlado la consulta del historial, asignación/retiro de permisos, aprobación/desaprobación, cambio de rol y el bloqueo de una cuenta sin permisos.
3. Probar visualmente la interfaz en escritorio y móvil, incluidos estados vacíos y errores de conexión.
4. Revisar en una etapa posterior la política de aprobación a nivel de trigger SQL para que también excluya módulos temporalmente deshabilitados. La validación de la interfaz y del inicio de sesión ya excluye Testigos; el trigger de producción todavía conserva su condición histórica genérica.
5. No declarar Control Administrativo completamente certificado hasta completar la migración aprobada y las pruebas funcionales.

