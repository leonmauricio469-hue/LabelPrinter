---
tipo: registro-correccion
fichas: [E25]
fecha: 2026-09-29
estado: corregido
prueba-fisica: no
---
# Corrección de E25 — el aviso de EAN incorrecto no describía lo que se imprime

Fecha: 2026-09-29
Ficha: [[E25 - El aviso de EAN incorrecto no describe lo que se imprime]]
Commit: `fix(catalog): derive the check-digit warning from the print plan`

## Comprensión inicial

- **Ocurría:** al cargar el catálogo, el repositorio avisaba "ninguna etiqueta de estos productos será legible" para los EAN-13 con dígito de control mal. Pero el plan de impresión corrige ese dígito, así que la etiqueta sí se lee. Además, la regla propia del aviso miraba solo códigos de 13 dígitos y se saltaba los UPC-A de 12 que el plan también corrige.
- **Por qué:** dos lugares decidían lo mismo con reglas distintas.

## Antes del cambio

El aviso se extrajo tal cual a `src/lib/products/catalog.warnings.ts`. Tests en `catalog.warnings.test.ts`:
- Sobre el catálogo real, el aviso debía listar exactamente los 6 productos corregidos por el plan (735, 1067, 1322, 1378, 1694, 1843): listaba solo una parte.
- Un UPC-A de 12 dígitos inválido debía avisarse: no se avisaba.
- El mensaje no debía decir "legible" y debía decir qué se guarda y qué se imprime: fallaba.

Durante el trabajo, un dato de prueba mío estaba mal (`012345678905` es un UPC-A válido: el dígito de control de `0012345678905` es 5). Se corrigió el dato del test, no el código.

## Cambio

- `digitoCorregido()` en `barcode-plan.ts`: la misma decisión que usa `planBarcode`.
- `checkDigitWarning()` usa esa función y dice, por producto, "guarda X, se imprime Y", pidiendo corregirlo en el sistema de origen.
- El repositorio del catálogo usa `checkDigitWarning`.

## Después del cambio

4/4 tests; suite (75) y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** corregir los 6 códigos en el sistema de origen.
