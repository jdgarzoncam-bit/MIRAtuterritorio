# Auditoría focalizada — Control Administrativo y panel de permisos
**Fecha:** 10 de noviembre de 2026  
**Rama revisada:** `feat/landing-reportes-testigos-e14`  
**Repositorio:** `jdgarzoncam-bit/MIRAtuterritorio`  
**Base productiva:** Neon `soft-bar-53270058` / `br-winter-night-b758ke2j` / `neondb`

## 1. Conclusión ejecutiva

Control Administrativo tiene una estructura de seguridad válida en su núcleo: la identidad administradora está restringida a una cuenta específica, las tablas administrativas tienen RLS, el historial no acepta escrituras directas del rol `authenticated`, los cambios de perfil/permisos se auditan y el servidor valida los permisos de cada módulo.

Pero **no está listo para declararse 100% funcional ni para certificar que cada permiso otorgado hace exactamente lo que anuncia la matriz**. Hay discrepancias reales entre el catálogo, los controles visuales, los métodos del cliente y las políticas de PostgreSQL. También hay una inconsistencia de estado en una cuenta productiva y riesgos de sincronización.

No se modificó código funcional, permisos ni datos de producción durante esta auditoría. Los hallazgos se documentan para planificar la corrección controlada.

## 2. Estado real de los perfiles y permisos en producción

La consulta de producción encontró:

- 1 cuenta administradora principal.
- 7 perfiles no administradores: 2 activos y con correo verificado; 5 inactivos.
- **Una de las dos cuentas activas y verificadas no tiene ningún permiso de Consulta.** El inicio de sesión actual la rechaza porque `mira-auth.js` exige al menos un permiso de un módulo activo. Sin embargo, el panel la clasifica en la pestaña “Aprobados” porque solo considera `active=true` y `email_verified=true`.
- La otra cuenta activa tiene únicamente `actividades:view`.
- Tres perfiles inactivos y con correo verificado conservan permisos de Consulta para seis módulos activos: Actividades, Centro de Operaciones, Concejal, InfoMIRA, PQRS y Reportes. Al aprobarlos se habilitaría ese acceso amplio, salvo los módulos que no tengan una ruta funcional.
- Dos perfiles inactivos no tienen correo verificado; uno de ellos conserva solo permisos antiguos de Testigos.
- Todos los perfiles no administradores tienen actualmente el rol `viewer`.

### Resumen de permisos almacenados

| Indicador | Estado comprobado |
|---|---:|
| Filas de permisos con `allowed=true` | 26 |
| Permisos Consulta (`view`) | 26 |
| Crear / Editar / Eliminar concedidos | 0 |
| Exportar / Administrar concedidos | 0 |
| Filas duplicadas por perfil/módulo/acción | 0 |
| Permisos antiguos de Testigos todavía concedidos en tabla | 5 |

Los cinco permisos históricos de Testigos permanecen guardados en `module_permissions`. El bloqueo SQL impide utilizarlos mientras el módulo esté inactivo, pero el panel oculta la fila de Testigos y no permite revisarlos ni retirarlos. Si se reactiva Testigos en el futuro, esos permisos volverían a ser efectivos salvo que se limpien o se revisen primero.

**Lectura operativa:** hoy los perfiles no administradores no tienen permisos de escritura concedidos. Aunque la matriz ofrece Crear/Editar/Eliminar, en producción esas capacidades todavía no están asignadas a ningún perfil.

## 3. Hallazgos P1 — deben corregirse antes de certificar el módulo

### P1.1 — Permisos de activación y permisos efectivos pueden quedar desincronizados
El trigger `user_profiles_activation_gate` se ejecuta al insertar/actualizar `user_profiles` y al cambiar `active` o `email_verified`. Comprueba que exista al menos un permiso Consulta en un módulo activo. No se dispara cuando:
- se elimina o deshabilita el último permiso `view` de un usuario;
- se desactiva el módulo en `module_catalog`;
- se cambia la ruta o disponibilidad real del módulo en la interfaz.

Por eso puede quedar una cuenta activa y verificada sin ningún módulo utilizable. Ya existe un caso productivo: una cuenta con `active=true`, `email_verified=true` y cero permisos. El login la bloquea, pero la lista la presenta como aprobada.

