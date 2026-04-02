# SkyBlockCodexAPI

Una wiki interactiva de **Hypixel SkyBlock** construida como sitio estático para **GitHub Pages**.

El proyecto está pensado para convertir datos públicos de la API de Hypixel en una experiencia más visual, navegable y útil para jugadores: búsqueda de items, colecciones, skills, elecciones, Bingo y Museum, todo desde una web ligera sin backend tradicional.

## Características

- Búsqueda de **Items**, **Colecciones** y **Skills**
- Autocompletado y sugerencias
- Landing con animación de búsqueda
- Colores por rareza y renderizado de texto estilo Minecraft
- Soporte para formatos especiales como:
  - códigos `§`
  - formatos tipo `%%light_purple%%`
- Renderizado visual de items con:
  - iconos por `material`
  - soporte para `SKULL_ITEM` con skin personalizada
  - piezas de cuero tintadas según el color real del item
- Ficha de item orientada al jugador:
  - stats destacados
  - items relacionados
  - suma de stats del set
  - datos de Museum
- Colecciones con tiers, unlocks y enlaces a items relacionados
- Skills con niveles, XP y modal de unlocks
- Subpáginas dedicadas:
  - **Mayor**: gabinete actual + votaciones actuales
  - **Bingo**: grid 5x5 con modal por objetivo
  - **Museum**: navegador de items por categoría
- Página `404.html` para rutas no válidas
- 100% estático, ideal para **GitHub Pages**

## Estructura del proyecto

- `index.html` → Home y buscador principal
- `mayor.html` → Página del Mayor actual y elecciones
- `bingo.html` → Página de Bingo
- `museum.html` → Navegador de Museum
- `404.html` → Página de error
- `styles.css` → Estilos globales
- `app.js` → Lógica principal de la aplicación
- `favicon.svg` → Favicon
- `data/` → Recursos auxiliares
- `.github/workflows/pages.yml` → Deploy automático a GitHub Pages

## Desarrollo local

Puedes probarlo en local sin instalar dependencias:

```powershell
py -3 -m http.server 8000
```

Después abre:

```text
http://127.0.0.1:8000
```

## Deploy en GitHub Pages

El proyecto ya incluye workflow de GitHub Pages en:

```text
.github/workflows/pages.yml
```

Solo necesitas hacer push a la rama `main` y GitHub Pages publicará automáticamente la **raíz del proyecto**.

## API pública utilizada

El sitio consulta directamente estos endpoints públicos de Hypixel:

- `https://api.hypixel.net/v2/resources/skyblock/items`
- `https://api.hypixel.net/v2/resources/skyblock/collections`
- `https://api.hypixel.net/v2/resources/skyblock/skills`
- `https://api.hypixel.net/v2/resources/skyblock/election`
- `https://api.hypixel.net/v2/resources/skyblock/bingo`

> No se usan claves privadas; el sitio está planteado para funcionar como aplicación estática.

## Assets e iconos utilizados

Para representar visualmente los items y las heads se usan además estos servicios públicos:

- Texturas de items de Minecraft:
  - `https://assets.mcasset.cloud/1.20.4/assets/minecraft/textures/item/`
  - fallback legacy:
    - `https://assets.mcasset.cloud/1.16.2/assets/minecraft/textures/items/`
- Heads 3D para items tipo `SKULL_ITEM`:
  - `https://mc-heads.net/head/<textureId>/32`

## Detalles de implementación

### Items

- Colores por rareza
- Nombres con formato especial
- Imágenes basadas en `material`
- Soporte para cabezas personalizadas
- Ocultación automática de iconos si la imagen no existe
- Detección de sets de armadura y piezas relacionadas

### Collections

- Visualización de tiers
- Unlocks por tier
- Enlaces clicables a items cuando corresponde

### Skills

- Niveles calculados a partir de XP total acumulada
- XP necesaria por nivel
- Modal con recompensas y unlocks

### Mayor

- Mayor actual
- Minister
- Perks con formato visual de Minecraft
- Votaciones actuales ordenadas por votos

### Bingo

- Grid 5x5 estilo carta
- Modal por objetivo
- Lore completo
- Goals comunitarias destacadas

### Museum

- Navegador por categoría
- XP de donación
- Deducción de entradas únicas para conjuntos cuando aplica

## Notas

- La web intenta respetar el lenguaje visual de SkyBlock, no solo mostrar datos.
- Parte del trabajo consistió en normalizar estructuras de datos irregulares de la API pública.
- El proyecto está optimizado para ser ligero, fácil de desplegar y sencillo de ampliar.
