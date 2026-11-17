# Matriz de capacidades — Control Administrativo
**Fecha:** 17 de noviembre de 2026  
**Código:** `preview/neon-qa-control-admin`  
**Base de pruebas aislada:** Neon `qa-control-admin-2026-11-17` (`br-misty-mud-b7oqe8wj`)

## 1. Modelo de roles

| Rol | Consulta | Crear | Editar | Exportar | Anular | Eliminar / administrar |
|---|---:|---:|---:|---:|---:|---|
| Consulta (`viewer`) | Sí, con permiso individual | No | No | No | No | No |
| Operador (`operator`) | Sí, con permiso individual | Sí, con permiso individual | Sí, con permiso individual | Sí, con permiso individual y Base de datos general + módulo origen | Sí, con permiso individual en Actividades | Reservado |
| Administrador principal | Acceso administrativo a módulos activos | Sí | Sí | Sí | Sí | Sí, según políticas de cada tabla; Testigos sigue bloqueado |
| Testigo (`witness`) | No | No | No | No | No | Rol reservado |

Las capacidades de Operador y Consulta son límites máximos del rol. El permiso individual y la condición de Consulta del módulo siguen siendo obligatorios. Una autorización guardada fuera del límite del rol se conserva, pero no se vuelve efectiva hasta que el rol permita esa acción; el panel exige confirmación al cambiar Consulta a Operador si hay permisos secundarios dormidos.

## 2. Mapa común (fuera de la matriz privada)

Toda cuenta activa y con correo verificado tiene acceso común a Barrios y puestos de votación, incluyendo las herramientas cartográficas comunes. Este acceso:
- No requiere una fila de `module_permissions`.
- No concede lectura de Personas, InfoMIRA ni otros datos personales.
- No concede altas, cambios, eliminaciones ni exportaciones.
- No habilita Testigos/E-14.
- Se bloquea al suspender la cuenta o retirar la verificación de correo.

Por eso `centro_operaciones` no aparece como permiso asignable por usuario en la matriz granular.

## 3. Matriz por módulo

| Módulo | Consulta | Crear | Editar | Exportar | Anular | Eliminar / administrar |
|---|---|---|---|---|---|---|
| Barrios y puestos / Centro de Operaciones | Común para cuenta activa/verificada | — | — | — | — | — |
| Personas | `personas:view` | `personas:create` | `personas:edit` | `personas:export` + `base_datos_general:export` | — | No expuesto a Operador |
| Base de datos general | `base_datos_general:view` + permiso de consulta del origen | No es una acción genérica | No es una acción genérica | `base_datos_general:export` + permiso export del origen | — | Administración reservada |
| Actividades | `actividades:view` | `actividades:create` | `actividades:edit` | `actividades:export` + `base_datos_general:export` | `actividades:annul` mediante operación controlada | Reservado |
| InfoMIRA | `infomira:view` | `infomira:create` | `infomira:edit` | No habilitado en la matriz actual | — | Reservado |
| Concejal | `concejal:view` | `concejal:create` | `concejal:edit` | No habilitado en la matriz actual | — | Reservado |
| PQRS | `pqrs:view` | Envío público separado | Solo administrador principal | No habilitado | — | Solo administrador principal |
| Testigos / E-14 | Bloqueado | Bloqueado | Bloqueado | Bloqueado | Bloqueado | Bloqueado |
| Control Administrativo | Solo administrador principal | Solo administrador principal | Solo administrador principal | Solo administrador principal | — | Solo administrador principal |

## 4. Correspondencia con PostgreSQL

- `mira.has_module_permission(module, action)` valida que el módulo exista y esté activo, bloquea Testigos, comprueba perfil activo y correo verificado, aplica el límite del rol y exige Consulta para acciones distintas de Consulta.
- RLS en `personas`, `actividades`, `asistencias`, `infomira_red`, `concejal_actividades`, `concejal_compromisos`, `pqrs` y demás tablas mantiene el control en el servidor.
- `mira.export_dataset()` exige permiso de consulta y exportación de Base de datos general y del módulo de origen; registra la operación en `audit_events`.
- `mira.is_active_admin()` reconoce únicamente la cuenta administradora principal activa y verificada.
- Testigos/E-14 conserva la barrera de denegación y la condición inactiva.

## 5. Cambios incluidos en esta entrega

### Interfaz
- La aprobación ya no exige conceder primero un módulo privado.
- Una cuenta verificada puede aprobarse y recibir acceso al mapa común.
- El panel distingue `Aprobado · acceso común al mapa` de `Aprobado · módulos autorizados`.
- `centro_operaciones` se retira de la matriz granular porque el mapa es común.
- Base de datos general muestra únicamente Consulta y Exportar, que son las capacidades con uso real en el explorador y en la función de exportación.
- Se conserva el límite de roles y la confirmación para activar permisos dormidos al pasar de Consulta a Operador.

### PostgreSQL
- La migración `20261117_common_map_account_approval.sql` cambia la condición de activación para exigir correo verificado, no permisos privados.
- Se retira el trigger `guard_last_active_module_view_permission`, porque el mapa común ya no depende de conservar un permiso privado de Consulta.
- No se modifican perfiles existentes, permisos guardados ni registros de negocio.

## 6. Validación en Neon aislado

Rama creada desde QA:
- Nombre: `qa-control-admin-2026-11-17`
- ID: `br-misty-mud-b7oqe8wj`
- Padre: `br-wild-surf-b74rsbpz`

Pruebas realizadas en la rama aislada:
1. Se aplicó la función de activación y se retiró el trigger de último permiso.
2. Se insertó y activó una cuenta de prueba verificada sin permisos privados: operación aceptada.
3. Se agregó y retiró su único permiso privado de Consulta: operación aceptada.
4. Se intentó activar una cuenta de prueba con correo no verificado: PostgreSQL rechazó la operación.
5. Se eliminaron los perfiles, permisos y eventos de auditoría sintéticos de prueba.
6. Verificación final: 0 perfiles sintéticos, 0 permisos sintéticos y 0 eventos sintéticos restantes.
7. RLS permanece habilitada en `user_profiles` y `module_permissions`.
8. Comparación de esquema frente al padre: solo cambia la función de activación y desaparece el trigger de último permiso.

Los conteos de negocio se conservaron frente a la rama QA padre: 587 Personas, 636 filas InfoMIRA, 46 permisos y 8 perfiles. Los 12 eventos de auditoría originales también quedaron restaurados tras retirar los eventos sintéticos de la prueba.

## 7. Validación automatizada del código

GitHub Actions:
- Ejecución: [44185136341](https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/44185136341)
- Resultado: exitosa.
- Sintaxis JavaScript: correcta.
- Pruebas: 82 aprobadas, 0 fallidas.

## 8. Pendiente de validación funcional por el usuario

Esta entrega aún requiere comprobar en el navegador local:
- Aprobar una cuenta verificada sin permisos privados y confirmar que entra al mapa común.
- Comprobar que no puede abrir Personas, InfoMIRA ni otros módulos sin permiso.
- Suspender esa cuenta y confirmar que pierde acceso.
- Probar Consulta y Operador con permisos asignados.
- Confirmar que Testigos/E-14 sigue bloqueado.

La migración está probada únicamente en la rama Neon aislada. No se ha aplicado a la rama QA compartida ni a producción. La aprobación funcional del usuario debe preceder a cualquier aplicación en la rama Neon QA compartida.
