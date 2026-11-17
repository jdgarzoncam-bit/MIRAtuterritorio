# Inventario inicial y auditoría QA — MIRA TU TERRITORIO
**Fecha:** 17 de noviembre de 2026  
**Rama de código revisada:** `preview/neon-qa-control-admin`  
**HEAD revisado antes de este documento:** `70fa42bffddc3739eafb6b86161385f0bc471368`  
**Proyecto Neon:** `soft-bar-53270058`  
**Rama Neon consultada:** `qa-role-capabilities-2026-11-10` (`br-wild-surf-b74rsbpz`)  
**Alcance:** inspección de solo lectura de archivos, estructura PostgreSQL, RLS, políticas, triggers, funciones y datos de la rama QA indicada. No se ejecutaron escrituras ni migraciones.

## 1. Estado de fases

- **Fase 1 — Autenticación y sesiones:** cerrada funcionalmente según las pruebas manuales reportadas por el usuario el 17-11-2026. Inicio de sesión, persistencia, recuperación y permisos permitidos/denegados validados por el usuario.
- **Fase 2 — Control Administrativo:** siguiente prioridad. Existe implementación de usuarios, aprobación, roles, matriz de permisos e historial; quedan discrepancias entre catálogo, interfaz, acciones, políticas y alcance efectivo por cerrar.
- **Fase 3 — Base de datos general:** prioridad inmediata posterior y dependiente de definir con precisión el alcance de los conjuntos y acciones.

## 2. Inventario funcional del frontend

### Navegación principal identificada en `index.html`

| Entrada | ID | Estado de inventario |
|---|---|---|
| InfoMIRA · Red y Movilidad | `dropdown-infomira` | Implementado; requiere alinear acciones y protección de datos |
| Base de datos general | `dropdown-base-datos-general` | Implementado; revisar datasets, paginación, búsqueda, edición y exportación |
| Testigos y Auditoría E-14 | `dropdown-testigos` | Bloqueado temporalmente; no reactivar |
| Info Electoral | `dropdown-puestos` | Implementado; revisar fuentes y filtros |
| Barrios y puestos | `dropdown-barrios-puestos` | Implementado; preservar polígonos, marcadores, filtros y Leaflet |
| Actividades | `dropdown-actividades` | Implementado; revisar operaciones y permisos |
| PQRS | `dropdown-pqrs-admin` | Implementado; consulta delegada y gestión administrativa tienen distinto alcance |
| Concejal · Gestión territorial | `dropdown-concejal` | Implementado; revisar actividades, compromisos y reportes ciudadanos |

### Componentes transversales y archivos principales

- `mira-auth.js`: autenticación, restauración y revalidación de sesión.
- `mira-admin.js`: perfiles, aprobación, rol, matriz y auditoría administrativa.
- `mira-data.js`: cliente central REST de Neon y métodos de lectura/escritura/exportación.
- `app.js`: inicialización de mapa, InfoMIRA, Actividades y Base de datos general.
- `activity-portal.js`: portal independiente de registro de Actividades.
- `pqrs.js`: envío público y bandeja PQRS.
- `reportes.js`: envío y bandeja de reportes ciudadanos.
- `pmu-navigation.js`: comportamiento de acordeón y transiciones del menú.
- `mapa-3d.js`: capa cartográfica 3D experimental.
- `electoral-dashboard.js`, `electoral-winners.js`, `electoral_2019.js`, `electoral_2023.js`: consultas y datos electorales.
- `mobile-operations.js`: controles y experiencia móvil.
- `style.css`: sistema visual compartido.
- `barrios_poligonos_kml_aportado.geojson`, `barrios.geojson`, `barrios_poligonos_borrador_no_oficial.geojson`: fuentes cartográficas; no modificar ni sustituir sin cotejo explícito.

## 3. Inventario de base de datos QA

La rama Neon consultada contiene 19 tablas del esquema `mira`, además de las tablas del esquema `neon_auth`. Tablas de negocio y soporte identificadas:

- Identidad y permisos: `user_profiles`, `module_catalog`, `module_permissions`.
- Personas y actividad: `personas`, `actividades`, `asistencias`.
- Información territorial/estratégica: `infomira_red`, `concejal_actividades`, `concejal_compromisos`.
- Atención y reportes: `pqrs`, `reportes_ciudadanos`.
- Auditoría: `admin_audit_log`, `audit_events`, `personas_change_audit`, `actividades_change_audit`, `asistencias_change_audit`.
- E-14: `testigos_publicos`, `testigo_archivos`, `evidencias_e14`.

