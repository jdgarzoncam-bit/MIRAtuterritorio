# Plan de validación funcional — ciclo 23 de noviembre de 2026

## Alcance y estado

Este ciclo consolida correcciones de InfoMIRA, estado de Personas y retiro de Logística en la rama QA. La validación automatizada y manual queda separada: los cambios de código y PostgreSQL están preparados en QA; las pruebas visuales y de interacción requieren abrir la versión desplegada y ejecutar los casos de esta matriz.

- Rama de código: `preview/neon-qa-control-admin`.
- Rama Neon intervenida: `qa-role-capabilities-2026-11-10` (`br-wild-surf-b74rsbpz`).
- Producción / `main`: sin modificaciones.
- No se eliminaron ramas, no se migraron cambios a producción y no se desplegó `main`.
- Logística se retiró de la interfaz y del código de rutas. Su registro inactivo de catálogo se conserva como referencia histórica; no se elimina información histórica.

## Cambios aplicados en QA

1. InfoMIRA: matriz administrativa limitada a `view`; retiradas las políticas RLS de INSERT, UPDATE y DELETE; privilegios de `authenticated` limitados a SELECT; permisos secundarios residuales retirados; la función de autorización deniega toda acción de InfoMIRA distinta de `view`.
2. Personas: 95 registros que estaban marcados como inactivos por al menos uno de los dos indicadores quedaron normalizados como `activo=false, inactivo=true`. Se añadieron un trigger de sincronización y una restricción CHECK para impedir contradicciones futuras.
3. Interfaz de Personas: filtro y etiquetas usan “Inactivos”; marcar inactiva y activar actualizan ambos indicadores.
4. Logística: retirado el panel de rutas y asignación de conductores de InfoMIRA, sus funciones de trazado y exportación logística y su tarjeta en navegación móvil.
5. Cache: actualizadas las versiones de los scripts modificados en `index.html`.

## Matriz de pruebas funcionales

| ID | Módulo | Prueba | Resultado esperado |
|---|---|---|---|
| AUTH-01 | Autenticación | Iniciar sesión con cuenta activa, correo verificado y rol autorizado | Acceso conforme al rol y módulos concedidos |
| AUTH-02 | Autenticación | Iniciar sesión con cuenta inactiva o correo no verificado | Acceso bloqueado y mensaje claro |
| AUTH-03 | Autenticación | Actualizar la página y restaurar sesión; luego cerrar sesión | Sesión recuperada correctamente; cierre revoca acceso |
| ADM-01 | Control administrativo | Consultar perfiles, roles y permisos | Matriz refleja catálogo activo y permisos efectivos |
| ADM-02 | Control administrativo | Intentar conceder acciones no permitidas por rol | Operación bloqueada; no hay falso éxito |
| ADM-03 | Control administrativo | Revisar historial de auditoría y paginación | Eventos visibles, ordenados y sin duplicación |
| PER-01 | Personas | Buscar cédula con puntos/guiones y sin formato | La misma ficha aparece por cédula normalizada |
| PER-02 | Personas | Filtrar Activos, Inactivos y Todas | Conteos y resultados coherentes; en QA se esperan 493 activos y 95 inactivos |
| PER-03 | Personas | Marcar activa como inactiva y volver a activarla | Se actualizan ambos indicadores y la ficha cambia de filtro |
| PER-04 | Personas | Insertar o actualizar una ficha cambiando solo uno de los indicadores | Trigger sincroniza el otro indicador; CHECK impide estados contradictorios |
| INF-01 | InfoMIRA | Consultar por nombre y por cédula | Resultados de consulta correctos; no se modifica información |
| INF-02 | InfoMIRA | Intentar INSERT, UPDATE y DELETE como usuario autenticado | PostgreSQL/PostgREST deniega las tres operaciones |
| INF-03 | InfoMIRA | Abrir matriz administrativa | Solo aparece “Consulta”; no existen opciones de crear, editar o eliminar |
| ACT-01 | Actividades | Crear, editar y cancelar actividad con permisos correspondientes | Cambios confirmados en Neon y auditados |
| ACT-02 | Actividades | Registrar asistencia a actividad activa y luego anulada/cancelada | Reglas de estado y duplicidad se cumplen |
| ACT-03 | Actividades | Operador con permiso de Actividades pero sin Personas: crear asistencia de persona nueva | Bloqueo previo y mensaje explícito por dependencia de Personas |
| CON-01 | Concejal | Crear, consultar, editar y eliminar según permisos | CRUD consistente, relaciones y auditoría correctas |
| CON-02 | Concejal | Consultar compromisos por barrio y actualizar su estado | Filtros, relaciones y resultados consistentes |
| ELE-01 | Info Electoral | Aplicar filtros por puesto, zona y número | Totales, tablas y gráficos coinciden con fuente |
| ELE-02 | Info Electoral | Seleccionar puesto y comprobar barrio relacionado | Relación espacial correcta; sin asignaciones aproximadas presentadas como oficiales |
| MAP-01 | Mapa territorial | Comparar 143 polígonos fuente, barrios y puestos entre Leaflet y motor 3D | Geometrías y atributos conservados; ninguna capa desaparece |
| MAP-02 | Mapa territorial | Filtros, selección, búsqueda, ficha emergente y zoom | Mismo resultado en 2D y 3D |
| MAP-03 | Mapa territorial | Mostrar marcadores, InfoMIRA, puestos, rutas que sigan vigentes y capas de consulta | Capas sincronizadas; no se considera aprobado si solo aparecen polígonos |
| MAP-04 | Mapa territorial | PC, tableta y móvil; red lenta y pérdida de fuente 3D | Interfaz utilizable y retorno seguro a Leaflet |
| PQ-01 | PQRS | Envío público con campos válidos e inválidos | Registro válido creado; validaciones y mensajes correctos |
| PQ-02 | PQRS | Consultar y actualizar PQRS con perfiles autorizados | RLS y permisos respetados; cambios auditados |
| REP-01 | Reportes ciudadanos | Crear reporte público y consultar/gestionar desde rol autorizado | Flujo completo y estado actualizado |
| MOB-01 | Móvil | Recorrer las tarjetas de módulos y abrir cada módulo activo | Todos los módulos activos accesibles; sin tarjeta Logística |
| MOB-02 | Móvil | Abrir mapa y volver a inicio | Mapa redimensionado correctamente y navegación restaurada |
| TES-01 | Testigos/E-14 | Intentar abrir módulo y ejecutar endpoints | Sigue bloqueado mientras permanezca inactivo |

## Criterios de cierre

- Cada caso debe registrarse como **Aprobado**, **Fallido** o **Bloqueado**, con captura o evidencia cuando aplique.
- Cualquier fallo de RLS se trata como bloqueante.
- No se considera aprobada la migración 3D por mostrar únicamente el relieve o los polígonos: debe igualar filtros, selección, marcadores, búsqueda, fichas emergentes y capas operativas vigentes.
- No se reactiva Testigos ni Logística durante estas pruebas.
- No se promueve a `main` ni se despliega producción hasta completar las pruebas, revisar diferencias con `main` y recibir autorización expresa.

## Motor cartográfico propuesto

Mantener MapLibre GL JS para cámara, estilo, terreno y fuentes; integrar `deck.gl` con `MapLibreOverlay` en modo intercalado para capas de GeoJSON, líneas, puntos, polígonos, objetos 3D e identificación interactiva. Mantener Leaflet como respaldo durante la migración. La decisión final depende de una prueba de paridad con las capas reales del proyecto y de recuperar los archivos originales de vectorización manual.
