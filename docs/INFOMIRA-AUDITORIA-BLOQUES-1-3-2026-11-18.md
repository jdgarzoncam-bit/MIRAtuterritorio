# InfoMIRA · Red y Movilidad — auditoría y cierre técnico parcial

**Fecha:** 18 de noviembre de 2026  
**Rama intervenida:** `preview/neon-qa-control-admin`  
**Base consultada:** Neon QA, rama `br-wild-surf-b74rsbpz`  
**Producción:** sin cambios  
**Datos:** sin inserciones, actualizaciones, eliminaciones ni fusiones durante esta auditoría.

## Desenlace ejecutivo

Se completó una auditoría de lectura del módulo y se corrigieron defectos de búsqueda, concurrencia de consultas, filtro de estado y correspondencia de nombres de puestos con la capa cartográfica.

La validación automatizada de la rama QA terminó correctamente: **98 pruebas aprobadas, 0 fallidas**. [Ejecución CI](https://github.com/jdgarzoncam-bit/MIRAtuterritorio/actions/runs/44417269158).

Esto acredita sintaxis y pruebas automatizadas del repositorio; no sustituye la validación visual del usuario con sesión real en navegador.

## Bloque 1 — Integridad de datos y relaciones

Consulta de solo lectura sobre `mira.infomira_red` y su relación con `mira.personas`:

| Indicador | Resultado QA |
|---|---:|
| Registros InfoMIRA | 636 |
| Sin cédula de origen | 18 |
| Sin vínculo a persona | 18 |
| Sin barrio | 213 |
| Vínculos huérfanos | 0 |
| Cédulas que no coinciden con la persona vinculada | 0 |
| Grupos con cédula repetida | 34 |
| Filas implicadas en esos grupos | 68 |

Los 18 registros sin documento son también los 18 registros sin vínculo. No hay referencias huérfanas ni discrepancias de documento en los vínculos existentes.

**Hallazgo importante:** los 34 grupos de cédula repetida no se deben tratar como duplicados eliminables. Los 34 grupos están vinculados a una sola persona cada uno, pero en todos se encontraron diferencias en uno o más atributos (barrio, estado, cuidador, puesto, movilidad o asistencia). Pueden representar asignaciones o registros de origen distintos. Se conserva cada fila.

**Resultado del bloque:** auditoría de integridad terminada; depuración y conciliación de los 18 registros sin vínculo, los 34 grupos repetidos y los 213 barrios faltantes quedan pendientes de revisión funcional con el responsable de los datos. No se hizo limpieza automática.

## Bloque 2 — Consulta, búsqueda y presentación

### Correcciones aplicadas en QA

- La consulta del directorio conserva paginación con límite máximo de 100 filas por petición y orden estable por fila de origen e identificador.
- La búsqueda por cédula limpia puntos, espacios y otros caracteres antes de consultar el valor numérico.
- La respuesta relacionada incorpora la cédula normalizada de la persona vinculada para facilitar consistencia entre el directorio y Personas.
- La búsqueda principal recorre páginas sucesivas hasta completar los resultados (con límite de seguridad de 5.000 filas), evitando truncar silenciosamente el directorio en la primera página.
- Se incorporó control de versión de petición: una respuesta lenta de una búsqueda anterior no puede reemplazar los resultados de una búsqueda más reciente.
- Se corrigió el filtro **ACTIVO**: antes una comparación parcial podía clasificar el texto **INACTIVO** como activo. Ahora se exige el estado activo real o la etiqueta normalizada exacta.
- Los filtros Líder/Cuidador y Referido comparan etiquetas normalizadas coherentes con la función común de normalización.

### Alcance pendiente

El cliente ahora dispone de un método controlado para actualizar campos permitidos de InfoMIRA, protegido por RLS y confirmación de una fila. Sin embargo, la interfaz actual sigue siendo principalmente de consulta y exportación: no se considera cerrado un flujo de edición completo hasta incorporar y validar su formulario, controles de permisos y confirmación visual. La matriz administrativa aún declara acciones Crear, Editar y Eliminar que no están implementadas como operaciones completas en esta interfaz; debe resolverse antes de otorgar esos permisos a perfiles operativos.

## Bloque 3 — Integración con mapa y puestos de votación

### Corrección aplicada

La comparación de nombres de puestos era demasiado literal: no toleraba de forma consistente signos de puntuación ni espacios repetidos. Se añadió una normalización local específica para InfoMIRA que:

- elimina tildes;
- ignora puntuación y separadores;
- unifica espacios repetidos;
- conserva la normalización general utilizada por otros módulos, sin cambiarla transversalmente.

El mapa continúa utilizando la lista y coordenadas existentes de puestos en `app.js`; no se crearon coordenadas nuevas ni se modificaron polígonos, GeoJSON, capas de barrios o geometrías.

### Cobertura territorial observada

En los 636 registros se encontraron 19 etiquetas de puesto, incluyendo el valor “SIN PUESTO”. Al contrastarlas con los 23 nombres de referencia de la lista cartográfica:

- 449 registros corresponden a nombres que pueden asociarse con puestos ya definidos en la lista.
- 88 registros tienen puesto informado, pero no existe una correspondencia inequívoca en la lista actual: 60 “COLEGIO NACIONAL EMILIO CIFUENTES”, 27 “COL. CARTAGENITA BLOQUE D SEDE PRIMARIA” y 1 “COLEGIO POLICARPA SALAVARRIETA”.
- 99 registros están marcados “SIN PUESTO”.

No se asignaron coordenadas por aproximación ni se enlazaron sedes que pudieran ser diferentes. Estos 187 registros requieren confirmación de la sede o puesto correcto antes de ampliar la cobertura del mapa.

## Seguridad y auditoría

La tabla tiene políticas RLS separadas para SELECT, INSERT, UPDATE y DELETE, que exigen respectivamente los permisos `view`, `create`, `edit` y `delete` del módulo InfoMIRA. También tiene el trigger central `central_audit_infomira_red` para registrar INSERT, UPDATE y DELETE.

No se alteraron políticas ni permisos de la base de datos en esta intervención.

## Cambios de código y pruebas

Archivos modificados en QA:
- `mira-data.js`: consulta normalizada y paginable; método de actualización de campos permitidos con validación de identificador, longitud y confirmación de una fila.
- `app.js`: paginación completa, protección contra respuestas obsoletas, filtro de estado corregido y normalización de nombres de puestos para marcadores.
- `tests/role-capabilities.test.cjs`: pruebas de búsqueda, paginación, filtro de estado, escape de texto, exportación y correspondencia cartográfica.

**CI:** 98 pruebas aprobadas, 0 fallidas.  
**Migraciones SQL:** ninguna.  
**Cambios en datos QA:** ninguno.  
**Cambios en producción:** ninguno.

## Estado real de los bloques

| Bloque | Estado |
|---|---|
| 1. Integridad y relaciones | Auditoría completada; conciliación de hallazgos pendiente |
| 2. Consulta y búsqueda | Correcciones de código y pruebas automatizadas aprobadas; validación de navegador pendiente |
| 3. Mapa y puestos | Normalización de correspondencias corregida y pruebas aprobadas; 88 sedes sin referencia y 99 “SIN PUESTO” pendientes; validación visual pendiente |

## Siguiente paso de intervención

Continuar con la interfaz funcional de InfoMIRA: definir si se mantendrá como consulta/exportación o si se habilitarán formularios de creación y edición; alinear la matriz de permisos con las operaciones reales; después validar con sesión real las búsquedas por cédula con y sin separadores, filtros de estado, exportación, marcadores y restauración de capas de puestos. La conciliación de datos y la incorporación de nuevas coordenadas deben realizarse solo tras validar cada registro o sede.
