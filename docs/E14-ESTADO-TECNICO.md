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
