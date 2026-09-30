---
tipo: registro-correccion
fichas: [E08]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E08 — el ancho de Code 128 no coincidía con lo emitido

Fecha: 2026-09-29
Ficha: [[E08 - El ancho de Code 128 no coincide con el comando emitido]]
Commit: `fix: resolve review findings E01-E06, E08, E09 and E18`

## Comprensión inicial

- **Ocurría:** el ancho se calculaba con subconjunto C para los dígitos, pero `^FD` iba sin código de inicio. En modo N y sin inicio, la Zebra usa B para todo. En 76 productos ese símbolo B no cabe en 400 dots. Ej.: producto 246, `47960195602341`: 112 módulos medidos, 189 impresos.
- **Por qué:** se intentaba adivinar la elección automática del firmware.

## Antes del cambio

`code128.test.ts`: se esperaba `fieldData` con `>;`/`>:` y cambios `>5`/`>6`; `zpl.builder.test.ts` esperaba `^BCN,72,Y,N,N,N`. Fallaron los 6.

## Cambio

- `encodeCode128Auto()` reparte el dato en tramos B/C con las reglas de ISO/IEC 15417 anexo E y devuelve además `fieldData` con los códigos de invocación de `^BC` (`>;` inicio C, `>:` inicio B, `>5` a C, `>6` a B, `><` un `>` literal). El ancho medido y el impreso salen del mismo reparto.
- `BarcodeImprimible.fieldData` lleva ese `^FD`; `^BC` declara el modo `N` explícito.
- Se corrigió el valor del cambio de subconjunto: se usaba 104 ("inicio B") en vez de 100 ("cambiar a B"). El ancho no cambiaba; los anchos dibujados en la vista previa sí.
- `scripts/render-label.ts` quita los códigos de invocación antes de dibujar.

## Después del cambio

- Catálogo: 563 productos en Code 128 (antes 561): los alfanuméricos con dígitos finales ahora usan C y 2 más caben. `XPROD20220002`: 145 módulos en vez de 178.
- `scripts/check-barcode-plan.ts` 32/32 (se actualizó el valor esperado 178 → 145).

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendiente de prueba física:** escanear con el lector del puesto los productos 246 (`47960195602341`), 239 (`0000180`) y uno alfanumérico.
