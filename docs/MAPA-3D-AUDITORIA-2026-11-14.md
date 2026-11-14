# Auditoría de integración cartográfica 3D — 2026-11-14

## Alcance y entorno
- Repositorio: jdgarzoncam-bit/MIRAtuterritorio
- Rama: preview/neon-qa-control-admin
- Último commit revisado: f79d41fce8ce49b56b505c5ed813c7b3f0dcb60a
- No se modificó main, no se desplegó a producción y no se ejecutaron escrituras en Neon.
- Esta auditoría revisa el archivo maps3d-project-2026-11-10_15-30-24.maps3d.json (configVersion 5), el código experimental mapa-3d.js, la conexión en app.js y los datos territoriales presentes en la rama.

## 1. Hallazgo principal sobre el archivo 3D
El archivo maps3d-project-2026-11-10_15-30-24.maps3d.json es un archivo de configuración del proyecto 3D, no un paquete de geometrías. Su estructura contiene `format: maps3d-project`, `configVersion: 5` y parámetros de presentación, capas, elevación, impresión y exportación.

Contiene, entre otros:
- Área seleccionada hexagonal: NE 4.84004, -74.32652; SW 4.78275, -74.37598.
- Imagen seleccionada: `satlas-superes-2023`.
- Dataset de elevación: `mapterhorn-global`; exageración 1.
- Edificios activados, fuente `auto`, altura basada en `osm`, color #E8AC4A, rango de altura 3–25 m, etiquetas activadas.
- Vías activadas y extruidas, con clases arterial, collector, local, service, paths y bridge activas; rail, ferry, tunnel, sidewalk, crosswalk y parking desactivadas.
- Agua activada, color #3B9FD9, colocación inlaid.
- Cobertura del suelo activada, categorías WOOD, GRASS, FARMLAND, WETLAND, SAND, ICE, ROCK y URBAN.
- Parcelas y etiquetas activadas; curvas de nivel activadas; árboles activados.
- Parámetros de impresión 3D, exportación UTM en metros, grilla, sección, sol y marco.
- Los arrays `markers`, `markers3d.items` y `tracks` están vacíos.

El archivo no contiene colecciones GeoJSON de edificios, vías, agua, parcelas o árboles, ni geometrías de malla, GLB/GLTF, 3D Tiles, ni URLs de servicios de teselas vectoriales para esas capas. Por tanto, el archivo acredita la configuración deseada, pero no entrega las geometrías vectorizadas. No se debe sustituir una vectorización manual por edificios OSM genéricos ni afirmar que esos vectores ya se han importado.

## 2. Datos territoriales disponibles
- `barrios_poligonos_kml_aportado.geojson`: FeatureCollection con 143 features; todas tienen geometría Polygon y nombre; no se encontraron geometrías vacías en la comprobación estructural.
- Las propiedades identifican la fuente KML y el estado `importado_no_verificado`. La geometría se conserva, pero no debe describirse como validación oficial de linderos o barrios sin una validación institucional separada.
- `barrios.geojson` es una fuente adicional de datos de barrios/puntos y no reemplaza los polígonos.
- `barrios_poligonos_borrador_no_oficial.geojson` es un borrador no oficial y no debe usarse como sustituto de las geometrías aportadas.
- La rama no contiene archivos independientes de edificios vectorizados, mallas 3D, GLB/GLTF, 3D Tiles o GeoJSON de edificios/vías/agua/parcelas.

## 3. Implementación existente en la rama QA
### Preparado
- MapLibre GL JS 5.6.0 está incluido en index.html.
- Se agregó el contenedor `#map3d`, oculto por defecto.
- El motor experimental `mapa-3d.js` se activa únicamente con `?mapa3d=1`.
- El mapa Leaflet original se conserva como reversión y sigue siendo el motor predeterminado.
- Se agregó un evento `mira:territory-render` desde `app.js` con el GeoJSON, estado de filtros, selección, coincidencias y visibilidad.
- El motor 3D recibe los polígonos visibles y utiliza un puente para delegar la selección en la lógica territorial original.
- Se agregó encuadre inicial y reencuadre cuando cambia la selección.

### Parcial / no validado
- La fuente de relieve se configuró experimentalmente como `https://tiles.mapterhorn.com/tilejson.json` con codificación Terrarium. El JSON del usuario solo declara el alias `mapterhorn-global`; no demuestra que esa URL sea el endpoint oficial o equivalente de ese alias. Requiere validación de disponibilidad, cobertura, términos y atribución.
- La capa satelital del prototipo usa Esri World Imagery; el archivo de configuración declara `satlas-superes-2023`. No se ha resuelto ni conectado el origen real de esa imagen.
- El prototipo no carga geometrías 3D de edificios ni implementa las capas de vías, agua, cobertura, parcelas, curvas de nivel y árboles configuradas en el archivo.
- No existe un adaptador que traduzca todavía toda la configuración del archivo versión 5 a fuentes y capas MapLibre.
- No se ha probado visualmente en navegador el terreno ni la superposición de los 143 polígonos.

