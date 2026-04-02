# SkyBlockCodexAPI

Una wiki interactiva de **Hypixel SkyBlock** construida como sitio estático para GitHub Pages. Incluye búsqueda de items, colecciones y skills, además de subpáginas de Mayor y Bingo con datos actuales desde la API pública.

## Características

- Búsqueda de **Items**, **Colecciones** y **Skills**
- Autocompletado y sugerencias
- Colores por rareza y stats estilo Minecraft
- Subpáginas:
  - **Mayor** (gabinete actual + votaciones)
  - **Bingo** (grid 5x5 con modal de objetivos)
- 100% estático: ideal para **GitHub Pages**

## Estructura

- `index.html` → Home
- `mayor.html` → Detalles del Mayor
- `bingo.html` → Detalles de Bingo
- `404.html` → Página 404
- `styles.css` → Estilos
- `app.js` → Lógica
- `.github/workflows/pages.yml` → Deploy en GitHub Pages

## Desarrollo local

```powershell
py -3 -m http.server 8000
```

Abrir:

```
http://127.0.0.1:8000
```

## Deploy en GitHub Pages

Ya está listo el workflow en:

```
.github/workflows/pages.yml
```

Solo necesitas hacer push a la rama `main` y Pages publicará automáticamente la raíz del proyecto.

## API Pública utilizada

- `https://api.hypixel.net/v2/resources/skyblock/items`
- `https://api.hypixel.net/v2/resources/skyblock/collections`
- `https://api.hypixel.net/v2/resources/skyblock/skills`
- `https://api.hypixel.net/v2/resources/skyblock/election`
- `https://api.hypixel.net/v2/resources/skyblock/bingo`

> No se usan claves privadas; el sitio es completamente estático.

## Notas

- El color y formato de texto imita el estilo de Minecraft para mantener coherencia visual.

---
