# Plan de intervención cartográfica sin costo — MIRA TU TERRITORIO
Fecha: 2026-11-14
Repositorio: jdgarzoncam-bit/MIRAtuterritorio
Rama: preview/neon-qa-control-admin
Base de este documento: HEAD f3ee263419ed248544fd6e94627a8a480d988697

## 1. Objetivo y límites
Incorporar una visualización 3D progresiva usando fuentes abiertas y gratuitas, sin pagar exportaciones de Maps3D y sin perder, sobrescribir, simplificar ni sustituir los datos territoriales existentes. Este documento inicia la intervención técnica y define controles de aceptación; no autoriza publicación, merge a main, escrituras en Neon ni eliminación de datos.

## 2. Inventario comprobado en la rama QA
- `barrios_poligonos_kml_aportado.geojson`: 143 features Polygon, propiedades con nombre, geometrías no vacías en la comprobación estructural; estado de procedencia `importado_no_verificado`. Conservar íntegro y no describir como lindero oficial validado sin verificación institucional.
- `barrios.geojson`: fuente complementaria; no reemplaza el anterior.
- `barrios_poligonos_borrador_no_oficial.geojson`: borrador no oficial; excluido como reemplazo.
- `maps3d-project-2026-11-10_15-30-24.maps3d.json`: configuración Maps3D v5, no contiene las geometrías de edificios/vías/agua/catastro/árboles.
- No se localizaron en el árbol del repositorio archivos independientes de edificios vectorizados, GLB/GLTF, 3D Tiles ni capas GeoJSON de vías/agua/parcelas/árboles.
- Archivos cartográficos presentes: `mapa-3d.js`, `app.js`, `index.html`, `style.css` y los archivos territoriales anteriores.

## 3. Dependencias Leaflet confirmadas en app.js
- `puestosLayerGroup`: crea marcadores de puestos, tooltips, clic, zoom y ficha `mostrarFichaPuesto`.
- `searchMarkersGroup`: grupo creado y añadido al mapa; revisar sus productores/consumidores antes de migrar.
- `miraMarkersGroup`: agrupación de registros InfoMIRA por puesto, tooltips, clic y zoom; se alterna con puestos.
- `poligonosBorradorLayerGroup`: grupo de borradores; no convertirlo en geometría oficial.
- `geojsonLayer` / `datosOriginales`: polígonos territoriales, filtros, selección, coincidencias y fichas.
- Logística crea una capa de rutas con `L.polyline`, `L.circleMarker` y `L.marker`.
- El mapa base Leaflet usa Esri World Imagery.
- El motor MapLibre actual se activa por `?mapa3d=1`, pero oculta el contenedor Leaflet completo. Por ello puestos, InfoMIRA, búsqueda, rutas y otros grupos que sigan dentro de Leaflet desaparecen en ese modo. No habilitar el modo 3D como mapa general hasta resolverlo.

## 4. Reglas de preservación obligatorias
1. No editar ni regenerar `barrios_poligonos_kml_aportado.geojson` durante esta intervención.
2. No usar el borrador no oficial como sustituto.
3. No recortar los 143 polígonos por el hexágono de Maps3D; el hexágono es extensión de trabajo, no autoridad para mutilar geometrías.
4. Antes y después de cada cambio comparar hash, número de features, tipos geométricos, nombres y geometrías del GeoJSON fuente.
5. Mantener originales inmutables en `data/original/` solo si se decide crear esa estructura y tras copiar/verificar; no mover ni renombrar ahora los archivos existentes.
6. Los datos nuevos se almacenarán en rutas separadas con manifiesto de fuente, fecha, licencia, atribución, CRS, consulta y versión.
7. Nunca fusionar automáticamente geometrías de OSM con los polígonos existentes. Cada fuente mantiene su identidad y procedencia.
8. No escribir geometrías derivadas en Neon ni alterar esquemas/RLS. La primera integración será de lectura.
9. No eliminar Leaflet ni su lógica hasta que cada capa y cada acción tenga equivalencia probada en MapLibre.
10. Mantener una reversión inmediata: Leaflet continúa como vista predeterminada.

