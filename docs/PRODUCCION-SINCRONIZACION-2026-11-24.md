# Sincronización de esquema de producción — 24/11/2026

## Alcance aplicado

Rama Neon de destino: `production` (`br-winter-night-b758ke2j`).

Copia previa de producción: `pre-sync-production-2026-11-24` (`br-young-dawn-b73hds31`). La rama se creó, pero Neon no permitió marcarla como protegida por el límite de ramas protegidas del plan.

Rama de ensayo: `sync-test-production-2026-11-24` (`br-broad-dew-b7di1b7f`). La migración completa se ejecutó allí antes de aplicarse en producción.

## Objetos incorporados

### Siete tablas

- `actividades_change_audit`
- `asistencias_change_audit`
- `audit_events`
- `personas_change_audit`
- `participant_access_attempts`
- `participant_access_pin_config`
- `participant_access_sessions`

Las tablas de auditoría comienzan vacías en producción; no se copiaron eventos históricos de QA. Tampoco se copiaron intentos ni sesiones temporales del PIN.

### Columnas

En `mira.personas`:

- `barrio`
- `fuente_registro`
- `datos_pendientes`
- `inactivo`
- `tiene_app_infomira`

Además, `cedula_normalizada` quedó NOT NULL y con restricción de consistencia.

En `mira.asistencias`:

- `estado`
- `anulada_at`
- `anulada_por`
- `motivo_anulacion`

`estado` quedó NOT NULL, con valor predeterminado `activa` y restricción de valores permitidos.

### Funciones, disparadores y seguridad

- Se incorporaron las 23 funciones SQL que faltaban y se actualizaron las funciones existentes que tenían definiciones distintas.
- Se añadieron 18 disparadores; producción quedó con los mismos 25 disparadores de QA.
- Las 48 políticas RLS y los 48 permisos de tabla para `anonymous`/`authenticated` quedaron alineados con QA.
- Se corrigió la política de Personas para usar el módulo `personas`.
- InfoMIRA quedó en consulta: sin permisos de escritura para `authenticated`.
- PQRS conserva la política de consulta delegada.
- Se habilitó la acción `annul` en la restricción de `module_permissions`.
- La función de activación de perfiles conserva la validación estricta que ya tenía producción (correo verificado y al menos un permiso de consulta activo), limitada a la creación/activación. No se reemplazó por la versión menos estricta de QA.
- La función antigua de registro sin token y la función de comprobación pública de existencia de persona quedaron sin permisos de ejecución. El flujo vigente con PIN y token temporal sí conserva sus permisos previstos.

### PIN

Se copió la configuración protegida de QA a producción mediante su verificador PBKDF2 y salt; no se copió ni expuso el PIN en texto claro. La configuración quedó habilitada con 310.000 iteraciones. El fingerprint calculado en ambos entornos coincide.

## Datos preservados

No se copiaron ni sobrescribieron personas, actividades, asistencias, InfoMIRA, PQRS, perfiles ni permisos desde QA.

Conteos de producción después de la sincronización:

- Personas: 586
- Actividades: 4
- Asistencias: 3
- InfoMIRA: 636
- PQRS: 1
- Perfiles: 8
- Permisos de módulos: 38

La normalización de estados dejó 492 personas activas y 94 inactivas, sin contradicciones entre `activo` e `inactivo`.

Se preservaron la tabla `reportes_operativos` y el módulo `reportes`, que existen en producción pero no en QA.

Se añadieron al catálogo de producción los módulos `personas` y `base_datos_general`. No se copiaron las filas de `module_permissions` ni los roles de QA: producción conserva sus 38 permisos y sus roles actuales para evitar promover cuentas sin una revisión explícita.

## Verificación posterior

- Tablas: QA tiene 22 tablas `mira`; producción tiene 23 porque conserva `reportes_operativos`.
- Columnas de Personas y Asistencias: coincidencia exacta con QA.
- Funciones: 32 en cada entorno; las definiciones coinciden salvo `enforce_profile_activation_requirements`, que conserva la validación adicional de producción.
- Disparadores: 25 y coincidentes.
- Políticas RLS: 48 y coincidentes.
- Permisos de tabla para roles de aplicación: 48 y coincidentes.
- Restricciones: las de QA quedaron aplicadas; se conservaron además las restricciones de `reportes_operativos`.
- Configuración del PIN: fingerprint idéntico entre QA y producción.
- Sesiones e intentos de PIN en producción: 0 al finalizar.

La migración se ensayó en una copia de producción y después se aplicó en una transacción de 138 sentencias en la rama `production`. La prueba interactiva completa del flujo PIN/inscripción debe terminarse desde la aplicación con una sesión real; no se declara como prueba de navegador completada.
