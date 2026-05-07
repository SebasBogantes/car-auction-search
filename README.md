# 🚗 Buscador de Hyundai Tucson – Subastas USA

App web estática que busca en tiempo real **Hyundai Tucson 2015/2016 con motor de gasolina** en plataformas de listados de carros usados de Estados Unidos.

---

## 📋 Análisis de fuentes disponibles

### ✅ Fuentes con API pública real

| Plataforma | Free tier | Listados | Filtro año/marca/modelo/combustible |
|------------|-----------|----------|-------------------------------------|
| **MarketCheck** | 500 llamadas/mes | ✅ Dealers + subastas | ✅ Todos |
| **Auto.dev** | 1,000 llamadas/mes | ✅ Millones de listados | ✅ make/model/year (combustible: filtro cliente) |

### ❌ Plataformas SIN API pública

| Plataforma | Razón |
|------------|-------|
| **Copart** | Sin API pública. Requiere registro como dealer |
| **IAAI (IAA)** | Sin API pública. Solo portal web |
| **Manheim** | API privada para dealers (Cox Automotive) |
| **Cars.com** | Requiere partnership comercial |
| **CarGurus** | Solo API de reviews de dealers, no listados |
| **AutoTrader** | Partnership pago |

> **Conclusión:** No existe API pública gratuita para las grandes subastas mayoristas (Copart, IAAI, Manheim). Estas plataformas operan solo con dealers registrados. Las únicas fuentes con API pública documentada y free tier son MarketCheck y Auto.dev.

---

## 🏗️ Arquitectura del proyecto

```
car-auction-search/
├── index.html    → Interfaz HTML completa
├── styles.css    → Estilos responsivos (sin framework)
├── app.js        → Toda la lógica: API calls, normalización, render
├── .gitignore
└── README.md
```

**Por qué esta arquitectura:**
- **Sin framework ni build step** → abre directo en el browser, despliega como archivos estáticos
- **Sin backend propio** → las API calls se hacen desde el browser directamente a MarketCheck y Auto.dev
- **API keys en localStorage** → nunca en el código fuente, nunca en el repositorio
- **Compatible con GitHub Pages, Vercel y Render** (todos sirven archivos estáticos gratis)

---

## 🚀 Instalación y uso local

### Requisito
Solo necesitas un navegador moderno. No se requiere Node.js, npm ni ninguna otra herramienta.

### Pasos

**1. Clona o descarga el proyecto**
```bash
git clone https://github.com/TU_USUARIO/car-auction-search.git
cd car-auction-search
```

**2. Obtén tus API keys gratuitas**

- **MarketCheck** (500 llamadas/mes gratis):
  1. Ve a https://www.marketcheck.com/apis/pricing/
  2. Regístrate en el plan Free
  3. Copia tu API key

- **Auto.dev** (1,000 llamadas/mes gratis):
  1. Ve a https://www.auto.dev/
  2. Crea una cuenta gratuita
  3. Copia tu API key desde el dashboard

**3. Abre la app**

Opción A – Abre directamente en el browser:
```
Doble clic en index.html
```

Opción B – Con servidor local (recomendado para evitar restricciones CORS en algunos browsers):

Si tienes Python:
```bash
python -m http.server 8080
# Abre http://localhost:8080
```

Si tienes Node.js:
```bash
npx serve .
# Abre la URL que muestre en consola
```

Si tienes VS Code: instala la extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*

**4. Configura las API keys en la app**
- Al abrir por primera vez, la app muestra un modal de configuración
- Ingresa tus keys → clic en **Guardar y continuar**
- Las keys se guardan en localStorage (solo en tu browser, nunca en ningún servidor)

**5. Busca**
- Clic en el botón **🔍 Buscar**
- Los resultados aparecen ordenados por precio, de menor a mayor

---

## 🌐 Despliegue en GitHub Pages (gratis)

**1. Crea el repositorio en GitHub**
```bash
git init
git add index.html styles.css app.js .gitignore README.md
git commit -m "Initial commit: buscador Hyundai Tucson"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/car-auction-search.git
git push -u origin main
```

**2. Activa GitHub Pages**
1. Ve a tu repo en GitHub
2. Clic en **Settings** → **Pages** (menú lateral)
3. En *Source*, selecciona **Deploy from a branch**
4. Branch: `main`, Folder: `/ (root)`
5. Clic en **Save**
6. Espera ~2 minutos → tu app estará en `https://TU_USUARIO.github.io/car-auction-search/`

