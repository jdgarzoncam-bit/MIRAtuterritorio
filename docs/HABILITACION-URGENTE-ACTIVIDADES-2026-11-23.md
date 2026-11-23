# Habilitación urgente de Actividades — 23 de noviembre de 2026

## Resultado en QA

La consulta confirmó que el catálogo `mira.module_catalog` ya tenía Actividades activa. El bloqueo práctico estaba en los permisos incompletos de uno de los operadores y en la ausencia de un acceso directo al portal desde la portada.

### Permisos de operadores

Para todas las cuentas con rol Operador, activas y con correo verificado, se habilitaron:
- `actividades:view`
- `actividades:create`
- `actividades:edit`
- `personas:create` (dependencia del portal cuando el participante aún no existe en la base de Personas).

No se habilitaron `actividades:delete`, `actividades:export` ni `actividades:annul` de forma general.

Verificación posterior:
- 2 operadores activos y verificados con Consulta, Crear y Editar en Actividades.
- 2 operadores con Crear en Personas para registrar participantes nuevos desde el portal.
- Módulo Actividades activo en el catálogo.
- 0 actividades actualmente en estado activa; debe crearse la primera actividad antes de registrar asistencias.

### Accesos de portada

- Se añadió una tarjeta visible `Registro de actividades` que abre `actividad.html`, portal protegido que exige inicio de sesión y permisos.
- Se añadió un acceso directo `Crear cuenta` en la cabecera de la portada, dirigido a `registro-usuario.html`.
- Se añadió el enlace para crear cuenta desde la pantalla de ingreso del portal.
- Se conservó el flujo existente de aprobación administrativa: crear una cuenta no concede acceso automáticamente.
- Se actualizaron versiones de caché de los scripts del portal.

### Validación técnica

- La URL de Neon usada por el cliente QA corresponde al endpoint `ep-mute-grass-b7qan4n6`, asociado a la rama QA `br-wild-surf-b74rsbpz`.
- Las comprobaciones SQL de permisos devolvieron 2 operadores con view/create/edit de Actividades y 2 con Personas:create.
- El portal sigue siendo privado: no se habilitó registro anónimo de asistencias.
- La rama `main` y la rama Neon `production` no fueron modificadas.
- No se reportan checks CI en la consulta del último commit; no declarar pruebas automatizadas aprobadas hasta tener ejecución verificable.

## Pendiente para habilitar usuarios en producción

Esta intervención está preparada en QA. Para que el personal la use desde la URL productiva se requiere autorización expresa para promover únicamente estos cambios puntuales a `main` y aplicar los permisos equivalentes en la rama Neon `production`. No se debe fusionar la rama QA completa, que está divergente de `main`.
