---
tipo: registro-correccion
fichas: [E05]
fecha: 2026-09-29
estado: corregido-provisional
prueba-fisica: pendiente
---
# Corrección de E05 — las medidas guardadas no cambiaban la etiqueta

Fecha: 2026-09-29
Ficha: [[E05 - Las dimensiones guardadas no cambian la etiqueta]]
Commit: `fix: resolve review findings E01-E06, E08, E09 and E18`

## Comprensión inicial

- **Esperado:** cambiar ancho y alto en `/settings` cambia la etiqueta.
- **Ocurría:** `/api/labels` usaba siempre `DEFAULT_TEMPLATE` (50 × 25 mm).
- **Decisión del usuario (2026-09-29):** que el tamaño sea configurable ahora y fijar un estándar más adelante.

## Antes del cambio

Se guardó como fixture el ZPL exacto que la plantilla original generaba para 50 × 25 (EAN-13, Code 128 y sin barcode) en `label-printer-web/test/fixtures/`. Tests nuevos: 100 × 50 debía emitir `^PW800 ^LL400` y centrar logo y barcode; 40 × 25 no debía emitir un EAN-13 que no cabe. Fallaron los tres.

## Cambio

- `buildLabelTemplate({ widthMm, heightMm })`: posiciones escalan con ancho y alto, fuentes con el menor factor (mínimo 10 dots).
- No escala: módulo de 3 dots (ISO/IEC 15420), alto de barcode mínimo 53 dots (6,64 mm) y el logo (bitmap fijo, se omite si la etiqueta mide menos de 25 mm de alto).
- `DEFAULT_TEMPLATE = buildLabelTemplate(50, 25)`; `/api/labels` usa la medida guardada.
- `planBarcode` ahora también rechaza un EAN-13 que no cabe. Con 50 mm siempre cabía y no se comprobaba.
- Schema: ancho 30–104 mm (104 = ancho máximo de impresión de la GK420t), alto 20–100 mm. El formulario muestra los mismos límites.

## Después del cambio

- 50 × 25 produce byte a byte el ZPL original (3 fixtures).
- Todas las zonas quedan dentro de la etiqueta para 30×20, 50×25, 60×40 y 104×100.
- `npm test`, `npm run typecheck`.

## Cierre

- [x] Caso original corregido. - [x] 50 × 25 intacto. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** el escalado es una aproximación. Cuando se fije el estándar conviene diseñarle su plantilla a mano, como la de 50 × 25. **Pendiente de prueba física:** imprimir la medida elegida.