### Riesgo funcional conocido
En el modo experimental se oculta el contenedor Leaflet completo. Aunque se sincroniza el GeoJSON territorial, todavía no se migran ni sincronizan todos los grupos de capas y controles Leaflet usados por otros flujos (puestos, marcadores InfoMIRA, búsqueda y otros elementos). Por tanto, no debe habilitarse como mapa general ni considerarse una integración funcional completa.

## 4. Validaciones ejecutadas
- GitHub Actions para los commits del motor, conexión HTML/CSS y eventos de selección: resultado `success`.
- Estas ejecuciones validan la sintaxis y las pruebas existentes del cliente, no la representación cartográfica ni las fuentes externas.
- La auditoría estructural del GeoJSON confirmó 143 features Polygon, nombres presentes y ninguna geometría vacía.
- No se ejecutó una prueba visual automatizada ni una validación en navegador de edificios o capas 3D.

## 5. Matriz de estado
| Área | Estado | Observación |
|---|---|---|
| Configuración 3D v5 | Revisada | Contiene parámetros, no los vectores geométricos |
| 143 polígonos | Disponible | Estructura validada; fuente marcada no verificada |
| Puente Leaflet → MapLibre | Preparado | GeoJSON, filtros y selección |
| Terreno Mapterhorn | Experimental | Endpoint debe validarse contra el alias del proyecto |
| Imagen satelital | Pendiente | El ID satlas-superes-2023 no está resuelto |
| Edificios vectorizados manualmente | No localizados | No están en el JSON ni como archivos en esta rama |
| Vías / agua / cobertura / parcelas / árboles | Configurados, no integrados | No hay geometrías o fuentes declaradas en el archivo |
| Puestos / marcadores / búsqueda / InfoMIRA | Pendiente | Dependen de Leaflet y no se han migrado |
| Filtros territoriales | Parcial | El estado se envía; falta validación visual y de todos los flujos |
| Móvil y rendimiento | Pendiente | Sin prueba visual/dispositivo |
| Producción / Neon | Sin cambios | Rama QA solamente |

## 6. Plan recomendado de intervención
1. Localizar y recibir los datos reales de vectorización manual (GeoJSON, GeoPackage, SHP comprimido, GLB/GLTF, 3D Tiles, tileset o el proyecto fuente completo). No redibujar ni reemplazar esas geometrías.
2. Identificar el software o motor que generó el archivo .maps3d y el mecanismo con el que resuelve los alias `satlas-superes-2023` y `mapterhorn-global`; validar fuentes, licencias y atribuciones.
3. Construir un adaptador versionado para `configVersion: 5`, traduciendo cada opción del archivo a capas y propiedades reales del motor.
4. Integrar primero las geometrías vectorizadas de edificios, luego vías, agua, coberturas, parcelas, curvas y árboles, cada una con fuente y metadatos identificables.
5. Superponer los 143 polígonos existentes sin recortarlos por el hexágono del proyecto 3D. El hexágono debe tratarse como extensión/área de trabajo, no como sustituto de las geometrías.
6. Migrar o mantener una estrategia de capas híbridas para puestos, InfoMIRA, marcadores, búsqueda, selección, fichas y controles. Ningún módulo puede perder sus capas por ocultar Leaflet.
7. Ejecutar pruebas funcionales comparativas: conteo de polígonos, filtros individuales/todos, selección, ficha, ajuste de vista, cambio Barrios/Puestos, búsqueda, marcadores, InfoMIRA y móvil.
8. Solo tras aceptación visual y funcional, decidir si MapLibre pasa a ser el motor principal. Mantener la reversión Leaflet hasta cerrar todas las pruebas.

## Conclusión
El avance actual es una preparación experimental: motor MapLibre incorporado, puente de polígonos y selección, y CI de JavaScript satisfactorio. No es todavía la integración del modelo 3D manual completo. El principal bloqueo no es la tecnología de renderizado, sino la ausencia en los archivos inspeccionados de las geometrías vectoriales y de los endpoints reales de las capas configuradas. El siguiente paso correcto es recuperar el paquete de datos vectorizados original y conectarlo sin modificar las geometrías territoriales existentes.
