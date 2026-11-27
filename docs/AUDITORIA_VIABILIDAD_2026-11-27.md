# Auditoría de viabilidad, ramas y conexiones — 2026-11-27

Alcance: repositorio `jdgarzoncam-bit/MIRAtuterritorio` (rama `main`, commit `46fc467`), proyecto Neon `soft-bar-53270058` (`my-first-project`) y todas sus ramas. Solo se hicieron **lecturas** en Neon; no se ejecutó ningún cambio de esquema, permisos ni datos. No se pudo abrir el sitio publicado en GitHub Pages desde la sesión de auditoría, por lo que la comprobación visual en navegador sigue pendiente.

## Veredicto de viabilidad

**Viable**, con tres condiciones antes de crecer: (1) tener copias de seguridad reales, (2) registrar la evidencia de consentimiento de datos personales y (3) endurecer algunos ajustes de autenticación. La arquitectura (sitio estático + Neon Auth + Data API con RLS) es adecuada para el tamaño actual (596 personas, 1 actividad activa, 8 perfiles) y no tiene costo de servidor propio. La base de datos de producción está limpia: sin asistencias huérfanas, sin cédulas duplicadas y sin cédulas nulas.

## Estado verificado de producción (rama `production`, `br-winter-night-b758ke2j`)

| Elemento | Valor |
| --- | --- |
| Personas / asistencias / actividades | 596 / 43 / 1 (activa) |
| Perfiles de usuario | 8 (1 admin, 1 operator, 6 viewer; 4 viewer inactivos) |
| InfoMIRA red | 636 |
| Eventos de auditoría | 202 |
| RLS | Activo en todas las tablas de negocio |
| Tablas sin RLS | `participant_access_attempts`, `participant_access_pin_config`, `participant_access_sessions` (sin grants para los roles de la API: no explotable hoy) |
| Grants a `anonymous` | Solo `INSERT` en `pqrs` y `reportes_ciudadanos` |
| Funciones `SECURITY DEFINER` | Todas fijan `search_path`; solo las RPC públicas previstas son ejecutables por anónimos |
| Código vs. Neon | Auth y Data API apuntan al mismo endpoint de producción `ep-round-dawn-b7l3ya3h` |

## Ramas de Neon

| Rama | Estado | Diferencia con producción | Recomendación |
| --- | --- | --- | --- |
| `production` (por defecto) | lista | referencia | Proteger la rama (`protected`) |
| `qa-role-capabilities-2026-11-10` | lista | Mismo esquema (34 funciones); datos distintos (3 actividades, 21 asistencias, 62 permisos vs 48) | Mantener como QA principal; refrescar desde producción antes de la próxima migración |
| `qa-control-admin-2026-11-17` | lista | Sin tablas de acceso PIN; 18 funciones (vs 34) | Obsoleta: eliminar o recrear |
| `qa-audit-export-reportes-cleanup` | lista | Sin tablas de acceso PIN; 18 funciones | Obsoleta: eliminar |
| `qa-personas-integrity-2026-11-18` | lista | Sin tablas de acceso PIN; 19 funciones | Obsoleta: eliminar |
| `pre-sync-production-2026-11-24` | lista | Copia previa a la sincronización del 24/11 | Conservar unos días como punto de retorno y luego eliminar |
| `sync-test-production-2026-11-24` | lista | Aún contiene la tabla retirada `reportes_operativos` | Eliminar |
| `mira-crud-dev`, `mcp-migration-2026-11-03…` | archivadas | Antiguas | Eliminar |

El plan gratuito permite 10 ramas y hay 8 en uso; llegar al límite impediría crear la rama QA de la próxima migración. Ninguna rama QA debe usarse como espejo de producción ni promoverse.

El mismo organizador tiene otros dos proyectos (`laus-accesorios-qa`, regiones `us-east-1` y `sa-east-1`) que no pertenecen a este sistema; conviene confirmar que no se necesitan.

## Hallazgos y estado