**Corrección recomendada:** decidir una regla transaccional para la pérdida del último permiso utilizable. La opción más segura es impedir la operación que dejaría al perfil activo sin acceso, o suspenderlo automáticamente en la misma transacción. La matriz debe refrescar estado y pestaña después de cada cambio. La comprobación debe usar un único catálogo de módulos realmente disponibles, no solamente `module_catalog.active`.

### P1.2 — Reportes y PQRS pueden aprobar una cuenta sin darle un módulo utilizable
La lógica de aprobación en `mira-admin.js`, `mira-auth.js` y PostgreSQL permite cualquier `view` de un módulo activo, excepto Testigos y Control Administrativo. Incluye `reportes` y `pqrs`, pero:
- `reportes` no tiene entrada en `MODULE_TARGETS`; no hay ruta de menú asociada al permiso.
- Hay un método `listOperationalReports()` en `mira-data.js`, pero no se encontró un consumidor de esa operación en la interfaz.
- La pantalla llamada “Reportes ciudadanos” consulta otra tabla: `mira.reportes_ciudadanos`, y utiliza permisos `concejal:view/edit`, no `reportes:view`.
- `pqrs` aparece en la matriz y en `MODULE_TARGETS`, pero `pqrs.js` limita la bandeja administrativa a la cuenta administradora principal.
- La política SELECT de `mira.pqrs` permite leer al remitente o al administrador; no consulta `mira.has_module_permission('pqrs','view')`.

**Impacto:** un usuario puede superar la validación de aprobación con un permiso de Consulta que no le da acceso a una pantalla de gestión real. En particular, `pqrs:view` no autoriza la lectura de las PQRS ajenas.

**Corrección recomendada:** crear un mapa único y explícito `módulo → entrada UI → tablas → acciones RLS → condición de aprobación`. Quitar de la matriz los módulos que no estén implementados, o completar rutas y políticas antes de considerarlos válidos para aprobación.

### P1.3 — “Eliminar” en Actividades permite borrar más que actividades
Las políticas RLS de `mira.actividades`, `mira.asistencias` y `mira.personas` invocan todas `mira.has_module_permission('actividades','delete')`.

La interfaz ofrece un botón de eliminación de actividad con comprobaciones sobre asistencias asociadas. Sin embargo, a nivel de PostgreSQL, conceder `actividades:delete` también permite enviar DELETE directo sobre asistencias y personas (sujeto a las claves foráneas). El control del botón no reduce el alcance del permiso SQL.

**Impacto:** un operador con “Eliminar” puede borrar asistencias o fichas de personas mediante la API aunque no exista un botón visible para esas operaciones.

**Corrección recomendada:** separar los permisos por entidad o acción (por ejemplo, eliminar actividad, eliminar asistencia, archivar persona). Si no se desea borrar datos personales/históricos, retirar DELETE de esas tablas y usar archivado/estado lógico. Probar también llamadas directas a Data API, no solo botones.

### P1.4 — InfoMIRA ofrece acciones CRUD que no existen en su interfaz/cliente
En `MODULE_ACTIONS`, InfoMIRA presenta Consulta, Crear, Editar y Eliminar. Sin embargo, en `mira-data.js` solo se identificó `listInfoMiraDirectory()` para esa tabla; no hay métodos de creación, actualización o eliminación de `infomira_red`, ni se localizaron formularios equivalentes en el flujo del módulo revisado.

PostgreSQL sí tiene políticas CRUD para `mira.infomira_red` basadas en las acciones de InfoMIRA. Por tanto, la matriz puede otorgar permisos que la aplicación no sabe utilizar, mientras que una llamada directa a la API podría aprovechar el permiso.

**Corrección recomendada:** decidir si InfoMIRA es de solo consulta/exportación o si será editable. Ajustar la matriz y RLS a la funcionalidad real. No ofrecer Crear/Editar/Eliminar hasta que exista flujo completo con validaciones, confirmación y auditoría.

### P1.5 — Los roles no limitan las acciones de los permisos
Los roles disponibles son `viewer`, `operator` y `witness` (además de `admin`). Sin embargo, `mira.has_module_permission()` no aplica restricciones por rol; para usuarios normales consulta únicamente perfil activo/verificado y la fila del permiso.

