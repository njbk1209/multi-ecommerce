# Contexto del Proyecto: Frontend E-commerce Multi-Tenant & Marca Blanca 🛍️ (Versión Supabase)

Este documento proporciona una visión general técnica y arquitectónica del **Frontend E-commerce Multi-Tenant**. La plataforma está concebida como una solución **Marca Blanca (White-Label)** dinámica capaz de adaptarse automáticamente a **múltiples negocios en diversos nichos o industrias** (gastronomía, tiendas de ropa, electrónica, artesanías, repostería, servicios, etc.).

El frontend consume la base de datos de **Supabase**, cuya estructura y modelo de entidades relacionales se encuentran detallados en el archivo de contexto del backend: [context_backend.md](file:///c:/Users/Mabk/Desktop/postrecito/context_backend.md).

---

## 🏬 Concepto Multi-Tenant y Adaptación Multi-Nicho

La aplicación es 100% dinámica y adaptativa. No está atada a un único negocio o rubro comercial:

- **Inyección por API Key (`VITE_STORE_API_KEY`)**: Al cargar la aplicación, el frontend consulta la tabla `store` mediante la clave única definida en las variables de entorno.
- **Personalización Visual al Vuelo**: La UI aplica en tiempo real la identidad de la tienda activa registrada en la base de datos:
  - Paleta de colores (`color_primario`, `color_secundario`, `color_acento`).
  - Tipografía (`font_family`).
  - Marca e imágenes (`comercial_name`, `logo_url`, `descripcion`).
  - Canales de contacto y redes (`whatsapp`, `alt_phone`, `instagram_url`, `facebook_url`).
- **Adaptabilidad a Múltiples Rubros**: Gracias al sistema flexible de categorías jerárquicas y grupos de opciones/variantes reutilizables (talles, sabores, colores, extras, tamaños), cualquier tipo de comercio puede catalogar sus productos o servicios sin modificar el código fuente.

---

## 🚀 Tecnologías y Herramientas

El frontend está construido con un stack moderno y ligero enfocado en el rendimiento y la experiencia de usuario:

- **Framework**: [React 19](https://react.dev/) (JSX y Hooks).
- **Herramienta de Construcción (Bundler)**: [Vite 7](https://vite.dev/) para desarrollo rápido y compilaciones optimizadas.
- **Cliente de Base de Datos**: `@supabase/supabase-js` para interactuar directamente con la API RESTful de Supabase en tiempo real.
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) (integrado mediante `@tailwindcss/vite`).
- **Componentes e Interactividad**:
  - `@headlessui/react` para componentes interactivos de UI (modales de carrito, transiciones).
  - `lucide-react` para iconos vectoriales limpios y responsivos.
- **Notificaciones**: `react-hot-toast` para alertas interactivas no bloqueantes.
- **Métricas y Rendimiento**: `@vercel/analytics` y `@vercel/speed-insights`.

---

## 📁 Estructura del Proyecto

Organización de los archivos principales en el directorio `/src`:

```text
src/
├── assets/             # Recursos estáticos (imágenes predeterminadas, fallback logos)
├── components/         # Componentes reutilizables de UI
│   ├── CartDrawer.jsx     # Panel lateral deslizable para el carrito de compras (procesa items, variantes y redirige a WhatsApp)
│   ├── Footer.jsx         # Pie de página dinámico basado en store.comercial_name y redes sociales
│   ├── ImageCarousel.jsx  # Galería/Carrusel interactivo para imágenes de productos (ProductImagen)
│   ├── Navbar.jsx         # Barra de navegación principal con marca dinámica, selector de divisas (USD/Bs) y carrito
│   └── ProductCard.jsx    # Tarjeta de producto individual con precio dual, etiquetas de descuento e inventario
├── context/            # Manejo del estado global de la aplicación (React Context)
│   ├── CartContext.jsx    # Estado del carrito, variantes elegidas, totales en USD y Bs
│   └── CurrencyContext.jsx# Carga de la tienda activa (store) y tasa de cambio diaria (exchange de Supabase)
├── sections/           # Secciones principales que componen la tienda
│   ├── About.jsx          # Sección informativa adaptable al negocio activo (descripción e historia)
│   ├── Hero.jsx           # Banner principal parametrizado con la marca y estilo del comercio
│   └── ProductList.jsx    # Catálogo dinámico con filtros por categorías, variantes y paginación
├── utils/              # Funciones y configuraciones auxiliares
│   └── supabase.js        # Configuración e inicialización del cliente de Supabase
├── App.jsx             # Punto de ensamblaje de la aplicación con inyección de temas
├── index.css           # Estilos globales y configuración/extensión de Tailwind v4
└── main.jsx            # Punto de entrada de React (Providers, Toaster y métricas)
```

---

## ⚙️ Configuración y Variables de Entorno

Para conectar el frontend a una tienda específica, se configuran las credenciales del proyecto Supabase y la API Key del comercio en el archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://<tu-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
VITE_STORE_API_KEY=b375c50c-c26c-4a1c-8a62-65da9860c922
```

- `VITE_SUPABASE_URL`: Dirección base del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Llave pública anónima de la base de datos de Supabase.
- `VITE_STORE_API_KEY`: API Key único (UUID en la columna `api_key` de la tabla `store`) que identifica la tienda activa a renderizar en el frontend.

---

## 🧠 Arquitectura y Flujos Clave Frontend <-> Backend

Para una descripción profunda de las tablas y el modelo ERD, consultar [context_backend.md](file:///c:/Users/Mabk/Desktop/postrecito/context_backend.md).

### 1. Carga Dinámica de la Tienda y Tasa de Cambio (`CurrencyContext.jsx`)
Al iniciar la aplicación:
- Se realiza una consulta a la tabla `store` filtrando por `api_key = VITE_STORE_API_KEY` para obtener la configuración de la tienda (branding, contacto, dirección, configuraciones de diseño).
- Se consulta la tabla `exchange` para obtener la tasa de cambio más reciente (`ORDER BY date DESC LIMIT 1`).
- Los datos se inyectan en el estado global para personalizar dinámicamente toda la experiencia visual y los precios en moneda local (Bs).

### 2. Catálogo Relacional y Opciones Variadas (`ProductList.jsx` / `ProductCard.jsx`)
- **Categorías**: Se obtienen de la tabla `category` filtrando por el ID de la tienda (`store`).
- **Productos e Imágenes**: Se cargan dinámicamente de `producto` uniendo la galería `ProductImagen(*)`.
- **Opciones y Variantes**: Se vinculan mediante `producto_grupo_relacion`, `producto_opciones_grupo` y `producto_opciones_valor` para permitir agregar ingredientes, tallas, extras o combinaciones a cada producto.
- **Cálculo de Precios Duales**: El precio base se procesa en USD y se calcula su equivalente en Bolívares (`price_bs`) utilizando la tasa activa de `exchange`.

### 3. Generación y Envío de Pedidos (`CartDrawer.jsx` & `pedido`)
- El carrito acumula los productos seleccionados junto con sus variantes/opciones elegidas.
- Al confirmar el pedido, el sistema puede registrar opcionalmente el encabezado en `pedido` y el desglose en `pedido_item` en Supabase (guardando las variantes en la columna `JSONB` `opciones_seleccionadas`).
- Se genera un formato enriquecido con el desglose del pedido y se redirige automáticamente al cliente al chat de WhatsApp oficial del comercio (`https://wa.me/<whatsapp_tienda>`).

---

## 🛠️ Comandos de Desarrollo

En la raíz del proyecto:

- `npm run dev`: Inicia el servidor de desarrollo local.
- `npm run build`: Genera la compilación optimizada de producción en `/dist`.
- `npm run preview`: Previsualiza la build de producción localmente.
