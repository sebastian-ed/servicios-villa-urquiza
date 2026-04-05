# Servicios Villa Urquiza

Directorio local tipo marketplace para mostrar proveedores del barrio, filtrarlos por categoría, ver su ficha completa y contactar directo por WhatsApp o email.

## Qué incluye

- Catálogo público con búsqueda, filtros y orden.
- Tarjetas de proveedores.
- Ficha completa por proveedor.
- Reseñas con puntaje de 1 a 5.
- Moderación de reseñas desde panel admin.
- Panel admin con login por Supabase Auth.
- CRUD de categorías.
- CRUD de proveedores.
- Deploy apto para GitHub Pages.

## Stack

- HTML + CSS + JavaScript vanilla.
- Supabase Auth + Database.
- GitHub Pages para hosting estático.

## Estructura

```text
/
├─ index.html
├─ styles.css
├─ app.js
├─ config.js
├─ config.example.js
├─ README.md
└─ supabase/
   └─ schema.sql
```

## Paso 1 - Crear proyecto en Supabase

1. Creá un proyecto nuevo en Supabase.
2. Andá a **SQL Editor**.
3. Ejecutá completo el archivo `supabase/schema.sql`.
4. En **Authentication > Users**, creá un usuario admin o registralo desde la app.
5. Promové ese usuario a admin con una de estas queries:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and u.email = 'tu-admin@dominio.com';
```

## Paso 2 - Configurar el frontend

1. Abrí `config.example.js`.
2. Copialo como `config.js`.
3. Completá:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU-ANON-KEY',
};
```

## Paso 3 - Probar localmente

Podés abrir `index.html` directamente, pero conviene usar un server local.

Ejemplo con VS Code Live Server o con Python:

```bash
python -m http.server 5500
```

## Paso 4 - Deploy en GitHub Pages

1. Subí todos los archivos al repo.
2. En GitHub, andá a **Settings > Pages**.
3. En **Build and deployment**, elegí:
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/root`
4. Guardá.
5. GitHub te va a publicar la web en la URL del repo.

## Flujo operativo recomendado

### Alta de proveedor

- Entrás al panel admin.
- Cargás nombre, descripción, contactos e imagen.
- Le asignás una o varias categorías.
- Queda visible si está activo.

### Reseñas

- Un usuario deja reseña pública.
- La reseña entra como `pending`.
- El admin la aprueba o rechaza.
- Solo se muestran las aprobadas.

## Escalabilidad futura

Esta primera versión es correcta para validar negocio. Pero si querés escalar en serio, te conviene planificar estas mejoras:

- **Supabase Storage** para subir imágenes desde el panel, sin depender de URLs externas.
- **Edge Functions** para validaciones, anti-spam y envíos de email.
- **Geolocalización y mapa** por proveedor.
- **Reservas o solicitudes** desde la plataforma.
- **Planes destacados** para monetización.
- **Multi-barrio** si después querés salir de Villa Urquiza.

## Lógica de permisos

- Público:
  - puede leer categorías
  - puede ver proveedores activos y aprobados
  - puede enviar reseñas nuevas
- Admin:
  - puede crear y editar categorías
  - puede crear y editar proveedores
  - puede aprobar o rechazar reseñas

## Observación importante

GitHub Pages aloja sitios estáticos. Eso está bien para este caso porque el backend real vive en Supabase.

## Siguiente paso recomendado

Cuando valides tracción, la mejora más inteligente no es rehacer todo: es sumar carga de imágenes propia, analítica de clics y monetización por proveedores destacados. Ahí deja de ser una vidriera simpática y pasa a ser un activo comercial.