Esto permite asignar `create`, `edit` o `delete` a un perfil con rol `viewer`. El rol funciona como etiqueta y no como nivel de seguridad. Actualmente todos los perfiles no administradores están en `viewer`, aunque el panel permite seleccionar otros roles.

**Corrección recomendada:** elegir una política inequívoca:
1. el rol define límites máximos de acciones y PostgreSQL los aplica, o
2. el rol es solo descriptivo y la interfaz deja claro que la matriz de permisos es la única autoridad.

No debe haber dos modelos de autorización que se contradigan.

### P1.6 — La matriz no contempla un permiso separado para exportar
La tabla y función SQL aceptan las acciones `export` y `manage`, pero la matriz no las presenta y no se encontraron políticas RLS que usen `export`. Los módulos Actividades e InfoMIRA tienen exportaciones Excel que se ejecutan con las consultas de lectura.

Así, “Consulta” también permite descargar datos disponibles en el módulo. Para Actividades se consultan datos personales; para InfoMIRA se exponen campos de identificación/contacto de acuerdo con la consulta permitida.

**Corrección recomendada:** decidir si exportar está incluido en Consulta o debe ser una acción independiente. Si se separa, los endpoints/consultas de exportación deben validar `export` en PostgreSQL; ocultar el botón no basta.

### P1.7 — El permiso de PQRS es nominal, no efectivo
`pqrs:view` puede guardarse desde el panel, pero las políticas de `mira.pqrs` no llaman a esa función para lectura administrativa. El panel PQRS se muestra solo al administrador principal.

**Impacto:** una marca de permiso puede parecer concedida y no producir ningún acceso. No se debe aprobar a una cuenta tomando `pqrs:view` como acceso útil.

**Corrección recomendada:** o se conserva PQRS exclusivamente para administración y se elimina de la matriz general, o se diseñan roles de bandeja (consulta/gestión) con políticas RLS que permitan a esos usuarios ver/actualizar registros autorizados, manteniendo separación entre remitentes.

## 4. Hallazgos P1/P2 — seguridad y estado del panel

### Actualización de perfiles con privilegios de columna demasiado amplios
En producción, `authenticated` tiene UPDATE sobre toda la tabla `mira.user_profiles`. Se comprobó permiso UPDATE, entre otras, sobre las columnas `id`, `auth_user_id`, `email`, `email_verified`, `role` y `active`. La política RLS restringe la operación a la cuenta administradora principal y prohíbe dejar el rol como `admin`, pero no limita qué columnas puede cambiar esa cuenta.

El cliente `updateUserProfile()` sí limita su payload a `active` y `role`; la API REST directa no está limitada por esa lista del cliente.

**Riesgo:** una sesión administrativa comprometida o una llamada directa mal construida puede alterar identificadores de vinculación, estado de verificación y otros campos que deberían ser administrados por Neon Auth o el sistema. El trigger de auditoría actual no registra todos esos cambios en detalle.

**Corrección recomendada:** sustituir el UPDATE global por privilegios de columna mínimos (solo `active` y `role`, más los campos técnicos estrictamente necesarios) o por una función RPC validada. Añadir invariantes que impidan cambiar `id` y `auth_user_id` y que protejan `email_verified` de cambios manuales.

### Estados “pendiente”, “suspendido” y “sin permisos” se mezclan
`renderUsers()` clasifica como “Por aprobar” cualquier cuenta cuyo correo no esté verificado o cuyo campo `active` sea false. Una cuenta aprobada que después se suspende vuelve a aparecer como “Pendiente de aprobación”. Una cuenta activa sin permisos aparece en “Aprobados” aunque el login la rechace.

**Corrección recomendada:** definir estados explícitos: pendiente de correo, pendiente de aprobación, activa, suspendida, rechazada y activa sin permiso (estado de error que no debería persistir). Añadir razón/fecha de suspensión si es necesario.

### Acciones simultáneas de estado/rol pueden competir
`changeUserApproval()` no utiliza un bloqueo común por perfil. El botón que se pulsa se deshabilita, pero el otro botón de acción y el selector de rol siguen disponibles. Además, Aprobar/Desaprobar envía también el valor actual del selector de rol. Dos cambios rápidos pueden escribir estados distintos sobre el mismo perfil y el último PATCH puede sobrescribir el anterior.

