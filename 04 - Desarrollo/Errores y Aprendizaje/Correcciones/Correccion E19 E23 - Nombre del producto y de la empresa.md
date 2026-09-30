---
tipo: registro-correccion
fichas: [E19, E23]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E19 y E23 — nombre del producto y nombre de la empresa

Fecha: 2026-09-29
Fichas: [[E19 - Los nombres largos pueden superponerse]], [[E23 - Guardar el nombre de empresa no cambia la plantilla]]
Commit: `fix(template): wrap long product names safely and print the business name without logo`

## Comprensión inicial

- **E19:** con barcode, el nombre tenía 1 línea de 240 dots a fuente 14. Hay 1.049 nombres de más de 30 caracteres (máximo 50), y `^FB` superpone en la última línea lo que no entra.
- **E23:** `businessName` se guardaba y llegaba al generador, pero ninguna zona lo imprimía.

## Antes del cambio

Tests nuevos, en RED:
- `fitText` (ajuste por palabras con corte explícito "...") no existía.
- Con los 3.080 nombres del catálogo, ninguno debía cortarse en el área de nombre de 50 × 25: fallaba con 1 línea.
- Una etiqueta de 40 × 20 (sin logo) debía imprimir "TIENDA DE PRUEBA": no lo hacía.

## Cambio

- **E19:** el nombre pasa a **2 líneas de fuente 12** (y 70..94, el barcode empieza en 96; el precio sigue en x 250). `fitText()` hace el mismo ajuste que `^FB` con el ancho nominal de la fuente (conservador) y corta con "..." lo que no entra. Se aplica a toda zona de texto con ancho máximo, también en la variante sin barcode.
- **E23:** decisión: el logo PA PICAR es la marca. El nombre de empresa se imprime como texto arriba **solo cuando la etiqueta no tiene logo** (menos de 25 mm de alto o de ancho). Con logo no se repite. `/settings` lo explica bajo el campo.
- **Fixtures dorados de 50 × 25:** cambian a propósito. El diff son exactamente dos líneas por etiqueta con barcode: `^A0N,14,8` → `^A0N,12,8` y `^FB240,1,…` → `^FB240,2,…`. La etiqueta sin barcode no cambió.

## Después del cambio

Suite (87), typecheck, `check-barcode-plan` 32/32 y `check-busqueda` 26/26 en verde. Ningún nombre del catálogo real se corta.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendiente de prueba física:** imprimir en 50 × 25 los nombres más largos del catálogo y uno con acentos, y confirmar que la fuente 12 se lee y no toca el barcode; imprimir una etiqueta chica con nombre de empresa.
