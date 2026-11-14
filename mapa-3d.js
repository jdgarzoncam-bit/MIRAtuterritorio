/* MIRA TU TERRITORIO · Motor 3D experimental
 * Se activa únicamente con ?mapa3d=1. Leaflet permanece intacto como motor
 * principal y como vía de reversión. No modifica datos ni consume Neon.
 */
(() => {
  'use strict';
  const enabled = new URLSearchParams(window.location.search).get('mapa3d') === '1';
  if (!enabled) return;

  const container = document.getElementById('map3d');
  const leafletContainer = document.getElementById('map');
  if (!container || !leafletContainer || !window.maplibregl) {
    console.error('[MIRA 3D] No se encontró el contenedor o MapLibre GL JS.');
    return;
  }

  container.hidden = false;
  container.setAttribute('aria-label', 'Mapa territorial 3D experimental');
  leafletContainer.classList.add('mira-map-3d-hidden');

  const style = {
    version: 8,
    sources: {
      'mira-imagery': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © Esri'
      },
      'mira-terrain': {
        type: 'raster-dem',
        url: 'https://tiles.mapterhorn.com/tilejson.json',
        encoding: 'terrarium'
      },
      'mira-territories': {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      }
    },
    layers: [
      { id: 'mira-imagery-layer', type: 'raster', source: 'mira-imagery' },
      { id: 'mira-terrain-shade', type: 'hillshade', source: 'mira-terrain',
        paint: { 'hillshade-exaggeration': 0.28, 'hillshade-shadow-color': '#263746' } },
      { id: 'mira-territory-fill', type: 'fill', source: 'mira-territories',
        paint: {
          'fill-color': ['coalesce', ['get', '_miraFill'], '#0891B2'],
          'fill-opacity': ['case', ['boolean', ['get', '_miraSelected'], false], 0.52, 0.32]
        } },
      { id: 'mira-territory-line', type: 'line', source: 'mira-territories',
        paint: {
          'line-color': ['case', ['boolean', ['get', '_miraSelected'], false], '#FFFFFF',
            ['coalesce', ['get', '_miraLine'], '#0891B2']],
          'line-width': ['case', ['boolean', ['get', '_miraSelected'], false], 3.2, 1.5],
          'line-opacity': 0.96
        } },
      { id: 'mira-territory-label', type: 'symbol', source: 'mira-territories',
        layout: { 'text-field': ['coalesce', ['get', 'nombre'], ['get', 'Barrio'], ''],
          'text-size': 10, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#172033', 'text-halo-width': 1.4 } }
    ]
  };

  let map3d;
  let lastBoundsFit = false;
  let lastSelectedName = null;
  const status = document.createElement('div');
  status.className = 'mira-map3d-status';
  status.textContent = 'Motor 3D experimental · terreno Mapterhorn';
  container.appendChild(status);

  try {
    map3d = new maplibregl.Map({
      container,
      style,
      center: [-74.3542, 4.8123],
      zoom: 13.8,
      pitch: 58,
      bearing: -18,
      maxPitch: 78,
      antialias: true,
      attributionControl: true
    });
    map3d.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map3d.addControl(new maplibregl.TerrainControl({ source: 'mira-terrain', exaggeration: 1.15 }), 'top-right');

    map3d.on('load', () => {
      map3d.setTerrain({ source: 'mira-terrain', exaggeration: 1.15 });
      // Registrar eventos después de que las capas existan en el estilo.
      map3d.on('click', 'mira-territory-fill', event => {
        const feature = event.features && event.features[0];
        const name = feature?.properties?._miraName;
        if (name && typeof window.MIRA_MAP3D_BRIDGE?.selectTerritory === 'function') {
          window.MIRA_MAP3D_BRIDGE.selectTerritory(name);
        }
      });
      map3d.on('mouseenter', 'mira-territory-fill', () => { map3d.getCanvas().style.cursor = 'pointer'; });
      map3d.on('mouseleave', 'mira-territory-fill', () => { map3d.getCanvas().style.cursor = ''; });
      status.textContent = 'Terreno 3D activo · polígonos sincronizados desde MIRA';
      window.dispatchEvent(new CustomEvent('mira:map3d-ready'));
    });
    map3d.on('error', event => {
      console.warn('[MIRA 3D] Error de fuente o renderizado:', event.error || event);
      status.textContent = 'Motor 3D iniciado · revisa la disponibilidad de las fuentes cartográficas';
    });
  } catch (error) {
    console.error('[MIRA 3D] No fue posible iniciar MapLibre:', error);
    status.textContent = 'No se pudo iniciar el motor 3D. El mapa original sigue disponible.';
    return;
  }

  function toFeatureCollection(detail) {
    const source = detail && detail.data;
    if (!source || !Array.isArray(source.features)) return null;
    const features = source.features.filter((feature, index) => {
      const name = feature.properties?.nombre || feature.properties?.Barrio || 'Sector ' + (index + 1);
      return detail.filters?.[name] !== false;
    }).map((feature, index) => {
      const name = feature.properties?.nombre || feature.properties?.Barrio || 'Sector ' + (index + 1);
      const styleProps = feature.properties?.estilo_kml || {};
      return {
        ...feature,
        properties: {
          ...feature.properties,
          _miraName: name,
          _miraFill: styleProps.fill || styleProps.line || '#0891B2',
          _miraLine: styleProps.line || styleProps.fill || '#0891B2',
          _miraSelected: name === detail.selected || (detail.matches || []).includes(name)
        }
      };
    });
    return { type: 'FeatureCollection', features };
  }

  let pendingDetail = null;
  function applyTerritory(detail) {
    pendingDetail = detail;
    if (!map3d || !map3d.isStyleLoaded()) return;
    const collection = toFeatureCollection(detail);
    if (!collection) return;
    const source = map3d.getSource('mira-territories');
    if (source) source.setData(collection);
    const selectionChanged = detail.selected !== lastSelectedName;
    if ((!lastBoundsFit || selectionChanged) && collection.features.length) {
      const bounds = new maplibregl.LngLatBounds();
      collection.features.forEach(feature => {
        const visit = coordinates => {
          if (!Array.isArray(coordinates)) return;
          if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
            bounds.extend(coordinates);
          } else coordinates.forEach(visit);
        };
        visit(feature.geometry?.coordinates);
      });
      if (!bounds.isEmpty()) {
        map3d.fitBounds(bounds, {
          padding: { top: 55, right: 55, bottom: 55, left: 410 },
          maxZoom: detail.selected ? 17 : 14,
          pitch: 58,
          duration: selectionChanged ? 450 : 0
        });
        lastBoundsFit = true;
      }
    }
    lastSelectedName = detail.selected || null;
  }

  window.addEventListener('mira:territory-render', event => applyTerritory(event.detail));
  window.addEventListener('mira:map3d-ready', () => {
    if (pendingDetail) applyTerritory(pendingDetail);
  });


  window.MIRA_MAP3D = {
    map: map3d,
    enabled: true,
    destroy() {
      if (map3d) map3d.remove();
      container.hidden = true;
      leafletContainer.classList.remove('mira-map-3d-hidden');
    }
  };
  console.info('[MIRA 3D] Motor experimental preparado. Leaflet y sus capas originales permanecen disponibles.');
})();