**Corrección recomendada:** serializar mutaciones por usuario, deshabilitar todos los controles de esa tarjeta mientras se guarda y separar acciones de rol y activación. Antes de enviar, comprobar que la versión/estado del perfil sigue siendo el que se mostró al administrador.

### El panel no se sincroniza automáticamente entre sesiones/dispositivos
La lista de perfiles, permisos y auditoría se consulta al abrir o refrescar manualmente el panel. No se encontró una suscripción/revalidación automática para cambios hechos desde otra sesión/dispositivo. En un entorno donde el panel se usa en varios equipos, se pueden ver estados antiguos hasta actualizar.

**Corrección recomendada:** refresco de estado al volver a enfocar el panel, control de versiones/updated_at, o suscripción en tiempo real si Neon la ofrece para este esquema. Mantener PostgreSQL como autoridad final.

### Carrera asíncrona al aplicar permisos del menú
`applyModuleAccess()` solicita los permisos y, al regresar la respuesta, actualiza el menú sin verificar que el usuario siga siendo el mismo. Si el usuario cierra sesión o cambia de cuenta mientras la consulta está en curso, una respuesta anterior puede desbloquear visualmente módulos de la sesión anterior.

RLS evita que ese usuario lea datos sin permisos, pero el panel lateral queda visualmente fuera de sincronía y puede ofrecer accesos que no corresponden a la sesión actual.

**Corrección recomendada:** usar un contador/versionado de solicitud y comparar el `authUserId` actual antes de aplicar la respuesta. Invalidar solicitudes pendientes al cerrar sesión y cambiar de cuenta.

### Acceso rápido de Actividades ignora el permiso visual
`syncMiraQuickModules()` muestra el panel de accesos rápidos para cualquier sesión autenticada. El botón `miraQuickActivitiesBtn` comprueba solo que exista `authUserId`; no comprueba `actividades:view`. La entrada lateral principal sí se restringe con `MODULE_TARGETS`.

RLS debe bloquear operaciones de datos sin permiso, pero el acceso rápido permite abrir el módulo/consultas aunque el usuario no tenga Actividades. Debe aplicarse el mismo permiso a todas las entradas, no solo al menú lateral.

### Permisos de Testigos antiguos ocultos
Cinco perfiles conservan `testigos:view=true`, aunque Testigos está inactivo y bloqueado por la función SQL. La matriz no muestra esa fila y por tanto no ofrece forma de revisar esos permisos.

**Corrección recomendada:** mostrar una sección separada de permisos históricos/inactivos y retirarlos mediante procedimiento aprobado o mantenerlos marcados como obsoletos. Nunca reactivar el módulo sin revisar esas filas.

## 5. Auditoría y trazabilidad

Controles positivos:
- `admin_audit_log` tiene SELECT solo para la cuenta administradora principal.
- `authenticated` no tiene INSERT, UPDATE ni DELETE directo en el historial.
- Los triggers de `user_profiles` y `module_permissions` registran creación, actualización y eliminación.
- Las funciones privilegiadas revisadas mantienen `SECURITY DEFINER` y un `search_path` fijo.

Faltantes comprobados:
1. No existe trigger de auditoría sobre `mira.module_catalog`. Cambiar el estado activo de un módulo no deja evento en `admin_audit_log`.
2. La función de auditoría de perfiles registra email, rol y active antes/después, pero no registra `email_verified`, `auth_user_id` anterior/nuevo ni otros campos sensibles si se alteran directamente.
3. `module_permissions.updated_at` tiene valor por defecto, pero no tiene trigger `set_updated_at`; actualizar un permiso no refresca automáticamente esa columna.
4. El historial muestra hasta 100 eventos y no ofrece paginación/filtros. Actualmente hay 78 eventos, por lo que todavía caben todos, pero no escalará indefinidamente.
5. El panel muestra el identificador UUID del actor, en lugar de un nombre/correo legible.
6. La última fila de auditoría de producción observada es del 3 de noviembre de 2026; no se encontraron eventos de cambios al catálogo.

**Corrección recomendada:** auditar cambios de catálogo; completar detalles de perfil; añadir trigger de fecha a permisos; añadir filtros/paginación y resolución de identidad. Mantener escritura del historial exclusivamente por triggers SECURITY DEFINER.

