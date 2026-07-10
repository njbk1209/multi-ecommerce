# Contexto del Proyecto: Postrecito Frontend 🍰 (Versión Supabase)

Este documento proporciona una visión general técnica y arquitectónica del frontend de **Postrecito** (o la tienda configurada de forma activa), adaptado para consumir datos directamente de una instancia de **Supabase**.

---

## 🚀 Tecnologías y Herramientas

El proyecto está construido con un stack moderno y ligero enfocado en el rendimiento y la experiencia de usuario:

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
├── assets/             # Recursos estáticos (imágenes, logos, etc.)
├── components/         # Componentes reutilizables de UI
│   ├── CartDrawer.jsx     # Panel lateral deslizable para el carrito de compras (redirige a WhatsApp)
│   ├── Footer.jsx         # Pie de página dinámico basado en store.comercial_name
│   ├── ImageCarousel.jsx  # Galería/Carrusel interactivo para imágenes de productos
│   ├── Navbar.jsx         # Barra de navegación principal, selector de divisas y marca dinámica
│   └── ProductCard.jsx    # Tarjeta de producto individual con precio dual e inventario
├── context/            # Manejo del estado global de la aplicación (React Context)
│   ├── CartContext.jsx    # Estado del carrito, totales en USD y Bs, y operaciones
│   └── CurrencyContext.jsx# Tasa de cambio diaria (de Supabase) y selector de moneda activa (USD/Bs)
├── sections/           # Secciones grandes que componen la Landing Page
│   ├── About.jsx          # Sección informativa del negocio (historia)
│   ├── Hero.jsx           # Banner principal de bienvenida
│   └── ProductList.jsx    # Catálogo dinámico con filtros de categorías y paginación (vía Supabase)
├── utils/              # Funciones y configuraciones auxiliares
│   └── supabase.js        # Configuración e inicialización del cliente de Supabase
├── App.jsx             # Punto de ensamblaje de la aplicación
├── index.css           # Estilos globales y configuración/extensión de Tailwind v4
└── main.jsx            # Punto de entrada de React (Providers, Toaster y Vercel)
```

---

## ⚙️ Configuración y Variables de Entorno

El frontend interactúa con Supabase y requiere definir las credenciales del proyecto y la API Key de la tienda activa en un archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://<tu-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
VITE_STORE_API_KEY=b375c50c-c26c-4a1c-8a62-65da9860c922
```

- `VITE_SUPABASE_URL`: Dirección base del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Llave pública anónima de la base de datos de Supabase.
- `VITE_STORE_API_KEY`: API Key único (UUID en la columna `api_key` de la tabla `store`) que determina qué tienda cargará en el frontend.

---

## 🧠 Arquitectura y Flujos Clave

### 1. Inicialización Global y Tasa de Cambio (`CurrencyContext.jsx`)
Al montar la aplicación:
- Se realiza una consulta a la tabla `store` filtrando por `api_key = VITE_STORE_API_KEY` para obtener los datos específicos de la tienda (nombre comercial, whatsapp, dirección, etc.).
- Se realiza una consulta a la tabla `exchange` para obtener la tasa de cambio más reciente (ordenada por fecha desc).
- La tienda y la tasa se guardan en el estado global para su consumo por los demás componentes.

### 2. Catálogo Relacional (`ProductList.jsx`)
- **Categorías**: Se cargan de la tabla `category` filtrando por el ID numérico de la tienda activa.
- **Productos**: Se cargan dinámicamente de la tabla `producto` filtrando por la tienda activa (`store`), su estado de activación (`is_active = true`) y opcionalmente por la categoría.
- Se hace un join relacional para obtener los datos de la categoría (`category(*)`) y las imágenes del producto (`ProductImagen(*)`).
- **Mapeo de Datos**: Los productos se transforman antes de enviarse a la UI:
  - Se calcula el precio en Bolívares (`price_bs`) multiplicando por la tasa activa.
  - Se calcula el porcentaje de descuento dinámicamente si existe un `compare_price`.
  - Se mapea la estructura de imágenes de `ProductImagen` (columnas `url` y `is_primary`) a la que requiere el carrusel.

### 3. Pedidos por WhatsApp (`CartDrawer.jsx`)
- Se eliminó el almacenamiento intermedio en base de datos.
- Al confirmar el carrito, los datos del formulario (Nombre, WhatsApp de cliente) y el resumen de la compra se formatean en un mensaje de texto enriquecido.
- La aplicación redirige de forma directa al cliente al enlace de WhatsApp de la tienda (`https://wa.me/<whatsapp_tienda>`) utilizando el número de teléfono obtenido dinámicamente de `store.whatsapp` y formateado al código de país (`58`).

---

## 🛠️ Comandos de Desarrollo

En la raíz del proyecto:

- `npm run dev`: Servidor de desarrollo local.
- `npm run build`: Genera la build optimizada de producción en `/dist`.
- `npm run preview`: Previsualiza la build de producción de manera local.
