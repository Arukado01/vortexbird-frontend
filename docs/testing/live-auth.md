# Pruebas reales de autenticación y permisos

Esta suite recorre el portal desplegado, Keycloak y la API reales. No usa `e2e/fixtures.ts`, no intercepta respuestas, no cambia el reloj y no inicia servicios. Su preparación y validación de TypeScript no equivalen a una ejecución satisfactoria contra proveedores.

## Antes de ejecutar

1. Inicia la plataforma y verifica que el frontend, la API con PostgreSQL y Keycloak respondan. La URL de la API debe coincidir con la que el navegador utiliza; si existe proxy `/api/v1`, usa el origen del frontend.
2. El portal debe ofrecer **Iniciar sesión con Keycloak**, con `VITE_DEMO_AUTH=false`. La API puede conservar el modo demo permitido en Development, pero estas pruebas usan únicamente tokens emitidos por Keycloak.
3. Usa una cuenta QA dedicada, activa, con correo verificado y sin acciones obligatorias pendientes, MFA interactivo ni cambios de contraseña requeridos. Debe existir un usuario VortexBird activo cuyo `subject` coincida exactamente con el `sub` de Keycloak. La cuenta principal necesita `dashboard.read` y `users.read`, o `*`.
4. El cliente público `vortexbird-portal` debe admitir la URL real del portal como redirect, web origin y post-logout redirect. API y portal deben usar el mismo issuer público y certificados válidos. La suite rechaza HTTPS inválido y HTTP externo a loopback.
5. Instala Chromium con `npx playwright install chromium` si aún no está disponible. `PLAYWRIGHT_BROWSERS_PATH` puede apuntar a una caché existente compatible; no descarga navegadores.

El seed normal solo garantiza el administrador. Los roles de Keycloak no reemplazan la vinculación y permisos almacenados en PostgreSQL. La configuración del realm no incluye usuarios generales listos para pruebas.

## Local: reutilizar el lanzador

Desde la carpeta contenedora, ejecuta el lanzador con las pruebas conectadas. Este comando comprueba los servicios, configura las URLs del puerto vigente y ejecuta Playwright con el usuario local de Keycloak.

```powershell
.\Continuar-VortexBird.cmd -RunLiveTests
```

El archivo se lee sin modificarlo. Se reutilizan `DEMO_EMAIL` y `DEMO_PASSWORD` como credenciales del usuario **importado en Keycloak por el lanzador**, no para llamar a `/auth/demo-login`. Se derivan el portal de `FRONTEND_PORT`, el realm de `KEYCLOAK_PORT` y la base API de `VITE_API_BASE_URL` o `/api/v1`. El identificador local importado debe coincidir con el administrador sembrado (`demo-admin`). Si el lanzador todavía presenta login demo, reinícialo en modo OIDC antes de ejecutar la suite.

`LIVE_LOCAL_ENV_FILE` solo se acepta cuando portal, API e issuer están en `localhost`, `127.0.0.1` o `::1`. No puede utilizarse para enviar credenciales locales a staging. Las variables `LIVE_*` explícitas tienen prioridad. El lector no expande variables ni ejecuta contenido del `.env`.

## Staging HTTPS

Indica las URLs y credenciales de cuentas QA del entorno. No pegues contraseñas en archivos versionados ni en argumentos de comandos:

```powershell
Remove-Item Env:LIVE_LOCAL_ENV_FILE -ErrorAction SilentlyContinue
$env:LIVE_FRONTEND_URL = 'https://portal.example.test'
$env:LIVE_API_BASE_URL = 'https://portal.example.test/api/v1'
$env:LIVE_OIDC_ISSUER = 'https://identity.example.test/realms/vortexbird'
$env:LIVE_QA_USERNAME = Read-Host 'Usuario QA principal'
$env:LIVE_QA_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Contraseña QA' -AsSecureString)).Password
try { npm run test:e2e:live }
finally { Remove-Item Env:LIVE_QA_PASSWORD -ErrorAction SilentlyContinue }
```

Los dominios del ejemplo son marcadores; reemplázalos por endpoints reales. No se crean usuarios, pedidos, pagos, reservas ni recursos cloud. El intento inválido usa un nombre inexistente bajo `example.invalid` para evitar bloquear la cuenta QA real.

## Comprobación opcional entre roles

Para verificar denegaciones, prepara una segunda identidad QA y vincúlala a un rol que contenga `dashboard.read` y `orders.read`, sin `users.read` ni `*`. No uses el `VIEWER` sembrado para esta prueba: incluye permisos `.read` de todos los módulos.