## 6. Matriz, permisos SQL y rutas de interfaz

| Módulo | Matriz actual | RLS/tabla comprobada | Ruta/funcionalidad encontrada | Evaluación |
|---|---|---|---|---|
| Actividades | Consulta, Crear, Editar, Eliminar | CRUD de actividades, asistencias y personas | Registro, asistencia, edición y Excel | Acciones principales existen; DELETE es demasiado amplio entre tablas y exportar se concede con Consulta |
| Concejal | Consulta, Crear, Editar, Eliminar | CRUD de actividades y compromisos; lectura/edición de reportes ciudadanos | Formularios de actividad/compromiso e historial | Relación razonable; verificar alcance de cada acción y reportes ciudadanos |
| InfoMIRA | Consulta, Crear, Editar, Eliminar | CRUD de `infomira_red` | Consulta del directorio y operaciones logísticas; no hay CRUD de directorio en cliente | Desalineado: acciones de escritura no tienen flujo de interfaz |
| Centro de Operaciones | Consulta | No se encontró tabla central propia asociada a este permiso | Menús de puestos/barrios y cartografía | Es principalmente acceso visual a herramientas/datos estáticos; documentar que no equivale a CRUD de datos |
| Reportes | Consulta | SELECT en `reportes_operativos` usa `reportes:view` | No hay target de menú; método de listado sin consumidor. Reportes ciudadanos usa `concejal` | No utilizable desde el panel actual |
| PQRS | Consulta | SELECT es remitente/administrador; no usa `pqrs:view` | Bandeja administrativa solo para administrador principal | Permiso nominal sin efecto en cuentas normales |
| Testigos | Oculto/inactivo | Función SQL lo deniega; permisos históricos permanecen | Entrada bloqueada | Bloqueo correcto; limpieza de permisos antiguos pendiente |
| Control Administrativo | No se ofrece a perfiles normales | Operaciones y auditoría reservadas al administrador principal | Panel Control Administrativo | Solo cuenta principal, como está previsto |

## 7. Faltantes de experiencia y operación del panel

- No hay cuadro de búsqueda de usuarios ni filtros por correo/nombre/fecha; con el límite actual de usuarios internos puede ser suficiente, pero la lista se limita a 500 perfiles y está ordenada por creación ascendente.
- El cambio de permisos se guarda inmediatamente; no hay vista previa/resumen de impacto antes de conceder permisos destructivos.
- No hay confirmación adicional al conceder `Eliminar`.
- No hay simulador de “acceso efectivo” que muestre qué pantallas/tablas verá el usuario antes de aprobarlo.
- No se muestran permisos heredados/obsoletos de módulos inactivos.
- No hay acción para eliminar definitivamente una cuenta o solicitar su eliminación; hoy se puede suspender mediante `active=false`. La baja definitiva debe coordinar Neon Auth, perfil, permisos y retención.
- Al aprobar o suspender desde una pestaña, el panel conserva la pestaña seleccionada; el usuario puede desaparecer de la lista y quedar seleccionado en el panel derecho hasta refrescar/cambiar de pestaña.
- El diálogo tiene `role=dialog` y `aria-modal=true`, pero no se identificó gestión de foco completa (atrapar Tab dentro del diálogo y devolver foco al botón que lo abrió).
- Existe CSS de adaptación móvil para anchos menores a 760 px, pero no se verificó visualmente desde navegador.

## 8. Pruebas y CI

- La carpeta `tests` solo contiene `testigos-inactive.test.cjs`.
- Esa suite prueba las siete rutas del bloqueo temporal de Testigos y que Actividades sigue pudiendo consultar cuando se desactiva la bandera.
- No hay pruebas automatizadas para `mira-admin.js`, aprobación, suspensión, cambios de rol, asignación/revocación de permisos, respuestas vacías, errores HTTP, carreras asíncronas ni mapeo matriz/RLS.
- GitHub Actions ejecuta `node --check` y `node --test tests/*.test.cjs`. Un resultado verde no certifica el panel: hoy solo cubre sintaxis de módulos y la suite de Testigos.
- La pestaña del navegador disponible en la sesión no contiene MIRA TU TERRITORIO (solo ChatGPT y WhatsApp). No se ejecutó una prueba visual/interactiva real del panel en esta revisión.