### Corregido en esta revisión
1. **Inyección de HTML en el portal público** (`activity-portal.js`): nombre y lugar de la actividad se insertaban con `innerHTML` sin escapar en una página sin sesión. Ahora se construyen con `new Option(...)`. Versión de caché actualizada (`20261127-safe-options-1`).
2. **Versión única de `mira-data.js`** (`?v=20261127-data-unified-1`): había tres URLs distintas del mismo módulo, lo que crea instancias separadas y puede dejar una copia vieja en caché. Prueba de regresión incluida.
3. **Despliegue**: `pages.yml` valida (`npm run validate`) antes de publicar y publica solo los archivos del sitio (sin `docs/`, `migrations/`, `tests/`, workflows ni copias ZIP).
4. **ZIP de 410 KB versionado en la raíz** (copia antigua del proyecto con migraciones y documentos distintos): retirado del repositorio y añadido a `.gitignore`. Sigue disponible en el historial de Git.
5. **`package.json`, `scripts/check-syntax.cjs` y README**: se añadieron comandos `npm run validate`, y el README (estaba vacío) documenta estructura y reglas.
6. **Pruebas nuevas** (`tests/site-hygiene.test.cjs`, `tests/module-version-consistency.test.cjs`): referencias locales existentes, portal sin `innerHTML` interpolado, versión única del cliente de datos. Total: 42 pruebas, todas pasan.

### Pendiente — requiere decisión o acceso del propietario
| Prioridad | Hallazgo | Acción recomendada |
| --- | --- | --- |
| Alta | **No hay snapshots ni programación de respaldo** en Neon y la retención de historial es de 6 horas | Crear un snapshot manual de `production` ya y programar uno periódico; exportar `personas` y `asistencias` cifradas fuera de Neon |
| Alta | **El consentimiento no se guarda**: `public_register_activity_participant_v2` recibe `p_consentimiento`, pero `personas` y `asistencias` no tienen columnas de consentimiento (solo `testigos_publicos`) | Migración en QA: `consentimiento_datos`, `consentimiento_en`, `consentimiento_version` y escribirlos en la RPC. Es evidencia necesaria bajo la Ley 1581 de 2012 |
| Alta | `revoke_sessions_on_password_reset = false` | Activarlo: un restablecimiento de contraseña debería cerrar las sesiones abiertas |
| Media | Neon Auth: `verify_email_on_sign_up` y `verify_email_on_sign_in` en `false` pero `require_email_verification` en `true`; configuración contradictoria | Unificar y probar el registro completo en QA |
| Media | `allow_localhost` y orígenes `localhost:8000` / `127.0.0.1:8000` activos en producción | Quitarlos de producción y dejarlos solo en una rama QA |
| Media | El correo de Auth sale de `auth@mail.myneon.app` (proveedor compartido) | Configurar un remitente propio para evitar spam y mejorar la confianza |
| Media | Rama `production` sin protección | Marcarla como protegida |
| Media | Sin CSP ni SRI para `unpkg.com`, `cdn.jsdelivr.net` y `esm.sh` (`@neondatabase/auth@0.7.0-beta`, versión beta) | Añadir `integrity` a las librerías, fijar la versión de Auth y valorar una CSP. No se calcularon los hashes porque la sesión no tiene salida a esas CDN |
| Media | `xlsx@0.18.5` es una versión con avisos de seguridad en el análisis de archivos; MIRA solo **escribe** Excel, por lo que la exposición es baja | Pasar a la versión oficial de SheetJS 0.20.x |
| Baja | El UUID del administrador principal está fijo en `pqrs.js` y `reportes.js` (`ADMIN_ID`) | Es solo control de interfaz (la seguridad real es RLS), pero conviene derivarlo de un rol del servidor |
| Baja | `mira-data.js` contiene un endpoint E-14 (`…-e14secure.compute…`) detrás de `assertTestigosEnabled`; el módulo de testigos está bloqueado | Confirmar si sigue vigente; si no, borrar el código muerto |
| Baja | Restos heredados: claves `faca_evidencias_testigos` y `mtt_*` en `localStorage` | Retirar cuando se confirme que ya no se usan |
| Baja | `app.js` tiene 4.067 líneas y `style.css` 8.618 | Dividir por módulos antes de añadir funciones nuevas |
| Baja | `docs/neon-security.sql` es un archivo histórico marcado "NO EJECUTAR" | Eliminarlo para que nadie lo ejecute por error |

## Hoja de ruta sugerida

1. **Esta semana**: snapshot de producción, activar revocación de sesiones al restablecer contraseña, quitar localhost de producción, proteger la rama `production`.
2. **Próximas dos semanas**: migración de consentimiento (primero en QA), política de tratamiento de datos visible en los formularios públicos, limpieza de ramas obsoletas.
3. **Siguiente mes**: SRI y CSP, actualizar SheetJS, dividir `app.js`, y una prueba de humo automatizada con navegador (Playwright) para los flujos de registro y de administración.
4. **Producto**: panel de tendencias de participación por barrio, recordatorio por WhatsApp a inscritos, y un reporte mensual automático para el concejal. Estas ideas dependen de la consolidación del consentimiento y de los respaldos.
