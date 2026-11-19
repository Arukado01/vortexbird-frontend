# Documentación viva de VortexBird

Los archivos JSON de [docs/user-manuals](docs/user-manuals) son la fuente pública del centro de ayuda. Sus procedimientos, preguntas frecuentes y capturas están disponibles sin sesión. El permiso de una sección describe quién puede ejecutar la operación en el workspace. Guarda runbooks privados fuera del código y del contenido que se distribuye al navegador. Usa exclusivamente datos ficticios en las capturas.

1. Al cambiar una ruta, permiso, paso, formulario, reporte, estado, configuración o integración visible, identifica los módulos afectados con `src/features/help/index.ts`.
2. Actualiza las secciones correspondientes y agrega al inicio de `history` una versión mayor que la anterior, fecha ISO (AAAA-MM-DD) y una descripción concreta. Conserva todas las entradas publicadas.
3. Agrega al inicio de [DOCUMENTATION_CHANGELOG.md](DOCUMENTATION_CHANGELOG.md) una entrada con el cambio, los identificadores de manual y las verificaciones realizadas. Para un módulo cuyo manual no requiere cambios, registra `Sin impacto [id-del-manual]: <motivo verificable>`. Para cambios compartidos sin efecto en las instrucciones, usa `Sin impacto: <motivo verificable>`.
4. Verifica rutas, permisos y botones en ejecución. Cuando cambie una pantalla ilustrada, actualiza la captura con `UPDATE_HELP_SCREENSHOTS=1` y `npx playwright test e2e/help.spec.ts -g "refreshes screenshots" --project=desktop`. Usa datos sintéticos. Si se modifica una captura, actualiza también su manual.
5. Ejecuta `npm run docs:check`, las pruebas pertinentes y revisa la impresión. Al cambiar una API, identidad, despliegue o arquitectura, enlaza el cambio hermano y actualiza también la documentación de ese repositorio.

En pull requests, CI comprueba metadatos, permisos declarados por sección, referencias y rutas cubiertas. También compara con la base para detectar cambios de flujo sin registro, comprobar versiones e historial, y validar cambios en capturas. La revisión humana contrasta las instrucciones y las imágenes con el comportamiento correspondiente.

## Criterio de terminado

Cada cambio funcional debe estar implementado y probado. Revisa su impacto en documentación, actualiza los manuales afectados y registra el cambio en el historial. Comprueba enlaces, rutas, capturas y permisos frente a la interfaz. Antes de integrar, exige los controles de calidad del PR. Una refactorización sin impacto visible se justifica en el historial sin incrementar la versión de los manuales.

## Evidencia de validación

Registra fecha, comando, entorno, resultado y limitaciones de cada comprobación. `npm run test:e2e:isolated` requiere ejecutar antes `npm run build`: recorre el bundle de producción con respuestas API sintéticas. Sus capturas muestran la interfaz real con datos de prueba; no acreditan una conexión a PostgreSQL, Keycloak, servicios externos o AWS. Distingue estos resultados del recorrido contra servicios desplegados. La prueba de recuperación de sesión debe incluir recarga, retorno al módulo, sesión SSO expirada y cierre de sesión. En tablas paginadas, comprueba el tamaño de 10 registros y el cambio de página sin perder filtros.
