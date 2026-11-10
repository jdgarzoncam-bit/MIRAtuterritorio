# Estado técnico E-14 — revisión 2026-11-05

## Hallazgos verificados

- Rama revisada: `feat/landing-reportes-testigos-e14`.
- HEAD observado al inicio de la revisión: `a292beaee5bd0e6c14dd7966120a78e603580971`.
- Commit de referencia `8ce027ea87d5ea244eceade03adf3441b89d54c2`: únicamente refrescó versiones de caché de `index.html`.
- Frontend: `mira-data.js` invoca un endpoint llamado `e14secure` para `presign-upload`, `confirm-upload` y `download`. La carga binaria se envía con PUT a la URL firmada.
- El listado usa directamente Data API sobre `mira.evidencias_e14`, con permisos RLS.
- Neon project `soft-bar-53270058`, branch `br-winter-night-b758ke2j` (production), database `neondb`.
- La tabla `mira.evidencias_e14` tiene PK UUID, clave de objeto única, índice por puesto/mesa/fecha, índice único parcial de legacy_id por uploaded_by y restricciones de tipos MIME y tamaño máximo de 12 MiB.
- RLS está habilitada. Políticas visibles: SELECT requiere `mira.has_module_permission('testigos','view')`; INSERT requiere `mira.has_module_permission('testigos','create')` y `uploaded_by = auth.jwt()->>'sub'`. No se encontró política DELETE.
- El trigger `trg_e14_limit_70` corre BEFORE INSERT y llama a `mira.enforce_e14_limit_70()`; usa `pg_advisory_xact_lock(hashtextextended('mira.evidencias_e14:limit-70',0))`, cuenta las filas y rechaza cuando hay 70. El límite es atómico para inserciones que disparen el trigger.
- La tabla estaba vacía en el momento de la consulta; el bucket privado `mira-testigos-evidencias` también estaba vacío.
- Neon Functions list/get no encuentra `e14secure` en la rama `production`; list_functions devolvió vacío y get_function devolvió 404. La revisión de otras ramas encontró `e14secure` activa (deployment 2, Node.js 24, estado completed) en la rama temporal `mcp-migration-2026-11-03T22-29-59` (`br-lucky-boat-b70mmt53`). Su URL de invocación corresponde a esa rama y no coincide con el hostname de producción usado por el frontend. La acción get_function solo devuelve metadatos, no el paquete/código fuente ni su configuración de entorno. No se promovió ni sobrescribió ese deployment.
- La UI comprueba el límite con un listado previo en cliente, pero ese chequeo es orientativo; la protección concurrente depende del trigger SQL.
- La migración local crea primero un respaldo cifrado descargable y no borra los originales locales.
- La galería genera una URL temporal de descarga por imagen. No existe control de borrado en la interfaz revisada.

## Bloqueos y riesgos pendientes

1. Recuperar el paquete/código fuente y la configuración segura del deployment 2 de `e14secure` en la rama Neon temporal. El recurso está identificado, pero la herramienta de gestión devuelve únicamente metadatos. Determinar también por qué el frontend de GitHub apunta a un hostname de production donde el recurso no existe.
2. Confirmar si el JWT entregado por `miraToken()` contiene `sub` con el mismo identificador que `auth.user_id()` en las políticas SQL.
3. Añadir una política RLS DELETE alineada con `mira.has_module_permission('testigos','delete')` y GRANT DELETE, después de verificar el flujo real de identidad y autorización.
4. La secuencia actual sube el objeto antes de confirmar metadatos. Si la confirmación falla, el objeto puede quedar huérfano; se requiere una rutina compensatoria segura en el backend verificado.
5. Añadir eliminación coordinada y autorizada de metadatos y objeto, con comprobación de propiedad y permisos; no se ha ejecutado borrado.
6. La vista limita el resultado a 100 registros aunque el máximo operativo es 70.

## Cambios de esta revisión

No se modificó el código del backend ni se desplegó una función: aunque se localizó el deployment activo en la rama temporal, no fue posible recuperar su paquete ni verificar el código operativo. No se cambió el esquema ni se eliminaron datos. No se integró la rama en `main`.

## Pruebas

Solo se realizaron lecturas de repositorio, metadatos, esquema, RLS, trigger, funciones SQL y listado de objetos. No se usaron imágenes reales ni se ejecutaron cargas, descargas o eliminaciones de prueba.

