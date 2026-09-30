# API XETUX POSADMIN

> **EN SUSPENSO**: la integracion con XETUX esta temporalmente fuera de alcance. La app usa un catalogo local (`data/catalog.json`). Esta nota se conserva como referencia para cuando se decida reintegrar.

## Contexto

XETUX / POSADMIN es una **aplicacion web** que funciona en Google Chrome (version v1.27.66). Esto significa que el navegador utiliza una **API REST interna** para obtener datos de productos, precios, etc.

## Como Descubrir la API

### Paso a paso

1. Abrir POSADMIN en Chrome
2. Presionar **F12** (o clic derecho > Inspeccionar)
3. Ir a la pestaña **Network** (Red)
4. Buscar un producto dentro de POSADMIN
5. Observar las peticiones que aparecen en la lista

### Que buscar

- URLs que contengan: `product`, `search`, `items`, `precio`, `articulo`
- Metodos: `GET` o `POST`
- Respuestas en formato **JSON**

### Informacion a capturar

| Dato | Ejemplo |
|---|---|
| URL completa | `https://posadmin.local/api/products?code=7591234567890` |
| Metodo HTTP | GET / POST |
| Headers | Authorization, Content-Type, etc. |
| Body (si POST) | `{ "code": "7591234567890" }` |
| Respuesta JSON | `{ "name": "CAFE AMANECER", "price": 7.80 }` |

## Ejemplo Esperado de Respuesta JSON

```json
{
  "code": "7591234567890",
  "name": "CAFE AMANECER DE 500GR",
  "price": 7.80,
  "reference": "REF-001",
  "description": "Cafe molido premium",
  "barcode": "7591234567890"
}
```

> **Nota**: La estructura real puede ser diferente. Hay que capturar la respuesta real.

## Preguntas Pendientes

- [ ] Cual es la URL base de la API?
- [ ] Requiere autenticacion (login)?
- [ ] Cual es el endpoint de busqueda por codigo?
- [ ] Cual es el formato exacto de la respuesta?
- [ ] Hay rate limiting?

## Ver tambien

- [[XETUX POSADMIN Info]]
- [[Arquitectura General]]
