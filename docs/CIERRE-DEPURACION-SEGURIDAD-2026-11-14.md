# Cierre de endurecimiento y depuración — 2026-11-14

## Alcance ejecutado

Base: proyecto Neon `soft-bar-53270058`, rama `production` (`br-winter-night-b758ke2j`), base `neondb`.

Se aplicó en una transacción la migración de endurecimiento:

- Revocar INSERT de `anonymous` sobre `mira.reportes_operativos`.
- Revocar SELECT de `authenticated` sobre `mira.reportes_operativos`.
- Eliminar las políticas `reports_public_insert` y `reports_permission_read`.
- Revocar EXECUTE de PUBLIC/anonymous en `mira.has_module_permission(text,text)` y concederlo explícitamente a `authenticated`.
- Revocar EXECUTE de PUBLIC/anonymous en `mira.is_active_admin()` y concederlo explícitamente a `authenticated`.
- Revocar EXECUTE de PUBLIC/anonymous/authenticated en las funciones trigger-only `audit_admin_changes()`, `enforce_profile_activation_requirements()` y `sync_auth_user_profile()`.

No se eliminaron tablas, filas, cuentas, PQRS, reportes ciudadanos ni evidencias.

## Verificación posterior

- `reportes_operativos`: sin grants para anonymous/authenticated y sin políticas RLS. La tabla permanece, vacía (0 filas estimadas/contadas en la comprobación).
- Helpers RLS: `has_module_permission` e `is_active_admin` no tienen EXECUTE para PUBLIC ni anonymous; authenticated sí conserva EXECUTE.
- Funciones trigger-only: sin EXECUTE para PUBLIC, anonymous ni authenticated.
- Todas las 16 tablas de `mira` revisadas mantienen RLS habilitado.
- Los formularios públicos conservan grants de INSERT en `pqrs` y `reportes_ciudadanos`. Una segunda lectura de grants autenticados falló por un error de autenticación del conector; no se considera prueba funcional de los formularios.
- El tamaño reportado por PostgreSQL fue aproximadamente 10 MB para `neondb`; Neon informó logical_size de la rama de aproximadamente 34.7 MB, frente a un límite configurado de 1 GB por rama.
- `mira.personas`: 586 filas estimadas, 392 kB.
- `mira.infomira_red`: 636 filas estimadas, 376 kB.
- `mira.admin_audit_log`: 78 filas estimadas, 72 kB.
- `mira.reportes_operativos`: 0 filas; no se eliminó la tabla ni su estructura.
- Antes del mantenimiento se observaron 43 tuplas muertas estimadas en cuatro tablas pequeñas: module_permissions (26), user_profiles (10), actividades (4) y module_catalog (2), además de 1 en personas. Se ejecutó VACUUM (ANALYZE) sobre module_permissions, user_profiles, actividades y module_catalog. Después, esas cuatro quedaron con 0 tuplas muertas según las estadísticas.
- No se eliminaron índices con cero escaneos: las estadísticas son de una ventana limitada y no prueban que sean innecesarios; además algunos son índices de claves o consultas ocasionales.

## Límites y asuntos pendientes

- No se ejecutó prueba funcional de inserción de PQRS/reportes anónimos; se confirmó que sus grants INSERT siguen presentes, pero la lectura adicional falló por credenciales del conector.
- No se ejecutó prueba de navegador limpio/incógnito ni prueba E2E de autenticación.
- No se hizo eliminación de históricos ni deduplicación, porque no hay evidencia de duplicados o acumulación excesiva.
- El tamaño actual no indica saturación: 10 MB de base PostgreSQL y ~34.7 MB de tamaño lógico de rama frente a 1 GB configurado. El consumo/transferencia de Neon es una métrica separada y debe monitorearse.
- La rama QA y main siguen divergentes; no se fusionaron ni se publicó nada desde QA.

## Conclusión

La migración autorizada quedó aplicada y las ACL/políticas objetivo se verificaron. El almacenamiento consultado es pequeño; la depuración segura realizada fue mantenimiento VACUUM/ANALYZE de cuatro tablas, sin borrar datos institucionales. Antes de reanudar el mapa siguen pendientes las pruebas dinámicas de autenticación, roles, formularios públicos y revisión completa de diferencias entre QA y main.
