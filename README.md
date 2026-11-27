# MIRA TU TERRITORIO

Plataforma web de gestión territorial: mapa de barrios y zonas, actividades y asistencias, registro de participantes, PQRS y reportes ciudadanos, y paneles electorales. Es un **sitio estático** (HTML + JavaScript sin paso de compilación) publicado en GitHub Pages, con autenticación y datos en **Neon** (Neon Auth + Neon Data API sobre PostgreSQL con RLS).

- Sitio: https://jdgarzoncam-bit.github.io/MIRAtuterritorio/
- Rama de producción: `main`

## Estructura

| Ruta | Contenido |
| --- | --- |
| `index.html`, `app.js`, `style.css` | Aplicación principal |
| `mira-data.js` | Cliente único de la Neon Data API (publica `window.MIRA_DATA`) |
| `mira-auth.js`, `mira-admin.js` | Autenticación (Neon Auth) y administración de permisos |
| `actividad.html`, `activity-portal.js` | Portal público de registro a actividades |
| `registro-usuario.*`, `reset-password.html` | Alta de usuarios y recuperación de contraseña |
| `barrios*.geojson`, `electoral_*.js(on)` | Datos geográficos y electorales |
| `migrations/` | Migraciones SQL (se revisan y aplican a mano en Neon) |
| `docs/` | Documentación operativa (ver `docs/INTEGRACION_NEON.md`) |
| `tests/` | Pruebas de regresión (`node:test`) |

## Desarrollo

Requiere Node 20 o superior. No hay dependencias que instalar.

```bash
npm run validate   # sintaxis de todos los .js + todas las pruebas
npm test           # solo las pruebas
```

Para ver el sitio localmente: `python3 -m http.server 8080` y abrir http://localhost:8080.

## Reglas importantes

- **Nunca** subir contraseñas, `DATABASE_URL`, API keys, JWT ni PIN al repositorio.
- **Versión de `mira-data.js`:** todas las referencias (`<script>` e `import`) deben llevar exactamente la misma cadena `?v=...`. Cada URL distinta crea una instancia separada del módulo y puede dejar una copia vieja en caché. Al cambiar `mira-data.js`, actualiza la versión en todos los archivos; la prueba `tests/module-version-consistency.test.cjs` lo comprueba.
- Cambios de esquema, RLS o permisos: solo mediante migraciones revisadas, probadas primero en una rama QA de Neon. Seguir el procedimiento de `docs/INTEGRACION_NEON.md`.
- El despliegue (`.github/workflows/pages.yml`) publica únicamente los archivos del sitio; `docs/`, `migrations/`, `tests/` y los `.md` no se publican.
