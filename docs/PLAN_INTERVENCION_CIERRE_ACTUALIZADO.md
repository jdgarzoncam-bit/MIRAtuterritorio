# MIRA TU TERRITORIO — Plan actualizado de intervención y cierre

**Base de trabajo:** rama `feat/landing-reportes-testigos-e14`.  
**Regla de publicación:** no modificar `main` ni desplegar cambios a producción desde esta intervención.  
**Alcance inmediato:** integración parcial y controlada de las interfaces, con prioridad en navegación y acceso temporal al módulo Testigos.

## Decisiones funcionales vigentes

1. Incorporar un menú flotante en la esquina superior izquierda con dos accesos: **Testigos** y **Actividades**.
2. **Testigos / Auditoría E-14** queda temporalmente disponible solo para la cuenta administradora principal. No se concederá por permisos granulares de módulo mientras esté en ejecución.
3. **Actividades** conserva su integración existente con Neon y su autorización actual por permisos; el acceso rápido no sustituye las validaciones de datos.
4. Se mantienen autenticación, verificación de correo, RLS, políticas de Neon y controles de almacenamiento. La restricción temporal de Testigos es de navegación/entrada; no se desactiva la seguridad del backend.
5. No se ejecutan pruebas con datos ficticios ni operaciones de escritura/borrado sobre registros reales.

## Fases de intervención

| Fase | Intervención | Criterio de cierre |
|---|---|---|
| 1. Navegación prioritaria | Menú superior izquierdo, accesos Testigos y Actividades, estado visible de bloqueo temporal | Accesos conectados a los módulos existentes y visibilidad ligada a sesión |
| 2. Acceso temporal Testigos | Solo administrador principal; retirar la dependencia de permisos granulares para la entrada al módulo | Usuario no administrador no puede abrir la auditoría desde el menú ni desde el botón interno |
| 3. Consolidación de interfaces | Revisar y conectar navegación de Actividades, Reportes ciudadanos, PQRS, Concejal, InfoMIRA y Centro de Operaciones sin duplicar implementaciones | Una ruta de entrada por módulo y flujos documentados |
| 4. Integración de ramas | Revisar PR #27 Logística y PR #28 Reportes; reconciliar archivos compartidos y cambios de `main` | Una rama candidata de integración, sin sobrescribir cambios ni fusionar a ciegas |
| 5. E-14 parcial | Mantener consulta/carga según las capacidades existentes; reconstruir fuente de `e14secure` antes de cambiar su despliegue; documentar eliminación/compensación pendiente | Backend revisado y operación coherente; sin reemplazar la función opaca actual |
| 6. Administración y permisos | Ampliar la matriz administrativa para acciones CRUD/exportación donde corresponda, manteniendo permisos mínimos | Interfaz de administración refleja las acciones soportadas por RLS |
| 7. Cierre técnico | Reconciliar documentación SQL y de integración con Neon; protección de ramas, respaldos y publicación controlada | Versión coherente, revisión estática y aceptación mínima no destructiva |

## Orden de ejecución inmediato

- **Ahora:** cerrar Fase 1 y Fase 2 en la rama de trabajo.
- **Siguiente:** consolidar las rutas de Actividades y las interfaces de Reportes/PQRS/Concejal.
- **Después:** integrar PR #27 y #28 en una rama candidata, resolviendo conflictos antes de solicitar publicación.
- **En paralelo, sin bloquear la navegación:** documentar/reconstruir `e14secure` y corregir la matriz administrativa.
- **Final:** revisión estática, verificación de configuración y una aceptación mínima sin escrituras de prueba. Publicación solo después de revisión explícita.

## Riesgos que siguen abiertos

- GitHub Pages continúa sirviendo `main`; los cambios de esta rama no son todavía la versión pública.
- PR #27 y PR #28 siguen siendo integraciones pendientes.
- El código fuente de `e14secure` no está disponible en el repositorio ni se pudo recuperar desde la integración Neon; no debe sustituirse por una implementación improvisada.
- La matriz administrativa actual solo expone la acción `view`, aunque el backend contempla acciones adicionales.
- La documentación de políticas y respaldos requiere reconciliación con el estado real de Neon.

## Límites de esta entrega

Esta intervención no fusiona PRs, no despliega a producción, no cambia políticas RLS, no elimina datos y no afirma que las interfaces estén aceptadas en producción. El menú y el bloqueo temporal se implementan en la rama indicada; su publicación depende del proceso de integración.
