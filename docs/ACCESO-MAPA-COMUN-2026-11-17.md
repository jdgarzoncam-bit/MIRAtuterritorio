# Acceso cartográfico común — 2026-11-17

## Decisión funcional

El mapa territorial es una herramienta común del Centro de Operaciones. Toda cuenta con perfil activo, correo verificado y aprobación administrativa (roles `operator` o `viewer`) puede ingresar al PMU y utilizar la cartografía común, sin requerir un permiso de consulta en otro módulo.

El rol administrador principal conserva su bypass administrativo.

## Cambios aplicados en QA

- `mira-auth.js`: se eliminó la condición que exigía al menos un permiso de módulo para completar el inicio o la revalidación de sesión.
- La autenticación ahora verifica identidad, perfil, estado activo, correo verificado y rol permitido. La matriz de módulos deja de ser una dependencia del login.
- `mira-admin.js`: los controles de Barrios y Puestos (`centro_operaciones`) quedan habilitados para toda cuenta autenticada y aprobada.
- Si la consulta de la matriz de permisos falla temporalmente, se bloquean los módulos privados, pero se conserva el acceso a las herramientas cartográficas comunes.
- Los demás módulos siguen sujetos a la matriz individual de permisos.
- `index.html`: se actualizaron los parámetros de versión para evitar servir archivos JavaScript antiguos desde caché.
- `tests/session-module-lock-regression.test.cjs`: se agregaron y actualizaron pruebas para esta política.

## Límites de seguridad

- No se modificó Neon, PostgreSQL, las políticas RLS ni los datos.
- No se concedieron permisos CRUD nuevos.
- Las consultas a datos operativos o personales siguen sujetas a sus permisos y políticas RLS.
- InfoMIRA contiene datos personales (por ejemplo, documento y teléfono); su consulta detallada no se habilita automáticamente por el acceso al mapa. Si se necesita una capa agregada de InfoMIRA para todos los operadores, debe diseñarse con exposición mínima y política de lectura específica.
- Testigos/E-14 permanece deshabilitado.

## Validación automatizada

- GitHub Actions, workflow `Validar JavaScript de MIRA`, ejecución #360.
- Commit validado: `99329c4b8a483bba326e8994fd0d0368bc154f42`.
- Resultado: sintaxis JavaScript correcta; 79 pruebas aprobadas y 0 fallidas.

## Pendiente

1. Validación visual en navegador con cuentas reales operator y viewer.
2. Confirmar carga de GeoJSON y renderizado visible de los 143 polígonos en el entorno QA servido.
3. Comprobar búsqueda, selección, filtros, puestos y marcadores.
4. Revisar la capa de InfoMIRA sin exponer datos personales a usuarios sin autorización.
5. Mantener la rama QA separada de `main`; no publicar ni fusionar hasta completar la validación y la reconciliación de ramas.

## Alcance del cambio

Trabajo realizado únicamente en `preview/neon-qa-control-admin`. No se modificó `main` ni se publicó producción.
