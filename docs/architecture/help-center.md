# Arquitectura del centro de ayuda

- El portal monta `/help` y `/help/:manualId` como rutas directas antes del guard de sesión del workspace. Nginx usa el fallback SPA para ambos enlaces.
- `HelpLink` resuelve la ruta con `manualByRoute`. El login apunta al manual de acceso y el layout agrega ayuda global y contextual. El enlace preserva el origen para volver al módulo.
- `HelpCenter` carga once manuales públicos y aplica filtros mediante parámetros de URL. El navegador aplica estilos de impresión A4. La lectura está disponible aunque no haya una sesión en `/auth/me`.
- Los permisos acompañan los pasos operativos y condicionan el acceso a pantallas autenticadas. Los procedimientos privados y secretos permanecen fuera de los archivos que se distribuyen al navegador.
- Playwright verifica la resolución de links, permisos y PDF de Chromium. Las capturas se generan con el código actual y destinos ficticios.
