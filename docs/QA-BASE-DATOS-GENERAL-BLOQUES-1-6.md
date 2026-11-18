# MIRA TU TERRITORIO — Protocolo de pruebas QA
**Fecha:** 2026-11-18  
**Rama de código:** `preview/neon-qa-control-admin`  
**Base de datos:** Neon QA compartida `br-wild-surf-b74rsbpz`  
**Producción:** fuera de alcance; no ejecutar pruebas en `main` ni en la base productiva.

## Reglas de seguridad
1. Confirmar que la URL y el entorno apuntan a QA antes de iniciar sesión.
2. Usar una cuenta QA real y probar por separado administrador, operador con permisos y cuenta sin permisos.
3. No usar datos personales reales para altas de prueba. Elegir un identificador ficticio que se confirme como no existente.
4. No borrar, fusionar ni reconciliar registros reales. Los registros sintéticos de prueba se retiran solo si existe una autorización específica y un procedimiento de limpieza acordado; como alternativa, archivarlos.
5. No editar datos de personas reales durante estas pruebas.
6. Capturar el resultado de cada caso: aprobado, fallido o bloqueado, con evidencia de pantalla y mensaje.

## Preparación
- Descargar el ZIP de la rama QA: https://github.com/jdgarzoncam-bit/MIRAtuterritorio/archive/refs/heads/preview/neon-qa-control-admin.zip
- Descomprimirlo en una carpeta nueva.
- Abrir PowerShell en esa carpeta e iniciar el servidor local con `python -m http.server 8000`.
- Abrir `http://localhost:8000`.
- Iniciar sesión con credenciales de QA.
- Si el navegador conserva archivos antiguos, hacer recarga forzada (Ctrl+F5).

## Matriz de aceptación

| ID | Bloque | Prueba | Resultado esperado |
|---|---|---|---|
| B1-01 | Personas | Crear ficha ficticia con cédula sin puntuación | Una ficha creada; confirmación del servidor |
| B1-02 | Personas | Buscar esa cédula con puntos/guion y sin ellos | Misma ficha encontrada |
| B1-03 | Personas | Editar teléfono y barrio de la ficha ficticia | Cambios persistidos tras recargar |
| B1-04 | Personas | Intentar documento duplicado | Rechazo controlado; no duplica |
| B2-01 | Consulta | Abrir bandeja de pendientes | Carga la primera página sin congelar interfaz |
| B2-02 | Consulta | Siguiente y anterior | 25 filas por página; no repite ni omite filas entre páginas |
| B2-03 | Consulta | Buscar documento en explorador | Coincidencia con/sin puntuación |
| B2-04 | Consulta | Forzar filtro sin resultados / error de red | Estados vacío y error legibles; reintento posible |
| B3-01 | Gestión | Abrir detalle de ficha ficticia | Datos correctos y ficha única |
| B3-02 | Gestión | Archivar y recuperar ficha ficticia | Cambia estado lógico; conserva datos y relaciones |
| B4-01 | Permisos | Operador con consulta/edición | Acciones permitidas según matriz |
| B4-02 | Permisos | Usuario sin consulta | No ve datos ni exporta |
| B4-03 | Auditoría | Consultar historial con filtros | Eventos y actor/operación identificados sin atribuciones falsas |
| B5-01 | Calidad | Abrir “Revisar calidad de datos” | Indicadores agregados; no modifica registros |
| B5-02 | Exportación | Personas activas | 523 filas en la línea base QA, si no hubo cambios desde el diagnóstico |
| B5-03 | Exportación | Personas archivadas | 64 filas en la línea base QA, si no hubo cambios desde el diagnóstico |
| B5-04 | Exportación | Personas todas | 587 filas en la línea base QA, si no hubo cambios desde el diagnóstico |
| B5-05 | Exportación | InfoMIRA · Red | 636 filas en la línea base QA, si no hubo cambios desde el diagnóstico |
| B5-06 | Exportación | Cada conjunto con y sin filtros | Filas del Excel = `total_count`; `truncated=false` |
| B5-07 | Exportación | Cuenta sin permiso export | Servidor deniega la RPC; no se descarga archivo |
| B5-08 | Auditoría | Revisar historial tras exportar | Evento EXPORT y cantidad registrada |
| B6-01 | Interfaz | Escritorio (≥1024 px) | Panel sin recortes; tablas utilizables |
| B6-02 | Interfaz | Tablet (768–1023 px) | Filtros y acciones reacomodados |
| B6-03 | Interfaz | Móvil (≤560 px) | Botones apilados, tablas desplazables, sin desbordamiento horizontal de la página |
| B6-04 | Accesibilidad | Navegar con teclado | Foco visible y panel de diagnóstico anunciado |
| B6-05 | Regresión | Abrir/cerrar Base de datos general y volver al mapa | Navegación estable; no altera capas, polígonos ni otros módulos |

## Línea base de QA capturada antes de la prueba
- Personas: 587 (523 activas, 64 archivadas).
- InfoMIRA: 636 filas.
- Cédulas normalizadas duplicadas en Personas: 0.
- No se deben tratar los 34 grupos duplicados de cédula observados en InfoMIRA como permiso para fusionar o borrar.
- Los valores de calidad son hallazgos de revisión, no instrucciones de corrección.

## Criterio de cierre
- No cerrar un caso con base únicamente en que la pantalla cargue: verificar persistencia, permiso efectivo y resultado del servidor.
- Toda exportación debe coincidir con `total_count` y declarar `truncated=false`.
- Si un caso falla, detener solo el flujo afectado, registrar el mensaje y corregir en QA antes de repetirlo.
- No promover a producción hasta que el usuario revise el informe de pruebas y autorice expresamente una eventual publicación.
