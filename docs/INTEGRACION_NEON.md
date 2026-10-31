# Integración Neon — MIRA TU TERRITORIO

## Entorno aislado
- GitHub: rama `mira-crud-neon` (no modificar `main` hasta aprobar pruebas).
- Neon: proyecto `my-first-project`, rama `mira-crud-dev`, base `neondb`.
- Neon Auth: Better Auth administrado.
- Neon Data API: REST/PostgREST habilitado para el esquema `mira`.

## Servicios
- Auth URL: `https://ep-lucky-smoke-b73q7rl0.neonauth.c-13.us-east-1.aws.neon.tech/neondb/auth`
- Data API URL: `https://ep-lucky-smoke-b73q7rl0.apirest.c-13.us-east-1.aws.neon.tech/neondb/rest/v1`
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