## 5. Fuentes gratuitas candidatas y limitaciones
- OpenStreetMap/Overpass: candidatos para edificios, vías, agua, usos del suelo, árboles y elementos etiquetados. Cobertura variable; no garantiza el detalle de Maps3D ni la vectorización manual del usuario. Respetar ODbL, atribución y límites de uso de instancias públicas; no lanzar consultas masivas repetidas a servidores comunitarios.
- Copernicus DEM: candidato de elevación gratuito; revisar resolución, licencia, formato y reproyección antes de uso. No es equivalente a levantamiento topográfico local.
- Sentinel-2: candidato de imagen gratuita; requiere seleccionar producto, fecha, resolución/nube, reproyección y revisar condiciones de atribución. No equivale automáticamente a Satlas Superes 2023.
- La fuente de imagen y elevación real del editor Maps3D no queda identificada como endpoint reutilizable por la URL compartida. Los IDs `satlas-superes-2023` y `mapterhorn-global` son alias de configuración, no endpoints demostrados.
- No fijar como fuente definitiva `https://tiles.mapterhorn.com/tilejson.json` hasta comprobar acceso, cobertura, esquema, términos y atribución.

## 6. Arquitectura propuesta
- Una sola fuente de verdad para los datos operativos (puestos, InfoMIRA, búsqueda, reportes y registros relacionados): las fuentes que actualmente los alimentan.
- Adaptador de capas independiente del motor: normaliza GeoJSON/FeatureCollections, coordenadas, ID estable, visibilidad, filtros, selección, estilos y callbacks.
- Durante la transición, Leaflet sigue visible y operativo. MapLibre se monta en una vista de prueba separada o en modo comparativo; no se oculta Leaflet mientras falten capas.
- Las capas estáticas abiertas (edificios/vías/agua/cobertura/árboles/curvas) se cargan en fuentes independientes, separadas de los polígonos de barrios y de los datos operativos.
- Las capas dinámicas se conectan por adaptadores específicos: puestos, InfoMIRA, búsqueda y rutas. Evitar mantener dos copias divergentes.
- La selección territorial debe delegarse en las funciones actuales hasta que exista equivalencia funcional probada.

## 7. Secuencia de intervención
### Etapa A — preservación e inventario (actual)
- Registrar el estado del repositorio y de los archivos espaciales.
- Enumerar cada grupo Leaflet, productor de datos, filtros, eventos, ventanas emergentes y función de ficha.
- Definir manifiesto de fuentes y pruebas de no regresión.
Criterio de salida: inventario verificable y prueba de integridad de los 143 polígonos.

### Etapa B — adquisición gratuita y controlada
- Consultar OSM dentro de la extensión de Facatativá, con una sola consulta por familia temática y caché local.
- Descargar DEM/imagen desde fuentes oficiales gratuitas solo después de verificar disponibilidad y condiciones.
- Guardar cada fuente por separado, con metadatos y atribución.
Criterio de salida: datos reproducibles, licencia registrada, geometrías válidas y cobertura evaluada.

### Etapa C — adaptador y prueba aislada
- Crear fuentes/layers MapLibre sin cambiar el mapa Leaflet por defecto.
- Conectar primero barrios como capa de lectura y comprobar 143/143, filtros, selección y ficha.
- Añadir después edificios y vías, luego agua/cobertura/árboles/curvas.
Criterio de salida: igualdad de atributos/IDs esperados y ausencia de pérdida en Leaflet.

