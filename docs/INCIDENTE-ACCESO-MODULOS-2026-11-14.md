# Incidente de acceso a módulos — diagnóstico inicial 2026-11-14

## Resumen ejecutivo
El usuario reporta que al ingresar al sistema todos los módulos aparecen bloqueados. La captura muestra el PMU y el mapa cargados, marcadores visibles y estadísticas globales en cero. La captura por sí sola no demuestra pérdida de datos ni de permisos.

Se realizaron comprobaciones de solo lectura en GitHub y Neon. No se modificaron datos, permisos, políticas, autenticación, despliegues ni ramas de producción.

## Hallazgos comprobados en Neon producción
Proyecto `soft-bar-53270058`, branch `br-winter-night-b758ke2j` (`production`):
- El perfil del administrador principal existe.
- `role=admin`, `active=true`, `email_verified=true`.
- El catálogo conserva activos: Actividades, Centro de Operaciones, Concejal, Control Administrativo, InfoMIRA, PQRS y Reportes.
- Logística y Testigos permanecen inactivos, conforme a las decisiones previas.
- El administrador principal no tiene filas propias en `module_permissions`. Esto es compatible con el bypass administrativo implementado y no constituye por sí mismo pérdida de permisos.
- No se encontraron cambios de escritura durante esta auditoría.

## Diferencia crítica entre código publicado y rama QA
Se compararon archivos de `main` y `preview/neon-qa-control-admin`:
- `main/mira-auth.js` utiliza `createAuthClient`, `auth.token()` y el endpoint de Neon Auth/REST del branch de producción `ep-round-dawn-b7l3ya3h`.
- La rama QA usa `createInternalNeonAuth`, `getJWTToken()`, `getAnonymousToken()` y endpoints del branch QA `ep-mute-grass-b7qan4n6`.
- QA añade validaciones más estrictas: identidad de perfil, rol admin principal, perfil activo/verificado, catálogo de módulos activos, exclusión explícita de Testigos/Control Administrativo y reintentos ante errores temporales.
- `main/index.html` referencia versiones de caché de noviembre 3–5; QA tiene referencias más recientes, MapLibre y cambios de noviembre 13–14.
- Los workflows de validación de QA incluyen pushes a la rama QA; el workflow de `main` valida PRs hacia main. No se encontró un workflow `deploy.yml` en ninguna de las dos ramas al consultar esa ruta.
- La rama QA no debe asumirse publicada automáticamente. Por tanto, el usuario puede estar viendo una versión distinta de la que se ha estado auditando.

Este desfase es un factor de riesgo importante y debe aclararse con la URL exacta que el usuario abrió y la configuración de GitHub Pages/deployment. No se afirma que sea la causa única sin una reproducción de navegador.

## Hallazgo de interfaz
En `preview/neon-qa-control-admin/index.html`, el único módulo del menú lateral que tiene clase `module-access-restricted` y overlay de bloqueo estático es Testigos y Auditoría E-14. El CSS aplica blur y deshabilita pointer events a ese bloque, no a todos los módulos. En `app.js`, el menú rápido deshabilita Testigos intencionalmente y permite Actividades al administrador principal reconocido por rol + auth_user_id. El PMU principal se inicializa después de la validación de sesión.

La captura muestra texto del menú lateral desenfocado; no se debe concluir solo por la imagen que todos los botones tienen disabled=true. Hace falta inspeccionar el DOM y consola de la sesión real.

## Estadísticas en cero
La imagen muestra 0 líderes, 0 activos y 0 referidos. No se hizo una consulta de datos de origen para determinar si esos ceros representan ausencia real, un filtro/estado inicial, fallo de carga o un widget no conectado. Debe comprobarse en navegador y con consultas SELECT a las tablas de origen antes de atribuirlo a pérdida de datos.

## Hipótesis priorizadas
1. Desfase entre la versión de GitHub Pages abierta y el código QA que se ha auditado.
2. Error al restaurar sesión o recuperar JWT/perfil que deja la interfaz parcialmente montada.
3. Error de inicialización de la navegación/estado de módulos después del evento `mira:authenticated`.
4. Fallo de consultas de permisos o datos que el frontend representa como bloqueo/estadísticas en cero.
5. Problema de caché del navegador o referencias de recursos antiguos en `index.html`.

## Pruebas necesarias para cerrar diagnóstico
- Obtener URL exacta abierta y comprobar qué commit/recurso se sirve.
- En DevTools, revisar Console y Network (sin compartir contraseñas, tokens, cookies ni encabezados Authorization).
- Confirmar respuesta de sesión de Neon Auth, consulta de `user_profiles`, catálogo y permisos, status HTTP y errores CORS/401/403/404.
- Inspeccionar DOM: `window.MIRA_CURRENT_USER`, estado de `#app-container`, clases `module-access-restricted`, atributos `disabled`/ `aria-disabled` de cada módulo y errores de inicialización.
- Validar consultas SELECT de las tablas que alimentan líderes/activos/referidos y comparar con filtros aplicados.
- Repetir en incógnito o con caché deshabilitada después de identificar la versión exacta.

## Próxima intervención segura
1. No continuar integración 3D.
2. Reproducir el acceso con el navegador conectado o con diagnóstico del usuario.
3. Identificar si el usuario está en `main`/producción o en QA.
4. Corregir el flujo de inicialización en rama QA, con pruebas para administrador, operador y visor.
5. Probar menú, apertura de módulos, carga de datos y estadísticas; confirmar que Testigos y módulos inactivos siguen bloqueados.
6. Solo después de aprobación explícita, planificar publicación. No tocar Neon producción ni hacer merge automáticamente.

## Límites de esta revisión
La consulta SQL fue de solo lectura. No se realizó una prueba de navegador autenticada, no se accedió a la sesión activa del usuario y no se cambió ninguna configuración. La causa raíz final queda abierta hasta obtener la URL y errores de navegador.
