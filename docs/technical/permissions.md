# Permisos, público y publicación

El perfil elegido en el filtro ayuda a encontrar manuales. La autorización real del workspace usa la lista de permisos de `/auth/me` a través de `AuthProvider.can`. Cada manual declara permisos de lectura alternativos y puede limitar cada procedimiento o pregunta adicional. El backend sigue comprobando permisos y alcance de partner y canal para las operaciones.

El catálogo, títulos, resúmenes y metadatos son públicos. El contenido operativo y sus enlaces se muestran a perfiles con acceso. El catálogo se compila en el frontend y no contiene datos de clientes, credenciales, configuraciones privadas ni procedimientos internos sensibles. El código entregado al navegador no constituye un repositorio de información confidencial.
