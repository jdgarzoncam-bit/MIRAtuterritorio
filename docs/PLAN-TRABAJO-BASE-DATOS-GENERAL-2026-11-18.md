# MIRA TU TERRITORIO — Plan de trabajo de Base de datos general
**Fecha de control:** 2026-11-18  
**Rama de código:** `preview/neon-qa-control-admin`  
**Rama Neon QA compartida:** `br-wild-surf-b74rsbpz`  
**Regla:** no intervenir `main` ni producción sin autorización expresa. Las migraciones se ensayan primero en una rama Neon aislada y solo pasan a QA compartida con autorización.

## Objetivo
Completar la funcionalidad de Base de datos general sin reconstruir el módulo ni alterar o perder registros, geometrías o relaciones con otros módulos.

## Bloques de intervención

| Bloque | Alcance | Estado |
|---|---|---|
| 1. Integridad de Personas | Esquema, normalización de cédula, cliente de altas/ediciones, confirmación de escritura, unicidad y concurrencia | En intervención |
| 2. Consulta y paginación | Paginación completa de pendientes, filtros de servidor, estados de carga/error/vacío | Pendiente |
| 3. Edición y gestión de fichas | Formularios unificados, validación, detalle, archivado y recuperación controlada | Pendiente |
| 4. Auditoría y permisos | Roles, RLS/API directa, cobertura de auditoría y minimización de datos | Pendiente |
| 5. Exportación y calidad | Columnas, límites, errores, calidad Personas/InfoMIRA y conciliación sin borrado | Pendiente |
| 6. Interfaz y cierre | Escritorio/móvil, estados, navegación, regresión, documentación y entrega QA | Pendiente |

## Bloque 1 — criterios de aceptación
1. La tabla mantiene cédula original y cédula normalizada consistente.
2. PostgreSQL normaliza en cada INSERT/UPDATE, incluso si la operación no viene del formulario.
3. La aplicación exige exactamente una fila devuelta para confirmar alta o edición.
4. Cédulas sin dígitos se rechazan y las cédulas duplicadas se rechazan mediante la restricción UNIQUE.
5. Las escrituras concurrentes quedan protegidas por el índice/constraint UNIQUE de PostgreSQL.
6. Los 587 registros existentes permanecen intactos y consistentes.
7. RLS, permisos, auditoría y demás columnas de Personas permanecen operativos.

## Evidencia inicial
- Personas en QA: 587.
- Cédulas normalizadas vacías: 0.
- Cédulas con diferencia frente a los dígitos de `cedula`: 0.
- Documentos normalizados distintos: 587.
- La tabla ya tenía `personas_cedula_unica`; la migración conserva esa restricción.
- La tabla tiene auditoría central y auditoría específica. Ambas se mantienen porque registran en destinos distintos.

## Intervención en curso
- Rama Neon aislada: `qa-personas-integrity-2026-11-18` (`br-autumn-math-b7vc7hc7`), derivada de QA compartida.
- Migración de normalización aplicada y probada solo en esa rama aislada.
- Cliente `mira-data.js`: altas y ediciones requieren exactamente una fila devuelta; edición valida ID y rechaza cédula sin dígitos.
- No se ha aplicado la migración a la rama Neon QA compartida ni a producción.
- La validación automatizada de GitHub Actions y la prueba funcional con sesión real permanecen pendientes.

## Protección de datos
No ejecutar depuración masiva, borrados, merges de personas ni conciliaciones automáticas de InfoMIRA dentro de este bloque. Cualquier registro dudoso se conserva para revisión posterior.
