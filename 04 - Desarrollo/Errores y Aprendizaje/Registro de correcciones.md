---
tipo: indice-correcciones
fecha: 2026-09-29
---
# Registro de correcciones

Estado de cada ficha de [[Mapa de errores y aprendizaje]]. Cada corrección se hizo con TDD: primero un test que reproduce el problema y falla, después el cambio. El detalle (antes, cambio, después, límites) está en la nota de corrección enlazada; el historial de código, en la rama `fix/revision-2026-09-29` y en `CHANGELOG.md`.

**Cómo verificar desde cero** (en `label-printer-web/`): `npm ci`, `npm test`, `npm run typecheck`, y los scripts `node --import ./test/resolve-ts.mjs scripts/check-busqueda.ts` y `scripts/check-barcode-plan.ts`.

**Qué no está verificado:** nada se probó con Windows, la GK420t ni el lector del puesto. La columna "Prueba física" dice qué falta; ver [[M05 - Verificar el resultado con hardware real]].

| Ficha | Estado | Registro | Prueba física |
|---|---|---|---|
| E01, E02, E03 | corregido | [[Correccion E01 E02 E03 - Resolucion de productos]] | escanear 1067 y un UPC-A |
| E04 | corregido | [[Correccion E04 - Cola de escaneos]] | tres escaneos durante una impresión |
| E05 | corregido (provisional) | [[Correccion E05 - Medidas de etiqueta]] | imprimir la medida estándar elegida |
| E06, E18 | corregido | [[Correccion E06 E18 - Texto seguro en ZPL]] | etiqueta con Ñ, É y Ç |
| E08 | corregido | [[Correccion E08 - Code 128 explicito]] | escanear 246, 239 y un alfanumérico |
| E09 | corregido | [[Correccion E09 - Lotes USB por stdin]] | tirada USB de 20+ etiquetas |