## Verificación de privilegios y CI

- Grants efectivos comprobados para el rol authenticated: SELECT=true, INSERT=false y DELETE=false. El navegador no inserta ni elimina directamente vía Data API; esas operaciones dependen del servicio privado.
- El último workflow «Validar JavaScript de MIRA» completado con éxito antes de esta revisión corresponde al commit a292beaee5bd0e6c14dd7966120a78e603580971 (4 de noviembre de 2026). Ejecutó node --check sobre app.js, mira-data.js, mira-auth.js y pmu-navigation.js. Los commits de esta revisión solo modifican este documento, por lo que esos archivos siguen siendo los mismos validados.
- El workflow se ejecuta en pull requests hacia main; los commits documentales de esta revisión no dispararon una nueva ejecución. El estado combinado de checks del HEAD documental no muestra checks.

## Estado de rama

- HEAD documental de esta revisión: 2b8e7e9472c1ec550e9b092a0093224c66684594.
- Comparación con main: divergente; 2 commits propios por delante y 13 commits por detrás, con base común a292beaee5bd0e6c14dd7966120a78e603580971.
- No se creó merge, pull request ni despliegue de GitHub Pages.
## Desactivación temporal de Testigos / Auditoría E-14 — 2026-11-05

- En `index.html` se sustituyó el acceso lateral de Auditoría Testigos por un módulo bloqueado con aviso de renovación y candado. Se retiró el botón «Ver y Descargar Actas E-14» y el acceso rápido Testigos quedó deshabilitado.
- Se retiró la opción «Auditoría Testigos» del selector de módulo relacionado en el formulario PQRS.
- El portal legado y el modal E-14 permanecen inertes/ocultos para evitar romper referencias antiguas de DOM.
- `app.js` establece `window.MIRA_TESTIGOS_TEMP_DISABLED = true`, bloquea los antiguos selectores de entrada y evita inicializar las operaciones de captura local y E-14.
- `mira-data.js` ahora rechaza `e14Request()` y `listE14Evidence()` mientras la bandera temporal no sea desactivada explícitamente en una futura validación.
- `mira-admin.js` mantiene `dropdown-testigos` bloqueado incluso para el administrador principal y retira temporalmente Testigos de la matriz de permisos granulares.
- Las rutas directas `testigo-publico.html` y `testigos-admin.html` se convirtieron en pantallas estáticas de módulo inactivo y ya no cargan los JavaScript antiguos.
- Se actualizaron los parámetros de caché de `mira-data.js`, `app.js` y `mira-admin.js`.
- La revisión de Neon confirmó 0 filas en `mira.evidencias_e14` y 0 filas en `mira.testigos_publicos`. No se eliminaron datos.
- En la revisión del 2026-11-05 todavía no se habían modificado permisos y políticas. **Actualización:** el 2026-11-10 se aplicó en producción la migración `ac69dbd6-3cf5-4cc5-82aa-d3d01764d4a7`: Testigos quedó inactivo en el catálogo, `has_module_permission()` deniega todas sus acciones incluso al administrador y se revocó INSERT anónimo en `testigos_publicos`; su política pública de inserción fue eliminada. Las verificaciones posteriores confirmaron los cambios.
- La revocación temporal de esos privilegios/políticas queda pendiente de definir el alcance exacto de reconstrucción de autenticación/seguridad. La autenticación global Neon Auth y las políticas RLS de los demás módulos se conservaron.

## Estado de GitHub tras la desactivación

- HEAD de la rama al cierre de esta actualización: pendiente de verificar tras guardar este documento.
- Comparación observada con `main`: divergente, 10 commits propios por delante y 13 por detrás; base común `a292beaee5bd0e6c14dd7966120a78e603580971`.
- `main` no se modificó y no se creó despliegue ni merge.
- La ejecución CI más reciente con éxito sigue siendo la validación anterior del commit `a292bea...`; los cambios actuales no se han ejecutado en CI ni probado en navegador.

## Refuerzo de cierre temporal — 2026-11-09

### Estado de producción

