# Ghibli Films Inspector — API REST (Vanilla ES6+)

Mini-app de clase que consume `https://ghibliapi.vercel.app/films/` y ofrece 4 botones:

- **Títulos + Director** (lista por consola y UI)
- **Título + Año** (`release_date`)
- **Título + Descripción**
- **IDs** (id de cada película)

**Optimización pedida:** la lista se consulta **solo la primera vez**. Desde el segundo click, se usa **cache local (memoria)**.

## Cómo ejecutar

Abrir `index.html` en el navegador.  
Recomendado: abrir DevTools → Console para ver los `console.table()`.

## Flujo (Mermaid)

```mermaid
flowchart TD
  A[Click en botón] --> B{¿Cache existe?}
  B -- No --> C[fetch API /films]
  C --> D[Guardar state.films + timestamp]
  B -- Sí --> E[Usar state.films]
  D --> F[Log a consola según vista]
  E --> F
  F --> G[Render UI (cards) + toast]
```

## Notas de calidad

UI dark moderna, accesible (focus visible + aria-live).

Loader con contador de segundos mientras carga.

“Ver más / ver menos” en descripciones.

Sin dependencias externas.