Configura `LIVE_RESTRICTED_USERNAME` y `LIVE_RESTRICTED_PASSWORD` en el proceso igual que la cuenta principal. Con esa cuenta se verifica `/orders` con 200, `/users` con 403, ruta de usuarios restringida y enlace de usuarios oculto. No se prueban denegaciones enviando mutaciones vacías.

Si ambas variables faltan, **solo esta prueba se omite** y el reporte indica `coverageStatus: partial` y que los límites entre roles no fueron verificados. Si se configura solo una variable o se reutiliza el mismo usuario principal, se rechaza la configuración. `LIVE_QA_PERMISSIONS` y `LIVE_RESTRICTED_PERMISSIONS` permiten exigir permisos adicionales separados por comas; no eliminan los permisos necesarios para los escenarios descritos.

## Escenarios y duración

| Escenario | Evidencia de aprobación |
|---|---|
| Anónimo | `/auth/me` y `/users` responden 401; ruta protegida muestra login |
| Credenciales inválidas | Keycloak muestra error y conserva el formulario |
| Login principal | Keycloak emite token; `/auth/me` reconoce usuario y permisos; `/users` responde 200 |
| Recarga SSO | Recargar `/users` restaura sesión real y vuelve al mismo módulo |
| Roles, si hay segunda cuenta | API devuelve 200/403 según permiso y la interfaz bloquea Usuarios |
| Renovación real | Se observa un grant `refresh_token` exitoso y una nueva consulta `/auth/me` válida |
| Logout | El portal cierra sesión, se confirma Keycloak si lo solicita y volver a acceder exige credenciales |

En loopback se añaden cuatro recorridos de lectura con el administrador local. La suite registra once escenarios en local y siete en staging HTTPS. Los cuatro recorridos requieren los permisos de lectura de todos los módulos visitados.

| Recorrido local | Comprobaciones |
|---|---|
| Ayuda antes del login | Abre los once manuales, recarga sus URLs directas, comprueba búsqueda, filtros, versión, historial y acceso a impresión |
| Ayuda con sesión | Entra al manual desde Usuarios, abre los once manuales desde el catálogo y regresa al módulo de origen |
| Administración | Cambia el período del dashboard, lee Usuarios, Partners, Canales y Activity Log, busca usuarios y comprueba las páginas de diez registros. Recorre la segunda página cuando hay datos suficientes. Contrasta el catálogo de permisos, la configuración y las filas o el estado vacío de Reportes con las respuestas HTTP |
| Operación | Revisa órdenes, productos, inventario, precios, pagos, eventos, webhooks y entregas. Verifica el catálogo de integraciones, su historial y la correspondencia de la ayuda contextual |

El recorrido comprueba las lecturas de la API desde el navegador. La comprobación de impresión conectada valida el botón visible. La generación del PDF se ejerce en la suite de interfaz aislada.

La renovación espera el vencimiento real: con el realm de 300 segundos puede tardar alrededor de cinco minutos más el intervalo de comprobación. `LIVE_REFRESH_MAX_WAIT_SECONDS` vale 660 por defecto y admite 60–1800. Debe cubrir el TTL recibido más 75 segundos; de lo contrario falla la precondición. No se acelera el reloj ni se cambia el realm para afirmar que hubo renovación real.

## Resultados y protección de secretos

El único reporter genera `test-results/live/live-results.json` con nombres fijos, estado, fecha, duración, omisiones y errores genéricos. No guarda tokens, passwords, códigos OAuth, URLs, payloads, headers, storage, pasos, excepciones completas ni salidas de workers. Traces, vídeos y capturas están desactivados; los errores se sanitizan antes del cierre y `preserveOutput: never` descarta artefactos transitorios de Playwright. No habilites `DEBUG`, `PWDEBUG`, reporters adicionales ni capturas durante este recorrido de credenciales.

Un error genérico se investiga repitiendo solo el caso afectado y observando el portal de forma autorizada, sin registrar credenciales. Las pruebas viven en `e2e-live/`, separadas de los escenarios con datos sintéticos. El smoke anterior `e2e/keycloak-smoke.mjs` mantiene su propósito restringido a un proveedor local y un callback de laboratorio; no demuestra el recorrido del portal ni debe utilizarse como prueba de staging.

Para validar únicamente la suite sin conectarse al entorno:

```powershell
npx tsc --project tsconfig.live.json
npx eslint e2e-live playwright.live.config.ts
```

Estas dos comprobaciones validan código, no autenticación ni disponibilidad de servicios.
