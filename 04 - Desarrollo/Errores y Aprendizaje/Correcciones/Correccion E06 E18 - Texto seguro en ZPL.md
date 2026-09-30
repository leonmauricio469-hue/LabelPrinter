---
tipo: registro-correccion
fichas: [E06, E18]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E06 y E18 — texto seguro y codificación única en ZPL

Fecha: 2026-09-29
Fichas: [[E06 - El texto puede convertirse en comandos ZPL]], [[E18 - USB y TCP no usan la misma codificacion]]
Commit: `fix: resolve review findings E01-E06, E08, E09 and E18`

## Comprensión inicial

- **E06:** el texto iba directo a `^FD`. Un nombre `CAFE^FS^XZ` cerraba el campo y la etiqueta; un `~JA` en los datos cancelaría todos los trabajos de la impresora.
- **E18:** USB enviaba latin1, TCP UTF-8, y la etiqueta no declaraba `^CI`. El catálogo tiene Ñ, tildes y Ç.

## Antes del cambio

Tests en `zpl.builder.test.ts` y `spooler.invocation.test.ts`: `CAFE^FS^XZ` producía 2 `^XZ`; `~JA` pasaba crudo; no había `^CI28`; `Ñ` salía como el byte `0xD1` en vez de `C3 91`. Fallaron los 5.

## Cambio

- `fieldData()` en `zpl.builder.ts`: todos los campos usan `^FH\`, y `^`, `~` y `\` viajan como `\5E`, `\7E`, `\5C`. Saltos de línea → espacio.
- `^CI28` al inicio de cada etiqueta; `zplPayload()` codifica UTF-8 para USB y TCP escribe con `"utf8"` explícito.
- `scripts/render-label.ts` entiende `^FH\^FD` y decodifica los escapes.

## Después del cambio

`npm test`: un solo `^XA`/`^XZ` por etiqueta, `\7EJA` en vez de `~JA`, `^CI28` presente, `Ñ` → `C3 91`.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendiente de prueba física (E18):** `^CI28` depende del firmware de la GK420t y de los glifos de la fuente `^A0`. Imprimir una etiqueta con Ñ, É y Ç antes de dar E18 por cerrada.
