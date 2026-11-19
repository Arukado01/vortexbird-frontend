# Historial de documentación

## 2026-11-17 - Recorridos conectados locales

Playwright incluye cuatro recorridos adicionales de lectura para administración, operación y los once manuales con y sin sesión. Se validaron el listado de escenarios y las rutas de ayuda. Falta ejecutarlos contra el portal y su API en Windows. [Pruebas de autenticación y navegación](docs/testing/live-auth.md).

## 2026-11-17 — Suite de autenticación conectada

- Se agrega `docs/testing/live-auth.md` y el comando `npm run test:e2e:live`, independiente de los escenarios con API interceptada. Usa el portal, Keycloak y API reales, con el `.env` local explícito solo para loopback o variables de staging HTTPS.
- Sin impacto: la suite no cambia la autenticación productiva ni las instrucciones de los once manuales. La cuenta principal cubre login, rechazo, recarga SSO, renovación real y logout; la comparación de roles queda expresamente omitida cuando falta una segunda cuenta QA.
- Validación de preparación: TypeScript y ESLint focales aprobados; ocho comprobaciones de límites de configuración aprobadas sin red; `docs:check` valida once manuales y dieciocho rutas. Estos resultados no acreditan ejecución de la suite contra servicios reales.

## 2026-11-17 — Validación funcional y accesibilidad

- `acceso` 1.1.1: recuperar una pestaña OIDC con una nueva autorización PKCE silenciosa, conservar el módulo de origen y regresar al login cuando expire SSO. Los tokens de Keycloak continúan únicamente en memoria; cierre de sesión borra la marca de recuperación.
- `usuarios-permisos` 1.1.2: asignar roles exige `users.update` y `roles.assign_permissions`; no está permitida la autoasignación.
- `dashboard` 1.1.1: la gráfica Órdenes por canal se conserva en tablet y móvil. El enlace a la actividad cuenta con nombre accesible.
- Contraste del botón principal corregido: blanco sobre #067b76, relación 5,12:1; hover #056b67, 6,35:1. La inspección visual y las capturas dependen del recorrido de navegador.
- Listados de usuarios, partners, canales, catálogo, inventario, precios, órdenes, pagos, eventos, webhooks, auditoría, ejecuciones, roles y usuarios de cada rol: 10 registros por página. Manuales afectados actualizados; los agregados del reporte conservan el período completo.
- Sin impacto: "test:e2e:isolated" sirve el bundle compilado y respuestas de prueba; no altera el comportamiento productivo ni acredita integración real.
- Validación: pruebas unitarias OIDC con recuperación, expiración y estado PKCE; `docs:check`, ESLint y build. Resultados y límites se registran en el informe de validación integral.

## 2026-11-17

- Las once guías pasan a la versión 1.1.0. `acceso`, `dashboard`, `usuarios-permisos`, `partners-canales`, `catalogo-inventario-precios`, `ordenes`, `pagos`, `eventos-webhooks`, `auditoria`, `integraciones-configuracion` y `reportes` admiten lectura, búsqueda e impresión públicas. Los permisos se indican en cada procedimiento.
- Se revisaron los controles Crear usuario, Crear partner, Exportar página, Historial de entregas, Historial de ejecuciones y Guardar configuración. Playwright recorre cada manual, vuelve al origen y comprueba que la navegación pública no solicita la sesión.
- Sin impacto: la selección del proxy Nginx en ECS conserva las rutas visibles y el origen de las peticiones.

- Publicación inicial de los manuales `acceso`, `dashboard`, `usuarios-permisos`, `partners-canales`, `catalogo-inventario-precios`, `ordenes`, `pagos`, `eventos-webhooks`, `auditoria`, `integraciones-configuracion` y `reportes`.
- El manual de acceso incluye las pantallas de registro y recuperación del portal. Los de órdenes y pagos documentan los controles de simulación disponibles en desarrollo.
- Los manuales de acceso y dashboard ilustran procedimientos con capturas obtenidas mediante Playwright a partir del portal y datos sintéticos.
