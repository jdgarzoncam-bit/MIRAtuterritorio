# Auditoría operativa de enlaces y conexiones — 2026-11-25

## Resultado de verificación

### GitHub / GitHub Pages
- Repositorio y rama principal verificados: `jdgarzoncam-bit/MIRAtuterritorio`, `main`.
- El sitio configurado en Pages es `https://jdgarzoncam-bit.github.io/MIRAtuterritorio/`.
- El commit `5c4ecad6adf4b4b71d398347dca44a5f3c493603` renovó la caché de `app.js`.
- El primer intento de Pages falló al crear/consultar el deployment. Después, el commit documental `3e919962fd364aa5c18870347a9c13b36db0544b` se publicó correctamente: GitHub Actions run 215 terminó `success` el 2026-11-25.
- El despliegue de `main` está confirmado por Actions; queda pendiente la comprobación visual de los flujos desde navegador real.

### Neon
- Auth y Data API usan el mismo endpoint de proyecto `ep-round-dawn-b7l3ya3h`; no se detectó diferencia entre los dos clientes activos.
- La rama por defecto de Neon es `production`.
- Producción tras limpieza: 1 actividad, 36 asistencias, 594 personas.
- QA difiere de producción: no tiene `mira.reportes_operativos` y conserva 21 asistencias. No promover ni copiar datos entre ramas sin migración revisada.

### Archivos activos
- `index.html` carga `mira-data.js?v=20261125-prod-endpoint-1`, `mira-auth.js?v=20261125-prod-endpoint-1` y `app.js?v=20261125-activity-history-cache-1`.
- `actividad.html` carga `activity-portal.js?v=20261125-prod-endpoint-1`.
- `activity-portal.js` y `mira-quick-modules.js` importan el cliente compartido `mira-data.js`.

## Hallazgos que requieren trabajo controlado

1. `docs/neon-security.sql` era un borrador obsoleto: mencionaba `mira.audit_logs` y `mira.evidencias`, tablas que no existen en el esquema actual. Se marca expresamente como retirado para evitar que alguien lo ejecute.
2. `docs/INTEGRACION_NEON.md` contenía instrucciones antiguas sobre no modificar main, un entorno de preview y tablas/endpoints que ya no describen el estado actual. Se actualiza con la fuente de verdad verificada.
3. Las tres tablas de acceso PIN no tienen RLS activado, aunque actualmente tampoco conceden privilegios de tabla a los roles Data API `anonymous` y `authenticated`. No conceder permisos sin diseñar y probar las políticas primero.
4. Se observan triggers de auditoría generales y específicos en actividades, asistencias y personas. Revisar si generan eventos duplicados antes de tocar su configuración.
5. La rama QA está desfasada respecto de producción en datos y una tabla; no debe tratarse como espejo exacto.

## No se hizo
- No se cambiaron endpoints de Auth/Data API porque ambos coinciden con el endpoint del proyecto Neon.
- No se ejecutaron migraciones de esquema ni cambios de RLS/grants.
- No se copiaron datos QA sobre producción.
- No se eliminaron fichas de personas.
