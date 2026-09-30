---
tipo: registro-correccion
fichas: [E01, E02, E03]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E01, E02 y E03 — resolución de productos

Fecha: 2026-09-29
Fichas: [[E01 - Un barcode identifica dos productos]], [[E02 - La proteccion de prefijos bloquea identificadores validos]], [[E03 - La etiqueta impresa no vuelve al mismo producto]]
Commit: `fix: resolve review findings E01-E06, E08, E09 and E18` (rama `fix/revision-2026-09-29`)

Se corrigieron juntas porque las tres viven en la misma decisión: ¿este texto identifica a **un** producto?

## Comprensión inicial

- **Qué esperaba el usuario:** escanear o teclear un identificador completo y obtener su producto; si hay duda, elegir.
- **Qué ocurría:** `findByBarcode()` usaba `.find()` y devolvía el primer duplicado (E01). `resolveQuery()` descartaba cualquier texto que fuera prefijo de otro barcode antes de mirar si era un identificador completo (E02). El catálogo guarda el código original y la etiqueta imprime el corregido, así que el escaneo no volvía (E03).
- **Por qué:** se confundía "coincide entero" con "identifica a uno solo", y la búsqueda comparaba contra lo guardado, no contra lo impreso.

## Antes del cambio

Tests en `label-printer-web/src/lib/products/product.lookup.test.ts` con productos reales del catálogo:

| Consulta | Esperado | Obtenido antes |
|---|---|---|
| `7509546074627` (2042 y 2048) | `ambiguous` | `exact` → 2042 |
| `438` (código, prefijo de `4388`) | `ambiguous`, 438 primero | `partial` |
| `4796019560234` (247, prefijo de 246) | `ambiguous`, 247 primero | `none` |
| `0400000570600` (1067 impreso corregido) | `exact` → 1067 | `none` |

Comando: `npm test`. Los 4 fallaron por esas razones.

## Cambio

- `MatchKind` suma `ambiguous`: identificador completo que no alcanza para elegir uno. Los completos van primero.
- `ProductRepository.findByBarcode` → `findAllByBarcode` (todos, guardado **o impreso**); `esPrefijoDeBarcode` → `findByBarcodePrefix` (devuelve los productos para ofrecerlos).
- `barcodeImpreso()` en `barcode-plan.ts`: lo que el escáner leerá de la etiqueta. Misma función que decide el `^FD`.
- Barcodes `0`, `000…` y `null` no identifican a nadie (4 productos tienen `0`).
- La lógica de coincidencia pasó a `product.memory.repository.ts`; el repositorio del catálogo y `scripts/check-busqueda.ts` usan el mismo código.
- `/api/labels` resuelve por código interno y solo acepta un barcode si identifica a un producto.
- `/fast` no imprime `ambiguous`; el modo normal lo presenta como lista con su propio mensaje.

Alternativa descartada: seguir descartando prefijos y agregar excepciones. Movía el fallo sin resolverlo.

## Después del cambio

- Los 4 casos pasan. Un corte que no coincide entero sigue sin ser `exact`.
- `product.lookup.catalog.test.ts` recorre el catálogo real: 3.075 etiquetas con barcode real, 3.061 vuelven `exact`, 14 `ambiguous`, **0 perdidas, 0 con otro producto**. Los 3.080 códigos internos se ofrecen al teclearlos (antes 285 no).
- `scripts/check-busqueda.ts`: 26/26. Se cambió la aserción que exigía que `"1"` fuera "demasiado corto": era el propio bug de E02.

## Cierre

- [x] El caso original se corrige.
- [x] Los casos relacionados siguen funcionando.
- [x] Causa explicada arriba.
- [x] Evidencia reproducible: `npm test`.

**Pendientes y límites:** 14 barcodes no se imprimen en `/fast` (el par duplicado y 12 cortos como `202616` que son prefijo de otros). La solución de fondo es corregirlos en el sistema de origen. **Pendiente de prueba física:** escanear etiquetas reales del 1067 y de un UPC-A.