La consulta de metadatos confirmó RLS habilitada en las 19 tablas del esquema `mira`. Esto no sustituye las pruebas de acceso con roles JWT reales ni significa que las políticas estén completas. `FORCE ROW LEVEL SECURITY` aparece desactivado; debe evaluarse en el contexto del propietario y las funciones SECURITY DEFINER, no cambiarse globalmente sin análisis.

## 4. Datos observados en la rama Neon QA consultada

| Tabla | Filas | Observación |
|---|---:|---|
| `personas` | 587 | 0 sin cédula normalizada; 587 valores distintos; 0 discrepancias con la cédula en dígitos |
| `actividades` | 3 | Registros de prueba/datos existentes conservados |
| `asistencias` | 3 | FK a personas y actividades con ON DELETE RESTRICT |
| `infomira_red` | 636 | 18 filas sin documento y sin vínculo `persona_id` |
| `pqrs` | 0 | Sin registros en esta rama |
| `reportes_ciudadanos` | 0 | Sin registros en esta rama |
| `audit_events` | 12 | Historial central existente |

No se borraron, fusionaron ni modificaron registros. Los 18 registros InfoMIRA sin documento/vínculo deben reconciliarse contra el lote de origen antes de cualquier depuración.

## 5. Hallazgos prioritarios — Control Administrativo

### CA-01. Acciones mostradas frente a capacidades efectivas
`MODULE_ACTIONS` presenta acciones por módulo; `roleAllowsAction()` limita Operador a view/create/edit/export/annul y Consulta a view. Acciones delete/manage quedan fuera del alcance efectivo de esos roles. La matriz debe presentar con claridad qué acciones son asignables, reservadas o no implementadas; evitar casillas que parezcan configurables cuando no lo son.

### CA-02. Catálogo de módulos frente a rutas reales
El catálogo contiene `personas`, `base_datos_general`, `actividades`, `concejal`, `centro_operaciones`, `infomira`, `pqrs`, `control_administrativo`, además de `testigos` y `logistica` inactivos. La interfaz no tiene una entrada de menú independiente para todos ellos. Debe documentarse el mapa módulo → pantalla → tabla → acciones RLS → condición de aprobación. No se debe permitir que un permiso nominal sin pantalla utilizable sirva como acceso funcional.

### CA-03. Estados de cuenta
En la rama Neon QA consultada se observaron 8 perfiles: 1 admin activo/verificado, 2 operadores activos/verificados y 5 perfiles viewer inactivos (algunos con correo sin verificar). El panel debe distinguir visualmente pendiente de correo, pendiente de aprobación, suspendido y activo sin acceso efectivo, sin presentar perfiles inactivos como aprobados.

### CA-04. RLS y permisos
Las tablas administrativas tienen políticas RLS para restringir lectura/escritura. Los GRANT SQL de `authenticated` sobre `module_catalog` y `module_permissions` son más amplios que el acceso efectivo, que depende de RLS y de la identidad administradora. Debe mantenerse la prueba de API directa además de la prueba de interfaz. Las funciones `has_module_permission`, `is_active_admin`, `export_dataset` y `list_audit_events` deben conservar revisión de EXECUTE, SECURITY DEFINER y search_path.

### CA-05. Sincronización de permisos
Existe un trigger `guard_last_active_module_view_permission` que evita retirar el último permiso Consulta utilizable de una cuenta activa. Debe probarse también desactivación de módulos, suspensión, concurrencia y respuestas fallidas. La condición de aprobación y la protección del último acceso deben utilizar el mismo concepto de módulo realmente disponible.

### CA-06. Auditoría
Existen triggers de auditoría administrativa y central en perfiles, permisos, catálogo y tablas de negocio. Debe evitarse duplicar o perder eventos al extenderla. Verificar que las vistas de auditoría no expongan datos personales innecesarios y que las operaciones sensibles queden trazadas.

## 6. Hallazgos prioritarios — Base de datos general

### BD-01. Normalización de cédula
`listPeople()` consulta por `cedula_normalizada`, pero `createPerson()` y `updatePerson()` eliminan ese campo del payload. En la rama QA, las 587 filas actuales tienen valor normalizado correcto, pero la tabla no presenta un trigger de normalización en PostgreSQL. El defecto puede afectar altas o cambios futuros. La corrección definitiva debe hacerse en PostgreSQL y acompañarse de pruebas de alta, edición, búsqueda, duplicados y concurrencia. No aplicar NOT NULL ni migración antes de probar en una rama aislada.

### BD-02. Conjuntos de datos y permisos dobles
El explorador limita la consulta a los datasets definidos en `EXPLORER_DATASETS` y exige permiso de Base de datos general y permiso del módulo de origen. La exportación se valida en PostgreSQL con ambos permisos. Mantener esa doble autorización y comprobar que cada dataset no devuelva columnas sensibles fuera del propósito funcional.

