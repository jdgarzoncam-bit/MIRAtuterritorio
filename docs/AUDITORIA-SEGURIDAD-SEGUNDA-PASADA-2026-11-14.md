# Segunda pasada de auditoría de seguridad — 2026-11-14

## Alcance y límites

Revisión de solo lectura sobre GitHub `main`, `preview/neon-qa-control-admin`, configuración de Neon Auth y metadatos/políticas de PostgreSQL. No se modificó producción, Neon, datos ni despliegues. No se ejecutó una prueba destructiva ni una prueba real de escritura como usuario anónimo. El escaneo de malware no equivale a un antivirus del artefacto publicado ni a un análisis dinámico de dependencias.

## Hallazgos prioritarios

### 1. Divergencia de ramas — bloqueante para publicar
Comparación `main...preview/neon-qa-control-admin`:
- Estado: `diverged`.
- QA: 347 commits por delante y 15 por detrás de `main`.
- No hacer merge directo ni publicar QA como reemplazo de producción.
- La comparación reporta cambios en autenticación, cliente de datos, panel admin, PQRS, permisos, cartografía y migraciones. Requiere reconciliación explícita sobre una base común y revisión de cada diff.

### 2. Acceso al PMU y restauración de sesión
En `main`:
- `#app-container` está oculto por CSS (`display:none`).
- `activarPMUAutenticado()` es la función que lo muestra después de establecer identidad autenticada.
- `mira-auth.js` ejecuta `auth.getSession()` en la carga y restaura una sesión válida. Por tanto, no pedir contraseña en cada carga puede ser restauración de sesión, no acceso anónimo.
- La portada pública contiene las tarjetas de Reportes ciudadanos y PQRS; ese acceso público está previsto.
- En Neon producción se observó una sesión vigente asociada al único perfil admin activo/verificado, expira el 2026-11-20. Es coherente con la restauración automática.
- La pestaña del navegador conectada durante la revisión estaba en `http://localhost:8000/`; no es evidencia del estado de la web publicada. El texto extraído del DOM no demuestra qué elementos estaban visualmente visibles.
- No se pudo ejecutar una prueba real en navegador privado/cookies limpias ni observar estilos computados o red. Queda pendiente para cerrar el incidente reportado.

### 3. Neon Auth producción frente a QA
Producción (`br-winter-night-b758ke2j`) y QA (`br-wild-surf-b74rsbpz`) comparten:
- Registro email/password habilitado.
- `allow_localhost=true`.
- Origen confiable `https://jdgarzoncam-bit.github.io`.
- Verificación requerida declarada, aunque `verify_email_on_sign_up=false`; revisar la combinación y el flujo efectivo.
Diferencia:
- Producción: `revoke_sessions_on_password_reset=false`.
- QA: `revoke_sessions_on_password_reset=true`.
Recomendación: probar primero el flujo de recuperación y restablecimiento en QA, y preparar cambio controlado para producción. No se cambió la configuración.

### 4. Privilegios residuales en producción
En producción:
- Las 16 tablas del esquema `mira` tienen RLS habilitada.
- Ninguna de esas 16 tablas tiene `FORCE ROW LEVEL SECURITY`. El propietario de tabla puede omitir RLS; proteger credenciales privilegiadas y evitar su exposición desde cliente.
- El rol `anonymous` tiene INSERT en `pqrs`, `reportes_ciudadanos` y `reportes_operativos`.
- Los dos primeros formularios son públicos previstos. `reportes_operativos` conserva INSERT anónimo y SELECT autenticado pese a que el módulo fue retirado del flujo activo. No eliminar ni borrar sus datos; retirar permisos/políticas residuales tras validar dependencias.
- No se observó grant directo de SELECT de tablas del esquema `mira` al rol anonymous en el inventario consultado.
- No fue posible ejecutar las consultas de prueba como rol `anonymous` porque el conector de Neon requiere credenciales de conexión para ese rol. El comportamiento efectivo del Data API sin token sigue sin prueba.

### 5. Funciones SECURITY DEFINER ejecutables por PUBLIC en producción
La auditoría de ACL encontró en producción que `PUBLIC`/anónimo puede ejecutar:
- `mira.has_module_permission(text,text)`
- `mira.is_active_admin()`
- `mira.audit_admin_changes()`
- `mira.enforce_profile_activation_requirements()`
- `mira.sync_auth_user_profile()`