### Etapa D — migración de capas dinámicas
- Puestos: conservar coordenadas, filtros, tooltips, conteos y ficha.
- InfoMIRA: conservar agrupación por puesto, conteo, tooltip, selección y consulta.
- Búsqueda: identificar el productor real de `searchMarkersGroup` y conservar resultados/limpieza.
- Logística: conservar rutas, origen, destino y tooltips.
Criterio de salida: pruebas funcionales equivalentes en ambos motores.

### Etapa E — auditoría de intervención y decisión
Comparar alternativas híbrida, MapLibre principal y Leaflet con 3D complementario. Evaluar costo, rendimiento, mantenimiento, accesibilidad, cobertura, atribución, riesgo de pérdida, complejidad y reversibilidad. No retirar Leaflet sin aprobación expresa y matriz de aceptación completa.

## 8. Pros y contras preliminares
### Híbrido (recomendado durante la transición)
Pros: máxima reversibilidad; conserva funciones Leaflet; permite migrar por capas; reduce riesgo de pérdida.
Contras: dos motores y dos renderizados; más complejidad de estilos/eventos; consumo adicional de memoria; sincronización que debe probarse.
### MapLibre como motor único (no recomendado todavía)
Pros: terreno, cámara inclinada, extrusión y capas vectoriales en un mismo motor; arquitectura final potencialmente más simple.
Contras: reescritura de puestos, InfoMIRA, búsqueda, rutas, controles y fichas; riesgo alto de regresión; requiere pruebas visuales y de rendimiento.
### Leaflet con relieve/3D complementario
Pros: menor intervención en la lógica existente; preserva comportamiento 2D.
Contras: no ofrece por sí solo la experiencia 3D completa; integración visual y de cámara más limitada.
Decisión preliminar: mantener Leaflet como predeterminado y MapLibre en modo experimental/comparativo.

## 9. Fase 1: aclaración del plan y estado
Hay dos planes históricos que usaron el nombre “Fase 1”, por lo que no deben mezclarse:
- Plan general del proyecto (11 de noviembre): Fase 1 = cierre de Control Administrativo. Se aplicaron cambios y pruebas de seguridad en QA y varias migraciones históricas se aplicaron en producción con autorización; pero la fase NO quedó cerrada porque faltaban pruebas visuales en navegador y flujo real completo de aprobación, rol, permisos, suspensión, persistencia y pérdida efectiva de acceso, además de revisar RLS y sincronización.
- Plan específico del mapa 3D (14 de noviembre): Fase 1 = preparar motor 3D. MapLibre 5.6.0 se incorporó, se creó el contenedor y puente de polígonos, y las validaciones CI reportaron éxito. Esto fue una preparación experimental, NO una fase 1 terminada: terreno/imagen no están validados, no hay geometrías de edificios y capas temáticas, no se migraron capas dinámicas y no hay prueba visual de navegador.
Este documento trata la intervención cartográfica y no declara cerrada ninguna de las dos fases.

## 10. Matriz de aceptación / no regresión
Antes de considerar cualquier etapa aprobada:
- Barrios: 143/143 features, mismo nombre, geometría, propiedades y filtros; sin cambios de hash en fuente original.
- Puestos: mismos registros, coordenadas, filtro, tooltip, ficha y navegación.
- InfoMIRA: mismos resultados, agrupación, conteos, selección y consulta.
- Búsqueda: resultados, marcadores, limpieza y foco espacial.
- Logística: rutas, puntos y tooltips.
- Interfaz: vista 2D predeterminada, cambio a 3D, retorno a 2D y responsive.
- Fuentes: disponibilidad, licencia, atribución y fallback.
- Rendimiento: carga inicial, memoria, tiempo de respuesta y comportamiento móvil.
- Datos: cero escrituras no autorizadas en Neon; cero eliminación/alteración de datos existentes.

## 11. Estado de seguridad del trabajo
Todo el trabajo descrito se limita a la rama `preview/neon-qa-control-admin`. No modificar `main`, no publicar GitHub Pages, no desplegar producción ni ejecutar escrituras en Neon sin autorización expresa y validación de la etapa.