## 9. Prioridad recomendada de corrección

| Orden | Corrección | Criterio de cierre |
|---:|---|---|
| P0 | Corregir el modelo de acceso utilizable y estados de perfil | Ninguna cuenta activa sin un permiso y pantalla funcionales; aprobación/suspensión reflejadas de forma coherente |
| P0 | Separar alcance de DELETE en Actividades | El permiso de eliminar actividad no permite borrar asistencias ni personas |
| P0 | Alinear Reportes/PQRS con rutas y RLS | Un permiso concedido corresponde a pantalla y operación real; no se aprueba con módulos nominales |
| P1 | Definir rol versus matriz de acciones | Viewer no puede recibir escritura si el rol debe ser de solo lectura, o el rol queda descrito como etiqueta |
| P1 | Alinear InfoMIRA CRUD y exportación | Matriz y RLS solo muestran acciones implementadas; exportación tiene política explícita |
| P1 | Reducir UPDATE de `user_profiles` | Solo se pueden modificar columnas de estado/rol previstas; identidad y verificación protegidas |
| P1 | Revisar cinco grants Testigos obsoletos | No reaparecen automáticamente si el módulo se reactiva |
| P1 | Controlar carreras y mutaciones concurrentes | No se aplican resultados de otra sesión ni se pisan cambios de perfil |
| P1 | Automatizar pruebas de Control Administrativo | Pruebas de permisos, RLS, activación, cambios de rol/estado, respuestas fallidas y concurrencia |
| P2 | Completar auditoría | Catálogo auditado, campos de identidad/verificación registrados y fechas consistentes |
| P2 | Mejorar sincronización y estados | Refresco multi-dispositivo, estados pendiente/suspendido/rechazado, búsqueda y trazabilidad |
| P2 | Completar accesibilidad y pruebas visuales | Teclado/foco, móvil, diálogos y estados de error probados en navegador |

## 10. Aspectos que funcionan y deben conservarse

- Identidad de administrador principal está alineada entre frontend y SQL.
- `is_active_admin()` también exige que el perfil principal exista, esté activo y tenga rol admin.
- No se permite promover otro perfil a admin desde las políticas RLS actuales.
- El trigger de sincronización desde `neon_auth.user` tiene eventos AFTER INSERT y AFTER UPDATE.
- La comprobación de correo verificado en login y perfil se mantiene.
- La matriz confirma respuestas de Neon al actualizar perfiles/permisos y evita mostrar como guardado un cambio sin fila de respuesta.
- La selección de usuario usa versión de solicitud para evitar que respuestas atrasadas carguen permisos del usuario previamente seleccionado.
- No hay IDs duplicados en el HTML principal revisado.
- El cierre temporal de Testigos permanece efectivo en producción.

## 11. Alcance y limitaciones

- Se revisaron `mira-admin.js`, `mira-data.js`, `mira-auth.js`, `index.html`, `style.css`, los workflows y la suite existente.
- Se inspeccionaron las políticas RLS, grants, constraints, funciones, triggers, permisos almacenados y estados agregados de perfiles en Neon production.
- No se cambiaron permisos, perfiles, triggers, policies, grants ni datos de producción.
- No se ejecutaron cambios reales de roles/permisos en la base principal ni se crearon cuentas de prueba.
- No se hizo prueba de navegador real porque no había una pestaña MIRA abierta en la sesión conectada.
- Los resultados describen la rama y base de producción observadas el 2026-11-10; deben volver a probarse después de aplicar correcciones.

## 12. Recomendación final

No conviene empezar por rediseñar el panel. Primero hay que definir un catálogo de permisos efectivo por pantalla y tabla, cerrar las discrepancias P0 y proteger las operaciones destructivas en PostgreSQL. Después se debe construir una suite automatizada específica de Control Administrativo y realizar pruebas reales con varias cuentas de prueba en una rama Neon aislada.

Solo cuando una cuenta de prueba demuestre que:
1. no ingresa si está pendiente/suspendida o no tiene permiso utilizable;
2. solo ve los módulos asignados;
3. no puede realizar ninguna acción no concedida ni por UI ni por API directa;
4. no puede borrar entidades fuera del alcance autorizado;
5. y el historial registra correctamente cada cambio,

se debe considerar lista la etapa para integración y publicación.
