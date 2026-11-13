# VortexBird Integration Platform — Frontend

Portal operacional React/TypeScript para la capa de interoperabilidad AndesRetail. Consume exclusivamente `/api/v1`; no contiene un fallback de datos comerciales ficticios. Los datos simulados se identifican en la interfaz y viven en los seeders/adaptadores del backend. Las fixtures E2E están aisladas en `e2e/`.

## Ejecución local

Requisitos: Node 24, npm y API .NET en `http://localhost:5080`. Para la plataforma completa, utilizar Docker Compose del repositorio `vortexbird-infrastructure`.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Vite escucha en `http://localhost:5173` y reenvía `/api` al backend. `API_PROXY_URL` cambia el destino del proxy. La configuración se puede suministrar mediante `.env` (desarrollo) o `window.__VORTEX_CONFIG__` generado en `/config.js` (contenedor). No añadir secretos a variables `VITE_*`.

| Variable pública | Valor por defecto | Uso |
|---|---|---|
| VITE_API_BASE_URL | /api/v1 | Base de la API |
| VITE_KEYCLOAK_URL | http://localhost:8080 | Proveedor OIDC |
| VITE_KEYCLOAK_REALM | vortexbird | Realm |
| VITE_KEYCLOAK_CLIENT_ID | vortexbird-portal | Cliente público PKCE |
| VITE_DEMO_AUTH | false | Activar explícitamente autenticación Development de la API |

La contraseña del usuario de demostración se configura en el backend y no está incluida en el bundle. Se introduce en el formulario. La creación de usuarios de administración vincula el `sub` de Keycloak con un usuario de la plataforma; no crea una contraseña local ni una cuenta OIDC.

## Arquitectura

- `src/app`: router, proveedores y navegación adaptable.
- `src/features`: dashboard, administración, órdenes, integraciones, permisos, reportes y configuración.
- `src/services`: cliente Axios centralizado y cliente Authorization Code PKCE.
- `src/components/ui`: controles, diálogos nativos con gestión de foco, paginación, skeletons y errores.
- `src/lib`: tokens de configuración, formatos seguros y exportación CSV con neutralización de fórmulas.
- `src/styles`: tokens centralizados, tema claro/oscuro, accesibilidad y responsive.

TanStack Query administra la caché y sus invalidaciones; el servidor pagina, filtra y agrega. React Hook Form + Zod valida el acceso. El dashboard carga Recharts de forma diferida. No se aplica seguridad solamente en React: la API valida permisos y pertenencia a partner/canal. Una métrica restringida (`null`) se muestra como `—`, nunca como cero.

## Identidad

Cliente OIDC público mediante Authorization Code + PKCE S256. Valida `state` de un solo uso y máximo 10 minutos, issuer exacto y origen de endpoints. Access y refresh token permanecen en memoria. `sessionStorage` guarda únicamente state y code verifier durante el redireccionamiento. La identidad y permisos provienen de `/auth/me` tras validación JWT del backend; no se confía en un ID token decodificado por el navegador. Refresh serializado con protección frente a respuestas que lleguen después del logout. Recargar completamente la página requiere iniciar sesión nuevamente (Keycloak puede conservar su sesión SSO).

El adaptador `keycloak-js` no estaba disponible en el entorno desconectado; se implementó un cliente de alcance reducido en `services/oidc.ts` con pruebas de state, issuer y carrera logout/refresh. Requiere validar el flujo completo con el Keycloak desplegado antes de producción. Registro se delega al formulario de Keycloak; el enlace de cambio de contraseña usa `kc_action=UPDATE_PASSWORD`, y la recuperación sin credenciales se realiza con «Forgot password» en el formulario de Keycloak, sujeto a SMTP configurado. La rotación de claves y revocación efectiva de tokens son responsabilidades de Keycloak/API.

## Funciones

Dashboard de métricas persistidas; listados paginados; partners/canales/productos/usuarios; roles dinámicos y matriz de permisos; asignación de roles; creación y detalle de órdenes con clave de idempotencia estable ante reintento; cancelación; stock/precios; pagos simulados; integraciones y fallos controlados; eventos y DLQ; suscripciones webhook con secreto mostrado una vez; auditoría; exportación limitada a la página/serie seleccionada; tema y navegación por teclado.

No se anuncian SLO medidos, integraciones productivas, ni capacidad de cobro real. El logo oficial no se pudo descargar por restricción DNS; se emplea un icono genérico de conectividad (no un logo recreado) y queda pendiente incorporar el archivo oficial sin alterarlo. Tokens navy/turquesa/naranja basados en el material compartido, pendientes de cotejo exacto con asset oficial.

## Calidad

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas unitarias cubren callbacks OIDC alterados, issuer erróneo, carrera de refresh/logout, exportación CSV segura, métricas restringidas, paginación y errores con correlación. Las E2E verifican escritorio/móvil, tema, matriz de permisos e idempotencia del formulario; utilizan API interceptada explícitamente y no demuestran que el backend esté desplegado.

## Contenedor y CI/CD

Docker multi-stage, nginx sin privilegios (UID 101) en puerto 8080, escritura únicamente en `/tmp`, health endpoint `/health`. Proporcionar `VITE_*` al contenedor; el entrypoint rechaza caracteres que puedan inyectar código en la configuración. `/api` se reenvía al servicio `backend:8080`.

GitHub Actions verifica código, pruebas y build. Publicación ECR y rollout solo cuando las variables de entorno protegido están configuradas; autenticación AWS mediante OIDC sin claves permanentes. Configurar `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `ECR_REPOSITORY`, `EKS_CLUSTER_NAME`, `FRONTEND_URL` y aprobación del ambiente staging según el plan de infraestructura. Un fallo de rollout ejecuta rollback.

## Convenciones

Ramas `main`, `develop`, `feature/*`, `fix/*`, `hotfix/*`. Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Cada cambio funcional debe incluir revisión del contrato API y permisos. Nunca guardar `.env`, tokens, credenciales o capturas de cuentas reales en Git.

## Referencias

- https://www.keycloak.org/securing-apps/javascript-adapter
- https://tanstack.com/query/latest/docs/framework/react/overview
- https://vortexbird.com/