- La revisión confirmó que `mira.module_catalog` todavía marca `testigos.active=true`.
- `anonymous` mantiene INSERT en `mira.testigos_publicos`, con una política pública de inserción. La tabla no tiene filas.
- `authenticated` tiene SELECT y UPDATE en `testigos_publicos`, pero las políticas RLS los condicionan a `mira.has_module_permission('testigos', ...)`.
- Las tablas `evidencias_e14` y `testigo_archivos` también dependen de esa función para autorizar consulta/escritura.

### Migración preparada, probada y aplicada en producción — 2026-11-10

- Migration ID: `ac69dbd6-3cf5-4cc5-82aa-d3d01764d4a7`.
- Rama temporal: `br-dry-snow-b704rkb5`, creada desde producción.
- El cambio obliga a comprobar el estado activo del catálogo para todos los roles, incluida la cuenta administradora principal; rechaza acciones fuera de la lista permitida y bloquea Testigos explícitamente hasta su futura reconstrucción.
- La migración marca el módulo Testigos inactivo, revoca INSERT anónimo en `testigos_publicos` y elimina `witnesses_public_insert`.
- Las pruebas aisladas confirmaron que Testigos queda denegado incluso para el administrador; Actividades y Control Administrativo siguen habilitados para el administrador; Logística inactiva y acciones inválidas quedan denegadas.
- La función conserva `SECURITY DEFINER` y `search_path=pg_catalog,mira,auth`.
- En la rama temporal, las tablas públicas y E-14 continuaron con 0 filas.
- **Producción aplicada:** Neon confirmó la aplicación de la migración a `br-winter-night-b758ke2j`; la rama temporal `br-dry-snow-b704rkb5` fue eliminada al finalizar.

### Barreras de interfaz/API

- En `mira-data.js` se instaló un guard de cierre antes de solicitar tokens o llamar a red para listar/actualizar testigos, consultar archivos y ejecutar operaciones E-14 (consulta, carga y descarga).
- Se añadió una suite Node de regresión en `tests/testigos-inactive.test.cjs`, que prueba que las siete operaciones fallan cerradas y que Actividades continúa consultando normalmente.
- El workflow de validación se amplió para ejecutar la suite en cada push a `feat/landing-reportes-testigos-e14` y en pull requests hacia `main`. GitHub Actions run #59 finalizó `success` sobre el HEAD `b646148cb8dd053fdceae9a2a182d179a272cb53`; ejecutó las comprobaciones `node --check` y `node --test tests/*.test.cjs`: https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/42718784604.

### Deployment antiguo e14secure

- Producción no tiene una Neon Function `e14secure` desplegada.
- La rama antigua `br-lucky-boat-b70mmt53` conserva un deployment activo de `e14secure` (deployment 2, Node.js 24). El endpoint apunta a esa rama antigua y su código fuente/configuración no están disponibles en la salida de metadatos.
- Esa copia tenía 0 filas de `evidencias_e14` y `testigos_publicos` al revisarla, pero su catálogo seguía con Testigos activo.
- No se eliminó ni modificó la función ni la rama, porque se requiere autorización expresa. Eliminar la rama completa también eliminaría su copia de base de datos; la alternativa menos destructiva es eliminar únicamente el deployment de la función, aunque habría que decidir si la API Data de la rama antigua también debe cerrarse.

### Pruebas no realizadas

- No se cargaron ni descargaron evidencias reales.
- No se hizo prueba visual de Testigos ni Control Administrativo en navegador; la rama de trabajo no está desplegada y la aplicación no se encontraba abierta en el navegador conectado.


## Verificación posterior en producción — 2026-11-10

- `mira.module_catalog` muestra `testigos.active=false`.
- `mira.has_module_permission('testigos', 'view'|'create'|'delete')` devuelve `false` para el administrador principal y sin identidad.
- El administrador conserva Consulta en Actividades y Control Administrativo; Logística inactiva y acciones no reconocidas son denegadas.
- `anonymous` ya no tiene INSERT en `mira.testigos_publicos`; la política `witnesses_public_insert` no existe.
- `mira.testigos_publicos` y `mira.evidencias_e14` siguen con 0 filas. No se borraron datos.
- La rama temporal de la migración fue eliminada por el proceso de finalización.
- La rama de producción no tiene una Neon Function `e14secure` desplegada. Se conserva el bloqueo de rutas en la interfaz y los guards de `mira-data.js`.

