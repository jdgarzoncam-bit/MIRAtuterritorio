# Integración Neon — MIRA TU TERRITORIO

## Entorno aislado
- GitHub: rama `mira-crud-neon` (no modificar `main` hasta aprobar pruebas).
- Neon: proyecto `my-first-project`, rama `production`, base `neondb`.
- Neon Auth: Better Auth administrado.
- Neon Data API: REST/PostgREST habilitado para el esquema `mira`.

## Servicios
- Auth URL: `https://ep-round-dawn-b7l3ya3h.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth`
- Data API URL: `https://ep-round-dawn-b7l3ya3h.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1`
- Cliente de autenticación: `mira-auth.js`.
- Cliente de datos CRUD: `mira-data.js`.
- Formulario público de reportes: `reporte-publico.html`.

No incluir DATABASE_URL, contraseñas, API keys ni tokens en GitHub.

## Roles
- `admin`: administración total (la asignación inicial se realiza por SQL privado).
- `operator`: CRUD de personas, actividades y asistencias; consulta de reportes.
- `viewer`: lectura de personas, actividades, asistencias y reportes.
- `witness`: no tiene acceso a los registros privados; el formulario público solo inserta reportes anónimos.

Las cuentas Neon Auth se crean en el panel de Neon. Después el administrador debe asociar el id de usuario de Neon Auth a `mira.user_profiles.auth_user_id`, asignando rol y estado activo. No existe registro público de cuentas.

## Datos públicos
El formulario no recopila nombres, cédulas, teléfonos, correos ni afiliación política. Solo permite reportar puesto, mesa, tipo y descripción objetiva. No expone endpoints de lectura. Los archivos/fotografías de actas no se habilitan en esta fase.

## Operaciones CRUD disponibles
El cliente `window.MIRA_DATA` ofrece:
- `listPeople({cedula,search})`, `createPerson`, `updatePerson`, `archivePerson`.
- `listActivities`, `createActivity`, `updateActivity`, `cancelActivity`.
- `listAttendances`, `createAttendance`, `updateAttendance`, `deleteAttendance`.
- `listOperationalReports`, solo para usuarios autenticados con rol permitido.
- `submitPublicReport`, sin autenticación de usuario y limitado por RLS a inserción.

## Verificación pendiente
1. Crear al menos un usuario Neon Auth y provisionar su fila en `mira.user_profiles` por consola segura.
2. Confirmar que el JWT Neon Auth incluye el rol de Data API `authenticated`.
3. Probar lectura/escritura con admin y operator; lectura sin escritura con viewer.
4. Probar que una cuenta sin perfil y un usuario anónimo no pueden leer tablas privadas.
5. Probar que el formulario público puede insertar y no puede leer ni modificar reportes.
6. Probar duplicado de cédula y duplicado de asistencia.
7. Revisar los flujos de UI en una copia de pruebas antes de modificar `app.js` o `main`.

## Nota
Neon Data API es el backend REST administrado; no se expone conexión PostgreSQL desde el navegador. PostgreSQL RLS y grants controlan el acceso. Esta primera integración no habilita aún las fotos E-14 ni un registro público con datos identificables de testigos. Para recopilar datos personales de participantes/testigos se necesita definir finalidad, autorización, aviso de privacidad, retención y medidas de seguridad antes de abrir ese flujo.


## Formularios públicos y acceso de usuarios
- Registro público de testigos: `testigo-publico.html`. Recoge nombre, contacto, puesto, mesa y autorización expresa.
- Panel interno de validación de testigos: `testigos-admin.html`. Roles admin/operator pueden cambiar el estado; viewer solo consulta.
- Reporte público no identificable: `reporte-publico.html`.
- Las rutas públicas solo insertan. No pueden consultar registros ni listar testigos.
- Módulo Actividades: `mira-activity-bridge.js` reemplaza la persistencia local de los botones de crear actividad, buscar cédula, guardar asistencia, editar asistencia, abrir carpetas y exportar Excel por operaciones de Neon.
- Cliente de datos: `mira-data.js`. Cliente de autenticación: `mira-auth.js`.
- Solicitud de cuenta: `registro-usuario.html`. Crear una cuenta NO le da acceso hasta que exista un perfil activo.

## Primer administrador y alta de operadores
1. Abre `registro-usuario.html` desde GitHub Pages y crea la cuenta que será el administrador inicial.
2. En Neon SQL Editor, selecciona la rama `production` y ejecuta el siguiente SQL sustituyendo el correo:
```sql
INSERT INTO mira.user_profiles (auth_user_id, email, display_name, role, active)
SELECT id::text, email, name, 'admin', true
FROM neon_auth."user"
WHERE lower(email) = lower('CORREO_ADMINISTRADOR')
ON CONFLICT (auth_user_id) DO UPDATE
SET role = 'admin', active = true, email = EXCLUDED.email, display_name = EXCLUDED.display_name;
```
3. Los demás usuarios crean su cuenta en `registro-usuario.html`. El administrador los habilita con este patrón, cambiando correo y rol:
```sql
INSERT INTO mira.user_profiles (auth_user_id, email, display_name, role, active)
SELECT id::text, email, name, 'operator', true
FROM neon_auth."user"
WHERE lower(email) = lower('CORREO_OPERADOR')
ON CONFLICT (auth_user_id) DO UPDATE
SET role = EXCLUDED.role, active = true, email = EXCLUDED.email, display_name = EXCLUDED.display_name;
```
Roles admitidos: `admin`, `operator`, `witness`, `viewer`. No asignes `admin` salvo a responsables autorizados.

## Consentimiento y datos sensibles
La condición de testigo electoral puede revelar participación u orientación política, que la Ley 1581 de 2012 incluye dentro de datos sensibles. El formulario informa el carácter voluntario de la autorización y solicita autorización expresa; el proceso responsable debe revisar y aprobar el aviso de privacidad, la finalidad, el periodo de conservación, el canal alternativo para quien no autorice y el procedimiento para ejercer derechos antes de publicarlo como canal institucional. Referencia: artículo 5 y 6 de la Ley 1581 de 2012.

## Límites pendientes antes de producción
- El acceso anónimo no tiene todavía un limitador de frecuencia/captcha en el borde. No distribuir ampliamente el formulario hasta añadir protección antiabuso y probarla.
- El almacenamiento de fotografías E-14 todavía no se migró a Object Storage; la galería antigua sigue siendo local.
- La rama GitHub `mira-crud-neon` aún no está desplegada en GitHub Pages por defecto. Las pruebas deben abrirse desde esa rama mediante Pages preview o un entorno local.
- La Data API y RLS se configuraron en `production`; no apuntar producción a esta URL.
- Verificar JWT de usuario/anon, lectura denegada sin perfil, roles, duplicados y flujos de formulario antes de cambiar `main`.