### BD-03. Edición de fichas pendientes
La vista de pendientes usa `listPeople({limit:1000})` y filtra en cliente. Esto no escala como estrategia de largo plazo y puede omitir resultados si la tabla supera el límite. Diseñar filtro/paginación en servidor, sin cambiar los resultados actuales ni eliminar registros.

### BD-04. Calidad de InfoMIRA
La rama QA muestra 636 filas, 18 sin documento ni persona relacionada. Se requiere conciliación con archivo/lote original y ficha central; prohibido borrar duplicados o huérfanos automáticamente.

### BD-05. Auditoría y exportaciones
La exportación se implementa con `mira.export_dataset()`, que valida Base de datos general y módulo de origen y registra EXPORT en `audit_events`. Conservar validación en backend y el registro. Revisar límite de exportación, campos permitidos, paginación y mensajes de denegación.

## 7. Otras dependencias detectadas

- Actividades tiene una función/triger `enforce_attendance_active_activity()` que rechaza nuevas asistencias si la actividad no está activa.
- El mapa 2D y el 3D no deben intervenirse durante CA/BD salvo que una dependencia crítica lo exija.
- Testigos/E-14 permanece inactivo en catálogo y bloqueado por la función de permisos. No reactivar.
- PQRS permite envío público y tiene consulta delegada bajo permiso; la edición de estado se mantiene reservada al administrador principal en el cliente actual.
- Reportes ciudadanos y PQRS son flujos y tablas distintos; no fusionarlos sin decisión funcional y análisis de datos.

## 8. Riesgo de integración de ramas

La comparación GitHub entre `main` y `preview/neon-qa-control-admin` reportó estado `diverged`: QA 381 commits por delante y 15 por detrás. No hacer merge, cherry-pick masivo ni publicar desde esta comparación sin reconciliación manual por archivo y validación.

La rama Neon consultada (`qa-role-capabilities-2026-11-10`) fue creada desde producción el 10-11-2026. Es un snapshot de QA y no debe asumirse idéntica a la producción actual. No promover datos desde esa rama ni aplicar migraciones a producción como parte de esta auditoría.

## 9. Plan de trabajo y criterios de aceptación

### Ciclo 2A — Control Administrativo
1. Crear matriz de verdad permiso → rol → acción → pantalla → tabla → política SQL.
2. Alinear catálogo, menú, matriz y condición de aprobación.
3. Distinguir estados de cuenta y evitar inconsistencias al suspender/aprobar.
4. Revisar privilegios por columna en user_profiles y permisos de catálogo.
5. Confirmar auditoría de cambios de perfiles, roles, permisos y catálogo.
6. Automatizar pruebas de UI/cliente y pruebas SQL/API directa en rama Neon aislada.

**Cierre:** ninguna acción concedida es nominal; ningún permiso permite operaciones adicionales; las denegaciones funcionan en UI y PostgreSQL; cambios quedan auditados; Testigos sigue bloqueado.

### Ciclo 2B — Base de datos general
1. Corregir normalización de cédula en PostgreSQL y cliente.
2. Validar unicidad y búsqueda por cédula en escenarios de alta/edición concurrentes.
3. Auditar datasets, columnas, filtros y permisos dobles.
4. Convertir pendientes a consultas paginadas en servidor.
5. Revisar edición, archivado y protección de datos personales.
6. Reconciliar InfoMIRA sin borrar filas.
7. Verificar exportación y auditoría en backend.

**Cierre:** alta/edición/búsqueda consistente; cero duplicados introducidos; paginación completa; permisos aplicados en backend; exportaciones auditadas; datos existentes preservados.

### Ciclo 2C — Regresión transversal
- Login, refresco y recuperación de sesión.
- Acceso común al mapa y visibilidad de polígonos.
- Permisos de cada rol.
- Menú y paneles en escritorio/móvil.
- CI y pruebas de regresión.

## 10. Restricciones de intervención

- Código: trabajar únicamente en `preview/neon-qa-control-admin`.
- Base de datos: usar ramas QA aisladas para ensayar migraciones.
- No modificar `main` ni producción sin autorización expresa.
- No borrar, fusionar ni sobrescribir datos existentes sin conciliación y autorización.
- No alterar geometrías ni lógica cartográfica para corregir problemas de interfaz.
- Cada entrega debe tener commit, pruebas, criterios de aceptación y ZIP de QA.
- Este documento es inventario inicial; los estados de módulos son preliminares hasta completar las pruebas de cada flujo.

## 11. Próxima intervención recomendada

Comenzar por CA-01 a CA-05 y cerrar el modelo de autorización antes de añadir capacidades. Después implementar BD-01 en una rama Neon temporal y validar sin afectar los datos de QA compartidos ni producción.