> ⚠️ **Importante sobre seguridad:** Con GitHub Pages los archivos son públicos. Las API keys se guardan en el localStorage del browser del visitante, nunca en el código fuente. El repositorio no contiene ninguna key.

---

## 🌐 Despliegue en Vercel (alternativa recomendada)

Vercel ofrece HTTPS automático, CDN global y es igual de gratuito.

**1. Instala Vercel CLI (opcional)**
```bash
npm i -g vercel
vercel login
vercel   # sigue las instrucciones en consola
```

**O conéctalo directamente desde vercel.com:**
1. Ve a https://vercel.com y regístrate con GitHub
2. Clic en **Add New Project** → importa tu repositorio
3. Vercel detecta que es un sitio estático → despliega automáticamente
4. Tu app queda en `https://car-auction-search.vercel.app` (o similar)

---

## 📁 Descripción de cada archivo

### `index.html`
Estructura HTML de la app:
- **Modal de API keys**: aparece en el primer uso para que el usuario ingrese sus claves
- **Header**: título y botón de configuración
- **Sección de búsqueda**: pills con los filtros activos + botón Buscar
- **Estados**: loading spinner, banner de error, barra de stats
- **Grid de resultados**: contenedor donde se insertan las cards dinámicamente

### `styles.css`
Estilos modernos sin dependencias externas:
- Variables CSS para colores y sombras
- Layout responsivo: 3 columnas en desktop, 2 en tablet, 1 en móvil
- Cards con hover effect (lift + shadow)
- Modal con animación de entrada
- Spinner CSS puro

### `app.js`
Toda la lógica de la aplicación en un solo archivo:

| Sección | Qué hace |
|---------|----------|
| `SEARCH` | Parámetros de búsqueda (modificar aquí para otros autos) |
| `getKeys / saveKeys / openSettings` | Gestión de API keys en localStorage |
| `fetchMarketCheck` | Llama a la API de MarketCheck, maneja errores |
| `normalizeMarketCheck` | Convierte la respuesta al formato interno |
| `fetchAutoDev` | Llama a Auto.dev (2 requests en paralelo: año 2015 y 2016) |
| `isGasoline` | Filtra por combustible en cliente (Auto.dev no soporta este filtro en server) |
| `normalizeAutoDev` | Convierte la respuesta al formato interno |
| `buscar` | Orquesta todo: llama APIs, deduplica por VIN, ordena por precio, renderiza |
| `createCard` | Construye cada card con DOM seguro (sin innerHTML con datos externos) |

---

## 🔧 Personalización

Para buscar otro vehículo, edita las primeras líneas de `app.js`:

```javascript
const SEARCH = {
  make:     'Toyota',       // Marca
  model:    'Camry',        // Modelo
  years:    ['2018', '2019'], // Años
  fuelType: 'Gas',          // Gas | Diesel | Electric | Hybrid
};
```

---

## 🚀 Mejoras futuras posibles

- **Filtros interactivos**: precio máximo, millaje máximo, estado (CA, TX, FL…), tipo de daño
- **Alertas por email**: integrar con EmailJS o Formspree para recibir email cuando aparezcan nuevos resultados por debajo de un precio
- **Cálculo de margen**: campo para ingresar costo de importación/reparación y estimar ganancia
- **Exportar a CSV**: botón para descargar los resultados en Excel
- **Historial de búsquedas**: guardar búsquedas anteriores en localStorage
- **Paginación**: cargar más resultados con botón "Cargar más"
- **Más fuentes**: si en el futuro Copart o IAAI abren una API pública, agregarla en `app.js` siguiendo el mismo patrón de `fetchMarketCheck`
- **Backend proxy con Vercel Functions**: para ocultar las API keys en entornos compartidos o empresariales

---

## ⚠️ Limitaciones conocidas

1. **CORS en algunas APIs**: Si el browser bloquea la llamada con error CORS, usa VS Code + Live Server o despliega en Vercel/GitHub Pages (el problema desaparece en producción con HTTPS).

2. **No son subastas puras**: MarketCheck y Auto.dev agregan listados de dealers, no exclusivamente subastas. No existen APIs públicas gratuitas para las grandes subastas mayoristas (Copart, IAAI, Manheim).

3. **Límite del free tier**: 500 llamadas/mes en MarketCheck. Para uso intensivo, considera el plan de pago.

4. **Auto.dev y combustible**: Auto.dev no soporta filtro de combustible como parámetro de server. El filtro se aplica en el cliente después de recibir los datos.

---

## 📄 Licencia

MIT – Libre para uso personal y comercial.
