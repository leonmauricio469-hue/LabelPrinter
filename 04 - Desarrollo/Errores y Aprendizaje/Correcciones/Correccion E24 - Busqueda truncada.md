---
tipo: registro-correccion
fichas: [E24]
fecha: 2026-09-29
estado: corregido
prueba-fisica: no
---
# Corrección de E24 — la búsqueda ocultaba que faltaban resultados

Fecha: 2026-09-29
Ficha: [[E24 - La busqueda oculta que faltan resultados]]
Commit: `fix(search): report the total when the result list is cut`

## Comprensión inicial

- **Ocurría:** la búsqueda parcial se corta en `MAX_BUSQUEDA` (60) y la UI contaba la lista recibida: decía "60 productos coinciden" aunque fueran cientos.

## Antes del cambio

- `product.lookup.test.ts`: 61 productos "LECHE …" debían dar `products.length = 60` y `total = 61`; una búsqueda con 2 resultados, `total = 2`. Fallaron: `total` no existía.
- `use-print.test.ts`: `matchesMessage` debía decir "Se muestran 60 de 214 … Escribe mas para acotar". Falló: no existía.

## Cambio

- `LookupOutcome.total` en los resultados `partial` y `ambiguous`; `/api/products` lo devuelve tal cual.
- `matchesMessage()` en el cliente: si faltan resultados lo dice y pide escribir más; si no, el mensaje corto; los `ambiguous` tienen su propio texto.
- Una coincidencia parcial sigue exigiendo que el operador elija, aunque sea una sola.

Alternativa considerada: paginar. Se dejó para después: con 3 caracteres mínimos y "escribe más" alcanza para el puesto.

## Después del cambio

5 tests nuevos en verde; suite (80) y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.