Las funciones auxiliares de permisos devuelven booleanos, pero su ejecución pública no es necesaria para el cliente anónimo. Las funciones de trigger no deberían tener EXECUTE concedido a PUBLIC. La rama QA ya aplica REVOKE a estas funciones y concede EXECUTE de helpers solo a authenticated, manteniendo las funciones de trigger solo al propietario. Preparar y validar la misma corrección en producción en una migración revisada; no ejecutar automáticamente.

### 6. Matriz de Testigos inconsistente
- La función `mira.has_module_permission` en producción devuelve false para `testigos`.
- Sin embargo, se encontraron 5 permisos con `allowed=true` en `module_permissions` para `testigos`.
- La protección efectiva SQL está cerrada, pero la matriz almacena permisos que contradicen la decisión de mantener el módulo inactivo.
- QA contiene barreras adicionales y pruebas que impiden invocar rutas de datos del módulo mientras está inactivo. Hay que revisar la migración de sincronización antes de ajustar los datos.

### 7. Pruebas y publicación
- `main/.github/workflows/pages.yml` ejecuta `node --check` sobre JavaScript y luego publica. No ejecuta pruebas unitarias, análisis de dependencias, escaneo de secretos ni validación de permisos.
- QA `.github/workflows/validate.yml` ejecuta `node --test tests/*.test.cjs` además de validación sintáctica.
- Las pruebas QA existentes son principalmente aserciones estáticas sobre cadenas/expresiones del código y migraciones; no equivalen a pruebas end-to-end de navegador ni a pruebas de autorización real contra el Data API.
- Hubo una ejecución QA fallida inmediatamente antes de una posterior exitosa. El estado de la última ejecución listada es exitoso, pero no prueba la seguridad completa.

### 8. Revisión estática de código / malware
- En archivos principales examinados no se identificó uso evidente de `eval()`, `new Function()` o `document.write()`.
- `electoral-winners.js` contiene datos comprimidos/codificados en Base64 con GZIP; esto puede ser una técnica de empaquetado de datos y no demuestra malware.
- Hay dependencias remotas sin fijación de integridad uniforme (por ejemplo SheetJS y MapLibre en QA); revisar versiones, hashes/SRI, licencias y cadena de suministro.
- Hay múltiples asignaciones a `innerHTML`; revisar exhaustivamente cada origen de datos y el escape aplicado, especialmente datos procedentes de Neon.
- No se encontró evidencia concluyente de malware en las muestras examinadas. No se ejecutó antivirus ni análisis dinámico integral del artefacto servido; no declarar el sitio libre de malware.

## Plan de remediación propuesto — sin ejecutar en producción

1. Reproducir acceso con perfil limpio: incógnito, sin cookies/storage, sesión vencida, cuenta suspendida y cuenta sin módulos.
2. Confirmar que solo la portada pública, PQRS y reporte ciudadano sean accesibles sin autenticación; verificar que el PMU y todas sus rutas de datos estén cerrados.
3. Preparar migración de mínimos privilegios para producción: REVOKE EXECUTE de funciones SECURITY DEFINER a PUBLIC/anonymous y limitar EXECUTE de helpers a authenticated; retirar INSERT/SELECT residual de `reportes_operativos` tras confirmar que no exista dependencia activa.
4. Reconciliar los 5 permisos Testigos residuales sin borrar datos ni activar el módulo.
5. Revisar todas las políticas RLS, grants de secuencias, funciones RPC, vistas, triggers, Storage/objetos, CORS y esquemas expuestos.
6. Ejecutar pruebas reales con perfiles de consulta, operador, administrador, suspendido y anónimo, comprobando SELECT/INSERT/UPDATE/DELETE/EXECUTE.
7. Añadir al workflow de publicación: suite de pruebas, análisis estático, escaneo de secretos, auditoría de dependencias y revisión del artefacto antes del deploy.
8. No fusionar ramas ni continuar la integración 3D hasta reconciliar seguridad, probar la publicación y obtener una versión estable.

## Estado

**No apto todavía para declarar seguro ni para continuar con la integración cartográfica en producción.** Se identificaron correcciones concretas y verificables; faltan pruebas dinámicas y la aplicación controlada de los cambios tras validarlos en QA.
